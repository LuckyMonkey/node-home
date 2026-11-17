#!/bin/sh
# Build and check Fridge Emoji. Needs python3 (with venv) and network once for the pinned tools.
set -eu
cd "$(dirname "$0")"
[ -x .venv/bin/python ] || python3 -m venv .venv
.venv/bin/pip install -q -r requirements.txt
.venv/bin/python build.py
.venv/bin/python validate.py
