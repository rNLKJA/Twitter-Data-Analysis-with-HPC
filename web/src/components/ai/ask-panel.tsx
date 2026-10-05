"use client";

import {
  Check,
  CircleAlert,
  CircleCheck,
  KeyRound,
  LoaderCircle,
  Pencil,
  Send,
  Square,
  X,
} from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import type { HumanDecision } from "@/lib/ai/audit-log";
import {
  checkGrounding,
  MAX_QUESTION_CHARS,
  type AskAnswer,
  type GroundingCheck,
} from "@/lib/ai/ask/answer";
import { ROW_INDEX } from "@/lib/ai/ask/context";
import { askResults } from "@/lib/ai/ask/run";
import { AiError, PROVIDER_LABEL } from "@/lib/ai/types";
import { formatMs } from "@/lib/format";
import { cn } from "@/lib/utils";

import { AiBadge } from "./ai-badge";
import { useAi } from "./ai-provider";

interface Asked {
  id: string;
  question: string;
  model: string;
  provider: string;
  answer: AskAnswer;
  check: GroundingCheck;
  latencyMs: number;
  tokens: { input: number; output: number } | null;
  decision: HumanDecision;
  edited?: string;
}

const EXAMPLES = [
  "Which capital city had the most tweets, and by how much did it lead?",
  "How much faster was the final 1-core job than the earlier revision's?",
  "Did the 2 nodes × 4 cores job run faster than 1 node × 8 cores?",
  "Which hashtag was used most?",
];

function CitedRow({ id }: { id: string }) {
  const row = ROW_INDEX.get(id);
  if (!row) {
    return (
      <li className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1.5 text-xs">
        <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden />
        <span>
          <span className="font-mono font-medium">{id}</span>: not a row of the context (made up or
          mistyped)
        </span>
      </li>
    );
  }
  return (
    <li className="rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs">
      <span className="font-mono font-medium text-primary">{id}</span>{" "}
      <span className="text-muted-foreground">
        {row.columns.map((c, i) => (
          <span key={c} className="mr-2 inline-block">
            {c}=<span className="font-mono text-foreground">{String(row.cells[i])}</span>
          </span>
        ))}
      </span>
    </li>
  );
}

function AnswerCard({
  item,
  onDecide,
}: {
  item: Asked;
  onDecide: (decision: HumanDecision, edited?: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.edited ?? item.answer.answer);
  const editId = useId();
  const a = item.answer;
  const c = item.check;
  const issues = [
    ...c.invalidCitations.map((id) => `cites ${id}, which is not in the context`),
    ...(c.uncited ? ["gives an answer without citing any row"] : []),
    ...(c.untracedNumbers.length
      ? [`mentions ${c.untracedNumbers.join(", ")}, not found in the cited rows or the calculation`]
      : []),
  ];

  return (
    <article className="panel space-y-3 p-4" aria-label={`Answer to: ${item.question}`}>
      <div className="flex flex-wrap items-center gap-2">
        <AiBadge detail={item.model} />
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[0.7rem] font-medium",
            a.status === "answered"
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          {a.status === "answered" ? "Answered from the tables" : "Not answerable from the tables"}
        </span>
        <span className="ml-auto font-mono text-[0.68rem] text-muted-foreground">
          {formatMs(item.latencyMs)}
          {item.tokens
            ? ` · ${item.tokens.input.toLocaleString("en-AU")} in / ${item.tokens.output} out tokens`
            : ""}
        </span>
      </div>
      <p className="text-sm font-medium">Q: {item.question}</p>
      {item.decision === "edited" && item.edited ? (
        <div className="space-y-1">
          <p className="text-sm whitespace-pre-wrap">{item.edited}</p>
          <p className="text-xs text-muted-foreground">
            Edited by you. Model&apos;s original: <span className="italic">{a.answer}</span>
          </p>
        </div>
      ) : (
        <p
          className={cn(
            "text-sm whitespace-pre-wrap",
            item.decision === "rejected" && "line-through opacity-60",
          )}
        >
          {a.answer}
        </p>
      )}
      {a.calculation.trim() && (
        <p className="rounded-md bg-muted/40 px-2.5 py-1.5 font-mono text-xs">
          <span className="text-muted-foreground">calculation: </span>
          {a.calculation}
        </p>
      )}
      {a.citations.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Cited rows (shown from the site&apos;s own data, not the model&apos;s text)
          </p>
          <ul className="space-y-1">
            {[...new Set(a.citations)].map((id) => (
              <CitedRow key={id} id={id} />
            ))}
          </ul>
        </div>
      )}
      <div
        className={cn(
          "flex items-start gap-2 rounded-md px-2.5 py-1.5 text-xs",
          issues.length ? "bg-caution/10 text-foreground" : "bg-success/10 text-foreground",
        )}
      >
        {issues.length ? (
          <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-caution" aria-hidden />
        ) : (
          <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
        )}
        <span>
          {issues.length
            ? `Automatic check: the answer ${issues.join("; ")}. Check it against the tables before relying on it.`
            : a.status === "answered"
              ? "Automatic check: every cited row exists and every number in the answer appears in a cited row or the shown calculation. It does not prove the answer is right."
              : "Automatic check: the model declined and cited nothing."}
        </span>
      </div>

      {editing ? (
        <div className="space-y-2">
          <label htmlFor={editId} className="text-xs font-medium">
            Your corrected answer (saved to the audit log next to the model&apos;s)
          </label>
          <textarea
            id={editId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                onDecide("edited", draft.trim());
                setEditing(false);
              }}
              disabled={!draft.trim()}
            >
              Save edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <span className="text-xs text-muted-foreground">Your review:</span>
          <Button
            size="xs"
            variant={item.decision === "accepted" ? "default" : "outline"}
            onClick={() => onDecide("accepted")}
            aria-pressed={item.decision === "accepted"}
          >
            <Check aria-hidden /> Accept
          </Button>
          <Button
            size="xs"
            variant={item.decision === "edited" ? "default" : "outline"}
            onClick={() => setEditing(true)}
            aria-pressed={item.decision === "edited"}
          >
            <Pencil aria-hidden /> Edit
          </Button>
          <Button
            size="xs"
            variant={item.decision === "rejected" ? "destructive" : "outline"}
            onClick={() => onDecide("rejected")}
            aria-pressed={item.decision === "rejected"}
          >
            <X aria-hidden /> Reject
          </Button>
          <span className="ml-auto text-[0.68rem] text-muted-foreground">
            {item.decision === "pending" ? "not reviewed yet" : `recorded: ${item.decision}`}
          </span>
        </div>
      )}
    </article>
  );
}

export function AskPanel({ contextHash }: { contextHash: string }) {
  const { ready, credentials, audit, openSettings, prefs } = useAi();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AiError | null>(null);
  const [asked, setAsked] = useState<Asked[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const qId = useId();

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!credentials) {
      openSettings();
      return;
    }
    if (!question.trim() || busy) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    try {
      const res = await askResults(credentials, question, {
        audit,
        contextHash,
        signal: controller.signal,
      });
      setAsked((prev) => [
        {
          id: res.entry.id,
          question: res.entry.input.user,
          model: res.entry.model,
          provider: PROVIDER_LABEL[credentials.provider],
          answer: res.data,
          check: checkGrounding(res.data),
          latencyMs: res.entry.latencyMs,
          tokens: res.usage
            ? { input: res.usage.inputTokens, output: res.usage.outputTokens }
            : null,
          decision: "pending",
        },
        ...prev,
      ]);
      setQuestion("");
    } catch (err) {
      setError(err instanceof AiError ? err : new AiError("network", String(err)));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const decide = (id: string, decision: HumanDecision, edited?: string) => {
    setAsked((prev) => prev.map((a) => (a.id === id ? { ...a, decision, edited } : a)));
    void audit.update(id, {
      humanDecision: decision,
      editedOutput: decision === "edited" ? edited : undefined,
      decidedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-4">
      {ready && !credentials && (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4 sm:flex-row sm:items-center">
          <KeyRound className="size-5 shrink-0 text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">
            This feature is optional and uses <strong className="text-foreground">your own</strong>{" "}
            Anthropic or OpenAI key, sent only from your browser to the provider. Everything else on
            the site works without one.
          </p>
          <Button onClick={openSettings} className="shrink-0">
            <KeyRound aria-hidden /> Add a key
          </Button>
        </div>
      )}

      <form onSubmit={submit} className="space-y-2">
        <label htmlFor={qId} className="text-sm font-medium">
          Your question
        </label>
        <textarea
          id={qId}
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, MAX_QUESTION_CHARS))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          rows={2}
          maxLength={MAX_QUESTION_CHARS}
          placeholder="e.g. How many tweets came from Greater Brisbane?"
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
        />
        <div className="flex flex-wrap items-center gap-2">
          {busy ? (
            <Button type="button" variant="destructive" onClick={() => abortRef.current?.abort()}>
              <Square aria-hidden /> Stop
            </Button>
          ) : (
            <Button type="submit" disabled={ready && !!credentials && !question.trim()}>
              <Send aria-hidden /> {credentials ? "Ask" : "Add a key to ask"}
            </Button>
          )}
          {busy && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Asking{" "}
              {credentials?.model}…
            </span>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {credentials
              ? `${PROVIDER_LABEL[credentials.provider]} · ${credentials.model}`
              : `Default: ${PROVIDER_LABEL[prefs.provider]}`}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="Example questions">
          {EXAMPLES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setQuestion(q)}
              className="rounded-full border px-2.5 py-1 text-left text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              {q}
            </button>
          ))}
        </div>
      </form>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p className="min-w-0 flex-1">{error.message}</p>
          {(error.kind === "invalid-key" ||
            error.kind === "missing-key" ||
            error.kind === "permission") && (
            <Button size="sm" variant="outline" onClick={openSettings}>
              AI settings
            </Button>
          )}
        </div>
      )}

      {asked.length > 0 && (
        <div className="space-y-3">
          {asked.map((a) => (
            <AnswerCard key={a.id} item={a} onDecide={(d, e) => decide(a.id, d, e)} />
          ))}
          <p className="text-xs text-muted-foreground">
            Every call, its context hash and your review are in the{" "}
            <Link href="/ai-log" className="link">
              AI audit log
            </Link>{" "}
            (this browser only).
          </p>
        </div>
      )}
    </div>
  );
}
