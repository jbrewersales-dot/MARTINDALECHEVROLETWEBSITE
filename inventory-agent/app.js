// Morlan Price Check page. Reads data/results.json (written once a day by
// scripts/update.mjs) and shows each Morlan car next to cheaper twins.

const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
const miles = (n) => Math.round(n).toLocaleString("en-US") + " mi";
const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");

const el = (tag, props = {}, ...kids) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "href") {
      const url = safeUrl(v);
      if (url) node.href = url;
    } else node.setAttribute(k, v);
  }
  for (const kid of kids) if (kid != null && kid !== "") node.append(kid);
  return node;
};

let data = { stores: [] };
let cars = [];

const $ = (id) => document.getElementById(id);
const filters = {
  store: $("f-store"),
  type: $("f-type"),
  sort: $("f-sort"),
  search: $("f-search"),
  only: $("f-only"),
};

function carName(c) {
  return [c.year, c.make, c.model, c.trim].filter(Boolean).join(" ");
}

function place(d) {
  return [d.city, d.state].filter(Boolean).join(", ");
}

function closestOf(matches) {
  return matches
    .filter((m) => m.distance != null)
    .reduce((best, m) => (!best || m.distance < best.distance ? m : best), null);
}

function matchBlock(label, m) {
  const link = el("a", { href: m.url, target: "_blank", rel: "noopener" }, "See listing");
  return el(
    "div",
    { class: "match" },
    el("p", { class: "label" }, label),
    el("p", { class: "save" }, `${money(m.savings)} cheaper`),
    el("p", { class: "mprice" }, `${money(m.price)}${m.miles ? " · " + miles(m.miles) : ""}`),
    el("p", { class: "dealer" }, m.dealer.name || "Dealer"),
    el(
      "p",
      { class: "where" },
      [place(m.dealer), m.distance != null ? `${m.distance} miles away` : ""].filter(Boolean).join(" · ")
    ),
    m.dealer.phone ? el("p", { class: "where" }, m.dealer.phone) : null,
    safeUrl(m.url) ? link : null
  );
}

function renderCar(c) {
  const node = $("car-tpl").content.firstElementChild.cloneNode(true);
  const img = node.querySelector(".photo");
  if (safeUrl(c.photo)) img.src = c.photo;
  else img.remove();

  node.querySelector(".tag").textContent = `${c.storeName} · ${c.type === "new" ? "New" : c.certified ? "Certified used" : "Used"}`;
  const title = node.querySelector(".title");
  if (safeUrl(c.url)) title.append(el("a", { href: c.url, target: "_blank", rel: "noopener" }, carName(c)));
  else title.textContent = carName(c);
  node.querySelector(".meta").textContent = [
    c.type === "used" && c.miles ? miles(c.miles) : "",
    c.drivetrain,
    c.color,
    c.stock ? `Stock ${c.stock}` : "",
    c.vin,
  ]
    .filter(Boolean)
    .join(" · ");
  node.querySelector(".price").textContent = `Our price ${money(c.price)}`;

  const theirs = node.querySelector(".theirs");
  const matches = c.matches || [];
  if (!c.checkedAt) {
    theirs.append(el("p", { class: "none" }, "Not checked yet. It will be in the next weekly run."));
  } else if (!matches.length) {
    theirs.classList.add("best");
    theirs.append(el("p", { class: "none good" }, `No identical car cheaper than ours within ${data.radiusMiles || 550} miles.`));
  } else {
    const cheapest = matches[0];
    theirs.append(matchBlock("Cheapest twin", cheapest));
    const closest = closestOf(matches);
    if (closest && closest.vin !== cheapest.vin) theirs.append(matchBlock("Closest cheaper twin", closest));
    if (matches.length > 1) {
      const more = el("details", { class: "more" }, el("summary", {}, `All ${matches.length} cheaper twins`));
      const ul = el("ul");
      for (const m of matches) {
        const text = `${money(m.price)} (${money(m.savings)} less) · ${m.miles ? miles(m.miles) + " · " : ""}${m.dealer.name}, ${place(m.dealer)}${m.distance != null ? " · " + m.distance + " mi" : ""}`;
        ul.append(el("li", {}, safeUrl(m.url) ? el("a", { href: m.url, target: "_blank", rel: "noopener" }, text) : text));
      }
      more.append(ul);
      theirs.append(more);
    }
  }
  return node;
}

function render() {
  const store = filters.store.value;
  const type = filters.type.value;
  const q = filters.search.value.trim().toLowerCase();
  const only = filters.only.checked;

  let shown = cars.filter(
    (c) =>
      (!store || c.storeName === store) &&
      (!type || c.type === type) &&
      (!only || (c.matches || []).length) &&
      (!q || `${carName(c)} ${c.stock} ${c.vin}`.toLowerCase().includes(q))
  );
  const best = (c) => (c.matches?.[0]?.savings || 0);
  const sorters = {
    savings: (a, b) => best(b) - best(a) || b.price - a.price,
    "price-desc": (a, b) => b.price - a.price,
    "price-asc": (a, b) => a.price - b.price,
    year: (a, b) => b.year - a.year || b.price - a.price,
  };
  shown.sort(sorters[filters.sort.value]);

  $("count").textContent = `Showing ${shown.length} of ${cars.length} cars`;
  const list = $("list");
  list.replaceChildren();
  if (!shown.length) {
    list.append(el("p", { class: "empty" }, cars.length ? "No cars match these filters." : "No cars yet. The list fills in after the first weekly run."));
    return;
  }
  // Draw in chunks so a few thousand cars don't freeze a phone.
  const CHUNK = 60;
  let i = 0;
  const more = () => {
    const frag = document.createDocumentFragment();
    for (const c of shown.slice(i, i + CHUNK)) frag.append(renderCar(c));
    list.append(frag);
    i += CHUNK;
    if (i < shown.length) {
      const btn = el("button", { class: "load-more", type: "button" }, `Show more (${shown.length - i} left)`);
      btn.addEventListener("click", () => {
        btn.remove();
        more();
      });
      list.append(btn);
    }
  };
  more();
}

function renderStats() {
  const withMatch = cars.filter((c) => (c.matches || []).length);
  const total = withMatch.reduce((sum, c) => sum + c.matches[0].savings, 0);
  const stat = (num, label) => el("div", { class: "stat" }, el("p", { class: "num" }, num), el("p", { class: "lbl" }, label));
  $("stats").replaceChildren(
    stat(cars.length.toLocaleString("en-US"), "Morlan cars on the list"),
    stat(withMatch.length.toLocaleString("en-US"), "Have a cheaper twin nearby"),
    stat(money(total), "Total gap to the cheapest twins")
  );
  if (data.warning) $("stats").append(el("p", { class: "warn" }, data.warning));
  for (const s of data.stores) {
    if (s.error) {
      $("stats").append(el("p", { class: "warn" }, `${s.name}: couldn't refresh on the last run, so these may be older numbers. (${s.error})`));
    }
  }
}

async function load() {
  try {
    const res = await fetch("data/results.json", { cache: "no-store" });
    data = await res.json();
  } catch {
    $("updated").textContent = "Couldn't load the price list. Try refreshing.";
    return;
  }
  $("radius").textContent = data.radiusMiles || 550;
  $("updated").textContent = data.updatedAt
    ? `Last updated ${new Date(data.updatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}` +
      (data.waitingToBeChecked ? ` · ${data.waitingToBeChecked} cars still waiting to be checked` : "") +
      (data.usage?.budget ? ` · ${data.usage.calls.toLocaleString("en-US")} of ${data.usage.budget.toLocaleString("en-US")} lookups used this month` : "")
    : "Not run yet. The list fills in after the first weekly run.";

  cars = [];
  for (const s of data.stores || []) {
    filters.store.append(el("option", { value: s.name }, s.name));
    for (const c of s.cars || []) cars.push({ ...c, storeName: s.name });
  }
  renderStats();
  render();
}

for (const f of Object.values(filters)) f.addEventListener(f.type === "search" ? "input" : "change", render);
load();
