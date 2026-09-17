'use strict';
const express = require('express');
const { q } = require('../db');
const u = require('../util');
const config = require('../config');
const r = express.Router();

r.get('/', (req, res) => {
  const vehicles = u.liveVehicles();
  const under20 = vehicles.filter(v => v.price && v.price < 20000).length;
  res.render('site/home', { title: null, vehicles, counts: { total: vehicles.length, under20 } });
});

r.get('/inventory', (req, res) => {
  const vehicles = u.liveVehicles();
  const fin = u.financeDefaults();
  res.render('site/inventory', { title: 'Inventory', vehicles, fin, query: req.query });
});

r.get('/vehicles/:stock', (req, res, next) => {
  const row = q.get('SELECT * FROM vehicles WHERE stock = ? AND status != ?', req.params.stock, 'hidden');
  if (!row) return next();
  const v = u.vehicleRow(row);
  const fin = u.financeDefaults();
  res.render('site/vehicle', { title: v.title, v, fin });
});

r.get('/apply', (req, res) => {
  const stock = req.query.stock || '';
  const vehicle = stock ? q.get("SELECT * FROM vehicles WHERE stock = ? AND status='live'", stock) : null;
  res.render('site/apply', { title: 'Apply for financing', vehicle: vehicle ? u.vehicleRow(vehicle) : null });
});

r.get('/trade-in', (req, res) => res.render('site/trade-in', { title: 'Value my trade' }));
r.get('/service', (req, res) => res.render('site/service', { title: 'Service & parts' }));
r.get('/contact', (req, res) => {
  const stock = req.query.stock || '';
  const vehicle = stock ? q.get('SELECT * FROM vehicles WHERE stock = ?', stock) : null;
  res.render('site/contact', { title: 'Contact', vehicle: vehicle ? u.vehicleRow(vehicle) : null });
});
r.get('/about', (req, res) => res.render('site/about', { title: 'About' }));
r.get('/privacy', (req, res) => res.render('site/privacy', { title: 'Privacy' }));

module.exports = r;
