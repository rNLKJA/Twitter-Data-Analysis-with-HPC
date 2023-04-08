#!/bin/bash
#SBATCH --job-name=bigTwitter_1_core_1_node

##set task request resources
#SBATCH --time=01:00:00
#SBATCH --nodes=1
#SBATCH --ntasks-per-node=1
#SBATCH --mem-per-cpu=5G

##set standard output
#SBATCH --output=/home/sunchuangyuh/A1/doc/slurm/stdout/slurm.%j.out
#SBATCH --error=/home/sunchuangyuh/A1/doc/slurm/stderr/slurm.%j.err 

##send job information to target user
#SBATCH --mail-user=sunchuangyuh@student.unimelb.edu.au
#SBATCH --mail-type=ALL

##load required modules
module --force purge
module load mpi4py/3.0.2-timed-pingpong

##run main program here
mpiexec -n 1 ./main.bin -t "bigTwitter.json" -s "sal.json"

##stdout current job status
my-job-stats -a -n -s
