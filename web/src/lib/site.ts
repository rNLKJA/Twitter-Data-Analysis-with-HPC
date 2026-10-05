import { SUBJECT } from "./data/original";

export const SITE = {
  name: "Spartan Tweet Cruncher",
  short: "Tweet Cruncher",
  description:
    "COMP90024 Assignment 1 revived: an MPI pipeline that crunched 9.09 million geotagged tweets on the University of Melbourne's Spartan HPC, with its original results, a scaling lab and a browser re-enactment on Web Workers.",
  url: "https://comp90024-spartan-twitter.vercel.app",
  repo: SUBJECT.repo,
} as const;

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
];
