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

| Rank | Author Id           | Number of Tweets Made |
| ---- | ------------------- | --------------------- |
| 1    | 1498063511204760000 | 68477                 |
| 2    | 1089023364973210000 | 28128                 |
| 3    | 826332877457481000  | 27718                 |
| 4    | 1250331934242120000 | 25350                 |
| 5    | 1423662808311280000 | 21034                 |
| 6    | 1183144981252280000 | 20765                 |
| 7    | 1270672820792500000 | 20503                 |
| 8    | 820431428835885000  | 20063                 |
| 9    | 778785859030003000  | 19403                 |
| 10   | 1104295492433760000 | 18781                 |

**Task 2 Question**: Using the _bigTwitter.json_ and _sal.json_ file you will then count the number of tweets made in the various captical cities by all users. The result will be a table of the form (where the numbers are representative).

For this task, ignore tweets made by users in rural location, e.g. _lrnsw_ (Rural New South Wales), _1rvic_ (Rural Victoria) etc.

| Greater Capital City | Number of Tweets Made |
| :------------------: | :-------------------: |
|        1gsyd         |        2114445        |
|        2gmel         |        2280650        |
|        3gbri         |        855383         |
|        4gade         |        473982         |
|        5gper         |        589204         |
|        6ghob         |         90917         |
|        7gdar         |         46376         |
|        8acte         |        195459         |
|        9oter         |          203          |

**Task 3 Question**: The solution should identify those tweeters that have a tweeted in the most Greater Capital cities and the number of times they have tweeted from those locations. The top 10 tweeters making tweets from the most different locations should be returned and if there are equal number of locations, then these should be ranked by the number of tweets. Only those tweets made in Greater Capital cities should be counted.

| Rank | Author Id           | Number of Unique City Locations and #Tweets                                   |
| :--: | :------------------ | :---------------------------------------------------------------------------- |
|  1   | 702290904460169216  | 8 (#206 - #5gsyd ,#12gmel ,#7gbri ,#8gade ,#127gper ,#2ghob ,#1gdar ,#44acte) |
|  2   | 87188071            | 5 (#82 - #1gsyd ,#2gmel ,#1gbri ,#45gper ,#33acte)                            |
|  3   | 61220731            | 4 (#646 - #109gmel ,#39gbri ,#29gade ,#469acte)"                              |
|  4   | 921197448885886977  | 4 (#39 - #2gmel ,#4gade ,#27gper ,#6acte)                                     |
|  5   | 228664718           | 4 (#36 - #4gsyd ,#1gbri ,#27gper ,#4acte)                                     |
|  6   | 2225880756          | 4 (#13 - #4gsyd ,#5gdar ,#3acte ,#1oter)                                      |
|  7   | 1482557020528332801 | 4 (#6 - #1gsyd ,#2gbri ,#2gper ,#1acte)                                       |
|  8   | 987122373395595264  | 4 (#5 - #1gsyd ,#1gbri ,#1gade ,#2acte)                                       |
|  9   | 355186886           | 3 (#404 - #358gmel ,#1gper ,#45acte)                                          |
|  10  | 565012072           | 3 (#111 - #1gsyd ,#1gper ,#109acte)                                           |

For complete assignment 1 report, please check [overleaf](https://www.overleaf.com/read/sdsczmmdxzvq).

## License

The code will be public after 27th May 2023. For @copyright information please refer to [MIT License](./LICENSE).

<!-- TODO: create MIT license -->

---

<!-- TODO: write team name -->
<p align=right>2023@Wei & Sunchuangyu</p>
