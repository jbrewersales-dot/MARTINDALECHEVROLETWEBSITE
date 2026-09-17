# What's built, and what the design still calls for

The design package in `design/README.md` describes a large product. This is where the build stands against it.

## Built and working

| Design item | Status |
|---|---|
| Homepage `#3a` (hero, search, chips, pre-approve CTA, tap list with live counts, footer) | Done |
| Inventory `#3b` (payment-first cards, walkaround badge, filter sheet with live counts, sort, free-text search like "under $300/mo") | Done. Favorites (heart) not built. |
| Vehicle page `#1e` (media hero with video, thumbnails, payment calculator, pre-approve/trade/text CTAs, staff note) | Done |
| Credit application `#4a` (intro, 5 steps, one question per screen, autosave + resume, license capture, masked SSN, consent, done screen) | Done |
| Trade-in `#1d` | Done as a **request**: VIN decode (free NHTSA service), condition, photos, then "Bo texts you a number." The instant estimate range needs a paid valuation data source; staff enter the range in the portal instead. |
| Staff portal: credit apps inbox `#1f` (KPIs, table, SLA, status pills, detail with snapshot/PTI/activity/notes, masked SSN with audited reveal) | Done |
| Staff portal: inventory `#4c` frame 1 (table, attention filters, feed health banner, feed log, unit editor with web-only fields) | Done. vAuto import is a CSV paste/upload, not an automatic SFTP pull yet. |
| Trade-ins and leads in the portal | Done |
| Security: TLS (via enable-https.sh), AES-256-GCM field encryption for SSN/DOB, private license photos, SSN reveal audited, roles, 15-minute idle timeout, rate limits on public POSTs, same-origin check on portal POSTs, nightly DB backups | Done |
| Email alerts on new application / trade-in / lead | Done (Gmail app password) |

## Not built yet (in rough order of value)

1. **SMS from 573-620-5630** (auto-text on application received, magic links). Needs a Twilio account (~$1/mo + 1¢/text). Today the portal opens your phone's texting app with the message pre-written instead.
2. **Automatic vAuto feed.** vAuto can push a CSV to an SFTP folder hourly. Adding an SFTP user on the server plus a cron job that runs the same import is about a day of work. Today you paste the CSV.
3. **Buy-online deal builder `#4b`** (hold vehicle, payment builder, lender offers, e-sign, down payment, pickup/delivery). This is the biggest piece. It needs a lender routing API (Dealertrack/RouteOne dealer agreements), an e-sign provider (DocuSign or Dropbox Sign), and a payment processor (Stripe). Weeks, not days, and mostly waiting on those vendor accounts.
4. **Deals pipeline `#4c` frame 2** (kanban). Depends on 3.
5. **Trade-in instant estimate.** Needs a valuation data feed (Black Book, JD Power, or MMR access). Plate-to-VIN needs a paid lookup service.
6. **Favorites** on inventory cards.
7. **Adverse-action letters** generated from the portal when an app is turned down (today it reminds you to send one).

## Where the code would go

- SMS: `app/src/util.js` → a `text()` helper next to `notify()`, called from `api.js` on submit and from a portal button.
- SFTP ingest: `app/scripts/ingest-vauto.js` reusing the import logic in `portal.js` (move it to `src/vauto.js`), plus a cron line.
- Deal builder: new tables (`deals`, `offers`, `documents`, `payments`), new customer routes under `/buy/:stock`, new portal section.
