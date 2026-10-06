"use client";

import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import { ScalingChart, ScalingLegend, type MeasuredPoint } from "@/components/charts/scaling-chart";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { amdahlLimit, amdahlSpeedup, amdahlTime, fitSerialFraction } from "@/lib/amdahl";
import { BENCHMARKS, DEV_BENCHMARKS, type BenchmarkRun } from "@/lib/data/original";
import { formatClock, formatPct } from "@/lib/format";

const DATASETS = {
  final: { label: "Final submission", runs: BENCHMARKS },
  earlier: { label: "Earlier revision", runs: DEV_BENCHMARKS },
} as const;
type DatasetKey = keyof typeof DATASETS;

const MAX_N = 32;

function pointsFor(runs: readonly BenchmarkRun[], kind: "speedup" | "time"): MeasuredPoint[] {
  const t1 = runs.find((r) => r.cores === 1)!.seconds;
  return runs.map((r) => ({
    n: r.cores,
    value: kind === "speedup" ? t1 / r.seconds : r.seconds,
    label: r.label,
    shape: r.cores === 1 ? "diamond" : r.nodes > 1 ? "ring-square" : "circle",
  }));
}

export function AmdahlExplorer() {
  const [dataset, setDataset] = useState<DatasetKey>("final");
  const runs = DATASETS[dataset].runs;
  const t1 = runs.find((r) => r.cores === 1)!.seconds;
  const fitted = useMemo(
    () =>
      fitSerialFraction(
        runs.filter((r) => r.cores > 1).map((r) => ({ n: r.cores, s: t1 / r.seconds })),
      ),
    [runs, t1],
  );
  const [override, setOverride] = useState<number | null>(null);
  const f = override ?? fitted;
  const [n, setN] = useState(16);
  const [hoverN, setHoverN] = useState<number | null>(null);
  const [gustafson, setGustafson] = useState(false);
  const focusN = hoverN ?? n;

  const speedupPts = pointsFor(runs, "speedup");
  const timePts = pointsFor(runs, "time");
  const limit = amdahlLimit(f);

  return (
    <div className="panel p-4 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h3 className="font-heading text-lg font-semibold tracking-tight">
            Amdahl&apos;s law explorer
          </h3>
          <p className="max-w-xl text-sm text-muted-foreground">
            The curve starts from the measured 1-core time and assumes a fraction <i>f</i> of the
            work can never be split. Its starting value is the least-squares fit to the 8-core runs.
            Drag the sliders to ask &ldquo;what if&rdquo;.
          </p>
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={dataset}
          onValueChange={(v) => {
            if (!v) return;
            setDataset(v as DatasetKey);
            setOverride(null);
          }}
          aria-label="Benchmark set"
        >
          {(Object.keys(DATASETS) as DatasetKey[]).map((k) => (
            <ToggleGroupItem
              key={k}
              value={k}
              className="px-3 text-xs data-[state=on]:border-primary/50 data-[state=on]:bg-primary/12 data-[state=on]:text-primary"
            >
              {DATASETS[k].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <label htmlFor="f-slider" className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">Serial fraction f</span>
            <span className="num font-mono text-primary">{formatPct(f, 2)}</span>
          </label>
          <Slider
            id="f-slider"
            min={0}
            max={0.2}
            step={0.0005}
            value={[f]}
            onValueChange={([v]) => setOverride(v)}
            aria-label="Serial fraction"
            aria-valuetext={formatPct(f, 2)}
          />
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Fitted: <span className="num font-mono text-foreground">{formatPct(fitted, 2)}</span>
            </span>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setOverride(null)}
              disabled={override === null}
            >
              <RotateCcw aria-hidden /> Reset to fit
            </Button>
          </div>
        </div>
        <div className="space-y-3">
          <label htmlFor="n-slider" className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">Workers n</span>
            <span className="num font-mono text-primary">{n}</span>
          </label>
          <Slider
            id="n-slider"
            min={1}
            max={MAX_N}
            step={1}
            value={[n]}
            onValueChange={([v]) => setN(v)}
            aria-label="Number of workers"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Moves the crosshair; hovering a chart does too.</span>
            <Button
              variant="outline"
              size="xs"
              onClick={() => setGustafson((g) => !g)}
              aria-pressed={gustafson}
              className={gustafson ? "border-primary/50 bg-primary/12 text-primary" : undefined}
            >
              {/* A toggle button keeps a fixed name; aria-pressed carries the state. */}
              Gustafson&apos;s law
            </Button>
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Amdahl&apos;s law with f = {formatPct(f, 2)} predicts:
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-4">
        {[
          { k: `Time at n = ${n}`, v: formatClock(amdahlTime(t1, f, n)) },
          { k: `Speedup at n = ${n}`, v: `${amdahlSpeedup(f, n).toFixed(2)}×` },
          { k: "Efficiency", v: formatPct(amdahlSpeedup(f, n) / n, 0) },
          { k: "Ceiling, n → ∞", v: Number.isFinite(limit) ? `${limit.toFixed(1)}×` : "none" },
        ].map((m) => (
          <div key={m.k}>
            <dt className="font-mono text-[0.65rem] tracking-[0.1em] text-muted-foreground uppercase">
              {m.k}
            </dt>
            <dd className="num mt-1 font-heading text-xl font-semibold">{m.v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium">Speedup vs 1 core</p>
          <ScalingChart
            kind="speedup"
            t1={t1}
            f={f}
            showGustafson={gustafson}
            maxN={MAX_N}
            measured={speedupPts}
            focusN={focusN}
            onHoverN={setHoverN}
            formatTime={formatClock}
            title="Speedup against number of workers: measured Spartan runs, Amdahl curve and ideal linear speedup"
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Wall-clock time (mm:ss)</p>
          <ScalingChart
            kind="time"
            t1={t1}
            f={f}
            maxN={MAX_N}
            measured={timePts}
            focusN={focusN}
            onHoverN={setHoverN}
            formatTime={formatClock}
            title="Wall-clock time against number of workers: measured Spartan runs, Amdahl curve and ideal"
          />
        </div>
      </div>
      <div className="mt-4">
        <ScalingLegend
          showGustafson={gustafson}
          measured={[
            { label: "1 node × 1 core", shape: "diamond" },
            { label: "1 node × 8 cores", shape: "circle" },
            { label: "2 nodes × 4 cores", shape: "ring-square" },
          ]}
        />
        {gustafson && (
          <p className="mt-3 max-w-3xl text-xs text-muted-foreground">
            Gustafson&apos;s law, n − f(n − 1), uses the same f but assumes the input grows with the
            number of workers, so the parallel part keeps them all busy (weak scaling). The
            assignment kept the file fixed (strong scaling), so Amdahl&apos;s law is the one the
            measurements test; Gustafson&apos;s line shows how much more work the same time would
            have covered if the file had grown with the cores.
          </p>
        )}
      </div>
    </div>
  );
}
