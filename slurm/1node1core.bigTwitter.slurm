#!/bin/bash
#SBATCH --job-name=bigTwitter_1_core_1_node

##set task request resources
#SBATCH --time=02:00:00
#SBATCH --nodes=1
#SBATCH --ntasks-per-node=1
#SBATCH --mem-per-cpu=8G

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
pip3 install numpy pandas polars --user

##run main program here
mpiexec -n 1 python main.py -t "bigTwitter.json" -s "sal.json"

##stdout current job status
my-job-stats -a -n -s
