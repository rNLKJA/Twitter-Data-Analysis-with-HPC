"""
Utility functions
"""
import logging
import argparse
from typing import Tuple, List, Optional
from pathlib import Path
import numpy as np
import pandas as pd
import math
import copy
from mpi4py import MPI
import re


def obtain_twitter_file_name(parser: argparse.ArgumentParser) -> str:
    """
    Obtain twitter file name
    """
    args = parser.parse_args()
    return args.twitter_file_name

def obtain_sal_file_name(parser: argparse.ArgumentParser) -> str:
    """
    Obtain specify which sal.json should be used
    """
    args = parser.parse_args()
    return args.sal

def obtain_email_target(parser: argparse.ArgumentParser) -> any:
    """
    Specify who should receive the log file.
    """
    args = parser.parse_args()
    return args.email
    

def split_file_into_chunks(path: Path, size: int) -> List[List]:
    """
    Split the total file bytes in to a list of [size] bytes,
    which will tell the file reader where to start reading file.
    """
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
    

state_location = dict(zip([s.lower() for s in ['Australian Capital Territory', 
                                               'New South Wales', 
                                               'Northern Territory', 
                                               'Queensland', 
                                               'South Australia', 
                                               'Tasmania', 'Victoria', 
                                               'Western Australia']], 
                         [s.lower() for s in ['ACT', 'NSW', 
                                              'NT', 'QLD', 'SA', 
                                              'TAS', 'VIC', 'WA']]))

city_location = dict(zip([s.lower() for s in ['Canberra', 'Sydney', 'Darwin', 'Brisbane', 
                                              'Adelaide', 'Hobart', 'Melbourne', 'Perth']],
                         [s.lower() for s in ['CAN', 'SYD', 'DAR', 'BRI', 
                                              'ADE', 'HOB', 'MEL', 'PER']]))
    
def normalise_location(location: str) -> str:
    """
    Normalise location where the location string should not
    contains any puntuations also additional white spaces.
    """
    text = location.lower()
    
    text = re.sub(r'[^\w\s]', '', text)
    text = re.sub(r' - ', '', text)
    
    for key, value in state_location.items():
        text = re.sub(key, value, text)

    return text

INVALID_LOCATION = ['act australia', 
                'nsw australia', 
                'nt australia', 
                'qld Australia', 
                'sa australia', 
                'tas australia', 'vic australia', 
                'wa australia', 'australia']

def is_state_location(location):
    """
    Check current twitter location that is from a state or not.
    """
    if location in INVALID_LOCATION:
        return True
    return False