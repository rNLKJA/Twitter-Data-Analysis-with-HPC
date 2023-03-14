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
| 8acte | Canberra          |

TODO: define terminologies

- `bbox`
- `gcc`
- `sal`

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
