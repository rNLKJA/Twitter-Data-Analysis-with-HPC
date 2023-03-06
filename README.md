<div align=center><h1>Cloud & Cluster Computing Assignment 1 <br> Social Media Analytics</h1></div>

## Project overview

The assignment is to implement a paralleized application leveraging the University of Melbourne HPC facility SPARTAN. The application will use a large Twitter dataset and a file containing suburbs, locations and Greater Capital cities of Australia.

The project objectives to:

- count the number of different tweets made in the Greater Capital cities of Australia,
- identify the Twitter accoutns (users) that have made the most tweets, and
- identify the users that have tweeted from the most different Greater Capital cities.

## Project Objectives

**_Project Deadline_**: Wednesday 5th April (by 12:00 noon).

- [ ] Create cluster and complete analysing jobs on SPARTAN.
- [ ] Project reports ([overleaf](https://www.overleaf.com/read/sdsczmmdxzvq))

## Short outcomes

<!-- TODO: complete a short outcome -->

## Team

| Name              | Student ID | Email                               |
| ----------------- | :--------: | ----------------------------------- |
| Sunchuangyu Huang |  1118472   | sunchuangyuh@student.unimelb.edu.au |
| Wei Zhao          |  1118649   | weizhao1@student.unimelb.edu.au     |

## For dev

Before you access, build, deploy or run any code, make sure you obtain your [**SPARTAN**](https://spartan-fastx.hpc.unimelb.edu.au/auth/ssh/) account and acquire your account from [**KAARAGE**](https://dashboard.hpc.unimelb.edu.au/karaage/applications/project/new/).

Typically, spartan use your student name as login id and the password set in karrage.

To log in SPARTAN through running the following command:

```{bash}
ssh [unimelb-username]@spartan.hpc.unimelb.edu.au

# password = karaage password
```

After login, please check the `/data/projeccts/COMP90024/` directory, make sure you obtain four twitter json files. Please create a soft link for quick access.

One more thing! For better development and testing, you may decide to use the tiny/small JSON files on your own device to save runtime.

**Test Benchmark**

The application should allow a given number of nodes and cores to be utilized. Specifically, the application should be run once to search the `bigTwitter.json` file on each of the following resources.

| NO. nodes | NO. cores                 |
| :-------: | :------------------------ |
|     1     | 1                         |
|     1     | 8                         |
|     2     | 8 (with 4 cores per node) |

**Submitting jobs**

PLEASE PLEASE PLEASE DO NOT SUBMIT AT THE HEAD NODE, if anything goes wrong it will kill the entire server.

The resources should be set when submitting the search application with the appropriate SLURM options. Note that you should run a single SLURM job \*three• separate times on each of the resources given here.

**Last words**
Strongly recommended that you follow the guidelines provided on access and use of the SPARTAN cluster, for more information, please check SPARTAN documentation.

## Directories

```
[Team]
|   |── data
|       |── raw
|             |── bigTwitter.json
|             |── smallTwitter.json
|             |── tinyTwitter.json
|             |── sal.json
|── notebooks
|── scripts
|   |── data_processing
|   |── feature_engineering
|   |── model_training
|   |── model_evaluation
|   |── model_inference
|   |── utils
|── models
|── requirements.txt
└── README.md
```

## Data Dictionary

The data dictionary is specificaly extracted from `sal.json` file to identiy the greater capital city. The greater capital city is defined via `gcc` attribute in `sal.json`, each greater capital city has the following regex format: `\dg[a-z]{3}`.

| gcc   | description       |
| ----- | :---------------- |
| 1gsyd | Greater Sydney    |
| 2gmel | Greater Melbourne |
| 3gbri | Greater Brisbane  |
| 4gade | Greater Adelaide  |
| 5gper | Greater Perth     |
| 6ghob | Greater Hobart    |
| 7gdar | Greater Darwin    |

## Assignment Dependencies

<!-- TODO: provide request dependence information and installatino methods, it will be good if there is a auto install/deployment script -->

## Assignment report

<!-- Write a short project outcomes here -->

For complete assignment 1 report, please check [overleaf](https://www.overleaf.com/read/sdsczmmdxzvq).

## License

The code will be public after 27th May 2023. For @copyright information please refer to [MIT License](./LICENSE).

<!-- TODO: create MIT license -->

---

<!-- TODO: write team name -->
<p align=right>2023@Wei & Sunchuangyu</p>
