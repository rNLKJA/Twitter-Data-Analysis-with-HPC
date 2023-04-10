<div align=center><h1>Cluster & Cloud Computing <br> Social Media Analysis</h1></div>

## Project overview

The assignment is to implement a paralleized application leveraging the University of Melbourne HPC facility SPARTAN. The application will use a large Twitter dataset and a file containing suburbs, locations and Greater Capital cities of Australia.

The project objectives to:

- count the number of different tweets made in the Greater Capital cities of Australia,
- identify the Twitter accoutns (users) that have made the most tweets, and
- identify the users that have tweeted from the most different Greater Capital cities.

More information, please visit [project wiki](https://github.com/rNLKJA/2023-S1-COMP90024-A1/wiki).

Project Report: [Overleaf](https://www.overleaf.com/read/sdsczmmdxzvq)

## Team

| Name              | Student ID | Email                               |
| ----------------- | :--------: | ----------------------------------- |
| Sunchuangyu Huang |  1118472   | sunchuangyuh@student.unimelb.edu.au |
| Wei Zhao          |  1118649   | weizhao1@student.unimelb.edu.au     |

## Directories

```
COMP90024 Cluster & Cloud Computing - Assignment 1 TwitterAnalyser
|   |── data                     # store raw data
|       |── processed            # store processed data
|       |── result               # store output files
|── notebooks                    # processing and visualisation notebooks
|── scripts                      # main program scripts
|── slurm                        # slurm job scripts
|── doc
|   |── log                      # program log file
|   |── slurm
|       |── stderr               # slurm standard error
|       |── stdout               # slurm standard output
|── requirements.txt             # python dependencies
└── README.md
```

## To start the program

For local testing, run the following commands:

```bash
# main.py must in execute mode
mpiexec -n [NUM_PROCESSORS] python main.py -t [TWITTER_FILE] -s [SAL_FILE] -e [EMAIL_TARGET|OPTIONAL]

# to submit a job in spartan hpc, run submission script
./submit.sh
```

Note, email target has only two valid options: 'rin' / 'eric'.

## Assignment Dependencies

Main Python dependencies: `python=3.7.4`, `mpi4py=3.0.4`, `polars`, `numpy`, `pandas`.

If running on spartan, make sure use virtualenv with a python version `3.7.4` due to spartan load mpi4py version `3.0.4`.

```bash
# hpc: load module on spartan
module --force purge
module load mpi4py/3.0.2-timed-pingpong

source ~/virtualenv/python3.7.4/bin/activate

# local: create a conda environment
conda env create --name comp90024 --file environment.yml

# install dependencies
pip install numpy pandas 'polars[all]'  #  or
pip install -r requirements.txt
```

## Assignment report

The `bigTwitter.json` contains $9,092,274$ tweets written by $119,439$ authors. Start from date `2021-07-05` to `2022-12-31`.

**Processing time** on BigTwitter.json.

|   Job    | Node | Core | Job Wall-Clock Time | CPU Efficiency |
| :------: | :--: | :--: | :-----------------: | :------------: |
| 46094405 |  1   |  1   |      00:11:01       |     98.34%     |
| 46094406 |  1   |  8   |      00:01:41       |     87.13%     |
| 46094407 |  2   |  4   |      00:01:41       |     87.75%     |

**Task 1 Question**: The solution should count the number of tweets made by the same individual based on the bigTwitter.json file and returned the top 10 tweeters in terms of the number of tweets made irrespective of where they tweeted. The result will be of the form (where the author Ids and tweet numbers are representative).

| Rank | Author Id           | Number of Tweets Made |
| :--- | ------------------- | :-------------------: |
| #1   | 1498063511204760000 |        68,477         |
| #2   | 1089023364973210000 |        28,128         |
| #3   | 826332877457481000  |        27,718         |
| #4   | 1250331934242120000 |        25,350         |
| #5   | 1423662808311280000 |        21,034         |
| #6   | 1183144981252280000 |        20,765         |
| #7   | 1270672820792500000 |        20,503         |
| #8   | 820431428835885000  |        20,063         |
| #9   | 778785859030003000  |        19,403         |
| #10  | 1104295492433760000 |        18,781         |

**Task 2 Question**: Using the _bigTwitter.json_ and _sal.json_ file you will then count the number of tweets made in the various captical cities by all users. The result will be a table of the form (where the numbers are representative).

For this task, ignore tweets made by users in rural location, e.g. _lrnsw_ (Rural New South Wales), _1rvic_ (Rural Victoria) etc.

| Greater Capital City | Number of Tweets Made |
| :------------------: | :-------------------: |
|        1gsyd         |       2,218,689       |
|        2gmel         |       2,284,909       |
|        3gbri         |        878,614        |
|        4gade         |        465,081        |
|        5gper         |        590,045        |
|        6ghob         |        91,112         |
|        7gdar         |        46,772         |
|        8acte         |        214,347        |
|        9oter         |          203          |

**Task 3 Question**: The solution should identify those tweeters that have a tweeted in the most Greater Capital cities and the number of times they have tweeted from those locations. The top 10 tweeters making tweets from the most different locations should be returned and if there are equal number of locations, then these should be ranked by the number of tweets. Only those tweets made in Greater Capital cities should be counted.

| Rank | Author Id           | Number of Unique City Locations and #Tweets                                                    |
| :--: | :------------------ | :--------------------------------------------------------------------------------------------- |
|  #1  | 1429984556451389440 | 8 (#1920 tweets - #1879gmel, #13acte, #11gsyd, #7gper, #6gbri, #2gade, #1gdar, #1ghob)         |
|  #2  | 702290904460169216  | 8 (#1231 tweets - #336gsyd, #255gmel, #235gbri, #156gper, #127gade, #56acte, #45ghob, #21gdar) |
|  #3  | 17285408            | 8 (#1209 tweets - #1061gsyd, #60gmel, #40gbri, #23acte, #11ghob, #7gper, #4gdar, #3gade)       |
|  #4  | 87188071            | 8 (#407 tweets - #116gsyd, #86gmel, #68gbri, #52gper, #37acte, #28gade, #15ghob, #5gdar)       |
|  #5  | 774694926135222272  | 8 (#272 tweets - #38gmel, #37gbri, #37gsyd, #36ghob, #34acte, #34gper, #28gdar, #28gade)       |
|  #7  | 502381727           | 8 (#250 tweets - #214gmel, #10acte, #8gbri, #8ghob, #4gade, #3gper, #2gsyd, #1gdar)            |
|  #6  | 1361519083          | 8 (#266 tweets - #193gdar, #36gmel, #18gsyd, #9gade, #6acte, #2ghob, #1gbri, #1gper)           |
|  #8  | 921197448885886977  | 8 (#207 tweets - #56gmel, #49gsyd, #37gbri, #28gper, #24gade, #8acte, #4ghob, #1gdar)          |
|  #9  | 601712763           | 8 (#146 tweets - #44gsyd, #39gmel, #19gade, #14gper, #11gbri, #10acte, #8ghob, #1gdar)         |
| #10  | 2647302752          | 8 (#80 tweets - #32gbri, #16gmel, #13gsyd, #5ghob, #4gper, #4acte, #3gade, #3gdar)             |

For complete assignment 1 report, please check [overleaf](https://www.overleaf.com/read/sdsczmmdxzvq).

## LICENSE

The code will be public after 27th May 2023. For @copyright information please refer to [MIT License](./LICENSE).

---

<p align=right>2023@Wei & Sunchuangyu</p>
