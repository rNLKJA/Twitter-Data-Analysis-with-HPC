# DR-001: Split the file by byte ranges, not by lines

- **Decision:** give each MPI rank an equal byte range of `bigTwitter.json` (`ceil(file_size / ranks)` bytes), let it seek straight to its offset and scan lines from there, and never count or index lines before the parallel work starts.
- **Status:** accepted in April 2023 for the submission. Written up in October 2026 from the code, the Slurm logs and what the TypeScript port revealed, so the reasoning below is reconstructed rather than quoted from 2023 notes.
- **Supersedes:** nothing.

## Context

The input was one pretty-printed JSON file of 18,735,307,060 bytes holding 9,092,274 tweets, about 2,061 bytes and several dozen lines per tweet. It could not be loaded into memory on one core, and parsing it as JSON would have been slow and hard to share between ranks. The assignment required runs on 1 node × 1 core, 1 node × 8 cores and 2 nodes × 4 cores, and asked us to explain the timings, so anything done before the ranks could start in parallel would show up directly as serial time.

## Decision

`split_file_into_chunks` computes `chunk_size = ceil(file_size / size)` and hands rank _r_ the range `[r × chunk_size, (r + 1) × chunk_size)`. Each rank opens the file, seeks to its start, and runs the line scanner (`twitter_processorV1`) until it has passed its end and finished the tweet it was in. The ranks never exchange raw data; they only exchange count tables at the end (see [DR-002](DR-002-gather-strategy.md)).

## Options considered

1. **Line-based split.** Count the lines first, then give each rank the same number of lines. The shares are exact, but someone has to read all 18.7 GB once before any rank can start, and each rank must then skip to its first line. Amdahl's law charges that whole pass to the serial fraction.
2. **Rank 0 reads and scatters.** One reader sends batches of lines or records to the other ranks. Simple to get right at the boundaries, but rank 0's read speed caps the whole job, and on 2 nodes × 4 cores half the file would cross the network.
3. **Pre-split files on disk.** `split` the file into per-rank pieces at record boundaries before submitting the job. Clean boundaries, but it needs a second copy of 18.7 GB on shared storage and a fresh split for every layout.
4. **Byte ranges with boundary handling in the scanner** (chosen). Planning is a single division, each rank reads only its own share, and no tweet data moves between ranks.

## Why

The work is dominated by reading and matching lines, and every option except byte ranges adds a serial step in front of it or moves data between ranks. Byte ranges make the planning cost constant and keep every rank's I/O local to its own share of the file.

## What happened

- The final jobs took 11:01 on one core and 1:41 on eight, a 6.54× speedup, and 2 nodes × 4 cores matched 1 node × 8 cores to the second. That pattern fits a design that moves no raw data between ranks, although with one run per layout and whole-second timing it cannot rule out small differences.
- Porting the scanner in 2026 found two ways the boundaries go wrong, both still present in the 2023 code:
  - If a cut lands inside the four spaces of indentation before `"_id"`, the next rank's partial first line still matches the `_id` pattern while the previous rank reads the same line in full, so **both ranks count the tweet**. Four bad positions in about 2,061 bytes per tweet is roughly 1 in 515 per boundary; an 8-rank job has 7 boundaries, so about a 1.4% chance per run. The course data is no longer available, so I cannot tell whether either 8-core run in 2023 was affected.
  - If a cut lands inside a multi-byte UTF-8 character, the strict `line.decode()` raises `UnicodeDecodeError` and the rank fails. The 2023 jobs completed, so this did not happen there, but it would on other layouts.
- The port keeps both behaviours on purpose, and parity tests pin them: on a 400-tweet synthetic file, 27 and 39 ranks double-count one tweet, and 17 and 29 ranks crash on a non-ASCII variant, exactly as the original Python does.

## What I'd change

- Snap every start offset forward to the next record boundary (the next line that opens a tweet document) before scanning, and let the previous rank finish the record it is in. That removes both failure modes without giving up byte ranges.
- Decode only after snapping, or decode with replacement characters, so a cut can never land inside a character.
- Add a property test that, for many random rank counts, the per-rank tweet counts sum to the 1-rank count.
- Replace the fixed skip counts (2, 18 and 20 lines) with a scan for the three keys, so the scanner does not depend on the exact line layout of the input.
