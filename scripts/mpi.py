"""
MPI utility functions
"""

from mpi4py import MPI
import polars as pl

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

