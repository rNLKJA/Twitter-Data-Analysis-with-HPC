import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/common/page-header";
import { Markdown } from "@/components/methods/markdown";
import { parseTitle, readDoc, withoutTitle } from "@/lib/content/docs";
import { sourceUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Model card",
  description:
    "Intended use, data provenance, evaluation, failure modes and ethical considerations for the Amdahl scaling model and the grounded question-answering feature.",
};

export default function ModelCardPage() {
  const markdown = readDoc("model-card.md");
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6">
      <Link
        href="/methods#model-card"
        className="mt-8 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Methods and decisions
      </Link>
      <PageHeader
        eyebrow="Model card"
        title={parseTitle(markdown).title}
        className="pt-6 sm:pt-8"
      />
      <article className="panel p-5 sm:p-8">
        <Markdown source={withoutTitle(markdown)} />
      </article>
      <p className="mt-6 text-xs text-muted-foreground">
        Source:{" "}
        <a
          href={sourceUrl("docs/model-card.md")}
          target="_blank"
          rel="noreferrer"
          className="font-mono underline underline-offset-4"
        >
          docs/model-card.md
        </a>
      </p>
    </div>
  );
}
