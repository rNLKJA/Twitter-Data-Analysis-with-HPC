import type { Metadata } from "next";
import Link from "next/link";

import { AiLog } from "@/components/ai/ai-log";
import { PageHeader, Panel } from "@/components/common/page-header";

export const metadata: Metadata = {
  title: "AI audit log",
  description:
    "Every AI call made from this browser: time, feature, provider and model, prompts (never the API key), context hash, output, latency, tokens and the human decision. Exportable as JSON or CSV.",
};

export default function AiLogPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader eyebrow="Transparency · stored only in this browser" title="AI audit log">
        <p>
          Every call made by{" "}
          <Link href="/ask" className="link">
            Ask the results
          </Link>{" "}
          and its evaluation is recorded here, successful or not: when, which provider and model,
          the prompts sent (never your API key), the SHA-256 of the context, what came back,
          latency, token usage when the provider reports it, and your decision. The log lives in
          this browser&apos;s IndexedDB; nothing is sent to the site.
        </p>
      </PageHeader>
      <Panel as="div">
        <AiLog />
      </Panel>
    </div>
  );
}
