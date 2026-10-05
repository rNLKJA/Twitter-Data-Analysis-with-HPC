import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

/** The visible label on every piece of model output. */
export function AiBadge({ className, detail }: { className?: string; detail?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-signal/40 bg-signal/10 px-2 py-0.5 font-mono text-[0.65rem] font-medium tracking-wide text-signal uppercase",
        className,
      )}
    >
      <Sparkles className="size-3" aria-hidden /> AI-generated
      {detail ? <span className="normal-case text-muted-foreground">· {detail}</span> : null}
    </span>
  );
}
