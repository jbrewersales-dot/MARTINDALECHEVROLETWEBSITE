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

// MarketCheck turns away requests that come too fast (HTTP 429), so space
// them out and wait and retry when it happens anyway.
export function makeApi({ apiKey, base = DEFAULT_BASE, fetchImpl = fetch, minGapMs = 400, retryWaitsMs = [2000, 5000, 15000, 30000] }) {
  let calls = 0;
  let lastCall = 0;
  let rateLimitedInARow = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function get(endpoint, params) {
    const url = new URL(base.replace(/\/$/, "") + endpoint);
    url.searchParams.set("api_key", apiKey);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
    let res;
    for (let attempt = 0; ; attempt++) {
      const wait = lastCall + minGapMs - Date.now();
      if (wait > 0) await sleep(wait);
      lastCall = Date.now();
      calls++;
      res = await fetchImpl(url.toString(), { headers: { Accept: "application/json" } });
      if (res.status !== 429 || attempt >= retryWaitsMs.length) break;
      await sleep(retryWaitsMs[attempt]);
    }
    if (res.status === 429) {
      if (++rateLimitedInARow >= 3) {
        throw new QuotaError("MarketCheck keeps saying the rate limit is exceeded. The plan's daily or monthly lookups may be used up.");
      }
    } else rateLimitedInARow = 0;
    if (!res.ok) {
      // The results file is public, so never let the key leak into it.
      const body = (await res.text()).split(apiKey).join("***").slice(0, 300);
      if (/quota/i.test(body)) {
        throw new QuotaError(`MarketCheck says this plan's lookups are used up (${body}). It will try again on the next daily run.`);
      }
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

const dealerLabel = (d) => `${d?.name || "?"} (${d?.city || "?"}, ${d?.state || "?"}) id ${d?.id ?? "?"}`;
const SCAN_RADIUS_MILES = 10;
const PAGE_LIMIT = 500; // most rows a MarketCheck plan will page through
const MAX_PRICE = 500000;

// Every listing within a few miles of a store. On some MarketCheck plans a
// search by dealer_id or website only returns a count with no cars, while a
// search by location returns the cars, so the store's cars are picked out of
// this. Plans also stop paging after PAGE_LIMIT rows, so a busy area is split
// into price bands small enough to page all the way through. Stores in the
// same town share one scan.
async function scanArea(api, store, cache, log) {
  const key = `${store.latitude},${store.longitude}`;
  if (!cache.has(key)) {
    const area = { latitude: store.latitude, longitude: store.longitude, radius: SCAN_RADIUS_MILES };
    cache.set(key, scanBand(api, area, 1, MAX_PRICE, log));
  }
  return cache.get(key);
}

async function scanBand(api, area, lo, hi, log, filterWorks) {
  const first = await api.search({ ...area, price_range: `${lo}-${hi}`, rows: PAGE_SIZE, start: 0 });
  const found = first.num_found ?? 0;
  if (found > PAGE_LIMIT && hi > lo) {
    if (filterWorks === undefined) {
      // Make sure MarketCheck honors price_range before splitting on it, or
      // the splitting would never end: nothing is priced above MAX_PRICE.
      const none = await api.search({ ...area, price_range: `${MAX_PRICE + 1}-${MAX_PRICE * 10}`, rows: 1 });
      filterWorks = (none.num_found ?? 0) < found;
      if (!filterWorks) log(`  Price filter is ignored; only the first ${PAGE_LIMIT} of ${found} listings in this area are used.`);
    }
    if (filterWorks) {
      const mid = Math.floor((lo + hi) / 2);
      return [
        ...(await scanBand(api, area, lo, mid, log, true)),
        ...(await scanBand(api, area, mid + 1, hi, log, true)),
      ];
    }
  }
  const all = [...(first.listings || [])];
  for (let start = PAGE_SIZE; start < Math.min(found, PAGE_LIMIT); start += PAGE_SIZE) {
    const r = await api.search({ ...area, price_range: `${lo}-${hi}`, rows: PAGE_SIZE, start });
    const listings = r.listings || [];
    all.push(...listings);
    if (listings.length < PAGE_SIZE) break;
  }
  return all;
}

// Which dealer in the scan is this store: the saved id if it has cars here,
// otherwise the dealer whose name has all of the store's nameWords.
function pickDealer(listings, store) {
  if (store.dealerId && listings.some((l) => String(l.dealer?.id) === String(store.dealerId))) {
    return String(store.dealerId);
  }
  const hit = listings.find((l) => nameFits(l.dealer, store) && cityFits(l.dealer, store));
  return hit?.dealer?.id != null ? String(hit.dealer.id) : "";
}

function storeCars(listings, dealerId, store, log) {
  const cars = [];
  const seen = new Set();
  let skipped = 0;
  for (const l of listings) {
    if (String(l.dealer?.id) !== dealerId) continue;
    const car = toCar(l);
    if (seen.has(car.vin)) continue;
    seen.add(car.vin);
    if (car.vin && car.price > 0 && car.year && car.make && car.model) cars.push(car);
    else skipped++;
  }
  if (skipped) log(`  ${store.name}: skipped ${skipped} listings with no price posted`);
  return cars;
}

function dealersIn(listings) {
  const seen = new Map();
  for (const l of listings) if (l.dealer?.id != null) seen.set(String(l.dealer.id), l.dealer);
  return [...seen.values()].map(dealerLabel).join("; ") || "none";
}

export class RadiusLimitError extends Error {}
export class QuotaError extends Error {}

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
  let r;
  try {
    r = await api.search(params);
  } catch (err) {
    if (/radius limit/i.test(err.message)) throw new RadiusLimitError(err.message);
    throw err;
  }
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
    maxApiCallsPerRun: config.maxApiCallsPerRun ?? 1000,
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
  const scans = new Map();
  let quotaHit = "";
  for (const store of config.stores) {
    if (quotaHit) {
      const old = (previous.stores || []).find((s) => s.name === store.name);
      stores.push({ out: { name: store.name, city: store.city, state: store.state, dealerId: store.dealerId || "", cars: old?.cars || [], error: quotaHit }, store });
      continue;
    }
    const out = { name: store.name, city: store.city, state: store.state, dealerId: "", cars: [], error: "" };
    try {
      const listings = await scanArea(api, store, scans, log);
      const id = pickDealer(listings, store);
      if (!id) {
        throw new Error(
          `Could not find this store in MarketCheck near ${store.city}, ${store.state}. Dealers there: ${dealersIn(listings)}`
        );
      }
      if (store.dealerId !== id) {
        store.dealerId = id;
        configChanged = true;
      }
      out.dealerId = id;
      out.cars = storeCars(listings, id, store, log);
      const name = listings.find((l) => String(l.dealer?.id) === id)?.dealer;
      log(`${store.name}: ${out.cars.length} cars (${dealerLabel(name)})`);
    } catch (err) {
      if (err instanceof QuotaError) quotaHit = err.message;
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
  let warning = quotaHit;
  for (const { car, store } of quotaHit ? [] : todo) {
    if (api.calls >= settings.maxApiCallsPerRun) {
      log(`Stopping at ${api.calls} API calls (maxApiCallsPerRun). The rest wait for the next run.`);
      break;
    }
    if (checked && checked % 50 === 0) log(`  ...${checked} cars checked`);
    try {
      car.matches = await findCheaper(api, car, store, settings, morlanDealerIds);
      car.checkedAt = now.toISOString();
      checked++;
    } catch (err) {
      if (err instanceof QuotaError) {
        warning = err.message;
        log(warning);
        break;
      }
      if (err instanceof RadiusLimitError) {
        // Every other car would fail the same way, so stop spending calls.
        warning = `Your MarketCheck plan doesn't allow a ${settings.searchRadiusMiles} mile search. Lower searchRadiusMiles in stores.json or upgrade the plan. (${err.message})`;
        log(warning);
        break;
      }
      log(`${car.year} ${car.make} ${car.model} ${car.vin}: ${err.message}`);
    }
  }

  const results = {
    updatedAt: now.toISOString(),
    radiusMiles: settings.searchRadiusMiles,
    checkedThisRun: checked,
    waitingToBeChecked: queue.length - checked,
    apiCalls: api.calls,
    warning,
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
