# pylint: disable=import-error
# /usr/bin/env python3
# pylint: disable=no-name-in-module
"""
Twitter Analyzer main program

Organization: the University of Melbourne
Author: Wei Zhao & Sunchuangyu Huang
Github: https://github.com/rNLKJA/2023-S1-COMP90024-A1/

"""

from scripts.twitter_processor import *
from scripts.utils import *
from scripts.sal_processor import process_salV1
from scripts.logger import twitter_logger as logger
from scripts.arg_parser import parser
from scripts.email_sender import send_log
import time
from pathlib import Path
import pandas as pd
import numpy as np
import polars as pl

from mpi4py import MPI

import sys
import os

os.environ["NUMEXPR_MAX_THREADS"] = "32"

log_system_information()

logger.info("PROGRAM START")

# define constants
PATH = Path()

# load kwargs & required sal.csnv file
twitter_file_name = obtain_twitter_file_name(parser)
twitter_file = PATH / "data" / twitter_file_name

sal_df = process_salV1(path=PATH, logger=logger)
sal_dict = dict(zip(sal_df["location"].to_list(), sal_df["gcc"].to_list()))

# define MPI tools
comm = MPI.COMM_WORLD
rank, size = comm.Get_rank(), comm.Get_size()

log_current_information(twitter_file_name, size, rank)

task1_rank = 0 if size == 1 else 0
task2_rank = 0 if size == 1 else 1
task3_rank = 0 if size == 1 else 2

# define timer start
start_time = time.time()

if __name__ == "__main__":
    # return a list which specify the file bytes each process need to processed
    chunk_start, chunk_end = split_file_into_chunks(twitter_file, size)

    tdf = twitter_processorV1(twitter_file, chunk_start[rank], chunk_end[rank], sal_dict)
    
    logger.info(f'Rank {rank}: File Read Completed, cost: {time.time()
- start_time}')

    t1_tdf = count_number_of_tweets_by_author(tdf)
    t2_tdf = count_number_of_tweets_by_gcc(tdf)
    t3_tdf = return_author_tweets_from_most_different_gcc(tdf)

    # =================================== TASK 1 ===================================

    if rank == task1_rank:
        t1_tdfs = [t1_tdf]
        for nproc in [i for i in range(size) if i != task1_rank]:
            t1_tdfs.append(comm.recv(source=nproc))
    else:
        comm.send(t1_tdf, dest=task1_rank)

    if rank == task1_rank:
        t1_tdfs = combine_tdf(t1_tdfs).groupby("author_id").sum()
        t1_tdfs = calculate_rank(tdf=t1_tdfs, method="min", column="tweet_count")
        return_author_with_most_tweets(t1_tdfs, top=10, save=True, path=PATH)

    # =================================== TASK 2 ===================================
    if rank == task2_rank:
        t2_tdfs = [t2_tdf]
        for nproc in [i for i in range(size) if i != task2_rank]:
            t2_tdfs.append(comm.recv(source=nproc))
    else:
        comm.send(t2_tdf, dest=task2_rank)

    if rank == task2_rank:
        t2_tdfs = combine_tdf(t2_tdfs).groupby("gcc").sum()
        return_gcc_with_tweets_count(t2_tdfs, save=True, path=PATH)

    # =================================== TASK 3 ===================================
    if rank == task3_rank:
        t3_tdfs = [t3_tdf]
        for nproc in [i for i in range(size) if i != task3_rank]:
            t3_tdfs.append(comm.recv(source=nproc))
    else:
        comm.send(t3_tdf, dest=task3_rank)

    if rank == task3_rank:
        t3_tdfs = combine_tdf(t3_tdfs)
        generate_task_3_result(t3_tdfs, save=True, path=PATH)

    # ================================== END TASKS ==================================
    if rank == 0:
        logger.info(f"ALL TASKS COMLETE")
        end_time = time.time()
        logger.info(f"Programming running seconds: {end_time - start_time}")

        email_target = obtain_email_target(parser)
        send_log(target=email_target)

    sys.exit()
