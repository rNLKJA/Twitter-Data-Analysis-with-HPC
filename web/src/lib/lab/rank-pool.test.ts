import { describe, expect, it, vi } from "vitest";

import { PoolTerminatedError, RankPool, WorkerStartError, type PoolWorker } from "./rank-pool";

class FakeWorker implements PoolWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: unknown[] = [];
  terminated = false;
  postMessage(message: unknown) {
    this.posted.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  emit(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
  crash(message: string) {
    this.onerror?.({ message, preventDefault() {} } as ErrorEvent);
  }
}

function setup() {
  const workers: FakeWorker[] = [];
  const onMessage = vi.fn();
  const onCrash = vi.fn();
  const pool = new RankPool((i) => (workers[i] = new FakeWorker()), { onMessage, onCrash });
  return { pool, workers, onMessage, onCrash };
}

/** Resolves to "pending" if `p` has not settled after the microtask queue drains. */
async function state(p: Promise<unknown>): Promise<"resolved" | "rejected" | "pending"> {
  let s: "resolved" | "rejected" | "pending" = "pending";
  p.then(
    () => (s = "resolved"),
    () => (s = "rejected"),
  );
  await new Promise((r) => setTimeout(r, 0));
  return s;
}

describe("RankPool", () => {
  it("resolves once every requested worker reports ready", async () => {
    const { pool, workers } = setup();
    const ready = pool.ensure(3);
    expect(workers).toHaveLength(3);
    workers[0].emit({ type: "ready" });
    workers[1].emit({ type: "ready" });
    expect(await state(ready)).toBe("pending");
    workers[2].emit({ type: "ready" });
    expect(await state(ready)).toBe("resolved");
  });

  it("reuses warm workers and only starts the missing ones", async () => {
    const { pool, workers } = setup();
    const first = pool.ensure(2);
    workers.forEach((w) => w.emit({ type: "ready" }));
    await first;
    const second = pool.ensure(4);
    expect(workers).toHaveLength(4);
    workers[2].emit({ type: "ready" });
    workers[3].emit({ type: "ready" });
    expect(await state(second)).toBe("resolved");
    expect(pool.size).toBe(4);
  });

  it("rejects a pending warm-up when the pool is terminated (Stop during start-up)", async () => {
    const { pool, workers } = setup();
    const ready = pool.ensure(4);
    workers[0].emit({ type: "ready" });
    pool.terminate();
    await expect(ready).rejects.toBeInstanceOf(PoolTerminatedError);
    expect(workers.every((w) => w.terminated)).toBe(true);
    expect(pool.size).toBe(0);
    expect(pool.worker(0)).toBeUndefined();
  });

  it("rejects the warm-up when a worker fails to load", async () => {
    const { pool, workers, onCrash } = setup();
    const ready = pool.ensure(2);
    workers[0].emit({ type: "ready" });
    workers[1].crash("SyntaxError: bad module");
    await expect(ready).rejects.toBeInstanceOf(WorkerStartError);
    await expect(ready).rejects.toThrow(/Rank worker 1 failed to start: SyntaxError/);
    expect(onCrash).not.toHaveBeenCalled();
  });

  it("reports crashes after start-up to onCrash, and forwards other messages", async () => {
    const { pool, workers, onMessage, onCrash } = setup();
    const ready = pool.ensure(1);
    workers[0].emit({ type: "ready" });
    await ready;
    workers[0].emit({ type: "progress", runId: 1 });
    expect(onMessage).toHaveBeenCalledWith({ type: "progress", runId: 1 }, 0);
    workers[0].crash("out of memory");
    expect(onCrash).toHaveBeenCalledWith("out of memory", 0);
  });

  it("starts fresh workers after a terminate", async () => {
    const { pool, workers } = setup();
    void pool.ensure(2).catch(() => {});
    pool.terminate();
    const again = pool.ensure(2);
    expect(workers).toHaveLength(2); // indices 0 and 1 were replaced by new workers
    expect(workers.every((w) => !w.terminated)).toBe(true);
    workers.forEach((w) => w.emit({ type: "ready" }));
    expect(await state(again)).toBe("resolved");
  });
});
