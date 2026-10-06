import { ImageResponse } from "next/og";

import { BENCHMARKS, DATASET } from "@/lib/data/original";
import { formatClock } from "@/lib/format";

export const alt = "Spartan Tweet Cruncher: COMP90024 MPI tweet analytics on Spartan HPC, revived";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const t1 = BENCHMARKS.find((b) => b.cores === 1)!;
const t8 = BENCHMARKS.find((b) => b.cores === 8 && b.nodes === 1)!;

export default function OpengraphImage() {
  const bars = Array.from({ length: 8 }, (_, i) => i);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "#0e1117",
        backgroundImage:
          "linear-gradient(rgba(63,211,234,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(63,211,234,0.06) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        color: "#eef2f6",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div
          style={{ fontSize: 24, letterSpacing: 4, color: "#3fd3ea", textTransform: "uppercase" }}
        >
          COMP90024 · University of Melbourne · 2023
        </div>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>
          Spartan Tweet Cruncher
        </div>
        <div style={{ fontSize: 32, color: "#a6b0bd", maxWidth: 900 }}>
          {`${(DATASET.tweets / 1e6).toFixed(2)}M tweets crunched with MPI on Spartan HPC: ${formatClock(t1.seconds)} on 1 core, ${formatClock(t8.seconds)} on 8.`}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
        {bars.map((i) => (
          <div
            key={i}
            style={{
              width: 90,
              height: i === 5 ? 120 : 70,
              borderRadius: 10,
              background: i === 5 ? "#f25bb0" : "#14a6bd",
              opacity: i === 5 ? 1 : 0.55 + (i % 3) * 0.15,
            }}
          />
        ))}
        <div style={{ marginLeft: "auto", fontSize: 28, color: "#a6b0bd" }}>
          {`${(t1.seconds / t8.seconds).toFixed(1)}× speedup`}
        </div>
      </div>
    </div>,
    size,
  );
}
