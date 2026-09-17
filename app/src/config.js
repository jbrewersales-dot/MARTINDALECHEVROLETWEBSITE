'use strict';
const path = require('path');
const fs = require('fs');

const env = process.env;
const DATA_DIR = path.resolve(env.DATA_DIR || path.join(__dirname, '..', 'data'));
fs.mkdirSync(path.join(DATA_DIR, 'uploads', 'private'), { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'uploads', 'vehicles'), { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'backups'), { recursive: true });

module.exports = {
  PORT: Number(env.PORT || 3000),
  DATA_DIR,
  DB_PATH: path.join(DATA_DIR, 'martindale.db'),
  SESSION_SECRET: env.SESSION_SECRET || 'dev-only-session-secret',
  APP_ENCRYPTION_KEY: env.APP_ENCRYPTION_KEY || '0'.repeat(64),
  ADMIN_EMAIL: env.ADMIN_EMAIL || 'admin@example.com',
  ADMIN_PASSWORD: env.ADMIN_PASSWORD || '',
  ADMIN_NAME: env.ADMIN_NAME || 'Admin',
  NOTIFY_TO: env.NOTIFY_TO || '',
  SMTP: env.SMTP_HOST ? { host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 587), user: env.SMTP_USER, pass: env.SMTP_PASS } : null,
  SITE_URL: env.SITE_URL || 'http://localhost:3000',
  IS_PROD: env.NODE_ENV === 'production',
  // Dealership facts (used in copy everywhere)
  DEALER: {
    name: 'Martindale Chevrolet',
    address1: '521 US Highway 61',
    city: 'New Madrid', state: 'MO', zip: '63869',
    salesPhone: '573-748-2512', salesTel: '+15737482512',
    servicePhone: '573-748-2241', serviceTel: '+15737482241',
    textPhone: '573-620-5630', textTel: '+15736205630',
    email: 'jbrewersales@gmail.com',
    hours: 'Mon–Fri 8–5 · Sat by appointment · Sun closed',
    financeName: 'Tina', salesName: 'Bo', serviceName: 'Marcus',
  },
  // Payment estimate defaults (spec: 13.9% APR, $2,000 down, 72 mo)
  FINANCE: { apr: 13.9, down: 2000, term: 72 },
  PORTAL_IDLE_MINUTES: 15,
};
