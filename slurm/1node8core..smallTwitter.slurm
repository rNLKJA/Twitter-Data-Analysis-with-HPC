#!/bin/bash
#SBATCH --job-name=smallTwitter_1_core_8_node

##set task request resources
#SBATCH --time=00:15:00
#SBATCH --nodes=1
#SBATCH --ntasks-per-node=8
#SBATCH --cpus-per-task=1

##set standard output
#SBATCH --output=/home/sunchuangyuh/A1/doc/slurm/stdout/slurm.%x.%N.%j.out
#SBATCH --error=/home/sunchuangyuh/A1/doc/slurm/stderr/slurm.%x.%N.%j.err 

##send job information to target user
#SBATCH --mail-user=sunchuangyuh@student.unimelb.edu.au
#SBATCH --mail-type=ALL

##load required modules
module --force purge
module load mpi4py/3.0.2-timed-pingpong
module load python/3.7.4
pip3 install numpy pandas 

##run main program here
mpiexec -np 8 python3 main.py -t "smallTwitter"

