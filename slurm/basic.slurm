#!/bin/bash
#SBATCH --job-name=basic_slurm

##set task request resources
#SBATCH --time=00:15:00
#SBATCH --nodes=1
#SBATCH --ntasks-per-node=1
#SBATCH --cpus-per-task=1

##set standard output
#SBATCH --output=/home/sunchuangyuh/A1/slurm/output/stdout/slurm.%x.%N.%j.out
#SBATCH --error=/home/sunchuangyuh/A1/slurm/output/stderr/slurm.%x.%N.%j.err 

##send job information to target user
#SBATCH --mail-user=sunchuangyuh@student.unimelb.edu.au
#SBATCH --mail-type=ALL

##load required modules
module --force purge
module load python/3.9.6
module load mpi4py/3.0.2-timed-pingpong

##run main program here
python3 hello_world.py
