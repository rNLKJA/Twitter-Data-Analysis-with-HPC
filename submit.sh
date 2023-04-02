#!/bin/bash

# check virtualenv folder exist
# if not then create new folder
username=$(whoami)
virtual_env="/home/${username}/virtualenv/python3.7.4"

if [ ! -d "$virtual_env"]
    module load python/3.7.4
    virtualenv "${virtual_env}"    
fi

echo "submitting job..."
# submit the job
# sbatch slurm/1node1core.bigTwitter.slurm
# sbatch slurm/1node8core.bigTwitter.slurm
# sbatch slurm/2node8core.bigTwitter.slurm

echo "job submitted"

# log current job list
squeue -u $(whoami)
