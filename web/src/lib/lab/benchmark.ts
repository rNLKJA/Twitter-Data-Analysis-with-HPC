import { amdahlLimit, fitSerialFraction, karpFlatt, type ScalingPoint } from "../amdahl";
import { createRng } from "../synth/prng";
import {
  percentileInterval,
  resampleIndices,
  resolveBootstrap,
  type BootstrapOptions,
} from "../stats/bootstrap";
import { median } from "../stats/descriptive";
import type { Interval } from "../stats/interval";
import { medianInterval, type MedianInterval } from "../stats/order";

/**
 * The browser benchmark protocol (see docs/decisions/DR-004).
 *
 *  - Warm-up: W rounds, each running every worker count once, discarded
 *    (they start the workers, warm the JIT and the file's pages).
 *  - Measurement: R rounds. Each round runs every worker count once, in an
 *    order shuffled with a fixed seed, so slow drift (thermal throttling, a
 *    busy background tab) is spread over all counts instead of landing on
 *    the ones that happen to run last.
 *  - Summary: the median wall time per worker count, speedup = median(T1) /
 *    median(Tn), efficiency = speedup / n, and Amdahl's serial fraction fitted
 *    by least squares to the median speedups.
 *  - Intervals: the median wall time gets the exact order-statistic interval
 *    (distribution-free; its true coverage is reported). Speedup, efficiency,
 *    Karp–Flatt and f get a percentile bootstrap that resamples whole rounds,
 *    so runs made under the same conditions stay paired. That bootstrap is
 *    nominally 95% but under-covers with few rounds (see lib/lab/coverage.ts
 *    and DR-004), so no interval is shown below MIN_INTERVAL_ROUNDS.
 */

export interface BenchmarkPlan {
  /** Worker counts to measure; must include 1 (the speedup baseline). */
  sizes: readonly number[];
  /** Timed rounds, R. */
  repeats: number;
  /** Discarded warm-up rounds, W. */
  warmupRounds: number;
  /** Seed for the run order within each round. */
  orderSeed: number;
}

export const BENCHMARK_DEFAULTS = { repeats: 10, warmupRounds: 1, orderSeed: 2023 } as const;

/** Timed-round counts offered in the lab. */
export const REPEAT_OPTIONS = [5, 7, 10, 15] as const;

/**
 * Fewest complete rounds before any interval is shown. Below this the panel
 * shows medians and the min–max range only.
 */
export const MIN_INTERVAL_ROUNDS = 5;

export interface PlannedRun {
  /** 0-based index in the whole plan. */
  index: number;
  /** Warm-up rounds are numbered -W..-1, timed rounds 0..R-1. */
  round: number;
  warmup: boolean;
  size: number;
}

function shuffled<T>(items: readonly T[], next: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Every run of the plan, in the order it will be executed. */
export function planBenchmark(plan: BenchmarkPlan): PlannedRun[] {
  const sizes = [...new Set(plan.sizes)].sort((a, b) => a - b);
  if (!sizes.includes(1)) throw new RangeError("a benchmark needs 1 worker as its baseline");
  const rng = createRng(plan.orderSeed);
  const runs: PlannedRun[] = [];
  const push = (round: number, warmup: boolean) => {
    for (const size of shuffled(sizes, rng.next)) {
      runs.push({ index: runs.length, round, warmup, size });
    }
  };
  for (let w = plan.warmupRounds; w >= 1; w--) push(-w, true);
  for (let r = 0; r < plan.repeats; r++) push(r, false);
  return runs;
}

export interface BenchmarkSample {
  round: number;
  size: number;
  /** Wall time of the run: first scan request to last reduction. */
  wallMs: number;
  /** Slowest rank's scan time. */
  scanMs: number;
  runId: number;
}

/** Timed rounds in which every worker count has a sample (only these are summarised). */
export function completeRounds(
  samples: readonly BenchmarkSample[],
  sizes: readonly number[],
): number[] {
  const byRound = new Map<number, Set<number>>();
  for (const s of samples) {
    if (s.round < 0) continue;
    const set = byRound.get(s.round) ?? new Set<number>();
    set.add(s.size);
    byRound.set(s.round, set);
  }
  return [...byRound.entries()]
    .filter(([, set]) => sizes.every((n) => set.has(n)))
    .map(([r]) => r)
    .sort((a, b) => a - b);
}

export interface ConfigSummary {
  n: number;
  /** Runs summarised (one per complete round). */
  runs: number;
  /** Median wall time with its exact order-statistic interval. */
  wallMs: MedianInterval;
  speedup: Interval;
  efficiency: Interval;
  /** Karp–Flatt serial fraction at this n (n > 1 only). */
  karpFlatt: Interval | null;
  minMs: number;
  maxMs: number;
}

export interface BenchmarkSummary {
  configs: ConfigSummary[];
  /** Amdahl serial fraction, least squares over the median speedups (needs some n > 1). */
  serialFraction: Interval | null;
  /** 1 / f, the speedup no number of workers could beat. */
  ceiling: Interval | null;
  /** Complete timed rounds used. */
  rounds: number;
  resamples: number;
  seed: number;
  level: number;
}

interface Point {
  medians: Map<number, number>;
  speedup: Map<number, number>;
  f: number | null;
}

function pointEstimates(times: Map<number, number[]>, sizes: readonly number[]): Point {
  const medians = new Map<number, number>();
  for (const n of sizes) medians.set(n, median(times.get(n) ?? []));
  const t1 = medians.get(1)!;
  const speedup = new Map<number, number>();
  for (const n of sizes) speedup.set(n, t1 / medians.get(n)!);
  const fitPoints: ScalingPoint[] = sizes
    .filter((n) => n > 1)
    .map((n) => ({ n, s: speedup.get(n)! }));
  return { medians, speedup, f: fitPoints.length > 0 ? fitSerialFraction(fitPoints) : null };
}

/**
 * Summarise the complete rounds of a benchmark. Returns null until there are
 * MIN_INTERVAL_ROUNDS complete rounds (use roughSummary below that).
 */
export function summariseBenchmark(
  samples: readonly BenchmarkSample[],
  sizes: readonly number[],
  opts: BootstrapOptions & { minRounds?: number } = {},
): BenchmarkSummary | null {
  const { resamples, seed, level } = resolveBootstrap(opts);
  const ns = [...new Set(sizes)].sort((a, b) => a - b);
  if (!ns.includes(1)) return null;
  const rounds = completeRounds(samples, ns);
  // minRounds below the default is for the coverage simulation only.
  if (rounds.length < Math.max(2, opts.minRounds ?? MIN_INTERVAL_ROUNDS)) return null;

  // round → size → wall time
  const table = new Map<number, Map<number, BenchmarkSample>>();
  for (const s of samples) {
    if (!rounds.includes(s.round)) continue;
    const row = table.get(s.round) ?? new Map<number, BenchmarkSample>();
    row.set(s.size, s);
    table.set(s.round, row);
  }
  const collect = (picked: readonly number[]) => {
    const times = new Map<number, number[]>();
    for (const n of ns) times.set(n, []);
    for (const r of picked) for (const n of ns) times.get(n)!.push(table.get(r)!.get(n)!.wallMs);
    return times;
  };

  const observed = collect(rounds);
  const point = pointEstimates(observed, ns);

  // Block bootstrap over rounds.
  const rng = createRng(seed);
  const reps = {
    speedup: new Map(ns.map((n) => [n, [] as number[]])),
    kf: new Map(ns.map((n) => [n, [] as number[]])),
    f: [] as number[],
  };
  for (let b = 0; b < resamples; b++) {
    const picked = resampleIndices(rounds.length, rounds.length, rng).map((i) => rounds[i]);
    const p = pointEstimates(collect(picked), ns);
    for (const n of ns) {
      const s = p.speedup.get(n)!;
      reps.speedup.get(n)!.push(s);
      if (n > 1) reps.kf.get(n)!.push(karpFlatt(s, n));
    }
    if (p.f !== null) reps.f.push(p.f);
  }

  const interval = (estimate: number, values: readonly number[]): Interval => {
    const [lo, hi] = percentileInterval(values, level);
    return { estimate, lo, hi, level };
  };

  const configs: ConfigSummary[] = ns.map((n) => {
    const times = observed.get(n)!;
    const speedup = interval(point.speedup.get(n)!, reps.speedup.get(n)!);
    return {
      n,
      runs: times.length,
      wallMs: medianInterval(times, level),
      speedup,
      efficiency: { estimate: speedup.estimate / n, lo: speedup.lo / n, hi: speedup.hi / n, level },
      karpFlatt: n > 1 ? interval(karpFlatt(speedup.estimate, n), reps.kf.get(n)!) : null,
      minMs: Math.min(...times),
      maxMs: Math.max(...times),
    };
  });

  const serialFraction = point.f === null ? null : interval(point.f, reps.f);
  // 1/f is monotone decreasing, so the percentile interval maps across.
  const ceiling = serialFraction
    ? {
        estimate: amdahlLimit(serialFraction.estimate),
        lo: amdahlLimit(serialFraction.hi),
        hi: amdahlLimit(serialFraction.lo),
        level,
      }
    : null;

  return {
    configs,
    serialFraction,
    ceiling,
    rounds: rounds.length,
    resamples,
    seed,
    level,
  };
}

export interface RoughConfig {
  n: number;
  runs: number;
  medianMs: number;
  minMs: number;
  maxMs: number;
}

/**
 * Medians and ranges of the complete rounds so far, with no interval: what the
 * panel shows while there are fewer than MIN_INTERVAL_ROUNDS rounds.
 */
export function roughSummary(
  samples: readonly BenchmarkSample[],
  sizes: readonly number[],
): { rounds: number; configs: RoughConfig[] } | null {
  const ns = [...new Set(sizes)].sort((a, b) => a - b);
  const rounds = new Set(completeRounds(samples, ns));
  if (rounds.size === 0) return null;
  const configs = ns.map((n) => {
    const times = samples.filter((s) => s.size === n && rounds.has(s.round)).map((s) => s.wallMs);
    return {
      n,
      runs: times.length,
      medianMs: median(times),
      minMs: Math.min(...times),
      maxMs: Math.max(...times),
    };
  });
  return { rounds: rounds.size, configs };
}

/** Worker counts for a quicker benchmark: 1, 3, 4, then roughly doubling, plus the maximum. */
export function spacedSizes(max: number): number[] {
  const out = new Set<number>([1]);
  for (const n of [3, 4, 6, 8, 12, 16]) if (n <= max) out.add(n);
  if (max >= 3) out.add(max);
  return [...out].sort((a, b) => a - b);
}

/** Raw samples as CSV (one row per timed run). */
export function samplesCsv(samples: readonly BenchmarkSample[]): string {
  const rows = [
    "round,workers,wall_ms,scan_ms,run_id",
    ...samples
      .filter((s) => s.round >= 0)
      .map((s) => `${s.round},${s.size},${s.wallMs.toFixed(3)},${s.scanMs.toFixed(3)},${s.runId}`),
  ];
  return `${rows.join("\n")}\n`;
}
