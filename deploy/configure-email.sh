#!/bin/bash
# =====================================================================
#  Turn on email alerts (new credit application / trade-in / lead)
#  using a Gmail account and an "App password".
#
#  On the server:
#    sudo bash configure-email.sh jbrewersales@gmail.com "abcd efgh ijkl mnop"
#
#  Make the app password at: Google Account -> Security -> 2-Step Verification
#  (must be on) -> App passwords -> create one named "Martindale site".
# =====================================================================
set -euo pipefail
GMAIL="${1:-}"; APPPW="${2:-}"; ENVF="/srv/martindale/.env"
[[ -n "$GMAIL" && -n "$APPPW" ]] || { echo "Usage: sudo bash configure-email.sh you@gmail.com \"app password\""; exit 1; }
[[ -f "$ENVF" ]] || { echo "App not installed ($ENVF missing)."; exit 1; }
APPPW="${APPPW// /}"
set_var() { grep -q "^$1=" "$ENVF" && sed -i "s|^$1=.*|$1=$2|" "$ENVF" || echo "$1=$2" >> "$ENVF"; }
set_var SMTP_HOST smtp.gmail.com; set_var SMTP_PORT 587; set_var SMTP_USER "$GMAIL"; set_var SMTP_PASS "$APPPW"
grep -q "^NOTIFY_TO=." "$ENVF" || set_var NOTIFY_TO "$GMAIL"
systemctl restart martindale
echo "Email alerts on. Sending from $GMAIL to $(grep '^NOTIFY_TO=' "$ENVF" | cut -d= -f2). Change the 'to' address under Portal > Settings."
