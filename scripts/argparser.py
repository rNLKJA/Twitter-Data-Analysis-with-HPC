"""
Twitter Analyzer CLT kwargs parser
"""

import argparse

# Create the parser
parser = argparse.ArgumentParser(description='Process Twitter data in chunks.')

# Add the arguments for twitter file and chunk size
parser.add_argument('-t', '--twitter_file_name',
                    type=str,
                    required=True,
                    help='The name of the Twitter data file')
parser.add_argument('-c', '--chunk_size',
                    type=int,
                    required=True,
                    help='The number of lines per chunk for processing')
