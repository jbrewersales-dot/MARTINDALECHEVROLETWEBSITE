# Martindale Chevrolet — AWS Lightsail Handoff (Windows Server + Remote Desktop)

This is the guide for running the Martindale Chevrolet website on a **Windows** Lightsail server that you get into with the **Remote Desktop (RDP)** client. Every step says exactly where to click and what to type. If you'd rather use the cheaper Linux server, that version is in `HANDOFF-LIGHTSAIL.md`. Pick one, not both.

**Total time:** about 45 minutes the first time.
**Cost:** about **$20 per month**. Windows servers cost more than Linux ones because Microsoft charges a license fee. (The $12 plan works but is slow. Check the prices shown in the Lightsail console; they change.)

---

## What you are setting up (plain English)

- **Lightsail** is Amazon's simple way to rent a computer on the internet. You're renting a Windows computer with no monitor. You see its screen through the Remote Desktop app, same as you'd remote into a PC at the dealership.
- **IIS** is the web server built into Windows. It hands the web pages to visitors. The setup script turns it on.
- The website is the `site/` folder in this repo. IIS serves it from `C:\inetpub\martindale` on the server.
- To update the website: change a file in `site/` on GitHub, remote into the server, run one script. That's it.

You can ignore `design/` (the phase 2 portal blueprint) and `.github/workflows/` (a Linux-only auto-publish helper) for now.

---

## What you need before you start

1. An **AWS account**.
2. A **domain name** (for example `martindalechevrolet.com`). Steps 1–6 work without one. You need it for Steps 7 and 8.
3. **Remote Desktop** on your computer. Windows has it built in (search the Start menu for *Remote Desktop Connection*). Mac: install *Windows App* (formerly Microsoft Remote Desktop) from the App Store. You can also skip this and use the RDP button inside the Lightsail web page, which opens the server's screen in your browser.

---

## Step 1 — Create the server

1. Sign in at **https://lightsail.aws.amazon.com**.
2. Click the orange **Create instance** button.
3. **Instance location:** leave the default, or pick **Ohio (us-east-2)** which is closest to Missouri.
4. **Platform:** click **Microsoft Windows**.
5. **Blueprint:** click **OS Only**, then pick **Windows Server 2022** (or the newest one listed).
6. Optional but recommended: click **+ Add launch script**. Open `deploy/windows/setup-iis.ps1` from this repo, copy the whole file, paste it into the box. This makes the server install the web server by itself on first boot. (If you skip this you'll run the same script by hand in Step 5.)
7. **Choose your instance plan:** pick the **2 GB RAM** plan (about $20/month). Windows needs the memory.
8. **Identify your instance:** name it `martindale-web`.
9. Click **Create instance**.

Windows takes longer than Linux to get going. Wait until the instance says **Running**, then wait **10 more minutes** before Step 4. The first boot sets up Windows and (if you pasted the launch script) installs IIS.

---

## Step 2 — Give it a permanent address (static IP)

1. In Lightsail, click the **Networking** tab at the top.
2. Click **Create static IP**.
3. Pick the same region as the instance, and under **Attach to an instance** choose `martindale-web`.
4. Name it `martindale-ip`, click **Create**.

**Write down the IP address it shows** (something like `3.15.22.101`). Below it is called `YOUR-IP`.

---

## Step 3 — Open the doors (firewall)

1. Click the instance `martindale-web`, then the **Networking** tab *inside* the instance page.
2. Under **IPv4 Firewall** you'll see **RDP (3389)** and maybe **HTTP (80)**.
3. If HTTP isn't there: **+ Add rule** → Application **HTTP** → **Create**.
4. **+ Add rule** → Application **HTTPS** → **Create**.
5. Recommended: click the pencil on the **RDP** rule and restrict it to **your own IP address** ("Restrict to IP address" → it offers your current IP). This stops strangers from trying to log in to your server. If the dealership's internet address changes, you can loosen it here later.

---

## Step 4 — Remote into the server

You need the Administrator password first.

1. Click the instance, then the **Connect** tab.
2. Under **Default password**, click **Show default password** (it may say "Retrieve"). Copy it somewhere safe. This is the password for the user **Administrator**.
3. Two ways in:
   - **Easy way:** click the big **Connect using RDP** button. The server's desktop opens in a new browser tab. (If you need to paste text into it, use the clipboard icon at the bottom right of that tab.)
   - **Remote Desktop app:** click **Download RDP file** (or just open Remote Desktop, type `YOUR-IP`), user `Administrator`, paste the password. Click **Yes** on the certificate warning; it's expected the first time.

You are now looking at the server's Windows desktop. On the first login Windows may show a "Server Manager" window. Close it.

---

## Step 5 — Set up the web server (skip if you pasted the launch script)

Check first: on **your own** computer, open `http://YOUR-IP` in a browser. If it shows **"Server is ready."**, the launch script worked. Skip to Step 6.

Otherwise, inside the RDP session:

1. Click **Start**, type `PowerShell`, right-click **Windows PowerShell** → **Run as administrator** → **Yes**.
2. Type these two lines, pressing Enter after each:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
irm https://raw.githubusercontent.com/jbrewersales-dot/MARTINDALECHEVROLETWEBSITE/main/deploy/windows/setup-iis.ps1 | iex
```

   Wait 1–3 minutes. It ends with "Done. IIS is serving...".

> **If the repo is private** the `irm` line can't download. Instead: open `deploy/windows/setup-iis.ps1` on your own computer, copy everything, then in the RDP session open **Notepad**, paste, and **File → Save As** → file name `C:\Users\Administrator\setup-iis.ps1`, "Save as type" **All Files**. Then in PowerShell run `C:\Users\Administrator\setup-iis.ps1`.

3. On your own computer open `http://YOUR-IP`. You should see **"Server is ready."**

---

## Step 6 — Publish the website

Inside the RDP session, in the same **PowerShell (Administrator)** window:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
irm https://raw.githubusercontent.com/jbrewersales-dot/MARTINDALECHEVROLETWEBSITE/main/deploy/windows/update-site.ps1 | iex
```

It downloads the latest copy of the repo from GitHub and copies `site/` into `C:\inetpub\martindale`. It ends with "Done."

On your own computer open `http://YOUR-IP` and press **Ctrl+Shift+R**. You should see the real Martindale Chevrolet homepage, and the **Inventory** page should list vehicles.

**That's the whole publishing routine.** Every time you change something in `site/` on GitHub, remote in and run that `irm ... update-site.ps1 | iex` line again.

> **If the repo is private, or you'd rather not use GitHub:** in the Remote Desktop app you can copy files straight into the server. Copy the `site` folder on your computer (Ctrl+C), click into the RDP window, right-click the server's Desktop → Paste. Then save `deploy/windows/update-site.ps1` and `deploy/windows/web.config` on the server the same Notepad way as Step 5, and run:
> ```powershell
> C:\Users\Administrator\update-site.ps1 -LocalSite "C:\Users\Administrator\Desktop\site"
> ```
> (Copy-paste of files works in the Remote Desktop app, not in the browser RDP tab.)

---

## Step 7 — Point your domain at the server

This is done wherever you bought the domain. Create two **A records** that point to `YOUR-IP`:

| Type | Host / Name | Value | TTL |
|------|-------------|-------|-----|
| A | `@` (the bare domain) | `YOUR-IP` | 300 or "automatic" |
| A | `www` | `YOUR-IP` | 300 or "automatic" |

Or use Lightsail's own DNS: **Domains & DNS** tab → **Create DNS zone** → your domain → add the same two A records → copy the four **name servers** Lightsail gives you into your registrar's "custom name servers" setting.

DNS takes 5 minutes to a few hours. Test at https://dnschecker.org, or just open `http://yourdomain.com`. When it shows the site, go on.

---

## Step 8 — Turn on HTTPS (the padlock)

Do this **after** Step 7 works. It's free and renews itself.

Inside the RDP session, PowerShell (Administrator):

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
irm https://raw.githubusercontent.com/jbrewersales-dot/MARTINDALECHEVROLETWEBSITE/main/deploy/windows/enable-https.ps1 -OutFile enable-https.ps1
.\enable-https.ps1 -Domain yourdomain.com -Email you@youremail.com
```

Replace `yourdomain.com` and the email with real ones. It downloads a small tool called **win-acme**, gets the certificate from Let's Encrypt, and attaches it to the site. Takes about a minute. Open `https://yourdomain.com` and look for the padlock.

(Private repo: save the file with Notepad like before, then run the last line.)

---

## Day-to-day

### Add, remove or change a vehicle
1. On GitHub open `site/inventory/vehicles.json` → pencil icon → edit. Copy an existing `{ ... }` block, paste, change the values, keep the commas between blocks. Commit.
2. Photo: upload it to `site/images/` on GitHub and set `"image": "images/filename.jpg"`.
3. Remote into the server and run the Step 6 line.

Tip: paste the whole JSON file into https://jsonlint.com first. One missing comma makes the inventory page say "Inventory is temporarily unavailable".

### Change words on a page
Edit the `.html` file in `site/` on GitHub, commit, run the Step 6 line on the server.

### Photos
Keep them under about 300 KB (resize to 1200px wide). Most visitors are on phones.

---

## Before-go-live checklist

Already filled in from the dealership facts:
- 521 US Highway 61, New Madrid, MO 63869
- Sales 573-748-2512 · Service 573-748-2241 · Text 573-620-5630 · jbrewersales@gmail.com
- Hours: Mon–Fri 8–5, Sat by appointment, Sun closed

Still yours to do:
- [ ] The **Contact** and **Service** forms don't send anywhere yet. Sign up at **formspree.io** (free), get your form URL, and in `site/contact.html` and `site/service.html` change `action="#"` to that URL. Delete the "Form submission is not connected yet" line under each form.
- [ ] Replace the sample vehicles in `site/inventory/vehicles.json` with real ones.
- [ ] Team photos and names on `site/about.html`.
- [ ] Optional: the logo is at `site/images/logo.png`. The header uses a text wordmark today.
- [ ] Turn on **Windows Update** auto-install: in the RDP session, Start → Settings → Windows Update → check for updates. Do this once a month or so.

---

## Monthly cost

| Item | Cost |
|------|------|
| Lightsail Windows instance, 2 GB | ~$20 / month (the 1 GB plan is ~$12 but slow) |
| Static IP | Free while attached |
| Data transfer | 2 TB / month included |
| HTTPS certificate (Let's Encrypt via win-acme) | Free |
| Domain name | ~$12–15 / year at your registrar |

Set a **billing alarm**: AWS console → **Billing** → **Budgets** → $30/month with an email alert.

---

## Backups

Instance → **Snapshots** tab → **Automatic snapshots** → **Enable**. About $0.05/GB/month. The real backup is this Git repo though: the whole website is in `site/`, and a fresh server is 45 minutes away using this guide.

---

## Troubleshooting

**Can't connect with Remote Desktop.**
Firewall rule for RDP (Step 3) must allow your IP. If you restricted it and your internet address changed, edit the rule. The browser **Connect using RDP** button always works regardless.

**"Server is ready" never shows (Step 5).**
The launch script didn't run. Do Step 5 by hand. If `irm` fails with a red error about TLS or "could not resolve", the server can't reach the internet: check the instance isn't stopped and try again in a minute.

**`irm` is blocked / "running scripts is disabled".**
You skipped the `Set-ExecutionPolicy Bypass -Scope Process -Force` line. Run it first in the same window.

**Site shows but Inventory says "temporarily unavailable".**
`vehicles.json` has a typo (missing comma). Check at jsonlint.com, fix on GitHub, re-run Step 6.

**I changed a file but the site looks the same.**
Did you run the Step 6 line on the server after committing? Then hard-refresh: **Ctrl+Shift+R**.

**HTTPS script fails.**
Almost always DNS: both `yourdomain.com` and `www.yourdomain.com` must point at `YOUR-IP` first (check dnschecker.org). Also make sure port 80 is open in the Lightsail firewall; Let's Encrypt uses it to verify you own the domain.

**Something's badly broken.**
The server is disposable. Delete it, repeat Steps 1–6, re-attach the same static IP so DNS still works, re-run Step 8.

---

## Where everything is

| Path | What it is |
|------|------------|
| `site/` | The website. This is what gets published. |
| `site/inventory/vehicles.json` | The vehicle list. |
| `deploy/windows/setup-iis.ps1` | One-time server setup (or paste as the Lightsail launch script). |
| `deploy/windows/update-site.ps1` | Run on the server to publish the latest `site/`. |
| `deploy/windows/enable-https.ps1` | Run on the server once to turn on HTTPS. |
| `deploy/windows/web.config` | IIS settings (caching, compression). Copied in by update-site.ps1. |
| `HANDOFF-LIGHTSAIL.md` | The Linux (SSH) version of this guide, if you ever switch. |
| `design/` | Phase 2 design package (staff portal, credit app, buy-online). Not deployed. |
| `docs/PHASE-2-PORTAL-ON-LIGHTSAIL.md` | How the phase 2 app would be hosted. |
