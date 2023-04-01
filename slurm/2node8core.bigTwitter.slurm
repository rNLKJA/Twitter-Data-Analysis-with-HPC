#!/bin/bash
#SBATCH --job-name=bigTwitter_2_core_8_node

##set task request resources
#SBATCH --time=00:20:00
#SBATCH --nodes=2
#SBATCH --ntasks-per-node=4
#SBATCH --cpus-per-task=1
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
pip3 install numpy pandas polars

##run main program here
mpiexec -n 8 python main.py -t "bigTwitter.json" -s "sal.json"

##stdout current job status
my-job-stats -a -n -s
