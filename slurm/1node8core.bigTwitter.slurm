#!/bin/bash
#SBATCH --job-name=tinyTwitter_1_core_8_node

##set task request resources
#SBATCH --time=00:15:00
#SBATCH --nodes=8

##set standard output
#SBATCH --output=/home/sunchuangyuh/A1/doc/slurm/stdout/slurm.%x.%N.%j.out
#SBATCH --error=/home/sunchuangyuh/A1/doc/slurm/stderr/slurm.%x.%N.%j.err 

##send job information to target user
#SBATCH --mail-user=sunchuangyuh@student.unimelb.edu.au
#SBATCH --mail-type=ALL

##load required modules
module --force purge
# module load python/3.9.6
module load mpi4py/3.0.2-timed-pingpong
module load python/3.7.4
pip3 install numpy pandas 

##run main program here
srun mpiexec -n 8 python3 main.py -t "tinyTwitter"

