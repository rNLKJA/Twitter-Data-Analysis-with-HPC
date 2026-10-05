# Documentation

| Document                                   | What it covers                                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| [model-card.md](model-card.md)             | The Amdahl scaling model and the grounded question-answering feature: intended use, data, evaluation, failure modes |
| [ai-use-statement.md](ai-use-statement.md) | What the optional AI feature does and never does, what is sent where, human review and the audit trail              |
| [decisions/](decisions)                    | Decision records, one per decision, never edited after the fact (a later record supersedes an earlier one)          |

All of these are rendered on the site under `/methods`. The site reads a copy in `web/content/docs/` because the Vercel build only sees `web/`; run `pnpm sync-docs` in `web/` after editing, and the test suite fails if the copies drift.

Decision record format: Context; Decision (also stated first, in one line); Options considered; Why; What happened (including weak numbers); What I'd change.
