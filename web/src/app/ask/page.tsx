import { createHash } from "node:crypto";

import { FileLock2, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AskEval } from "@/components/ai/ask-eval";
import { AskPanel } from "@/components/ai/ask-panel";
import { PageHeader, Panel, SectionHeading } from "@/components/common/page-header";
import { ASK_SYSTEM_PROMPT } from "@/lib/ai/ask/answer";
import { ASK_CONTEXT, CONTEXT_TABLES } from "@/lib/ai/ask/context";
import { EVAL_ITEMS, EVAL_SET_VERSION } from "@/lib/ai/ask/eval";

export const metadata: Metadata = {
  title: "Ask the results",
  description:
    "Optional, bring-your-own-key question answering grounded in the original COMP90024 result tables and Spartan benchmarks, with row citations, an audit log and a grounding evaluation.",
};

export default function AskPage() {
  const contextHash = createHash("sha256").update(ASK_CONTEXT, "utf8").digest("hex");
  const rows = CONTEXT_TABLES.reduce((s, t) => s + t.rows.length, 0);
  const answerable = EVAL_ITEMS.filter((i) => i.answerable).length;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader
        eyebrow="Optional · bring your own key · answers are AI-generated"
        title="Ask the results"
      >
        <p>
          Ask a question about the 2023 results or the Spartan benchmark jobs. A language model
          answers from those tables only, cites the rows it used, shows its arithmetic, and says so
          when the tables cannot answer. You review every answer. It uses your own Anthropic or
          OpenAI key, called straight from your browser; the rest of the site works the same without
          one.{" "}
          <Link href="/methods#ai-use" className="link">
            AI use statement
          </Link>
          .
        </p>
      </PageHeader>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <section className="panel p-4 sm:p-5" aria-labelledby="ask-title">
          <h2 id="ask-title" className="mb-4 font-heading text-base font-semibold tracking-tight">
            Question and answers
          </h2>
          <AskPanel contextHash={contextHash} />
        </section>

        <aside className="space-y-4 lg:sticky lg:top-20" aria-label="What the model sees">
          <Panel as="div" className="space-y-3">
            <h2 className="flex items-center gap-2 font-heading text-base font-semibold tracking-tight">
              <FileLock2 className="size-4 text-primary" aria-hidden /> What the model sees
            </h2>
            <p className="text-sm text-muted-foreground">
              {CONTEXT_TABLES.length} tables, {rows} rows, transcribed from the submission, with no
              derived values. Nothing else: no tweets, no web access.
            </p>
            <ul className="space-y-1 text-xs">
              {CONTEXT_TABLES.map((t) => (
                <li key={t.id} className="flex gap-2">
                  <span className="w-6 shrink-0 font-mono text-primary">{t.id}</span>
                  <span className="text-muted-foreground">
                    {t.title} <span className="font-mono">({t.rows.length})</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs">
              <span className="text-muted-foreground">
                Context SHA-256 (recorded with every call):
              </span>
              <code className="mt-1 block font-mono text-[0.68rem] break-all">{contextHash}</code>
            </p>
            <details className="text-xs">
              <summary className="cursor-pointer font-medium">Show the full system prompt</summary>
              <pre className="mt-2 max-h-96 overflow-auto rounded-md border bg-muted/40 p-2.5 font-mono text-[0.66rem] whitespace-pre-wrap">
                {ASK_SYSTEM_PROMPT}
              </pre>
            </details>
          </Panel>
          <Panel as="div" className="space-y-2 text-xs text-muted-foreground">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldCheck className="size-4 text-success" aria-hidden /> Where your key goes
            </p>
            <p>
              Only to the provider you choose, from this browser. It is stored in session storage
              unless you ask to remember it, and it is never written to the{" "}
              <Link href="/ai-log" className="link">
                audit log
              </Link>
              .
            </p>
          </Panel>
        </aside>
      </div>

      <section className="mt-16 space-y-6" aria-labelledby="evaluate">
        <SectionHeading id="evaluate" eyebrow="Evaluation harness" title="Does it stay grounded?">
          <p>
            {EVAL_ITEMS.length} fixed questions (set {EVAL_SET_VERSION}): {answerable} that the
            tables can answer and {EVAL_ITEMS.length - answerable} that they cannot, including an
            identity question and an instruction to break the rules. The answer key is computed in
            code from the same tables. An answerable item passes only if the answer contains the
            expected values and cites the right rows; an unanswerable item passes only if the model
            declines. Rates come with Wilson 95% intervals, and two runs (say Haiku and Sonnet) can
            be compared item by item.
          </p>
        </SectionHeading>
        <Panel as="div">
          <AskEval contextHash={contextHash} />
        </Panel>
      </section>
    </div>
  );
}
