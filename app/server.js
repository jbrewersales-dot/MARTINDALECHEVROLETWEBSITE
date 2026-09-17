'use strict';
require('./src/env');
const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const config = require('./src/config');
const util = require('./src/util');

const app = express();
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.disable('x-powered-by');

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: false, limit: '40mb', parameterLimit: 5000 }));
app.use(cookieSession({
  name: 'mc_session', keys: [config.SESSION_SECRET], httpOnly: true, sameSite: 'lax',
  maxAge: 12 * 3600 * 1000,
}));

// Security headers (nginx adds more in production)
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (req.path.startsWith('/portal') || req.path.startsWith('/apply')) res.set('Cache-Control', 'no-store');
  next();
});

// Things every template can use
app.use((req, res, next) => {
  res.locals.DEALER = config.DEALER;
  res.locals.u = util;
  res.locals.path = req.path;
  res.locals.user = req.session && req.session.user || null;
  next();
});

app.use('/public', express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));
app.use('/uploads/vehicles', express.static(path.join(config.DATA_DIR, 'uploads', 'vehicles'), { maxAge: '7d' }));
app.get('/favicon.ico', (req, res) => res.redirect('/public/images/favicon.png'));

app.use('/', require('./src/routes/site'));
app.use('/api', require('./src/routes/api'));
app.use('/portal', require('./src/routes/portal'));

app.use((req, res) => res.status(404).render('site/error', { title: 'Page not found', message: "That page isn't here. Try the menu." }));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  if (req.path.startsWith('/api')) return res.status(err.status || 500).json({ error: err.message || 'Server error' });
  res.status(err.status || 500).render('site/error', { title: 'Something went wrong', message: err.expose ? err.message : 'Please try again, or call us.' });
});

app.listen(config.PORT, '127.0.0.1', () => console.log(`Martindale site listening on http://127.0.0.1:${config.PORT}`));
