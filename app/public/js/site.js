// Shared site behavior: menu, helpers, image resizing, toasts.
(function () {
  const burger = document.getElementById('burger'), nav = document.getElementById('nav');
  if (burger && nav) burger.addEventListener('click', () => { const open = nav.classList.toggle('open'); burger.setAttribute('aria-expanded', open); document.body.style.overflow = open ? 'hidden' : ''; });

  window.MC = {
    money: n => '$' + Math.round(Number(n || 0)).toLocaleString('en-US'),
    digits: s => String(s || '').replace(/\D/g, ''),
    fmtPhone(s) { const d = MC.digits(s).replace(/^1(?=\d{10}$)/, ''); return d.length === 10 ? '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6) : s; },
    toast(msg, ms = 3200) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), ms); },
    async post(url, body) {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Something went wrong. Please try again.');
      return j;
    },
    // Shrink a photo in the browser before upload (max 1600px, JPEG). Returns a data URL.
    resizeImage(file, max = 1600, quality = 0.82) {
      return new Promise((resolve, reject) => {
        const img = new Image(); const url = URL.createObjectURL(file);
        img.onload = () => {
          const s = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
          resolve(c.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not a photo we can read.')); };
        img.src = url;
      });
    },
    // Attach a form: shows errors inline, posts JSON, calls onDone
    form(formEl, url, build, onDone) {
      formEl.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = formEl.querySelector('[type=submit]'); const errBox = formEl.querySelector('.form-error');
        btn.disabled = true; if (errBox) errBox.textContent = '';
        try { const j = await MC.post(url, build()); onDone(j); }
        catch (err) { if (errBox) errBox.textContent = err.message; else MC.toast(err.message); }
        btn.disabled = false;
      });
    },
    fmtPhoneInput(el) { el.addEventListener('blur', () => { if (MC.digits(el.value).length >= 10) el.value = MC.fmtPhone(el.value); }); },
    fmtMoneyInput(el) { el.addEventListener('blur', () => { const d = MC.digits(el.value); el.value = d ? Number(d).toLocaleString('en-US') : ''; }); el.addEventListener('focus', () => { el.value = MC.digits(el.value); }); },
    parseQuery(qs) { // "under $300/mo", "under 20k", "silverado" -> filters
      const f = {}; let s = (qs || '').toLowerCase();
      let m = s.match(/under\s*\$?\s*([\d,]+)\s*(\/\s*mo|a month|month|mo)/); if (m) { f.maxPayment = Number(m[1].replace(/,/g, '')); s = s.replace(m[0], ''); }
      m = s.match(/under\s*\$?\s*([\d,.]+)\s*k?/); if (m && !f.maxPayment) { let n = Number(m[1].replace(/,/g, '')); if (/k/.test(m[0]) || n < 1000) n *= 1000; f.maxPrice = n; s = s.replace(m[0], ''); }
      if (/\btrucks?\b/.test(s)) { f.body = 'Truck'; s = s.replace(/\btrucks?\b/, ''); }
      if (/\bsuvs?\b/.test(s)) { f.body = 'SUV'; s = s.replace(/\bsuvs?\b/, ''); }
      if (/\b(sedans?|cars?)\b/.test(s)) { f.body = 'Sedan'; s = s.replace(/\b(sedans?|cars?)\b/, ''); }
      if (/\bvans?\b/.test(s)) { f.body = 'Van'; s = s.replace(/\bvans?\b/, ''); }
      f.q = s.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
      return f;
    },
  };
  document.querySelectorAll('input[type=tel]').forEach(MC.fmtPhoneInput);
  document.querySelectorAll('input[data-money]').forEach(MC.fmtMoneyInput);
})();
