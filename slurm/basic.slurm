#!/bin/bash
#SBATCH --job-name=basic_slurm

##set task request resources
#SBATCH --time=00:15:00
#SBATCH --nodes=1
#SBATCH --ntasks-per-node=1

##set standard output
#SBATCH --output=/home/sunchuangyuh/A1/doc/slurm/stdout/slurm.%x.%N.%j.out
#SBATCH --error=/home/sunchuangyuh/A1/doc/slurm/stderr/slurm.%x.%N.%j.err 

##send job information to target user
#SBATCH --mail-user=sunchuangyuh@student.unimelb.edu.au
#SBATCH --mail-type=ALL

##load required modules
module --force purge
# module load miniconda3/4.9.2
# conda create -n a1 python=3.10 pandas numpy pyarrow mpi4py -y
# conda init bash
# conda activate a1

module load python/3.7.4
module load mpi4py/3.0.2-timed-pingpong
pip3 install numpy pandas 

#SBATCH --cpus-per-task=1
##run main program here
srun mpiexec -n 1 python3 /home/sunchuangyuh/A1/slurm/hello_world.py

echo "JOB DONE"

