import { SUBJECT } from "./data/original";

export const SITE = {
  name: "Spartan Tweet Cruncher",
  short: "Tweet Cruncher",
  description:
    "COMP90024 Assignment 1 revived: an MPI pipeline that crunched 9.09 million geotagged tweets on the University of Melbourne's Spartan HPC, with its original results, a scaling lab and a browser re-enactment on Web Workers.",
  url: "https://comp90024-spartan-twitter.vercel.app",
  repo: SUBJECT.repo,
} as const;

/** Commit the documentation links point at (set at build time in next.config.ts). */
export const SOURCE_REF = process.env.NEXT_PUBLIC_SOURCE_REF || "main";

/** GitHub URL of a file in this repository at SOURCE_REF. */
export const sourceUrl = (path: string) => `${SITE.repo}/blob/${SOURCE_REF}/${path}`;

export interface NavItem {
  href: string;
  label: string;
  blurb: string;
}

export const NAV: readonly NavItem[] = [
  { href: "/results", label: "Results", blurb: "The three answers from the 2023 Spartan run" },
  { href: "/scaling", label: "Scaling", blurb: "Benchmarks, speedup and Amdahl's law" },
  { href: "/lab", label: "MPI lab", blurb: "Run the original algorithm on Web Workers" },
  {
    href: "/how-it-works",
    label: "How it works",
    blurb: "Chunks, the line scanner and the place matcher",
  },
  {
    href: "/methods",
    label: "Methods",
    blurb: "Provenance, evaluation design, limits and decision records",
  },
  { href: "/ask", label: "Ask AI", blurb: "Optional: question the results with your own key" },
];
