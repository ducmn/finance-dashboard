#!/usr/bin/env bash
# Install a launchd agent so the dashboard starts on macOS login and
# is restarted automatically if it crashes. Idempotent.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="com.finance-dashboard"
PLIST_DST="$HOME/Library/LaunchAgents/${LABEL}.plist"

mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST_DST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${DIR}/bin/run-dashboard.sh</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${DIR}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/finance-dashboard.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/finance-dashboard.err.log</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl load "$PLIST_DST"

echo "Installed ${PLIST_DST}"
echo "Dashboard is now running on http://localhost:8000 (and will auto-start on login)."
echo
echo "Useful commands:"
echo "  tail -f /tmp/finance-dashboard.log         # live logs"
echo "  launchctl unload $PLIST_DST  # stop + disable"
echo "  launchctl load $PLIST_DST    # start + enable"
