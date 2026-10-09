# MARTINDALECHEVROLETWEBSITE
MARTINDALE CHEVROLET WEBSITE MAKE A WORKING DEALERSHIP WEBSITE THAT CAN IMPORTAT INVENTORY ETC## K2B Network Solutions website

The site for **k2bnetworksolutions.com** is the `index.html`, `styles.css`, `script.js` and `favicon.svg` files in the main folder of this project.
Open `index.html` in a browser to view it. No build step needed.
The intro video that plays when the site opens is `intro.mp4`, with `intro.webm` as a backup copy (poster image: `intro-poster.jpg`). Replace that file to change it.
To change where demo requests are emailed, edit `CONTACT_EMAIL` at the top of `script.js`.

## Morlan Price Check (inventory shopping agent)

A public page at **/inventory-agent/** (for example `https://www.k2bnetworksolutions.com/inventory-agent/`).
It lists every new and used car at the Sikeston Morlan stores and, next to each one, the cheapest
**identical** car (same year, make, model, trim and drive) for sale at another dealer nearby (100 miles on the current MarketCheck plan; raise `searchRadiusMiles` after upgrading).

Listings come from the MarketCheck API. A GitHub Action runs once a day, updates
`inventory-agent/data/results.json`, and the page reads that file.

**One-time setup**

1. Sign up at marketcheck.com and copy your API key.
2. On GitHub, open this repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
   Name: `MARKETCHECK_API_KEY`. Value: your key.
3. Go to **Actions** → **Morlan price check** → **Run workflow** to fill the page the first time.

**Current setup:** the three Sikeston stores (Autry Morlan Chevrolet, Morlan Ford Lincoln, Morlan Dodge), a 100 mile search, and at most 4,000 MarketCheck lookups a month (`monthlyCallBudget`), spread evenly over the days left in the month.

**Changing things:** edit `inventory-agent/stores.json` to add or fix a store, change the search distance
(`searchRadiusMiles`), how close used-car mileage has to be (`usedMilesWindow`), or how many cars are
checked per day (`maxCarsCheckedPerRun`, each one uses one API call).

**Tests:** `node --test inventory-agent/test/*.test.mjs`
