import logging
import argparse
from typing import Tuple, List
from pathlib import Path
import numpy as np
import pandas as pd
import math
import copy
from mpi4py import MPI


def obtain_args(parser: argparse.ArgumentParser,
                logger: logging) -> Tuple[str]:
    """
    Obtain kwargs and return a tuple
    """
    # obtain clt input
    logger.info("Parsing kwargs")
    args = parser.parse_args()
    twitter_file = args.twitter_file_name

    twitter_file = twitter_file

    return twitter_file


def split_file_into_chunks(path: Path, size: int) -> List[List]:

    file_size: int = path.stat().st_size
    step_size: int = file_size // size

    chunk_size: int = math.ceil(file_size / size)
    chunk_start: List[int] = [file_start for file_start in range(
        0, file_size, chunk_size)]

    chunk_end: List[int] = chunk_start[1:]
    chunk_end.append(file_size)

    return chunk_start, chunk_end


def twitter_wrangler(filename: Path, size: int) -> pd.DataFrame:
    ...
