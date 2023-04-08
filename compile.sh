#!/bin/bash
nuitka3 --standalone --noinclude-IPython-mode=allow --follow-imports --include-module=pandas._config.localization main.py
