# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy==2.3.3", "scipy==1.16.2", "statsmodels==0.14.5"]
# ///
"""
Reference values for the web app's statistics helpers (web/src/lib/stats and
web/src/lib/lab/benchmark.ts), computed independently with numpy, scipy and
statsmodels. The Vitest suite (web/src/lib/stats/stats.test.ts and
web/src/lib/lab/benchmark.test.ts) pins these numbers.

The bootstrap checks re-implement the site's seeded generator (mulberry32,
the same stream as web/src/lib/synth/prng.ts) so that a seeded TypeScript
interval can be compared with a numpy computation draw for draw.

    uv run scripts/stats_reference.py
"""

from __future__ import annotations

import json

import numpy as np
from scipy import stats
from statsmodels.stats.proportion import proportion_confint

M32 = 0xFFFFFFFF


def mulberry32(seed: int):
    a = seed & M32

    def nxt() -> float:
        nonlocal a
        a = (a + 0x6D2B79F5) & M32
        t = a
        t = ((t ^ (t >> 15)) * (t | 1)) & M32
        t = t ^ ((t + (((t ^ (t >> 7)) * (t | 61)) & M32)) & M32)
        return ((t ^ (t >> 14)) & M32) / 4294967296

    return nxt


def percentile(reps, level=0.95):
    a = (1 - level) / 2
    lo, hi = np.quantile(np.asarray(reps, dtype=float), [a, 1 - a])
    return float(lo), float(hi)


def bootstrap_median(xs, resamples, seed, level=0.95):
    nxt = mulberry32(seed)
    n = len(xs)
    reps = []
    for _ in range(resamples):
        idx = [int(nxt() * n) for _ in range(n)]
        reps.append(float(np.median([xs[i] for i in idx])))
    return (float(np.median(xs)), *percentile(reps, level))


def median_order_interval(xs, level=0.95):
    """Distribution-free interval [x(k), x(n-k+1)] for the median, with the
    largest k whose exact coverage 1 - 2 P(B <= k-1), B ~ Bin(n, 1/2), is at
    least `level` (k = 1 if none is)."""
    xs = sorted(float(v) for v in xs)
    n = len(xs)
    cover = lambda k: 1 - 2 * float(stats.binom.cdf(k - 1, n, 0.5))
    k = 1
    while k + 1 <= (n + 1) // 2 and cover(k + 1) >= level:
        k += 1
    return float(np.median(xs)), xs[k - 1], xs[n - k], cover(k)


def fit_serial_fraction(points):
    sxy = sxx = 0.0
    for n, s in points:
        if n <= 1 or not s > 0:
            continue
        x = 1 - 1 / n
        y = 1 / s - 1 / n
        sxy += x * y
        sxx += x * x
    return 0.0 if sxx == 0 else min(1.0, max(0.0, sxy / sxx))


def karp_flatt(s, n):
    return (1 / s - 1 / n) / (1 - 1 / n)


def benchmark_summary(table, sizes, resamples, seed, level=0.95):
    """table: list of rounds, each a dict size -> wall time."""

    def estimates(rows):
        med = {n: float(np.median([r[n] for r in rows])) for n in sizes}
        sp = {n: med[1] / med[n] for n in sizes}
        f = fit_serial_fraction([(n, sp[n]) for n in sizes if n > 1])
        return med, sp, f

    med, sp, f = estimates(table)
    nxt = mulberry32(seed)
    reps_sp = {n: [] for n in sizes}
    reps_f = []
    k = len(table)
    for _ in range(resamples):
        idx = [int(nxt() * k) for _ in range(k)]
        m, s, ff = estimates([table[i] for i in idx])
        for n in sizes:
            reps_sp[n].append(s[n])
        reps_f.append(ff)
    return {
        "median": {n: median_order_interval([r[n] for r in table], level) for n in sizes},
        "speedup": {n: (sp[n], *percentile(reps_sp[n], level)) for n in sizes},
        "f": (f, *percentile(reps_f, level)),
        "karp_flatt": {n: karp_flatt(sp[n], n) for n in sizes if n > 1},
    }


def main() -> None:
    out: dict[str, object] = {}

    nxt = mulberry32(2023)
    out["mulberry32_seed2023_first5"] = [nxt() for _ in range(5)]

    x = [3.1, 0.4, 2.2, 9.7, 5.5, 1.0, 4.8]
    out["quantile_type7"] = {
        p: float(np.quantile(x, p)) for p in [0.025, 0.1, 0.5, 0.9, 0.975]
    }
    out["norm_ppf"] = {
        p: float(stats.norm.ppf(p)) for p in [0.001, 0.025, 0.9, 0.975, 0.995]
    }
    out["wilson"] = {
        f"{k}/{n}": [
            float(v) for v in proportion_confint(k, n, alpha=0.05, method="wilson")
        ]
        for k, n in [(0, 10), (14, 14), (7, 12), (1, 24), (20, 24)]
    }
    out["mcnemar_exact"] = {
        f"{b},{c}": float(stats.binomtest(min(b, c), b + c, 0.5).pvalue)
        for b, c in [(5, 1), (0, 6), (2, 9), (1, 106)]
    }

    out["bootstrap_median"] = bootstrap_median(x, resamples=2000, seed=90024)
    out["median_order_interval"] = {
        "x": median_order_interval(x),
        "coverage_by_n": {
            n: median_order_interval(list(range(n)))[3] for n in [5, 6, 7, 10, 15, 20]
        },
    }

    # A small benchmark: 5 rounds x {1, 3, 4, 8} workers, wall times in ms.
    sizes = [1, 3, 4, 8]
    table = [
        {1: 1000.0, 3: 380.0, 4: 300.0, 8: 190.0},
        {1: 1040.0, 3: 395.0, 4: 310.0, 8: 205.0},
        {1: 985.0, 3: 370.0, 4: 296.0, 8: 182.0},
        {1: 1120.0, 3: 410.0, 4: 330.0, 8: 220.0},
        {1: 1010.0, 3: 377.0, 4: 305.0, 8: 188.0},
    ]
    out["benchmark"] = benchmark_summary(table, sizes, resamples=2000, seed=90024)

    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
