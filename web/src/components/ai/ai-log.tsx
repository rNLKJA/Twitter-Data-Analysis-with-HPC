"use client";

import { ChevronRight, Download, ScrollText, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  auditToCsv,
  auditToJson,
  DECISION_LABEL,
  onAuditChange,
  type AuditEntry,
} from "@/lib/ai/audit-log";
import { FEATURE_LABEL, PROVIDER_LABEL } from "@/lib/ai/types";
import { downloadText } from "@/lib/download";
import { formatMs } from "@/lib/format";
import { cn } from "@/lib/utils";

import { AiBadge } from "./ai-badge";
import { useAi } from "./ai-provider";

function Entry({ e }: { e: AuditEntry }) {
  const when = new Date(e.timestamp);
  return (
    <details className="group rounded-lg border bg-card">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-xs [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
          aria-hidden
        />
        <time dateTime={e.timestamp} className="font-mono text-muted-foreground">
          {when.toLocaleString("en-AU", { dateStyle: "short", timeStyle: "medium" })}
        </time>
        <span className="font-medium">{FEATURE_LABEL[e.feature] ?? e.feature}</span>
        <span className="font-mono text-muted-foreground">
          {PROVIDER_LABEL[e.provider]} · {e.model}
        </span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">“{e.input.user}”</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[0.65rem]",
            e.error
              ? "bg-destructive/10 text-destructive"
              : e.humanDecision === "accepted"
                ? "bg-success/10 text-success"
                : e.humanDecision === "rejected"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-muted-foreground",
          )}
        >
          {e.error ? `error: ${e.error.kind}` : DECISION_LABEL[e.humanDecision]}
        </span>
      </summary>
      <div className="space-y-3 border-t px-3 py-3 text-xs">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Latency</dt>
            <dd className="num font-mono">{formatMs(e.latencyMs)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Tokens in / out</dt>
            <dd className="num font-mono">
              {e.usage ? `${e.usage.inputTokens} / ${e.usage.outputTokens}` : "not reported"}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground">Context sha256</dt>
            <dd className="font-mono break-all">{e.contextHash ?? "none"}</dd>
          </div>
          <div className="col-span-2 sm:col-span-4">
            <dt className="text-muted-foreground">Entry id</dt>
            <dd className="font-mono break-all">{e.id}</dd>
          </div>
        </dl>
        <div>
          <p className="mb-1 font-medium">Question sent</p>
          <p className="rounded-md bg-muted/40 px-2.5 py-1.5">{e.input.user}</p>
        </div>
        {e.output !== null && e.output !== undefined && (
          <div>
            <p className="mb-1 flex items-center gap-2 font-medium">
              Output <AiBadge />
            </p>
            <pre className="overflow-x-auto rounded-md bg-muted/40 px-2.5 py-1.5 font-mono text-[0.7rem] whitespace-pre-wrap">
              {JSON.stringify(e.output, null, 2)}
            </pre>
          </div>
        )}
        {e.error && (
          <p className="rounded-md bg-destructive/5 px-2.5 py-1.5 text-destructive">
            {e.error.message}
            {e.outputText ? ` Raw reply: ${e.outputText}` : ""}
          </p>
        )}
        {e.editedOutput && (
          <div>
            <p className="mb-1 font-medium">Human-edited answer</p>
            <p className="rounded-md bg-muted/40 px-2.5 py-1.5">{e.editedOutput}</p>
          </div>
        )}
        {e.context && (
          <p className="font-mono text-[0.68rem] text-muted-foreground">
            {Object.entries(e.context)
              .map(([k, v]) => `${k}=${v}`)
              .join(" · ")}
          </p>
        )}
        <details>
          <summary className="cursor-pointer text-muted-foreground">
            System prompt ({e.input.system.length.toLocaleString("en-AU")} characters, includes the
            context)
          </summary>
          <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-muted/40 px-2.5 py-1.5 font-mono text-[0.68rem] whitespace-pre-wrap">
            {e.input.system}
          </pre>
        </details>
      </div>
    </details>
  );
}

export function AiLog() {
  const { audit } = useAi();
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [confirming, setConfirming] = useState(false);

  const refresh = useCallback(() => {
    audit
      .list()
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [audit]);

  useEffect(() => {
    refresh();
    return onAuditChange(refresh);
  }, [refresh]);

  if (entries === null) {
    return <p className="text-sm text-muted-foreground">Reading this browser&apos;s log…</p>;
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const counts = {
    total: entries.length,
    errors: entries.filter((e) => e.error).length,
    reviewed: entries.filter((e) => ["accepted", "edited", "rejected"].includes(e.humanDecision))
      .length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {counts.total} call{counts.total === 1 ? "" : "s"} logged in this browser
          {counts.total ? `: ${counts.errors} failed, ${counts.reviewed} reviewed by you` : ""}.
        </p>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Button
            variant="outline"
            size="sm"
            disabled={!entries.length}
            onClick={() =>
              downloadText(`ai-audit-log-${stamp}.json`, auditToJson(entries), "application/json")
            }
          >
            <Download aria-hidden /> JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!entries.length}
            onClick={() =>
              downloadText(`ai-audit-log-${stamp}.csv`, auditToCsv(entries), "text/csv")
            }
          >
            <Download aria-hidden /> CSV
          </Button>
          {confirming ? (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  void audit.clear();
                  setConfirming(false);
                }}
              >
                Yes, clear the log
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                Keep it
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={!entries.length}
              onClick={() => setConfirming(true)}
            >
              <Trash2 aria-hidden /> Clear
            </Button>
          )}
        </div>
      </div>
      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <ScrollText className="mx-auto size-7 text-muted-foreground/60" aria-hidden />
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            No AI calls yet. When you use Ask the results or run the grounding evaluation with your
            own key, every call appears here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <Entry key={e.id} e={e} />
          ))}
        </div>
      )}
    </div>
  );
}
