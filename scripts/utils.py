import logging
import argparse
from typing import Tuple

def obtain_args(parser: argparse.ArgumentParser, 
                logger: logging) -> Tuple[str, int]:
    """
    Obtain kwargs and return a tuple
    """
    # obtain clt input
    logger.info("Parsing kwargs")
    args = parser.parse_args()
    twitter_file, chunk_size = args.twitter_file_name, args.chunk_size
    return twitter_file, chunk_size
