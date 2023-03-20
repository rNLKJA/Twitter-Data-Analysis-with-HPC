#/usr/bin/env python3
# pylint: disable=no-name-in-module
"""
Twitter Analyzer main program

Organization: the University of Melbourne
Author: Wei Zhao & Sunchuangyu Huang
Github: https://github.com/rNLKJA/2023-S1-COMP90024-A1/

"""
from mpi4py import MPI
from pathlib import Path

from scripts.argparser import parser
from scripts.logger import twitter_logger as logger
from scripts.sal_processor import *
from scripts.utils import *

PATH = Path() # define root path

# load kwargs & required sal.parquet file
twitter_file, chunk_size = obtain_args(parser, logger)
sal_df = load_sal_parquet(PATH, logger)

if __name__ == '__main__':
    
    logger.info("Initalizing parallelizing")
    comm = MPI.COMM_WORLD
    rank, size = comm.Get_rank(), comm.Get_size()

    logger.info(
        f"Start analyzer with No.CPU{size}, Twitter file: {twitter_file}, chunk size: {chunk_size}")
