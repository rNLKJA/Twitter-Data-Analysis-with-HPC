#/usr/bin/env python3
import pandas as pd
import re
from pathlib import Path
import logging

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
    df = pd.read_json(path/ "data/sal.json", orient="index")
    df.reset_index(inplace=True)
    df.rename(columns={'index': 'locat'})

    logger.info("Convert ste, sal dtype to integer")
    # convert data type for ste and sal
    df.ste = df.ste.astype("int8")
    df.sal = df.ste.astype("int16")

    # case0: drop any rural sal value, this won't be use in the future
    logger.info("Remove any location not in city")
    df = df[~df.gcc.str.contains(r"\dr[a-z]{3}")]

    # case1: replace all brackets with an empty string
    logger.info("Substitute brackets in locat")
    df.locat = df.agg(lambda x: re.sub(r"[()]", "", x.locat), axis=1)

    # case2: replace " - " with " "
    logger.info("Substitude string ' - ' with ' '")
    df.locat = df.agg(lambda x: re.sub(" - ", " ", x.locat), axis=1)

    # case3: replace "\." with ""
    logger.info("Substitude \. with an empty string")
    df.locat = df.agg(lambda x: re.sub("\.", "", x.locat), axis=1)

    # store result to a csv file
    logger.info("Store sal.csv file.")
    df.to_csv(path/"data/processed/sal.csv")
    
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
    logger.info("Loading sal.csv")
    sal_file = path / "data/processed/sal.csv"
    if not sal_csv_exist(sal_file, logger):
        logger.info("Missing required sal.csv file, start processing")
        process_sal(path, logger)
        logger.info("Completed sal.csv")

    logger.info("Load sal.csv")
    df = pd.read_csv(sal_file)
        
    return df
