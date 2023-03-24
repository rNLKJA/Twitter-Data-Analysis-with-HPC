"""
Twitter Analyzer logger
"""
import logging
from pathlib import Path

# define path for logging file
ROOT_PATH = Path()
LOGFILE_PATH = ROOT_PATH / "doc" / "log"

# logger configuration
logging.basicConfig(
    filename=LOGFILE_PATH / "twitter.log",
    filemode='w',
    format="[%(levelname)-7s] [%(filename)-10s:%(lineno)d] %(asctime)s \n%(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    level=logging.INFO,
    # force=True,
)

# define twitter logger
twitter_logger = logging.getLogger("twitter_logger")

# initial message send via twitter logger
MESSAGE = """========================================================
2023 S1 COMP90024 Cluster & Cloud Computing Assignment 1
Organization: the University of Melbourne
Author: Wei Zhao & Sunchuangyu Huang
Github: https://github.com/rNLKJA/2023-S1-COMP90024-A1/
========================================================"""
twitter_logger.info(MESSAGE)
