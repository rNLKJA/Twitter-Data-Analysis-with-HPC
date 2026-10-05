"use client";

import { ArrowRight, BadgeCheck } from "lucide-react";
import { useId, useMemo, useState } from "react";

import gazetteer from "../../../public/data/gazetteer.json";
import { firstNgrams, normaliseLocation, resolveLocationBounded } from "@/lib/cruncher/normalise";
import { formatInt } from "@/lib/format";
import { gccLabel, isRural } from "@/lib/gcc";
import { cn } from "@/lib/utils";

const DICT = new Map(Object.entries(gazetteer.dict as Record<string, string>));
const VERIFIED = new Map(gazetteer.places.map((p) => [p.name, p]));
const SUGGESTIONS = [
  "St Kilda, Melbourne",
  "Crafers - Bridgewater, South Australia",
  "Macquarie Park, Sydney",
  "Alice Springs, Northern Territory",
  "Hervey Bay, Queensland",
  "Toronto, Ontario",
  "Victoria, Australia",
];

/**
 * An unmatched place of n words makes the original try 2^n − 1 combinations;
 * past about 20 words that would freeze the tab, so the demo stops looking
 * after this many (exact for up to 15 words) and says so.
 */
const MAX_TRIES = 1 << 15;
/** Chips drawn before collapsing the rest into a count. */
const MAX_CHIPS = 24;
/** When the hit is far down the list: chips shown before the "… N more tried …" gap. */
const HEAD_CHIPS = 12;

type Chip =
  | { kind: "gram"; text: string; state: "tried" | "hit" | "untried" }
  | { kind: "gap"; text: string };

function chipsFor(
  words: readonly string[],
  tried: number,
  hit: string | null,
  total: number,
): Chip[] {
  const gram = (text: string, i: number): Chip => ({
    kind: "gram",
    text,
    state: hit !== null && i === tried - 1 ? "hit" : i < tried ? "tried" : "untried",
  });
  // The hit (or the end of the search) fits in the chip budget, with a few untried ones after it.
  if (tried <= MAX_CHIPS - 2 || (hit === null && tried <= MAX_CHIPS)) {
    const shown = firstNgrams(words, Math.min(total, Math.max(tried, 1) + 6, MAX_CHIPS));
    return shown.map(gram);
  }
  const head = firstNgrams(words, HEAD_CHIPS).map(gram);
  if (hit !== null) {
    return [
      ...head,
      { kind: "gap", text: `… ${formatInt(tried - HEAD_CHIPS - 1)} more tried …` },
      { kind: "gram", text: hit, state: "hit" },
    ];
  }
  return [...head, { kind: "gap", text: `… ${formatInt(tried - HEAD_CHIPS)} more tried` }];
}

export function PlaceMatcher() {
  const [input, setInput] = useState("Box Hill, Melbourne");
  const inputId = useId();
  const listId = useId();

  const steps = useMemo(() => {
    const lower = input.toLowerCase();
    const normalised = normaliseLocation(lower);
    const words = normalised.split(" ");
    const result = resolveLocationBounded(input, DICT, MAX_TRIES);
    const chips = chipsFor(words, result.tried, result.matchedBy, result.total);
    return { lower, normalised, words, result, chips };
  }, [input]);

  const verified = VERIFIED.get(input);
  const { result } = steps;
  const untried = result.total - result.tried;
  const shownUntried = steps.chips.filter((c) => c.kind === "gram" && c.state === "untried").length;
  const hidden = untried - shownUntried;
  const gcc = result.gcc;

  return (
    <div className="panel p-4 sm:p-6">
      <label htmlFor={inputId} className="text-sm font-medium">
        A tweet&apos;s <code className="font-mono text-xs">includes.places[0].full_name</code>
      </label>
      <input
        id={inputId}
        list={listId}
        value={input}
        onChange={(e) => setInput(e.target.value.slice(0, 80))}
        className="mt-2 h-10 w-full rounded-lg border border-input bg-transparent px-3 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
        spellCheck={false}
        autoComplete="off"
      />
      <datalist id={listId}>
        {gazetteer.places.map((p) => (
          <option key={p.name} value={p.name} />
        ))}
      </datalist>
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Examples">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setInput(s)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground",
              input === s && "border-primary/60 bg-primary/10 text-foreground",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <ol className="mt-6 space-y-4 text-sm">
        <Step n={1} title="Lower-case" code={steps.lower} />
        <Step
          n={2}
          title="normalise_location: drop punctuation, abbreviate state names, squeeze spaces"
          code={steps.normalised}
        />
        <li className="grid grid-cols-[1.75rem_1fr] gap-3">
          <StepNo n={3} />
          <div className="min-w-0">
            <p className="text-muted-foreground">
              Try every word combination in itertools order (shortest first) against sal_dict; the{" "}
              <em>first</em> hit wins
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {steps.chips.map((c, i) =>
                c.kind === "gap" ? (
                  <span key={`gap-${i}`} className="px-1 font-mono text-xs text-muted-foreground">
                    {c.text}
                  </span>
                ) : (
                  <span
                    key={`${c.text}-${i}`}
                    className={cn(
                      "rounded-md border px-2 py-0.5 font-mono text-xs",
                      c.state === "hit"
                        ? "border-primary bg-primary/15 font-medium text-foreground"
                        : c.state === "tried"
                          ? "border-border text-muted-foreground line-through decoration-muted-foreground/50"
                          : "border-dashed border-border text-muted-foreground",
                    )}
                  >
                    {c.text || " "}
                    <span className="sr-only">
                      {c.state === "hit" ? " (match)" : c.state === "tried" ? " (no match)" : ""}
                    </span>
                  </span>
                ),
              )}
              {result.complete && hidden > 0 && (
                <span className="px-1 font-mono text-xs text-muted-foreground">
                  +{formatInt(hidden)} not needed
                </span>
              )}
            </div>
            <p className="mt-2 font-mono text-[0.7rem] text-muted-foreground">
              {formatInt(steps.words.length)} word{steps.words.length === 1 ? "" : "s"} →{" "}
              {formatInt(result.total)} combination{result.total === 1 ? "" : "s"};{" "}
              {result.matchedBy !== null
                ? `the first hit was number ${formatInt(result.tried)}`
                : `tried ${formatInt(result.tried)}, no hit`}
              .
            </p>
            {!result.complete && (
              <p className="mt-2 rounded-lg border border-caution/40 bg-caution/10 p-2.5 text-xs">
                Stopped after {formatInt(result.tried)} of {formatInt(result.total)} combinations
                with no hit. The original would keep going through all of them, which is why a long
                free-text place name is so expensive; this demo stops here to keep the page
                responsive.
              </p>
            )}
          </div>
        </li>
        <li className="grid grid-cols-[1.75rem_1fr] gap-3">
          <StepNo n={4} />
          <div className="flex flex-wrap items-center gap-2" aria-live="polite">
            <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
            {!result.complete ? (
              <>
                <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-sm">?</span>
                <span className="text-xs text-muted-foreground">
                  undecided: the browser stopped searching before the original would have
                </span>
              </>
            ) : gcc ? (
              <>
                <span className="rounded-md bg-primary/12 px-2 py-0.5 font-mono text-sm font-semibold text-primary">
                  {gcc}
                </span>
                <span>{gccLabel(gcc)}</span>
                <span className="text-xs text-muted-foreground">
                  {isRural(gcc)
                    ? "rural: ignored by Tasks 2 and 3"
                    : "counts towards Tasks 2 and 3"}
                </span>
              </>
            ) : (
              <>
                <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-sm">None</span>
                <span className="text-xs text-muted-foreground">
                  no n-gram is a sal_dict key; the tweet still counts for Task 1
                </span>
              </>
            )}
          </div>
        </li>
      </ol>

      <p className="mt-6 border-t pt-3 text-xs text-muted-foreground">
        {verified ? (
          <span className="inline-flex items-start gap-1.5">
            <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
            Verified: the original Python resolved this exact place to {verified.gcc ?? "None"}{" "}
            against the full sal.json.
          </span>
        ) : (
          <>
            Matching here uses the published {DICT.size}-key subset of the processed sal.json, so
            free text outside the demo&apos;s place list may resolve differently from the full{" "}
            {gazetteer.source.fullDictionaryKeys.toLocaleString("en-AU")}-key dictionary.
          </>
        )}
      </p>
    </div>
  );
}

function StepNo({ n }: { n: number }) {
  return (
    <span className="flex size-7 items-center justify-center rounded-full border font-mono text-xs text-muted-foreground">
      {n}
    </span>
  );
}

function Step({ n, title, code }: { n: number; title: string; code: string }) {
  return (
    <li className="grid grid-cols-[1.75rem_1fr] gap-3">
      <StepNo n={n} />
      <div className="min-w-0">
        <p className="text-muted-foreground">{title}</p>
        <code className="mt-1 block rounded-md bg-muted/60 px-2 py-1 font-mono text-xs break-all">
          &ldquo;{code}&rdquo;
        </code>
      </div>
    </li>
  );
}
