// Runs the agent against a fake MarketCheck so the matching rules can be
// checked without an API key.  Run:  node --test inventory-agent/test

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { run, makeApi, isSameCar } from "../scripts/update.mjs";

const listing = (o) => ({
  vin: o.vin,
  stock_no: o.stock || "",
  inventory_type: o.type || "used",
  miles: o.miles ?? 30000,
  price: o.price,
  vdp_url: `https://example.com/${o.vin}`,
  dist: o.dist,
  build: { year: o.year ?? 2021, make: o.make ?? "Chevrolet", model: o.model ?? "Silverado 1500", trim: o.trim ?? "LT", drivetrain: o.drive ?? "4WD" },
  dealer: { id: o.dealerId, name: o.dealerName, city: o.city, state: o.state || "MO" },
});

const morlanChevy = { dealerId: 111, dealerName: "Autry Morlan Chevrolet", city: "Dexter" };
const morlanFord = { dealerId: 222, dealerName: "Morlan Ford Lincoln", city: "Sikeston" };

const ourTruck = listing({ vin: "OURTRUCK", price: 40000, ...morlanChevy });
const ourNew = listing({ vin: "OURNEW", type: "new", miles: 5, price: 55000, model: "Tahoe", trim: "Z71", ...morlanChevy });
const ourFord = listing({ vin: "OURFORD", price: 30000, make: "Ford", model: "F-150", trim: "XLT", ...morlanFord });

const elsewhere = { dealerName: "Big Lot Motors", city: "Memphis", state: "TN" };
const comps = [
  listing({ vin: "CHEAP1", price: 37000, dist: 150, dealerId: 900, ...elsewhere }),
  listing({ vin: "CHEAP2", price: 38500, dist: 40, dealerId: 901, ...elsewhere }),
  listing({ vin: "WRONGTRIM", price: 30000, trim: "WT", dist: 20, dealerId: 902, ...elsewhere }),
  listing({ vin: "WRONGDRIVE", price: 31000, drive: "2WD", dist: 20, dealerId: 903, ...elsewhere }),
  listing({ vin: "SISTERSTORE", price: 35000, dist: 30, ...morlanFord }),
  listing({ vin: "OURTRUCK", price: 40000, ...morlanChevy }),
];

function fakeFetch(seen) {
  return async (url) => {
    const u = new URL(url);
    const p = Object.fromEntries(u.searchParams);
    seen.push(p);
    let listings = [];
    if (p.dealer_id || p.source) listings = []; // like the real plan: a count but no cars
    else if (p.radius === "10") {
      // Everything for sale around a store, including other dealers.
      listings = [ourTruck, ourNew, ourFord, listing({ vin: "LOCAL1", price: 9000, dealerId: 500, dealerName: "Corner Lot", city: "Dexter" })];
    } else if (p.model === "Silverado 1500") listings = comps;
    else listings = [];
    return { ok: true, json: async () => ({ num_found: listings.length, listings }) };
  };
}

async function setup() {
  const dir = await mkdtemp(path.join(tmpdir(), "agent-"));
  const storesPath = path.join(dir, "stores.json");
  const resultsPath = path.join(dir, "results.json");
  await writeFile(
    storesPath,
    JSON.stringify({
      searchRadiusMiles: 550,
      usedMilesWindow: 15000,
      maxCarsCheckedPerRun: 100,
      recheckAfterDays: 3,
      stores: [
        { name: "Morlan Chevrolet", website: "morlanchevrolet.com", nameWords: ["Morlan", "Chevrolet"], city: "Dexter", state: "MO", latitude: 36.8, longitude: -89.9, dealerId: "" },
        { name: "Morlan Ford Lincoln", website: "nope.com", nameWords: ["Morlan", "Ford"], city: "Sikeston", state: "MO", latitude: 36.9, longitude: -89.6, dealerId: "" },
      ],
    })
  );
  return { storesPath, resultsPath };
}

test("finds the cheaper identical car and skips non-matches and sister stores", async () => {
  const { storesPath, resultsPath } = await setup();
  const seen = [];
  const api = makeApi({ apiKey: "KEY", base: "https://fake.test/v2", minGapMs: 0, retryWaitsMs: [], fetchImpl: fakeFetch(seen) });
  const results = await run({ api, storesPath, resultsPath, log: () => {} });

  const chevy = results.stores.find((s) => s.name === "Morlan Chevrolet");
  const ford = results.stores.find((s) => s.name === "Morlan Ford Lincoln");
  assert.equal(chevy.dealerId, "111");
  assert.equal(ford.dealerId, "222");
  assert.deepEqual(ford.cars.map((c) => c.vin), ["OURFORD"], "only the store's own cars, not other lots nearby");
  assert.equal(chevy.cars.length, 2);

  const truck = chevy.cars.find((c) => c.vin === "OURTRUCK");
  assert.deepEqual(truck.matches.map((m) => m.vin), ["CHEAP1", "CHEAP2"]);
  assert.equal(truck.matches[0].savings, 3000);

  // The comparison search used the 550 mile radius and the mileage window.
  const compSearch = seen.find((p) => p.model === "Silverado 1500");
  assert.equal(compSearch.radius, "550");
  assert.equal(seen.filter((p) => p.radius === "10").length, 2, "one area scan per town");
  assert.equal(compSearch.miles_range, "15000-45000");
  assert.equal(compSearch.price_range, "1-39999");

  // New cars search new cars and don't use a mileage window.
  const tahoeSearch = seen.find((p) => p.model === "Tahoe");
  assert.equal(tahoeSearch.car_type, "new");
  assert.equal(tahoeSearch.miles_range, undefined);

  // Dealer ids it found are saved for next time.
  const saved = JSON.parse(await readFile(storesPath, "utf8"));
  assert.equal(saved.stores[0].dealerId, "111");
});

test("a second run the same day reuses answers instead of spending API calls", async () => {
  const { storesPath, resultsPath } = await setup();
  const first = makeApi({ apiKey: "KEY", base: "https://fake.test/v2", minGapMs: 0, retryWaitsMs: [], fetchImpl: fakeFetch([]) });
  await run({ api: first, storesPath, resultsPath, log: () => {} });

  const seen = [];
  const second = makeApi({ apiKey: "KEY", base: "https://fake.test/v2", minGapMs: 0, retryWaitsMs: [], fetchImpl: fakeFetch(seen) });
  const results = await run({ api: second, storesPath, resultsPath, log: () => {} });
  assert.equal(results.checkedThisRun, 0);
  assert.equal(seen.filter((p) => p.price_range).length, 0);
  const truck = results.stores[0].cars.find((c) => c.vin === "OURTRUCK");
  assert.equal(truck.matches.length, 2);
});

test("a store that fails keeps yesterday's cars and never leaks the key", async () => {
  const { storesPath, resultsPath } = await setup();
  await run({ api: makeApi({ apiKey: "SECRET", base: "https://fake.test/v2", minGapMs: 0, retryWaitsMs: [], fetchImpl: fakeFetch([]) }), storesPath, resultsPath, log: () => {} });

  const broken = async () => ({ ok: false, status: 429, text: async () => "quota used up for key SECRET" });
  const results = await run({ api: makeApi({ apiKey: "SECRET", base: "https://fake.test/v2", minGapMs: 0, retryWaitsMs: [], fetchImpl: broken }), storesPath, resultsPath, log: () => {} });
  assert.equal(results.stores[0].cars.length, 2);
  assert.match(results.stores[0].error, /429/);
  assert.doesNotMatch(await readFile(resultsPath, "utf8"), /SECRET/);
});

test("same-car rules", () => {
  const base = { year: 2021, make: "Ford", model: "F-150", trim: "XLT", drivetrain: "4WD" };
  assert.ok(isSameCar(base, { ...base }));
  assert.ok(isSameCar(base, { ...base, trim: "" }), "missing trim on the other car is not a mismatch");
  assert.ok(!isSameCar(base, { ...base, trim: "Lariat" }));
  assert.ok(!isSameCar(base, { ...base, year: 2020 }));
  assert.ok(!isSameCar(base, { ...base, drivetrain: "RWD" }));
});

test("waits and tries again when MarketCheck says slow down", async () => {
  let tries = 0;
  const flaky = async () => {
    tries++;
    if (tries < 3) return { ok: false, status: 429, text: async () => "API rate limit exceeded" };
    return { ok: true, status: 200, json: async () => ({ num_found: 0, listings: [] }) };
  };
  const api = makeApi({ apiKey: "KEY", base: "https://fake.test/v2", minGapMs: 0, retryWaitsMs: [1, 1, 1], fetchImpl: flaky });
  const r = await api.search({ make: "Ford" });
  assert.equal(tries, 3);
  assert.equal(r.num_found, 0);

  tries = -10;
  const giveUp = makeApi({ apiKey: "KEY", base: "https://fake.test/v2", minGapMs: 0, retryWaitsMs: [1, 1], fetchImpl: flaky });
  await assert.rejects(giveUp.search({ make: "Ford" }), /429/);
});

test("spaces out calls", async () => {
  const times = [];
  const ok = async () => {
    times.push(Date.now());
    return { ok: true, status: 200, json: async () => ({ listings: [] }) };
  };
  const api = makeApi({ apiKey: "KEY", base: "https://fake.test/v2", minGapMs: 50, retryWaitsMs: [], fetchImpl: ok });
  await api.search({});
  await api.search({});
  await api.search({});
  assert.ok(times[2] - times[0] >= 95, `calls were ${times[2] - times[0]}ms apart`);
});

test("stops checking and says so when the plan's radius is too small", async () => {
  const { storesPath, resultsPath } = await setup();
  let priceChecks = 0;
  const limited = async (url) => {
    const p = Object.fromEntries(new URL(url).searchParams);
    if (p.price_range) {
      priceChecks++;
      return { ok: false, status: 422, text: async () => '{"code":422,"message":"Subscribed package radius limit of 100 miles exceeded"}' };
    }
    return fakeFetch([])(url);
  };
  const api = makeApi({ apiKey: "KEY", base: "https://fake.test/v2", minGapMs: 0, retryWaitsMs: [], fetchImpl: limited });
  const results = await run({ api, storesPath, resultsPath, log: () => {} });
  assert.equal(priceChecks, 1);
  assert.match(results.warning, /100 miles/);
  assert.equal(results.stores[0].cars.length, 2, "cars still listed");
});
