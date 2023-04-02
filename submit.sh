#/bin/bash

# check virtualenv folder exist
# if not then create new folder
username=$(whoami)
folder_name="/home/${username}/virtualenv"
target_virtual_env="/home/${username}/virtualenv/python3.7.4"
virtual_env="python3.7.4"
submission_pwd=$(pwd)

echo $submission_pwd

if [ ! -d "$folder_name" ]; then
    mkdir "$folder_name"
    echo "Create virtualenv folder"
    
    module load python/3.7.4
    virtualenv "${virtual_env}"

else
    if [ ! -d "$target_virtual_env" ]; then
        module load python/3.7.4
        virtualenv "${virtual_env}"
    fi
fi

echo "submitting job..."
cd ${submission_pwd}
# submit the job
# sbatch slurm/1node1core.bigTwitter.slurm
# sbatch slurm/1node8core.bigTwitter.slurm
# sbatch slurm/2node8core.bigTwitter.slurm

echo "job submitted"

# log current job list
squeue -u $(whoami)
