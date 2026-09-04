#!/usr/bin/env bash
# =====================================================================
#  Publish the website (the site/ folder) to the Lightsail server.
#
#  Run this from YOUR computer, from the top folder of this repo:
#
#     ./deploy/deploy.sh 3.15.22.101
#     ./deploy/deploy.sh 3.15.22.101 ~/Downloads/LightsailDefaultKey-us-east-2.pem
#
#  First value  = the server's static IP (or domain name once DNS is set).
#  Second value = path to the SSH key you downloaded from Lightsail
#                 (optional; defaults to LIGHTSAIL_KEY or the usual download name).
#
#  Windows: run this inside Git Bash or WSL. Mac/Linux: run in Terminal.
#
#  Every run replaces what is on the server with what is in site/.
#  So: edit files in site/, run this, refresh the browser. Done.
# =====================================================================
set -euo pipefail

HOST="${1:-${LIGHTSAIL_HOST:-}}"
KEY="${2:-${LIGHTSAIL_KEY:-$HOME/Downloads/LightsailDefaultKey-us-east-2.pem}}"
USER_NAME="ubuntu"
REMOTE_DIR="/var/www/martindale"

if [[ -z "$HOST" ]]; then
  echo "Usage: ./deploy/deploy.sh <server-ip-or-domain> [path-to-ssh-key.pem]"
  exit 1
fi
if [[ ! -f "$KEY" ]]; then
  echo "SSH key not found at: $KEY"
  echo "Download it from Lightsail: Account (top right) -> SSH keys -> Download."
  echo "Then run:  ./deploy/deploy.sh $HOST /path/to/that/file.pem"
  exit 1
fi

# Always run from the repo root so site/ resolves correctly.
cd "$(dirname "$0")/.."
if [[ ! -f site/index.html ]]; then
  echo "Can't find site/index.html — run this from the repo folder."
  exit 1
fi

chmod 600 "$KEY" 2>/dev/null || true
SSH_OPTS=(-i "$KEY" -o StrictHostKeyChecking=accept-new)

echo "Publishing site/ -> $USER_NAME@$HOST:$REMOTE_DIR"

if command -v rsync >/dev/null 2>&1; then
  # rsync only sends changed files and deletes files you removed locally.
  rsync -az --delete \
    --exclude 'README-SITE.md' --exclude '.DS_Store' --exclude 'Thumbs.db' \
    -e "ssh ${SSH_OPTS[*]}" \
    site/ "$USER_NAME@$HOST:$REMOTE_DIR/"
else
  # Fallback when rsync isn't installed (plain Windows Git Bash): copy everything.
  echo "(rsync not found, using scp instead)"
  scp "${SSH_OPTS[@]}" -r site/. "$USER_NAME@$HOST:$REMOTE_DIR/"
  ssh "${SSH_OPTS[@]}" "$USER_NAME@$HOST" "rm -f $REMOTE_DIR/README-SITE.md"
fi

echo
echo "Done. Open http://$HOST in your browser (Ctrl+Shift+R to bypass cache)."
