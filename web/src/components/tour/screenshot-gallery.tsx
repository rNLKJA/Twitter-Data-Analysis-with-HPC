"use client";

import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SCREENSHOT_SIZE, type Screenshot, screenshotSrc } from "@/lib/showcase";
import { cn } from "@/lib/utils";

/**
 * Screenshot grid with a lightbox: each thumbnail is a button that opens the
 * full image in a dialog (focus trapped, Escape closes, arrow keys or the
 * buttons step through the set).
 */
const GROUPS = [
  { viewport: "desktop", label: "Desktop · 1440 × 900" },
  { viewport: "mobile", label: "Mobile · 390 × 844" },
] as const;

function Thumbnail({ shot, onOpen }: { shot: Screenshot; onOpen: () => void }) {
  const size = SCREENSHOT_SIZE[shot.viewport];
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Enlarge screenshot: ${shot.title}`}
      className="panel group flex h-full w-full flex-col overflow-hidden text-left transition-colors outline-none hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span
        className={cn(
          "relative block w-full overflow-hidden border-b bg-muted/40",
          shot.viewport === "mobile" ? "aspect-[585/900]" : "aspect-[1440/900]",
        )}
      >
        <Image
          src={screenshotSrc(shot.id)}
          alt=""
          width={size.width}
          height={size.height}
          sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
          className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <span className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-lg bg-background/85 text-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Expand className="size-3.5" aria-hidden />
        </span>
      </span>
      <span className="block p-3">
        <span className="block font-heading text-sm font-semibold">{shot.title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{shot.caption}</span>
      </span>
    </button>
  );
}

export function ScreenshotGallery({ items }: { items: readonly Screenshot[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const current = open === null ? null : items[open];
  const step = (delta: number) =>
    setOpen((i) => (i === null ? i : (i + delta + items.length) % items.length));

  return (
    <>
      <div className="space-y-8">
        {GROUPS.map((g) => (
          <div key={g.viewport}>
            <h3 className="mb-3 font-mono text-[0.68rem] tracking-[0.12em] text-muted-foreground uppercase">
              {g.label}
            </h3>
            <ul
              className={cn(
                "grid gap-4",
                g.viewport === "desktop"
                  ? "sm:grid-cols-2 lg:grid-cols-3"
                  : "grid-cols-2 sm:grid-cols-3 lg:max-w-4xl",
              )}
            >
              {items.map((s, i) =>
                s.viewport !== g.viewport ? null : (
                  <li key={s.id}>
                    <Thumbnail shot={s} onOpen={() => setOpen(i)} />
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}
      </div>

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent
          className={cn(
            "gap-3 p-3 sm:max-w-[min(92vw,1180px)] sm:p-4",
            current?.viewport === "mobile" && "sm:max-w-[min(92vw,460px)]",
          )}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") step(1);
            if (e.key === "ArrowLeft") step(-1);
          }}
        >
          {current && (
            <>
              <DialogHeader>
                <DialogTitle>{current.title}</DialogTitle>
                <DialogDescription>{current.caption}</DialogDescription>
              </DialogHeader>
              <Image
                key={current.id}
                src={screenshotSrc(current.id)}
                alt={`${current.title}: ${current.caption}`}
                width={SCREENSHOT_SIZE[current.viewport].width}
                height={SCREENSHOT_SIZE[current.viewport].height}
                sizes="(min-width: 1280px) 1180px, 92vw"
                className="max-h-[calc(100svh-12rem)] w-full rounded-lg border object-contain"
              />
              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" size="sm" onClick={() => step(-1)}>
                  <ChevronLeft aria-hidden /> Previous
                </Button>
                <span className="font-mono text-xs text-muted-foreground" aria-live="polite">
                  {(open ?? 0) + 1} / {items.length}
                </span>
                <Button variant="outline" size="sm" onClick={() => step(1)}>
                  Next <ChevronRight aria-hidden />
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
