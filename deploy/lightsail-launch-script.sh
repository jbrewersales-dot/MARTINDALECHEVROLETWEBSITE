#!/bin/bash
# =====================================================================
#  Martindale Chevrolet — Lightsail first-boot setup
#
#  HOW TO USE: copy this ENTIRE file and paste it into the
#  "Launch script" box when you create the Lightsail instance
#  (Ubuntu 24.04 LTS, "OS Only"). Lightsail runs it once, as root,
#  the first time the server starts. It takes about 2 minutes.
#
#  What it does:
#    1. Installs nginx (the web server) and certbot (free HTTPS).
#    2. Creates the folder the website lives in: /var/www/martindale
#    3. Installs the nginx config and puts up a "server is ready" page.
#
#  If you already created the instance without it, you can also run:
#    curl -fsSL <raw url of this file> | sudo bash
#  from the instance's browser-based SSH window.
# =====================================================================
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y nginx certbot python3-certbot-nginx rsync unzip

# Website folder, owned by the normal "ubuntu" user so deploy.sh can write to it.
mkdir -p /var/www/martindale
chown -R ubuntu:ubuntu /var/www/martindale

# Temporary page so you can confirm the server works before the site is uploaded.
cat > /var/www/martindale/index.html <<'HTML'
<!DOCTYPE html><html><head><meta charset="utf-8"><title>Martindale Chevrolet — server ready</title>
<style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem;color:#262115}</style></head>
<body><h1>Server is ready.</h1>
<p>This is the Martindale Chevrolet Lightsail server. The website has not been uploaded yet.</p>
<p>Next step: run <code>deploy/deploy.sh</code> from your computer (see HANDOFF-LIGHTSAIL.md, Step 6).</p>
</body></html>
HTML

# Nginx config (same content as deploy/nginx/martindale.conf in the repo).
cat > /etc/nginx/sites-available/martindale <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    root /var/www/martindale;
    index index.html;
    location / {
        try_files $uri $uri/ $uri.html =404;
    }
    location ~* \.(css|js|png|jpg|jpeg|gif|webp|svg|ico|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public";
    }
    location = /inventory/vehicles.json {
        add_header Cache-Control "no-cache";
    }
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;
    add_header Referrer-Policy strict-origin-when-cross-origin;
    location ~ /\. {
        deny all;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/martindale /etc/nginx/sites-enabled/martindale
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl restart nginx

# Keep security updates coming automatically.
apt-get install -y unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "Martindale Lightsail setup finished."
