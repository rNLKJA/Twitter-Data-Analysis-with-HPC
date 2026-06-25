<div align="center">

# Cluster & Cloud Computing — Social Media Analysis

A parallelised application that mines a large Twitter data set on the University of Melbourne SPARTAN HPC facility, using MPI to scale across cores and nodes.

[![Python](https://img.shields.io/badge/Python-3.7.4-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![mpi4py](https://img.shields.io/badge/mpi4py-3.0.4-orange)](https://mpi4py.readthedocs.io/)
[![Polars](https://img.shields.io/badge/Polars-0.16-CD792C)](https://www.pola.rs/)
[![SLURM](https://img.shields.io/badge/SLURM-HPC-2C3E50)](https://slurm.schedmd.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

</div>

## Overview

This is Assignment 1 for COMP90024 Cluster & Cloud Computing (2023 Semester 1) at the University of Melbourne. The task is to build a parallelised application that runs on SPARTAN, the University's HPC facility, and processes a large Twitter data set alongside a file of suburbs, locations, and Greater Capital cities of Australia.

The application answers three questions:

- count the number of tweets made in each Greater Capital city of Australia,
- identify the Twitter accounts (users) that have made the most tweets, and
- identify the users that have tweeted from the most different Greater Capital cities.

More detail lives in the [project wiki](https://github.com/rNLKJA/2023-S1-COMP90024-A1/wiki), and the full write-up is on [Overleaf](https://www.overleaf.com/read/sdsczmmdxzvq).

## Highlights

- MPI parallelism (`mpi4py`) that splits the work across cores and nodes, with results gathered back to the root rank.
- Streams a multi-gigabyte newline-delimited JSON file rather than loading it into memory.
- Polars and pandas for fast aggregation of tweet counts by author and by Greater Capital city.
- SLURM job scripts for the three benchmark configurations (1 node 1 core, 1 node 8 cores, 2 nodes 4 cores).
- Demonstrates Amdahl's Law in practice: measured wall-clock time and CPU efficiency across configurations.

## Team

| Name              | Student ID | Email                               |
| ----------------- | :--------: | ----------------------------------- |
| Sunchuangyu Huang |  1118472   | sunchuangyuh@student.unimelb.edu.au |
| Wei Zhao          |  1118649   | weizhao1@student.unimelb.edu.au     |

## Tech Stack

| Area            | Tools                                     |
| --------------- | ----------------------------------------- |
| Language        | Python 3.7.4                              |
| Parallelism     | `mpi4py` 3.0.4 (MPI), SLURM job scheduler |
| Data processing | Polars, pandas, NumPy                     |
| Platform        | University of Melbourne SPARTAN HPC       |

## Repository Structure

```
.
├── data
│   ├── processed            # processed data
│   └── result               # output files
├── scripts                  # main program modules
├── slurm                    # SLURM job scripts (1n1c, 1n8c, 2n4c)
├── doc
│   ├── log                  # program log files
│   └── slurm
│       ├── stderr           # SLURM standard error
│       └── stdout           # SLURM standard output
├── main.py                  # entry point
├── submit.sh                # SLURM submission helper
├── requirements.txt         # Python dependencies
└── README.md
```

## Getting Started

### Local run

```bash
# main.py must be executable
mpiexec -n [NUM_PROCESSORS] python main.py -t [TWITTER_FILE] -s [SAL_FILE] -e [EMAIL_TARGET|OPTIONAL]
```

The optional email target accepts two values: `rin` or `wei`.

### Running on SPARTAN

```bash
# load the matching MPI module
module --force purge
module load mpi4py/3.0.2-timed-pingpong
source ~/virtualenv/python3.7.4/bin/activate

# submit all three benchmark jobs
./submit.sh
```

Use a virtualenv pinned to Python 3.7.4, since SPARTAN loads `mpi4py` 3.0.4 against that version.

```bash
# install dependencies
pip install numpy pandas 'polars[all]'   # or
pip install -r requirements.txt
```

## Results

The `bigTwitter.json` file contains 9,092,274 tweets written by 119,439 authors, dated from 2021-07-05 to 2022-12-31.

**Processing time on `bigTwitter.json`:**

|   Job    | Node | Core | Job Wall-Clock Time | CPU Efficiency |
| :------: | :--: | :--: | :-----------------: | :------------: |
| 46094405 |  1   |  1   |      00:11:01       |     98.34%     |
| 46094406 |  1   |  8   |      00:01:41       |     87.13%     |
| 46094407 |  2   |  4   |      00:01:41       |     87.75%     |

**Task 1 — top tweeters by number of tweets:**

| Rank | Author Id           | Number of Tweets Made |
| :--- | ------------------- | :-------------------: |
| #1   | 1498063511204760000 |        68,477         |
| #2   | 1089023364973210000 |        28,128         |
| #3   | 826332877457481000  |        27,718         |
| #4   | 1250331934242120000 |        25,350         |
| #5   | 1423662808311280000 |        21,034         |
| #6   | 1183144981252280000 |        20,765         |
| #7   | 1270672820792500000 |        20,503         |
| #8   | 820431428835885000  |        20,063         |
| #9   | 778785859030003000  |        19,403         |
| #10  | 1104295492433760000 |        18,781         |

**Task 2 — tweets made in each Greater Capital city** (rural locations such as `1rnsw` and `1rvic` are ignored):

| Greater Capital City | Number of Tweets Made |
| :------------------: | :-------------------: |
|        1gsyd         |       2,218,689       |
|        2gmel         |       2,284,909       |
|        3gbri         |        878,614        |
|        4gade         |        465,081        |
|        5gper         |        590,045        |
|        6ghob         |        91,112         |
|        7gdar         |        46,772         |
|        8acte         |        214,347        |
|        9oter         |          203          |

**Task 3 — tweeters active across the most Greater Capital cities** (ties broken by number of tweets):

| Rank | Author Id           | Number of Unique City Locations and #Tweets                                                    |
| :--: | :------------------ | :--------------------------------------------------------------------------------------------- |
|  #1  | 1429984556451389440 | 8 (#1920 tweets - #1879gmel, #13acte, #11gsyd, #7gper, #6gbri, #2gade, #1gdar, #1ghob)         |
|  #2  | 702290904460169216  | 8 (#1231 tweets - #336gsyd, #255gmel, #235gbri, #156gper, #127gade, #56acte, #45ghob, #21gdar) |
|  #3  | 17285408            | 8 (#1209 tweets - #1061gsyd, #60gmel, #40gbri, #23acte, #11ghob, #7gper, #4gdar, #3gade)       |
|  #4  | 87188071            | 8 (#407 tweets - #116gsyd, #86gmel, #68gbri, #52gper, #37acte, #28gade, #15ghob, #5gdar)       |
|  #5  | 774694926135222272  | 8 (#272 tweets - #38gmel, #37gbri, #37gsyd, #36ghob, #34acte, #34gper, #28gdar, #28gade)       |
|  #6  | 1361519083          | 8 (#266 tweets - #193gdar, #36gmel, #18gsyd, #9gade, #6acte, #2ghob, #1gbri, #1gper)           |
|  #7  | 502381727           | 8 (#250 tweets - #214gmel, #10acte, #8gbri, #8ghob, #4gade, #3gper, #2gsyd, #1gdar)            |
|  #8  | 921197448885886977  | 8 (#207 tweets - #56gmel, #49gsyd, #37gbri, #28gper, #24gade, #8acte, #4ghob, #1gdar)          |
|  #9  | 601712763           | 8 (#146 tweets - #44gsyd, #39gmel, #19gade, #14gper, #11gbri, #10acte, #8ghob, #1gdar)         |
| #10  | 2647302752          | 8 (#80 tweets - #32gbri, #16gmel, #13gsyd, #5ghob, #4gper, #4acte, #3gade, #3gdar)             |

## Conclusion

This project explores Amdahl's Law by using MPI to process a large JSON file. Parallelism can lift performance substantially, but it comes with trade-offs in CPU efficiency. Spreading work across multiple cores reduces wall-clock time, yet the benefit can shrink when scaling across multiple nodes, because of the extra time spent on MPI communication between nodes. Parallelism also suits small data sets poorly, where a single core can finish the job quickly on its own. When designing an MPI program for performance, the balance between CPU efficiency and overall speed is the thing to get right.

The full report is on [Overleaf](https://www.overleaf.com/read/sdsczmmdxzvq).

## Licence

Released under the [MIT License](./LICENSE).

---

<p align="right">2023 © Wei Zhao & Sunchuangyu Huang</p>
