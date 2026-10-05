/// <reference lib="webworker" />
/**
 * One "MPI rank". It reads only its own byte range of the shared file by
 * slicing the Blob page by page (the analogue of `f.seek(cs)` on Spartan's
 * shared filesystem), runs the ported `twitterProcessorV1` and the three
 * rank-local aggregations, and, if it is a task rank, performs that task's
 * reduction on the partial tables the page relays to it.
 */
import { PagedByteFile } from "@/lib/cruncher/byte-file";
import { twitterProcessorV1 } from "@/lib/cruncher/processor";
import {
  rankPartials,
  reduceTask1,
  reduceTask2,
  reduceTask3,
  type AuthorCount,
  type AuthorGccCount,
  type GccCount,
} from "@/lib/cruncher/tasks";

import { now, type RankRequest, type RankResponse } from "./protocol";

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (msg: RankResponse) => ctx.postMessage(msg);

const PAGE = 4 * 1024 * 1024;

ctx.onmessage = (event: MessageEvent<RankRequest>) => {
  const req = event.data;
  if (req.type === "scan") {
    try {
      const scanStart = now();
      const reader = new FileReaderSync();
      const file = new PagedByteFile(
        req.blob.size,
        (s, e) => new Uint8Array(reader.readAsArrayBuffer(req.blob.slice(s, e))),
        PAGE,
      );
      const dict = new Map(req.dict);
      let last = 0;
      const { frame, stats } = twitterProcessorV1(file, req.start, req.end, dict, {
        progressEvery: 20_000,
        onProgress: (p) => {
          const t = now();
          if (t - last < 50) return;
          last = t;
          post({
            type: "progress",
            runId: req.runId,
            rank: req.rank,
            bytesRead: p.bytesRead,
            tweets: p.tweets,
          });
        },
      });
      const partials = rankPartials(frame);
      let matched = 0;
      for (const g of frame.gcc) if (g !== null) matched++;
      post({
        type: "scanned",
        runId: req.runId,
        rank: req.rank,
        partials,
        tweets: frame.tweetId.length,
        matched,
        stats,
        bytesFetched: file.bytesFetched,
        scanStart,
        scanEnd: now(),
      });
    } catch (err) {
      post({
        type: "error",
        runId: req.runId,
        rank: req.rank,
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (req.type === "reduce") {
    try {
      const reduceStart = now();
      const result =
        req.task === 1
          ? reduceTask1(req.partials as AuthorCount[][])
          : req.task === 2
            ? reduceTask2(req.partials as GccCount[][])
            : reduceTask3(req.partials as AuthorGccCount[][]);
      post({
        type: "reduced",
        runId: req.runId,
        task: req.task,
        result,
        reduceStart,
        reduceEnd: now(),
      });
    } catch (err) {
      post({
        type: "error",
        runId: req.runId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
};

// Tell the page this rank's module has loaded, so start-up is not timed.
post({ type: "ready" });
