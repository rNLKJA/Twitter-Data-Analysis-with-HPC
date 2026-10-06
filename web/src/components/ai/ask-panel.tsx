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
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import type { DecisionRecord, HumanDecision } from "@/lib/ai/audit-log";
import {
  checkGrounding,
  MAX_QUESTION_CHARS,
  type AskAnswer,
  type GroundingCheck,
} from "@/lib/ai/ask/answer";
import { ROW_INDEX } from "@/lib/ai/ask/context";
import { askResults } from "@/lib/ai/ask/run";
import { isFallbackModel } from "@/lib/ai/models";
import { AiError, PROVIDER_LABEL } from "@/lib/ai/types";
import { formatMs } from "@/lib/format";
import { cn } from "@/lib/utils";

import { AiBadge } from "./ai-badge";
import { useAi } from "./ai-provider";

interface Asked {
  id: string;
  question: string;
  /** Model requested. */
  model: string;
  /** Model the provider reported (a dated snapshot, or a fallback model). */
  servedModel?: string | null;
  provider: string;
  answer: AskAnswer;
  check: GroundingCheck;
  latencyMs: number;
  tokens: { input: number; output: number } | null;
  /** Latest decision. */
  decision: HumanDecision;
  /** Latest edit, kept when a later decision follows it. */
  edited?: string;
  decisions?: DecisionRecord[];
  /** False when the answer could not be written to the audit log. */
  logged?: boolean;
}

/*
 * Answers are kept in session storage so leaving the page (for example to the
 * audit log) does not strand them unreviewed. Model output only, never the key.
 */
const STORE_KEY = "spartan-tweet-cruncher.ai.ask-answers";
const MAX_KEPT = 20;

function loadAsked(): Asked[] {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Asked[]) : [];
    // Re-run the checks: the stored copy may predate a change to them.
    return parsed.map((a) => ({ ...a, check: checkGrounding(a.answer) }));
  } catch {
    return [];
  }
}

function saveAsked(items: readonly Asked[]) {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(items.slice(0, MAX_KEPT)));
  } catch {
    /* storage full or disabled: keep in memory */
  }
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });

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
  onDecide: (decision: DecisionRecord["decision"], edited?: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.edited ?? item.answer.answer);
  const editId = useId();
  const a = item.answer;
  const c = item.check;
  const issues = [
    ...c.invalidCitations.map((id) => `cites ${id}, which is not in the context`),
    ...(c.uncited ? ["gives an answer without citing any row"] : []),
    ...c.arithmeticErrors.map((st) => `shows arithmetic that does not hold (${st})`),
    ...(c.unverifiedInputs.length
      ? [`calculates with ${c.unverifiedInputs.join(", ")}, not found in the cited rows`]
      : []),
    ...(c.untracedNumbers.length
      ? [
          `mentions ${c.untracedNumbers.join(", ")}, found neither in the cited rows nor as a checked result of the calculation`,
        ]
      : []),
  ];
  const fallback = isFallbackModel(item.model, item.servedModel);

  return (
    <article className="panel space-y-3 p-4" aria-label={`Answer to: ${item.question}`}>
      <div className="flex flex-wrap items-center gap-2">
        <AiBadge
          detail={fallback ? `${item.model} → ${item.servedModel} (fallback)` : item.model}
        />
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
      {item.edited ? (
        <div className="space-y-1">
          <p
            className={cn(
              "text-sm whitespace-pre-wrap",
              item.decision === "rejected" && "line-through opacity-60",
            )}
          >
            {item.edited}
          </p>
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
              ? "Automatic check: every cited row exists, the shown arithmetic holds on numbers from the cited rows, and every number in the answer is in a cited row or a checked result. It does not prove the answer is right."
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
          {item.decisions && item.decisions.length > 1 && (
            <span className="w-full text-[0.68rem] text-muted-foreground">
              History: {item.decisions.map((d) => `${d.decision} ${time(d.at)}`).join(" → ")}
            </span>
          )}
        </div>
      )}
      {item.logged === false && (
        <p
          className="flex items-start gap-2 rounded-md bg-caution/10 px-2.5 py-1.5 text-xs"
          role="status"
        >
          <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-caution" aria-hidden />
          Answer received but it could not be written to the audit log (browser storage may be full
          or disabled), so it and your review are not recorded there.
        </p>
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

  // Session storage is read after hydration (the server has none).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off sync from browser storage
    setAsked(loadAsked());
  }, []);

  const update = (fn: (prev: Asked[]) => Asked[]) =>
    setAsked((prev) => {
      const next = fn(prev);
      saveAsked(next);
      return next;
    });

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
      update((prev) => [
        {
          id: res.entry.id,
          question: res.entry.input.user,
          model: res.entry.model,
          servedModel: res.entry.servedModel ?? null,
          provider: PROVIDER_LABEL[credentials.provider],
          answer: res.data,
          check: checkGrounding(res.data),
          latencyMs: res.entry.latencyMs,
          tokens: res.usage
            ? { input: res.usage.inputTokens, output: res.usage.outputTokens }
            : null,
          decision: "pending",
          decisions: [],
          logged: res.logged,
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

  const decide = (id: string, decision: DecisionRecord["decision"], edited?: string) => {
    const at = new Date().toISOString();
    const current = asked.find((a) => a.id === id);
    if (!current) return;
    // Decisions are appended, and a later accept or reject keeps the earlier edit.
    const record: DecisionRecord =
      decision === "edited" ? { decision, editedOutput: edited, at } : { decision, at };
    const decisions = [...(current.decisions ?? []), record];
    const editedOutput = decision === "edited" ? edited : current.edited;
    update((prev) =>
      prev.map((a) => (a.id === id ? { ...a, decision, edited: editedOutput, decisions } : a)),
    );
    if (current.logged === false) return;
    void audit.update(id, {
      humanDecision: decision,
      ...(editedOutput ? { editedOutput } : {}),
      decidedAt: at,
      decisions,
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
            // Enter confirms an input-method candidate (Chinese, Japanese, Korean) while
            // composing; only a plain Enter sends the (paid) request.
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing &&
              e.keyCode !== 229
            ) {
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
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Example questions">
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
