# pylint: disable=import-error
# /usr/bin/env python3
# pylint: disable=no-name-in-module
"""
2023 S1 CCC Twitter Analyzer main program

Organization: the University of Melbourne
Author: Wei Zhao 1118649 & Sunchuangyu Huang 1118472
Github: https://github.com/rNLKJA/2023-S1-COMP90024-A1/

"""
import sys
import time
import os
from pathlib import Path

from mpi4py import MPI

sys.path.append("./scripts")

from scripts.arg_parser import parser
from scripts.logger import twitter_logger as logger
from scripts.sal_processor import process_salV1
from scripts.twitter_processor import *
from scripts.utils import *
from scripts.mpi import gather_task_tdf, get_task_ranks

os.environ["NUMEXPR_MAX_THREADS"] = "32"
PATH = Path()

log_system_information()

# load kwargs & required sal.csnv file
twitter_file_name = obtain_twitter_file_name(parser)
twitter_file = PATH / "data" / twitter_file_name

# process sal.json file and return a dict
sal_df = process_salV1(path=PATH, logger=logger)
sal_dict = dict(zip(sal_df["location"].to_list(), sal_df["gcc"].to_list()))

# define MPI tools, subtask ranks and size
comm = MPI.COMM_WORLD
rank, size = comm.Get_rank(), comm.Get_size()
task1_rank, task2_rank, task3_rank = get_task_ranks(size)

# define timer start
start_time = time.time()

if __name__ == "__main__":
    # return a list which specify the file bytes each process need to processed
    chunk_start, chunk_end = split_file_into_chunks(twitter_file, size)

    tdf = twitter_processorV1(
        twitter_file, chunk_start[rank], chunk_end[rank], sal_dict
    )

    logger.info(f"Rank {rank}: File Read Completed, cost: {time.time()- start_time}")

    # process twitter data based on three task requirements
    t1_tdf = count_number_of_tweets_by_author(tdf)
    t2_tdf = count_number_of_tweets_by_gcc(tdf)
    t3_tdf = count_author_tweets_from_most_different_gcc(tdf)

    # =================================== TASK 1 ===================================
    t1_tdfs = gather_task_tdf(rank, task1_rank, size, t1_tdf, comm)
    
    if rank == task1_rank: 
        return_twitter_counts_by_author_id(t1_tdfs, path=PATH)
    # =================================== TASK 2 ===================================
    t2_tdfs = gather_task_tdf(rank, task2_rank, size, t2_tdf, comm)

    if rank == task2_rank:
        t2_tdfs = combine_tdf(t2_tdfs).groupby("gcc").sum()
        return_gcc_with_tweets_count(t2_tdfs, save=True, path=PATH)
    # =================================== TASK 3 ===================================
    t3_tdfs = gather_task_tdf(rank, task3_rank, size, t3_tdf, comm)

    if rank == task3_rank:
        t3_tdfs = combine_tdf(t3_tdfs)
        generate_task_3_result(t3_tdfs, save=True, path=PATH)
    # ================================== END TASKS ==================================
    if rank == 0:
        end_process(start_time=start_time)

    sys.exit()
