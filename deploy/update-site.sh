#!/usr/bin/env bash
# =====================================================================
#  Publish / update the website ON THE SERVER, straight from GitHub.
#
#  Run this in the Lightsail browser SSH window (instance -> Connect),
#  every time you want the live site to match GitHub:
#
#     curl -fsSL https://raw.githubusercontent.com/jbrewersales-dot/MARTINDALECHEVROLETWEBSITE/main/deploy/update-site.sh | sudo bash
#
#  It downloads the latest copy of the repo (main branch) and copies
#  the site/ folder into /var/www/martindale.
#
#  Different branch:   ... | sudo bash -s -- claude/some-branch
#  No SSH key, no Git Bash, nothing to install on your own computer.
# =====================================================================
set -euo pipefail

BRANCH="${1:-main}"
REPO="jbrewersales-dot/MARTINDALECHEVROLETWEBSITE"
SITE_ROOT="/var/www/martindale"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

command -v unzip >/dev/null || { apt-get update -qq; apt-get install -y -qq unzip; }

echo "Downloading branch '$BRANCH' from GitHub..."
curl -fsSL "https://github.com/$REPO/archive/refs/heads/$BRANCH.zip" -o "$TMP/repo.zip"
unzip -q "$TMP/repo.zip" -d "$TMP"
SRC="$(find "$TMP" -maxdepth 1 -mindepth 1 -type d | head -1)/site"
[[ -f "$SRC/index.html" ]] || { echo "Download did not contain site/index.html"; exit 1; }

echo "Copying to $SITE_ROOT ..."
# Build the new copy next to the live one, then swap folders so the site is never half-copied.
rm -rf "$SITE_ROOT.new" "$SITE_ROOT.old"
mkdir -p "$SITE_ROOT.new"
cp -a "$SRC/." "$SITE_ROOT.new/"
rm -f "$SITE_ROOT.new/README-SITE.md" "$SITE_ROOT.new/.DS_Store" "$SITE_ROOT.new/Thumbs.db"
chown -R ubuntu:ubuntu "$SITE_ROOT.new" 2>/dev/null || true
[[ -d "$SITE_ROOT" ]] && mv "$SITE_ROOT" "$SITE_ROOT.old"
mv "$SITE_ROOT.new" "$SITE_ROOT"
rm -rf "$SITE_ROOT.old"

echo
echo "Done. The live site now matches site/ on branch '$BRANCH'."
echo "Open the site in a browser and press Ctrl+Shift+R to refresh."
