# Model card: scaling model and grounded question answering

This card covers the two models the site relies on: the **Amdahl scaling model** fitted to benchmark timings (a statistical model), and the **Ask the results** feature (a third-party language model used under fixed rules). The synthetic input data is described in [DR-003](decisions/DR-003-synthetic-data-design.md).

## 1. Amdahl scaling model

### Intended use

Summarise how the MPI tweet cruncher scales with the number of workers on a fixed input (strong scaling), and explain why eight cores gave about 6.5 times rather than 8 times. Teaching and explanation.

**Not for** predicting performance on other hardware, other programs or other inputs, for capacity planning, or as a hardware benchmark.

### Model

Amdahl's law, S(n) = 1 / (f + (1 − f) / n), with one parameter, the serial fraction f. It is fitted by least squares on the linearised form 1/S − 1/n = f (1 − 1/n), through the origin, and clamped to [0, 1]. Gustafson's law, S(n) = n − f (n − 1), is drawn with the same f for contrast; it describes weak scaling (the input grows with n) and is not fitted.

### Data

| Source                    | What                                       | Provenance                                                                                                           |
| ------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Spartan, final            | 3 jobs (1×1, 1×8, 2×4 cores), one run each | Slurm job ids 46094405 to 46094407, wall clock in whole seconds, transcribed from the submission                     |
| Spartan, earlier revision | 3 jobs, one run each, 2 April 2023         | Slurm logs on the repository's `Spartan-running-test` branch                                                         |
| Browser lab               | the visitor's own benchmark                | repeated runs on a seeded synthetic file in the visitor's browser ([DR-004](decisions/DR-004-benchmark-protocol.md)) |

### Evaluation

- **Spartan:** f = 3.18% for the final code and 1.70% for the earlier revision. Each comes from one run per layout, and both multi-core layouts used 8 cores, so the fit reduces to the Karp–Flatt value at n = 8 (averaged over the two 8-core layouts): a point estimate with no interval. Whole-second timing alone moves the final f between 3.08% and 3.28%; run-to-run variation, which one run per layout cannot show, is not included in that range.
- **Browser:** every benchmark of at least 5 rounds reports per-n medians with exact order-statistic intervals (coverage stated, for example 97.9% at the default 10 rounds), and speedups, efficiencies and f with percentile bootstrap intervals over rounds, labelled nominal 95% because a seeded simulation put their coverage at 94% to 95% with 5 or 7 rounds and 96% to 98% with 10 or 15. These describe one machine in one session. On one development laptop (Apple M4, 4 performance and 6 efficiency cores), three sessions on the same 100,000-tweet file gave f = 22.8%, 20.9% and 25.1%, each with an interval a few points wide, and the session-to-session spread was larger than any one interval; a fourth, under the revised protocol, gave 22.8% (20.9% to 28.2%) ([DR-004](decisions/DR-004-benchmark-protocol.md)).

### Known failure modes

- **One distinct n.** With measurements at a single worker count, any one-parameter curve fits exactly; the fit cannot test the model.
- **Extrapolation.** The fitted ceiling (1/f) assumes the serial part stays constant as n grows. Communication and reduction costs that grow with n would make real speedups fall below the curve.
- **Heterogeneous cores.** Browsers report logical cores. Hyper-threads and efficiency cores are slower than performance cores, so efficiency drops beyond the number of performance cores for reasons Amdahl's law does not model.
- **Superlinear effects.** Cache effects can produce speedups above n; f is then clamped at 0.
- **Drift.** Thermal throttling or background load during a benchmark. Randomised run order spreads it across worker counts but does not remove it.

### Ethical considerations

Low stakes. The main risk is over-reading: presenting a fitted ceiling or a laptop benchmark as a property of hardware or of HPC in general. The site states the sample sizes and limitations next to every fitted number.

## 2. Ask the results (language model)

### Intended use

Answer factual questions about the published 2023 results and benchmark jobs, with citations to table rows, for visitors exploring the project. **Not for** questions about the tweets themselves, the people behind the accounts, or anything beyond the tables; the model is instructed to decline those.

### Model and configuration

A third-party model chosen by the visitor and called with their own key: Anthropic Claude Haiku 4.5 (default) or Claude Sonnet 5.5 (effort `low`, server-side fallback on), or any OpenAI Chat Completions model with JSON-schema output. Structured output schema: status, answer, citations, calculation. The full system prompt, including the context, is shown on the Ask page and stored with every audit entry.

### Grounding data

The transcribed tables only (dataset summary, Tasks 1 to 3, two sets of benchmark jobs), 42 rows, with no derived values. Context hash: SHA-256 of the exact text sent, shown on the page and recorded per call.

### Evaluation

A fixed set of 24 questions (14 answerable, 10 not) with an answer key computed in code from the data. A pass on an answerable item needs the expected numbers or names in the answer (numbers the question already contains do not count) and the right rows cited; a pass on an unanswerable item needs the model to decline. Every item a run reached is scored, so a failed call counts as a fail rather than dropping out. Reported per run with Wilson 95% intervals, including the call-error rate; two runs can be compared item by item (paired bootstrap interval, exact McNemar test), with a warning when their request settings differ. No scores are published here: see [DR-005](decisions/DR-005-grounded-answers.md) for why.

### Known failure modes

- Arithmetic slips on derived answers (sums, ratios). The grounding check re-does arithmetic written in common notation and flags a statement that does not hold; arithmetic written in words is not checked, and the derived numbers then show as untraced.
- Citing a nearby row (for example the 1×8 job instead of the 2×4 job).
- Answering an unanswerable question by extrapolation (for example predicting a 64-core time) or by outside knowledge.
- Over-refusal of answerable questions phrased unusually.
- Literal number matching in the grader marks rounded but correct answers ("2.28 million") as failures.
- The grader can still pass a wrong answer that contains the right number in the wrong role (for example the right count attributed to the wrong city); the cited-row requirement catches some of these, not all.

### Ethical considerations

- The author ids in Tasks 1 and 3 belong to real accounts. The model is instructed never to speculate about who they are, and the evaluation includes an identity question that must be declined.
- Output is labelled AI-generated everywhere it appears, and a person reviews it before relying on it.
- Keys stay in the visitor's browser and costs fall on the visitor, who is told so before every evaluation run.
- See the [AI use statement](ai-use-statement.md) for what is sent where.
