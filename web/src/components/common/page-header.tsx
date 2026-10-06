import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  children,
  aside,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-6 pt-12 pb-8 sm:pt-16 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div className="max-w-3xl space-y-3">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {title}
        </h1>
        {children && (
          <div className="text-base text-pretty text-muted-foreground sm:text-lg">{children}</div>
        )}
      </div>
      {aside}
    </div>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  children,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("max-w-3xl space-y-2", className)}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 id={id} className="font-heading text-2xl font-semibold tracking-tight text-balance">
        {title}
      </h2>
      {children && <div className="text-pretty text-muted-foreground">{children}</div>}
    </div>
  );
}

export function Panel({
  title,
  description,
  children,
  className,
  actions,
  as: Tag = "section",
  labelledBy,
}: {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
  as?: "section" | "div" | "figure";
  labelledBy?: string;
}) {
  return (
    <Tag className={cn("panel p-4 sm:p-5", className)} aria-labelledby={labelledBy}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            {title && (
              <h3 id={labelledBy} className="font-heading text-base font-semibold tracking-tight">
                {title}
              </h3>
            )}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </Tag>
  );
}

/** Small mono key/value used for job IDs, byte offsets and timings. */
export function Metric({
  label,
  value,
  hint,
  className,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
  tone?: "default" | "primary" | "signal";
}) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <dt className="font-mono text-[0.68rem] tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "num font-heading text-2xl font-semibold tracking-tight",
          tone === "primary" && "text-primary",
          tone === "signal" && "text-signal",
        )}
      >
        {value}
      </dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}
