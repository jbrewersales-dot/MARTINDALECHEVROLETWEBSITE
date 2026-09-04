# Martindale Chevrolet — AWS Lightsail Handoff

This is the step-by-step guide to put the Martindale Chevrolet website on the internet using **AWS Lightsail** on a **Linux** server. If you're using a **Windows** server with Remote Desktop, use `HANDOFF-LIGHTSAIL-WINDOWS.md` instead. It is written so that someone who has never touched a server can follow it. Do the steps in order. Each step tells you exactly where to click.

**Total time:** about 45 minutes the first time.
**Cost:** about **$5 per month** (the smallest Ubuntu server plus a free static IP).

---

## What you are actually setting up (plain English)

- **Lightsail** is Amazon's "simple mode" for renting a small computer on the internet (a *server*).
- We rent one small Ubuntu Linux server. A program on it called **nginx** hands web pages to visitors.
- The website itself is just the files in the `site/` folder of this repo (HTML, CSS, a bit of JavaScript, and `inventory/vehicles.json` which is the vehicle list).
- To update the website you edit a file in `site/`, then run one script that copies the folder to the server. That's it.

There are two other things in this repo you can ignore for now:

- `design/` — the design package for the future **staff portal and buy-online flow**. That is a much bigger build (see `docs/PHASE-2-PORTAL-ON-LIGHTSAIL.md`). Nothing in it needs to be deployed today.
- `.github/workflows/` — an optional "auto-publish when I push to GitHub" helper. Explained at the end.

---

## What you need before you start

1. An **AWS account** (aws.amazon.com → Create account; you'll need a credit card).
2. This repo downloaded onto your computer (green **Code** button → Download ZIP, or `git clone`).
3. A **domain name** you control, for example `martindalechevrolet.com`. If you don't have one yet, you can still do Steps 1–6 and visit the site by its IP address. Buy the domain any time (Lightsail can sell you one under **Domains & DNS**, or use GoDaddy / Namecheap / whoever).
4. A terminal:
   - **Mac:** the built-in **Terminal** app.
   - **Windows:** install **Git for Windows** (gitforwindows.org) and use **Git Bash**. Everything below works in Git Bash.

---

## Step 1 — Create the server

1. Sign in at **https://lightsail.aws.amazon.com**.
2. Click the orange **Create instance** button.
3. **Instance location:** leave the default region (for Missouri, **Ohio (us-east-2)** is closest, but any US region is fine). *Write down which region you picked — the SSH key file is named after it.*
4. **Platform:** click **Linux/Unix**.
5. **Blueprint:** click **OS Only**, then pick **Ubuntu 24.04 LTS**.
6. Scroll down to **"Add launch script"** (it may say *"+ Add launch script"* under an *Optional* heading). Click it. A big text box appears.
7. Open the file `deploy/lightsail-launch-script.sh` from this repo, **select all, copy, and paste the whole thing** into that box. This installs the web server for you automatically.
8. **Choose your instance plan:** pick the cheapest one (**$5/month, 512 MB RAM** is plenty. **$3.50** also works if it is offered). The first 3 months are usually free on this plan.
9. **Identify your instance:** name it `martindale-web`.
10. Click **Create instance**.

Wait 2–3 minutes. The instance card will turn from "Pending" to **"Running"**. Give it another 2 minutes after that so the launch script can finish installing.

---

## Step 2 — Give it a permanent address (static IP)

By default the server's IP address changes every time it reboots. A static IP fixes that. It is free while attached to a running instance.

1. In Lightsail, click the **Networking** tab at the top.
2. Click **Create static IP**.
3. Pick the same region as your instance.
4. Under **Attach to an instance**, choose `martindale-web`.
5. Name it `martindale-ip` and click **Create**.

**Write down the IP address it shows you** (something like `3.15.22.101`). You'll use it several times below. In this guide it is written as `YOUR-IP`.

---

## Step 3 — Open the door for HTTPS (firewall)

1. Click your instance `martindale-web`, then the **Networking** tab *inside* the instance page.
2. Under **IPv4 Firewall** you should see rules for **SSH (22)** and **HTTP (80)**.
3. Click **+ Add rule**, choose **HTTPS** from the Application dropdown, and click **Create**.

---

## Step 4 — Check the server is alive

Open a web browser and go to `http://YOUR-IP` (use `http://`, not `https://`, for now).

You should see a plain page that says **"Server is ready."** That means the launch script worked.

If you get "can't connect", wait another couple of minutes and try again. If it still fails after 10 minutes, see **Troubleshooting** at the bottom.

---

## Step 5 — Open the server's terminal in your browser

No software needed on your computer for this.

1. In Lightsail, click your instance `martindale-web`.
2. Click the orange **Connect using SSH** button (or the little terminal icon on the instance card).
3. A black window opens in a new browser tab. That's the server's command line. You type commands there and press Enter.

To paste into that window: click the **clipboard icon** at the bottom-right of the tab, paste your text into the box, then right-click inside the black area and choose Paste (or press Ctrl+Shift+V).

---

## Step 6 — Publish the website

In the browser terminal from Step 5, paste this one line and press Enter:

```bash
curl -fsSL https://raw.githubusercontent.com/jbrewersales-dot/MARTINDALECHEVROLETWEBSITE/main/deploy/update-site.sh | sudo bash
```

It downloads the latest copy of this repo from GitHub and copies the `site/` folder onto the server. It ends with "Done."

On your own computer, open `http://YOUR-IP` and press **Ctrl+Shift+R** (hard refresh). You should now see the real Martindale Chevrolet homepage, and the **Inventory** page should list vehicles.

**That's the whole publishing routine.** Every time you change something in `site/` on GitHub, open the browser terminal and paste that same line again.

> **If the repo is private,** that `curl` line can't download. Make the repo public (GitHub → Settings → General → Danger Zone → Change visibility), or use the "from your own computer" method below.

<details>
<summary><strong>Alternative: publish from your own computer with deploy.sh</strong> (needs the SSH key and a terminal)</summary>

1. Download the SSH key: Lightsail → your **account name** (top right) → **Account** → **SSH keys** tab → **Download** the default key for your region. It's a file like `LightsailDefaultKey-us-east-2.pem`. Leave it in Downloads. Never share it or put it in the repo.
2. Open a terminal (Mac: Terminal. Windows: install Git for Windows and use Git Bash).
3. Run:

```bash
cd path/to/MARTINDALECHEVROLETWEBSITE
./deploy/deploy.sh YOUR-IP
# or, if the key is somewhere else:
./deploy/deploy.sh YOUR-IP /full/path/to/LightsailDefaultKey-us-east-2.pem
```

Type `yes` if asked "Are you sure you want to continue connecting?". This copies your local `site/` folder up without going through GitHub.
</details>

---

## Step 7 — Point your domain at the server

This is done wherever you bought the domain. The screens differ, but the idea is the same everywhere: create two **A records** that point to `YOUR-IP`.

| Type | Host / Name | Value | TTL |
|------|-------------|-------|-----|
| A | `@` (means the bare domain) | `YOUR-IP` | 300 or "automatic" |
| A | `www` | `YOUR-IP` | 300 or "automatic" |

If you'd rather manage DNS inside Lightsail: **Domains & DNS** tab → **Create DNS zone** → enter your domain → add the same two A records → then copy the four **name servers** Lightsail shows you into your registrar's "custom name servers" setting.

DNS changes take anywhere from 5 minutes to a few hours. Test by opening `http://yourdomain.com` in a browser. When it shows the site, move on.

---

## Step 8 — Turn on HTTPS (the padlock)

Do this **after** Step 7 works. It is free and renews itself automatically.

1. Open the browser terminal (Step 5).
2. Paste these lines one at a time:

```bash
curl -fsSL https://raw.githubusercontent.com/jbrewersales-dot/MARTINDALECHEVROLETWEBSITE/main/deploy/enable-https.sh -o enable-https.sh
sudo bash enable-https.sh yourdomain.com you@youremail.com
```

Replace `yourdomain.com` with your real domain and the email with a real address (Let's Encrypt emails you if a certificate ever fails to renew).

It takes about 30 seconds. When it says **"HTTPS is on"**, open `https://yourdomain.com`. You should see the padlock, and `http://` addresses will automatically redirect to `https://`.

> If the repo is private, that `curl` line can't download the file. Instead open `deploy/enable-https.sh` on your computer, copy its contents, and in the server terminal type `nano enable-https.sh`, paste, press **Ctrl+O**, **Enter**, **Ctrl+X**. Then run the `sudo bash` line.

---

## You're live. Here's the day-to-day

### Add, remove or change a vehicle
1. Open `site/inventory/vehicles.json` in any text editor (Notepad, TextEdit, VS Code).
2. Copy one of the existing `{ ... }` blocks, paste it, and change the values. Keep the commas between blocks. `site/README-SITE.md` shows the exact format.
3. Put the photo in `site/images/` and set `"image": "images/filename.jpg"`.
4. Commit to GitHub, then run the Step 6 line in the browser terminal. Refresh the site.

Tip: paste the whole file into https://jsonlint.com before deploying. One missing comma makes the inventory page show "Inventory is temporarily unavailable".

### Change words on a page
Edit the matching `.html` file in `site/` on GitHub, then run the Step 6 line. Same line every time.

### Vehicle photos
Keep them under about 300 KB each (resize to 1200px wide). Big photos make the page slow on phones, which is most of your visitors.

---

## Before-go-live checklist

Things that were **already filled in** from the dealership facts in the design package:
- Address: 521 US Highway 61, New Madrid, MO 63869
- Sales 573-748-2512 · Service 573-748-2241 · Text 573-620-5630
- Hours: Mon–Fri 8–5, Sat by appointment, Sun closed
- Email: jbrewersales@gmail.com (home page, contact page, every footer)

Things **you still need to do** (search `site/` for each):
- [ ] The **Contact** and **Service** forms don't send anywhere yet. Easiest fix with no server code: sign up at **formspree.io** (free), get your form URL, and in `contact.html` and `service.html` change `action="#"` to that URL. Then delete the "Form submission is not connected yet" line under each form.
- [ ] Replace the sample vehicles in `site/inventory/vehicles.json` with real ones.
- [ ] Team photos and names on `site/about.html`.
- [ ] Optional: the dealership logo is at `site/images/logo.png` (1024×1024). The header currently uses a text wordmark. If you want the logo shown, that's a small HTML/CSS change.
- [ ] Double-check hours and phone numbers one more time on the live site.

---

## Optional — auto-publish from GitHub

If you'd rather not run `deploy.sh` by hand, GitHub can do it every time you push a change to `site/` on the `main` branch.

1. On GitHub: repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Add `LIGHTSAIL_HOST` = `YOUR-IP`.
3. Add `LIGHTSAIL_SSH_KEY` = open the `.pem` file in a text editor, copy **everything** (including the `-----BEGIN` and `-----END` lines), paste it as the value.
4. That's it. The workflow in `.github/workflows/deploy-lightsail.yml` will run on the next push. You can also run it by hand from the **Actions** tab → **Deploy site to Lightsail** → **Run workflow**.

Until those two secrets exist the workflow just skips itself, so it's safe to leave in place.

---

## Monthly cost

| Item | Cost |
|------|------|
| Lightsail instance, 512 MB (Ubuntu) | $5.00 / month (first 3 months often free) |
| Static IP | Free while attached |
| Data transfer | 1 TB / month included — far more than a dealer site uses |
| HTTPS certificate (Let's Encrypt) | Free |
| Domain name | ~$12–15 / year, paid to your registrar |

Set up a **billing alarm** so there are no surprises: AWS console → **Billing** → **Budgets** → create a budget for, say, $15/month with an email alert.

---

## Backups

Lightsail can take a full snapshot of the server automatically every day:
instance → **Snapshots** tab → **Automatic snapshots** → **Enable**. Costs about $0.05/GB/month (roughly $1). Honestly the real backup is this Git repo — the whole website is in `site/` and can be re-published to a fresh server in 10 minutes with Steps 1–6.

---

## Troubleshooting

**"Server is ready" page never shows up (Step 4).**
Open the browser SSH terminal (instance → Connect) and run `sudo cat /var/log/cloud-init-output.log | tail -50`. If it complains, the launch script didn't run. Fix: in that terminal run
`curl -fsSL https://raw.githubusercontent.com/jbrewersales-dot/MARTINDALECHEVROLETWEBSITE/main/deploy/lightsail-launch-script.sh | sudo bash`
(or paste the file in with `nano` as described in Step 8 if the repo is private).

**The setup script ends with "Job for nginx.service failed" / "Address already in use".**
Something else on the server grabbed port 80 before nginx could. Paste this in the browser terminal:
`sudo systemctl disable --now apache2 2>/dev/null; sudo fuser -k 80/tcp; sleep 2; sudo systemctl restart nginx && echo OK`
If it prints OK you're fine. Then continue with Step 6.

**"Could not get lock /var/lib/dpkg/lock-frontend".**
Ubuntu is installing its own security updates in the background. Harmless. Wait a minute and run the same line again.

**deploy.sh (alternative method) says "Permission denied (publickey)".**
Wrong key file or wrong region's key. Re-download the key for the **same region** as the instance (see the alternative in Step 6) and pass its path as the second argument.

**The Step 6 line fails with "404" or "Not Found".**
The repo is private (GitHub can't hand out the file) or the branch name is wrong. Make the repo public, or use the deploy.sh alternative in Step 6.

**Site shows but the Inventory page says "temporarily unavailable".**
`vehicles.json` has a typo (usually a missing or extra comma). Paste it into jsonlint.com, fix, redeploy.

**I changed a file but the website looks the same.**
Hard refresh: **Ctrl+Shift+R** (Windows) / **Cmd+Shift+R** (Mac). Styles and scripts are cached for 7 days by design.

**HTTPS script fails with "could not find a matching server block" or a DNS error.**
Your domain isn't pointing at `YOUR-IP` yet (Step 7). Check at https://dnschecker.org — both `yourdomain.com` and `www.yourdomain.com` must resolve to `YOUR-IP` before Step 8 will work.

**I locked myself out / broke the server.**
It's disposable. Delete the instance, repeat Steps 1–6 (about 10 minutes), re-attach the static IP so DNS doesn't change, re-run Step 8.

---

## Where everything is

| Path | What it is |
|------|------------|
| `site/` | The website. This is what gets published. |
| `site/inventory/vehicles.json` | The vehicle list. |
| `site/README-SITE.md` | The original notes on the site's files and inventory format. |
| `deploy/lightsail-launch-script.sh` | Paste into Lightsail when creating the server. |
| `deploy/update-site.sh` | Run on the server (browser terminal) to publish the latest `site/` from GitHub. |
| `deploy/deploy.sh` | Alternative: run from your own computer to publish `site/` over SSH. |
| `deploy/enable-https.sh` | Run on the server once to turn on HTTPS. |
| `deploy/nginx/martindale.conf` | The web server config (reference copy of what the launch script installs). |
| `.github/workflows/deploy-lightsail.yml` | Optional auto-publish from GitHub. |
| `design/` | Phase 2 design package (staff portal, credit app, buy-online). Not deployed. |
| `docs/PHASE-2-PORTAL-ON-LIGHTSAIL.md` | How the phase 2 app would be hosted on Lightsail. |
