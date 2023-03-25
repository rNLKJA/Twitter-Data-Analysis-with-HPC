# pylint: disable=import-error
# /usr/bin/env python3
# pylint: disable=no-name-in-module
"""
Twitter Analyzer main program

Organization: the University of Melbourne
Author: Wei Zhao & Sunchuangyu Huang
Github: https://github.com/rNLKJA/2023-S1-COMP90024-A1/

"""

# local testing purpose - remove before release
from scripts.twitter_processor import twitter_processor
from scripts.utils import obtain_args, split_file_into_chunks
from scripts.sal_processor import load_sal_csv
from scripts.logger import twitter_logger as logger
from scripts.arg_parser import parser

import time
from pathlib import Path
import pandas as pd

from mpi4py import MPI

import sys
import os
os.environ['NUMEXPR_MAX_THREADS'] = '32'


logger.info("PROGRAM START")

PATH = Path()

# load kwargs & required sal.csv file
twitter_file_name = obtain_args(parser, logger)
twitter_file = PATH / "./data" / twitter_file_name

sal_df = load_sal_csv(PATH, logger)

# define MPI tools
comm = MPI.COMM_WORLD
rank, size = comm.Get_rank(), comm.Get_size()

# define timer start
start_time = time.time()

if __name__ == '__main__':

    chunk_start, chunk_end = split_file_into_chunks(twitter_file, size)

    tweet_df = twitter_processor(
        twitter_file, chunk_start[rank], chunk_end[rank])

    logger.info("File read complete")
    comm.Barrier()

    if rank == 0:
        logger.info("Retrive dataframe list")
        tweet_dfs = [tweet_df]
        for np in range(1, size):
            tweet_dfs.append(comm.recv(source=np))
    else:
        comm.send(tweet_df, dest=0)

    comm.Barrier()
    if rank == 0:
        logger.info("Start merge dataframes")
        tdf = pd.concat(tweet_dfs)
        tdf.to_csv(f"./data/processed/{twitter_file_name.replace('.json', '')}.csv")
        logger.info(
            f"Twitter file {twitter_file_name.replace('json', '')} has a dataframe shape {tdf.shape}")

        end_time = time.time()
        logger.info(f'Programming running seconds: {end_time - start_time}')

    comm.Barrier()

    # end program after job complete
    sys.exit()
