import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from logger import return_filename as filename
from logger import return_full_path as full_path # import logger


def send_log():
    smtp_server = 'smtp.163.com'
    smtp_port = 25
    smtp_username = 'zw0432751551@163.com'
    smtp_password = 'HTBGKRUUQOBFDEBL'
    smtp_connection = smtplib.SMTP(smtp_server, smtp_port)
    smtp_connection.login(smtp_username, smtp_password)

    log_file_path = full_path
    log_file_name = filename
    with open(log_file_path, 'rb') as file:
        log_file_data = file.read()
    log_file_attachment = MIMEApplication(log_file_data, Name=log_file_name)
    log_file_attachment['Content-Disposition'] = f'attachment; filename="{log_file_name}"'
    message = MIMEMultipart()
    message.attach(log_file_attachment)

    message['From'] = 'zw0432751551@163.com'
    message['To'] = 'zw0432751551@gmail.com'
    message['Subject'] = 'Log file'
    message.attach(MIMEText('Please find attached the log file.'))

    smtp_connection.sendmail(smtp_username, 'recipient_email_address@example.com', message.as_string())
    smtp_connection.quit()
    print ("Email sent successfully")