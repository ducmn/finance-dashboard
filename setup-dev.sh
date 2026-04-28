#!/usr/bin/env bash
# One-time local setup: Python venv + Node deps.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "Setting up Python venv..."
[ -d venv ] || python3 -m venv venv
# shellcheck disable=SC1091
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo "Setting up frontend..."
(cd frontend && npm install)

echo
echo "Done. Next:"
echo "  cp accounts.example.json accounts.json   # fill in your numbers"
echo "  cp cashflow.example.json cashflow.json   # fill in your cash flow"
echo "  echo 'STARLING_TOKEN=...' > .env         # optional, for live Starling"
echo "  ./bin/install-launchd.sh                 # auto-start on login"
echo
echo "Or run once: source venv/bin/activate && python main.py"
