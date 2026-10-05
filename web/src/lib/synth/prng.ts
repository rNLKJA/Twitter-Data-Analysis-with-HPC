/** mulberry32: tiny, fast, deterministic 32-bit PRNG (same stream in every JS engine). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  next(): number;
  int(minInclusive: number, maxInclusive: number): number;
  pick<T>(items: readonly T[]): T;
  chance(p: number): boolean;
  hex(len: number): string;
  digits(len: number): string;
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed);
  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (p) => next() < p,
    hex: (len) => {
      let s = "";
      for (let i = 0; i < len; i++) s += Math.floor(next() * 16).toString(16);
      return s;
    },
    digits: (len) => {
      let s = String(1 + Math.floor(next() * 9));
      for (let i = 1; i < len; i++) s += Math.floor(next() * 10);
      return s;
    },
  };
}

/** O(log n) sampler over non-negative weights. */
export function weightedSampler(weights: readonly number[]): (u: number) => number {
  const cumulative: number[] = [];
  let total = 0;
  for (const w of weights) {
    total += w;
    cumulative.push(total);
  }
  return (u: number) => {
    const target = u * total;
    let lo = 0;
    let hi = cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (cumulative[mid] > target) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  };
}
