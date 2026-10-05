"use client";

import { useCallback, useState } from "react";

/**
 * Tracks an element's content width with a ResizeObserver so SVG charts can
 * draw at 1 unit = 1 CSS pixel (text stays legible on phones instead of
 * shrinking with the viewBox). Returns `fallback` until measured.
 */
export function useElementWidth<T extends Element>(fallback: number) {
  const [width, setWidth] = useState(fallback);
  const ref = useCallback((node: T | null) => {
    if (!node) return;
    const update = (w: number) => {
      if (w > 0) setWidth(Math.round(w));
    };
    update(node.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => update(entries[0].contentRect.width));
    ro.observe(node);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}
