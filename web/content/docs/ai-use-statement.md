# AI use statement

This site has one optional AI feature, **Ask the results**, and an evaluation harness for it. Everything else on the site, including the results, the scaling analysis, the MPI lab and its benchmark, works without AI and without an API key. The design is informed by the Australian Government's policy for the responsible use of AI in government, the transparency principles of the EU AI Act and the NIST AI Risk Management Framework. It is not a claim of compliance with any of them.

## What the AI does

- Answers questions about the published 2023 results and the Spartan benchmark jobs, using only those tables as context.
- Cites the table rows it used, writes out any arithmetic, and says when a question cannot be answered from the tables.
- In the evaluation harness, answers a fixed set of 24 questions so its answers can be graded against an answer key computed from the data.

## What it never does

- It does not produce or change any result shown elsewhere on the site. The original results are transcribed from the 2023 submission and the benchmark analysis is computed in code.
- It does not see the raw tweets. They are course data and are not on this site.
- It is not asked to identify, profile or speculate about the people behind the author ids in the results, and it is instructed to refuse.
- It does not act on its own: nothing it writes is saved anywhere except your browser's audit log, and only after you ask.

## What is sent, and to whom

- **To the provider you choose (Anthropic or OpenAI):** a fixed system prompt containing the result tables (shown in full on the Ask page, with their SHA-256 hash) and your question. Calls go directly from your browser to the provider and are billed to your own key under the provider's terms.
- **Your API key** is stored in your browser's session storage (or local storage if you tick "remember on this device") and sent only to the provider. This site is static: there is no server of ours that could receive the key, the question or the answer. The key is never written to the audit log or included in exports.
- **Nothing is sent to the site's author.**

## Human in the loop

Every answer is labelled **AI-generated**, shown with the rows it cites (taken from the site's own data, not from the model's text) and with the result of automatic grounding checks. You decide whether to accept it, edit it or reject it, and that decision is recorded. Evaluation answers are graded automatically against the answer key and are marked as such.

## Audit trail

Every call, successful or not, is appended to an audit log in your browser (IndexedDB): time, feature, provider, model requested and model that answered, the prompts sent (never the key), the context hash, the output or the error and any raw reply, latency, token usage when the provider reports it, and your decision. You can read, export (JSON or CSV) and clear it at `/ai-log`.

## Models

Anthropic is the default provider, with Claude Haiku 4.5 as the default model (lowest cost) and Claude Sonnet 5.5 as an option. Sonnet 5.5 requests opt in to Anthropic's server-side fallback, so if it declines on safety grounds another Claude model may answer; the audit log records which one did. With OpenAI you choose the model id.

## Limitations

Models can still misread a row, make arithmetic mistakes, or answer when they should decline; the checks catch some of this, not all of it. The evaluation set is small (24 questions) and was written by the site's author, so it is a check, not a benchmark. Results differ between models and between runs.

## How this site was built

The 2026 revival's code and documents were produced with the help of an AI coding assistant; the commits that it co-authored carry a `Co-Authored-By` trailer.
