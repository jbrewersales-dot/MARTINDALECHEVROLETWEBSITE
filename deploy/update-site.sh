#!/bin/bash
# =====================================================================
#  Update the running app to the latest code on GitHub.
#
#  Paste into the Lightsail browser terminal:
#    curl -fsSL https://raw.githubusercontent.com/jbrewersales-dot/MARTINDALECHEVROLETWEBSITE/main/deploy/update-site.sh | sudo bash
#
#  Keeps your database, uploaded photos, and .env exactly as they are.
#  Different branch:  ... | sudo bash -s -- some-branch
# =====================================================================
set -euo pipefail
BRANCH="${1:-main}"
REPO="jbrewersales-dot/MARTINDALECHEVROLETWEBSITE"
APP_DIR="/srv/martindale"
[[ -f "$APP_DIR/.env" ]] || { echo "The app isn't installed yet. Run deploy/setup.sh first."; exit 1; }
APP_USER="$(stat -c %U "$APP_DIR/.env")"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
echo "Downloading branch '$BRANCH'..."
curl -fsSL "https://github.com/$REPO/archive/refs/heads/$BRANCH.zip" -o "$TMP/repo.zip"
unzip -q "$TMP/repo.zip" -d "$TMP"
SRC="$(find "$TMP" -maxdepth 1 -mindepth 1 -type d | head -1)/app"
[[ -f "$SRC/server.js" ]] || { echo "Download did not contain app/server.js"; exit 1; }
# remove old code (not data/.env/node_modules), copy new code in
(cd "$APP_DIR" && find . -mindepth 1 -maxdepth 1 ! -name data ! -name node_modules ! -name .env -exec rm -rf {} +)
(cd "$SRC" && tar --exclude=./data --exclude=./node_modules --exclude=./.env -cf - .) | tar -xf - -C "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
sudo -u "$APP_USER" -H bash -c "cd '$APP_DIR' && npm ci --omit=dev --no-audit --no-fund --loglevel=error"
systemctl restart martindale
sleep 3
if curl -fsS -o /dev/null http://127.0.0.1:3000/; then echo; echo "Done. The site is running the latest code from '$BRANCH'."; else echo "The app did not come back up:"; journalctl -u martindale -n 30 --no-pager; exit 1; fi
