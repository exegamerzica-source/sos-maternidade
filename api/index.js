'use strict';

const express = require('express');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'db.json');
const SESSION_SECRET = process.env.SESSION_SECRET || 'sos-mat-secret-2024-xK9pQ';

// ══════════════════════════════════════════════
//  DB Helpers
// ══════════════════════════════════════════════
function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return initDefaultDB();
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function initDefaultDB() {
  const defaults = {
    config: { whatsapp: '5547999835305', deliveryFee: 0, storeName: 'BabyFlash' },
    admin: { password: 'admin123' },
    products: []
  };
  writeDB(defaults);
  return defaults;
}

// ══════════════════════════════════════════════
//  Middleware
// ══════════════════════════════════════════════
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,    // set true if HTTPS in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000   // 24 hours
  }
}));

// ──────────────────────────────────────────────
//  Auth Guard
// ──────────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin === true) return next();
  return res.status(401).json({ error: 'Acesso negado. Faça login primeiro.' });
}

// ══════════════════════════════════════════════
//  PUBLIC ROUTES
// ══════════════════════════════════════════════

// GET /api/products  — returns all products (including out-of-stock, frontend handles badge)
app.get('/api/products', (_req, res) => {
  const db = readDB();
  res.json(db.products);
});

// GET /api/config  — public store settings (whatsapp, deliveryFee, storeName)
app.get('/api/config', (_req, res) => {
  const { whatsapp, deliveryFee, storeName } = readDB().config;
  res.json({ whatsapp, deliveryFee, storeName });
});

// ══════════════════════════════════════════════
//  ADMIN ROUTES
// ══════════════════════════════════════════════

// GET /api/admin/check  — is session authenticated?
app.get('/api/admin/check', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// POST /api/admin/login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Senha obrigatória.' });

  const db = readDB();
  const correct = process.env.ADMIN_PASSWORD || db.admin.password;

  if (password !== correct) {
    return res.status(401).json({ error: 'Senha incorreta. Tente novamente.' });
  }

  req.session.isAdmin = true;
  req.session.save(err => {
    if (err) return res.status(500).json({ error: 'Erro interno ao criar sessão.' });
    res.json({ success: true });
  });
});

// POST /api/admin/logout
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Erro ao encerrar sessão.' });
    res.json({ success: true });
  });
});

// ── Products ────────────────────────────────

// GET /api/admin/products
app.get('/api/admin/products', requireAdmin, (_req, res) => {
  res.json(readDB().products);
});

// POST /api/admin/products
app.post('/api/admin/products', requireAdmin, (req, res) => {
  const { name, category, price, image, description } = req.body;

  if (!name || !category || price === undefined || price === '') {
    return res.status(400).json({ error: 'Nome, categoria e preço são obrigatórios.' });
  }

  const db = readDB();
  const product = {
    id: uuidv4(),
    name: String(name).trim(),
    category: String(category),
    price: parseFloat(price),
    image: image ? String(image).trim() : '',
    description: description ? String(description).trim() : '',
    inStock: true,
    createdAt: new Date().toISOString()
  };

  db.products.push(product);
  writeDB(db);
  res.status(201).json(product);
});

// PUT /api/admin/products/:id
app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  const db = readDB();
  const idx = db.products.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Produto não encontrado.' });

  const { name, category, price, image, description } = req.body;
  const p = db.products[idx];

  db.products[idx] = {
    ...p,
    name:        name        !== undefined ? String(name).trim()         : p.name,
    category:    category    !== undefined ? String(category)            : p.category,
    price:       price       !== undefined ? parseFloat(price)           : p.price,
    image:       image       !== undefined ? String(image).trim()        : p.image,
    description: description !== undefined ? String(description).trim()  : p.description,
    updatedAt: new Date().toISOString()
  };

  writeDB(db);
  res.json(db.products[idx]);
});

// PATCH /api/admin/products/:id/toggle  — flip inStock
app.patch('/api/admin/products/:id/toggle', requireAdmin, (req, res) => {
  const db = readDB();
  const idx = db.products.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Produto não encontrado.' });

  db.products[idx].inStock = !db.products[idx].inStock;
  db.products[idx].updatedAt = new Date().toISOString();
  writeDB(db);
  res.json(db.products[idx]);
});

// DELETE /api/admin/products/:id
app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  const db = readDB();
  const idx = db.products.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Produto não encontrado.' });

  const [deleted] = db.products.splice(idx, 1);
  writeDB(db);
  res.json({ success: true, deleted });
});

// ── Config ──────────────────────────────────

// PUT /api/admin/config
app.put('/api/admin/config', requireAdmin, (req, res) => {
  const db = readDB();
  const { whatsapp, deliveryFee } = req.body;

  if (whatsapp !== undefined) {
    db.config.whatsapp = String(whatsapp).replace(/\D/g, '');
  }
  if (deliveryFee !== undefined) {
    db.config.deliveryFee = Math.max(0, parseFloat(deliveryFee) || 0);
  }

  writeDB(db);
  res.json(db.config);
});

// ══════════════════════════════════════════════
//  Admin SPA route
// ══════════════════════════════════════════════
app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

// ══════════════════════════════════════════════
//  404 fallback
// ══════════════════════════════════════════════
app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

// ══════════════════════════════════════════════
//  Start server
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    const line = '═'.repeat(42);
    console.log(`\n${line}`);
    console.log('  🍼  BabyFlash — Servidor Iniciado');
    console.log(line);
    console.log(`  🌐  Loja:   http://localhost:${PORT}`);
    console.log(`  🔐  Admin:  http://localhost:${PORT}/admin`);
    console.log(`  🔑  Senha:  ${process.env.ADMIN_PASSWORD ? '(env var)' : 'admin123'}`);
    console.log(`${line}\n`);
  });
}

module.exports = app;
