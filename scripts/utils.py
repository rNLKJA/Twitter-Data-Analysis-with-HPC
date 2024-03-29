"""
Utility functions
"""
import argparse
from typing import List
from pathlib import Path
import pandas as pd
import math
from mpi4py import MPI
import re
from scripts.logger import twitter_logger as logger
import time
from scripts.arg_parser import parser
from scripts.email_sender import send_log


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
    chunk_start: List[int] = [
        file_start for file_start in range(0, file_size, chunk_size)
    ]

    chunk_end: List[int] = chunk_start[1:]
    chunk_end.append(file_size)

    return chunk_start, chunk_end


def twitter_wrangler(filename: Path, size: int) -> pd.DataFrame:
    ...


state_location = dict(
    zip(
        [
            s.lower()
            for s in [
                "Australian Capital Territory",
                "New South Wales",
                "Northern Territory",
                "Queensland",
                "South Australia",
                "Tasmania",
                "Victoria",
                "Western Australia",
            ]
        ],
        [s.lower() for s in ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"]],
    )
)

gccs = [
    "Canberra",
    "Sydney",
    "Darwin",
    "Brisbane",
    "Adelaide",
    "Hobart",
    "Melbourne",
    "Perth",
]
city_location = dict(
    zip(
        [s.lower() for s in gccs],
        [s.lower() for s in ["CAN", "SYD", "DAR", "BRI", "ADE", "HOB", "MEL", "PER"]],
    )
)


def normalise_location(location: str) -> str:
    """
    Normalise location where the location string should not
    contains any puntuations also additional white spaces.
    """
    text = re.sub(r"[^\w\s]", "", location)
    text = re.sub(r" - ", "", text)

    if location.split(",")[0] in gccs:
        text = location.split(",")[0].lower()

    for key, value in state_location.items():
        text = re.sub(key, value, text)

    return re.sub(" +", " ", text)


INVALID_LOCATION = [
    "act australia",
    "nsw australia",
    "nt australia",
    "qld Australia",
    "sa australia",
    "tas australia",
    "vic australia",
    "wa australia",
    "australia",
]


def is_state_location(location):
    """
    Check current twitter location that is from a state or not.
    """
    if location in INVALID_LOCATION:
        return True
    return False


def combine_gcc_twitter_count(x):
    count = {}
    for _, row in x.iterrows():
        if row["gcc"] in count:
            count[row["gcc"]] += row["_id"]
        else:
            count[row["gcc"]] = row["_id"]
    return " ,".join([f"#{str(v)}{k[1:]}" for k, v in count.items()])


def log_current_information(twitter_file_name: str, size: int, rank: int):
    """
    Log current information about the current process.
    """
    if rank == 0:
        logger.info(f"Current running on {size} nodes\n")
        logger.info(f"Target file: {twitter_file_name}\n")
    return


def log_system_information():
    """
    Log system information
    """
    logger.info(f"System information: {MPI.Get_processor_name()}\n")
    logger.info("PROGRAM START")
    return


def end_process(start_time):
    """
    End of process
    """
    logger.info(f"ALL TASKS COMLETE")
    end_time = time.time()
    logger.info(f"Programming running seconds: {end_time - start_time}")

    email_target = obtain_email_target(parser)
    send_log(target=email_target)

    return
