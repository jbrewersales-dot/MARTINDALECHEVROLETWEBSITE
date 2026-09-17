# Martindale Chevrolet — website, credit application, staff portal

The dealership site for Martindale Chevrolet, 521 US Highway 61, New Madrid, MO 63869. Built from the design package in `design/`. Runs on one small AWS Lightsail Ubuntu server.

**Start here → [`HANDOFF-LIGHTSAIL.md`](HANDOFF-LIGHTSAIL.md)** — install, log in, email alerts, HTTPS, and how to use the portal.

## What's in here

| Folder | What |
|---|---|
| `app/` | The whole thing: customer site + credit application + `/portal` staff portal. Node.js 22, Express, SQLite (built into Node), no other services. |
| `deploy/` | Scripts you paste into the Lightsail terminal: `setup.sh`, `update-site.sh`, `configure-email.sh`, `enable-https.sh`. |
| `design/` | The design handoff the site was built from (open `design/Martindale Explorations.dc.html` in a browser). |
| `docs/` | What's built and what the design still calls for. |

## Run it on your own computer

```bash
cd app
npm install
cp .env.example .env     # edit ADMIN_PASSWORD and APP_ENCRYPTION_KEY (64 hex chars)
npm start                # http://localhost:3000  ·  portal at /portal
```
