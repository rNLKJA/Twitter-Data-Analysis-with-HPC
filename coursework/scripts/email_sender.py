"""
Log file sender through smtp server

SMTP settings are read from environment variables so that no credential is
ever committed to the repository. See coursework/.env.example for the full
list. When the variables are missing the sender logs a warning and returns
without sending, so the analysis itself never depends on email delivery.
"""

import logging
import os
import smtplib
from email.mime.text import MIMEText

from .logger import FULL_PATH  # import log file path

_logger = logging.getLogger("twitter_logger")


def _recipient_for(target: str):
    """
    Map the -e/--email CLI flag ('rin' or 'wei') to a recipient address that
    is configured through the environment.
    """
    return {
        "rin": os.environ.get("LOG_EMAIL_RIN"),
        "wei": os.environ.get("LOG_EMAIL_WEI"),
    }.get(target)


def send_log(target: str) -> None:
    """
    # send log file to developer's email for status check & running time collection
    """

    email = _recipient_for(target)
    if not email:
        return

    # define smtp server and port
    smtp_server = os.environ.get("SMTP_HOST")
    smtp_port = int(os.environ.get("SMTP_PORT", "25"))
    smtp_username = os.environ.get("SMTP_USERNAME")
    smtp_password = os.environ.get("SMTP_PASSWORD")

    if not (smtp_server and smtp_username and smtp_password):
        _logger.warning("SMTP_* environment variables not set; skipping log email.")
        return

    smtp_connection = smtplib.SMTP(smtp_server, smtp_port)
    smtp_connection.login(smtp_username, smtp_password)

    # get the full path of log file
    log_file_path = FULL_PATH

    with open(log_file_path, "r") as file:
        log_file_data = file.read()

    # set the email content body
    message = MIMEText(log_file_data)

    # set the email header
    message["From"] = os.environ.get("SMTP_FROM", smtp_username)
    message["To"] = email
    message["Subject"] = "Log file"

    # send the email
    smtp_connection.sendmail(smtp_username, email, message.as_string())
    smtp_connection.quit()

    return
