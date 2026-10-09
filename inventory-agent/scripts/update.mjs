// Morlan inventory shopping agent.
//
// For every new and used car at each Morlan store, it looks for the same
// car (same year, make, model, trim and drive) listed cheaper at another
// dealer within the search radius, using the MarketCheck listings API.
// Results go to inventory-agent/data/results.json, which the page reads.
//
// Run:  MARKETCHECK_API_KEY=xxxx node inventory-agent/scripts/update.mjs

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const DEFAULT_BASE = "https://api.marketcheck.com/v2";
const PAGE_SIZE = 50;
const MAX_INVENTORY_PER_STORE = 3000;
const MATCHES_KEPT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

const lower = (s) => String(s ?? "").trim().toLowerCase();

function nameFits(dealer, store) {
  const name = lower(dealer?.name);
  return store.nameWords.every((w) => name.includes(lower(w)));
}

function cityFits(dealer, store) {
  return !dealer?.city || lower(dealer.city) === lower(store.city);
}

// Turn a MarketCheck listing into the small shape the page uses.
export function toCar(l) {
  const b = l.build || {};
  const d = l.dealer || {};
  return {
    vin: l.vin || "",
    stock: l.stock_no || "",
    type: lower(l.inventory_type) === "new" ? "new" : "used",
    certified: lower(l.inventory_type) === "certified" || !!l.is_certified,
    year: Number(b.year) || null,
    make: b.make || "",
    model: b.model || "",
    trim: b.trim || "",
    drivetrain: b.drivetrain || "",
    color: l.exterior_color || "",
    miles: Number(l.miles) || 0,
    price: Number(l.price) || 0,
    url: l.vdp_url || "",
    photo: l.media?.photo_links?.[0] || "",
    dealer: {
      id: d.id != null ? String(d.id) : "",
      name: d.name || "",
      city: d.city || "",
      state: d.state || "",
      phone: d.phone || "",
    },
    distance: l.dist != null ? Math.round(Number(l.dist)) : null,
  };
}

// The rules for "the same car". The API search is already narrowed to the
// same year/make/model; this double-checks trim and drive, which the API
// matches loosely.
export function isSameCar(ours, other) {
  if (ours.year !== other.year) return false;
  if (lower(ours.make) !== lower(other.make)) return false;
  if (lower(ours.model) !== lower(other.model)) return false;
  if (ours.trim && other.trim && lower(ours.trim) !== lower(other.trim)) return false;
  if (ours.drivetrain && other.drivetrain && lower(ours.drivetrain) !== lower(other.drivetrain)) return false;
  return true;
}

export function makeApi({ apiKey, base = DEFAULT_BASE, fetchImpl = fetch }) {
  let calls = 0;
  async function get(endpoint, params) {
    const url = new URL(base.replace(/\/$/, "") + endpoint);
    url.searchParams.set("api_key", apiKey);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
    calls++;
    const res = await fetchImpl(url.toString(), { headers: { Accept: "application/json" } });
    if (!res.ok) {
      // The results file is public, so never let the key leak into it.
      const body = (await res.text()).split(apiKey).join("***").slice(0, 300);
      throw new Error(`MarketCheck said ${res.status} for ${endpoint}: ${body}`);
    }
    return res.json();
  }
  return {
    search: (params) => get("/search/car/active", params),
    get calls() {
      return calls;
    },
  };
}

// Find MarketCheck's id for a store: first by its website, then by looking
// at listings right around the store's address.
async function findDealerId(api, store) {
  if (store.dealerId) return String(store.dealerId);
  if (store.website) {
    const r = await api.search({ source: store.website, rows: 5 });
    const hit = (r.listings || []).find((l) => nameFits(l.dealer, store) && cityFits(l.dealer, store));
    if (hit?.dealer?.id != null) return String(hit.dealer.id);
  }
  for (let start = 0; start < 500; start += PAGE_SIZE) {
    const r = await api.search({
      latitude: store.latitude,
      longitude: store.longitude,
      radius: 10,
      rows: PAGE_SIZE,
      start,
    });
    const listings = r.listings || [];
    const hit = listings.find((l) => nameFits(l.dealer, store) && cityFits(l.dealer, store));
    if (hit?.dealer?.id != null) return String(hit.dealer.id);
    if (listings.length < PAGE_SIZE) break;
  }
  return "";
}

async function loadInventory(api, dealerId) {
  const cars = [];
  for (let start = 0; start < MAX_INVENTORY_PER_STORE; start += PAGE_SIZE) {
    const r = await api.search({ dealer_id: dealerId, rows: PAGE_SIZE, start });
    const listings = r.listings || [];
    for (const l of listings) {
      const car = toCar(l);
      if (car.vin && car.price > 0 && car.year && car.make && car.model) cars.push(car);
    }
    if (listings.length < PAGE_SIZE || start + PAGE_SIZE >= (r.num_found ?? 0)) break;
  }
  return cars;
}

async function findCheaper(api, car, store, settings, morlanDealerIds) {
  const params = {
    year: car.year,
    make: car.make,
    model: car.model,
    trim: car.trim || undefined,
    car_type: car.type,
    latitude: store.latitude,
    longitude: store.longitude,
    radius: settings.searchRadiusMiles,
    price_range: `1-${Math.floor(car.price) - 1}`,
    sort_by: "price",
    sort_order: "asc",
    rows: 25,
  };
  if (car.type === "used") {
    const w = settings.usedMilesWindow;
    params.miles_range = `${Math.max(0, car.miles - w)}-${car.miles + w}`;
  }
  const r = await api.search(params);
  return (r.listings || [])
    .map(toCar)
    .filter((o) => o.vin !== car.vin && o.price > 0 && o.price < car.price)
    .filter((o) => !morlanDealerIds.has(o.dealer.id))
    .filter((o) => isSameCar(car, o))
    .sort((a, b) => a.price - b.price)
    .slice(0, MATCHES_KEPT)
    .map((o) => ({ ...o, savings: Math.round(car.price - o.price) }));
}

export async function run({
  api,
  storesPath = path.join(ROOT, "stores.json"),
  resultsPath = path.join(ROOT, "data", "results.json"),
  now = new Date(),
  log = console.log,
}) {
  const config = JSON.parse(await readFile(storesPath, "utf8"));
  const settings = {
    searchRadiusMiles: config.searchRadiusMiles ?? 550,
    usedMilesWindow: config.usedMilesWindow ?? 15000,
    maxCarsCheckedPerRun: config.maxCarsCheckedPerRun ?? 400,
    recheckAfterDays: config.recheckAfterDays ?? 3,
  };

  let previous = { stores: [] };
  try {
    previous = JSON.parse(await readFile(resultsPath, "utf8"));
  } catch {
    // First run - nothing saved yet.
  }
  const previousByVin = new Map();
  for (const s of previous.stores || []) for (const c of s.cars || []) previousByVin.set(c.vin, c);

  // Step 1: find each store and load what it has on the lot.
  let configChanged = false;
  const stores = [];
  for (const store of config.stores) {
    const out = { name: store.name, city: store.city, state: store.state, dealerId: "", cars: [], error: "" };
    try {
      const id = await findDealerId(api, store);
      if (!id) throw new Error("Could not find this store in MarketCheck. Check its website and nameWords in stores.json.");
      if (store.dealerId !== id) {
        store.dealerId = id;
        configChanged = true;
      }
      out.dealerId = id;
      out.cars = await loadInventory(api, id);
      log(`${store.name}: ${out.cars.length} cars`);
    } catch (err) {
      // Keep showing yesterday's cars rather than an empty store.
      const old = (previous.stores || []).find((s) => s.name === store.name);
      out.cars = old?.cars || [];
      out.dealerId = out.dealerId || old?.dealerId || "";
      out.error = err.message;
      log(`${store.name}: ${err.message}`);
    }
    stores.push({ out, store });
  }
  const morlanDealerIds = new Set(stores.map((s) => s.out.dealerId).filter(Boolean));

  // Step 2: shop each car. Cars checked recently at the same price keep their
  // old answer so the daily run stays inside the API budget.
  const fresh = (c) => {
    const old = previousByVin.get(c.vin);
    return old && old.price === c.price && old.checkedAt && now - new Date(old.checkedAt) < settings.recheckAfterDays * DAY_MS;
  };
  const queue = [];
  for (const { out, store } of stores) {
    for (const car of out.cars) {
      const old = previousByVin.get(car.vin);
      if (fresh(car)) {
        car.matches = old.matches || [];
        car.checkedAt = old.checkedAt;
      } else {
        car.matches = old?.matches || [];
        car.checkedAt = old?.checkedAt || "";
        queue.push({ car, store });
      }
    }
  }
  // Never-checked cars first, then the oldest checks.
  queue.sort((a, b) => (a.car.checkedAt || "").localeCompare(b.car.checkedAt || ""));
  const todo = queue.slice(0, settings.maxCarsCheckedPerRun);
  let checked = 0;
  for (const { car, store } of todo) {
    try {
      car.matches = await findCheaper(api, car, store, settings, morlanDealerIds);
      car.checkedAt = now.toISOString();
      checked++;
    } catch (err) {
      log(`${car.year} ${car.make} ${car.model} ${car.vin}: ${err.message}`);
    }
  }

  const results = {
    updatedAt: now.toISOString(),
    radiusMiles: settings.searchRadiusMiles,
    checkedThisRun: checked,
    waitingToBeChecked: queue.length - checked,
    apiCalls: api.calls,
    stores: stores.map(({ out }) => out),
  };
  await writeFile(resultsPath, JSON.stringify(results, null, 1) + "\n");
  if (configChanged) await writeFile(storesPath, JSON.stringify(config, null, 2) + "\n");
  log(`Done. Checked ${checked} cars, ${results.waitingToBeChecked} waiting for the next run, ${api.calls} API calls.`);
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const apiKey = process.env.MARKETCHECK_API_KEY;
  if (!apiKey) {
    console.error("Missing MARKETCHECK_API_KEY. Add it under Settings > Secrets and variables > Actions.");
    process.exit(1);
  }
  const api = makeApi({ apiKey, base: process.env.MARKETCHECK_BASE || DEFAULT_BASE });
  run({ api }).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
