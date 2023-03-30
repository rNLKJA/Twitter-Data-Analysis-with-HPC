# pylint: disable=import-error
# /usr/bin/env python3
# pylint: disable=no-name-in-module
"""
Twitter Analyzer main program

Organization: the University of Melbourne
Author: Wei Zhao & Sunchuangyu Huang
Github: https://github.com/rNLKJA/2023-S1-COMP90024-A1/

"""

from scripts.twitter_processor import twitter_processor, task1, task2, task3
from scripts.utils import obtain_twitter_file_name, split_file_into_chunks, normalise_location, is_state_location, obtain_email_target
from scripts.sal_processor import load_sal_csv, process_salV1
from scripts.logger import twitter_logger as logger
from scripts.arg_parser import parser
from scripts.email_sender import send_log
import time
from pathlib import Path
import pandas as pd

from mpi4py import MPI

import sys
import os
os.environ['NUMEXPR_MAX_THREADS'] = '32'

logger.info("PROGRAM START")

# define constants
PATH = Path()

# load kwargs & required sal.csv file
twitter_file_name = obtain_twitter_file_name(parser)
twitter_file = PATH / "data" / twitter_file_name

sal_df = process_salV1(path=PATH, logger=logger)

# define MPI tools
comm = MPI.COMM_WORLD
rank, size = comm.Get_rank(), comm.Get_size()

if rank == 0:
    logger.info(f"Current running on {size} nodes\n")
    logger.info(f"Target file: {twitter_file_name}\n")

comm.Barrier()

# define timer start
start_time = time.time()

if __name__ == '__main__':
    # return a list which specify the file bytes each process need to processed
    chunk_start, chunk_end = split_file_into_chunks(twitter_file, size)
    # logger.info(f"Process chunk: {chunk_start[rank]} - {chunk_end[rank]}\n")
    
    comm.Barrier()
    
    tweet_df = twitter_processor(
        twitter_file, chunk_start[rank], chunk_end[rank])
    tweet_df = pd.merge(tweet_df, sal_df, left_on='location', right_on='location')
    
    logger.info("File read complete")
    comm.Barrier()
    
    # =================================== TASK 1 ===================================
    task1_df = task1(tweet_df)
    if rank == 0:
        task1_dfs = [task1_df]
        for nproc in range(1, size):
            task1_dfs.append(comm.recv(source=nproc))
    else:
        comm.send(task1_df, dest=0)
    
    comm.Barrier()
    
    if rank == 0:
        t1rdf = pd.concat(task1_dfs, axis=0, ignore_index=True)
        t1rdf = t1rdf.groupby('gcc').sum()\
                     .reset_index()\
                     .sort_values(by='gcc', ascending=True)
        t1rdf.to_csv(PATH / 'data/result' / f"task1-{twitter_file_name.replace('json', '')}.csv", 
                     index=False)
    
    comm.Barrier()
    # =================================== TASK 2 ===================================
    task2_df = task2(tweet_df)
    if rank == 0:
        task2_dfs = [task2_df]
        for np in range(1, size):
            task2_dfs.append(comm.recv(source=np))
    else:
        comm.send(task2_df, dest=0)
    
    comm.Barrier()
    
    if rank == 0:
        t2rdf = pd.concat(task2_dfs, axis=0, ignore_index=True)
        t2rdf = t2rdf.groupby('author').sum()\
                     .reset_index()\
                     .sort_values(by='_id', ascending=False)\
                     .head(10)
        t2rdf.to_csv(PATH / 'data/result' / f"task2-{twitter_file_name.replace('json', '')}.csv", 
                     index=False)
        
    comm.Barrier()
    # =================================== TASK 3 ===================================
    task3_df = task3(tweet_df)
    if rank == 0:
        task3_dfs = [task3_df]
        for np in range(1, size):
            task3_dfs.append(comm.recv(source=np))
    else:
        comm.send(task3_df, dest=0)
    
    comm.Barrier()
    
    if rank == 0:
        t3rdf = pd.concat(task3_dfs, axis=0, ignore_index=True)
        t3rdf = t3rdf.groupby('author').sum()\
                     .reset_index()\
                     .sort_values(by='gcc', ascending=False)\
                     .head(10)
                     
        t3rdf.to_csv(PATH / 'data/result' / f"task3-{twitter_file_name.replace('json', '')}.csv", 
                     index=False)
        
    comm.Barrier()
    # ================================== END TASKS ==================================
    if rank == 0:
        logger.info(f"ALL TASKS COMLETE")
        end_time = time.time()
        logger.info(f'Programming running seconds: {end_time - start_time}')
    
    comm.Barrier()
    if rank == 0 and obtain_email_target(parser):
        email_target = obtain_email_target(parser)
        send_log(target=email_target)
        
    comm.Barrier()

