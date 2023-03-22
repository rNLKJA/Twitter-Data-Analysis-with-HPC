# /usr/bin/env python3
# pylint: disable=no-name-in-module
"""
Twitter Analyzer main program

Organization: the University of Melbourne
Author: Wei Zhao & Sunchuangyu Huang
Github: https://github.com/rNLKJA/2023-S1-COMP90024-A1/

"""
from mpi4py import MPI
import time

from scripts.arg_parser import parser
from scripts.logger import twitter_logger as logger
from scripts.sal_processor import *
from scripts.utils import obtain_args, split_file_into_chunks
from scripts.twitter_processor import twitter_processor

PATH = Path()

# load kwargs & required sal.parquet file
twitter_file = obtain_args(parser, logger)
sal_df = load_sal_parquet(PATH, logger)

# define MPI tools
comm = MPI.COMM_WORLD
rank, size = comm.Get_rank(), comm.Get_size()


start_time = time.time()

if __name__ == '__main__':

    chunk_start, chunk_end = split_file_into_chunks(twitter_file, size)

    tweet_df = twitter_processor(
        twitter_file, chunk_start[rank], chunk_end[rank])

    comm.Barrier()

    if rank == 0:
        tweet_dfs = [tweet_df]
        for np in range(1, size):
            tweet_dfs.append(comm.recv(source=np))
    else:
        comm.send(tweet_df, dest=0)

    if rank == 0:
        tdf = pd.concat(tweet_dfs)
        print(tdf)

    comm.Barrier()

    logger.info(f"Programming running seconds: {time.time() - start_time}")

    # end program after job complete
    exit()
