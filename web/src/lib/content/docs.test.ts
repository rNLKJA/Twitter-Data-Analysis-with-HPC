import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DOCS_DIR, listDecisions, parseSummary, parseTitle, withoutTitle } from "./docs";

const ROOT_DOCS = path.resolve(process.cwd(), "..", "docs");

describe("rendered docs", () => {
  it("are byte-identical to the repository's docs/ (run pnpm sync-docs)", () => {
    const decisions = readdirSync(path.join(ROOT_DOCS, "decisions")).filter((f) =>
      f.endsWith(".md"),
    );
    const files = [
      "model-card.md",
      "ai-use-statement.md",
      ...decisions.map((f) => path.join("decisions", f)),
    ];
    for (const f of files) {
      expect(readFileSync(path.join(DOCS_DIR, f), "utf8"), f).toBe(
        readFileSync(path.join(ROOT_DOCS, f), "utf8"),
      );
    }
    expect(readdirSync(path.join(DOCS_DIR, "decisions")).sort()).toEqual(decisions.sort());
  });

  it("lists decision records in order with ids, titles and summaries", () => {
    const list = listDecisions();
    expect(list.map((d) => d.id)).toEqual(["DR-001", "DR-002", "DR-003", "DR-004", "DR-005"]);
    for (const d of list) {
      expect(d.title.length).toBeGreaterThan(10);
      expect(d.summary.length).toBeGreaterThan(40);
      expect(d.slug.startsWith(d.id)).toBe(true);
    }
  });

  it("follow the decision-record format, decision first", () => {
    for (const d of listDecisions()) {
      const md = readFileSync(path.join(DOCS_DIR, "decisions", `${d.slug}.md`), "utf8");
      const headings = [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
      expect(headings, d.id).toEqual([
        "Context",
        "Decision",
        "Options considered",
        "Why",
        "What happened",
        "What I'd change",
      ]);
      expect(md.indexOf("**Decision:**")).toBeLessThan(md.indexOf("## Context"));
      // House style: no em dashes, and no claims of formal compliance.
      expect(md, d.id).not.toContain("—");
      expect(md.toLowerCase(), d.id).not.toMatch(/\bcompliant\b/);
    }
  });

  it("keep the AI use statement to 'informed by', never 'compliant'", () => {
    const md = readFileSync(path.join(DOCS_DIR, "ai-use-statement.md"), "utf8");
    expect(md).toContain("informed by");
    expect(md.toLowerCase()).not.toMatch(/\bcompliant\b|\bcertified\b/);
  });

  it("parses titles and summaries", () => {
    expect(parseTitle("# DR-007: Something\n\ntext")).toEqual({ id: "DR-007", title: "Something" });
    expect(parseTitle("# Model card\n")).toEqual({ id: null, title: "Model card" });
    expect(parseSummary("- **Decision:** use [x](y.md) and `z`.\n")).toBe("Use x and z.");
    expect(withoutTitle("# T\n\nBody")).toBe("Body");
  });
});
