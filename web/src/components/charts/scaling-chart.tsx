"use client";

import { useId, useRef, type PointerEvent } from "react";

import { useElementWidth } from "@/hooks/use-element-width";
import { amdahlSpeedup, amdahlTime, gustafsonSpeedup } from "@/lib/amdahl";
import { countTicks, linearScale, niceTicks, niceTimeTicks } from "@/lib/chart";
import { cn } from "@/lib/utils";

export type MarkerShape = "circle" | "ring-square" | "diamond";

export type ChartKind = "speedup" | "time" | "efficiency";

export interface MeasuredPoint {
  n: number;
  /** speedup (kind = speedup), seconds (kind = time) or a fraction (kind = efficiency) */
  value: number;
  /** Interval drawn as an error bar, in the same units as value. */
  lo?: number;
  hi?: number;
  label: string;
  shape?: MarkerShape;
}

const M = { top: 18, right: 18, bottom: 44, left: 52 };
/** Widest the hover readout gets (13rem); used to keep it inside the chart on phones. */
const TIP_MAX_W = 208;

function Marker({ shape = "circle", x, y }: { shape?: MarkerShape; x: number; y: number }) {
  if (shape === "ring-square")
    return (
      <rect
        x={x - 8.5}
        y={y - 8.5}
        width={17}
        height={17}
        rx={2}
        fill="none"
        className="stroke-series-2"
        strokeWidth={2}
      />
    );
  if (shape === "diamond")
    return (
      <path
        d={`M${x} ${y - 7}L${x + 7} ${y}L${x} ${y + 7}L${x - 7} ${y}Z`}
        className="fill-series-2 stroke-card"
        strokeWidth={2}
      />
    );
  return <circle cx={x} cy={y} r={5.5} className="fill-series-2 stroke-card" strokeWidth={2} />;
}

function MarkerIcon({ shape = "circle" }: { shape?: MarkerShape }) {
  return (
    <svg width="18" height="18" viewBox="-9 -9 18 18" aria-hidden className="shrink-0">
      <Marker shape={shape} x={0} y={0} />
    </svg>
  );
}

export function ScalingChart({
  kind,
  t1,
  f,
  fBand,
  showGustafson = false,
  maxN,
  measured,
  focusN,
  onHoverN,
  formatTime,
  title,
  className,
}: {
  kind: ChartKind;
  /** single-worker time in seconds (baseline for the curves) */
  t1: number;
  /** serial fraction for the Amdahl curve; null hides it */
  f: number | null;
  /** Interval for f, drawn as a band around the Amdahl curve. */
  fBand?: readonly [number, number] | null;
  /** Overlay Gustafson's law with the same serial fraction (speedup and efficiency only). */
  showGustafson?: boolean;
  maxN: number;
  measured: readonly MeasuredPoint[];
  focusN: number | null;
  onHoverN?: (n: number | null) => void;
  formatTime: (seconds: number) => string;
  title: string;
  className?: string;
}) {
  const id = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [boxRef, W] = useElementWidth<HTMLElement>(560);
  const H = Math.round(Math.min(340, Math.max(250, W * 0.6)));
  const x = linearScale([1, maxN], [M.left, W - M.right]);
  const top = (m: MeasuredPoint) => Math.max(m.value, Number.isFinite(m.hi) ? m.hi! : 0);
  const yMax =
    kind === "speedup"
      ? Math.max(maxN, ...measured.map(top)) * 1.02
      : kind === "efficiency"
        ? Math.max(1, ...measured.map(top)) * 1.05
        : Math.max(t1, ...measured.map(top)) * 1.05;
  const yTicks = kind === "time" ? niceTimeTicks(yMax, 5) : niceTicks(yMax, 5);
  const y = linearScale([0, yTicks[yTicks.length - 1]], [H - M.bottom, M.top]);
  const xTicks = countTicks(maxN, W < 420 ? 4 : maxN <= 16 ? 4 : 6);

  const amdahlAt = (ff: number, n: number) =>
    kind === "speedup"
      ? amdahlSpeedup(ff, n)
      : kind === "efficiency"
        ? amdahlSpeedup(ff, n) / n
        : amdahlTime(t1, ff, n);
  const model = (n: number) => amdahlAt(f ?? 0, n);
  const ideal = (n: number) => (kind === "speedup" ? n : kind === "efficiency" ? 1 : t1 / n);
  const gustafson = (n: number) =>
    kind === "efficiency" ? gustafsonSpeedup(f ?? 0, n) / n : gustafsonSpeedup(f ?? 0, n);
  const drawGustafson = showGustafson && f != null && kind !== "time";
  const fmt = (v: number) =>
    kind === "speedup"
      ? `${v.toFixed(v < 10 ? 2 : 1)}×`
      : kind === "efficiency"
        ? `${Math.round(v * 100)}%`
        : formatTime(v);
  const fmtTick = (t: number) =>
    kind === "speedup"
      ? `${t}×`
      : kind === "efficiency"
        ? `${Math.round(t * 100)}%`
        : formatTime(t);

  const samples = Array.from({ length: 200 }, (_, i) => 1 + ((maxN - 1) * i) / 199);
  const clampY = (v: number) => y(Math.min(Math.max(v, 0), y.domain[1]));
  const path = (fn: (n: number) => number) =>
    samples
      .map((n, i) => `${i ? "L" : "M"}${x(n).toFixed(1)} ${clampY(fn(n)).toFixed(1)}`)
      .join("");
  const band =
    fBand && f != null && Number.isFinite(fBand[0]) && Number.isFinite(fBand[1])
      ? `${samples
          .map(
            (n, i) =>
              `${i ? "L" : "M"}${x(n).toFixed(1)} ${clampY(amdahlAt(fBand[0], n)).toFixed(1)}`,
          )
          .join("")}${[...samples]
          .reverse()
          .map((n) => `L${x(n).toFixed(1)} ${clampY(amdahlAt(fBand[1], n)).toFixed(1)}`)
          .join("")}Z`
      : null;

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!onHoverN || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const n = Math.round(Math.min(maxN, Math.max(1, x.invert(px))));
    onHoverN(n);
  };

  const fn = focusN != null && focusN >= 1 && focusN <= maxN ? focusN : null;
  const tipX = fn != null ? x(fn) : 0;
  const tipLeft = tipX > W * 0.62;
  // beside the crosshair, but never past the chart's edge
  const tipOffset = Math.max(0, Math.min((tipLeft ? W - tipX : tipX) + 10, W - TIP_MAX_W - 2));

  return (
    <figure ref={boxRef} className={cn("relative", className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-pan-y select-none"
        role="img"
        aria-labelledby={`${id}-t`}
        onPointerMove={onMove}
        onPointerLeave={() => onHoverN?.(null)}
      >
        <title id={`${id}-t`}>{title}</title>
        {/* grid + y axis */}
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} className="stroke-grid" />
            <text
              x={M.left - 8}
              y={y(t)}
              dy="0.32em"
              textAnchor="end"
              className="num fill-muted-foreground font-mono text-[10.5px]"
            >
              {fmtTick(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text
            key={`x${t}`}
            x={x(t)}
            y={H - M.bottom + 18}
            textAnchor="middle"
            className="num fill-muted-foreground font-mono text-[10.5px]"
          >
            {t}
          </text>
        ))}
        <line x1={M.left} x2={W - M.right} y1={y(0)} y2={y(0)} className="stroke-axis" />
        <text
          x={(M.left + W - M.right) / 2}
          y={H - 6}
          textAnchor="middle"
          className="fill-muted-foreground text-[11px]"
        >
          workers (MPI ranks / cores)
        </text>

        {/* ideal */}
        <path
          d={path(ideal)}
          fill="none"
          className="stroke-muted-foreground"
          strokeWidth={1.5}
          strokeDasharray="4 5"
        />
        {/* Gustafson's law (same f, problem grows with n) */}
        {drawGustafson && (
          <path
            d={path(gustafson)}
            fill="none"
            className="stroke-series-3"
            strokeWidth={1.75}
            strokeDasharray="7 4"
            strokeLinecap="round"
          />
        )}
        {/* Amdahl band: the curve for every f in its interval */}
        {band && <path d={band} className="fill-series-1/15" stroke="none" />}
        {/* Amdahl model */}
        {f != null && (
          <path
            d={path(model)}
            fill="none"
            className="stroke-series-1"
            strokeWidth={2}
            strokeLinecap="round"
          />
        )}

        {/* crosshair */}
        {fn != null && (
          <g pointerEvents="none">
            <line
              x1={tipX}
              x2={tipX}
              y1={M.top}
              y2={H - M.bottom}
              className="stroke-foreground/30"
              strokeWidth={1}
            />
            {f != null && (
              <circle
                cx={tipX}
                cy={y(Math.min(model(fn), y.domain[1]))}
                r={4.5}
                className="fill-series-1 stroke-card"
                strokeWidth={2}
              />
            )}
          </g>
        )}

        {/* measured, with interval bars */}
        {measured.map((m, i) => {
          const hasBar =
            m.lo !== undefined &&
            m.hi !== undefined &&
            Number.isFinite(m.lo) &&
            Number.isFinite(m.hi);
          const cx = x(m.n);
          return (
            <g key={`${m.label}-${i}`}>
              {hasBar && Math.abs(clampY(m.lo!) - clampY(m.hi!)) > 0.5 && (
                <g className="stroke-series-2" strokeWidth={1.5} aria-hidden>
                  <line x1={cx} x2={cx} y1={clampY(m.lo!)} y2={clampY(m.hi!)} />
                  <line x1={cx - 4} x2={cx + 4} y1={clampY(m.lo!)} y2={clampY(m.lo!)} />
                  <line x1={cx - 4} x2={cx + 4} y1={clampY(m.hi!)} y2={clampY(m.hi!)} />
                </g>
              )}
              <Marker shape={m.shape} x={cx} y={y(m.value)} />
            </g>
          );
        })}
      </svg>

      {fn != null && (
        <div
          className={cn(
            "pointer-events-none absolute top-2 z-10 max-w-[13rem] min-w-40 rounded-lg border bg-popover/95 px-3 py-2 text-xs shadow-md backdrop-blur",
          )}
          style={tipLeft ? { right: tipOffset } : { left: tipOffset }}
          role="status"
          aria-live="polite"
        >
          <p className="font-mono text-[0.68rem] tracking-wider text-muted-foreground uppercase">
            {fn} worker{fn === 1 ? "" : "s"}
          </p>
          {f != null && (
            <p className="mt-1 flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-3 rounded bg-series-1" /> Amdahl
              </span>
              <span className="num font-mono">{fmt(model(fn))}</span>
            </p>
          )}
          {drawGustafson && (
            <p className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0 w-3 border-t-2 border-dashed border-series-3" />{" "}
                Gustafson
              </span>
              <span className="num font-mono">{fmt(gustafson(fn))}</span>
            </p>
          )}
          <p className="flex items-center justify-between gap-4 text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0 w-3 border-t border-dashed border-muted-foreground" />{" "}
              Ideal
            </span>
            <span className="num font-mono">{fmt(ideal(fn))}</span>
          </p>
          {measured
            .filter((m) => m.n === fn)
            .map((m) => (
              <div key={m.label}>
                <p className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5">
                    <MarkerIcon shape={m.shape} /> {m.label}
                  </span>
                  <span className="num font-mono">{fmt(m.value)}</span>
                </p>
                {m.lo !== undefined && m.hi !== undefined && (
                  <p className="pl-6 text-right text-[0.68rem] text-muted-foreground">
                    95% CI <span className="num font-mono">{fmt(m.lo)}</span> to{" "}
                    <span className="num font-mono">{fmt(m.hi)}</span>
                  </p>
                )}
              </div>
            ))}
        </div>
      )}
    </figure>
  );
}

export function ScalingLegend({
  showModel = true,
  showBand = false,
  showGustafson = false,
  showBars = false,
  measured,
}: {
  showModel?: boolean;
  /** The shaded interval around the Amdahl curve. */
  showBand?: boolean;
  showGustafson?: boolean;
  /** Measured points carry 95% interval bars. */
  showBars?: boolean;
  measured: ReadonlyArray<{ label: string; shape?: MarkerShape }>;
}) {
  return (
    <ul
      className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground"
      aria-label="Legend"
    >
      {measured.map((m) => (
        <li key={m.label} className="flex items-center gap-1.5">
          <MarkerIcon shape={m.shape} />
          {m.label}
          {showBars && <span className="text-muted-foreground">(bars: 95% CI)</span>}
        </li>
      ))}
      {showModel && (
        <li className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-5 rounded bg-series-1" aria-hidden /> Amdahl&apos;s
          law{showBand ? ", fitted" : ""}
        </li>
      )}
      {showBand && (
        <li className="flex items-center gap-2">
          <span className="inline-block h-3 w-5 rounded-sm bg-series-1/15" aria-hidden /> 95% CI of
          the fit
        </li>
      )}
      {showGustafson && (
        <li className="flex items-center gap-2">
          <span className="inline-block w-5 border-t-2 border-dashed border-series-3" aria-hidden />{" "}
          Gustafson&apos;s law (same f)
        </li>
      )}
      <li className="flex items-center gap-2">
        <span
          className="inline-block w-5 border-t-[1.5px] border-dashed border-muted-foreground"
          aria-hidden
        />{" "}
        Ideal (linear)
      </li>
    </ul>
  );
}
