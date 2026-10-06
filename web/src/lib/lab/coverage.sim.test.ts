/**
 * The full coverage simulation behind DR-004 (slow, so opt-in):
 *
 *     pnpm coverage-sim
 *
 * Prints, for each round count, how often each "95%" interval contained the
 * true value across 1,000 simulated benchmarks (Monte Carlo standard error
 * about 0.7 points near 95%). Three rounds is not offered in the lab; it is
 * included to show why.
 */
import { describe, expect, it } from "vitest";

import { REPEAT_OPTIONS } from "./benchmark";
import { simulateBootstrapMedianCoverage, simulateCoverage, type CoverageResult } from "./coverage";

const pct = (v: number | undefined) => (v === undefined ? "–" : `${(v * 100).toFixed(1)}%`);

function table(rows: CoverageResult[]): string {
  const big = Math.max(...rows[0].sizes);
  return [
    `worker counts ${rows[0].sizes.join(", ")}; f = 0.2, sigma = 0.1, ${rows[0].sims} benchmarks per row`,
    `rounds | median n=1 (exact claim) | median n=${big} | speedup n=4 | speedup n=${big} | f`,
    ...rows.map(
      (r) =>
        `${r.repeats} | ${pct(r.median[1])} (${pct(r.claimedMedianCoverage)}) | ${pct(r.median[big])} | ${pct(r.speedup[4])} | ${pct(r.speedup[big])} | ${pct(r.serialFraction)}`,
    ),
  ].join("\n");
}

describe.runIf(process.env.COVERAGE_SIM)("coverage simulation (full)", () => {
  it("reports coverage at every round count", { timeout: 900_000 }, () => {
    const out: string[] = [];
    for (const sizes of [
      [1, 4],
      [1, 2, 4, 8],
    ]) {
      const rows = [3, ...REPEAT_OPTIONS].map((repeats) =>
        simulateCoverage({
          repeats,
          sims: 1000,
          sizes,
          f: 0.2,
          sigma: 0.1,
          allowFewRounds: true,
        }),
      );
      out.push(table(rows));
      expect(rows).toHaveLength(REPEAT_OPTIONS.length + 1);
    }
    out.push(
      [
        "first version: percentile bootstrap of a median, 1,000 samples per row",
        ...[3, 5, 7, 10].map(
          (repeats) =>
            `${repeats} | ${pct(simulateBootstrapMedianCoverage({ repeats, sims: 1000, sigma: 0.1 }))}`,
        ),
      ].join("\n"),
    );
    console.log(out.join("\n\n"));
  });
});
