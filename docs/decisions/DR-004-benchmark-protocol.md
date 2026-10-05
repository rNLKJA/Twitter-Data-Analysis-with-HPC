# DR-004: Measure browser scaling with repeated, shuffled rounds and intervals of checked coverage

- **Decision:** the MPI lab's benchmark runs every worker count R times (10 by default; 5, 7, 10 or 15 offered) after a discarded warm-up round, in a seeded random order within each round. It reports each median wall time with the exact order-statistic interval, and speedup, efficiency, the Karp–Flatt fraction and Amdahl's serial fraction with percentile bootstrap intervals that resample whole rounds, labelled "nominal 95%" because their real coverage was checked by simulation. With fewer than 5 complete rounds it shows medians and ranges only. Amdahl's f is fitted by least squares to the median speedups, and Gustafson's law is drawn for contrast.
- **Status:** accepted on 6 October 2026, and revised the same day, before merge, after a review found that the first version's bootstrap interval for a median covered the truth well under 95% of the time with the round counts it offered (see What happened). It replaces the lab's earlier "best run per worker count" display, which was never recorded as a decision.
- **Supersedes:** nothing.

## Context

The first version of the 2026 lab kept the fastest run for each worker count and fitted Amdahl's law to those. A minimum is biased low, it comes with no measure of spread, and a single sweep ran the worker counts in ascending order, so anything that drifted during the sweep (thermal throttling, a busy background tab) landed on the larger counts. The 2023 Spartan benchmark has the same gap in a stronger form: three configurations with one run each, and both multi-core layouts at n = 8, so its serial fraction of 3.18% is the Karp–Flatt value at a single n, a point estimate with no interval.

## Decision

- **Plan.** W warm-up rounds (default 1) are run and discarded: they start the workers, warm the JIT and touch the file. Then R timed rounds (default 10, at least 5). Each round runs every chosen worker count once, in an order shuffled with a fixed seed (2023). Worker counts are either "spaced" (1, 3, 4, 6, 8, 12, 16 up to the machine's maximum, plus the maximum) or every supported count. Two is never offered, because the original program cannot run on two ranks.
- **Summary.** Per worker count: the median wall time, speedup = median(T1) / median(Tn), efficiency = speedup / n, and the Karp–Flatt fraction. Amdahl's f is the least-squares fit to the median speedups; the ceiling is 1 / f.
- **Uncertainty for medians.** Each median wall time gets the distribution-free interval [x(k), x(R−k+1)] between order statistics, with the largest k whose coverage, 1 − 2·P(B ≤ k − 1) for B ~ Binomial(R, 1/2), is at least 95%. The coverage is exact for independent runs from any continuous distribution, and the site shows it: 93.8% at R = 5 (where even the full range cannot reach 95%), 98.4% at 7, 97.9% at 10 and 96.5% at 15.
- **Uncertainty for ratios and f.** A percentile bootstrap with 2,000 resamples (seed 90024) that resamples complete rounds, recomputing speedup, efficiency, Karp–Flatt, f and the ceiling from each resample, so their intervals are mutually consistent. These are labelled nominal 95%, and their simulated coverage is stated (What happened). Only rounds in which every worker count finished are used, and no interval is shown below 5 of them.
- **Display.** Error bars on every point, a shaded band for the Amdahl curve across f's interval, Gustafson's line with the same f, a table with the run count, the interval and the fastest and slowest run per n, and CSV and JSON exports with the protocol, seeds and environment.
- **Verification.** The statistics are unit-tested against values computed independently in numpy, scipy and statsmodels (`scripts/stats_reference.py`, which replays the seeded bootstrap draw for draw) and in base R (`scripts/stats_reference.R`). The coverage of every interval is checked by a seeded simulation (`web/src/lib/lab/coverage.ts`, run with `pnpm coverage-sim`).

## Options considered

1. **Keep best-of-N.** Common for micro-benchmarks as an estimate of the noise floor, but optimistic for speedup and silent about spread.
2. **Mean with a t-interval.** Timings are right-skewed (garbage collection, scheduler hiccups) and R is small, so the mean chases outliers and the normal approximation is weak.
3. **Median with a percentile bootstrap over rounds for everything** (the first version). Robust to the occasional slow run, one code path for every quantity, reproducible from the exported samples and seed. But "no distributional assumption" is not the same as "95% coverage": with a handful of runs, the bootstrap of a median can only land on a few order statistics, and it under-covered badly (What happened).
4. **Exact order-statistic intervals for medians, the round bootstrap for ratios and f, coverage checked by simulation, nothing shown below 5 rounds** (chosen). Keeps the strengths of option 3 where it holds up and replaces it where it does not.
5. **Nonlinear least squares on time, with model-based standard errors.** Uses the shape of T(n) directly, but the standard errors depend on a noise model I have no evidence for.

## Why

Resampling rounds rather than single runs keeps runs made under the same conditions together, which is what a ratio of times needs. Shuffling within rounds turns slow drift into noise spread over all worker counts instead of a bias against the last ones. And reporting an interval makes the contrast with Spartan's single-run fit explicit rather than implied.

## What happened

All benchmark numbers below come from one development machine (Apple M4: 10 cores, 4 performance and 6 efficiency) running headless Chrome driven by Playwright, on 6 October 2026. They describe that machine, not browsers in general. The first four bullets were measured with the first version of the protocol (7 rounds, a bootstrap interval for the medians too); their f and speedup intervals come from the same round bootstrap the revised protocol keeps.

- **100,000 tweets** (122 MB, seed 2023), worker counts 1, 3, 4, 6, 8 and 10, one warm-up round and 7 timed rounds: 48 runs in about 11 seconds. The 1-rank median was 460 ms (95% CI 459 to 461 ms). The best speedup was 2.86× at 6 workers (2.72× to 2.93×), and efficiency fell from 79% at 3 workers to 28% at 10. Amdahl's f came out at 22.8% (22.0% to 24.1%), a ceiling of 4.4×.
- **The same benchmark, run twice more that morning**, gave f = 20.9% (20.5% to 26.2%) and 25.1% (24.0% to 29.7%), with best speedups of 3.14× and 2.74× at 6 workers. Each interval overlaps another, but the first and third only just, and the point estimate ranged from 20.9% to 25.1% across the three sessions. The interval describes spread within one session; it does not cover the variation between sessions, which here was larger.
- **200,000 tweets** (244 MB) gave f = 21.7% (13.6% to 30.0%), a much wider interval because the 1-rank times varied more (median 1,084 ms, 932 to 1,289 ms). In that one session, doubling the file did not lower f, which suggests the flattening is not mainly a fixed start-up cost. It is one session, though, and the sessions on the smaller file varied more than any single interval, so this does not settle it. The likelier causes are the machine (speedup stops improving beyond about 6 workers on 4 performance cores) and work that grows with the file, such as the reductions, whose tables grow with the number of authors.
- **After the revision**, a fourth session on the same machine and file with the new defaults (10 timed rounds, worker counts 1, 3, 4, 6, 8 and 10; 66 runs in about 20 seconds) gave a 1-rank median of 571 ms (exact 97.9% interval 492 to 612 ms), a best speedup of 2.96× at 6 workers (nominal 95% CI 2.28× to 3.14×) and f = 22.8% (20.9% to 28.2%). The 1-rank median is about 110 ms slower than in the first session, another sign that sessions differ more than runs within a session; f landed inside the range of the earlier three.
- The browser's f is roughly seven times Spartan's 3.18%. That says a laptop browser is a poor place to scale this program; it says nothing about whether the 2023 program was good or bad on Spartan, where it ran with dedicated cores and a different balance of reading and computing.
- The output checks kept working under load: 8 of the 48 runs in the first 100,000-tweet benchmark double-counted one tweet, all of them at 6 workers, where one chunk boundary on that file falls inside an `_id` line's indentation (see [DR-001](DR-001-byte-range-chunking.md)). The other 40 matched the baseline exactly.
- With 7 rounds, several intervals ended exactly on an observed run time, as expected for a bootstrap of a median. A review then simulated the protocol and found the intervals short of their label. I repeated the check with a seeded simulation (`pnpm coverage-sim`): wall times drawn from Amdahl's law with f = 0.2 and lognormal noise (σ = 0.1 on the log scale), worker counts 1, 2, 4 and 8, 1,000 simulated benchmarks per row (so each figure carries a Monte Carlo margin of about ±1.4 points).

  | Rounds | Bootstrap of the median (first version) | Order-statistic median (exact claim) | Speedup at n = 8, bootstrap | f, bootstrap |
  | -----: | --------------------------------------: | -----------------------------------: | --------------------------: | -----------: |
  |      3 |                                   77.1% |                        76.2% (75.0%) |                       77.0% |        76.3% |
  |      5 |                                   92.8% |                        94.2% (93.8%) |                       94.4% |        94.8% |
  |      7 |                                   87.9% |                        98.5% (98.4%) |                       93.9% |        94.8% |
  |     10 |                                   94.8% |                        98.3% (97.9%) |                       95.9% |        96.5% |
  |     15 |                                       – |                        97.4% (96.5%) |                       96.6% |        97.6% |

  The first version's median interval covered the truth 88% of the time at its default of 7 rounds and 77% at 3, the smallest it offered. The order-statistic interval matches its exact claim at every R. The round bootstrap for speedup and f came in at 94% to 95% at 5 and 7 rounds, slightly under its label, and at 96% to 98% at 10 and 15, which is why 10 is now the default, 3 is no longer offered, and these intervals are labelled nominal. The simulation assumes independent runs; real runs share a machine whose state drifts, so real coverage can be lower, which the session-to-session spread above already shows.

## What I'd change

- Test the model, not just fit it: compare Amdahl's law with a model that adds a cost growing with n (T(n) = a + b / n + c n), and show the residuals per n.
- Detect performance and efficiency cores where the browser allows it, and report efficiency against performance cores separately.
- Time the phases (scan, relay, reduce) for every run, so the serial share can be measured directly rather than inferred.
- Offer more rounds automatically until the interval for f is narrower than a target width, with the stopping rule stated in advance.
- Replace the percentile bootstrap for f with a BCa or studentised bootstrap, and check its coverage with the same simulation, including noise that is correlated within a round.
