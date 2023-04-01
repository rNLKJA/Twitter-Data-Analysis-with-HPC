import numpy as np
import pandas as pd
from pathlib import Path
from dataclasses import dataclass
import re
from .utils import normalise_location, is_state_location
import polars as pl
from scripts.logger import twitter_logger as logger
from itertools import combinations

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

def twitter_processorV1(
    filename: Path, cs: int, ce: int, sal_df: pl.DataFrame
) -> pl.DataFrame:
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

    SKIP_LINES_1 = 17  # MAGICS NUMBERS
    SKIP_LINES_2 = 20

    # define results list
    tweets_id, author_id, gcc, locations = [], [], [], []
    sal_dict = dict(zip(sal_df["location"].to_list(), sal_df["gcc"].to_list()))

    with open(filename, mode="rb") as f:
        f.seek(cs) # seek the start of the file

        EOF = False
        while not EOF:
            line = f.readline().decode()  # decode the current line from bytes

            # find target twitter id
            match_id = re.search(TWEETS_ID, line)
            if match_id:
                tweets_id.append(match_id.group(1))

                next(f, None)
                next(f, None)

            # find target author id
            match_author = re.search(AUTHOR_ID, line)
            if match_author and len(tweets_id) != len(author_id):
                author_id.append(np.int64(match_author.group(1)))

                for _ in range(SKIP_LINES_1):  # skip irrelevant lines
                    next(f, None)

            # find target location name
            match_location = re.search(LOCATION_ID, line)
            if match_location and len(tweets_id) != len(gcc):
                location = normalise_location(match_location.group(1).lower())
                locations.append(location)
                ngram_words = return_words_ngrams(location.split(' '))
                
                for possible_location in ngram_words:
                    if sal_dict.get(possible_location):
                        gcc.append(sal_dict.get(possible_location))
                        break
                
                if len(tweets_id) != len(gcc):
                    gcc.append(None)


                for _ in range(SKIP_LINES_2):  # skip irrelevant lines
                    next(f, None)                

            # break condition check
            if f.tell() >= ce:
                if len(tweets_id) != len(gcc):
                    continue
                else:
                    EOF = True
        
        tdf = pl.DataFrame({"tweet_id": tweets_id, "author_id": author_id, 'location': locations,"gcc": gcc}) 
        
    
    return tdf

def return_words_ngrams(words: list) -> list:
    """
    Return a list contains ngram words
    """
    return [' '.join(c) for i in range(1, len(words) + 1) for c in combinations(words, i)]

def twitter_processor(
    filename: Path, cs: int, ce: int, sal_df: pl.DataFrame
) -> pl.DataFrame:
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

    SKIP_LINES_1 = 17  # MAGICS NUMBERS
    SKIP_LINES_2 = 20

    # define results list
    tweets_id, author_id, location = [], [], []

    with open(filename, mode="rb") as f:
        # seek the start of the file
        f.seek(cs)

        EOF = False
        while not EOF:
            line = f.readline().decode()  # decode the current line from bytes

            # find target twitter id
            match_id = re.search(TWEETS_ID, line)
            if match_id:
                tweets_id.append(match_id.group(1))

                next(f, None)
                next(f, None)

            # find target author id
            match_author = re.search(AUTHOR_ID, line)
            if match_author and len(tweets_id) != len(author_id):
                author_id.append(np.int64(match_author.group(1)))

                for _ in range(SKIP_LINES_1):  # skip irrelevant lines
                    next(f, None)

            # find target location name
            match_location = re.search(LOCATION_ID, line)
            if match_location and len(tweets_id) != len(location):
                location.append(match_location.group(1))

                for _ in range(SKIP_LINES_2):  # skip irrelevant lines
                    next(f, None)

            # break condition check
            if f.tell() >= ce:
                if len(tweets_id) != len(location):
                    continue
                else:
                    EOF = True

    # convert result in a dataframe
    tdf = generate_polars_dataframe(
        tweets_id=tweets_id, author_id=author_id, location=location, sal_df=sal_df
    )

    logger.info("File read complete")

    return tdf


def generate_polars_dataframe(
    tweets_id: list, author_id: list, location: list, sal_df: pl.DataFrame
) -> pl.DataFrame:
    """
    Generate a polars dataframe from a list of twitter objects

    Args:
        tweets_id (list): a list of twitter id
        author_id (list): a list of author id
        location (list): a list of location string

    Returns:
        pl.DataFrame: a polars dataframe contains twitter_id, author_id, location
    """
    # convert result in a dataframe
    tweet_df = pl.DataFrame(
        {"tweet_id": tweets_id, "author_id": author_id, "location": location}
    )

    tweet_df1 = tweet_df.with_columns(
        pl.col("location").apply(lambda x: normalise_location(x), skip_nulls=True)
    )
    tweet_df1 = tweet_df1.join(sal_df, on="location", how="left")

    tweet_df2 = tweet_df1.filter(pl.col("gcc").is_null())
    if not tweet_df2.is_empty():
        tweet_df2 = tweet_df2.with_columns(
            pl.col("location").apply(lambda x: x.split(" ")[0])
        )

        tweet_df2 = tweet_df2[["tweet_id", "author_id", "location"]].join(
            sal_df.with_columns(pl.col("location").cast(pl.Utf8)),
            on="location",
            how="left",
        )

    tdf = tweet_df1.join(tweet_df2, on="tweet_id", how="left")

    tdf = tdf.with_columns(pl.col("gcc").fill_null(pl.col("gcc_right")))[
        ["tweet_id", "author_id", "location", "gcc"]
    ]

    tweet_df3 = tdf.filter(pl.col("gcc").is_null())
    if not tweet_df3.is_empty():
        tweet_df3 = tweet_df3.with_columns(
            pl.col("location").apply(lambda x: " ".join(x.split(" ")[0:2]))
        )
        tweet_df3 = tweet_df3[["tweet_id", "author_id", "location"]].join(
            sal_df.with_columns(pl.col("location").cast(pl.Utf8)),
            on="location",
            how="left",
        )

    tdf = tdf.join(tweet_df3, on="tweet_id", how="left")
    tdf = tdf.with_columns(pl.col("gcc").fill_null(pl.col("gcc_right")))[
        ["tweet_id", "author_id", "location", "gcc"]
    ]

    return tdf


def combine_tdf(tdfs: list) -> pl.DataFrame:
    """
    Combine a list of polars dataframe into one polars dataframe

    Args:
        tdfs (list): a list of polars dataframe

    Returns:
        pl.DataFrame: a polars dataframe contains twitter_id, author_id, location
    """
    tdf = pl.concat(tdfs)

    return tdf


def count_number_of_tweets_by_author(tdf: pl.DataFrame) -> pl.DataFrame:
    """
    Count the number of tweets by each author

    Args:
        tdf (pl.DataFrame): a polars dataframe contains twitter_id, author_id, location

    Returns:
        pl.DataFrame: a polars dataframe contains author_id and number of tweets
    """
    # count the number of tweets by each author
    author_tweet_count = (
        tdf.select('author_id', 'tweet_id').groupby("author_id")
        .agg(pl.count("tweet_id").alias("tweet_count"))
        .sort("tweet_count", reverse=True)
    )

    return author_tweet_count


def calculate_rank(tdf: pl.DataFrame, method: str) -> pl.DataFrame:
    """ """
    return tdf.with_columns(
        pl.col("tweet_count").rank(method=method, descending=True).alias("rank")
    )


def return_author_with_most_tweets(
    tdf: pl.DataFrame, top: int, save: bool, path: Path
) -> pl.DataFrame:
    """
    Return the author with the most tweets
    """
    tdf = tdf.sort(
        "rank", "tweet_count", "author_id", descending=[False, False, False]
    ).filter(pl.col("rank") <= top)
    if save:
        tdf = tdf.select("rank", "author_id", "tweet_count")
        tdf = tdf.with_columns(pl.col("rank").apply(lambda x: "#" + str(x)))
        tdf.columns = ["Rank", "Author Id", "Number of Tweets Made"]
        tdf.write_csv(path / "data/result/task1.csv")
        return None
    else:
        return tdf


def count_number_of_tweets_by_gcc(tdf: pl.DataFrame) -> pl.DataFrame:
    """
    Count the number of tweets by each gcc
    """

    tdf = (
        tdf.select("gcc", "tweet_id")
        .filter(~pl.col("gcc").is_null())
        .filter(~pl.col("gcc").str.contains(r"\dr[a-z]{3}"))
        .groupby("gcc")
        .count()
    )

    return tdf


def return_gcc_with_tweets_count(
    tdf: pl.DataFrame, save: bool, path: Path
) -> pl.DataFrame:
    """
    Count the number of tweets by each gcc not include rural area
    Args:
        tdf (pl.DataFrame): a polars dataframe contains gcc and number of tweets
        save (bool): whether to save the result to csv file
        path (Path): the path to save the result
    Return:
        pl.DataFrame: a polars dataframe contains gcc and number of tweets
    """
    tdf = tdf.sort("gcc", descending=False)
    tdf.columns = ["Greater Captical City", "Number of Tweets Made"]
    if save:
        tdf.write_csv(path / "data/result/task2.csv")
        return
    else:
        return tdf
