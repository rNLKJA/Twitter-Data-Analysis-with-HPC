"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { BOUNDARY_WINDOW, isIdIndentBoundary } from "@/lib/cruncher/boundary";
import {
  gatherOrder,
  getTaskRanks,
  isSupportedRankCount,
  splitFileIntoChunks,
} from "@/lib/cruncher/chunks";
import { processSalV1, type SalEntry } from "@/lib/cruncher/sal";
import type { RankPartials, Task1Row, Task2Row, Task3Result } from "@/lib/cruncher/tasks";
import {
  planBenchmark,
  type BenchmarkPlan,
  type BenchmarkSample,
  type PlannedRun,
} from "@/lib/lab/benchmark";
import { PoolTerminatedError, RankPool } from "@/lib/lab/rank-pool";
import {
  dictHash,
  resultsFingerprint,
  runKey,
  type BenchTag,
  type RunRecord,
  type TaskResults,
} from "@/lib/lab/runs";
import { now, type RankRequest, type RankResponse, type SynthResponse } from "@/workers/protocol";

/**
 * Orchestrates the browser re-enactment of main.py:
 *
 *  - a pool of rank workers (one per "MPI rank"), warmed up before timing;
 *  - split_file_into_chunks → each rank scans [start, end) of the shared Blob;
 *  - the page plays MPI's part, relaying each rank's partial tables to the
 *    task ranks (0, 1, 2 — or all to 0 on a single rank) in gather_task_tdf
 *    order; the task ranks reduce and report back.
 */

export interface LabFile {
  id: string;
  blob: Blob;
  name: string;
  bytes: number;
  kind: "synthetic" | "upload";
  seed?: number;
  tweets?: number;
  genMs?: number;
  head: string;
}

export type SourceState =
  | { status: "empty" }
  | { status: "generating"; seed: number; tweets: number; done: number; bytes: number }
  | { status: "ready"; file: LabFile }
  | { status: "error"; message: string };

export interface DictState {
  status: "loading" | "ready" | "error";
  source: "gazetteer" | "sal";
  name: string;
  entries: ReadonlyArray<readonly [string, string]>;
  /** dictHash(entries): part of the run key, so runs with different dictionaries are never compared. */
  hash: string;
  message?: string;
}

function readyDict(
  source: DictState["source"],
  name: string,
  entries: ReadonlyArray<readonly [string, string]>,
): DictState {
  return { status: "ready", source, name, entries, hash: dictHash(entries) };
}

function emptyDict(
  status: "loading" | "error",
  source: DictState["source"],
  name: string,
  message?: string,
): DictState {
  return { status, source, name, entries: [], hash: "", message };
}

export type Task = 1 | 2 | 3;

export interface RankView {
  rank: number;
  start: number;
  end: number;
  phase: "queued" | "scanning" | "sent" | "reducing" | "done" | "failed";
  bytesRead: number;
  tweets: number;
  matched: number;
  scanStart?: number;
  scanEnd?: number;
  linesRead?: number;
  linesSkipped?: number;
  stoppedAt?: number;
  tasks: Array<{ task: Task; start?: number; end?: number }>;
}

export interface RunView {
  id: number;
  /** runKey(file, dictionary): runs are only compared with runs of the same key. */
  key: string;
  size: number;
  status: "warming" | "running" | "done" | "error" | "cancelled";
  t0: number;
  tEnd?: number;
  wallMs?: number;
  ranks: RankView[];
  results?: TaskResults;
  error?: string;
  /** Ranks whose byte range starts inside an `"_id"` line's indentation (each adds one tweet). */
  doubleCountRanks: number[];
  /** Set when the run belongs to a benchmark. */
  bench?: BenchTag;
}

/** A repeated, randomised-order benchmark over several worker counts (see lib/lab/benchmark.ts). */
export interface BenchState {
  id: number;
  /** runKey of the file + dictionary it measured. */
  key: string;
  plan: BenchmarkPlan;
  status: "running" | "done" | "cancelled" | "error";
  /** Runs finished so far (warm-up included) and the plan's total. */
  done: number;
  total: number;
  current: PlannedRun | null;
  /** Timed runs only. */
  samples: BenchmarkSample[];
  startedAt: string;
  finishedAt?: string;
  error?: string;
  /** Logical cores the browser reported when the benchmark started. */
  cores: number;
}

interface LiveRun {
  view: RunView;
  partials: Array<RankPartials | null>;
  reduced: Partial<{ 1: Task1Row[]; 2: Task2Row[]; 3: Task3Result }>;
  resolve: (v: RunView) => void;
}

const HEAD_CHARS = 6000;

/** Which rank starts fall on the original's double-count boundary (read a small window per cut). */
async function findDoubleCountRanks(blob: Blob, starts: readonly number[]): Promise<number[]> {
  const hits = await Promise.all(
    starts.slice(1).map(async (s) => {
      const from = Math.max(0, s - BOUNDARY_WINDOW);
      const to = Math.min(blob.size, s + BOUNDARY_WINDOW);
      const win = new Uint8Array(await blob.slice(from, to).arrayBuffer());
      return isIdIndentBoundary(win, s - from, from === 0);
    }),
  );
  return hits.flatMap((hit, i) => (hit ? [i + 1] : []));
}

/** The parallel part of a run: the slowest rank's scan. */
function slowestScanMs(ranks: readonly RankView[]): number {
  return Math.max(0, ...ranks.map((r) => (r.scanEnd ?? 0) - (r.scanStart ?? 0)));
}

const noopSubscribe = () => () => {};
const readCores = () => navigator.hardwareConcurrency || 0;
/** -1 = not known yet (server render / before hydration); 0 = the browser does not say. */
const serverCores = () => -1;

/**
 * Offer up to the machine's logical cores (at least 4 so the layout is visible,
 * at most 16). Before hydration the core count is unknown (0); 8 is a neutral
 * placeholder that matches most machines, so the picker rarely shifts.
 */
function maxWorkersFor(cores: number): number {
  return Math.min(16, Math.max(4, cores > 0 ? cores : 8));
}

export function useMpiLab() {
  const [source, setSource] = useState<SourceState>({ status: "empty" });
  const [dict, setDict] = useState<DictState>(() =>
    emptyDict("loading", "gazetteer", "gazetteer.json"),
  );
  const [run, setRun] = useState<RunView | null>(null);
  const [history, setHistory] = useState<RunRecord[]>([]);
  const [sweeping, setSweeping] = useState(false);
  const [bench, setBench] = useState<BenchState | null>(null);
  const cores = useSyncExternalStore(noopSubscribe, readCores, serverCores);
  const maxWorkers = maxWorkersFor(cores);

  const poolRef = useRef<RankPool<Worker> | null>(null);
  const liveRef = useRef<LiveRun | null>(null);
  /**
   * Id of the run that is warming up or running, or null. cancel() clears it,
   * which is how a run that is still awaiting its workers learns it was stopped.
   */
  const activeRef = useRef<number | null>(null);
  const runSeq = useRef(0);
  const synthRef = useRef<Worker | null>(null);
  const flushRef = useRef<number | null>(null);
  const historyRef = useRef<RunRecord[]>([]);
  const cancelSweep = useRef(false);
  const benchSeq = useRef(0);

  // ── gazetteer (the published sal.json subset) ─────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetch("/data/gazetteer.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ dict: Record<string, string> }>;
      })
      .then((g) => {
        if (cancelled) return;
        setDict(readyDict("gazetteer", "gazetteer.json", Object.entries(g.dict)));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDict(
          emptyDict(
            "error",
            "gazetteer",
            "gazetteer.json",
            `Could not load the place gazetteer (${err instanceof Error ? err.message : String(err)}).`,
          ),
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── rendering throttle: progress messages mutate liveRef, flushed once per frame
  const scheduleFlush = useCallback(() => {
    if (flushRef.current !== null) return;
    flushRef.current = requestAnimationFrame(() => {
      flushRef.current = null;
      const live = liveRef.current;
      if (live)
        setRun({
          ...live.view,
          ranks: live.view.ranks.map((r) => ({ ...r, tasks: [...r.tasks] })),
        });
    });
  }, []);

  const terminatePool = useCallback(() => {
    poolRef.current?.terminate();
  }, []);

  const finish = useCallback(
    (live: LiveRun, patch: Partial<RunView>) => {
      Object.assign(live.view, patch);
      // A failed rank leaves its peers mid-scan; start from a clean pool next time.
      if (patch.status === "error") terminatePool();
      liveRef.current = null;
      if (activeRef.current === live.view.id) activeRef.current = null;
      if (flushRef.current !== null) cancelAnimationFrame(flushRef.current);
      flushRef.current = null;
      const snapshot = {
        ...live.view,
        ranks: live.view.ranks.map((r) => ({ ...r, tasks: [...r.tasks] })),
      };
      setRun(snapshot);
      live.resolve(snapshot);
    },
    [terminatePool],
  );

  const handleRankMessage = useCallback(
    (msg: RankResponse) => {
      if (msg.type === "ready") return;
      const live = liveRef.current;
      if (!live || msg.runId !== live.view.id) return;
      const v = live.view;

      if (msg.type === "error") {
        const who = msg.rank === undefined ? "A task rank" : `Rank ${msg.rank}`;
        if (msg.rank !== undefined && v.ranks[msg.rank]) v.ranks[msg.rank].phase = "failed";
        finish(live, { status: "error", error: `${who} failed: ${msg.message}`, tEnd: now() });
        return;
      }

      if (msg.type === "progress") {
        const r = v.ranks[msg.rank];
        r.phase = "scanning";
        r.bytesRead = msg.bytesRead;
        r.tweets = msg.tweets;
        scheduleFlush();
        return;
      }

      if (msg.type === "scanned") {
        const r = v.ranks[msg.rank];
        Object.assign(r, {
          phase: "sent",
          bytesRead: r.end - r.start,
          tweets: msg.tweets,
          matched: msg.matched,
          scanStart: msg.scanStart,
          scanEnd: msg.scanEnd,
          linesRead: msg.stats.linesRead,
          linesSkipped: msg.stats.linesSkipped,
          stoppedAt: msg.stats.stoppedAt,
        });
        live.partials[msg.rank] = msg.partials;

        if (live.partials.every((p) => p !== null)) {
          // gather_task_tdf: each task rank receives its own frame first, then ranks 0..N-1.
          const taskRanks = getTaskRanks(v.size);
          const keys = ["t1", "t2", "t3"] as const;
          ([1, 2, 3] as const).forEach((task, i) => {
            const host = taskRanks[i];
            const partials = gatherOrder(host, v.size).map((rank) => live.partials[rank]![keys[i]]);
            v.ranks[host].phase = "reducing";
            v.ranks[host].tasks.push({ task });
            const req: RankRequest = { type: "reduce", runId: v.id, task, partials };
            poolRef.current?.worker(host)?.postMessage(req);
          });
        }
        scheduleFlush();
        return;
      }

      if (msg.type === "reduced") {
        const host = getTaskRanks(v.size)[msg.task - 1];
        const t = v.ranks[host].tasks.find((x) => x.task === msg.task);
        if (t) {
          t.start = msg.reduceStart;
          t.end = msg.reduceEnd;
        }
        if (msg.task === 1) live.reduced[1] = msg.result as Task1Row[];
        if (msg.task === 2) live.reduced[2] = msg.result as Task2Row[];
        if (msg.task === 3) live.reduced[3] = msg.result as Task3Result;
        if (v.ranks[host].tasks.every((x) => x.end !== undefined)) v.ranks[host].phase = "done";

        if (live.reduced[1] && live.reduced[2] && live.reduced[3]) {
          const tEnd = now();
          for (let i = 0; i < v.ranks.length; i++) v.ranks[i].phase = "done";
          const results: TaskResults = {
            task1: live.reduced[1],
            task2: live.reduced[2],
            task3: live.reduced[3],
          };
          const record: RunRecord = {
            id: v.id,
            key: v.key,
            size: v.size,
            wallMs: tEnd - v.t0,
            scanMs: slowestScanMs(v.ranks),
            fingerprint: resultsFingerprint(results),
            doubleCounts: v.doubleCountRanks.length,
            ...(v.bench ? { bench: v.bench } : {}),
          };
          historyRef.current = [...historyRef.current, record];
          setHistory(historyRef.current);
          finish(live, {
            status: "done",
            tEnd,
            wallMs: tEnd - v.t0,
            results,
          });
        } else {
          scheduleFlush();
        }
      }
    },
    [finish, scheduleFlush],
  );

  const ensurePool = useCallback(
    (size: number) => {
      if (!poolRef.current) {
        poolRef.current = new RankPool<Worker>(
          (i) =>
            new Worker(new URL("../workers/rank.worker.ts", import.meta.url), {
              type: "module",
              name: `rank-${i}`,
            }),
          {
            onMessage: (data) => handleRankMessage(data as RankResponse),
            onCrash: (message, index) => {
              const live = liveRef.current;
              if (live)
                finish(live, {
                  status: "error",
                  error: `Rank ${index} crashed: ${message}`,
                  tEnd: now(),
                });
            },
          },
        );
      }
      return poolRef.current.ensure(size);
    },
    [finish, handleRankMessage],
  );

  useEffect(
    () => () => {
      terminatePool();
      synthRef.current?.terminate();
    },
    [terminatePool],
  );

  // ── data sources ───────────────────────────────────────────────────────────
  const generate = useCallback((seed: number, tweets: number) => {
    synthRef.current?.terminate();
    const worker = new Worker(new URL("../workers/synth.worker.ts", import.meta.url), {
      type: "module",
      name: "synth",
    });
    synthRef.current = worker;
    setSource({ status: "generating", seed, tweets, done: 0, bytes: 0 });
    worker.onmessage = (e: MessageEvent<SynthResponse>) => {
      const msg = e.data;
      if (msg.type === "progress") {
        setSource({ status: "generating", seed, tweets, done: msg.tweets, bytes: msg.bytes });
      } else if (msg.type === "done") {
        worker.terminate();
        synthRef.current = null;
        setSource({
          status: "ready",
          file: {
            id: `synthetic-${seed}-${tweets}-${msg.bytes}`,
            blob: msg.blob,
            name: `synthetic-${seed}-${tweets}.json`,
            bytes: msg.bytes,
            kind: "synthetic",
            seed,
            tweets: msg.tweets,
            genMs: msg.ms,
            head: msg.head,
          },
        });
      } else {
        worker.terminate();
        synthRef.current = null;
        setSource({ status: "error", message: msg.message });
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      synthRef.current = null;
      setSource({ status: "error", message: e.message || "The generator worker failed to start." });
    };
    worker.postMessage({ type: "generate", seed, tweets });
  }, []);

  const cancelGenerate = useCallback(() => {
    synthRef.current?.terminate();
    synthRef.current = null;
    setSource({ status: "empty" });
  }, []);

  const loadUpload = useCallback(async (file: File) => {
    if (file.size === 0) {
      setSource({ status: "error", message: `${file.name} is empty.` });
      return;
    }
    const head = await file.slice(0, HEAD_CHARS).text();
    setSource({
      status: "ready",
      file: {
        id: `upload-${file.name}-${file.size}-${file.lastModified}`,
        blob: file,
        name: file.name,
        bytes: file.size,
        kind: "upload",
        head,
      },
    });
  }, []);

  const loadSalFile = useCallback(async (file: File | null) => {
    if (!file) {
      setDict(emptyDict("loading", "gazetteer", "gazetteer.json"));
      try {
        const res = await fetch("/data/gazetteer.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const g = (await res.json()) as { dict: Record<string, string> };
        setDict(readyDict("gazetteer", "gazetteer.json", Object.entries(g.dict)));
      } catch (err) {
        setDict(
          emptyDict(
            "error",
            "gazetteer",
            "gazetteer.json",
            `Could not load the place gazetteer (${err instanceof Error ? err.message : String(err)}).`,
          ),
        );
      }
      return;
    }
    setDict(emptyDict("loading", "sal", file.name));
    try {
      const sal = JSON.parse(await file.text()) as Record<string, SalEntry>;
      const entries = [...processSalV1(sal).entries()];
      if (entries.length === 0) throw new Error("no entries found");
      setDict(readyDict("sal", file.name, entries));
    } catch (err) {
      setDict(
        emptyDict(
          "error",
          "sal",
          file.name,
          `${file.name} is not a sal.json-style object (${err instanceof Error ? err.message : String(err)}).`,
        ),
      );
    }
  }, []);

  // ── runs ───────────────────────────────────────────────────────────────────
  const startRun = useCallback(
    async (size: number, benchTag?: BenchTag): Promise<RunView | null> => {
      if (source.status !== "ready" || dict.status !== "ready" || activeRef.current !== null)
        return null;
      const file = source.file;
      const key = runKey(file.id, dict);
      const id = ++runSeq.current;
      const placeholder = (status: RunView["status"], error?: string): RunView => ({
        id,
        key,
        size,
        status,
        t0: now(),
        ranks: [],
        error,
        doubleCountRanks: [],
        ...(benchTag ? { bench: benchTag } : {}),
      });
      if (!isSupportedRankCount(size)) {
        const v = placeholder(
          "error",
          "The original program cannot run on 2 ranks: get_task_ranks names rank 2 as the Task 3 host.",
        );
        setRun(v);
        return v;
      }
      const { start, end } = splitFileIntoChunks(file.bytes, size);
      if (start.length !== size) {
        const v = placeholder("error", `The file is too small to split into ${size} byte ranges.`);
        setRun(v);
        return v;
      }

      activeRef.current = id;
      const warming = placeholder("warming");
      setRun(warming);
      // Only touch the display if it still shows this run (a newer one may have started).
      const settle = (v: RunView) => {
        setRun((prev) => (prev && prev.id !== id ? prev : v));
        return v;
      };

      let doubleCountRanks: number[];
      try {
        [doubleCountRanks] = await Promise.all([
          findDoubleCountRanks(file.blob, start),
          ensurePool(size),
        ]);
      } catch (err) {
        if (activeRef.current !== id || err instanceof PoolTerminatedError) {
          if (activeRef.current === id) activeRef.current = null;
          return settle({ ...warming, status: "cancelled", tEnd: now() });
        }
        activeRef.current = null;
        terminatePool();
        return settle({
          ...warming,
          status: "error",
          error: err instanceof Error ? err.message : String(err),
          tEnd: now(),
        });
      }
      // Stopped while the workers were starting (or the pool was replaced).
      const pool = poolRef.current;
      if (activeRef.current !== id || !pool || pool.size < size) {
        if (activeRef.current === id) activeRef.current = null;
        return settle({ ...warming, status: "cancelled", tEnd: now() });
      }

      const ranks: RankView[] = start.map((s, rank) => ({
        rank,
        start: s,
        end: end[rank],
        phase: "scanning",
        bytesRead: 0,
        tweets: 0,
        matched: 0,
        tasks: [],
      }));

      return new Promise<RunView>((resolve) => {
        const view: RunView = {
          id,
          key,
          size,
          status: "running",
          t0: now(),
          ranks,
          doubleCountRanks,
          ...(benchTag ? { bench: benchTag } : {}),
        };
        liveRef.current = { view, partials: Array(size).fill(null), reduced: {}, resolve };
        setRun({ ...view });
        for (let rank = 0; rank < size; rank++) {
          const req: RankRequest = {
            type: "scan",
            runId: id,
            rank,
            size,
            blob: file.blob,
            start: start[rank],
            end: end[rank],
            dict: dict.entries,
          };
          pool.worker(rank)!.postMessage(req);
        }
      });
    },
    [dict, ensurePool, source, terminatePool],
  );

  const cancel = useCallback(() => {
    cancelSweep.current = true;
    const live = liveRef.current;
    const pending = activeRef.current;
    activeRef.current = null;
    terminatePool();
    if (live) finish(live, { status: "cancelled", tEnd: now() });
    else if (pending !== null)
      // Still warming up: startRun is awaiting its workers and will also settle
      // as cancelled, but show it straight away.
      setRun((prev) =>
        prev && prev.id === pending && prev.status === "warming"
          ? { ...prev, status: "cancelled", tEnd: now() }
          : prev,
      );
  }, [finish, terminatePool]);

  /**
   * Run a benchmark plan: warm-up rounds (discarded), then R timed rounds,
   * each running every worker count once in a seeded random order. Stops at
   * the first run that does not finish (Stop, or an error).
   */
  const runBenchmark = useCallback(
    async (plan: BenchmarkPlan) => {
      if (source.status !== "ready" || dict.status !== "ready") return;
      const runs = planBenchmark(plan);
      const id = ++benchSeq.current;
      const key = runKey(source.file.id, dict);
      cancelSweep.current = false;
      setSweeping(true);
      let state: BenchState = {
        id,
        key,
        plan,
        status: "running",
        done: 0,
        total: runs.length,
        current: null,
        samples: [],
        startedAt: new Date().toISOString(),
        cores: navigator.hardwareConcurrency || 0,
      };
      const publish = (patch: Partial<BenchState>) => {
        state = { ...state, ...patch };
        setBench(state);
      };
      publish({});
      try {
        for (const planned of runs) {
          if (cancelSweep.current) {
            publish({ status: "cancelled", current: null });
            return;
          }
          publish({ current: planned });
          const v = await startRun(planned.size, {
            id,
            round: planned.round,
            warmup: planned.warmup,
          });
          if (!v || v.status !== "done" || v.wallMs === undefined) {
            publish({
              status: !v || v.status === "cancelled" ? "cancelled" : "error",
              error: v?.error,
              current: null,
            });
            return;
          }
          publish({
            done: state.done + 1,
            samples: planned.warmup
              ? state.samples
              : [
                  ...state.samples,
                  {
                    round: planned.round,
                    size: planned.size,
                    wallMs: v.wallMs,
                    scanMs: slowestScanMs(v.ranks),
                    runId: v.id,
                  },
                ],
          });
        }
        publish({ status: "done", current: null });
      } catch (err) {
        publish({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
          current: null,
        });
      } finally {
        if (state.status !== "running") publish({ finishedAt: new Date().toISOString() });
        setSweeping(false);
      }
    },
    [dict, source, startRun],
  );

  const clearHistory = useCallback(() => {
    historyRef.current = [];
    setHistory([]);
  }, []);

  const key =
    source.status === "ready" && dict.status === "ready" ? runKey(source.file.id, dict) : null;

  return {
    source,
    dict,
    /** runKey of the current file + dictionary (null until both are ready). */
    key,
    run,
    history,
    sweeping,
    maxWorkers,
    cores,
    generate,
    cancelGenerate,
    loadUpload,
    loadSalFile,
    startRun,
    bench,
    runBenchmark,
    cancel,
    clearHistory,
  };
}
