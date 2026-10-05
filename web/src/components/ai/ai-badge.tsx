import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The visible label on every piece of model output. The pill never wraps;
 * the optional detail (usually the model) sits beside it and wraps on its own.
 */
export function AiBadge({ className, detail }: { className?: string; detail?: string }) {
  const pill = (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-signal/40 bg-signal/10 px-2 py-0.5 font-mono text-[0.65rem] font-medium tracking-wide whitespace-nowrap text-signal uppercase",
        !detail && className,
      )}
    >
      <Sparkles className="size-3" aria-hidden /> AI-generated
    </span>
  );
  if (!detail) return pill;
  return (
    <span
      className={cn("inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5", className)}
    >
      {pill}
      <span className="min-w-0 font-mono text-[0.65rem] break-all text-muted-foreground">
        {detail}
      </span>
    </span>
  );
}
