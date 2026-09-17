'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const { q, db } = require('../db');
const u = require('../util');
const { encrypt, token } = require('../crypto');
const config = require('../config');
const r = express.Router();

const ip = req => req.ip || req.socket.remoteAddress || '';
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
function limited(req, res, name, max = 30, windowSec = 600) {
  if (u.rateLimit(`${name}:${ip(req)}`, max, windowSec)) return false;
  bad(res, 'Too many requests. Please wait a few minutes and try again.', 429); return true;
}
// Save a base64 data URL as a file; returns the saved filename or null
function saveDataUrl(dataUrl, dir, base) {
  const m = /^data:(image\/(jpeg|png|webp));base64,(.+)$/i.exec(dataUrl || '');
  if (!m) return null;
  const buf = Buffer.from(m[3], 'base64');
  if (buf.length > 8 * 1024 * 1024) return null;
  const name = `${base}.${m[2] === 'jpeg' ? 'jpg' : m[2]}`;
  fs.writeFileSync(path.join(dir, name), buf);
  return name;
}

// ---------- vehicles (used by inventory filters) ----------
r.get('/vehicles', (req, res) => res.json(u.liveVehicles().map(v => ({
  stock: v.stock, year: v.year, make: v.make, model: v.model, trim: v.trim, body_type: v.body_type, condition: v.condition, price: v.price, mileage: v.mileage,
  payment: v.payment, photo: v.photo, title: v.title, video: !!v.video_url, videoLabel: v.videoLabel, local_trade: !!v.local_trade, carfax_clean: !!v.carfax_clean, created_at: v.created_at,
}))));

r.get('/payment', (req, res) => {
  const fin = u.financeDefaults();
  const price = u.num(req.query.price), down = req.query.down !== undefined ? u.num(req.query.down) : fin.down;
  const term = [36, 48, 60, 72, 84].includes(Number(req.query.term)) ? Number(req.query.term) : fin.term;
  const trade = u.num(req.query.trade);
  res.json({ payment: u.monthlyPayment(price, { apr: fin.apr, down, term }, trade), apr: fin.apr, down, term, trade });
});

// ---------- credit application ----------
const APP_FIELDS = ['first_name', 'last_name', 'phone', 'email', 'housing_type', 'housing_payment', 'address1', 'city', 'state', 'zip', 'months_at_address', 'prev_address',
  'employer', 'job_title', 'monthly_income', 'other_income', 'months_at_job', 'vehicle_stock'];
const INT_FIELDS = new Set(['housing_payment', 'months_at_address', 'monthly_income', 'other_income', 'months_at_job']);

r.post('/apply/draft', (req, res) => {
  if (limited(req, res, 'draft', 300, 600)) return;
  const b = req.body || {};
  let app = b.token ? q.get("SELECT * FROM credit_apps WHERE token = ? AND status = 'draft'", String(b.token)) : null;
  if (!app) {
    const t = token();
    q.run('INSERT INTO credit_apps(token, status, step) VALUES (?, ?, ?)', t, 'draft', 0);
    app = q.get('SELECT * FROM credit_apps WHERE token = ?', t);
  }
  const sets = [], vals = [];
  for (const f of APP_FIELDS) if (b[f] !== undefined) { sets.push(`${f} = ?`); vals.push(INT_FIELDS.has(f) ? Math.round(u.num(b[f])) : String(b[f]).slice(0, 200)); }
  if (b.ssn !== undefined) { const d = u.digits(b.ssn); sets.push('ssn_enc = ?', 'ssn_last4 = ?'); vals.push(d ? encrypt(d) : null, d ? d.slice(-4) : null); }
  if (b.dob !== undefined) { sets.push('dob_enc = ?'); vals.push(b.dob ? encrypt(String(b.dob).slice(0, 10)) : null); }
  for (const side of ['front', 'back']) if (b['license_' + side] !== undefined) {
    const name = b['license_' + side] ? saveDataUrl(b['license_' + side], path.join(config.DATA_DIR, 'uploads', 'private'), `${app.token}-${side}`) : null;
    sets.push(`license_${side} = ?`); vals.push(name);
  }
  if (b.step !== undefined) { sets.push('step = ?'); vals.push(Math.max(0, Math.min(5, Number(b.step) || 0))); }
  sets.push("updated_at = datetime('now')");
  q.run(`UPDATE credit_apps SET ${sets.join(', ')} WHERE id = ?`, ...vals, app.id);
  res.json({ token: app.token, step: app.step });
});

r.get('/apply/draft/:token', (req, res) => {
  const app = q.get("SELECT * FROM credit_apps WHERE token = ? AND status = 'draft'", req.params.token);
  if (!app) return res.json(null);
  const out = { token: app.token, step: app.step, has_ssn: !!app.ssn_enc, has_dob: !!app.dob_enc, license_front: !!app.license_front, license_back: !!app.license_back };
  for (const f of APP_FIELDS) out[f] = app[f];
  res.json(out);
});

r.post('/apply/submit', async (req, res) => {
  if (limited(req, res, 'submit', 10, 3600)) return;
  const b = req.body || {};
  const app = q.get("SELECT * FROM credit_apps WHERE token = ? AND status = 'draft'", String(b.token || ''));
  if (!app) return bad(res, 'We could not find your application. Please start again.');
  const missing = [];
  if (!app.first_name || !app.last_name) missing.push('your name');
  if (!u.validPhone(app.phone)) missing.push('a valid cell phone');
  if (!app.dob_enc) missing.push('date of birth');
  if (!app.housing_type || !app.address1 || !app.city || !app.zip) missing.push('your address');
  if (!app.ssn_enc) missing.push('Social Security number');
  if (!app.employer || !app.monthly_income) missing.push('employer and income');
  if (!b.consent) missing.push('your OK on the consent box');
  if (missing.length) return bad(res, 'Still need: ' + missing.join(', ') + '.');
  const finance = q.get("SELECT id FROM users WHERE role IN ('admin','finance') ORDER BY role='finance' DESC, id LIMIT 1");
  q.run("UPDATE credit_apps SET status='new', step=5, consent_at=datetime('now'), consent_ip=?, submitted_at=datetime('now'), assigned_to=?, updated_at=datetime('now') WHERE id=?",
    ip(req), finance ? finance.id : null, app.id);
  q.run("INSERT INTO activity(app_id, type, note) VALUES (?, 'submitted', ?)", app.id, `Application submitted from the website${app.vehicle_stock ? ' for stock #' + app.vehicle_stock : ''}.`);
  const veh = app.vehicle_stock ? q.get('SELECT year, make, model FROM vehicles WHERE stock = ?', app.vehicle_stock) : null;
  u.notify(`New credit application: ${app.first_name} ${app.last_name}`,
    `${app.first_name} ${app.last_name} just applied for financing on the website.\nPhone: ${u.fmtPhone(app.phone)}\nIncome: ${u.money(app.monthly_income)}/mo at ${app.employer}` +
    (veh ? `\nVehicle: ${veh.year} ${veh.make} ${veh.model} (stock #${app.vehicle_stock})` : '') +
    `\n\nOpen it: ${config.SITE_URL}/portal/apps/${app.id}\nRespond within the hour.`);
  res.json({ ok: true, first_name: app.first_name });
});

// ---------- trade-in ----------
r.post('/trade-in', (req, res) => {
  if (limited(req, res, 'trade', 10, 3600)) return;
  const b = req.body || {};
  if (!b.first_name || !u.validPhone(b.phone)) return bad(res, 'We need your first name and a cell number so Bo can text you.');
  if (!b.vin && !(b.year && b.make && b.model)) return bad(res, 'Tell us the VIN, or the year, make and model.');
  const info = db.prepare(`INSERT INTO trade_ins(first_name,last_name,phone,vin,year,make,model,trim,mileage,condition,notes,photos) VALUES (?,?,?,?,?,?,?,?,?,?,?,'[]')`)
    .run(String(b.first_name).slice(0, 80), String(b.last_name || '').slice(0, 80), u.digits(b.phone), String(b.vin || '').toUpperCase().slice(0, 17), u.num(b.year) || null,
      String(b.make || '').slice(0, 60), String(b.model || '').slice(0, 60), String(b.trim || '').slice(0, 60), Math.round(u.num(b.mileage)) || null,
      ['rough', 'decent', 'sharp'].includes(b.condition) ? b.condition : null, String(b.notes || '').slice(0, 1000));
  const id = Number(info.lastInsertRowid);
  const dir = path.join(config.DATA_DIR, 'uploads', 'private');
  const photos = [];
  for (const [i, p] of (Array.isArray(b.photos) ? b.photos.slice(0, 4) : []).entries()) { const n = saveDataUrl(p, dir, `trade-${id}-${i}`); if (n) photos.push(n); }
  q.run('UPDATE trade_ins SET photos = ? WHERE id = ?', JSON.stringify(photos), id);
  u.notify(`Trade-in request: ${b.year || ''} ${b.make || ''} ${b.model || ''}`.trim(),
    `${b.first_name} ${b.last_name || ''} wants a number on their ${b.year || ''} ${b.make || ''} ${b.model || ''} ${b.trim || ''} (${b.mileage || '?'} mi, ${b.condition || 'condition not given'}).\nPhone: ${u.fmtPhone(b.phone)}\n${photos.length} photo(s)\n\nOpen it: ${config.SITE_URL}/portal/trade-ins/${id}`);
  res.json({ ok: true, id });
});

// VIN decode via the free NHTSA vPIC service (no key needed)
r.get('/vin/:vin', async (req, res) => {
  const vin = String(req.params.vin || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (vin.length !== 17) return bad(res, 'A VIN is 17 letters and numbers.');
  try {
    const resp = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`, { signal: AbortSignal.timeout(8000) });
    const j = await resp.json(); const d = j.Results && j.Results[0] || {};
    if (!d.Make) return bad(res, "Couldn't read that VIN. Type the year, make and model instead.");
    res.json({ year: Number(d.ModelYear) || null, make: cap(d.Make), model: d.Model || '', trim: d.Trim || d.Series || '', body: u.normalizeBody(d.BodyClass || '', d.Model || '') });
  } catch { bad(res, "VIN lookup isn't answering right now. Type the year, make and model instead.", 502); }
});
const cap = s => String(s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).replace(/\bGmc\b/, 'GMC').replace(/\bBmw\b/, 'BMW');

// ---------- leads (contact + service forms) ----------
r.post('/leads', (req, res) => {
  if (limited(req, res, 'lead', 15, 3600)) return;
  const b = req.body || {};
  const type = ['contact', 'service', 'vehicle'].includes(b.type) ? b.type : 'contact';
  if (!b.name || !u.validPhone(b.phone)) return bad(res, 'We need your name and a phone number we can reach you at.');
  const info = db.prepare('INSERT INTO leads(type,name,phone,email,vehicle_stock,message,preferred_date) VALUES (?,?,?,?,?,?,?)')
    .run(type, String(b.name).slice(0, 100), u.digits(b.phone), String(b.email || '').slice(0, 120), String(b.vehicle_stock || '').slice(0, 40), String(b.message || '').slice(0, 2000), String(b.preferred_date || '').slice(0, 40));
  u.notify(`Website ${type} request from ${b.name}`, `${b.name}\nPhone: ${u.fmtPhone(b.phone)}${b.email ? '\nEmail: ' + b.email : ''}${b.vehicle_stock ? '\nStock #: ' + b.vehicle_stock : ''}${b.preferred_date ? '\nPreferred: ' + b.preferred_date : ''}\n\n${b.message || ''}\n\nOpen: ${config.SITE_URL}/portal/leads`);
  res.json({ ok: true, id: Number(info.lastInsertRowid) });
});

module.exports = r;
