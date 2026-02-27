#!/bin/zsh
set -euo pipefail

LABEL="com.chezbro.website-biz-worker"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
rm -f "$PLIST_PATH"

echo "Uninstalled: $LABEL"
