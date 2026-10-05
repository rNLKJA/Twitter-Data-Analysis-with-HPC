# DR-002: Pre-aggregate on every rank, then send the tables to three task ranks

- **Decision:** each rank reduces its own tweets to three small count tables before any communication (per author, per capital city, per author and city), then sends each table point to point to the rank that owns that task: rank 0 for Task 1, rank 1 for Task 2, rank 2 for Task 3. With one rank, rank 0 does all three.
- **Status:** accepted in April 2023. The earlier revision benchmarked on 2 April already sent to three task ranks; the final version moved the pattern into `gather_task_tdf`. Written up in October 2026.
- **Supersedes:** nothing.

## Context

The three questions only need counts. After scanning, a rank's partial tables are small next to its share of the file: at most one row per author for Task 1 (119,439 authors in the whole dataset), at most nine rows for Task 2, and one row per author and city pair for Task 3. mpi4py sends Python objects by pickling them, here polars DataFrames, so message size and the number of messages both matter.

## Decision

`main.py` calls `gather_task_tdf` three times, once per task, on every rank. The task rank keeps its own table and then calls `comm.recv` from every other rank in rank order; every other rank calls `comm.send` to the task rank. The task rank then merges the tables, ranks or sorts them, and writes its CSV.

## Options considered

1. **Gather the parsed rows to rank 0.** Send every (tweet, author, place) row to one rank and compute everything there. About nine million rows would be pickled and sent, and rank 0 would do all the work.
2. **One collective to rank 0.** `comm.gather` the three partial tables to rank 0, which then reduces all three tasks. One call per task and simple, but every reduction runs on one rank. (The repository still contains an unused helper, `retrive_process_data`, written this way.)
3. **Point to point to three task ranks** (chosen). Spreads the three reductions over three ranks, with the intent that they run at the same time.
4. **`comm.reduce` with a custom merge operation.** A tree-shaped reduction with fewer messages per rank, but it needs a custom MPI operation that merges DataFrames, and Task 1's final ranking needs the whole merged table on one rank anyway.

## Why

Pre-aggregating is what makes the communication cheap: only counts cross the network, never tweets. Splitting the three reductions over three ranks looked like free parallelism for the final step.

## What happened

- 2 nodes × 4 cores ran in 1:41, the same as 1 node × 8 cores. With one run per layout and whole-second timing, the honest reading is that inter-node communication was too small to detect, not that it cost nothing.
- Re-reading the code in 2026 showed that the three reductions do **not** overlap as intended. Every rank enters the Task 1, Task 2 and Task 3 gathers in that order, and a task rank receives from rank 0 first. Rank 0 only sends its Task 2 table after it has finished reducing Task 1, and rank 1 only sends its Task 3 table after reducing Task 2. So the Task 2 reduction waits for Task 1's, and Task 3's waits for both: the final step is effectively serial. The reductions work on small tables, so the cost is probably small next to the 101 s run, but the 2023 jobs never timed the phases separately, so I cannot put a number on it.
- The browser lab does not reproduce this. The page relays each rank's tables to the task workers only after every rank has finished scanning, and the three reductions then genuinely run at the same time on three workers. The lab is therefore slightly kinder to the design than Spartan was. The relay order within each task does follow `gather_task_tdf` (the task rank's own table first, then the others in rank order).

## What I'd change

- Post all three sends as non-blocking `isend` calls straight after the scan, before reducing anything, so no task waits for another; or receive with `MPI.ANY_SOURCE` so a slow rank does not hold up the rest.
- Time each phase on each rank (scan, send, receive, reduce, write) and log it, so the serial part can be measured instead of inferred from Amdahl's law.
- Use `comm.reduce` for Task 2, which is a sum over nine keys and suits a tree reduction.
