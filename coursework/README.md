# Original submission (2023)

This folder is the COMP90024 Cluster and Cloud Computing Assignment 1 submission
(The University of Melbourne, 2023 Semester 1) by **Sunchuangyu Huang** and
**Wei Zhao**, moved here with `git mv` so its history is preserved. Apart from
a formatting pass (black and isort, no logic changes) and one security fix
(below), the code is what ran on Spartan.

## What is inside

| Path | What it is |
| --- | --- |
| `main.py` | MPI entry point: splits the Twitter file into byte ranges, runs the scanner on every rank, gathers the three partial tables on ranks 0/1/2 and writes `data/result/task*.csv` |
| `scripts/twitter_processor.py` | `twitter_processorV1` (regex line scanner with the 2/18/20 skip counts), the per-rank group-bys and the three task reductions (polars) |
| `scripts/sal_processor.py` | `process_salV1`: turns `sal.json` into the location → Greater Capital City dictionary |
| `scripts/utils.py` | `split_file_into_chunks`, `normalise_location`, logging helpers |
| `scripts/mpi.py` | `gather_task_tdf` (point-to-point gather) and `get_task_ranks` |
| `scripts/arg_parser.py`, `logger.py`, `email_sender.py` | CLI flags (`-t`, `-s`, `-e`), log file set-up, optional log email |
| `slurm/*.slurm`, `submit.sh` | The three benchmark jobs (1 node × 1 core, 1 node × 8 cores, 2 nodes × 4 cores) and the submit helper |
| `data/` | Symlinks to the course data on Spartan (`/data/projects/COMP90024/...`) plus empty `processed/` and `result/` folders. The data itself is course material and is not in this repository |
| `doc/` | Empty log and Slurm output folders used at run time |
| `requirements.txt`, `pyproject.toml` | The original Python environment (a conda freeze) and formatter settings |
| `_archive/README.original.md` | The README as submitted |
| `.env.example` | SMTP settings for the optional log email (see below) |

## Running it

On Spartan (as submitted):

```bash
module --force purge
module load mpi4py/3.0.2-timed-pingpong
source ~/virtualenv/python3.7.4/bin/activate
pip install numpy pandas 'polars[all]'
./submit.sh                       # submits the three slurm/*.slurm jobs
```

Anywhere with MPI, from this folder, with `bigTwitter.json` and `sal.json` (or the
smaller course files) placed in `data/`:

```bash
mpiexec -n 8 python main.py -t bigTwitter.json -s sal.json [-e rin|wei]
```

All paths are relative to the working directory (`data/<file>`, `data/result/`,
`doc/log/`), so run it from `coursework/`. The original pins are Python 3.7,
mpi4py 3.0, polars 0.16 and pandas 1.5.

Without MPI or the course data, `../scripts/run_original.py` re-enacts `main.py`
rank by rank on any file of the same shape, using these modules unchanged (see
the root README).

## Change since submission

`scripts/email_sender.py` used to contain a hard-coded SMTP account and
authorisation code. It now reads `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`,
`SMTP_PASSWORD`, `SMTP_FROM`, `LOG_EMAIL_RIN` and `LOG_EMAIL_WEI` from the
environment (copy `.env.example` to `.env`, which is git-ignored) and skips the
email when they are not set. The analysis is unaffected.

## A bug found while porting

When `split_file_into_chunks` cuts a few bytes into the indentation of an
`"_id"` line, the next rank's partial first line still matches the `_id`
regex while the previous rank reads that line in full, so both count the
tweet. The chance is about 1 in 500 per chunk boundary on bigTwitter.json.
The browser port reproduces it on purpose and a parity test pins it against
this code.

## Academic integrity

This is preserved for reference and as a record of our own work. The assignment
brief, the course datasets and the written report are not included. If you are
taking COMP90024, please do your own work.
