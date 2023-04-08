#!/bin/bash

# check virtualenv folder exist
username=$(whoami)
virtual_env="/home/${username}/virtualenv/python3.7.4"

if [ ! -d "$virtual_env" ]; then
    module load python/3.7.4
    virtualenv "${virtual_env}"    
fi

echo "Submitting job... submit by ${username}"
sbatch slurm/1node1core.bigTwitter.slurm
sbatch slurm/1node8core.bigTwitter.slurm
sbatch slurm/2node8core.bigTwitter.slurm

echo "Job submitted, print job status ::"

# log current job list
squeue -u $(whoami)
