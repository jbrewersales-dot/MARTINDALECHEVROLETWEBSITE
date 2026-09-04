# Phase 2 — Staff Portal & Buy-Online on Lightsail

The `design/` folder holds a full design handoff for a much bigger product than the current website: a mobile-first customer site with payment-first inventory search, a 5-step credit application, a buy-online deal builder, trade-in appraisal, and a staff portal with a vAuto inventory feed. `design/README.md` is the spec; `design/Martindale Explorations.dc.html` is the clickable design canvas (open it in a browser).

This document answers one question: **if that gets built, how does it run on Lightsail?** It does not build any of it.

## Short version

- Phase 1 (today): static site on one $5 Lightsail instance. Done in `HANDOFF-LIGHTSAIL.md`.
- Phase 2 (later): a Next.js app + Postgres + file storage. Lightsail can host all three pieces for roughly **$35–50/month**, and the current server can be reused as the front door.
- One honest warning: the credit application stores Social Security numbers and driver's-license photos. Lightsail is fine for the inventory/portal/deal parts. For the PII parts, read the **"Where Lightsail falls short"** section before committing to it.

## Recommended Lightsail layout

```
Internet
   │  https://martindalechevrolet.com
   ▼
Lightsail instance "martindale-web"  (Ubuntu, upgrade to 2 GB / $12 plan)
   ├─ nginx  ── serves site/ today; later reverse-proxies to the app
   └─ Node.js (Next.js app under pm2)  ── customer site + /portal + /api
          │                     │
          ▼                     ▼
Lightsail managed database     Lightsail bucket  (+ Lightsail CDN distribution)
PostgreSQL, 1 GB ($15/mo)       vehicle photos, walkaround videos ($1–3/mo)
```

External services the spec calls for (all pay-as-you-go, none hosted by you):
Twilio (SMS from 573-620-5630) · DocuSign or Dropbox Sign (e-sign) · Stripe (down payments) · Dealertrack / RouteOne (lender routing) · a plate-to-VIN API · vAuto SFTP export (the dealer schedules this in vAuto).

## Piece by piece

### 1. App server (reuse `martindale-web`)
- **Resize** the existing instance to 2 GB RAM (instance → Snapshots → create snapshot → "Create new instance from snapshot" with a bigger plan, then move the static IP). Next.js builds need the memory.
- Install Node 22 (`curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash - && sudo apt-get install -y nodejs`) and pm2 (`sudo npm i -g pm2`).
- Deploy the app to `/srv/martindale-app`, run it on port 3000 with `pm2 start npm --name martindale -- start` and `pm2 save && pm2 startup`.
- Add to the nginx config: `location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto https; }` — the static `site/` is then retired, since the Next.js app renders the customer pages itself (SSR is required for VDP SEO per the spec).
- Keep the `enable-https.sh` certificate; nothing about HTTPS changes.

### 2. Database (Lightsail managed PostgreSQL)
- Lightsail → **Databases** → Create → PostgreSQL 16 → Standard plan, 1 GB ($15/mo). Same region as the instance.
- Leave **public mode off**. The instance reaches it over the private Lightsail network using the endpoint shown on the database page.
- Turn on automatic daily backups (7-day retention is included) and point-in-time restore.
- Put the connection string in `/srv/martindale-app/.env` as `DATABASE_URL=postgresql://...`. Never commit `.env`.
- Prisma migrations per the data model in `design/README.md` (Vehicle, FeedRun, PriceChange, Lead, Deal, CreditApp, Offer, Document, Payment, TradeIn, User, ActivityEvent).

### 3. Photos and videos (Lightsail bucket + CDN)
- Lightsail → **Storage** → Create bucket → 25 GB plan ($1/mo) or 250 GB ($3/mo) once walkaround videos pile up.
- Create a bucket **access key** for the app (bucket → Access keys) → `.env` as `S3_ACCESS_KEY / S3_SECRET / S3_BUCKET / S3_ENDPOINT` (the bucket speaks the normal S3 API, so the AWS SDK works unchanged).
- Vehicle photos and videos: **public-read** objects, served through a Lightsail **CDN distribution** attached to the bucket ($2.50/mo for 50 GB transfer) so phones load them fast.
- Driver's-license photos, signed PDFs, insurance cards: **private** objects, served only through short-lived signed URLs. See the warning below.

### 4. Background jobs
- The vAuto CSV ingest (hourly), hold-expiry sweeps, and SLA texts run as plain cron entries on the instance calling app scripts (`0 * * * * cd /srv/martindale-app && node scripts/ingest-vauto.js`). No separate worker box needed at this size.
- vAuto delivers to **SFTP**. Run an SFTP-only user on the same instance (`internal-sftp` chroot in `sshd_config`, key auth only, its home is `/srv/vauto-inbox`) and open port 22 to vAuto's IPs only in the Lightsail firewall.

### 5. Staff portal access
- `/portal` route group behind auth with MFA (spec requires it). The portal is on the same domain, so no extra DNS.
- Restrict `/portal` and `/api/credit-apps/*/reveal-ssn` by IP to the dealership's connection as a second wall (nginx `allow`/`deny`), since staff work from the lot.

## Where Lightsail falls short (read before storing SSNs)

The spec's security section is non-negotiable: SSN and DOB encrypted at rest with a **KMS-managed key**, audit log on every PII read, private bucket with signed short-lived URLs, 30-day auto-delete of license images, GLBA Safeguards Rule.

Lightsail limitations that matter here:

1. **No IAM roles on Lightsail instances.** The app cannot get temporary AWS credentials automatically. To call AWS KMS for field-level encryption you must store a long-lived IAM access key on the box (`.env`). That's workable if the key is scoped to one KMS key with `kms:Encrypt/Decrypt` only, rotated on a schedule, and the box is locked down — but it is weaker than the EC2/ECS model where no secret sits on disk.
2. **Bucket lifecycle rules are limited.** The "auto-delete license photos after 30 days" rule needs a cron job in the app rather than a bucket policy.
3. **Single box = single point of failure.** Acceptable for a small dealership if daily snapshots are on and the recovery plan is "restore snapshot, reattach static IP."
4. **Compliance attestations.** Lightsail is in scope for AWS's SOC/PCI programs, so nothing blocks GLBA here, but your written Safeguards program has to describe the key-on-disk arrangement honestly.

**Practical recommendation:** build and launch inventory, the portal, deals, trade-ins, and e-sign on Lightsail as above. When the credit application with full SSN capture goes live, either (a) accept the scoped-access-key approach with quarterly rotation, or (b) move only the app server to a small EC2 instance with an instance role (everything else — DNS, Lightsail database, bucket — stays where it is; Lightsail resources can be peered to your default VPC). Option (b) is about a day of work and removes the secret-on-disk problem entirely.

## Estimated monthly cost (Phase 2)

| Item | Cost |
|------|------|
| Instance, 2 GB | $12 |
| Managed PostgreSQL, 1 GB | $15 |
| Bucket 250 GB | $3 |
| CDN distribution 50 GB | $2.50 |
| Snapshots | ~$2 |
| Twilio, e-sign, Stripe, plate-decode APIs | usage-based, budget $30–80 |
| **Total infrastructure** | **~$35/month** before third-party APIs |

## Build order that keeps the site up the whole time

1. Stand up the database and bucket. Nothing changes for visitors.
2. Build the Next.js app locally against them; get the vAuto ingest working with the portal Inventory screen (`#4c` frame 1) first, because it feeds everything else.
3. Deploy the app on port 3000 behind nginx at a path like `/next/` for internal review while `site/` keeps serving customers.
4. Cut over: swap nginx's `location /` to the proxy. Keep `site/` in the repo for one release as the rollback.
5. Credit app + e-sign + payments last, after the PII decision above is made.
