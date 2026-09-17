#!/usr/bin/env bash
# =====================================================================
#  Turn on free HTTPS (the padlock) with Let's Encrypt.
#
#  Run this ON THE SERVER (Lightsail browser terminal), ONE time,
#  AFTER your domain name points at the server's static IP:
#
#     curl -fsSL https://raw.githubusercontent.com/jbrewersales-dot/MARTINDALECHEVROLETWEBSITE/main/deploy/enable-https.sh -o enable-https.sh
#     sudo bash enable-https.sh martindalechevrolet.com you@email.com
#
#  It sets the domain in nginx, gets a certificate for both
#  yourdomain.com and www.yourdomain.com, and turns on automatic
#  http -> https redirects. Certificates renew themselves forever.
# =====================================================================
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
CONF="/etc/nginx/sites-available/martindale"

if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
  echo "Usage: sudo bash enable-https.sh <domain> <your-email>"
  echo "Example: sudo bash enable-https.sh martindalechevrolet.com bo@martindalechevrolet.com"
  exit 1
fi
if [[ $EUID -ne 0 ]]; then
  echo "Please run with sudo."
  exit 1
fi

# Tell nginx which domain this server answers to (certbot needs this to find the block).
sed -i "s/^\(\s*\)server_name .*;/\1server_name $DOMAIN www.$DOMAIN;/" "$CONF"
nginx -t
systemctl reload nginx

certbot --nginx \
  -d "$DOMAIN" -d "www.$DOMAIN" \
  --non-interactive --agree-tos --redirect \
  -m "$EMAIL"

# Links in alert emails should use the real address now
if [[ -f /srv/martindale/.env ]]; then sed -i "s|^SITE_URL=.*|SITE_URL=https://$DOMAIN|" /srv/martindale/.env; systemctl restart martindale; fi

echo
echo "HTTPS is on. Open https://$DOMAIN"
echo "Auto-renewal check:"
systemctl list-timers certbot.timer --no-pager || true
