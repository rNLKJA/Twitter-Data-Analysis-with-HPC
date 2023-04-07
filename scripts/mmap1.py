import mmap
import re
import os
from pathlib import Path
from typing import List
import math

def split_into_bins(start_byte, end_byte, n_bins):
    if n_bins <= 0:
        raise ValueError("n_bins must be a positive integer")

    bin_size = (end_byte - start_byte) // n_bins
    byte_ranges = []

    for i in range(n_bins):
        bin_start = start_byte + i * bin_size
        bin_end = start_byte + (i + 1) * bin_size - 1

        # Include the remaining bytes in the last bin
        if i == n_bins - 1:
            bin_end = end_byte

        byte_ranges.append((bin_start, bin_end))

    return byte_ranges

file = Path("../data/smallTwitter.json")
size = os.stat(file).st_size

TWEETS_ID = re.compile(rb'"_id":\s*"([^"]+)"')
AUTHOR_ID = re.compile(rb'"author_id":\s*"([^"]+)"')
LOCATION_ID = re.compile(rb'"full_name":\s*"([^"]+)"')

chunk_start, chunk_end = split_file_into_chunks(file, 5)

ids, authors, locations, = [], [], []

for i in range(5):
    # Open the file in binary mode
    with open(file, 'rb') as f:
        # Calculate the length of the mmap object
        page_size = mmap.PAGESIZE
        start_byte, end_byte = chunk_start[i], chunk_end[i]

        # Align the start_byte to the nearest lower page boundary
        aligned_start_byte = start_byte - (start_byte % page_size)

        # Calculate the length of the mmap object including the offset
        mmap_length = end_byte - aligned_start_byte

        # Create the mmap object with the specified range
        mmapped_file = mmap.mmap(f.fileno(), length=mmap_length, offset=aligned_start_byte, access=mmap.ACCESS_READ)

        # Read each line and extract ids using regex
        id_pattern = re.compile(r'"_id":\s*"([^"]+)"')  # Adjust this regex according to your id pattern

        # Read each line
        for line in iter(mmapped_file.readline, b''):
            # Extract ids using regex
            match = id_pattern.search(line.decode())
            if match:
                ids.append(int(match.group(1)))

        # Close the mmap object
        mmapped_file.close()

# Print the list of extracted ids
print(ids, len(ids))


def mmap_twitter_processor(file, chunk_start, chunk_end):
    
    ...

