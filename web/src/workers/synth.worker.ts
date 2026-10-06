/// <reference lib="webworker" />
/**
 * Generates a seeded synthetic bigTwitter.json-shaped file off the main
 * thread and hands it back as a Blob (which can then be shared with every
 * rank worker without copying).
 */
import { generateSyntheticPieces } from "@/lib/synth/generator";

import { now, type SynthRequest, type SynthResponse } from "./protocol";

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (msg: SynthResponse) => ctx.postMessage(msg);

const FLUSH_AT = 1 << 20; // encode roughly every 1 MB of text
const HEAD_CHARS = 6000;

ctx.onmessage = (event: MessageEvent<SynthRequest>) => {
  const req = event.data;
  if (req.type !== "generate") return;
  try {
    const t0 = now();
    const encoder = new TextEncoder();
    const parts: Uint8Array<ArrayBuffer>[] = [];
    let buffer = "";
    let head = "";
    let bytes = 0;
    let tweets = 0;
    let lastPost = 0;

    for (const piece of generateSyntheticPieces({ seed: req.seed, tweets: req.tweets })) {
      if (piece.startsWith("  {")) tweets++;
      buffer += piece;
      if (head.length < HEAD_CHARS) head += piece.slice(0, HEAD_CHARS - head.length);
      if (buffer.length >= FLUSH_AT) {
        const chunk = encoder.encode(buffer);
        parts.push(chunk);
        bytes += chunk.length;
        buffer = "";
        const t = now();
        if (t - lastPost > 60) {
          lastPost = t;
          post({ type: "progress", tweets, total: req.tweets, bytes });
        }
      }
    }
    const tail = encoder.encode(buffer);
    parts.push(tail);
    bytes += tail.length;

    const blob = new Blob(parts, { type: "application/json" });
    post({ type: "done", blob, tweets, bytes, ms: now() - t0, head });
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
