import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/common/page-header";
import { Markdown } from "@/components/methods/markdown";
import { listDecisions, readDoc, withoutTitle } from "@/lib/content/docs";
import { sourceUrl } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return listDecisions().map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const d = listDecisions().find((x) => x.slug === slug);
  return d ? { title: `${d.id}: ${d.title}`, description: d.summary } : {};
}

export default async function DecisionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const all = listDecisions();
  const index = all.findIndex((x) => x.slug === slug);
  if (index < 0) notFound();
  const d = all[index];
  const markdown = readDoc(`decisions/${slug}.md`);
  const prev = all[index - 1];
  const next = all[index + 1];
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6">
      <Link
        href="/methods#decisions"
        className="mt-8 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Methods and decisions
      </Link>
      <PageHeader eyebrow={`Decision record · ${d.id}`} title={d.title} className="pt-6 sm:pt-8" />
      <article className="panel p-5 sm:p-8">
        <Markdown source={withoutTitle(markdown)} />
      </article>
      <nav
        aria-label="Other decision records"
        className="mt-6 flex flex-wrap justify-between gap-3 text-sm"
      >
        {prev ? (
          <Link href={`/methods/decisions/${prev.slug}`} className="link">
            ← {prev.id}: {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={`/methods/decisions/${next.slug}`} className="link text-right">
            {next.id}: {next.title} →
          </Link>
        )}
      </nav>
      <p className="mt-6 text-xs text-muted-foreground">
        Source:{" "}
        <a
          href={sourceUrl(`docs/decisions/${slug}.md`)}
          target="_blank"
          rel="noreferrer"
          className="font-mono underline underline-offset-4"
        >
          docs/decisions/{slug}.md
        </a>
      </p>
    </div>
  );
}
