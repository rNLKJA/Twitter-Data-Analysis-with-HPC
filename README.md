<div align=center><h1>Cluster & Cloud Computing <br> Social Media Analysis</h1></div>

## Project overview

The assignment is to implement a paralleized application leveraging the University of Melbourne HPC facility SPARTAN. The application will use a large Twitter dataset and a file containing suburbs, locations and Greater Capital cities of Australia.

The project objectives to:

- count the number of different tweets made in the Greater Capital cities of Australia,
- identify the Twitter accoutns (users) that have made the most tweets, and
- identify the users that have tweeted from the most different Greater Capital cities.

More information, please visit [project wiki](https://github.com/rNLKJA/2023-S1-COMP90024-A1/wiki).

## Directories

```
A1
|   |── data
|       |── processed
|── notebooks
|── scripts
|── slurm
|── doc
|   |── log
|   |── slurm
|── requirements.txt
└── README.md
```

## To start the program

```bash
mpiexec -n [NUM_PROCESSORS] python main.py -t [TWITTER_FILE] -s [SAL_FILE] --email [EMAIL_TARGET]
```

## Assignment Dependencies

Main Python dependencies: python=3.7.4, mpi4py=3.0.4, numpy, pandas.

<!-- TODO: provide request dependence information and installatino methods, it will be good if there is a auto install/deployment script -->

## Assignment report

<!-- Write a short project outcomes here -->

**Task 1 Question**: The solution should count the number of tweets made by the same individual based on the bigTwitter.json file and returned the top 10 tweeters in terms of the number of tweets made irrespective of where they tweeted. The result will be of the form (where the author Ids and tweet numbers are representative).


**Task 2 Question**: Using the *bigTwitter.json* and *sal.json* file you will then count the number of tweets made in the various captical cities by all users. The result will be a table of the form (where the numbers are representative). 

For this task, ignore tweets made by users in rural location, e.g. *lrnsw* (Rural New South Wales), *1rvic* (Rural Victoria) etc.


| Greater Capital City | Number of Tweets Made |
| :----: | :----: |
| 1gsyd | 2122 |
|2gmel|14665|
|3gbri|1746|
|4gade|11426|
|5gper|578882|
|6ghob|695|
|7gdar|36|
|8acte|193835|
|9oter|3|

**Task 3 Question**: The solution should identify those tweeters that have a tweeted in the most Greater Capital cities and the number of times they have tweeted from those locations. The top 10 tweeters making tweets from the most different locations should be returned and if there are equal number of locations, then these should be ranked by the number of tweets. Only those tweets made in Greater Capital cities should be counted.

|Rank|Author Id|Number of Unique City Locations and #Tweets|
| :----: | :---- | :---- |
|1|133391271|24 (#23gper ,#1acte)|
|2|702290904460169216|2 (#1gsyd ,#1gper)|
|3|774694926135222272|2 (#1gper ,#1acte)|
|4|191761621|267 (#267gper)|
|5|125515417|242 (#242acte)|
|6|120212120|216 (#216gper)|
|7|1348502962050535428|213 (#213acte)|
|8|51378153|199 (#199gper)|
|9|266010557|170 (#170gper) | 
|10|719139700318081024|170 (#170gper) |


For complete assignment 1 report, please check [overleaf](https://www.overleaf.com/read/sdsczmmdxzvq).

## License

The code will be public after 27th May 2023. For @copyright information please refer to [MIT License](./LICENSE).

<!-- TODO: create MIT license -->

---

<!-- TODO: write team name -->
<p align=right>2023@Wei & Sunchuangyu</p>
