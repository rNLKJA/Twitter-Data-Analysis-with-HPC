#!/bin/bash
#SBATCH --job-name=basic_slurm

##set task request resources
#SBATCH --time=00:15:00
#SBATCH --nodes=1
#SBATCH --ntasks-per-node=8

##set standard output
#SBATCH --output=/home/sunchuangyuh/A1/doc/log/slurm/stdout/slurm.%x.%N.%j.out
#SBATCH --error=/home/sunchuangyuh/A1/doc/log/slurm/stderr/slurm.%x.%N.%j.err 

##send job information to target user
#SBATCH --mail-user=sunchuangyuh@student.unimelb.edu.au
#SBATCH --mail-type=ALL

##load required modules
module --force purge
module load python/3.9.6
module load mpi4py/3.0.2-timed-pingpong
pip3 install numpy pandas pyarrow --user

##run main program here
srun mpiexec -n 1 python3 main.py -t "tinyTwitter.json"

