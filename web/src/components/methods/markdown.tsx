/**
 * Renders the repository's markdown documents (decision records, model card,
 * AI use statement) in the site's typography. Server Component.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

type HastNode = { type?: string; tagName?: string; value?: string; children?: HastNode[] };

const textOf = (node: HastNode | undefined): string =>
  !node
    ? ""
    : node.type === "text"
      ? (node.value ?? "")
      : (node.children ?? []).map(textOf).join("");

function headerCells(table: HastNode | undefined): HastNode[] {
  const firstRow = (node: HastNode | undefined): HastNode | undefined => {
    if (!node) return undefined;
    if (node.tagName === "tr") return node;
    for (const child of node.children ?? []) {
      const row = firstRow(child);
      if (row) return row;
    }
    return undefined;
  };
  return (firstRow(table)?.children ?? []).filter((c) => c.tagName === "th" || c.tagName === "td");
}

/** A distinct accessible name for a scrollable table: its column headings. */
function tableLabel(table: HastNode | undefined): string {
  const heads = headerCells(table)
    .map((c) => textOf(c).trim())
    .filter(Boolean);
  return heads.length ? `Table: ${heads.join(", ")}` : "Table";
}

function Scroll({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("overflow-x-auto", className)}
      tabIndex={0}
      role="region"
      aria-label={`${label}, scrollable`}
    >
      {children}
    </div>
  );
}

/** Map links between docs to site routes; other repo-relative links go to GitHub. */
export function resolveDocHref(href: string): { href: string; external: boolean } {
  if (/^https?:\/\//.test(href) || href.startsWith("#") || href.startsWith("/")) {
    return { href, external: /^https?:\/\//.test(href) };
  }
  const dr = href.match(/(DR-\d{3}-[\w-]+)\.md$/);
  if (dr) return { href: `/methods/decisions/${dr[1]}`, external: false };
  if (href.endsWith("model-card.md")) return { href: "/methods/model-card", external: false };
  if (href.endsWith("ai-use-statement.md")) return { href: "/methods#ai-use", external: false };
  if (href === "decisions" || href === "decisions/")
    return { href: "/methods#decisions", external: false };
  return { href: `${SITE.repo}/blob/main/docs/${href}`, external: true };
}

const components: Components = {
  h1: ({ children }) => (
    <h2 className="mt-8 font-heading text-2xl font-semibold tracking-tight first:mt-0">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h2 className="mt-8 font-heading text-xl font-semibold tracking-tight first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-6 font-heading text-lg font-semibold tracking-tight">{children}</h3>
  ),
  p: ({ children }) => <p className="mt-3 leading-relaxed text-foreground/90">{children}</p>,
  ul: ({ children }) => <ul className="mt-3 list-disc space-y-1.5 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="mt-3 list-decimal space-y-1.5 pl-5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed text-foreground/90">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  a: ({ href = "", children }) => {
    const r = resolveDocHref(href);
    return r.external ? (
      <a href={r.href} target="_blank" rel="noreferrer" className="link">
        {children}
      </a>
    ) : (
      <Link href={r.href} className="link">
        {children}
      </Link>
    );
  },
  code: ({ className, children }) =>
    className ? (
      <code className={cn("font-mono text-xs", className)}>{children}</code>
    ) : (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] [overflow-wrap:anywhere]">
        {children}
      </code>
    ),
  pre: ({ children }) => (
    <Scroll label="Code" className="mt-3 rounded-lg border bg-muted/50">
      <pre className="p-3 text-xs">{children}</pre>
    </Scroll>
  ),
  table: ({ node, children }) => (
    <Scroll label={tableLabel(node as HastNode)} className="mt-4">
      <table
        className={cn(
          "w-full text-sm",
          headerCells(node as HastNode).length > 2 && "min-w-[32rem]",
        )}
      >
        {children}
      </table>
    </Scroll>
  ),
  thead: ({ children }) => (
    <thead className="text-left font-mono text-[0.68rem] tracking-[0.08em] text-muted-foreground uppercase">
      {children}
    </thead>
  ),
  tr: ({ children }) => <tr className="border-b border-border/60 last:border-0">{children}</tr>,
  th: ({ children }) => <th className="py-2 pr-3 font-medium">{children}</th>,
  td: ({ children }) => <td className="py-2 pr-3 align-top">{children}</td>,
  blockquote: ({ children }) => (
    <blockquote className="mt-3 border-l-2 border-primary/50 pl-4 text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-8" />,
};

/** Headings one level down, for documents rendered inside a page section. */
const nested: Components = {
  ...components,
  h1: ({ children }) => (
    <h3 className="mt-8 font-heading text-xl font-semibold tracking-tight first:mt-0">
      {children}
    </h3>
  ),
  h2: ({ children }) => (
    <h3 className="mt-7 font-heading text-lg font-semibold tracking-tight first:mt-0">
      {children}
    </h3>
  ),
  h3: ({ children }) => <h4 className="mt-5 font-heading font-semibold">{children}</h4>,
};

export function Markdown({
  source,
  className,
  nestedHeadings = false,
}: {
  source: string;
  className?: string;
  /** Render ## as h3 (and so on) when the document sits under a page h2. */
  nestedHeadings?: boolean;
}) {
  return (
    <div className={cn("max-w-3xl text-[0.95rem]", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={nestedHeadings ? nested : components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
