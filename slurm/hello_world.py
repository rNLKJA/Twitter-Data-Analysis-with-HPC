import datetime
import time

# testing message written by sunchuangyuh@student.unimelb.edu.au
message = """
This is a message from Sunchuangyu Huang, you are currently running the test slurm script,
please check slurm output files to check job submission status.

Note, please do not copy the code directly to avoid any plagarism issues.
Thanks

Wei Zhao & Sunchuangyu Huang
"""

print(message)

# the script should generate a text file include slurm run time information
with open("hello_world.txt", "w") as f:
    current_time = datetime.datetime.now()
    time_str = current_time.strftime("%Y-%m-%d %H:%M:%S")   

    f.write(f"{time_str}: slurm job start, call by Rin\n")

with open("hello_world.txt", "a") as f:
    current_time = datetime.datetime.now()
    time_str = current_time.strftime("%Y-%m-%d %H:%M:%S")
    
    f.write(f"{time_str}: slurm job end, end by Eric\n")
   
