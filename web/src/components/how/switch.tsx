"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

/** Minimal accessible switch (button role="switch"). */
export function Switch({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
}) {
  const id = useId();
  return (
    <span className="inline-flex items-center gap-2">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors",
          checked ? "border-primary/60 bg-primary/30" : "border-input bg-muted",
        )}
      >
        <span
          className={cn(
            "inline-block size-3.5 rounded-full bg-foreground shadow transition-transform",
            checked ? "translate-x-[1.1rem]" : "translate-x-0.5",
          )}
        />
      </button>
      <label htmlFor={id} className="cursor-pointer text-xs text-muted-foreground select-none">
        {label}
      </label>
    </span>
  );
}
