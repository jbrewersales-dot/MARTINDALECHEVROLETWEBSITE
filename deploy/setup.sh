#!/bin/bash
# =====================================================================
#  Martindale Chevrolet — full server setup on Ubuntu (Lightsail)
#
#  Paste this into the Lightsail browser terminal (instance -> Connect):
#
#    curl -fsSL https://raw.githubusercontent.com/jbrewersales-dot/MARTINDALECHEVROLETWEBSITE/main/deploy/setup.sh | sudo bash
#
#  Or paste the whole file as the "launch script" when creating the instance.
#  Safe to run again any time; it only changes what's missing.
#
#  What it does:
#    1. Installs nginx, Node.js 22, certbot.
#    2. Downloads the app from GitHub into /srv/martindale.
#    3. Creates /srv/martindale/.env with random secrets and a first
#       staff login (printed at the end and saved to /root/martindale-portal-login.txt).
#    4. Runs the app as a system service (starts on boot, restarts if it crashes).
#    5. Points nginx at it on port 80.
# =====================================================================
set -euo pipefail
BRANCH="${1:-main}"
REPO="jbrewersales-dot/MARTINDALECHEVROLETWEBSITE"
APP_DIR="/srv/martindale"
APP_USER="ubuntu"
export DEBIAN_FRONTEND=noninteractive

if [[ $EUID -ne 0 ]]; then echo "Run with sudo."; exit 1; fi
id "$APP_USER" >/dev/null 2>&1 || APP_USER="www-data"

wait_apt() { local n=0; while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || fuser /var/lib/apt/lists/lock >/dev/null 2>&1; do [[ $n -eq 0 ]] && echo "Ubuntu is installing its own updates — waiting for it to finish..."; n=$((n+1)); sleep 5; done; }

echo "== 1/5 Installing packages"
wait_apt; apt-get update -y -qq
wait_apt; apt-get install -y -qq nginx certbot python3-certbot-nginx unzip curl ca-certificates unattended-upgrades >/dev/null
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  wait_apt; apt-get install -y -qq nodejs >/dev/null
fi
echo "   node $(node -v), npm $(npm -v)"

echo "== 2/5 Downloading the app (branch: $BRANCH)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://github.com/$REPO/archive/refs/heads/$BRANCH.zip" -o "$TMP/repo.zip"
unzip -q "$TMP/repo.zip" -d "$TMP"
SRC="$(find "$TMP" -maxdepth 1 -mindepth 1 -type d | head -1)/app"
[[ -f "$SRC/server.js" ]] || { echo "Download did not contain app/server.js"; exit 1; }
mkdir -p "$APP_DIR/data"
# copy everything except the things that belong to this server
(cd "$SRC" && tar --exclude=./data --exclude=./node_modules --exclude=./.env -cf - .) | tar -xf - -C "$APP_DIR"
cp -n "$SRC/data/seed-vehicles.json" "$APP_DIR/data/" 2>/dev/null || true
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
echo "   installing app dependencies"
sudo -u "$APP_USER" -H bash -c "cd '$APP_DIR' && npm ci --omit=dev --no-audit --no-fund --loglevel=error"

echo "== 3/5 Secrets and first login"
LOGIN_FILE="/root/martindale-portal-login.txt"
if [[ ! -f "$APP_DIR/.env" ]]; then
  ADMIN_PW="$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 14)"
  PUBLIC_IP="$(curl -fsS --max-time 5 http://checkip.amazonaws.com 2>/dev/null || hostname -I | awk '{print $1}')"
  cat > "$APP_DIR/.env" <<ENV
NODE_ENV=production
PORT=3000
DATA_DIR=$APP_DIR/data
SESSION_SECRET=$(openssl rand -hex 32)
APP_ENCRYPTION_KEY=$(openssl rand -hex 32)
ADMIN_EMAIL=jbrewersales@gmail.com
ADMIN_PASSWORD=$ADMIN_PW
ADMIN_NAME=Admin
NOTIFY_TO=jbrewersales@gmail.com
SITE_URL=http://$PUBLIC_IP
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
ENV
  chmod 600 "$APP_DIR/.env"; chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
  printf 'Martindale staff portal\nURL:      http://%s/portal\nEmail:    jbrewersales@gmail.com\nPassword: %s\n\nChange the password under Portal > Settings.\n' "$PUBLIC_IP" "$ADMIN_PW" > "$LOGIN_FILE"; chmod 600 "$LOGIN_FILE"
else
  echo "   .env already exists — keeping it"
fi

echo "== 4/5 Running the app as a service"
cat > /etc/systemd/system/martindale.service <<UNIT
[Unit]
Description=Martindale Chevrolet website and staff portal
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=/usr/bin/node --no-warnings=ExperimentalWarning server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable martindale >/dev/null 2>&1
systemctl restart martindale
sleep 3
if ! curl -fsS -o /dev/null http://127.0.0.1:3000/; then echo "The app did not start. Last log lines:"; journalctl -u martindale -n 30 --no-pager; exit 1; fi

echo "== 5/5 nginx"
cat > /etc/nginx/sites-available/martindale <<'NGINX'
server {
    listen 80 default_server;
    server_name _;
    client_max_body_size 40m;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/martindale /etc/nginx/sites-enabled/martindale
rm -f /etc/nginx/sites-enabled/default
systemctl disable --now apache2 2>/dev/null || true
nginx -t -q
systemctl enable nginx >/dev/null 2>&1
# free port 80 from anything that isn't nginx, then (re)start nginx
for pid in $(fuser 80/tcp 2>/dev/null); do [[ "$(cat /proc/$pid/comm 2>/dev/null)" == "nginx" ]] || kill "$pid" 2>/dev/null || true; done
systemctl restart nginx

echo
echo "======================================================="
echo " Done. The site is live on port 80."
if [[ -f "$LOGIN_FILE" ]]; then cat "$LOGIN_FILE"; echo; echo " (This is also saved in $LOGIN_FILE — 'sudo cat $LOGIN_FILE' shows it again.)"; fi
echo "======================================================="
