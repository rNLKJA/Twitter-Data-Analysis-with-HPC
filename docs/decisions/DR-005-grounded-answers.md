# DR-005: Answer questions from the published tables only, with citations and an audit trail

- **Decision:** "Ask the results" sends the visitor's question, with the transcribed result and benchmark tables as the only context, straight from their browser to the provider of their choice using their own key. The model must cite the row ids it used, write out any arithmetic, and say "not answerable" when the tables do not cover the question. Every answer is checked automatically, labelled as AI-generated, left for a person to accept, edit or reject, and logged in the browser with the SHA-256 of the context. A fixed 24-question evaluation with an answer key computed from the data measures how well a chosen model keeps to these rules.
- **Status:** accepted on 6 October 2026.
- **Supersedes:** nothing.

## Context

The revival has no budget for model calls and is a static site with no server. The results are small: about 45 rows across the dataset summary, the three task tables and two sets of benchmark jobs, roughly 2,500 tokens in all. Some rows hold the ids of real Twitter accounts. The point of the feature is to show grounded question answering that can be checked, not to add a chatbot.

## Decision

- **Bring your own key, browser to provider.** The key is kept in session storage by default (local storage only if the visitor ticks "remember on this device"), sent only to Anthropic or OpenAI, and never written to the audit log. Anthropic is the default provider, with Claude Haiku 4.5 as the default model and Claude Sonnet 5.5 as the stronger option; the OpenAI model id is free text.
- **Full-context grounding.** The context is the tables exactly as transcribed in `web/src/lib/data/original.ts`, one stable id per row (for example `T2.2` for Greater Melbourne), with no derived values. It is shown in full on `/ask`, with its hash.
- **Structured answers.** Status, answer, cited row ids and calculation, requested as JSON and validated with zod. Refusals, cut-off replies and malformed replies are reported as such, and the raw reply is kept as evidence.
- **Checks before review.** Each cited id must exist; an answer must cite at least one row; each number in the answer must appear in a cited row or in the shown calculation. The cited rows are displayed from the site's own data, never from the model's text.
- **Human in the loop.** Accept, edit (the edited text is stored next to the model's) or reject, recorded in the audit log.
- **Evaluation.** 14 answerable and 10 unanswerable questions. The key is computed in code from the same data, so it cannot drift from the tables. Results are reported with Wilson 95% intervals, and two runs can be compared item by item with a paired bootstrap interval and an exact McNemar test.

## Options considered

1. **No AI feature.** Simplest, but leaves the GenAI governance side of the portfolio unshown.
2. **A server-side proxy with my own key.** Costs money, needs rate limiting, and creates a place where keys and questions could be logged.
3. **Retrieval over the README and report text.** Adds a failure mode (missing the right passage) to a problem that fits in context, and the report is not public.
4. **Text-to-SQL over the tables.** Exact for arithmetic, but adds a query engine for 45 rows. Worth it for larger data.
5. **Full-context grounding with row citations** (chosen).

## Why

It is the smallest design in which every claim can be checked: everything the model saw is one hash, every number should trace to a row the page shows from its own data, and a refusal is an acceptable answer rather than a failure.

## What happened

- I have not published accuracy numbers for any model. Running the evaluation costs money on someone's key, and a score I ran and reported myself would be a vanity metric. The harness exports every run with its model, question-set version and context hash, so anyone with a key can produce and share their own.
- The adapters, the audit trail and the grader are covered by unit tests with the network mocked: request shape, the browser-access header, error mapping for bad keys, rate limits and network failures, refusals, truncation, and the absence of the key from every logged or exported entry.
- Writing the grader exposed its limits. Number matching is literal: a correct answer phrased as "about 2.28 million" fails the exact-count check (and is flagged by the grounding check), which is deliberate but strict. The questions and the key were written by the same person who wrote the prompt, so the set is likely easier than real questions. And 24 items give wide intervals: even 14 out of 14 has a Wilson lower bound of about 78%.
- Sonnet 5.5 requests opt in to Anthropic's server-side fallback, so a safety refusal can be answered by another Claude model in the same call. The audit log records the model that actually served the answer.

## What I'd change

- Have someone else write a second, held-out question set, so the evaluation is not graded against my own expectations.
- Add more prompt-injection and identity-probing questions, and questions whose answers need two tables at once.
- Use text-to-SQL, with the generated query shown and logged, if the data grows beyond what fits comfortably in context.
- Offer an optional second-model grader for answers that fail only the literal number match, logged as AI output in its own right and never replacing the exact checks.
