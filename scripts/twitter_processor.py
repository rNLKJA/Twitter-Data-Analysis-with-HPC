import numpy as np
import pandas as pd
from pathlib import Path
from dataclasses import dataclass
import re
from .utils import normalise_location, is_state_location

# from .logger import twitter_logger as log


@dataclass
class Twitter:
    _id: int = None
    author: str = None
    location: str = None


def file_break_check(cb: int, ce: int) -> bool:
    """
    Return a boolean value which represent a signal of stop reading file

    Args:
        cb (int): current file bytes
        ce (int): target end file bytes

    Returns:
        bool: break signal, true for stop
    """
    ...


def twitter_processor(filename: Path, cs: int, ce: int) -> pd.DataFrame:
    """
    Processing twitter data from line by line and return a pandas dataframe

    Args:
        filename(Path): a path object specific which twitter file should be processed
        cs (int): chunk start -> start bytes of a chunk
        ce (int): chunk end -> end bytes of a chunk
    Return:
        pd.DataFrame: a pandas dataframe contains required information including, twitter_id, author_id, location
    """

    # define results list
    tweet_lst = []

    with open(filename, mode="rb") as f:
        # seek the start of the file
        f.seek(cs)

        EOF = False
        while not EOF:
            line = f.readline().decode()  # decode the current line from bytes

            match_id = re.search(r'"_id":\s*"([^"]+)"', line)
            if match_id:
                _id = match_id.group(1)
                tweet_lst.append(Twitter(_id=_id))

            match_author = re.search(r'"author_id":\s*"([^"]+)"', line)
            if match_author and tweet_lst:
                author = match_author.group(1)
                tweet_lst[-1].author = author

            match_location = re.search(r'"full_name":\s*"([^"]+)"', line)
            if match_location and tweet_lst:
                location = match_location.group(1)
                tweet_lst[-1].location = location

            # break condition check
            if f.tell() >= ce:
                if tweet_lst[-1].location is None:
                    continue
                else:
                    EOF = True

    tweet_df = pd.DataFrame([tweet.__dict__ for tweet in tweet_lst])
    tweet_df.location = tweet_df.location.apply(lambda x: normalise_location(x))
    tweet_df = tweet_df[~tweet_df.location.apply(lambda x: is_state_location(x))]
    
    return tweet_df

def task1(tweet_df: pd.DataFrame) -> pd.DataFrame:
    rdf = tweet_df[['gcc', '_id']].groupby('gcc').count().reset_index()
    return rdf

def task2(tweet_df: pd.DataFrame) -> pd.DataFrame:
    rdf = tweet_df[['author', '_id']].groupby('author').count().reset_index()
    return rdf

def task3(tweet_df: pd.DataFrame) -> pd.DataFrame:
    rdf = tweet_df[['author', 'gcc']].groupby(['author']).nunique().reset_index()
    return rdf