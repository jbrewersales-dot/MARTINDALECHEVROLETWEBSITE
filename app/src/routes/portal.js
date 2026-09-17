'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { q, db, settings, audit } = require('../db');
const u = require('../util');
const { decrypt } = require('../crypto');
const config = require('../config');
const r = express.Router();

const PRIVATE = path.join(config.DATA_DIR, 'uploads', 'private');
const VEH_DIR = path.join(config.DATA_DIR, 'uploads', 'vehicles');
const APP_STATUSES = { new: 'New', in_review: 'In review', docs_needed: 'Docs needed', sent_to_lender: 'Sent to lender', approved: 'Approved', turned_down: 'Turned down' };
const PILL = { new: 'gold', in_review: 'ink', docs_needed: 'rust', sent_to_lender: 'blue', approved: 'green', turned_down: 'muted' };

// ---------- auth ----------
function requireLogin(req, res, next) {
  const s = req.session;
  if (!s.user) return res.redirect('/portal/login?next=' + encodeURIComponent(req.originalUrl));
  if (Date.now() - (s.last || 0) > config.PORTAL_IDLE_MINUTES * 60000) { req.session = null; return res.redirect('/portal/login?timeout=1'); }
  s.last = Date.now();
  // same-origin check for state-changing requests (CSRF)
  if (req.method === 'POST') {
    const origin = req.get('origin') || req.get('referer') || '';
    if (origin && !origin.startsWith(`${req.protocol}://${req.get('host')}`) && !origin.startsWith(`https://${req.get('host')}`)) return res.status(403).send('Blocked cross-site request');
  }
  next();
}
const requireAdmin = (req, res, next) => req.session.user.role === 'admin' ? next() : res.status(403).render('portal/error', { title: 'Admins only', message: 'Ask an admin to make this change.' });

r.get('/login', (req, res) => { if (req.session.user) return res.redirect('/portal/apps'); res.render('portal/login', { error: null, timeout: !!req.query.timeout, next: req.query.next || '' }); });
r.post('/login', (req, res) => {
  if (!u.rateLimit('login:' + req.ip, 8, 900)) return res.status(429).render('portal/login', { error: 'Too many tries. Wait 15 minutes.', timeout: false, next: '' });
  const user = q.get('SELECT * FROM users WHERE email = ?', String(req.body.email || '').trim().toLowerCase());
  if (!user || !bcrypt.compareSync(String(req.body.password || ''), user.password_hash)) return res.status(401).render('portal/login', { error: "That email and password don't match.", timeout: false, next: req.body.next || '' });
  req.session.user = { id: user.id, name: user.name, role: user.role, email: user.email }; req.session.last = Date.now();
  q.run("UPDATE users SET last_login_at = datetime('now') WHERE id = ?", user.id); audit(user.id, 'login');
  const next = String(req.body.next || ''); res.redirect(next.startsWith('/portal') ? next : '/portal/apps');
});
r.post('/logout', (req, res) => { req.session = null; res.redirect('/portal/login'); });

r.use(requireLogin);
r.use((req, res, next) => {
  res.locals.counts = {
    apps: q.get("SELECT COUNT(*) n FROM credit_apps WHERE status = 'new'").n,
    trades: q.get("SELECT COUNT(*) n FROM trade_ins WHERE status = 'new'").n,
    leads: q.get("SELECT COUNT(*) n FROM leads WHERE status = 'new'").n,
  };
  res.locals.APP_STATUSES = APP_STATUSES; res.locals.PILL = PILL; res.locals.flash = req.session.flash || null; delete req.session.flash;
  next();
});
const flash = (req, msg) => { req.session.flash = msg; };
r.get('/', (req, res) => res.redirect('/portal/apps'));

// ---------- credit applications ----------
function appRow(a) {
  const income = (a.monthly_income || 0) + (a.other_income || 0);
  const veh = a.vehicle_stock ? q.get('SELECT * FROM vehicles WHERE stock = ?', a.vehicle_stock) : null;
  const v = veh ? u.vehicleRow(veh) : null;
  const pti = v && income ? Math.round(v.payment / income * 1000) / 10 : null;
  const sla = a.submitted_at ? new Date(new Date(a.submitted_at + 'Z').getTime() + 3600000) : null;
  return { ...a, income, vehicle: v, pti, ptiLabel: pti == null ? null : pti < 10 ? `${pti}% — comfortable` : pti <= 15 ? `${pti}% — watch` : `${pti}% — high`,
    ptiClass: pti == null ? '' : pti < 10 ? 'green' : pti <= 15 ? '' : 'rust',
    slaAt: sla, slaLate: sla && a.status === 'new' && !a.first_response_at && Date.now() > sla.getTime(), slaLabel: sla ? sla.toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', '') : '',
    assignee: a.assigned_to ? q.get('SELECT name FROM users WHERE id = ?', a.assigned_to) : null };
}
r.get('/apps', (req, res) => {
  const { status = '', q: term = '' } = req.query;
  let sql = "SELECT * FROM credit_apps WHERE status != 'draft'"; const p = [];
  if (status && APP_STATUSES[status]) { sql += ' AND status = ?'; p.push(status); }
  if (term) { sql += " AND (first_name || ' ' || last_name LIKE ? OR phone LIKE ? OR email LIKE ?)"; const t = `%${term}%`; p.push(t, `%${u.digits(term) || term}%`, t); }
  sql += ' ORDER BY CASE status WHEN \'new\' THEN 0 WHEN \'docs_needed\' THEN 1 WHEN \'in_review\' THEN 2 WHEN \'sent_to_lender\' THEN 3 ELSE 4 END, submitted_at DESC LIMIT 300';
  const apps = q.all(sql, ...p).map(appRow);
  const kpi = {
    today: q.get("SELECT COUNT(*) n FROM credit_apps WHERE status != 'draft' AND date(submitted_at) = date('now')").n,
    docs: q.get("SELECT COUNT(*) n FROM credit_apps WHERE status = 'docs_needed'").n,
    approvedWeek: q.get("SELECT COUNT(*) n FROM credit_apps WHERE status = 'approved' AND updated_at >= datetime('now','-7 days')").n,
    median: medianResponse(),
    drafts: q.get("SELECT COUNT(*) n FROM credit_apps WHERE status = 'draft' AND step >= 1 AND updated_at >= datetime('now','-14 days')").n,
  };
  res.render('portal/apps', { title: 'Credit applications', apps, kpi, status, term });
});
function medianResponse() {
  const rows = q.all("SELECT (julianday(first_response_at) - julianday(submitted_at)) * 1440 AS m FROM credit_apps WHERE first_response_at IS NOT NULL AND submitted_at >= datetime('now','-30 days') ORDER BY m");
  if (!rows.length) return null; const m = rows[Math.floor(rows.length / 2)].m; return Math.round(m);
}
r.get('/apps.csv', (req, res) => {
  const rows = q.all("SELECT * FROM credit_apps WHERE status != 'draft' ORDER BY submitted_at DESC");
  const cols = ['id', 'status', 'submitted_at', 'first_name', 'last_name', 'phone', 'email', 'address1', 'city', 'state', 'zip', 'housing_type', 'housing_payment', 'employer', 'job_title', 'monthly_income', 'other_income', 'months_at_job', 'vehicle_stock', 'ssn_last4'];
  const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  audit(req.session.user.id, 'export_csv', `${rows.length} rows`);
  res.set('Content-Type', 'text/csv').set('Content-Disposition', 'attachment; filename="credit-applications.csv"').send([cols.join(','), ...rows.map(a => cols.map(c => esc(a[c])).join(','))].join('\n'));
});
r.get('/apps/:id', (req, res, next) => {
  const a = q.get("SELECT * FROM credit_apps WHERE id = ? AND status != 'draft'", req.params.id); if (!a) return next();
  const app = appRow(a);
  const activity = q.all('SELECT a.*, us.name AS by_name FROM activity a LEFT JOIN users us ON us.id = a.by_user WHERE app_id = ? ORDER BY at DESC', a.id);
  const users = q.all('SELECT id, name FROM users ORDER BY name');
  let dob = null; try { dob = decrypt(a.dob_enc); } catch { dob = null; }
  audit(req.session.user.id, 'view_app', a.id);
  res.render('portal/app', { title: `${a.first_name} ${a.last_name}`, app, activity, users, dob, age: dob ? u.ageFromDob(dob) : null });
});
r.post('/apps/:id/status', (req, res) => {
  const a = q.get('SELECT * FROM credit_apps WHERE id = ?', req.params.id); if (!a) return res.redirect('/portal/apps');
  const st = req.body.status; if (!APP_STATUSES[st]) return res.redirect('/portal/apps/' + a.id);
  q.run("UPDATE credit_apps SET status = ?, updated_at = datetime('now'), first_response_at = COALESCE(first_response_at, datetime('now')) WHERE id = ?", st, a.id);
  q.run("INSERT INTO activity(app_id, type, note, by_user) VALUES (?, 'status_change', ?, ?)", a.id, `Status set to ${APP_STATUSES[st]}`, req.session.user.id);
  res.redirect('/portal/apps/' + a.id);
});
r.post('/apps/:id/note', (req, res) => {
  const a = q.get('SELECT id FROM credit_apps WHERE id = ?', req.params.id); if (!a) return res.redirect('/portal/apps');
  const type = ['note', 'call', 'text'].includes(req.body.type) ? req.body.type : 'note'; const note = String(req.body.note || '').trim().slice(0, 2000);
  if (note || type !== 'note') { q.run('INSERT INTO activity(app_id, type, note, by_user) VALUES (?,?,?,?)', a.id, type, note || (type === 'call' ? 'Called' : 'Texted'), req.session.user.id); q.run("UPDATE credit_apps SET first_response_at = COALESCE(first_response_at, datetime('now')), updated_at = datetime('now') WHERE id = ?", a.id); }
  res.redirect('/portal/apps/' + a.id);
});
r.post('/apps/:id/assign', (req, res) => {
  const uid = Number(req.body.assigned_to) || null;
  q.run("UPDATE credit_apps SET assigned_to = ?, updated_at = datetime('now') WHERE id = ?", uid, req.params.id);
  const who = uid ? q.get('SELECT name FROM users WHERE id = ?', uid) : null;
  q.run("INSERT INTO activity(app_id, type, note, by_user) VALUES (?, 'note', ?, ?)", req.params.id, `Assigned to ${who ? who.name : 'nobody'}`, req.session.user.id);
  res.redirect('/portal/apps/' + req.params.id);
});
r.post('/apps/:id/reveal-ssn', (req, res) => {
  if (!['admin', 'finance'].includes(req.session.user.role)) return res.status(403).json({ error: 'Finance or admin only' });
  const a = q.get('SELECT ssn_enc FROM credit_apps WHERE id = ?', req.params.id); if (!a || !a.ssn_enc) return res.status(404).json({ error: 'No SSN on file' });
  audit(req.session.user.id, 'reveal_ssn', req.params.id);
  q.run("INSERT INTO activity(app_id, type, note, by_user) VALUES (?, 'note', 'Viewed full SSN', ?)", req.params.id, req.session.user.id);
  const d = decrypt(a.ssn_enc); res.json({ ssn: `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` });
});
r.get('/apps/:id/license/:side', (req, res, next) => {
  const a = q.get('SELECT license_front, license_back FROM credit_apps WHERE id = ?', req.params.id); if (!a) return next();
  const f = req.params.side === 'front' ? a.license_front : a.license_back; if (!f) return next();
  audit(req.session.user.id, 'view_license', `${req.params.id}/${req.params.side}`);
  res.set('Cache-Control', 'no-store').sendFile(path.join(PRIVATE, path.basename(f)));
});
r.post('/apps/:id/delete', requireAdmin, (req, res) => {
  const a = q.get('SELECT * FROM credit_apps WHERE id = ?', req.params.id);
  if (a) { for (const f of [a.license_front, a.license_back]) if (f) fs.rmSync(path.join(PRIVATE, path.basename(f)), { force: true }); q.run('DELETE FROM credit_apps WHERE id = ?', a.id); audit(req.session.user.id, 'delete_app', a.id); }
  flash(req, 'Application deleted.'); res.redirect('/portal/apps');
});

// ---------- trade-ins ----------
r.get('/trade-ins', (req, res) => res.render('portal/trade-ins', { title: 'Trade-ins', rows: q.all('SELECT * FROM trade_ins ORDER BY CASE status WHEN \'new\' THEN 0 ELSE 1 END, created_at DESC LIMIT 300') }));
r.get('/trade-ins/:id', (req, res, next) => { const t = q.get('SELECT * FROM trade_ins WHERE id = ?', req.params.id); if (!t) return next(); res.render('portal/trade-in', { title: 'Trade-in', t: { ...t, photos: u.safeJson(t.photos, []) } }); });
r.get('/trade-ins/:id/photo/:i', (req, res, next) => { const t = q.get('SELECT photos FROM trade_ins WHERE id = ?', req.params.id); const p = t && u.safeJson(t.photos, [])[Number(req.params.i)]; if (!p) return next(); res.sendFile(path.join(PRIVATE, path.basename(p))); });
r.post('/trade-ins/:id', (req, res) => {
  const b = req.body; const st = ['new', 'contacted', 'offered', 'closed'].includes(b.status) ? b.status : 'new';
  q.run("UPDATE trade_ins SET status = ?, offer_low = ?, offer_high = ?, staff_note = ?, updated_at = datetime('now') WHERE id = ?", st, u.num(b.offer_low) || null, u.num(b.offer_high) || null, String(b.staff_note || '').slice(0, 2000), req.params.id);
  flash(req, 'Saved.'); res.redirect('/portal/trade-ins/' + req.params.id);
});

// ---------- leads ----------
r.get('/leads', (req, res) => res.render('portal/leads', { title: 'Leads & follow-ups', rows: q.all("SELECT * FROM leads ORDER BY CASE status WHEN 'new' THEN 0 ELSE 1 END, created_at DESC LIMIT 300") }));
r.post('/leads/:id/status', (req, res) => { const st = ['new', 'contacted', 'closed'].includes(req.body.status) ? req.body.status : 'new'; q.run('UPDATE leads SET status = ? WHERE id = ?', st, req.params.id); res.redirect('/portal/leads'); });

// ---------- inventory ----------
r.get('/inventory', (req, res) => {
  const filter = req.query.f || 'all';
  let rows = q.all('SELECT * FROM vehicles ORDER BY CASE status WHEN \'live\' THEN 0 WHEN \'hidden\' THEN 1 ELSE 2 END, created_at DESC').map(v => u.vehicleRow(v));
  if (filter === 'attention') rows = rows.filter(v => v.status !== 'sold' && (!v.photos.length || !v.price)); else if (filter === 'novideo') rows = rows.filter(v => v.status === 'live' && !v.video_url);
  else if (filter === 'under20') rows = rows.filter(v => v.status === 'live' && v.price < 20000); else if (filter === 'sold') rows = rows.filter(v => v.status === 'sold');
  const last = q.get('SELECT * FROM feed_runs ORDER BY started_at DESC LIMIT 1');
  const live = q.get("SELECT COUNT(*) n FROM vehicles WHERE status = 'live'").n;
  res.render('portal/inventory', { title: 'Inventory', rows, filter, last: last ? { ...last, errors: u.safeJson(last.errors, []) } : null, live });
});
r.get('/inventory/new', (req, res) => res.render('portal/vehicle', { title: 'Add a vehicle', v: null }));
r.get('/inventory/feed-log', (req, res) => res.render('portal/feed-log', { title: 'Feed log', runs: q.all('SELECT f.*, us.name by_name FROM feed_runs f LEFT JOIN users us ON us.id = f.by_user ORDER BY started_at DESC LIMIT 100').map(f => ({ ...f, errors: u.safeJson(f.errors, []) })) }));
r.get('/inventory/import', (req, res) => res.render('portal/import', { title: 'Import from vAuto', preview: null, csv: '' }));
r.post('/inventory/import', (req, res) => {
  const csv = String(req.body.csv || ''); const rows = u.parseCsv(csv);
  if (rows.length < 2) return res.render('portal/import', { title: 'Import from vAuto', preview: { error: 'No rows found. Paste the whole CSV, header row included.' }, csv });
  const map = u.mapCsvHeaders(rows[0]);
  if (map.stock === undefined && map.vin === undefined) return res.render('portal/import', { title: 'Import from vAuto', preview: { error: 'Could not find a Stock # or VIN column. Columns seen: ' + rows[0].join(', ') }, csv });
  const items = rows.slice(1).map(rw => u.csvRowToVehicle(rw, map)).filter(v => v.stock || v.vin);
  const plan = items.map(v => { const ex = q.get('SELECT * FROM vehicles WHERE (vin != \'\' AND vin = ?) OR stock = ?', v.vin, v.stock); return { v, action: ex ? (ex.price !== v.price && v.price ? 'price' : 'update') : 'add', ex }; });
  const inFeed = new Set(items.map(i => i.vin || i.stock));
  const missing = q.all("SELECT * FROM vehicles WHERE status != 'sold' AND source = 'vauto'").filter(ex => !inFeed.has(ex.vin) && !inFeed.has(ex.stock));
  if (req.body.confirm === '1') {
    let added = 0, updated = 0, removed = 0; const errors = [];
    const tx = db.prepare('BEGIN'); tx.run();
    try {
      for (const { v, ex } of plan) {
        try {
          if (ex) {
            if (v.price && ex.price !== v.price) q.run('INSERT INTO price_changes(vehicle_id, old_price, new_price, source) VALUES (?,?,?,?)', ex.id, ex.price, v.price, 'vauto');
            const photos = v.photos.length ? JSON.stringify(v.photos) : ex.photos;
            q.run(`UPDATE vehicles SET vin=COALESCE(NULLIF(?,''),vin), year=COALESCE(?,year), make=COALESCE(NULLIF(?,''),make), model=COALESCE(NULLIF(?,''),model), trim=COALESCE(NULLIF(?,''),trim), body_type=COALESCE(NULLIF(?,''),body_type), condition=?, price=COALESCE(?,price), mileage=COALESCE(?,mileage), drivetrain=COALESCE(NULLIF(?,''),drivetrain), engine=COALESCE(NULLIF(?,''),engine), transmission=COALESCE(NULLIF(?,''),transmission), color=COALESCE(NULLIF(?,''),color), description=COALESCE(NULLIF(?,''),description), photos=?, vauto_id=COALESCE(NULLIF(?,''),vauto_id), source='vauto', last_seen_in_feed=datetime('now'), status=CASE WHEN status='sold' THEN 'live' ELSE status END, updated_at=datetime('now') WHERE id=?`,
              v.vin, v.year, v.make, v.model, v.trim, v.body_type, v.condition, v.price, v.mileage, v.drivetrain, v.engine, v.transmission, v.color, v.description, photos, v.vauto_id, ex.id);
            updated++;
          } else {
            q.run(`INSERT INTO vehicles(stock,vin,year,make,model,trim,body_type,condition,price,mileage,drivetrain,engine,transmission,color,description,photos,vauto_id,date_in_stock,source,status,last_seen_in_feed) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'vauto', ?, datetime('now'))`,
              v.stock || v.vin.slice(-8), v.vin, v.year, v.make, v.model, v.trim, v.body_type, v.condition, v.price, v.mileage, v.drivetrain, v.engine, v.transmission, v.color, v.description, JSON.stringify(v.photos), v.vauto_id, v.date_in_stock, v.photos.length && v.price ? 'live' : 'hidden');
            added++;
          }
        } catch (e) { errors.push(`${v.stock || v.vin}: ${e.message}`); }
      }
      if (req.body.mark_sold === '1') for (const ex of missing) { q.run("UPDATE vehicles SET status='sold', updated_at=datetime('now') WHERE id=?", ex.id); removed++; }
      db.prepare('COMMIT').run();
    } catch (e) { db.prepare('ROLLBACK').run(); errors.push(e.message); }
    q.run('INSERT INTO feed_runs(file_name, rows_read, added, updated, removed, errors, by_user) VALUES (?,?,?,?,?,?,?)', req.body.file_name || 'pasted CSV', items.length, added, updated, removed, JSON.stringify(errors), req.session.user.id);
    flash(req, `Import done: ${added} added, ${updated} updated, ${removed} marked sold${errors.length ? ', ' + errors.length + ' errors (see feed log)' : ''}.`);
    return res.redirect('/portal/inventory');
  }
  res.render('portal/import', { title: 'Import from vAuto', preview: { plan, missing, headers: rows[0], mapped: Object.keys(map) }, csv });
});
r.get('/inventory/:id', (req, res, next) => { const v = q.get('SELECT * FROM vehicles WHERE id = ?', req.params.id); if (!v) return next(); res.render('portal/vehicle', { title: 'Edit vehicle', v: u.vehicleRow(v) }); });
r.post('/inventory/:id', (req, res) => {
  const b = req.body; const isNew = req.params.id === 'new';
  const ex = isNew ? null : q.get('SELECT * FROM vehicles WHERE id = ?', req.params.id); if (!isNew && !ex) return res.redirect('/portal/inventory');
  const stock = String(b.stock || '').trim().toUpperCase(); if (!stock) { flash(req, 'Stock # is required.'); return res.redirect(isNew ? '/portal/inventory/new' : '/portal/inventory/' + ex.id); }
  const dup = q.get('SELECT id FROM vehicles WHERE stock = ? AND id != ?', stock, ex ? ex.id : 0); if (dup) { flash(req, `Stock #${stock} is already used.`); return res.redirect(isNew ? '/portal/inventory/new' : '/portal/inventory/' + ex.id); }
  // photos: keep the ones listed (in order), add any new uploads
  let photos = String(b.photos_keep || '').split('\n').map(s => s.trim()).filter(Boolean);
  const uploads = Array.isArray(b.new_photos) ? b.new_photos : (b.new_photos ? [b.new_photos] : []);
  let n = Date.now();
  for (const dataUrl of uploads.slice(0, 30)) { const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/i.exec(dataUrl); if (!m) continue; const name = `${stock}-${n++}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`; fs.writeFileSync(path.join(VEH_DIR, name), Buffer.from(m[2], 'base64')); photos.push('/uploads/vehicles/' + name); }
  const str = k => String(b[k] ?? '').trim().slice(0, 4000);
  const vals = [stock, str('vin').toUpperCase(), u.num(b.year) || null, str('make'), str('model'), str('trim'), str('body_type') || u.normalizeBody('', str('model')), b.condition === 'New' ? 'New' : 'Used', Math.round(u.num(b.price)) || null, Math.round(u.num(b.mileage)) || null,
    str('drivetrain'), str('engine'), str('transmission'), str('color'), str('description'), JSON.stringify(photos), str('video_url'), Math.round(u.num(b.video_duration)) || null, str('video_by'), str('staff_note'), b.featured ? 1 : 0, b.local_trade ? 1 : 0, b.carfax_clean ? 1 : 0, ['live', 'hidden', 'sold'].includes(b.status) ? b.status : 'live'];
  if (ex) {
    if (vals[8] && ex.price !== vals[8]) q.run('INSERT INTO price_changes(vehicle_id, old_price, new_price, source) VALUES (?,?,?,?)', ex.id, ex.price, vals[8], 'manual');
    q.run(`UPDATE vehicles SET stock=?,vin=?,year=?,make=?,model=?,trim=?,body_type=?,condition=?,price=?,mileage=?,drivetrain=?,engine=?,transmission=?,color=?,description=?,photos=?,video_url=?,video_duration=?,video_by=?,staff_note=?,featured=?,local_trade=?,carfax_clean=?,status=?,updated_at=datetime('now') WHERE id=?`, ...vals, ex.id);
    flash(req, 'Saved.'); return res.redirect('/portal/inventory/' + ex.id);
  }
  const info = db.prepare(`INSERT INTO vehicles(stock,vin,year,make,model,trim,body_type,condition,price,mileage,drivetrain,engine,transmission,color,description,photos,video_url,video_duration,video_by,staff_note,featured,local_trade,carfax_clean,status,date_in_stock) VALUES (${'?,'.repeat(23)}?,date('now'))`).run(...vals);
  flash(req, 'Vehicle added.'); res.redirect('/portal/inventory/' + info.lastInsertRowid);
});
r.post('/inventory/:id/delete', (req, res) => { const v = q.get('SELECT * FROM vehicles WHERE id = ?', req.params.id); if (v) { for (const p of u.safeJson(v.photos, [])) if (p.startsWith('/uploads/vehicles/')) fs.rmSync(path.join(VEH_DIR, path.basename(p)), { force: true }); q.run('DELETE FROM vehicles WHERE id = ?', v.id); } flash(req, 'Vehicle deleted.'); res.redirect('/portal/inventory'); });

// ---------- settings ----------
r.get('/settings', (req, res) => res.render('portal/settings', { title: 'Settings', s: { apr: settings.get('apr'), down: settings.get('down'), term: settings.get('term'), notify_to: settings.get('notify_to', '') }, users: q.all('SELECT id, name, email, role, last_login_at FROM users ORDER BY name'), smtp: !!config.SMTP, audit: q.all('SELECT a.*, us.name FROM audit a LEFT JOIN users us ON us.id = a.user_id ORDER BY at DESC LIMIT 40') }));
r.post('/settings', requireAdmin, (req, res) => { settings.set('apr', Number(req.body.apr) || 13.9); settings.set('down', Math.round(u.num(req.body.down))); settings.set('term', [36, 48, 60, 72, 84].includes(Number(req.body.term)) ? Number(req.body.term) : 72); settings.set('notify_to', String(req.body.notify_to || '').trim()); flash(req, 'Settings saved.'); res.redirect('/portal/settings'); });
r.post('/settings/password', (req, res) => {
  const me = q.get('SELECT * FROM users WHERE id = ?', req.session.user.id);
  if (!bcrypt.compareSync(String(req.body.current || ''), me.password_hash)) { flash(req, 'Current password is wrong.'); return res.redirect('/portal/settings'); }
  if (String(req.body.next || '').length < 10) { flash(req, 'New password needs at least 10 characters.'); return res.redirect('/portal/settings'); }
  q.run('UPDATE users SET password_hash = ? WHERE id = ?', bcrypt.hashSync(String(req.body.next), 10), me.id); audit(me.id, 'change_password'); flash(req, 'Password changed.'); res.redirect('/portal/settings');
});
r.post('/settings/users', requireAdmin, (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase(), name = String(req.body.name || '').trim(), pw = String(req.body.password || ''); const role = ['admin', 'finance', 'staff'].includes(req.body.role) ? req.body.role : 'staff';
  if (!email || !name || pw.length < 10) { flash(req, 'Name, email and a password of 10+ characters are required.'); return res.redirect('/portal/settings'); }
  try { q.run('INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,?)', name, email, bcrypt.hashSync(pw, 10), role); audit(req.session.user.id, 'add_user', email); flash(req, `Added ${name}.`); } catch { flash(req, 'That email is already a user.'); }
  res.redirect('/portal/settings');
});
r.post('/settings/users/:id/delete', requireAdmin, (req, res) => { if (Number(req.params.id) !== req.session.user.id) { q.run('DELETE FROM users WHERE id = ?', req.params.id); audit(req.session.user.id, 'delete_user', req.params.id); } res.redirect('/portal/settings'); });

r.use((req, res) => res.status(404).render('portal/error', { title: 'Not found', message: 'Nothing here.' }));
module.exports = r;
