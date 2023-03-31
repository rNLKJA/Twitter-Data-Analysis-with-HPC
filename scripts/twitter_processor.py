import numpy as np
import pandas as pd
from pathlib import Path
from dataclasses import dataclass
import re
from .utils import normalise_location, is_state_location


@dataclass
class Twitter:
    """
    Twitter object contains information including 
    twitter_id, author_id, and lcoation string
    """
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
    # define search string
    TWEETS_ID = r'"_id":\s*"([^"]+)"'
    AUTHOR_ID = r'"author_id":\s*"([^"]+)"'
    LOCATION_ID = r'"full_name":\s*"([^"]+)"'

    # define results list
    tweet_lst = []

    with open(filename, mode="rb") as f:
        # seek the start of the file
        f.seek(cs)

        EOF = False
        while not EOF:
            line = f.readline().decode()  # decode the current line from bytes

            # find target twitter id
            match_id = re.search(TWEETS_ID, line)
            if match_id:
                _id = match_id.group(1)
                tweet_lst.append(Twitter(_id=_id))

            # find target author id
            match_author = re.search(AUTHOR_ID, line)
            if match_author and tweet_lst:
                author = match_author.group(1)
                tweet_lst[-1].author = author

            # find target location name
            match_location = re.search(LOCATION_ID, line)
            if match_location and tweet_lst:
                location = match_location.group(1)
                tweet_lst[-1].location = location

            # break condition check
            if f.tell() >= ce:
                if tweet_lst[-1].location is None:
                    continue
                else:
                    EOF = True

    # convert result in a dataframe
    tweet_df = pd.DataFrame([tweet.__dict__ for tweet in tweet_lst])
    tweet_df.location = tweet_df.location.apply(
        lambda x: normalise_location(x))
    # tweet_df = tweet_df[~tweet_df.location.apply(lambda x: is_state_location(x))]

    return tweet_df


def task1(tweet_df: pd.DataFrame) -> pd.DataFrame:
    rdf = tweet_df[['gcc', '_id']].groupby('gcc').count().reset_index()
    return rdf


def task2(tweet_df: pd.DataFrame) -> pd.DataFrame:
    rdf = tweet_df[['author', '_id']].groupby('author').count().reset_index()
    return rdf


def task3(tweet_df: pd.DataFrame) -> pd.DataFrame:
    rdf = tweet_df[['author', 'gcc']].groupby(
        ['author']).nunique().reset_index()
    return rdf
