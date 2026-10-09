// Temporary: tries a few search shapes to see which ones MarketCheck answers with cars.
import { makeApi } from "./update.mjs";
const api = makeApi({ apiKey: process.env.MARKETCHECK_API_KEY });
const lat = 36.7959, lon = -89.9579, dealer = "1075492";
const tries = {
  "dealer_id rows5": { dealer_id: dealer, rows: 5 },
  "dealer_id rows50": { dealer_id: dealer, rows: 50 },
  "dealer_id start0 rows10": { dealer_id: dealer, rows: 10, start: 0 },
  "source rows5": { source: "morlannissan.com", rows: 5 },
  "near rows5": { latitude: lat, longitude: lon, radius: 10, rows: 5 },
  "near rows50": { latitude: lat, longitude: lon, radius: 10, rows: 50 },
  "near zip": { zip: "63841", radius: 10, rows: 5 },
  "near + dealer_id": { latitude: lat, longitude: lon, radius: 10, dealer_id: dealer, rows: 5 },
  "near + dealer_name": { latitude: lat, longitude: lon, radius: 10, dealer_name: "Morlan Nissan", rows: 5 },
  "near + make": { latitude: lat, longitude: lon, radius: 10, make: "Nissan", rows: 5 },
  "comp 550": { year: 2022, make: "Nissan", model: "Rogue", latitude: lat, longitude: lon, radius: 550, rows: 5 },
  "comp 100": { year: 2022, make: "Nissan", model: "Rogue", latitude: lat, longitude: lon, radius: 100, rows: 5 },
  "comp 550 sorted": { year: 2022, make: "Nissan", model: "Rogue", latitude: lat, longitude: lon, radius: 550, rows: 5, sort_by: "price", sort_order: "asc" },
  "nationwide": { year: 2022, make: "Nissan", model: "Rogue", rows: 5 },
};
for (const [name, p] of Object.entries(tries)) {
  try {
    const r = await api.search(p);
    const l = r.listings || [];
    console.log(`PROBE ${name}: found ${r.num_found} sent ${l.length}` + (l[0] ? ` first: ${l[0].build?.year} ${l[0].build?.make} ${l[0].build?.model} $${l[0].price} @ ${l[0].dealer?.name} id ${l[0].dealer?.id} dist ${l[0].dist}` : ` keys: ${Object.keys(r).join(",")}`));
  } catch (e) {
    console.log(`PROBE ${name}: ERROR ${e.message}`);
  }
}
