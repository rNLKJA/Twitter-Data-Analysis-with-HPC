/**
 * A minimal synchronous, seekable, binary file — the subset of Python's
 * `open(filename, "rb")` that `twitter_processorV1` relies on:
 * `seek`, `tell` and `readline` (which returns an empty result at EOF).
 */
export interface ByteFile {
  readonly size: number;
  seek(offset: number): void;
  tell(): number;
  /** Bytes up to and including the next "\n" (or to EOF). Empty at EOF. */
  readline(): Uint8Array;
  /** Advance past the next line without materialising it (same effect as `f.readline()`). */
  skipline(): void;
}

const NEWLINE = 0x0a;
const EMPTY = new Uint8Array(0);

/** ByteFile over an in-memory buffer (tests, CLI, small files). */
export class MemoryByteFile implements ByteFile {
  private pos = 0;
  constructor(private readonly bytes: Uint8Array) {}

  get size(): number {
    return this.bytes.length;
  }

  seek(offset: number): void {
    this.pos = Math.max(0, Math.min(offset, this.bytes.length));
  }

  tell(): number {
    return this.pos;
  }

  readline(): Uint8Array {
    const start = this.pos;
    if (start >= this.bytes.length) return EMPTY;
    const nl = this.bytes.indexOf(NEWLINE, start);
    const end = nl === -1 ? this.bytes.length : nl + 1;
    this.pos = end;
    return this.bytes.subarray(start, end);
  }

  skipline(): void {
    if (this.pos >= this.bytes.length) return;
    const nl = this.bytes.indexOf(NEWLINE, this.pos);
    this.pos = nl === -1 ? this.bytes.length : nl + 1;
  }
}

/**
 * ByteFile that pages through a larger source in fixed-size windows, so a
 * worker only ever holds a few MB of its byte range in memory — the browser
 * analogue of each MPI rank seeking into the shared file on Spartan's
 * filesystem. `readRange` must return the bytes in [start, end).
 */
export class PagedByteFile implements ByteFile {
  private pos = 0;
  private winStart = 0;
  private win: Uint8Array = EMPTY;
  /** Total bytes pulled from the source (for I/O accounting in the UI). */
  bytesFetched = 0;

  constructor(
    readonly size: number,
    private readonly readRange: (start: number, end: number) => Uint8Array,
    private readonly pageSize = 4 * 1024 * 1024,
  ) {}

  seek(offset: number): void {
    this.pos = Math.max(0, Math.min(offset, this.size));
  }

  tell(): number {
    return this.pos;
  }

  private load(at: number): void {
    const end = Math.min(this.size, at + this.pageSize);
    this.win = this.readRange(at, end);
    this.winStart = at;
    this.bytesFetched += end - at;
  }

  /** Locate the end (exclusive) of the line starting at `this.pos`. */
  private lineEnd(): number {
    let searchFrom = this.pos;
    // Collect across window boundaries if needed.
    for (;;) {
      const winEnd = this.winStart + this.win.length;
      if (searchFrom < this.winStart || searchFrom >= winEnd) {
        if (searchFrom >= this.size) return this.size;
        // Keep the line start inside the window so it can be sliced in one go.
        this.load(this.pos);
        continue;
      }
      const nl = this.win.indexOf(NEWLINE, searchFrom - this.winStart);
      if (nl !== -1) return this.winStart + nl + 1;
      if (winEnd >= this.size) return this.size;
      // Line straddles the window: grow the window from the line start.
      const grown = Math.min(this.size, this.pos + Math.max(this.pageSize, (winEnd - this.pos) * 2));
      this.win = this.readRange(this.pos, grown);
      this.bytesFetched += grown - this.pos;
      this.winStart = this.pos;
      searchFrom = winEnd;
    }
  }

  readline(): Uint8Array {
    if (this.pos >= this.size) return EMPTY;
    const end = this.lineEnd();
    const out = this.win.subarray(this.pos - this.winStart, end - this.winStart);
    this.pos = end;
    return out;
  }

  skipline(): void {
    if (this.pos >= this.size) return;
    this.pos = this.lineEnd();
  }
}
