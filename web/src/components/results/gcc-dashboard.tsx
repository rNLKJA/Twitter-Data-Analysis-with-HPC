"use client";

import { useId, useState } from "react";

import { useElementWidth } from "@/hooks/use-element-width";

import { formatCompact, formatInt, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface CityDatum {
  code: string;
  name: string;
  city: string;
  state: string;
  tweets: number;
  /** Projected position on the outline, or null for off-map territories. */
  x: number | null;
  y: number | null;
}

type Side = "e" | "w" | "s" | "n" | "sw" | "leader";
const LABEL_SIDE: Record<string, Side> = {
  "1gsyd": "e",
  "2gmel": "sw",
  "3gbri": "e",
  "4gade": "w",
  "5gper": "s",
  "6ghob": "e",
  "7gdar": "e",
  "8acte": "leader",
};
/** On narrow screens labels are relatively larger: keep Brisbane inside the frame and Hobart clear of Canberra. */
const LABEL_SIDE_NARROW: Record<string, Side> = { ...LABEL_SIDE, "3gbri": "w", "6ghob": "s" };

const R_MAX = 52;

function labelPlacement(side: Side, x: number, y: number, r: number, k: number) {
  const gap = 7 * k;
  switch (side) {
    case "e":
      return { tx: x + r + gap, ty: y - 2, anchor: "start" as const };
    case "w":
      return { tx: x - r - gap, ty: y - 2, anchor: "end" as const };
    case "s":
      return { tx: x, ty: y + r + 16 * k, anchor: "middle" as const };
    case "n":
      return { tx: x, ty: y - r - 20 * k, anchor: "middle" as const };
    case "sw":
      return { tx: x - r * 0.75 - gap, ty: y + r * 0.75 + 10 * k, anchor: "end" as const };
    case "leader":
      return { tx: x + 92, ty: y + 70 + 12 * k, anchor: "start" as const, leader: true };
  }
}

export function GccDashboard({
  width,
  height,
  outline,
  cities,
  total,
}: {
  width: number;
  height: number;
  outline: string;
  cities: CityDatum[];
  /** All tweets in bigTwitter.json, for the share column. */
  total: number;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [figRef, figWidth] = useElementWidth<HTMLElement>(640);
  const vbWidth = width + 150;
  // SVG units per CSS pixel, so labels render at a fixed on-screen size
  const unit = vbWidth / Math.max(240, figWidth - 24);
  const narrow = figWidth < 520;
  const cityFont = (narrow ? 11 : 13) * unit;
  const numFont = (narrow ? 10 : 11.5) * unit;
  const k = cityFont / 15;
  const titleId = useId();
  const descId = useId();
  const onMap = cities.filter((c) => c.x !== null && c.y !== null);
  const offMap = cities.filter((c) => c.x === null || c.y === null);
  const max = Math.max(...cities.map((c) => c.tweets));
  const radius = (v: number) => Math.max(3, R_MAX * Math.sqrt(v / max));
  const byValue = [...cities].sort((a, b) => b.tweets - a.tweets);
  // draw large bubbles first so small ones stay visible on top
  const drawOrder = [...onMap].sort((a, b) => b.tweets - a.tweets);
  const matched = cities.reduce((s, c) => s + c.tweets, 0);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <figure ref={figRef} className="panel relative overflow-hidden p-3 sm:p-4">
        <svg
          viewBox={`-30 -24 ${vbWidth} ${height + 40 + (narrow ? 64 : 0)}`}
          className="h-auto w-full"
          role="group"
          aria-labelledby={`${titleId} ${descId}`}
        >
          <title id={titleId}>Tweets per Greater Capital City</title>
          <desc id={descId}>
            Map of Australia with a circle on each capital city sized by the number of tweets
            geolocated there.
          </desc>
          <path
            d={outline}
            className="fill-muted stroke-axis"
            strokeWidth={unit}
            strokeLinejoin="round"
          />
          {drawOrder.map((c) => {
            const r = radius(c.tweets);
            const isActive = active === c.code;
            return (
              <circle
                key={`b-${c.code}`}
                cx={c.x!}
                cy={c.y!}
                r={r}
                className="fill-series-1 stroke-card transition-[fill-opacity] duration-150"
                fillOpacity={active && !isActive ? 0.14 : isActive ? 0.55 : 0.32}
                strokeWidth={2}
              />
            );
          })}
          {drawOrder.map((c) => (
            <circle
              key={`o-${c.code}`}
              cx={c.x!}
              cy={c.y!}
              r={radius(c.tweets)}
              fill="none"
              className="stroke-series-1"
              strokeWidth={active === c.code ? 2.5 : 1.5}
              strokeOpacity={active && active !== c.code ? 0.35 : 1}
            />
          ))}
          {onMap.map((c) => {
            const r = radius(c.tweets);
            const side = (narrow ? LABEL_SIDE_NARROW : LABEL_SIDE)[c.code] ?? "e";
            const p = labelPlacement(side, c.x!, c.y!, r, k);
            const dim = active && active !== c.code;
            return (
              <g key={`l-${c.code}`} opacity={dim ? 0.4 : 1} className="transition-opacity">
                {"leader" in p && p.leader && (
                  <polyline
                    points={`${c.x! + r * 0.7},${c.y! + r * 0.7} ${p.tx - 30},${p.ty - cityFont * 0.35} ${p.tx - 4},${p.ty - cityFont * 0.35}`}
                    fill="none"
                    className="stroke-muted-foreground"
                    strokeWidth={unit}
                  />
                )}
                <text
                  x={p.tx}
                  y={p.ty}
                  textAnchor={p.anchor}
                  className="fill-foreground font-heading font-semibold"
                  fontSize={cityFont}
                  stroke="var(--card)"
                  strokeWidth={3.5 * unit}
                  paintOrder="stroke"
                >
                  {c.city}
                </text>
                <text
                  x={p.tx}
                  y={p.ty + numFont * 1.3}
                  textAnchor={p.anchor}
                  className="num fill-muted-foreground font-mono"
                  fontSize={numFont}
                  stroke="var(--card)"
                  strokeWidth={3.5 * unit}
                  paintOrder="stroke"
                >
                  {formatCompact(c.tweets)}
                </text>
              </g>
            );
          })}
          {/* invisible, enlarged hit targets on top */}
          {onMap.map((c) => (
            <circle
              key={`h-${c.code}`}
              cx={c.x!}
              cy={c.y!}
              r={Math.max(14, radius(c.tweets))}
              fill="transparent"
              tabIndex={0}
              role="img"
              aria-label={`${c.name}: ${formatInt(c.tweets)} tweets`}
              className="cursor-pointer outline-none focus-visible:stroke-primary focus-visible:stroke-2"
              onMouseEnter={() => setActive(c.code)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(c.code)}
              onBlur={() => setActive(null)}
            />
          ))}
        </svg>
        <figcaption className="flex flex-wrap items-end justify-between gap-3 px-1 pt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <svg width="54" height="26" aria-hidden className="shrink-0">
              {[1, 0.25].map((f, i) => (
                <circle
                  key={f}
                  cx={i === 0 ? 14 : 40}
                  cy={13}
                  r={12 * Math.sqrt(f)}
                  className="fill-series-1 stroke-series-1"
                  fillOpacity={0.3}
                />
              ))}
            </svg>
            Circle area is proportional to tweet count.
          </span>
          {offMap.map((c) => (
            <span key={c.code}>
              Off map: {c.name}{" "}
              <span className="num font-mono text-foreground">{formatInt(c.tweets)}</span>
            </span>
          ))}
        </figcaption>
      </figure>

      <section className="panel p-4 sm:p-5" aria-labelledby="task2-table">
        <h3 id="task2-table" className="font-heading text-base font-semibold tracking-tight">
          Tweets per Greater Capital City
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatInt(matched)} tweets ({formatPct(matched / total)} of all) resolved to a capital
          city. Rural areas such as <code className="font-mono text-xs">1rnsw</code> are excluded,
          as in the original.
        </p>
        <table className="mt-4 w-full text-sm">
          <thead className="sr-only">
            <tr>
              <th scope="col">Greater Capital City</th>
              <th scope="col">Share of matched tweets</th>
              <th scope="col">Number of tweets</th>
            </tr>
          </thead>
          <tbody>
            {byValue.map((c) => {
              const isActive = active === c.code;
              return (
                <tr
                  key={c.code}
                  onMouseEnter={() => setActive(c.code)}
                  onMouseLeave={() => setActive(null)}
                  className={cn("transition-opacity", active && !isActive && "opacity-45")}
                >
                  <th scope="row" className="py-1.5 pr-3 text-left font-medium whitespace-nowrap">
                    {c.city}
                    <span className="ml-2 font-mono text-[0.7rem] font-normal text-muted-foreground">
                      {c.code}
                    </span>
                  </th>
                  <td className="w-full py-1.5 pr-3">
                    <div className="flex items-center gap-3">
                      <div className="hidden h-2.5 flex-1 sm:block" aria-hidden>
                        <div
                          className="h-full rounded-r-[4px] bg-series-1"
                          style={{ width: `${Math.max(0.4, (c.tweets / max) * 100)}%` }}
                        />
                      </div>
                      <span className="ml-auto w-12 text-right font-mono text-xs whitespace-nowrap text-muted-foreground">
                        {formatPct(c.tweets / matched)}
                      </span>
                    </div>
                  </td>
                  <td className="num py-1.5 text-right font-mono whitespace-nowrap">
                    {formatInt(c.tweets)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
