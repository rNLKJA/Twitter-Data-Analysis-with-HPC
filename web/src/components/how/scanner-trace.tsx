"use client";

import { useState } from "react";

import { Switch } from "@/components/how/switch";
import type { TraceLine } from "@/lib/cruncher/trace";
import { gccLabel } from "@/lib/gcc";
import { cn } from "@/lib/utils";

const HIT_STYLE = {
  id: "border-series-1 bg-series-1/10",
  author: "border-series-3 bg-series-3/10",
  location: "border-series-2 bg-series-2/10",
} as const;

const HIT_LABEL = { id: "_id", author: "author_id", location: "full_name" } as const;

export function ScannerTrace({
  lines,
  readCount,
  skipCount,
}: {
  lines: TraceLine[];
  readCount: number;
  skipCount: number;
}) {
  const [showSkipped, setShowSkipped] = useState(true);
  const visible = showSkipped ? lines : lines.filter((l) => l.mode === "read");

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <p className="text-sm">
          <span className="num font-mono text-primary">{readCount}</span> lines regex-tested,{" "}
          <span className="num font-mono text-muted-foreground">{skipCount}</span> skipped unread
        </p>
        <Switch checked={showSkipped} onCheckedChange={setShowSkipped} label="Show skipped lines" />
      </div>
      <ol
        className="relative max-h-[32rem] overflow-auto py-2 font-mono text-[0.72rem] leading-[1.55]"
        tabIndex={0}
        aria-label="Scanner trace"
      >
        {visible.map((l) => {
          const hit = l.hits[0];
          return (
            <li
              key={l.n}
              className={cn(
                "grid grid-cols-[2.75rem_1.25rem_1fr] items-start gap-x-2 border-l-2 border-transparent pr-3",
                hit && HIT_STYLE[hit.kind],
                l.mode === "skip" && "text-muted-foreground italic",
              )}
            >
              <span className="num pl-2 text-right text-muted-foreground select-none">{l.n}</span>
              <span className="text-center select-none">
                <span aria-hidden>
                  {l.mode === "read" ? <span className="text-primary">›</span> : "·"}
                </span>
                <span className="sr-only">{l.mode === "read" ? "read:" : "skipped:"}</span>
              </span>
              <span className="min-w-0">
                <span className="break-all whitespace-pre-wrap">{l.text || " "}</span>
                {l.hits.map((h) => (
                  <span
                    key={h.kind}
                    className="mt-0.5 mb-1 block font-sans text-[0.72rem] text-foreground"
                  >
                    <span className="rounded bg-foreground/8 px-1.5 py-0.5 font-mono text-[0.68rem]">
                      {HIT_LABEL[h.kind]}
                    </span>{" "}
                    {h.kind === "location" ? (
                      <>
                        → normalised <code className="font-mono">&ldquo;{h.normalised}&rdquo;</code>
                        , first sal_dict hit{" "}
                        <code className="font-mono">
                          {h.matchedBy ? `“${h.matchedBy}”` : "none"}
                        </code>{" "}
                        → <strong className="font-semibold">{h.gcc ?? "None"}</strong>
                        {h.gcc && (
                          <span className="text-muted-foreground"> ({gccLabel(h.gcc)})</span>
                        )}
                      </>
                    ) : (
                      <>
                        captured <code className="font-mono">{h.value}</code>
                      </>
                    )}
                    <span className="text-muted-foreground">; skip the next {h.skip} lines</span>
                  </span>
                ))}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
