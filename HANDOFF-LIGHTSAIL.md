# Martindale Chevrolet — Website + Staff Portal on AWS Lightsail

This is the guide to run the Martindale Chevrolet website and its staff portal on your **Ubuntu** Lightsail server. It is written for someone who has never run a server. Every step says exactly where to click and what to paste.

**What you get**

- The customer website: homepage, inventory with payment-first search, vehicle pages with a payment calculator and walkaround video, trade-in request, service and contact forms.
- A **credit application** customers fill out on their phone. It saves as they go, and the sensitive parts (SSN, date of birth, license photos) are encrypted the moment they hit the server.
- A **staff portal** at `/portal` (password protected) where you see every application, trade-in, and lead. You can change statuses, add notes, reveal an SSN (logged), export a CSV, manage inventory, and import your vAuto CSV.
- Email alerts to jbrewersales@gmail.com when something comes in (after the 5-minute email setup below).

**Cost:** about $5 a month for the server. Everything else is free.

---

## The 4 lines you'll use

Every command below is pasted into the **Lightsail browser terminal**: Lightsail → click your instance → **Connect using SSH**. A black window opens. To paste: click the clipboard icon at the bottom-right of that tab, paste there, then right-click in the black area → Paste. Press Enter.

| What | Paste this |
|---|---|
| **Install everything** (first time; safe to re-run) | `curl -fsSL https://raw.githubusercontent.com/jbrewersales-dot/MARTINDALECHEVROLETWEBSITE/main/deploy/setup.sh \| sudo bash` |
| **Update** to the latest code on GitHub | `curl -fsSL https://raw.githubusercontent.com/jbrewersales-dot/MARTINDALECHEVROLETWEBSITE/main/deploy/update-site.sh \| sudo bash` |
| **Show the portal login** again | `sudo cat /root/martindale-portal-login.txt` |
| **See what the app is doing** (if something's wrong) | `sudo journalctl -u martindale -n 50 --no-pager` |

The `\|` in the table is a normal `|` character when you paste it.

---

## Step 1 — Have a server

If you already made an Ubuntu instance, skip to Step 2. Otherwise:

1. **https://lightsail.aws.amazon.com** → **Create instance**.
2. Platform **Linux/Unix** → **OS Only** → **Ubuntu 24.04 LTS**.
3. Plan: the **$5 / 512 MB** one is enough. ($3.50 works too.)
4. Name it `martindale-web` → **Create instance**. Wait until it says **Running**.
5. **Networking** tab (top of Lightsail) → **Create static IP** → attach to `martindale-web`. Write down the IP. Below it's called `YOUR-IP`.
6. Click the instance → its own **Networking** tab → under IPv4 Firewall, **+ Add rule** → **HTTPS** → Create. (HTTP and SSH are already there.)

## Step 2 — Install

Open the browser terminal (instance → **Connect using SSH**) and paste:

```bash
curl -fsSL https://raw.githubusercontent.com/jbrewersales-dot/MARTINDALECHEVROLETWEBSITE/main/deploy/setup.sh | sudo bash
```

It takes 2–4 minutes. If it says "Ubuntu is installing its own updates — waiting", just wait. At the end it prints a box like this:

```
Martindale staff portal
URL:      http://YOUR-IP/portal
Email:    jbrewersales@gmail.com
Password: Xk4mPq9vRt2Lw
```

**Copy that password somewhere.** You can show it again any time with `sudo cat /root/martindale-portal-login.txt`.

## Step 3 — Look at it

- Website: open `http://YOUR-IP` in a browser (use `http://`, the padlock comes in Step 5).
- Portal: `http://YOUR-IP/portal`, sign in with the email and password from Step 2.
- First thing: **Settings → Change my password.**

Try it like a customer: on your phone, open the site, tap **Get pre-approved**, fill it out with fake info, send it. Then look at **Credit apps** in the portal. That's the whole loop.

## Step 4 — Turn on email alerts (5 minutes)

Without this, applications still land in the portal, you just won't get an email. To send from your Gmail:

1. Go to **myaccount.google.com → Security**. Turn on **2-Step Verification** if it's off.
2. Still under Security, open **App passwords** (search for it in the box at the top of the page if you don't see it). Create one named `Martindale site`. Google shows a 16-character password like `abcd efgh ijkl mnop`.
3. In the browser terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/jbrewersales-dot/MARTINDALECHEVROLETWEBSITE/main/deploy/configure-email.sh -o configure-email.sh
sudo bash configure-email.sh jbrewersales@gmail.com "abcd efgh ijkl mnop"
```

Alerts go to the address in **Portal → Settings → Email alerts go to**. You can put several, separated by commas.

## Step 5 — Domain name and the padlock (HTTPS)

Do this once you own a domain (e.g. `martindalechevrolet.com`).

**Point the domain at the server.** Wherever you bought the domain, add two **A records**, both pointing to `YOUR-IP`:

| Type | Host | Value |
|---|---|---|
| A | `@` | `YOUR-IP` |
| A | `www` | `YOUR-IP` |

Wait until `http://yourdomain.com` shows the site (5 minutes to a few hours). Then, in the browser terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/jbrewersales-dot/MARTINDALECHEVROLETWEBSITE/main/deploy/enable-https.sh -o enable-https.sh
sudo bash enable-https.sh yourdomain.com jbrewersales@gmail.com
```

Open `https://yourdomain.com`. Padlock. It renews itself forever.

> Do Step 5 before you send real customers to the credit application. Until then it's `http://`, which is fine for testing but not for real Social Security numbers.

---

## Using the portal day to day

**Credit apps.** New ones are gold. Open one: you see income, housing, the vehicle they picked, and an estimated payment-to-income. The **Text** button opens your phone's texting app with their number. **Quick text** buttons have messages pre-written. Change the **Status** dropdown as you work it. The **Reveal** button next to the SSN shows it for 30 seconds and writes your name to the audit log. Only `finance` and `admin` roles can reveal.

**Trade-ins.** Customer sent a VIN or year/make/model, miles, condition, maybe photos. You type the low/high offer in, hit Save, and the **Text** button drafts the message with those numbers in it.

**Leads.** Contact, service and "ask about this vehicle" messages. Set to contacted or closed when you're done.

**Inventory.**
- **+ Add vehicle** to type one in by hand. Drag photos in; they get shrunk in the browser so the site stays fast. First photo is the main photo.
- **Import from vAuto (CSV)**: in vAuto, export inventory as CSV, open the file, paste the whole thing in, hit Preview, then Apply. Matches by VIN. Updates prices and miles, adds new units, and can mark missing ones sold. Things you set by hand (walkaround video, Bo's note, featured) are never overwritten by the import.
- A vehicle shows on the site only when its status is **Live**. Imported units with no photo start **Hidden**.
- Walkaround video: paste a YouTube link or a direct .mp4 link, put the length in seconds, and the vehicle card gets the "0:58 walkaround" badge.

**Settings.** The payment estimate assumptions (APR, down payment, term) that every "$/mo est." on the site uses. Add staff users here: `staff` sees everything but can't reveal SSNs, `finance` can, `admin` can also change settings and delete things.

**Delete the sample vehicles.** The six vehicles you see at first are samples. Open each in Inventory and hit Delete, or import your real CSV and tick "mark missing as sold".

---

## If you forget the portal password

```bash
sudo cat /root/martindale-portal-login.txt
```

If you changed it and forgot the new one:

```bash
cd /srv/martindale && sudo -u ubuntu node scripts/reset-password.js jbrewersales@gmail.com "a new password here"
```

---

## Backups

The app copies its database into `/srv/martindale/data/backups/` every day and keeps two weeks. For a full-server backup, turn on Lightsail automatic snapshots: instance → **Snapshots** tab → **Automatic snapshots** → Enable (about $1/month).

**What's on the server that is not in GitHub:** the database (`/srv/martindale/data/martindale.db`), uploaded photos (`/srv/martindale/data/uploads/`), and `/srv/martindale/.env` (the secrets). The `.env` file contains the encryption key. **If you lose that key, the SSNs in the database can never be read again.** Copy `.env` somewhere safe once:

```bash
sudo cat /srv/martindale/.env
```

---

## Where things are

| Path | What |
|---|---|
| `app/` | The website + portal (Node.js, one process, SQLite database, no other services). |
| `app/src/routes/site.js` | Customer pages. |
| `app/src/routes/api.js` | Form handling: credit app, trade-in, leads, VIN lookup. |
| `app/src/routes/portal.js` | The staff portal. |
| `app/views/` | The page templates. `site/` for customers, `portal/` for staff. |
| `app/public/css/site.css` | The look: colors and fonts from the design package. |
| `deploy/setup.sh` | Installs everything on a fresh Ubuntu server. |
| `deploy/update-site.sh` | Pulls the latest code and restarts. |
| `deploy/configure-email.sh` | Gmail alerts. |
| `deploy/enable-https.sh` | The padlock. |
| `design/` | The original design package the site was built from. |
| `docs/WHATS-BUILT-AND-WHATS-NEXT.md` | What's done versus what the design still calls for. |

---

## Troubleshooting

**The site shows the nginx welcome page or nothing.** Run the install line again (it's safe). It repairs nginx and restarts the app.

**"502 Bad Gateway".** The app isn't running. `sudo journalctl -u martindale -n 50 --no-pager` shows why. Usually a bad `.env` edit. Then `sudo systemctl restart martindale`.

**Emails don't arrive.** Check spam. Then `sudo journalctl -u martindale -n 50 --no-pager` and look for `[notify] email failed`. A wrong app password is the usual cause; re-run Step 4.

**"Could not get lock /var/lib/dpkg".** Ubuntu is updating itself. The install script waits for it now. If you see it anyway, wait a minute and re-run.

**Something else is on port 80.** The install script kicks it off. If nginx still won't start: `sudo systemctl status nginx --no-pager -l`.

**I broke the server.** Take a snapshot first if you can. Otherwise: create a new instance, attach the same static IP, run the install line, and restore the database from a backup if you have one (`/srv/martindale/data/backups/`).
