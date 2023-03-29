"""
Log file sender through smtp server
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from .logger import FULL_PATH  # import log file path

# send log file to developer's email for status check & running time collection
def send_log():

    # define smtp server and port
    smtp_server = 'smtp.163.com'
    smtp_port = 25
    smtp_username = 'redacted@example.com'
    smtp_password = 'REVOKED_AUTH_CODE'
    smtp_connection = smtplib.SMTP(smtp_server, smtp_port)
    smtp_connection.login(smtp_username, smtp_password)


    # get the full path of log file
    log_file_path = FULL_PATH

    with open(log_file_path, 'r') as file:
        log_file_data = file.read()

    # set the email content body
    message = MIMEText(log_file_data)


    # set the email header
    message['From'] = 'redacted@example.com'
    message['To'] = 'redacted@example.com'
    message['Subject'] = 'Log file'

    # send the email
    smtp_connection.sendmail(smtp_username, 'redacted@example.com', message.as_string())
    smtp_connection.quit()