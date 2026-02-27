#!/bin/zsh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

# launchd has a minimal PATH; include Homebrew binaries for node/npm.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
NPM_BIN="/opt/homebrew/bin/npm"

# Load local env for worker (API keys, SMTP, Supabase, etc.)
if [ -f .env.local ]; then
  set -a
  source ./.env.local
  set +a
fi

exec "$NPM_BIN" run worker
