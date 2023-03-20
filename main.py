# pylint: disable=no-name-in-module
"""
Twitter Analyzer main program

Organization: the University of Melbourne
Author: Wei Zhao & Sunchuangyu Huang
Github: https://github.com/rNLKJA/2023-S1-COMP90024-A1/

"""
from mpi4py import MPI

from scripts.argparser import parser
from scripts.logger import twitter_logger as logger

if __name__ == '__main__':
    # obtain clt input
    args = parser.parse_args()
    twitter_file, chunk_size = args.twitter_file_name, args.chunk_size

    # initialize MPI
    comm = MPI.COMM_WORLD
    rank, size = comm.Get_rank(), comm.Get_size()

    logger.info(
        f"Start analyzer with No.CPU{size}, Twitter file: {twitter_file}, chunk size: {chunk_size}")
