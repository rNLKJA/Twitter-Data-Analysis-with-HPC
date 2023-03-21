#!/usr/bin/env python3
from mpi4py import MPI
import numpy as np
import ijson
from pathlib import Path
from dataclasses import dataclass
import pandas as pd

@dataclass
class json_handler:
    """
    JSON handler use to handle json input and obtain required information.
    """
    location_dict = {
        "Australian Capital Territory": "act",
        "New South Wales": "nsw",
        "Victoria": "vic",
        "Sydney": "syd",
        "Melbourne": "mel",
        "Hobart": "hob",
        "Brisbane": "bri",
        "Queensland": "qld",
        "Tasmania": "tas",
        
        " - ": " ",
        ", ": " "
    }
    
    @classmethod
    def location(self, string):
        location = string
        for key, value in self.location_dict.items():
            location = re.sub(key, value, location)
        
        # remove duplicate words
        location = re.sub(r'\b(\w+)\b\s+\b\1\b', r'\1', location)
            
        return location.lower().lstrip().rstrip()
    
    @classmethod
    def location_distance(text: str, target: str) -> str:
        score = textdistance.jaro_winkler(text, target)
        return score
    
@dataclass
class Twitter:
    _id: str = None
    author: str = None
    locat: str = None
        
    def __repr__(self):
        return f"{self._id} | {self.author} | {self.locat}"

FRIST_LINE, START = "item", "start_map"
TWITTER_ID = 'item._id'
AUTHOR_ID = "item.data.author_id"
LOCATION = "item.includes.places.item.full_name"
HAS_VALUE = "string"

def start_json_item(prefix: str, event: str) -> bool:
    return True if prefix == FRIST_LINE and event == START else False
    
def is_twitter_id(prefix: str, event: str, value: any) -> bool:
    return True if prefix == TWITTER_ID and event == HAS_VALUE and value is not None else False

def is_author_id(prefix: str, event: str, value: any) -> bool:
    return True if prefix == AUTHOR_ID and event == HAS_VALUE and value is not None else False

def is_location(prefix: str, event: str, value: any) -> bool:
    return True if prefix == LOCATION and event == HAS_VALUE and value is not None else False
    
if __name__ == "__main__":
    comm = MPI.COMM_WORLD
    rank = comm.Get_rank()
    size = comm.Get_size()

    file_path = Path('./data/twitter-data-small.json')
    file_size = file_path.stat().st_size # return a file size in kb
    chunk_size = file_size // size

    comm.Barrier()

    with open(file_path, 'rb') as f:

        chunk_size = 735400
        not_valid_start = True

        while not_valid_start:
            f.seek(chunk_size)
            parser = ijson.parse(f)
            try:
                for prefix, event, value in parser:
                    if prefix == FRIST_LINE:
                        not_valid_start = False
                    break
                break
            except:
                chunk_size -= 1
            
            print(chunk_size)
    
    # start_byte = rank * chunk_size
#     print(start_byte)
#     with open(file_path, 'r', encoding='utf-8') as f:
#         f.seek(start_byte)

#         parser = ijson.parse(f, multiple_values=True)
#         current_chunk = []
        
#         for prefix, event, value in parser:
#             try:
#                 print(rank, prefix, event, value)
#             except:
#                 continue
            
#             break
#             if start_json_item(prefix, event):
#                 current_chunk.append(Twitter())

#             elif is_twitter_id(prefix, event, value):
#                 current_chunk[-1]._id = np.int64(value)

#             elif is_author_id(prefix, event, value):
#                 current_chunk[-1].author = np.int64(value)

#             elif is_location(prefix, event, value):
#                 current_chunk[-1].locat = json_handler.location(value)

#         jdf = pd.DataFrame([item.__dict__ for item in current_chunk])
        
    
#     comm.Barrier()
    
#     jdfs = comm.gather(jdf, root=0)

#     print(jdfs)



# n = 1000
# chunk_size = n // size

# # Calculate the starting and ending indices for each process
# start_idx = rank * chunk_size
# end_idx = (rank + 1) * chunk_size if rank < size - 1 else n

# # Generate the list of numbers from 1 to 1000
# lst = list(range(1, n+1))

# # Calculate the sum of each process's chunk of the list
# local_sum = sum(lst[start_idx:end_idx])

# # Reduce the local sums to obtain the global sum
# global_sum = comm.allreduce(local_sum, op=MPI.SUM)

# # Print the global sum
# if rank == 0:
#     print("The sum of the numbers from 1 to 1000 is:", global_sum)