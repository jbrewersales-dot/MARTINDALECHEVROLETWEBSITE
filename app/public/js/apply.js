// Credit application: one question per screen, autosaves to the server, resumes on the same phone.
(function () {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const LABELS = ['', 'About you', 'Home', 'Your ID', 'Work', 'Check & send'];
  const D = { token: localStorage.getItem('mc_app_token') || null, step: 0, housing_type: '', vehicle_stock: APPLY.stock };
  let saveTimer = null, hasSSN = false, hasDob = false;

  async function save(extra = {}) {
    const body = { token: D.token, step: D.step, ...extra };
    try { const j = await MC.post('/api/apply/draft', body); D.token = j.token; localStorage.setItem('mc_app_token', j.token); } catch (e) { /* offline: keep going, retry on next change */ }
  }
  const queueSave = extra => { clearTimeout(saveTimer); saveTimer = setTimeout(() => save(extra), 500); };

  function show(step) {
    D.step = step; $$('.screen').forEach(s => s.classList.toggle('on', Number(s.dataset.step) === step));
    $('#step-lab').textContent = step >= 1 && step <= 5 ? `Step ${step} of 5 · ${LABELS[step]}` : '';
    $$('#progress i').forEach((b, i) => b.classList.toggle('on', i < step));
    $('#progress').classList.toggle('hide', !(step >= 1 && step <= 5));
    $('#back').classList.toggle('hide', !(step >= 1 && step <= 5));
    $('#stuck').classList.toggle('hide', step === 6);
    if (step === 5) summary();
    window.scrollTo(0, 0);
  }
  const val = n => { const el = document.querySelector(`[name=${n}]`); if (!el) return ''; return n === 'ssn' ? (el.dataset.raw || '') : el.value.trim(); };
  const numv = n => Number(MC.digits(val(n)));
  function err(step, msg) { const box = document.querySelector(`.screen[data-step="${step}"] .form-error`); if (box) box.textContent = msg || ''; }

  function validate(step) {
    if (step === 1) {
      if (!val('first_name') || !val('last_name')) return 'We need your first and last name.';
      const dob = val('dob'); if (!dob) return 'Please enter your date of birth.';
      const age = (Date.now() - new Date(dob)) / 3.156e10; if (!(age >= 18 && age < 110)) return 'You need to be 18 or older to apply.';
      if (MC.digits(val('phone')).replace(/^1(?=\d{10}$)/, '').length !== 10) return 'That phone number doesn\'t look right — 10 digits please.';
      const em = val('email'); if (em && !/^\S+@\S+\.\S+$/.test(em)) return 'That email doesn\'t look right.';
    }
    if (step === 2) {
      if (!D.housing_type) return 'Tell us if you rent, own, or live with family.';
      if (!val('address1') || !val('city') || MC.digits(val('zip')).length !== 5) return 'We need your street address, city and 5-digit ZIP.';
      if (!val('months_at_address')) return 'How long have you been at this address?';
    }
    if (step === 3) {
      const s = MC.digits(val('ssn')); if (!s && !hasSSN) return 'We need your Social Security number to run financing.';
      if (s && (s.length !== 9 || /^(\d)\1{8}$/.test(s) || s.startsWith('000') || s.startsWith('666') || s >= '900000000' || s.slice(3, 5) === '00' || s.slice(5) === '0000')) return 'That SSN doesn\'t look right — 9 digits please.';
    }
    if (step === 4) {
      if (!val('employer')) return 'Who do you work for? "Self-employed" or "retired" is fine.';
      if (!numv('monthly_income')) return 'About how much do you make a month before taxes?';
      if (!val('months_at_job')) return 'How long have you been there?';
    }
    return '';
  }
  function fields(step) {
    if (step === 1) return { first_name: val('first_name'), last_name: val('last_name'), dob: val('dob'), phone: MC.digits(val('phone')), email: val('email'), vehicle_stock: D.vehicle_stock };
    if (step === 2) return { housing_type: D.housing_type, housing_payment: numv('housing_payment'), address1: val('address1'), city: val('city'), state: val('state'), zip: MC.digits(val('zip')), months_at_address: Number(val('months_at_address')), prev_address: val('prev_address') };
    if (step === 3) { const s = MC.digits(val('ssn')); return s ? { ssn: s } : {}; }
    if (step === 4) return { employer: val('employer'), job_title: val('job_title'), monthly_income: numv('monthly_income'), months_at_job: Number(val('months_at_job')), other_income: numv('other_income') };
    return {};
  }
  function summary() {
    const rows = [
      ['You', `${val('first_name')} ${val('last_name')} · ${MC.fmtPhone(val('phone'))}`, 1],
      ['Home', `${D.housing_type === 'family' ? 'With family' : D.housing_type[0].toUpperCase() + D.housing_type.slice(1)} · ${MC.money(numv('housing_payment'))}/mo · ${val('address1')}, ${val('city')} ${MC.digits(val('zip'))}`, 2],
      ['ID', `SSN ending ${(MC.digits(val('ssn')) || '••••').slice(-4)}${$('#slot-front').classList.contains('has') ? ' · license photo added' : ''}`, 3],
      ['Work', `${val('employer')}${val('job_title') ? ' · ' + val('job_title') : ''} · ${MC.money(numv('monthly_income'))}/mo${numv('other_income') ? ' + ' + MC.money(numv('other_income')) : ''}`, 4],
    ];
    $('#summary').innerHTML = rows.map(([k, v, s]) => `<div class="r"><span class="k">${k}</span><span class="v">${v.replace(/</g, '&lt;')}</span><a href="#" class="e" data-go="${s}">Edit</a></div>`).join('');
  }

  // navigation
  document.addEventListener('click', async e => {
    const nx = e.target.closest('[data-next]'); const go = e.target.closest('[data-go]');
    if (nx) { const s = D.step; const m = validate(s); err(s, m); if (m) return; if (s >= 1) await save({ ...fields(s), step: s + 1 }); else await save({ step: 1, vehicle_stock: D.vehicle_stock }); show(s + 1); }
    if (go) { e.preventDefault(); show(Number(go.dataset.go)); }
  });
  $('#back').addEventListener('click', () => show(Math.max(0, D.step - 1)));
  $('#housing').addEventListener('click', e => { const b = e.target.closest('[data-val]'); if (!b) return; D.housing_type = b.dataset.val; $$('#housing button').forEach(x => x.classList.toggle('on', x === b)); queueSave({ housing_type: D.housing_type }); });
  document.querySelector('[name=months_at_address]').addEventListener('change', e => $('#prev-wrap').classList.toggle('hide', e.target.value !== '6'));
  $$('.screen input,.screen select').forEach(el => el.addEventListener('change', () => { if (D.step >= 1 && D.step <= 4 && el.name !== 'ssn') queueSave(fields(D.step)); }));
  // SSN masking
  const ssn = document.querySelector('[name=ssn]'); let showSSN = false;
  ssn.addEventListener('input', () => { const d = MC.digits(ssn.value).slice(0, 9); ssn.dataset.raw = d; ssn.value = showSSN ? d.replace(/(\d{3})(\d{0,2})(\d{0,4})/, (m, a, b, c) => [a, b, c].filter(Boolean).join('-')) : d.replace(/\d(?=\d{0,8})/g, (ch, i) => i < d.length - 4 || d.length < 9 ? '•' : ch).replace(/(.{3})(.{0,2})(.{0,4})/, (m, a, b, c) => [a, b, c].filter(Boolean).join('-')); });
  ssn.addEventListener('focus', () => { ssn.value = ssn.dataset.raw || ''; });
  ssn.addEventListener('blur', () => { const d = ssn.dataset.raw || ''; ssn.value = d; ssn.dispatchEvent(new Event('input')); if (d.length === 9) save({ ssn: d }); });
  $('#ssn-eye').addEventListener('click', () => { showSSN = !showSSN; ssn.dispatchEvent(new Event('input')); });
  // license photos
  $$('.idslot input').forEach(inp => inp.addEventListener('change', async () => {
    const f = inp.files[0]; if (!f) return;
    try { const data = await MC.resizeImage(f, 1400, 0.8); const slot = inp.closest('.idslot'); slot.classList.add('has'); const img = slot.querySelector('img') || slot.appendChild(document.createElement('img')); img.src = data; await save({ ['license_' + inp.dataset.side]: data }); MC.toast('Got it.'); }
    catch (e) { MC.toast(e.message); }
  }));
  // submit
  $('#send').addEventListener('click', async () => {
    if (!$('#consent').checked) return err(5, 'Please check the box so we can run your application.');
    $('#send').disabled = true; err(5, '');
    try { const s = MC.digits(ssn.dataset.raw || ''); await save({ ...fields(1), ...fields(2), ...(s ? { ssn: s } : {}), ...fields(4), step: 5 }); const j = await MC.post('/api/apply/submit', { token: D.token, consent: true }); $('#done-name').textContent = j.first_name; localStorage.removeItem('mc_app_token'); show(6); }
    catch (e) { err(5, e.message); }
    $('#send').disabled = false;
  });
  // resume a saved draft on this phone
  (async () => {
    if (!D.token) return show(0);
    try {
      const d = await (await fetch('/api/apply/draft/' + D.token)).json(); if (!d) { localStorage.removeItem('mc_app_token'); D.token = null; return show(0); }
      for (const k of Object.keys(d)) { const el = document.querySelector(`[name=${k}]`); if (el && d[k] != null && d[k] !== '') el.value = el.dataset.money !== undefined ? Number(d[k]).toLocaleString('en-US') : k === 'phone' ? MC.fmtPhone(d[k]) : d[k]; }
      if (d.housing_type) { D.housing_type = d.housing_type; $$('#housing button').forEach(x => x.classList.toggle('on', x.dataset.val === d.housing_type)); }
      if (d.months_at_address === 6) $('#prev-wrap').classList.remove('hide');
      hasSSN = d.has_ssn; hasDob = d.has_dob; if (hasSSN) { ssn.placeholder = 'Saved · ending ' + '••••'; }
      if (d.license_front) $('#slot-front').classList.add('has'); if (d.license_back) $('#slot-back').classList.add('has');
      if (!APPLY.stock && d.vehicle_stock) D.vehicle_stock = d.vehicle_stock;
      if (d.step >= 1) MC.toast('Welcome back — we saved your spot.');
      show(Math.min(5, d.step || 0));
    } catch { show(0); }
  })();
})();
