# /usr/bin/env python3
"""
Sal.json Processing Script, involving a processed sal.json file
and load the csv into a pandas dataframe
"""
import pandas as pd
import re
from pathlib import Path
import logging
from .utils import obtain_sal_file_name
from .arg_parser import parser
import polars as pl

sal_file_name = obtain_sal_file_name(parser=parser)

# location dictionary for ambigious place, these place
# should be include / count as gcc

location_dict = {
    "sydney nsw": "sydney",
    "melbourne vic": "melbourne",
    "brisbane qld": "brisbane",
}


def process_salV1(path: Path, logger: logging) -> pl.DataFrame:
    """
    Process sal.json file by removing irrelevant attributes,
    case 0: remove any gcc containing char r (r represents rural)
    case 1: remove all brackets
    case 2: remove all " - "
    case 3: remove all "\."
    Then store the final result into a csv file.

    path (Path): root directory
    """
    logger.info("Loading sal.json into pandas")
    # load sal.json file & reset index
    df = pd.read_json(path / f"data/{sal_file_name}", orient="index")
    df = df.reset_index().rename(columns={"index": "location"})

    df.drop(["ste", "sal"], axis=1, inplace=True)

    # case1: replace all brackets with an empty string
    logger.info("Substitute brackets in location")
    df.location = df.agg(lambda x: re.sub(r"[()]", "", x.location), axis=1)

    # case2: replace " - " with " "
    logger.info("Substitude string ' - ' with ' '")
    df.location = df.agg(lambda x: re.sub(" - ", " ", x.location), axis=1)

    # case3: replace "\." with ""
    logger.info("Substitude \. with an empty string")
    df.location = df.agg(lambda x: re.sub("\.", "", x.location), axis=1)
    
    # case 4: consider ngram like locations
    # generate a new dataframe and concate to the original one
    def split_location_into_ngrams(location):
        words = location.split(' ')
        if len(words) > 2:
            return [' '.join(x) for x in zip(words, words[1:])]
        return None

    df1 = df.copy()
    df1['location'] = df1.location.apply(lambda x: split_location_into_ngrams(x))
    df1 = df1.dropna()[['location', 'gcc']].explode('location')
    
    df = pd.concat([df, df1], ignore_index=True, axis=0)

    return pl.from_pandas(df)


def process_sal(path: Path, logger: logging) -> pd.DataFrame:
    """
    Process sal.json file by removing irrelevant attributes,
    case 0: remove any gcc containing char r (r represents rural)
    case 1: remove all brackets
    case 2: remove all " - "
    case 3: remove all "\."
    Then store the final result into a csv file.

    path (Path): root directory
    """
    logger.info("Loading sal.json into pandas")
    # load sal.json file & reset index
    df = pd.read_json(path / f"data/{sal_file_name}", orient="index")
    df = df.reset_index().rename(columns={"index": "location"})

    # drop unused columns
    df.drop(["ste", "sal"], axis=1, inplace=True)

    # case0: drop any rural sal value, this won't be use in the future
    # logger.info("Remove any location not in city")
    # df = df[~df.gcc.str.contains(r"\dr[a-z]{3}")]
    # df = df[~df.gcc.str.contains("9oter")]

    # case1: replace all brackets with an empty string
    logger.info("Substitute brackets in location")
    df.location = df.agg(lambda x: re.sub(r"[()]", "", x.location), axis=1)

    # case2: replace " - " with " "
    logger.info("Substitude string ' - ' with ' '")
    df.location = df.agg(lambda x: re.sub(" - ", " ", x.location), axis=1)

    # case3: replace "\." with ""
    logger.info("Substitude \. with an empty string")
    df.location = df.agg(lambda x: re.sub("\.", "", x.location), axis=1)

    # add a super location as a search string
    # gcc_dict = dict(zip(df.gcc.unique(), [g[2::] for g in df.gcc.unique()]))
    # df['location_x'] = df.agg(lambda x: x.location + ' ' + gcc_dict[x.gcc], axis=1)

    # store result to a csv file
    logger.info("Store sal.csv file.")
    df.to_csv(path / "data/processed/sal.csv", index=False)


def sal_csv_exist(path: Path, logger: logging):
    """
    Check sal.csv existence, if exist, then continue, else execute
    process_sal function.

    path (Path): root directory
    logger (logging): log logger
    """
    if path.exists():
        logger.info("Required sal.csv file exist, continue")
        return True


def load_sal_csv(path: Path, logger: logging) -> pd.DataFrame:
    """
    Load sal.csv into a pandas dataframe
    """
    logger.info("Prepare to load sal.csv")
    sal_file_processed = path / "data/processed/sal.csv"
    # if not sal_csv_exist(sal_file, logger):
    #     logger.info("Missing required sal.csv file, start processing")
    #     process_sal(path, logger)
    #     logger.info("Completed sal.csv")

    logger.info("Creating sal.csv, start processing")
    process_sal(path, logger)
    logger.info("Completed sal.csv")

    logger.info("Load sal.csv")
    df = pd.read_csv(sal_file_processed)
    # print(df)

    return df
