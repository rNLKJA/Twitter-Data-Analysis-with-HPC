from mpi4py import MPI
import math

comm = MPI.COMM_WORLD

def mpi_parallelize(func):
    def wrapper(*args, **kwargs):
        lst = args[0]
        
        rank = comm.Get_rank()
        size = comm.Get_size()

        # Split the range of indices to process based on the number of processes
        chunk_size = math.ceil(len(lst) / size)
        chunks = [lst[i:i+chunk_size] for i in range(0, len(lst), chunk_size)]

        # Call the original function with the specified indices
        result = func(chunks[rank], **kwargs)

        comm.Barrier()
        # Gather the results from all processes into a single list
        results = comm.gather(result, root=0)

        # The root process combines the results and returns the final result
        if rank == 0:
            return sum(results)

    return wrapper

