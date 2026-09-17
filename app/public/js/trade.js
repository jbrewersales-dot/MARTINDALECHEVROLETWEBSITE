(function () {
  const f = document.getElementById('trade'), $ = n => f.querySelector(`[name=${n}]`); let cond = ''; const photos = [];
  document.getElementById('cond').addEventListener('click', e => { const b = e.target.closest('[data-val]'); if (!b) return; cond = b.dataset.val; f.querySelectorAll('#cond button').forEach(x => x.classList.toggle('on', x === b)); });
  document.getElementById('decode').addEventListener('click', async () => {
    const vin = $('vin').value.trim().toUpperCase(); const help = document.getElementById('vin-help'); help.textContent = 'Looking it up…';
    try { const r = await fetch('/api/vin/' + encodeURIComponent(vin)); const j = await r.json(); if (!r.ok) throw new Error(j.error);
      $('year').value = j.year || ''; $('make').value = j.make || ''; $('model').value = j.model || ''; $('trim').value = j.trim || ''; help.textContent = `Found: ${j.year} ${j.make} ${j.model} ${j.trim}`.trim(); help.style.color = 'var(--green)'; }
    catch (e) { help.textContent = e.message; help.style.color = 'var(--rust)'; }
  });
  f.querySelectorAll('.slot input').forEach((inp, i) => inp.addEventListener('change', async () => { const file = inp.files[0]; if (!file) return; try { photos[i] = await MC.resizeImage(file, 1400, 0.8); const s = inp.closest('.slot'); const img = s.querySelector('img') || s.appendChild(document.createElement('img')); img.src = photos[i]; } catch (e) { MC.toast(e.message); } }));
  MC.form(f, '/api/trade-in', () => ({ vin: $('vin').value.trim(), year: $('year').value, make: $('make').value, model: $('model').value, trim: $('trim').value, mileage: MC.digits($('mileage').value), condition: cond, notes: $('notes').value, first_name: $('first_name').value, last_name: $('last_name').value, phone: MC.digits($('phone').value), photos: photos.filter(Boolean) }),
    () => { document.getElementById('t-name').textContent = $('first_name').value.trim(); document.getElementById('t-veh').textContent = [$('year').value, $('make').value, $('model').value].filter(Boolean).join(' ') || 'vehicle'; document.getElementById('t-form').classList.remove('on'); document.getElementById('t-done').classList.add('on'); window.scrollTo(0, 0); });
})();
