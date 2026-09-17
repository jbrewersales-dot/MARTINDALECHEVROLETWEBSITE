'use strict';
const { q, settings } = require('./db');

// ---- money & payments ----
function financeDefaults() {
  return { apr: Number(settings.get('apr', 13.9)), down: Number(settings.get('down', 2000)), term: Number(settings.get('term', 72)) };
}
function monthlyPayment(price, { apr, down, term } = financeDefaults(), tradeValue = 0) {
  const principal = Math.max(0, Number(price || 0) - Number(down || 0) - Number(tradeValue || 0));
  if (principal === 0) return 0;
  const r = Number(apr) / 100 / 12;
  if (r === 0) return Math.round(principal / term);
  return Math.round(principal * r / (1 - Math.pow(1 + r, -term)));
}
const money = n => '$' + Math.round(Number(n || 0)).toLocaleString('en-US');
const miles = n => { n = Number(n || 0); return n >= 1000 ? Math.round(n / 1000) + 'k mi' : n + ' mi'; };
const num = n => Number(String(n ?? '').replace(/[^0-9.-]/g, '')) || 0;

// ---- vehicles ----
function vehicleRow(v, fin = financeDefaults()) {
  const photos = safeJson(v.photos, []);
  return {
    ...v, photos,
    title: `${v.year} ${v.make} ${v.model}${v.trim ? ' ' + v.trim : ''}`.trim(),
    shortTitle: `${v.year} ${v.model}${v.trim ? ' ' + v.trim : ''}`.trim(),
    payment: monthlyPayment(v.price, fin),
    photo: photos[0] || null,
    videoLabel: v.video_duration ? fmtDuration(v.video_duration) + ' walkaround' : null,
  };
}
function liveVehicles() { return q.all("SELECT * FROM vehicles WHERE status='live' ORDER BY featured DESC, created_at DESC").map(v => vehicleRow(v)); }
function fmtDuration(s) { s = Number(s || 0); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function safeJson(s, fb) { try { return JSON.parse(s); } catch { return fb; } }

// ---- phone / validation ----
const digits = s => String(s || '').replace(/\D/g, '');
function fmtPhone(s) { const d = digits(s).replace(/^1(?=\d{10}$)/, ''); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : s || ''; }
function validPhone(s) { const d = digits(s).replace(/^1(?=\d{10}$)/, ''); return d.length === 10; }
function validSSN(s) {
  const d = digits(s); if (d.length !== 9) return false;
  const a = d.slice(0, 3), g = d.slice(3, 5), sn = d.slice(5);
  if (a === '000' || a === '666' || a >= '900' || g === '00' || sn === '0000') return false;
  if (d === '123456789' || /^(\d)\1{8}$/.test(d)) return false;
  return true;
}
function ageFromDob(iso) { const d = new Date(iso); if (isNaN(d)) return null; const n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; }

// ---- dates ----
function timeAgo(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso + (iso.endsWith('Z') || iso.includes('+') ? '' : 'Z')).getTime();
  const m = Math.round(ms / 60000); if (m < 1) return 'just now'; if (m < 60) return m + 'm ago';
  const h = Math.round(m / 60); if (h < 24) return h + 'h ago';
  const d = Math.round(h / 24); return d === 1 ? 'yesterday' : d + 'd ago';
}
function fmtTime(iso) { if (!iso) return ''; const d = new Date(iso + (iso.endsWith('Z') ? '' : 'Z')); return d.toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
function fmtClock(iso) { if (!iso) return ''; const d = new Date(iso + (iso.endsWith('Z') ? '' : 'Z')); return d.toLocaleString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', ''); }
function slaDeadline(submittedIso) { return submittedIso ? new Date(new Date(submittedIso + 'Z').getTime() + 60 * 60000).toISOString().replace('T', ' ').slice(0, 19) : null; }

// ---- CSV (RFC 4180-ish) ----
function parseCsv(text) {
  const rows = []; let row = [], field = '', inQ = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}
// Map a vAuto-style export (any column naming) to our vehicle fields.
const COLS = {
  stock: ['stock', 'stock #', 'stock#', 'stocknumber', 'stock number', 'stock_no', 'stockno'],
  vin: ['vin'],
  year: ['year', 'modelyear', 'model year'],
  make: ['make'], model: ['model'], trim: ['trim', 'series', 'trim level'],
  body_type: ['body', 'bodystyle', 'body style', 'body type', 'bodytype', 'type'],
  condition: ['condition', 'new/used', 'newused', 'new used', 'inventory type', 'vehicle type'],
  price: ['price', 'internet price', 'internetprice', 'selling price', 'sellingprice', 'list price', 'listprice', 'asking price'],
  mileage: ['mileage', 'miles', 'odometer'],
  drivetrain: ['drivetrain', 'drive train', 'drive', 'drive type'],
  engine: ['engine', 'engine description'], transmission: ['transmission', 'trans'],
  color: ['exterior color', 'exteriorcolor', 'ext color', 'color', 'colour'],
  description: ['description', 'comments', 'dealer comments', 'notes'],
  photos: ['photos', 'photo urls', 'photourls', 'images', 'image urls', 'imageurls', 'photo url list', 'pictures'],
  vauto_id: ['vauto id', 'vautoid', 'unit id', 'unitid', 'vehicle id', 'id'],
  date_in_stock: ['date in stock', 'dateinstock', 'in stock date', 'stock date', 'age date'],
  certified: ['certified', 'cpo'],
};
function mapCsvHeaders(headers) {
  const norm = h => h.trim().toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ');
  const map = {};
  headers.forEach((h, i) => { const n = norm(h); for (const [field, names] of Object.entries(COLS)) if (map[field] === undefined && names.includes(n)) map[field] = i; });
  return map;
}
function csvRowToVehicle(row, map) {
  const g = f => map[f] !== undefined ? String(row[map[f]] ?? '').trim() : '';
  const cond = /new/i.test(g('condition')) && !/used|pre/i.test(g('condition')) ? 'New' : 'Used';
  const photos = g('photos').split(/[|,;\s]+/).map(s => s.trim()).filter(s => /^https?:\/\//i.test(s));
  return {
    stock: g('stock'), vin: g('vin').toUpperCase(), year: num(g('year')) || null, make: g('make'), model: g('model'), trim: g('trim'),
    body_type: normalizeBody(g('body_type'), g('model')), condition: cond, price: Math.round(num(g('price'))) || null, mileage: Math.round(num(g('mileage'))) || null,
    drivetrain: g('drivetrain'), engine: g('engine'), transmission: g('transmission'), color: g('color'), description: g('description'),
    photos, vauto_id: g('vauto_id'), date_in_stock: g('date_in_stock') || null,
  };
}
function normalizeBody(b, model = '') {
  const s = (b + ' ' + model).toLowerCase();
  if (/truck|pickup|crew|silverado|sierra|f-?150|f-?250|ram|colorado|tacoma|tundra|ranger|frontier|titan/.test(s)) return 'Truck';
  if (/van|express|transit|sienna|odyssey|pacifica|caravan/.test(s)) return 'Van';
  if (/suv|sport utility|equinox|trax|tahoe|traverse|blazer|suburban|trailblazer|explorer|escape|rav4|cr-v|crv|highlander|4runner|rogue|pathfinder|jeep|wrangler|grand cherokee|acadia|terrain|yukon|expedition|edge|bronco|pilot|encore|enclave|envision/.test(s)) return 'SUV';
  if (/sedan|coupe|hatch|malibu|cruze|impala|camry|corolla|accord|civic|altima|sentra|fusion|focus|charger|300|car/.test(s)) return 'Sedan';
  return b ? b[0].toUpperCase() + b.slice(1) : 'Other';
}

// ---- simple DB-backed rate limiter for public POSTs ----
function rateLimit(key, max, windowSec) {
  const now = Math.floor(Date.now() / 1000);
  const r = q.get('SELECT count, window_start FROM rate_limits WHERE key = ?', key);
  if (!r || now - r.window_start > windowSec) { q.run('INSERT INTO rate_limits(key,count,window_start) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=1, window_start=excluded.window_start', key, now); return true; }
  if (r.count >= max) return false;
  q.run('UPDATE rate_limits SET count = count + 1 WHERE key = ?', key); return true;
}

// ---- email alerts (optional) ----
let transport = null;
function mailer() {
  const config = require('./config');
  if (transport !== null) return transport;
  if (!config.SMTP) { transport = false; return false; }
  transport = require('nodemailer').createTransport({ host: config.SMTP.host, port: config.SMTP.port, secure: config.SMTP.port === 465, auth: { user: config.SMTP.user, pass: config.SMTP.pass } });
  return transport;
}
async function notify(subject, text) {
  const config = require('./config');
  const to = settings.get('notify_to', config.NOTIFY_TO);
  const t = mailer();
  if (!t || !to) { console.log(`[notify] ${subject}\n${text}`); return false; }
  try { await t.sendMail({ from: `"Martindale website" <${config.SMTP.user}>`, to, subject, text }); return true; }
  catch (e) { console.error('[notify] email failed:', e.message); return false; }
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = { financeDefaults, monthlyPayment, money, miles, num, vehicleRow, liveVehicles, fmtDuration, safeJson, digits, fmtPhone, validPhone, validSSN, ageFromDob,
  timeAgo, fmtTime, fmtClock, slaDeadline, parseCsv, mapCsvHeaders, csvRowToVehicle, normalizeBody, rateLimit, notify, esc };
