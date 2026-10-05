/**
 * The pool of rank workers behind the MPI lab, kept free of React so the
 * start-up / shutdown rules can be unit-tested with fake workers.
 *
 * Each worker posts `{ type: "ready" }` once its module has loaded. `ensure`
 * resolves when the first `size` workers are ready, and always settles:
 * terminating the pool rejects it with `PoolTerminatedError`, and a worker
 * that fails to load rejects it with `WorkerStartError`. (Before this, a Stop
 * during warm-up left `ensure` pending forever and the lab locked up.)
 */

export interface PoolWorker {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

export class PoolTerminatedError extends Error {
  constructor() {
    super("The rank workers were terminated.");
    this.name = "PoolTerminatedError";
  }
}

export class WorkerStartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkerStartError";
  }
}

interface Slot<W extends PoolWorker> {
  worker: W;
  ready: Promise<void>;
  fail: (err: Error) => void;
}

export interface RankPoolHandlers {
  /** Every non-"ready" message from worker `index`. */
  onMessage: (data: unknown, index: number) => void;
  /** A worker that had already started reported an uncaught error. */
  onCrash: (message: string, index: number) => void;
}

export class RankPool<W extends PoolWorker = PoolWorker> {
  private slots: Array<Slot<W>> = [];

  constructor(
    private readonly create: (index: number) => W,
    private readonly handlers: RankPoolHandlers,
  ) {}

  get size(): number {
    return this.slots.length;
  }

  worker(index: number): W | undefined {
    return this.slots[index]?.worker;
  }

  /** Start workers until there are `size`, and wait for the first `size` to be ready. */
  ensure(size: number): Promise<void> {
    while (this.slots.length < size) this.slots.push(this.spawn(this.slots.length));
    return Promise.all(this.slots.slice(0, size).map((s) => s.ready)).then(() => undefined);
  }

  /** Kill every worker; pending `ensure` calls reject with PoolTerminatedError. */
  terminate(): void {
    const slots = this.slots;
    this.slots = [];
    for (const s of slots) {
      s.fail(new PoolTerminatedError());
      s.worker.onmessage = null;
      s.worker.onerror = null;
      s.worker.terminate();
    }
  }

  private spawn(index: number): Slot<W> {
    const worker = this.create(index);
    let ready = false;
    let settled = false;
    let resolve!: () => void;
    let reject!: (err: Error) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    // Rejections are always observed through ensure(); this stops an orphaned
    // slot (e.g. one beyond the size being awaited) from logging a warning.
    promise.catch(() => {});
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as { type?: string } | null;
      if (data && data.type === "ready") {
        if (!settled) {
          settled = true;
          ready = true;
          resolve();
        }
        return;
      }
      this.handlers.onMessage(event.data, index);
    };
    worker.onerror = (event: ErrorEvent) => {
      event.preventDefault?.();
      const message = event.message || `Rank worker ${index} crashed.`;
      if (!ready) fail(new WorkerStartError(`Rank worker ${index} failed to start: ${message}`));
      else this.handlers.onCrash(message, index);
    };

    return { worker, ready: promise, fail };
  }
}
