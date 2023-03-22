# /usr/bin/env python3
# pylint: disable=no-name-in-module
"""
Twitter Analyzer main program

Organization: the University of Melbourne
Author: Wei Zhao & Sunchuangyu Huang
Github: https://github.com/rNLKJA/2023-S1-COMP90024-A1/

"""
from mpi4py import MPI

from scripts.arg_parser import parser
from scripts.logger import twitter_logger as log
from scripts.sal_processor import *
from scripts.utils import obtain_args, split_file_into_chunks
from scripts.twitter_processor import twitter_processor

PATH = Path()

# load kwargs & required sal.parquet file
twitter_file = obtain_args(parser, log)
sal_df = load_sal_parquet(PATH, log)

# define MPI tools
comm = MPI.COMM_WORLD
rank, size = comm.Get_rank(), comm.Get_size()

if __name__ == '__main__':

    chunk_start, chunk_end = split_file_into_chunks(twitter_file, size)
    print(chunk_start, chunk_end)

    tweet_df = twitter_processor(
        twitter_file, chunk_start[rank], chunk_end[rank])

    if rank == 0:
        tweet_dfs = comm.gather(tweet_df, root=0)
        print(tweet_dfs)
