# Martindale Chevrolet Website

Website for Martindale Chevrolet, 521 US Highway 61, New Madrid, MO 63869, packaged to run on **AWS Lightsail**.

**Start here → [`HANDOFF-LIGHTSAIL.md`](HANDOFF-LIGHTSAIL.md)** — the click-by-click guide to get it online for about $5/month.

## What's in this repo

| Folder / file | What it is |
|---|---|
| `site/` | The website. Plain HTML, CSS and JavaScript, no build step. Vehicles live in `site/inventory/vehicles.json`. |
| `deploy/` | Three scripts: set up the Lightsail server, publish the site, turn on HTTPS. |
| `.github/workflows/` | Optional: auto-publish to Lightsail when `site/` changes on `main`. |
| `design/` | Phase 2 design package: staff portal, credit application, buy-online deal builder, vAuto inventory feed. Open `design/Martindale Explorations.dc.html` in a browser to see it. |
| `docs/PHASE-2-PORTAL-ON-LIGHTSAIL.md` | How the phase 2 app would be hosted on Lightsail, with costs and one security caveat. |

## Updating the site in three lines

```bash
# 1. edit anything in site/ (vehicles: site/inventory/vehicles.json)
# 2. publish
./deploy/deploy.sh YOUR-SERVER-IP
# 3. refresh the browser (Ctrl+Shift+R)
```

## Preview on your own computer

```bash
cd site
python3 -m http.server 8000
# open http://localhost:8000
```
