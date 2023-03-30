"""
Twitter Analyzer CLT kwargs parser
"""

import argparse

# Create the parser
parser = argparse.ArgumentParser(description='Process Twitter data in chunks.')

# Add the arguments for twitter file, sal.json and email list
parser.add_argument('-t', '--twitter_file_name',
                    type=str,
                    required=True,
                    help='The name of the Twitter data file')

parser.add_argument('-s', '--sal',
                    type=str,
                    required=True,
                    help='The name of the Sal.json data file')

parser.add_argument('--email', '--email_target',
                    type=str,
                    required=False,
                    help='indicate a email to submit the job')