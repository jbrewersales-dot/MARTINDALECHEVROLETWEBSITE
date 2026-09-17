'use strict';
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const config = require('./config');

const db = new DatabaseSync(config.DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff', phone TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), last_login_at TEXT
);
CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY, stock TEXT NOT NULL UNIQUE, vin TEXT, year INTEGER, make TEXT, model TEXT, trim TEXT,
  body_type TEXT, condition TEXT NOT NULL DEFAULT 'Used', price INTEGER, mileage INTEGER,
  drivetrain TEXT, engine TEXT, transmission TEXT, color TEXT, description TEXT,
  photos TEXT NOT NULL DEFAULT '[]', video_url TEXT, video_duration INTEGER, video_by TEXT,
  staff_note TEXT, featured INTEGER NOT NULL DEFAULT 0, local_trade INTEGER NOT NULL DEFAULT 0, carfax_clean INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'live', source TEXT NOT NULL DEFAULT 'manual', vauto_id TEXT,
  date_in_stock TEXT, last_seen_in_feed TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS credit_apps (
  id INTEGER PRIMARY KEY, token TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'draft', step INTEGER NOT NULL DEFAULT 0,
  first_name TEXT, last_name TEXT, phone TEXT, email TEXT, dob_enc TEXT,
  housing_type TEXT, housing_payment INTEGER, address1 TEXT, city TEXT, state TEXT, zip TEXT, months_at_address INTEGER, prev_address TEXT,
  ssn_enc TEXT, ssn_last4 TEXT, license_front TEXT, license_back TEXT,
  employer TEXT, job_title TEXT, monthly_income INTEGER, other_income INTEGER, months_at_job INTEGER,
  vehicle_stock TEXT, consent_at TEXT, consent_ip TEXT,
  assigned_to INTEGER REFERENCES users(id), submitted_at TEXT, first_response_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY, app_id INTEGER NOT NULL REFERENCES credit_apps(id) ON DELETE CASCADE,
  type TEXT NOT NULL, note TEXT, by_user INTEGER REFERENCES users(id), at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS trade_ins (
  id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT, phone TEXT, vin TEXT, year INTEGER, make TEXT, model TEXT, trim TEXT,
  mileage INTEGER, condition TEXT, photos TEXT NOT NULL DEFAULT '[]', notes TEXT,
  offer_low INTEGER, offer_high INTEGER, status TEXT NOT NULL DEFAULT 'new', staff_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY, type TEXT NOT NULL, name TEXT, phone TEXT, email TEXT, vehicle_stock TEXT, message TEXT, preferred_date TEXT,
  status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS feed_runs (
  id INTEGER PRIMARY KEY, started_at TEXT NOT NULL DEFAULT (datetime('now')), file_name TEXT, rows_read INTEGER, added INTEGER, updated INTEGER,
  removed INTEGER, errors TEXT NOT NULL DEFAULT '[]', by_user INTEGER REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS price_changes (
  id INTEGER PRIMARY KEY, vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE, old_price INTEGER, new_price INTEGER,
  at TEXT NOT NULL DEFAULT (datetime('now')), source TEXT
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY, user_id INTEGER, action TEXT NOT NULL, target TEXT, at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, window_start INTEGER NOT NULL);
`);

// ---- tiny helpers ----
const q = {
  get: (sql, ...p) => db.prepare(sql).get(...p),
  all: (sql, ...p) => db.prepare(sql).all(...p),
  run: (sql, ...p) => db.prepare(sql).run(...p),
};

const settings = {
  get(key, fallback) { const r = q.get('SELECT value FROM settings WHERE key = ?', key); return r ? r.value : fallback; },
  set(key, value) { q.run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, String(value)); },
};

function audit(userId, action, target) { q.run('INSERT INTO audit(user_id, action, target) VALUES (?,?,?)', userId ?? null, action, target ?? null); }

// ---- first-run seeding ----
function seed() {
  const users = q.get('SELECT COUNT(*) AS n FROM users').n;
  if (users === 0) {
    const pw = config.ADMIN_PASSWORD || require('crypto').randomBytes(9).toString('base64url');
    q.run('INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,?)', config.ADMIN_NAME, config.ADMIN_EMAIL.toLowerCase(), bcrypt.hashSync(pw, 10), 'admin');
    if (!config.ADMIN_PASSWORD) {
      const f = path.join(config.DATA_DIR, 'FIRST-LOGIN.txt');
      fs.writeFileSync(f, `Staff portal first login\nEmail: ${config.ADMIN_EMAIL}\nPassword: ${pw}\nChange it under Portal > Settings, then delete this file.\n`, { mode: 0o600 });
      console.log(`Created first staff user ${config.ADMIN_EMAIL}. Password saved to ${f}`);
    } else {
      console.log(`Created first staff user ${config.ADMIN_EMAIL}`);
    }
  }
  const vehicles = q.get('SELECT COUNT(*) AS n FROM vehicles').n;
  const seedFile = path.join(__dirname, '..', 'data', 'seed-vehicles.json');
  if (vehicles === 0 && fs.existsSync(seedFile)) {
    const rows = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
    const ins = db.prepare(`INSERT INTO vehicles(stock,year,make,model,trim,body_type,condition,price,mileage,photos,status,source,date_in_stock)
      VALUES (?,?,?,?,?,?,?,?,?,?,'live','manual',date('now'))`);
    for (const v of rows) ins.run(v.stock, v.year, v.make, v.model, v.trim || '', v.type || 'Other', v.condition || 'Used', v.price, v.miles, JSON.stringify(v.image ? [v.image] : []));
    console.log(`Seeded ${rows.length} sample vehicles (edit or delete them in the portal).`);
  }
  if (!settings.get('apr')) { settings.set('apr', config.FINANCE.apr); settings.set('down', config.FINANCE.down); settings.set('term', config.FINANCE.term); }
  if (!settings.get('notify_to')) settings.set('notify_to', config.NOTIFY_TO);
}
seed();

// Nightly backup copy of the database (kept 14 days)
function backup() {
  try {
    const stamp = new Date().toISOString().slice(0, 10);
    const dest = path.join(config.DATA_DIR, 'backups', `martindale-${stamp}.db`);
    if (!fs.existsSync(dest)) db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
    for (const f of fs.readdirSync(path.join(config.DATA_DIR, 'backups'))) {
      const full = path.join(config.DATA_DIR, 'backups', f);
      if (Date.now() - fs.statSync(full).mtimeMs > 14 * 864e5) fs.unlinkSync(full);
    }
  } catch (e) { console.error('backup failed', e.message); }
}
backup();
setInterval(backup, 6 * 3600 * 1000).unref();

module.exports = { db, q, settings, audit };
