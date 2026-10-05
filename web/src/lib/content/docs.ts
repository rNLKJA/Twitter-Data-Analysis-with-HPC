/**
 * Build-time access to the documentation rendered under /methods (a synced
 * copy of the repository's docs/ folder; see scripts/sync-docs.mjs).
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const DOCS_DIR = path.join(process.cwd(), "content", "docs");

export interface DecisionRecord {
  /** File name without .md, used as the URL slug. */
  slug: string;
  /** "DR-001" */
  id: string;
  title: string;
  /** The one-line decision stated at the top of the record. */
  summary: string;
}

export function readDoc(relative: string): string {
  return readFileSync(path.join(DOCS_DIR, relative), "utf8");
}

/** "# DR-001: Split the file…" → { id: "DR-001", title: "Split the file…" } */
export function parseTitle(markdown: string): { id: string | null; title: string } {
  const first = markdown.split("\n").find((l) => l.startsWith("# ")) ?? "";
  const text = first.replace(/^#\s+/, "").trim();
  const m = text.match(/^(DR-\d{3}):\s*(.*)$/);
  return m ? { id: m[1], title: m[2] } : { id: null, title: text };
}

/** The text after "**Decision:**" on the record's first bullet, without markdown links. */
export function parseSummary(markdown: string): string {
  const line = markdown.split("\n").find((l) => l.includes("**Decision:**")) ?? "";
  const text = line
    .replace(/^.*\*\*Decision:\*\*\s*/, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function listDecisions(): DecisionRecord[] {
  return readdirSync(path.join(DOCS_DIR, "decisions"))
    .filter((f) => /^DR-\d{3}-.+\.md$/.test(f))
    .sort()
    .map((file) => {
      const md = readDoc(path.join("decisions", file));
      const { id, title } = parseTitle(md);
      return {
        slug: file.replace(/\.md$/, ""),
        id: id ?? file.slice(0, 6),
        title,
        summary: parseSummary(md),
      };
    });
}

/** The markdown without its top-level heading (the page renders its own). */
export const withoutTitle = (markdown: string) => markdown.replace(/^#\s+.*\n+/, "");
