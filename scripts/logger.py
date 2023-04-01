"""
Twitter Analyzer logger
"""
import logging
from pathlib import Path
from datetime import datetime

time_string = datetime.now().strftime("%Y-%m-%d-%H-%M-%S")

# define path for logging file

ROOT_PATH = Path()
FILENAME = f"twitter-{time_string}.log"
LOGFILE_PATH = ROOT_PATH / "doc" / "log"
FULL_PATH = LOGFILE_PATH / f"twitter-{time_string}.log"

# logger configuration
logging.basicConfig(
    filename=LOGFILE_PATH / f"twitter-{time_string}.log",
    filemode="w",
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
