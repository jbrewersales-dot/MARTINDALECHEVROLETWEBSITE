'use strict';
// Field-level encryption for SSN and date of birth: AES-256-GCM with a key from the environment.
// Stored format: base64(iv) . base64(tag) . base64(ciphertext)
const crypto = require('crypto');
const config = require('./config');

const KEY = Buffer.from(config.APP_ENCRYPTION_KEY, 'hex');
if (KEY.length !== 32) throw new Error('APP_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');

function encrypt(plain) {
  if (plain === null || plain === undefined || plain === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map(b => b.toString('base64')).join('.');
}

function decrypt(stored) {
  if (!stored) return null;
  const [iv, tag, enc] = stored.split('.').map(s => Buffer.from(s, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

const token = (bytes = 24) => crypto.randomBytes(bytes).toString('base64url');

module.exports = { encrypt, decrypt, token };
