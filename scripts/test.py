from twitter_processor import *
from pathlib import Path

twitter_file = Path()
print(twitter_file)
cs, ce = 0, 10000

df = twitter_processor(twitter_file, cs, ce)

print(df)
