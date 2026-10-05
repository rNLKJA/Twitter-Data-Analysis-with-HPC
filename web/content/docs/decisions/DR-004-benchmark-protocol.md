# DR-004: Measure browser scaling with repeated, shuffled rounds and bootstrap intervals

- **Decision:** the MPI lab's benchmark runs every worker count R times (7 by default) after a discarded warm-up round, in a seeded random order within each round, and reports medians with 95% percentile bootstrap intervals that resample whole rounds; Amdahl's serial fraction is fitted by least squares to the median speedups and gets its interval from the same bootstrap, and Gustafson's law is drawn for contrast.
- **Status:** accepted on 6 October 2026. It replaces the lab's earlier "best run per worker count" display, which was never recorded as a decision.
- **Supersedes:** nothing.

## Context

The first version of the 2026 lab kept the fastest run for each worker count and fitted Amdahl's law to those. A minimum is biased low, it comes with no measure of spread, and a single sweep ran the worker counts in ascending order, so anything that drifted during the sweep (thermal throttling, a busy background tab) landed on the larger counts. The 2023 Spartan benchmark has the same gap in a stronger form: three configurations with one run each, and both multi-core layouts at n = 8, so its serial fraction of 3.18% is the Karp–Flatt value at a single n, a point estimate with no interval.

## Decision

- **Plan.** W warm-up rounds (default 1) are run and discarded: they start the workers, warm the JIT and touch the file. Then R timed rounds (default 7). Each round runs every chosen worker count once, in an order shuffled with a fixed seed (2023). Worker counts are either "spaced" (1, 3, 4, 6, 8, 12, 16 up to the machine's maximum, plus the maximum) or every supported count. Two is never offered, because the original program cannot run on two ranks.
- **Summary.** Per worker count: the median wall time, speedup = median(T1) / median(Tn), efficiency = speedup / n, and the Karp–Flatt fraction. Amdahl's f is the least-squares fit to the median speedups; the ceiling is 1 / f.
- **Uncertainty.** A percentile bootstrap with 2,000 resamples (seed 90024) that resamples complete rounds, recomputing every quantity above from each resample, so the intervals for speedup, efficiency, f and the ceiling are mutually consistent. Only rounds in which every worker count finished are used, and at least two are needed.
- **Display.** Error bars on every point, a shaded band for the Amdahl curve across f's interval, Gustafson's line with the same f, a table with the run count, the interval and the fastest and slowest run per n, and CSV and JSON exports with the protocol, seeds and environment.
- **Verification.** The statistics are unit-tested against values computed independently in numpy, scipy and R (`scripts/stats_reference.py`), including the seeded bootstrap, which the reference script replays draw for draw.

## Options considered

1. **Keep best-of-N.** Common for micro-benchmarks as an estimate of the noise floor, but optimistic for speedup and silent about spread.
2. **Mean with a t-interval.** Timings are right-skewed (garbage collection, scheduler hiccups) and R is small, so the mean chases outliers and the normal approximation is weak.
3. **Median with a percentile bootstrap over rounds** (chosen). No distributional assumption, robust to the occasional slow run, one code path for every derived quantity, and reproducible from the exported samples and seed.
4. **Nonlinear least squares on time, with model-based standard errors.** Uses the shape of T(n) directly, but the standard errors depend on a noise model I have no evidence for.

## Why

Resampling rounds rather than single runs keeps runs made under the same conditions together, which is what a ratio of times needs. Shuffling within rounds turns slow drift into noise spread over all worker counts instead of a bias against the last ones. And reporting an interval makes the contrast with Spartan's single-run fit explicit rather than implied.

## What happened

All numbers below come from one development machine (Apple M4: 10 cores, 4 performance and 6 efficiency) running headless Chrome driven by Playwright, on 6 October 2026. They describe that machine, not browsers in general.

- **100,000 tweets** (122 MB, seed 2023), worker counts 1, 3, 4, 6, 8 and 10, one warm-up round and 7 timed rounds: 48 runs in about 11 seconds. The 1-rank median was 460 ms (95% CI 459 to 461 ms). The best speedup was 2.86× at 6 workers (2.72× to 2.93×), and efficiency fell from 79% at 3 workers to 28% at 10. Amdahl's f came out at 22.8% (22.0% to 24.1%), a ceiling of 4.4×.
- **The same benchmark, run twice more that morning**, gave f = 20.9% (20.5% to 26.2%) and 25.1% (24.0% to 29.7%), with best speedups of 3.14× and 2.74× at 6 workers. Each interval overlaps another, but the first and third only just, and the point estimate ranged from 20.9% to 25.1% across the three sessions. The interval describes spread within one session; it does not cover the variation between sessions, which here was larger.
- **200,000 tweets** (244 MB) gave f = 21.7% (13.6% to 30.0%), a much wider interval because the 1-rank times varied more (median 1,084 ms, 932 to 1,289 ms). Doubling the file did not lower f, so the flattening is not mainly a fixed start-up cost. The likelier causes are the machine (speedup stops improving beyond about 6 workers on 4 performance cores) and work that grows with the file, such as the reductions, whose tables grow with the number of authors.
- The browser's f is roughly seven times Spartan's 3.18%. That says a laptop browser is a poor place to scale this program; it says nothing about whether the 2023 program was good or bad on Spartan, where it ran with dedicated cores and a different balance of reading and computing.
- The output checks kept working under load: 8 of the 48 runs in the first 100,000-tweet benchmark double-counted one tweet, all of them at 6 workers, where one chunk boundary on that file falls inside an `_id` line's indentation (see [DR-001](DR-001-byte-range-chunking.md)). The other 40 matched the baseline exactly.
- With 7 rounds, several intervals end exactly on an observed run time, as expected for a bootstrap of a median; the table shows the fastest and slowest run next to each interval so this is visible.

## What I'd change

- Test the model, not just fit it: compare Amdahl's law with a model that adds a cost growing with n (T(n) = a + b / n + c n), and show the residuals per n.
- Detect performance and efficiency cores where the browser allows it, and report efficiency against performance cores separately.
- Time the phases (scan, relay, reduce) for every run, so the serial share can be measured directly rather than inferred.
- Offer more rounds automatically until the interval for f is narrower than a target width, with the stopping rule stated in advance.
