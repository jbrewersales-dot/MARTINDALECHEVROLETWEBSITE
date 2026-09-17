(function () {
  const V = window.VEHICLES; const $ = id => document.getElementById(id);
  const LIM = { pay: Math.max(300, Math.ceil(Math.max(0, ...V.map(v => v.payment)) / 50) * 50), price: Math.max(10000, Math.ceil(Math.max(0, ...V.map(v => v.price)) / 5000) * 5000), miles: Math.max(50000, Math.ceil(Math.max(0, ...V.map(v => v.mileage)) / 10000) * 10000) };
  $('maxPayment').max = LIM.pay; $('maxPrice').max = LIM.price; $('maxMiles').max = LIM.miles;
  const qs = new URLSearchParams(location.search);
  const F = { q: '', mode: 'payment', maxPayment: 1e9, maxPrice: 1e9, body: new Set(), maxMiles: 1e9, video: false, local: false, new: false, sort: 'payment' };
  // seed from URL / search box
  if (qs.get('q')) Object.assign(F, seedFromText(qs.get('q')));
  if (qs.get('maxPrice')) { F.mode = 'price'; F.maxPrice = Number(qs.get('maxPrice')); }
  if (qs.get('maxPayment')) { F.mode = 'payment'; F.maxPayment = Number(qs.get('maxPayment')); }
  if (qs.get('body')) F.body.add(qs.get('body'));
  function seedFromText(t) { const p = MC.parseQuery(t); const o = { q: p.q }; if (p.maxPayment) { o.mode = 'payment'; o.maxPayment = p.maxPayment; } if (p.maxPrice) { o.mode = 'price'; o.maxPrice = p.maxPrice; } if (p.body) F.body.add(p.body); return o; }
  $('q').value = F.q;

  function matches(v, ignore) {
    if (F.q && !`${v.year} ${v.make} ${v.model} ${v.trim} ${v.body_type} ${v.stock}`.toLowerCase().includes(F.q)) return false;
    if (ignore !== 'range') { if (F.mode === 'payment' && v.payment > F.maxPayment) return false; if (F.mode === 'price' && v.price > F.maxPrice) return false; }
    if (ignore !== 'body' && F.body.size && !F.body.has(v.body_type)) return false;
    if (v.mileage > F.maxMiles) return false;
    if (F.video && !v.videoLabel) return false; if (F.local && !v.local_trade) return false; if (F.new && v.condition !== 'New') return false;
    return true;
  }
  function sorted(rows) {
    const s = F.sort; return rows.slice().sort((a, b) => s === 'payment' ? a.payment - b.payment : s === 'price_desc' ? b.price - a.price : s === 'miles' ? a.mileage - b.mileage : (b.created_at > a.created_at ? 1 : -1));
  }
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function card(v) {
    return `<a class="card vcard" href="/vehicles/${esc(v.stock)}"><div class="photo card-img">${v.photo ? `<img src="${esc(v.photo)}" alt="${esc(v.title)}" loading="lazy">` : '<span>Photos coming soon</span>'}${v.videoLabel ? `<span class="badge"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>${esc(v.videoLabel)}</span>` : ''}</div>
      <div class="body"><div class="price-row"><span class="pay">${MC.money(v.payment)}<small>/mo est.</small></span><span class="cash">${MC.money(v.price)}</span></div><h3>${esc(v.title)}</h3>
      <div class="meta">${v.mileage >= 1000 ? Math.round(v.mileage / 1000) + 'k mi' : v.mileage + ' mi'}${v.condition === 'New' ? ' · new' : ''}${v.local_trade ? ' · local trade' : ''}${v.carfax_clean ? ' · clean Carfax' : ''} · Stock #${esc(v.stock)}</div></div></a>`;
  }
  const banner = `<div class="notice" style="grid-column:1/-1"><div class="row between" style="gap:14px"><div><b>Payments are estimates.</b> Get pre-approved to see your real number. Nothing hits your credit until you pick a vehicle and say OK.</div><a class="btn btn-gold btn-sm" href="/apply" style="flex:none">Start</a></div></div>`;

  function render() {
    const rows = sorted(V.filter(v => matches(v)));
    $('count').textContent = rows.length + (rows.length === 1 ? ' match' : ' matches');
    $('results').innerHTML = rows.map((v, i) => card(v) + (i === 1 ? banner : '')).join('');
    $('empty').classList.toggle('hide', rows.length > 0);
    // active chips
    const chips = [];
    if (F.mode === 'payment' && F.maxPayment < LIM.pay) chips.push(['range', 'Under ' + MC.money(F.maxPayment) + '/mo']);
    if (F.mode === 'price' && F.maxPrice < LIM.price) chips.push(['range', 'Under ' + MC.money(F.maxPrice)]);
    F.body.forEach(b => chips.push(['body:' + b, b + 's']));
    if (F.maxMiles < LIM.miles) chips.push(['miles', 'Under ' + F.maxMiles / 1000 + 'k mi']);
    if (F.video) chips.push(['video', 'Has video']); if (F.local) chips.push(['local', 'Local trade']); if (F.new) chips.push(['new', 'New only']);
    $('fcount').textContent = chips.length; $('fcount').classList.toggle('hide', !chips.length);
    $('active-chips').innerHTML = chips.map(([k, l]) => `<button class="chip on" data-rm="${k}">${l}<span class="x">×</span></button>`).join('') +
      (chips.length ? '' : `<button class="chip" data-open="1">Payment</button><button class="chip" data-open="1">Body type</button><button class="chip" data-open="1">Mileage</button>`);
    // sheet
    const n = V.filter(v => matches(v)).length; $('apply-filters').textContent = 'Show ' + n + (n === 1 ? ' match' : ' matches');
    $('pay-lab').textContent = F.maxPayment >= LIM.pay ? 'Any payment' : 'Up to ' + MC.money(F.maxPayment) + '/mo';
    $('price-lab').textContent = F.maxPrice >= LIM.price ? 'Any price' : 'Up to ' + MC.money(F.maxPrice);
    $('mi-lab').textContent = F.maxMiles >= LIM.miles ? 'Any' : F.maxMiles / 1000 + 'k mi';
    $('maxPayment').value = Math.min(F.maxPayment, LIM.pay); $('maxPrice').value = Math.min(F.maxPrice, LIM.price); $('maxMiles').value = Math.min(F.maxMiles, LIM.miles);
    document.querySelectorAll('#mode button').forEach(b => b.classList.toggle('on', b.dataset.mode === F.mode));
    $('pay-slider').classList.toggle('hide', F.mode !== 'payment'); $('price-slider').classList.toggle('hide', F.mode !== 'price');
    const bodies = [...new Set(V.map(v => v.body_type))].sort();
    $('body-chips').innerHTML = bodies.map(b => `<button class="chip ${F.body.has(b) ? 'on' : ''}" data-body="${esc(b)}">${esc(b)} <span class="n">${V.filter(v => v.body_type === b && matches(v, 'body')).length}</span></button>`).join('');
    document.querySelectorAll('.switch').forEach(s => s.classList.toggle('on', !!F[s.dataset.flag]));
  }

  // events
  $('q').addEventListener('input', () => { Object.assign(F, { q: '' }, seedFromText($('q').value)); render(); });
  $('sort').addEventListener('change', () => { F.sort = $('sort').value; render(); });
  $('open-filters').addEventListener('click', () => { $('sheet').classList.add('open'); document.body.style.overflow = 'hidden'; });
  $('apply-filters').addEventListener('click', () => { $('sheet').classList.remove('open'); document.body.style.overflow = ''; window.scrollTo(0, 0); });
  $('clear-all').addEventListener('click', e => { e.preventDefault(); Object.assign(F, { maxPayment: 1e9, maxPrice: 1e9, maxMiles: 1e9, video: false, local: false, new: false, q: '' }); F.body.clear(); $('q').value = ''; render(); });
  $('clear-empty').addEventListener('click', e => { e.preventDefault(); $('clear-all').click(); });
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-rm],[data-open],[data-body],[data-mode],.switch'); if (!t) return;
    if (t.dataset.rm) { const k = t.dataset.rm; if (k === 'range') { F.maxPayment = 1e9; F.maxPrice = 1e9; } else if (k.startsWith('body:')) F.body.delete(k.slice(5)); else if (k === 'miles') F.maxMiles = 1e9; else F[k] = false; render(); }
    else if (t.dataset.open) $('open-filters').click();
    else if (t.dataset.body) { F.body.has(t.dataset.body) ? F.body.delete(t.dataset.body) : F.body.add(t.dataset.body); render(); }
    else if (t.dataset.mode) { F.mode = t.dataset.mode; render(); }
    else if (t.classList.contains('switch')) { F[t.dataset.flag] = !F[t.dataset.flag]; render(); }
  });
  ['maxPayment', 'maxPrice', 'maxMiles'].forEach(id => $(id).addEventListener('input', () => { F[id] = Number($(id).value); render(); }));
  render();
})();
