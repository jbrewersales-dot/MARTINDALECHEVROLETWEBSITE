# Handoff: Martindale Chevrolet — Customer Site + Staff Portal

## Overview
A mobile-first website for Martindale Chevrolet (521 US Highway 61, New Madrid, MO 63869), a small family dealership in the Missouri Bootheel focused on under-$20K used vehicles and subprime-friendly buying. Scope: customer homepage, inventory search with payment-first pricing (inventory auto-synced from vAuto), vehicle detail page (VDP) with walkaround video, a full secure credit application, an end-to-end **buy-online deal builder** (payment → trade → financing → e-sign → pickup/delivery), trade-in appraisal, and an internal staff portal (credit apps, deal desk, inventory/vAuto feed health).

**Design principle — build for the subprime buyer on a phone:** one question per screen, 6th-grade reading level, big type (body ≥15px), a single gold button per screen, "why we ask" explanations next to anything sensitive, progress always saved, text-first contact with a named human (Tina/Bo). Never surprise them: every number labeled "estimate" until it's real. Tone: plainspoken, small-town, no big-dealer gloss — "buy a good vehicle from people you know."

## About the Design Files
The bundled `Martindale Explorations.dc.html` is a **design reference created in HTML** — a prototype showing intended look and behavior, not production code. The task is to **recreate these designs in the target codebase's environment** (or, since this is greenfield, choose an appropriate stack — a recommendation is given below) using established patterns and libraries. Do not ship the HTML directly.

The file is a design-exploration canvas with several turns of options. **Build these:**
- `#3a` — Homepage (final merged direction)
- `#3b` — Inventory search + filter sheet (payment-first)
- `#1e` — VDP with walkaround video (second phone frame in that option; the first frame is an older inventory list superseded by `#3b`). Add a primary "Buy this truck online" button above "Get pre-approved" → opens `#4b`.
- `#4a` — Full credit application (5 steps; 4 representative frames shown: intro, step 1, step 3, step 5)
- `#4b` — Buy-online deal builder (6 frames: checklist hub, payment builder, financing offers, sign papers, pickup/delivery, done)
- `#1d` — Trade-in appraisal (2 screens) — also mounted as step 2 inside `#4b`
- `#1f` — Staff portal: Credit applications inbox (desktop, 1366w)
- `#4c` — Staff portal: Inventory (vAuto feed) + Deals pipeline (desktop, 1366w)

Ignore `#1a`, `#1b`, `#2a`, `#2b` (earlier homepages) and `#1c` (short pre-qual — replaced by the full app `#4a`; the "Get pre-approved" buttons across the site now open `#4a`).

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, and copy are final. Recreate pixel-perfectly. Gray `image-slot` placeholder boxes mark where real photos/video stills go — the dealership will supply them (see Assets).

## Recommended stack (greenfield)
No existing codebase. Recommended: **Next.js (App Router) + Tailwind or CSS-in-JS mapped to the tokens below + Postgres (Prisma) + S3-compatible storage for photos/videos.** Customer site must be SSR/SSG for SEO (VDPs indexed per stock #). Staff portal can be a route group behind auth (e.g. `/portal`). Any equivalent stack is fine; the designs are framework-agnostic.

## Design Tokens

### Colors
| Token | Hex | Use |
|---|---|---|
| ink | `#262115` | Primary text, dark surfaces, active chips |
| paper | `#FDFBF6` | Homepage background |
| paper-warm | `#FAF6EE` | App-screen background (flows, inventory) |
| paper-tint | `#F4EFE3` | Footer band on homepage |
| paper-panel | `#F4F0E6` | Portal background |
| cream | `#F4EEE1` | Light text on dark surfaces |
| gold (primary CTA) | `#C6952F` | Buttons, active states, progress |
| gold-ink | `#1F1708` | Text on gold |
| gold-bright | `#D9AE4B` / `#EBC776` | Gold accents on dark bg |
| link / accent | `#8A6D1F` | Links, tertiary actions (hover `#6E5617`) |
| body-muted | `#6B6353` | Body copy |
| muted | `#8A8172` | Secondary/metadata text |
| faint | `#A39A88` | Placeholder text, fine print |
| green | `#33704B` | Success, payment estimates, "approved" |
| rust | `#B4552D` | Warnings, "docs needed", favorite heart |
| blue | `#3A6285` | "Sent to lender" status |
| notice-bg | `#EFE6D2` | Callout/banner background (border `rgba(138,109,31,.25)`, text `#6E5A2A`) |
| border | `rgba(38,33,21,.1)` – `.18` | Card and input borders |
| overlay | `rgba(24,20,12,.78)` | Video badges/play buttons over imagery |

### Typography
- **Display:** `Bricolage Grotesque` (Google Fonts, variable 400–800). Headlines, prices, section titles. Weight 800 for h1/prices.
- **Body/UI:** `Public Sans` (Google Fonts, 400–800). Everything else.
- Scale (mobile): h1 30–34px/1.1 800 display · h2 20–24px 800 display · price-lg 22px 800 display · body 14–15px/1.55 · label 13px 600 · meta 12–12.5px · fine print 10.5–11.5px.
- Wordmark: "MARTINDALE" 800 display + "CHEVROLET" 600 8px Public Sans, letter-spacing .24em, gold-link color.

### Spacing & shape
- Mobile page width 402px reference; screen padding 20–24px; section gaps 24–30px.
- Radii: buttons/inputs 12–14px · cards 16–18px · chips 999px · thumbnails 8–10px.
- Primary button: height 54–56px, gold bg, gold-ink text, 700 15–16px.
- Secondary button: white bg, 1.5px border `rgba(38,33,21,.25)`, ink text.
- Chips: height 34–38px, pill; inactive white + 1px border; active ink bg + cream text (or gold bg in filter sheet).
- Inputs: height 52px, white, 1.5px border `rgba(38,33,21,.18)`, radius 12px; focus: gold border + `0 0 0 3px rgba(198,149,47,.15)` ring.
- Toggles: 46×28px pill, gold when on.
- Cards: white, 1px border, subtle shadow `0 1px 3px rgba(38,33,21,.07)`.
- Min hit target 44px.

## Screens / Views

### 1. Homepage (`#3a`, mobile)
Purpose: route visitors to inventory, pre-approval, trade-in, or service in one screen.
Layout, top to bottom:
1. **Header** — wordmark left; right: "Call" text link (`tel:5737482512`) + hamburger. Padding 18/22.
2. **Hero** — h1 "Buy a good vehicle from people you know." (32px/1.12 800); sub "New Madrid, MO · Mon–Fri 8–5".
3. **Search box** — 56px, white, magnifier icon, placeholder `Silverado, Equinox, "under $300/mo"…` → navigates to inventory search with query.
4. **Quick chips** — Under $20K · Under $300/mo · Trucks · SUVs → inventory pre-filtered.
5. **Primary CTA** — "Get pre-approved" gold button → credit flow. Below: "One minute · no SSN · doesn't touch your credit" (12.5px centered, muted).
6. **Photo** — full-width 250px (lot or family photo).
7. **Tap list** — 3 rows, chevron right, divided by 1px borders: "Shop vehicles / 38 in stock · 14 under $20K" → inventory; "Value my trade / Plate or VIN · 2 minutes" → trade-in; "Schedule service / 573-748-2241" → `tel:`. Row: title 17px 700 display, sub 13px muted, padding 20px vertical. Counts are live from inventory data.
8. **Footer** — paper-tint band: address, Sales `tel:5737482512`, Text `sms:5736205630`, social links.

### 2. Inventory search (`#3b`, mobile, two screens)
**Browse screen:**
- Sticky top bar (paper-warm): search field (44px) + filter button (44px ink square, badge = active filter count, gold circle).
- Horizontal row of active-filter chips (ink bg, × to remove) + inactive quick filters (Year, Mileage → open filter sheet).
- Result meta row: "9 matches" (13px 700) left; sort "Lowest payment first ↓" (gold-link) right.
- Vehicle cards (white, 18px radius): photo 186px with (a) walkaround-video duration badge top-left (overlay bg, play icon, e.g. "0:44 walkaround"), (b) favorite heart top-right (34px white circle; filled rust when saved). Body: **payment-first price row** — "$244" 22px 800 display + "/mo est." 12px muted, cash price right-aligned 13px muted; title 14px 700; meta line 12.5px muted ("52k mi · local trade · clean Carfax").
- Inline banner after ~2 cards (notice-bg): "**Payments are estimates.** Pre-approve in a minute to see your real number — no SSN, no credit hit." + gold "Start" button → credit flow.

**Filter sheet (full screen):**
- Header: "Filters" h1 + "Clear all" (gold-link).
- **By payment / By price** segmented toggle (white container, gold active segment) — switches whether the range slider filters monthly payment or cash price.
- Payment slider: single-thumb, gold track fill, label right "Up to $300/mo"; caption "Est. w/ $2,000 down · 72 mo · adjust down payment below".
- Body type chips with live counts: SUV · 11 (active = ink bg), Truck · 13, Sedan · 9, Van · 3.
- Max mileage slider ("80k mi").
- "More" toggle list: Has walkaround video (on) · Local trade-in (off) · New only (off).
- Sticky bottom CTA: "Show 9 matches" (count updates live as filters change).

### 3. Vehicle detail page (`#1e`, second frame, mobile)
- **Media hero 250px**: walkaround video still, centered play button (54px circle, overlay bg, 1.5px white/40 border), badge bottom-right "0:58 · Bo's walkaround", back button top-left (34px white circle).
- Thumbnail strip: 64×44px, video first (gold 2px outline when active), then photos, last cell "+9" (ink/8 bg).
- Title row: "2020 Silverado 1500 LT" 22px 800 display + price "$28,900" same style right.
- Meta: "Crew Cab · 62k mi · 4WD · 5.3L V8 · Stock #M2214".
- **Payment card** (white, 14px radius): "$412/mo est." 19px 800 display; caption "$2,000 down · 72 mo · adjust ↓"; "Payment calc" outline button opens calculator (down payment, term, trade value inputs; recompute est. payment).
- CTAs: gold "Get pre-approved for this truck" (carries vehicle into credit flow); row of two outline buttons "Value my trade" / "Text about this truck" (`sms:` with prefilled vehicle message).
- Personal note callout (notice-bg): staff avatar + "**Bo shot this walkaround Tuesday.** Ask him anything: 573-620-5630".

### 4. Full credit application (`#4a`, mobile, 5 steps)
Chrome per step: back arrow + "Step N of 5 · Label" (13px muted); 5-segment progress bar (4px, gold filled). Every step: one h1 question (28px 800 display), optional 15px sub, ≤4 fields, gold "Next" 56px, footer "Stuck? Text Tina: 573-620-5630".
- **Intro:** h1 "Apply for financing."; "Have these handy" card (license, SSN, monthly income); locked-up notice; CTA "Start my application"; "Stop anytime — we save your spot and text you a link back."
- **Step 1 About you:** First name, Last name, Date of birth, Cell phone (helper "We text you updates here. No robo-calls.").
- **Step 2 Home:** Rent/Own toggle, monthly housing payment, time at address, previous address if <2 yrs (progressive).
- **Step 3 Your ID:** license Front/Back photo capture (dashed 110px slots; OCR fills address → confirm screen) or "type your address instead"; SSN field, masked as typed (••• – •• – 4), eye toggle; "Why we ask" callout.
- **Step 4 Work:** Employer, job title, monthly income pre-tax, time there, other income (optional, plain: "Child support, disability, side work — count it").
- **Step 5 Check & send:** summary card (You / Home / Work / ID) with Edit links; single consent checkbox in plain English (hard inquiry disclosure); CTA "Send my application"; "Most folks hear back in about an hour…".
- **After send:** returns to the deal hub (`#4b`) with Financing marked "Sent — Tina's on it", or a standalone "You're on the books" screen (reuse `#1c` frame 3 styling) when not tied to a vehicle.

Validation: names required; DOB valid date, age ≥18; phone US 10-digit, format on blur; SSN 9 digits, reject known-invalid ranges, never echoed back in full; currency numeric; employer + income required; consent required. Inline errors rust 12px below field. Autosave every field change (server-side draft keyed to phone + magic-link token); resume via texted link.

**Security (non-negotiable):** TLS only; SSN and DOB encrypted at rest with field-level encryption (KMS-managed key), never logged, never in analytics, never in URLs; SSN stored only as ciphertext + last-4 for display; license images in private bucket with signed short-lived URLs, auto-delete 30 days after deal close/decline; portal shows SSN masked with reveal-on-click audited per view; GLBA Safeguards Rule + FCRA adverse-action flow; role-based access (finance role only sees full app); MFA on portal; session timeout 15 min; rate-limit public POSTs; CSRF; audit log on every read of PII.

### 4b. Buy online — deal builder (`#4b`, mobile, 6 frames)
Entry: VDP "Buy this truck online" or inventory card. Creates a `Deal` and **holds the vehicle** (soft hold, default until Sat 5pm / 72h; shows "Held for you until…"; portal can release).
- **Checklist hub:** vehicle card (thumb, title, price · mi · stock #, hold status); h1 "Five steps. You're on N."; "Do them in any order. Stop and come back whenever."; 5 rows — Your payment / Trade-in / Financing / Sign papers / Pick up or deliver. Row states: done (green check circle + summary + "Change"), current (gold number, `#FBF7EC` bg, chevron), available (outlined number), locked (55% opacity, reason text e.g. "After financing"). Bottom: gold CTA for the current step + text link to skip optional steps ("No trade — skip to financing").
- **Payment builder:** giant "$412/mo" (56px 800 display) labeled "About" + "Estimate. Your real number comes with financing."; Money-down slider $0–$5,000 with live value, helper "More down = lower payment and easier approval." (green); term segmented 48/60/72 each showing its $/mo; breakdown card: vehicle, tax/title/fees (est. by MO rate + county), money down (−), trade-in (link "Add one" or value), "You'd finance $X". CTA "Looks good" → saves `dealTerms`.
- **Financing offers (after lender decision):** green check, h1 "You're approved, {first}."; "Two ways to pay for it. Tina checked both — pick what fits your month." Offer cards: lender offer (gold 2px border + "LOWEST PAYMENT" tag when it is): lender name, $/mo 26px, term · APR · down, plain-English lines ("Autopay from your bank. Paid off Sept 2032."), gold "Choose this one"; in-house offer ("Pay Martindale directly"): $/mo, term, down, "pay here at the lot or by text", "Miss a week? You talk to Tina, not a call center." Outline "Choose this one". Also handle: **conditional** ("Almost — Tina needs one thing": stips list — pay stub, utility bill, references; each a photo upload) and **declined** ("Not this time" + what would help + "Tina will text you options" — comply with adverse-action notice requirements).
- **Sign papers:** h1 "Four things to sign."; doc rows with states done/current/locked: What you're buying (buyer's order), Your loan (retail installment contract, page count), Title & mileage (odometer statement), Proof of insurance (photo upload or "we help you get a quote"). Tap → in-app document viewer with finger signature (e-sign provider). Down payment card: "Your $1,500 down · Pay at the end" with Debit card / Bank (ACH) / Cash at lot. Disabled CTA "Finish — N left to sign" until all signed + payment method chosen. "You get a copy of everything by text and email."
- **Pickup or delivery:** three cards (selected = gold 2px border): Pick it up at the lot (Free; time-slot chips from staff calendar), Bring it to me (Free within 40 miles; town list; address field), Hold it 3 days (No charge). CTA "Finish — it's mine". Footer "Change your mind before pickup? Text Tina. No hard feelings, no fee."
- **Done (ink background):** photo slot (Bo with keys), h1 "It's yours, {first}." 36px cream, what to bring, summary card (vehicle · $/mo, first payment date, "Papers: texted to you"), gold "Add to calendar" (.ics), footer text number.

### 4c. Legacy pre-qual (`#1c`) — superseded, keep for reference only
Chrome per step: back arrow + "Step N of 3" (12px muted); 3-segment progress bar (4px, gold filled).
- **Step 1 — identity:** h1 "Let's get you pre-approved."; sub "About a minute. **No SSN needed to start**, and it won't touch your credit score." Fields: First name, Last name, Mobile phone (helper "We text — we don't robo-call."). CTA "Continue"; footer link "Rather talk it through? Call Tina: 573-748-2512".
- **Step 2 — home & work:** h1 "Home & work"; sub "Ballpark is fine — Tina firms it up with you." Fields: Rent/Own segmented toggle; Monthly rent payment ($); Where do you work? (text); Monthly income pre-tax ($) + Time there (select: <1 yr, 1–2, 3, 5+ yrs). Footer trust line with lock icon: "Encrypted · never sold · Missouri lenders we know by name".
- **Step 3 (screen: done):** green 64px check circle; h1 "You're on the books, {firstName}."; body: "Tina will text you from **573-620-5630** within the hour, Mon–Fri 8–5. Save the number so you know it's us." Numbered 3-step timeline (gold number circles): "We run it by our lenders" / "You get a real number" / "Pick your vehicle". Staff card: Tina avatar, "Tina · Finance / 14 years at Martindale", gold "Text Tina" button. Bottom outline CTA "Browse Under $20K while you wait". Fine print: "Submitting this form doesn't affect your credit score. A hard inquiry only happens later, with your OK, when you pick a vehicle and a lender."

Validation: names required, ≥1 char; phone required, US 10-digit, format as (XXX) XXX-XXXX on blur; currency fields numeric, strip non-digits, format with commas; income and housing payment required; employer required. Inline errors below field, rust text 12px. Persist partial progress in localStorage so a return visit resumes the step.

### 5. Trade-in appraisal (`#1d`, mobile, 2 screens)
- **Entry:** h1 "What are you driving now?"; plate (2fr) + state select (1fr, default MO); "— or enter VIN / year-make-model —" divider (tappable to swap input mode). After plate decode: confirmation card "2016 Silverado 1500 LT / Found from plate · Crew Cab 4WD" + "Change" link. Mileage input. "Honest condition" 3-segment: Rough / Decent / Sharp (selected = gold). Optional 4 photo slots (Front, Back, Seats, Dash — 64px, camera capture on mobile) labeled "(optional, tightens the number)". CTA "Get my number".
- **Estimate:** centered label "Your trade estimate"; range "$8,200 – $9,600" 44px 800 display; vehicle recap line. Notice callout: "**Good through Saturday.** The number firms up when we walk around it together — 10 minutes, no appointment needed." (expiry = end of current week). CTAs: gold "Lock it in — schedule a look"; outline "Apply it to a purchase". Breakdown card "How we got this range": Regional auction value $8,900 / Mileage adjustment −$400 (rust) / Crew cab 4WD demand +$700 (green) / Condition photos: pending (muted). Footer staff card: "**Bo** does our appraisals. Questions? Text him at 573-620-5630."

### 6a. Staff portal — Inventory & vAuto feed (`#4c` frame 1, desktop 1366×840)
Same sidebar as 6b (add "Deals" item at top with badge; Inventory active). Header: h1 "Inventory" + "38 units live on the site · from vAuto"; search (stock #, VIN, model); outline "Sync now".
- **Feed health banner** (white card, status dot green/rust): "vAuto feed healthy. Last file 6:02am today · 41 rows read · 2 added · 1 marked sold · 3 need attention · next pull 12:00pm" + "Feed log" link (table of every run: time, rows, adds/updates/removes, errors).
- Filter chips: All · Needs attention (rust outline) · No walkaround · Under $20K · Held / in a deal.
- Table columns: Stock · Vehicle (year make model trim · mi · source) · Price · vAuto change (New today green / ↓ $600 rust / Price mismatch rust / Not in feed) · Photos (n of n) · Walkaround (duration · who, or "Missing" rust) · On site (pill: Live green / Hidden — no photos rust / Held · buyer gold / Check — site $X rust / Removed · sold muted). New rows `#FBF7EC` + gold left border; removed rows 55% opacity. Row click → unit drawer: edit web-only fields (walkaround video upload, staff note "Bo's take", featured flag), vAuto fields read-only.

### 6b. Staff portal — Deals pipeline (`#4c` frame 2, desktop)
Header: h1 "Deals" + "Online buyers, left to right. Anything red is waiting on us." + gold "+ Start a deal for a walk-in". Five kanban columns with counts: Payment set · App in · Offers out · Signing · Pickup / delivery. Card: name, vehicle · price, one-line stage detail (terms / income + PTI / lender + $/mo + docs signed), status pill (SLA "Respond by 10:12a" rust; "Waiting on insurance" blue), inline actions on App-in cards: gold "Send to lenders" (Dealertrack/RouteOne) + outline "In-house". Rust top border = SLA at risk. Empty column = dashed box. Weekly stats callout in last column. Drag between columns updates `Deal.stage` (with guardrails: can't move to Signing without an accepted offer).

### 6c. Staff portal — Credit applications inbox (`#1f`, desktop 1366×840, three-pane)
Auth-gated. Roles: at minimum staff (Tina, Bo, Marcus) — role field on user, all can view; assignment controls routing.
- **Sidebar 224px, ink bg:** wordmark + "STAFF PORTAL" (gold-bright, letter-spaced); nav with count badges: Credit apps (4 new, gold badge), Trade-ins (2), Leads & follow-ups, Videos (12), Inventory. Active item: `rgba(198,149,47,.18)` bg + `#EBC776` text. Bottom: current-user card (avatar initial in gold circle, name, role).
- **Main column:** header bar (paper-warm): h1 "Credit applications", search "name or phone", gold "+ Manual entry" button (opens the same pre-qual form for walk-ins/phone-ins). KPI row, 4 white cards: New today (4) · Awaiting docs (2, rust) · Approved this week (6, green) · Median first response (22m). Table (white card): columns APPLICANT (name + phone · town) / VEHICLE INTEREST / SUBMITTED / ASSIGNED / STATUS. New rows: `#FBF7EC` bg + 3px gold left border. Status pills: New (gold) · In review (ink/8) · Docs needed (rust/14) · Sent to lender (blue/15) · Approved (green/14) · Turned down (ink/6, muted). Row click opens detail drawer.
- **Detail drawer 360px:** SLA pill "● New — respond by 10:12a" (submitted + 60 min); close ×; applicant name h2, contact line; action row: gold "Text", outline "Call", outline "Send to lender". PRE-QUAL SNAPSHOT grid: Income, Housing, Interest (vehicle), Est. PTI with judgment color ("6.8% — comfortable" green; PTI = est. payment ÷ monthly income; comfortable <10%, watch 10–15%, high >15% rust). ACTIVITY timeline (dot + line): app submitted, auto-text sent (with message preview), calls logged. Bottom: "Add an internal note…" input.

## vAuto Inventory Sync (CSV feed)
Dealer sets up a **scheduled inventory export in vAuto** to our SFTP endpoint (vAuto supports third-party feeds; typical cadence hourly or nightly — request hourly). Also support manual upload of the same CSV in the portal ("Sync now" triggers an immediate pull; falls back to upload).
- **Ingest job** (cron/queue): fetch newest file → parse (be tolerant of column naming; map via a config table) → upsert `Vehicle` by VIN (stock # as secondary key) → diff against current: rows in file not in DB = **add** (status `hidden` until ≥1 photo, then `live`); rows in DB not in file for 2 consecutive runs = mark **sold/removed** (hide from site, keep record; release any hold and notify assigned staff if in a deal); price change > $0 = record `PriceChange`, flag if site price was manually overridden (**Price mismatch** — vAuto wins unless override flag set).
- **Fields to map:** stock #, VIN, year, make, model, trim, body style, drivetrain, engine, transmission, exterior color, mileage, price (internet price), certified flag, photo URLs (ordered), description/comments, vAuto unit ID, date in stock. Photos: download to our storage on first sight, re-check when URL list changes.
- **Web-only fields live in our DB, never overwritten by feed:** walkaround video, staff note, featured flag, local-trade flag, hold/deal linkage.
- **Payment estimate** recomputed on price change: default 13.9% APR assumption for display (configurable), $2,000 down, 72 mo; show "/mo est."
- **Feed log:** every run stored (`FeedRun`: startedAt, rowsRead, added, updated, removed, errors[], fileName). Banner shows last run; alert staff by text if a run fails or 0 rows read.
- Homepage counts ("38 in stock · 14 under $20K") and chip counts come from live `Vehicle` where status = live.

## Deal & Financing Flow (server side)
- `Deal` state machine: `payment_set → app_in → offers_out → offer_accepted → signing → scheduled → delivered` (+ `cancelled`, `declined`). Any step may be revisited until `signing`.
- Vehicle **hold**: creating a deal sets `Vehicle.heldByDealId` + `holdExpiresAt` (72h default, extendable in portal); VDP shows "Held — text us to get in line"; expiry releases automatically and texts the buyer.
- **Lender routing:** on app submit → create `CreditApp` (status new, SLA 60 min) → staff clicks "Send to lenders" → push to **Dealertrack and/or RouteOne** via their dealer APIs (or, phase 1, staff enters in the lender portal and keys decisions back in). Decisions become `Offer` records (lender, APR, term, maxAmount, down, stips[]). **In-house / BHPH** offers are created by finance staff from a simple form (term, down, weekly/biweekly/monthly schedule). Buyer sees all offers marked `presented`; picking one sets `offer_accepted`.
- **E-sign:** generate buyer's order, RIC (lender's template or in-house RIC for BHPH), odometer statement from deal data → e-sign provider (e.g. DocuSign/Dropbox Sign) embedded signing → store signed PDFs; deliver copies by SMS link + email. Insurance: photo of card OR referral link; staff verifies before delivery.
- **Down payment:** card/ACH via a payment processor (Stripe or dealer's merchant provider) with "Cash at lot" option; record `Payment`. Refund path for cancellations.
- **Scheduling:** pickup slots from a staff availability calendar; delivery requests create a task for Bo with address + radius check (≤40 mi from 63869).
- **In-house payments (BHPH, phase 2):** buyer portal page "My payments" — next due, pay by debit/ACH, text reminders; staff ledger in portal.
- **Notifications (SMS-first, from 573-620-5630):** app received → offers ready → docs ready → signed → pickup reminder (day before) → post-delivery thank-you. Every text names a person (Tina/Bo) and includes a link back into the deal hub (magic link, 7-day expiry).

## Interactions & Behavior
- Payments everywhere are estimates: `est = (price − downPayment) × amortization(APR, term)`; defaults $2,000 down, 72 mo, disclose assumptions. Show green `$XXX/mo est.` on cards.
- Search accepts free text: model names, "under $300/mo", "under $20K" → parse into filters.
- Filters update result count live; "Show N matches" applies and returns to browse.
- Favorites persist (localStorage for anon; account/phone-keyed if identified).
- Video: walkaround videos are phone-shot; VDP hero plays inline (native `<video>` or YouTube embed); duration badges from metadata.
- Credit-app submission: creates record → status New → fires auto-text to applicant → appears in portal inbox with 60-min SLA timer; assignment defaults to Tina (finance).
- Trade-in plate decode: plate+state → VIN → year/make/model/trim (vendor API, e.g. a plate-to-VIN service); estimate = base regional value ± adjustments, displayed with the breakdown.
- Transitions: keep minimal — step changes are instant or ≤200ms fade/slide; no decorative animation.
- Hover (desktop portal): rows lighten to `#FBF9F2`; buttons darken ~6%.
- All `tel:`/`sms:` links live as designed. Text-first contact is a brand behavior: "We text — we don't robo-call."

## State Management
- Customer: `searchQuery`, `filters {mode: payment|price, maxPayment, maxPrice, bodyTypes[], maxMileage, hasVideo, localTrade, newOnly}`, `favorites[]`, `creditApp {step, fields…}` (persisted), `tradeIn {vehicle, mileage, condition, photos[]}`.
- Portal: `apps[]` with status machine `new → in_review → docs_needed → sent_to_lender → approved | turned_down`, `assignedTo`, `activity[]` (typed events: submitted, auto_text, call, note, status_change), SLA deadline = submittedAt + 60 min.

## Data Model (suggested)
- `Vehicle` — id, vautoUnitId, stockNo, vin, year, make, model, trim, bodyType, drivetrain, engine, transmission, color, mileage, price, priceOverride?, condition (new/used), isLocalTrade, carfaxClean, status (hidden/live/held/sold/removed), heldByDealId?, holdExpiresAt?, photos[], walkaroundVideo {url, durationSec, shotBy, shotAt}, staffNote, featured, dateInStock, lastSeenInFeedAt.
- `FeedRun` — id, startedAt, finishedAt, fileName, rowsRead, added, updated, removed, errors[].
- `PriceChange` — vehicleId, oldPrice, newPrice, at, source (vauto/manual).
- `Lead` — id, firstName, lastName, phone, email?, town, source.
- `Deal` — id, leadId, vehicleId, stage, terms {downPayment, termMonths, estPayment, tradeInId?}, acceptedOfferId?, fulfillment {type: pickup|delivery|hold, slotAt?, address?}, holdExpiresAt, documents[], payments[], createdAt, updatedAt.
- `CreditApp` — id, leadId, dealId?, vehicleId?, dob (encrypted), ssn (encrypted, + ssnLast4), address {…}, prevAddress?, housing {type, monthlyPayment, months}, employer, jobTitle, monthlyIncome, otherIncome?, timeAtJob, licenseFrontUrl/backUrl (private), consentAt, consentIp, status, assignedToUserId, submittedAt, activity[].
- `Offer` — id, creditAppId, dealId, source (dealertrack/routeone/inhouse), lenderName, apr, termMonths, monthlyPayment, downRequired, maxAmount, stips[], status (presented/accepted/declined/expired), expiresAt.
- `Document` — id, dealId, type (buyers_order/ric/odometer/insurance), provider envelopeId, status, signedAt, pdfUrl (private).
- `Payment` — id, dealId, amount, method (card/ach/cash), status, processorRef, at.
- `TradeIn` — id, leadId, plate?, state?, vin?, year/make/model/trim, mileage, condition (rough/decent/sharp), photos[], estimateLow, estimateHigh, breakdown[], expiresAt.
- `User` (staff) — id, name, role, phone.
- `ActivityEvent` — id, appId, type, at, byUserId?, payload.

## API Endpoints (suggested)
- `GET /api/vehicles?filters…` · `GET /api/vehicles/:stockNo` · `PATCH /api/vehicles/:id` (staff, web-only fields)
- `POST /api/feed/run` (staff "Sync now") · `POST /api/feed/upload` (CSV) · `GET /api/feed/runs`
- `POST /api/deals` (public, creates hold) · `GET /api/deals/:id` (magic-link auth) · `PATCH /api/deals/:id/terms` · `POST /api/deals/:id/accept-offer` · `POST /api/deals/:id/documents/:type/sign` · `POST /api/deals/:id/payment` · `PATCH /api/deals/:id/fulfillment` · `PATCH /api/deals/:id/stage` (staff)
- `POST /api/credit-apps` (public, encrypts PII) · `PATCH /api/credit-apps/:id/draft` (autosave) · `GET/PATCH /api/credit-apps/:id` (auth, masked) · `POST /api/credit-apps/:id/reveal-ssn` (finance role, audited) · `POST /api/credit-apps/:id/submit-to-lenders` · `POST /api/credit-apps/:id/offers` (in-house) · `POST /api/credit-apps/:id/activity`
- `POST /api/auth/magic-link` (SMS link for buyers) · staff auth with MFA
- `POST /api/trade-ins` · `POST /api/trade-ins/decode-plate`
- `POST /api/favorites` (or client-side only)
- `POST /api/videos/upload` (staff; direct-to-storage signed URL; store duration/thumbnail)
- Auto-text via SMS provider (e.g. Twilio) webhook on app creation, from 573-620-5630.

## Assets
- All photos/video stills are `image-slot` placeholders — dealership supplies: lot/storefront photo, staff headshots (Bo — sales/appraisals, Tina — finance, Marcus — service), vehicle photos, walkaround videos.
- Fonts: Bricolage Grotesque + Public Sans via Google Fonts.
- Icons are inline SVGs in the reference file (magnifier, chevron, heart, play, hamburger, lock, check) — recreate or use a library matching 1.6–2px stroke weight.
- Dealership logo image exists (`abc80a10….png` in project root, included here as `logo.png`) — not yet placed in the designs; wordmark is currently typographic.

## Real business facts used in copy (keep accurate)
- Address: 521 US Highway 61, New Madrid, MO 63869
- Sales 573-748-2512 · Service 573-748-2241 · Text 573-620-5630
- Hours: Mon–Fri 8–5 · Sat by appointment · Sun closed
- Inventory counts (38 in stock, 14 under $20K), staff names/tenures, and all customer names in the portal are **sample data** — replace with live data.

## Files
- `Martindale Explorations.dc.html` — the design canvas (open in a browser; sections `#3a`, `#3b`, `#1c`, `#1d`, `#1e`, `#1f` are the build targets).
- `ios-frame.jsx`, `image-slot.js`, `support.js` — prototype scaffolding only; not part of the product.
- `logo.png` — dealership logo asset.
