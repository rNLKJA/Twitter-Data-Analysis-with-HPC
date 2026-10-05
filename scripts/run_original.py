# /// script
# requires-python = ">=3.11,<3.12"
# dependencies = [
#   "polars==0.16.16",
#   "pandas==1.5.3",
#   "numpy==1.24.4",
#   "pyarrow==11.0.0",
# ]
# ///
"""
Run the ORIGINAL coursework pipeline on a Twitter JSON file without MPI and
dump everything the TypeScript port has to match (used for parity fixtures).

main.py is re-enacted rank by rank: the file is split with the original
`split_file_into_chunks`, every simulated rank calls `twitter_processorV1` on
its byte range and computes its three partial frames, and each task rank
receives the frames in exactly the order `gather_task_tdf` would (its own
first, then ranks 0..N-1). The original reduction functions then write
task1.csv / task2.csv / task3.csv / task3_1.csv, which are read back as JSON.

Usage:
  uv run scripts/run_original.py --twitter FILE --sal sal.json \
      --ranks 1 3 4 7 --out result.json [--records] [--dump-sal-dict path] [--record-errors]

With --record-errors, a rank count whose run raises (for example a
UnicodeDecodeError when a chunk starts inside a multi-byte character, or the
polars error Task 3 hits when no tweet is in a capital city) is stored as
{"error": "<Type>: <message>", "stage": "rank <r>" | "task <t>"} instead of
stopping the script.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path

from _original import build_sal_dict, load_original


def read_csv(path: Path) -> list[list[str]]:
    with open(path, newline="") as f:
        return list(csv.reader(f))


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--twitter", required=True, type=Path)
    ap.add_argument("--sal", required=True, type=Path)
    ap.add_argument("--ranks", nargs="+", type=int, default=[1])
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument(
        "--records",
        action="store_true",
        help="include per-tweet (tweet_id, author_id, location, gcc) rows for the 1-rank run",
    )
    ap.add_argument("--dump-sal-dict", type=Path, default=None)
    ap.add_argument(
        "--record-errors",
        action="store_true",
        help="record the exception a rank count raises instead of stopping",
    )
    args = ap.parse_args()

    twitter = args.twitter.resolve()
    out = args.out.resolve()
    dump_sal = args.dump_sal_dict.resolve() if args.dump_sal_dict else None

    orig = load_original(sal=args.sal, twitter=twitter)
    tp, utils, mpi = orig.twitter_processor, orig.utils, orig.mpi
    PATH = Path()
    twitter_file = PATH / "data" / "twitter.json"

    sal_dict = build_sal_dict(orig)
    if dump_sal:
        dump_sal.parent.mkdir(parents=True, exist_ok=True)
        dump_sal.write_text(json.dumps(sal_dict, ensure_ascii=False))

    def gather(task_rank: int, size: int, frames: list) -> list:
        # mpi.gather_task_tdf: own frame first, then comm.recv in rank order
        return [frames[task_rank]] + [
            frames[r] for r in range(size) if r != task_rank
        ]

    result: dict = {
        "input": {
            "file": twitter.name,
            "bytes": twitter.stat().st_size,
            "sha256": sha256(twitter),
        },
        "salDictSize": len(sal_dict),
        "runs": {},
    }

    def run_size(size: int, stage: list) -> dict:
        chunk_start, chunk_end = utils.split_file_into_chunks(twitter_file, size)
        task1_rank, task2_rank, task3_rank = mpi.get_task_ranks(size)

        t1, t2, t3, ranks = [], [], [], []
        records = None
        for rank in range(size):
            stage[0] = f"rank {rank}"
            tdf = tp.twitter_processorV1(
                twitter_file, chunk_start[rank], chunk_end[rank], sal_dict
            )
            ranks.append(
                {
                    "rank": rank,
                    "start": chunk_start[rank],
                    "end": chunk_end[rank],
                    "tweets": tdf.height,
                    "matched": int(tdf["gcc"].is_not_null().sum()),
                }
            )
            if size == 1 and args.records:
                records = [
                    [str(r[0]), str(r[1]), r[2], r[3]] for r in tdf.iter_rows()
                ]
            t1.append(tp.count_number_of_tweets_by_author(tdf))
            t2.append(tp.count_number_of_tweets_by_gcc(tdf))
            t3.append(tp.count_author_tweets_from_most_different_gcc(tdf))

        res_dir = PATH / "data" / "result"
        for f in res_dir.glob("*.csv"):
            f.unlink()

        # ---- TASK 1 (task1_rank) ----
        stage[0] = "task 1"
        tp.return_twitter_counts_by_author_id(gather(task1_rank, size, t1), path=PATH)
        # ---- TASK 2 (task2_rank) ----
        stage[0] = "task 2"
        t2_tdfs = tp.combine_tdf(gather(task2_rank, size, t2)).groupby("gcc").sum()
        tp.return_gcc_with_tweets_count(t2_tdfs, save=True, path=PATH)
        # ---- TASK 3 (task3_rank) ----
        stage[0] = "task 3"
        t3_tdfs = tp.combine_tdf(gather(task3_rank, size, t3))
        tp.generate_task_3_result(t3_tdfs, save=True, path=PATH)

        run = {
            "ranks": ranks,
            "task1": read_csv(res_dir / "task1.csv"),
            "task2": read_csv(res_dir / "task2.csv"),
            "task3": read_csv(res_dir / "task3.csv"),
            "task3_1": read_csv(res_dir / "task3_1.csv"),
        }
        if records is not None:
            run["records"] = records
        return run

    for size in args.ranks:
        if size == 2:
            # get_task_ranks(2) returns (0, 1, 2): Task 3 would be sent to a
            # rank that does not exist, so the original cannot run on 2 ranks.
            print("skipping 2 ranks: the original task-rank layout needs 1 or >= 3")
            continue
        stage = ["start"]
        try:
            result["runs"][str(size)] = run_size(size, stage)
        except Exception as exc:  # noqa: BLE001 - recorded verbatim for parity fixtures
            if not args.record_errors:
                raise
            result["runs"][str(size)] = {
                "error": f"{type(exc).__name__}: {exc}",
                "stage": stage[0],
            }

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
