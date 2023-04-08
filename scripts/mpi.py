"""
MPI utility functions
"""

from mpi4py import MPI
import polars as pl
from scripts.twitter_processor import *


def retrive_process_data(tdf: pl.DataFrame, root: int = 0) -> list:
    comm = MPI.COMM_WORLD
    rank = comm.Get_rank()

    result = comm.gather(tdf, root=root)

    if rank == root:
        tdfs_list = [pl.DataFrame()] * len(result)
        for i, tdf in enumerate(result):
            if not tdf.is_empty():
                tdfs_list[i] = tdf
        return tdfs_list
    return None


def gather_task_tdf(rank, task_rank, size, tdf, comm):
    if rank == task_rank:
        t2_tdfs = [tdf] + [
            comm.recv(source=nproc) for nproc in range(size) if nproc != task_rank
        ]
        return t2_tdfs
    else:
        comm.send(tdf, dest=task_rank)
        return None


def get_task_ranks(size):
    if size == 1:
        task1_rank = task2_rank = task3_rank = 0
    else:
        task1_rank, task2_rank, task3_rank = 0, 1, 2
    return task1_rank, task2_rank, task3_rank
