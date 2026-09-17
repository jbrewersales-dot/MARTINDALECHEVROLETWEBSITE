'use strict';
// Reset a staff user's password from the server:  node scripts/reset-password.js email@example.com "new password"
require('../src/env');
const bcrypt = require('bcryptjs');
const { q } = require('../src/db');
const [email, pw] = process.argv.slice(2);
if (!email || !pw || pw.length < 10) { console.log('Usage: node scripts/reset-password.js <email> <new password, 10+ characters>'); process.exit(1); }
const user = q.get('SELECT id FROM users WHERE email = ?', email.toLowerCase());
if (!user) { console.log('No user with that email. Users: ' + q.all('SELECT email FROM users').map(u => u.email).join(', ')); process.exit(1); }
q.run('UPDATE users SET password_hash = ? WHERE id = ?', bcrypt.hashSync(pw, 10), user.id);
console.log('Password updated for ' + email);
