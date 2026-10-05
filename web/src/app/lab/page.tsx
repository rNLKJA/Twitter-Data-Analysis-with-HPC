import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/common/page-header";
import { MpiLab } from "@/components/lab/mpi-lab";

export const metadata: Metadata = {
  title: "MPI lab",
  description:
    "Run the original COMP90024 tweet-crunching algorithm in your browser: a seeded synthetic bigTwitter.json is split into byte ranges and processed by one Web Worker per MPI rank, with live progress and measured speedup.",
};

export default function LabPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader
        eyebrow="MPI lab · runs entirely in your browser"
        title="Run the 2023 pipeline on your own cores"
      >
        <p>
          Each Web Worker plays one MPI rank. The file is cut into byte ranges with the original{" "}
          <code className="font-mono text-[0.9em]">split_file_into_chunks</code>, every rank runs
          the TypeScript port of <code className="font-mono text-[0.9em]">twitter_processorV1</code>{" "}
          over its share, and ranks 0, 1 and 2 reduce Tasks 1, 2 and 3, exactly as{" "}
          <code className="font-mono text-[0.9em]">main.py</code> did on Spartan. New here?{" "}
          <Link href="/how-it-works" className="link">
            See how it works
          </Link>
          .
        </p>
      </PageHeader>
      <MpiLab />
      <p className="mt-8 max-w-3xl text-xs text-muted-foreground">
        The port is checked against the original Python in the test suite: on the same input,
        per-tweet records, per-rank counts and all four result files match for 1, 3, 4 and 7 ranks.
        Timings here are wall-clock in your browser and include the page relaying partial tables
        between workers, which stands in for MPI&apos;s send and receive.
      </p>
    </div>
  );
}
