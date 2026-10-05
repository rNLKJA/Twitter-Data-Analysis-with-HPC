"use client";

import { CircleAlert, FileJson, LoaderCircle, Shuffle, Upload, X } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { DictState, SourceState } from "@/hooks/use-mpi-lab";
import { formatBytes, formatInt, formatMs } from "@/lib/format";
import { cn } from "@/lib/utils";

const SIZES = [
  { tweets: 25_000, label: "25k" },
  { tweets: 100_000, label: "100k" },
  { tweets: 200_000, label: "200k" },
];
/** Measured average for the synthetic layout (≈ 1.22 kB per tweet). */
const BYTES_PER_TWEET = 1220;

export function SourcePanel({
  source,
  dict,
  busy,
  onGenerate,
  onCancelGenerate,
  onUpload,
  onSalFile,
}: {
  source: SourceState;
  dict: DictState;
  busy: boolean;
  onGenerate: (seed: number, tweets: number) => void;
  onCancelGenerate: () => void;
  onUpload: (file: File) => void;
  onSalFile: (file: File | null) => void;
}) {
  const [seed, setSeed] = useState(2023);
  const [tweets, setTweets] = useState(100_000);
  const seedId = useId();
  const uploadId = useId();
  const salId = useId();
  const generating = source.status === "generating";

  return (
    <section className="panel p-4 sm:p-5" aria-labelledby="source-title">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-md bg-primary/12 font-mono text-xs text-primary">
          1
        </span>
        <h2 id="source-title" className="font-heading text-base font-semibold tracking-tight">
          Input file
        </h2>
      </div>

      <Tabs defaultValue="synthetic">
        <TabsList className="w-full" aria-label="Input source">
          <TabsTrigger value="synthetic">Synthetic</TabsTrigger>
          <TabsTrigger value="upload">Your own files</TabsTrigger>
        </TabsList>

        <TabsContent value="synthetic" className="space-y-4 pt-3">
          <p className="text-sm text-muted-foreground">
            A seeded, made-up file with the exact line layout of bigTwitter.json, so the original
            scanner&apos;s skip counts still line up. Same seed, same bytes.
          </p>
          <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-3">
            <label htmlFor={seedId} className="text-sm font-medium">
              Seed
            </label>
            <div className="flex gap-2">
              <input
                id={seedId}
                type="number"
                inputMode="numeric"
                min={0}
                max={2147483647}
                value={seed}
                disabled={generating || busy}
                onChange={(e) =>
                  setSeed(
                    Math.max(0, Math.min(2147483647, Math.floor(Number(e.target.value) || 0))),
                  )
                }
                className="num h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50"
              />
              <Button
                variant="outline"
                size="icon"
                disabled={generating || busy}
                onClick={() => setSeed(Math.floor(Math.random() * 1_000_000))}
                aria-label="Random seed"
                title="Random seed"
              >
                <Shuffle aria-hidden />
              </Button>
            </div>
            <span className="text-sm font-medium" id={`${seedId}-size`}>
              Tweets
            </span>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={0}
              value={String(tweets)}
              onValueChange={(v) => v && setTweets(Number(v))}
              aria-labelledby={`${seedId}-size`}
              disabled={generating || busy}
            >
              {SIZES.map((s) => (
                <ToggleGroupItem
                  key={s.tweets}
                  value={String(s.tweets)}
                  className="px-3 font-mono text-xs data-[state=on]:bg-primary/12 data-[state=on]:text-primary"
                  aria-label={`${formatInt(s.tweets)} tweets, about ${formatBytes(s.tweets * BYTES_PER_TWEET)}`}
                >
                  {s.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <p className="text-xs text-muted-foreground">
            About {formatBytes(tweets * BYTES_PER_TWEET)}, built in a background worker and kept in
            memory as a Blob.
          </p>
          {generating ? (
            <div className="space-y-2" role="status" aria-live="polite">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <LoaderCircle className="size-3.5 animate-spin text-primary" aria-hidden />
                  Writing tweets… {formatInt(source.done)} / {formatInt(source.tweets)}
                </span>
                <Button variant="ghost" size="xs" onClick={onCancelGenerate}>
                  <X aria-hidden /> Cancel
                </Button>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${(source.done / source.tweets) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <Button className="w-full" onClick={() => onGenerate(seed, tweets)} disabled={busy}>
              <FileJson aria-hidden /> Generate synthetic file
            </Button>
          )}
        </TabsContent>

        <TabsContent value="upload" className="space-y-4 pt-3">
          <p className="text-sm text-muted-foreground">
            Have a file in the course&apos;s format (for example tinyTwitter.json)? Pick it here.
            Files are read locally and never leave your device.
          </p>
          <FilePick
            id={uploadId}
            label="Twitter JSON file"
            hint="Pretty-printed like bigTwitter.json"
            disabled={busy || generating}
            onPick={(f) => f && onUpload(f)}
          />
          <FilePick
            id={salId}
            label="sal.json (optional)"
            hint="Without it, only the demo gazetteer's places resolve"
            disabled={busy}
            onPick={(f) => onSalFile(f)}
            clearable={dict.source === "sal"}
          />
        </TabsContent>
      </Tabs>

      <div className="mt-4 border-t pt-3 text-xs text-muted-foreground">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono tracking-wider uppercase">sal_dict</span>
          {dict.status === "loading" && (
            <span className="flex items-center gap-1">
              <LoaderCircle className="size-3 animate-spin" aria-hidden /> loading {dict.name}
            </span>
          )}
          {dict.status === "ready" && (
            <span>
              {dict.name} ·{" "}
              <span className="num font-mono text-foreground">
                {formatInt(dict.entries.length)}
              </span>{" "}
              place keys
              {dict.source === "gazetteer" && " (published subset of the processed sal.json)"}
            </span>
          )}
        </p>
        {dict.status === "error" && (
          <p className="mt-1 flex items-start gap-1.5 text-destructive" role="alert">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {dict.message}
          </p>
        )}
      </div>
    </section>
  );
}

function FilePick({
  id,
  label,
  hint,
  disabled,
  onPick,
  clearable,
}: {
  id: string;
  label: string;
  hint: string;
  disabled?: boolean;
  onPick: (file: File | null) => void;
  clearable?: boolean;
}) {
  const [name, setName] = useState<string | null>(null);
  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium" id={`${id}-label`}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        <label
          htmlFor={id}
          className={cn(
            "flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input px-3 text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/40",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          <Upload className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{name ?? "Choose a .json file"}</span>
          <input
            id={id}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            disabled={disabled}
            aria-describedby={`${id}-hint`}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setName(f?.name ?? null);
              onPick(f);
              e.target.value = "";
            }}
          />
        </label>
        {clearable && name && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Clear ${label}`}
            onClick={() => {
              setName(null);
              onPick(null);
            }}
          >
            <X aria-hidden />
          </Button>
        )}
      </div>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}

export function FileCard({ source }: { source: SourceState }) {
  if (source.status === "error") {
    return (
      <p
        className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/8 p-3 text-sm text-destructive"
        role="alert"
      >
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {source.message}
      </p>
    );
  }
  if (source.status !== "ready") return null;
  const f = source.file;
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="flex items-center gap-2 font-mono text-xs">
        <FileJson className="size-3.5 text-primary" aria-hidden />
        <span className="truncate">{f.name}</span>
      </p>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Size</dt>
          <dd className="num font-mono">{formatBytes(f.bytes)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Tweets</dt>
          <dd className="num font-mono">
            {f.tweets !== undefined ? formatInt(f.tweets) : "unknown"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            {f.kind === "synthetic" ? "Built in" : "Source"}
          </dt>
          <dd className="num font-mono">{f.genMs !== undefined ? formatMs(f.genMs) : "local"}</dd>
        </div>
      </dl>
      <details className="group mt-2">
        <summary className="cursor-pointer text-xs text-primary select-none">
          Peek at the first lines
        </summary>
        <pre
          className="mt-2 max-h-64 overflow-auto rounded-md border bg-background p-2 font-mono text-[0.7rem] leading-relaxed"
          tabIndex={0}
        >
          <code>{f.head.split("\n").slice(0, 60).join("\n")}</code>
        </pre>
      </details>
    </div>
  );
}
