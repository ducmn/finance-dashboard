#!/usr/bin/env bash
# Self-contained launcher: activates venv and runs the FastAPI app.
# Resolves its own location so it works from launchd, cron, or anywhere.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

# shellcheck disable=SC1091
source venv/bin/activate

exec python main.py
