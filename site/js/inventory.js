// Loads inventory/vehicles.json and renders vehicle cards with simple filters.
// To add or change vehicles, edit inventory/vehicles.json — no code changes needed.

async function loadInventory() {
  const list = document.getElementById('vehicle-list');
  if (!list) return;

  let vehicles = [];
  try {
    const res = await fetch('inventory/vehicles.json');
    vehicles = await res.json();
  } catch (e) {
    list.innerHTML = '<p>Inventory is temporarily unavailable. Please call us at (573) 748-2512.</p>';
    return;
  }

  const condSel = document.getElementById('filter-condition');
  const typeSel = document.getElementById('filter-type');
  const search = document.getElementById('filter-search');

  // Fill the body-type dropdown from the data
  const types = [...new Set(vehicles.map(v => v.type))].sort();
  types.forEach(t => {
    const o = document.createElement('option');
    o.value = t; o.textContent = t;
    typeSel.appendChild(o);
  });

  function render() {
    const cond = condSel.value;
    const type = typeSel.value;
    const q = search.value.trim().toLowerCase();

    const rows = vehicles.filter(v =>
      (cond === 'all' || v.condition === cond) &&
      (type === 'all' || v.type === type) &&
      (!q || `${v.year} ${v.make} ${v.model} ${v.trim}`.toLowerCase().includes(q))
    );

    if (!rows.length) {
      list.innerHTML = '<p>No vehicles match those filters.</p>';
      return;
    }

    list.innerHTML = rows.map(v => `
      <article class="card">
        <div class="card-img">${v.image ? `<img src="${v.image}" alt="${v.year} ${v.make} ${v.model}">` : 'Photo coming soon'}</div>
        <div class="card-body">
          <h3>${v.year} ${v.make} ${v.model} ${v.trim || ''}</h3>
          <div class="price">$${Number(v.price).toLocaleString()}</div>
          <div class="meta">${v.condition} &middot; ${Number(v.miles).toLocaleString()} miles &middot; Stock #${v.stock}</div>
          <p><a class="btn btn-primary" href="contact.html?stock=${encodeURIComponent(v.stock)}">Ask About This Vehicle</a></p>
        </div>
      </article>
    `).join('');
  }

  [condSel, typeSel, search].forEach(el => el.addEventListener('input', render));
  render();
}

document.addEventListener('DOMContentLoaded', loadInventory);
