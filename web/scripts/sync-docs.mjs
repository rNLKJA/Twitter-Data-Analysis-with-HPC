/**
 * Copy the rendered documentation from the repository's docs/ folder into
 * web/content/docs/, because the Vercel build only sees web/. The test
 * suite (src/lib/content/docs.test.ts) fails if the copies drift.
 *
 *   cd web && pnpm sync-docs
 */
import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

const web = path.resolve(import.meta.dirname, "..");
const src = path.resolve(web, "..", "docs");
const dest = path.join(web, "content", "docs");

const RENDERED = ["model-card.md", "ai-use-statement.md"];

rmSync(dest, { recursive: true, force: true });
mkdirSync(path.join(dest, "decisions"), { recursive: true });
for (const file of RENDERED) copyFileSync(path.join(src, file), path.join(dest, file));
for (const file of readdirSync(path.join(src, "decisions")).filter((f) => f.endsWith(".md"))) {
  copyFileSync(path.join(src, "decisions", file), path.join(dest, "decisions", file));
}
console.log(`synced docs into ${path.relative(process.cwd(), dest) || dest}`);
