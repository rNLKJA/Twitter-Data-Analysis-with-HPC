"""
Log file sender through smtp server
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from .logger import FULL_PATH  # import log file path

def send_log(target: str) -> None:
    """
    # send log file to developer's email for status check & running time collection
    """

    if target == 'rin':
        email = "sunchuangyuh@student.unimelb.edu.au"
    elif target == 'wei':
        email = 'zw0432751551@gmail.com'
    else:
        return

    # define smtp server and port
    smtp_server = 'smtp.163.com'
    smtp_port = 25
    smtp_username = 'zw0432751551@163.com'
    smtp_password = 'HTBGKRUUQOBFDEBL'
    smtp_connection = smtplib.SMTP(smtp_server, smtp_port)
    smtp_connection.login(smtp_username, smtp_password)


    # get the full path of log file
    log_file_path = FULL_PATH

    with open(log_file_path, 'r') as file:
        log_file_data = file.read()

    # set the email content body
    message = MIMEText(log_file_data)


    # set the email header
    message['From'] = 'zw0432751551@163.com'
    message['To'] = email
    message['Subject'] = 'Log file'

    # send the email
    smtp_connection.sendmail(smtp_username, email, message.as_string())
    smtp_connection.quit()

    return