import Link from "next/link";

import { GitHubMark, LogoMark } from "@/components/layout/brand";
import { SUBJECT } from "@/lib/data/original";
import { NAV, SITE } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t bg-card/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <LogoMark className="size-6" />
            <span className="font-heading font-semibold">{SITE.name}</span>
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            {SUBJECT.code} {SUBJECT.name}, {SUBJECT.university}, {SUBJECT.term}. Built by
            Sunchuangyu (Rin) Huang and Wei Zhao; revived as an interactive site in 2026.
          </p>
          <p className="max-w-sm text-xs text-muted-foreground">
            No course data is hosted here. Results are transcribed from the 2023 submission; demos
            run on a synthetic file generated in your browser.
          </p>
        </div>
        <nav aria-label="Footer" className="space-y-2 text-sm">
          <p className="eyebrow">Explore</p>
          <ul className="space-y-1.5">
            <li>
              <Link href="/" className="text-muted-foreground hover:text-foreground">
                Overview
              </Link>
            </li>
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="text-muted-foreground hover:text-foreground">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-2 text-sm">
          <p className="eyebrow">Source</p>
          <a
            href={SITE.repo}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <GitHubMark className="size-4" /> rNLKJA/Twitter-Data-Analysis-with-HPC
          </a>
          <p className="text-xs text-muted-foreground">
            The original submission is preserved unchanged in{" "}
            <code className="font-mono">coursework/</code>. MIT licence.
          </p>
        </div>
      </div>
    </footer>
  );
}
