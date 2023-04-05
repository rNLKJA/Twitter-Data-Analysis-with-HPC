import mmap
import os
import re
import polars as pl
import pyarrow as pa

file = "../data/smallTwitter.json"
size = os.stat(file).st_size 

TWEETS_ID = re.compile(rb'"_id":\s*"([^"]+)"')
AUTHOR_ID = re.compile(rb'"author_id":\s*"([^"]+)"')
LOCATION_ID = re.compile(rb'"full_name":\s*"([^"]+)"')


def read_into_memory(file, chunk_start, chunk_end):

    with open(file, mode='rb') as f:
        length = chunk_end - chunk_start
        tweet_ids, author_ids, locations = [], [], []
       
        
        with mmap.mmap(f.fileno(), length=length, offset=chunk_start,access=mmap.ACCESS_READ) as m:

            
            tweet_ids = [_id.decode() for _id in TWEETS_ID.findall(m)]
            author_ids = [_id.decode() for _id in AUTHOR_ID.findall(m)]
            locations = [_id.decode() for _id in LOCATION_ID.findall(m)]
            
            
            tweet_ids = tweet_ids[:min(len(tweet_ids), len(author_ids), len(locations))]
            author_ids = author_ids[:min(len(tweet_ids), len(author_ids), len(locations))]
            locations = locations[:min(len(tweet_ids), len(author_ids), len(locations))]
       
            return tweet_ids, author_ids, locations

def read_file_with_bins(filename, bin_size=1024):
    file_size = os.path.getsize(filename)
    num_bins = file_size // (bin_size * 1024 * 1024)

    if file_size % (bin_size * 1024 * 1024) != 0:
        num_bins += 1

    bin_ranges = []
    for i in range(num_bins):
        start = i * bin_size * 1024 * 1024
        end = min(start + bin_size * 1024 * 1024, file_size)
        bin_ranges.append((start, end))

    return bin_ranges

tids, aids, locs = [], [], []
bins = read_file_with_bins('../data/bigTwitter.json')

for chunk_start, chunk_end in bins:
    print("Reading chunk from {} to {}".format(chunk_start, chunk_end))
    tweet_ids, author_ids, locations = read_into_memory('../data/bigTwitter.json', chunk_start, chunk_end)
    tids += tweet_ids
    aids += author_ids
    locs += locations

df = pl.DataFrame({'tweet_id': tids, 'author_id': author_ids, 'location': locs})
print("complete")
print(df)
print(len(tids), len(aids), len(locs))
