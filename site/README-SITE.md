# Martindale Chevrolet — Dealer Website

Simple, no-frills website for Martindale Chevrolet (New Madrid, MO). Plain HTML, CSS and JavaScript — no build tools, no frameworks. Open `index.html` in a browser and it works.

## What's in here

| File / folder | What it is |
|---|---|
| `index.html` | Home page |
| `inventory.html` | Vehicle inventory with New/Used and type filters |
| `service.html` | Service & parts info + appointment request form |
| `about.html` | About the dealership and the team |
| `contact.html` | Contact info + message form |
| `css/styles.css` | All the styling (colors, layout, mobile menu) |
| `js/main.js` | Mobile menu, active nav link, footer year |
| `js/inventory.js` | Reads `inventory/vehicles.json` and draws the vehicle cards |
| `inventory/vehicles.json` | **The vehicle list.** Edit this to add/remove vehicles. |
| `images/` | Put vehicle photos and team photos here |

## How to update inventory

Open `inventory/vehicles.json` and add a block like this for each vehicle:

```json
{
  "stock": "U2004",
  "year": 2023,
  "make": "Chevrolet",
  "model": "Silverado 1500",
  "trim": "RST Crew Cab 4WD",
  "type": "Truck",
  "condition": "Used",
  "price": 41900,
  "miles": 22000,
  "image": "images/u2004.jpg"
}
```

Save the file, refresh the page, done. Leave `"image": ""` if you don't have a photo yet.

## Before going live — fill in the placeholders

Search the files for these and replace them with the real thing:

- ~~Street address, phone numbers, hours~~ — already filled in (521 US Highway 61 · Sales 573-748-2512 · Service 573-748-2241 · Text 573-620-5630 · Mon–Fri 8–5, Sat by appointment)
- ~~Email~~ — already filled in (jbrewersales@gmail.com)
- Team photos in `about.html`
- Logo is at `images/logo.png` if you want it in the header (currently a text wordmark)

> Hosting: this site is deployed to AWS Lightsail — see `../HANDOFF-LIGHTSAIL.md`. The GitHub Pages / Netlify notes below still work as alternatives.

## Hooking up the forms

The Service and Contact forms don't send anywhere yet. Easiest options (no server needed):

1. **Formspree** (free tier) — sign up at formspree.io, get a form URL, and change `action="#"` to that URL on each form.
2. **Netlify Forms** — if you host on Netlify, add `netlify` to each `<form>` tag and it just works.

## Hosting (free options)

- **GitHub Pages**: repo Settings → Pages → Source: `main` branch, root folder. Site appears at `https://<your-username>.github.io/martindale-chevrolet-dealersite/`.
- **Netlify**: drag the folder onto app.netlify.com/drop, or connect the GitHub repo.

## Local preview

Because inventory loads from a JSON file, some browsers block it when opened directly from disk. Run a tiny local server instead:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000
