# pylint: disable=import-error
# /usr/bin/env python3
# pylint: disable=no-name-in-module
"""
Twitter Analyzer main program

Organization: the University of Melbourne
Author: Wei Zhao & Sunchuangyu Huang
Github: https://github.com/rNLKJA/2023-S1-COMP90024-A1/

"""

from scripts.twitter_processor import twitter_processor
from scripts.utils import obtain_twitter_file_name, split_file_into_chunks, obtain_email_target
from scripts.sal_processor import process_salV1
from scripts.logger import twitter_logger as logger
from scripts.arg_parser import parser
from scripts.email_sender import send_log
import time
from pathlib import Path
import pandas as pd
import numpy as np

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
    tweet_df = pd.merge(
        tweet_df, sal_df, left_on='location', right_on='location')

    logger.info("File read complete")
    comm.Barrier()

    # defined a merged dataframe
    if rank == 0:
        tweet_dfs = [tweet_df]
        for nproc in range(1, size):
            tweet_dfs.append(comm.recv(source=nproc))
    else:
        comm.send(tweet_df, dest=0)

    # =================================== TASK 1 ===================================

    if rank == 0 if size > 1 else 1:
        tweet_rdf1 = pd.concat(tweet_dfs, axis=0, ignore_index=True)[
            ['author', '_id']].groupby('author').count().reset_index()

        tweet_rdf1['rank'] = tweet_rdf1._id.rank(method="max", ascending=False)

        tweet_rdf1.columns = ['Author Id', 'Number of Tweets Made', 'Rank']

        tweet_rdf1 = tweet_rdf1[tweet_rdf1['Rank'] < 11].sort_values(
            by=['Rank', "Author Id"], ascending=True)
        tweet_rdf1[['Rank', 'Author Id', 'Number of Tweets Made']].to_csv(
            f'./data/result/task1-{twitter_file_name}.csv', index=False)

    # =================================== TASK 2 ===================================
    if rank == 0 if size > 1 else 2:
        tweet_rdf0 = pd.concat(tweet_dfs, axis=0, ignore_index=True)
        tweet_rdf2 = tweet_rdf0[~tweet_rdf0['gcc'].str.contains(
            r"\dr[a-z]{3}")][['gcc', '_id']].groupby('gcc').count().reset_index()

        tweet_rdf2.columns = ['Greater Capital City', 'Number of Tweets Made']

        tweet_rdf2.to_csv(
            f"./data/result/task2-{twitter_file_name}.csv", index=False)

    # =================================== TASK 3 ===================================
    if rank == 0 if size > 1 else 3:
        tweet_rdf0 = pd.concat(tweet_dfs, axis=0, ignore_index=True)
        tweet_rdf3 = tweet_rdf0[~tweet_rdf0['gcc'].str.contains(
            r"\dr[a-z]{3}")]

        tweet_rdf4 = tweet_rdf3[['author', 'gcc']].groupby(
            'author').nunique('gcc').reset_index()
        tweet_rdf5 = tweet_rdf3[['author', '_id']].groupby(
            'author').count().reset_index()

        tweet_rdf6 = pd.merge(
            left=tweet_rdf4, right=tweet_rdf5, on='author', how='inner')
        tweet_rdf6.columns = ['author', 'ugcc', 'ttc']

        tweet_rdf6.sort_values(by=['ugcc', 'ttc', 'author'], ascending=[
                               False, False, True], inplace=True)
        tweet_rdf6.reset_index(drop=True, inplace=True)
        tweet_rdf6 = tweet_rdf6.loc[0:9]
        tweet_rdf6['r'] = np.arange(1, 11, 1)

        def combine_gcc_twitter_count(x):
            count = {}
            for _, row in x.iterrows():
                if row['gcc'] in count:
                    count[row['gcc']] += row['_id']
                else:
                    count[row['gcc']] = row['_id']
            return " ,".join([f"#{str(v)}{k[1:]}" for k, v in count.items()])

        tweet_rdf7 = tweet_rdf3[['author', 'gcc', '_id']
                                ][tweet_rdf3.author.isin(tweet_rdf6['author'])]
        tweet_rdf7 = tweet_rdf7.groupby(
            ['author', 'gcc']).count().reset_index()
        tweet_rdf8 = tweet_rdf7.groupby('author').apply(
            combine_gcc_twitter_count).reset_index(name='ngt')

        tweet_rdf9 = pd.merge(
            left=tweet_rdf6, right=tweet_rdf8, on='author', how='inner')
        tweet_rdf9['rngt'] = tweet_rdf9.agg(
            lambda x: f"{x.ugcc} (#{x.ttc} - {x.ngt})", axis=1)
        tweet_rdf9 = tweet_rdf9[['r', 'author', 'rngt']]
        tweet_rdf9.columns = ['Rank', 'Author Id',
                              'Number of Unique City Locations and #Tweets']
        tweet_rdf9.to_csv(
            f"./data/result/task3-{twitter_file_name}.csv", index=False)

    comm.Barrier()
    # ================================== END TASKS ==================================
    if rank == 0:
        logger.info(f"ALL TASKS COMLETE")
        end_time = time.time()
        logger.info(f'Programming running seconds: {end_time - start_time}')

        email_target = obtain_email_target(parser)
        send_log(target=email_target)

    comm.Barrier()

    sys.exit()
