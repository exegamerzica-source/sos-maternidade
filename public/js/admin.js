/* ═══════════════════════════════════════════════
   SOS Maternidade — admin.js (Admin Panel Logic)
   ═══════════════════════════════════════════════ */

'use strict';

// ──────────────────────────────────────────────
//  State
// ──────────────────────────────────────────────
let adminProducts = [];
let currentSection = 'products';
let pendingDeleteId = null;

const CATEGORY_LABELS = {
  fraldas:    '👶 Fraldas',
  leites:     '🍼 Leites e Fórmulas',
  higiene:    '🧴 Higiene e Saúde',
  acessorios: '🎒 Acessórios',
};

// ──────────────────────────────────────────────
//  Init
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const res = await apiFetch('/api/admin/check');
  if (res && res.isAdmin) {
    showDashboard();
    await Promise.all([loadProducts(), loadConfig()]);
  }
  // If not logged in, login screen is already visible by default
});

// ──────────────────────────────────────────────
//  Auth
// ──────────────────────────────────────────────
async function doLogin() {
  const pwd = document.getElementById('login-password').value.trim();
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  if (!pwd) {
    showLoginError('Por favor, insira a senha.');
    return;
  }

  btn.textContent = 'Entrando...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd }),
    });
    const data = await res.json();

    if (res.ok && data.success) {
      errEl.classList.add('hidden');
      showDashboard();
      await Promise.all([loadProducts(), loadConfig()]);
    } else {
      showLoginError(data.error || 'Senha incorreta.');
    }
  } catch {
    showLoginError('Erro de conexão. Verifique se o servidor está rodando.');
  } finally {
    btn.textContent = 'Entrar no Painel →';
    btn.disabled = false;
  }
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  document.getElementById('login-password').focus();
}

async function doLogout() {
  await fetch('/api/admin/logout', { method: 'POST' });
  document.getElementById('dashboard').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').classList.add('hidden');
}

// ──────────────────────────────────────────────
//  Dashboard
// ──────────────────────────────────────────────
function showDashboard() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  document.getElementById('dashboard').classList.add('flex');
}

function showSection(name) {
  currentSection = name;
  document.getElementById('section-products').classList.toggle('hidden', name !== 'products');
  document.getElementById('section-config').classList.toggle('hidden', name !== 'config');

  document.getElementById('page-title').textContent =
    name === 'products' ? 'Gestão de Produtos' : 'Configurações da Loja';

  // Nav active state
  ['products', 'config'].forEach(s => {
    const btn = document.getElementById(`nav-${s}`);
    if (!btn) return;
    if (s === name) {
      btn.className = 'nav-item w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-semibold transition-all bg-rose-600 text-white';
    } else {
      btn.className = 'nav-item w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-semibold transition-all text-gray-400 hover:bg-gray-800 hover:text-white';
    }
  });

  // Close sidebar on mobile
  closeSidebar();
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const isOpen = sidebar.classList.contains('open');
  sidebar.classList.toggle('open', !isOpen);
  overlay.classList.toggle('hidden', isOpen);
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.add('hidden');
}

// ──────────────────────────────────────────────
//  Products
// ──────────────────────────────────────────────
async function loadProducts() {
  try {
    const data = await apiFetch('/api/admin/products');
    if (data) {
      adminProducts = data;
      renderProductsTable();
      updateStats();
    }
  } catch {
    showTableError('Erro ao carregar produtos.');
  }
}

function updateStats() {
  const total = adminProducts.length;
  const inStock = adminProducts.filter(p => p.inStock).length;
  setEl('stat-total', total);
  setEl('stat-instock', inStock);
  setEl('stat-outofstock', total - inStock);
}

function renderProductsTable() {
  const tbody = document.getElementById('products-table-body');
  if (adminProducts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-16 text-gray-400">
          <div class="text-5xl mb-3">📦</div>
          <p class="font-semibold">Nenhum produto cadastrado</p>
          <p class="text-sm mt-1">Clique em "+ Adicionar Produto" para começar.</p>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = adminProducts.map(p => {
    const catLabel = CATEGORY_LABELS[p.category] || p.category;
    const stockClass = p.inStock ? 'badge-stock' : 'badge-nostock';
    const stockLabel = p.inStock ? 'Em Estoque' : 'Esgotado';
    const toggleLabel = p.inStock ? 'Marcar Esgotado' : 'Marcar Em Estoque';
    const toggleIcon = p.inStock ? '🔴' : '🟢';

    return `
      <tr class="hover:bg-rose-50/30 transition-colors">
        <td class="px-4 py-3">
          <img
            src="${escHtml(p.image) || `https://picsum.photos/seed/${p.id}/80/80`}"
            alt="${escHtml(p.name)}"
            class="w-10 h-10 rounded-lg object-cover bg-rose-50"
            onerror="this.src='https://picsum.photos/seed/${p.id}-adm/80/80'"
          />
        </td>
        <td class="px-4 py-3">
          <p class="font-semibold text-gray-900 text-sm leading-snug">${escHtml(p.name)}</p>
          ${p.description ? `<p class="text-gray-400 text-xs mt-0.5 line-clamp-1">${escHtml(p.description)}</p>` : ''}
        </td>
        <td class="px-4 py-3 hidden sm:table-cell">
          <span class="text-xs text-gray-600 font-medium">${catLabel}</span>
        </td>
        <td class="px-4 py-3 text-right">
          <span class="font-bold text-gray-900 text-sm">${fmtCurrency(p.price)}</span>
        </td>
        <td class="px-4 py-3 text-center">
          <span class="inline-block text-xs font-bold px-2.5 py-1 rounded-full ${stockClass}">
            ${stockLabel}
          </span>
        </td>
        <td class="px-4 py-3">
          <div class="flex items-center justify-center gap-1">
            <button onclick="openProductModal('${p.id}')" title="Editar"
              class="p-2 rounded-lg hover:bg-blue-50 text-blue-500 hover:text-blue-700 transition" aria-label="Editar produto">
              ✏️
            </button>
            <button onclick="toggleStock('${p.id}')" title="${toggleLabel}"
              class="p-2 rounded-lg hover:bg-gray-100 transition" aria-label="${toggleLabel}">
              ${toggleIcon}
            </button>
            <button onclick="openDeleteModal('${p.id}')" title="Excluir"
              class="p-2 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition" aria-label="Excluir produto">
              🗑️
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function showTableError(msg) {
  const tbody = document.getElementById('products-table-body');
  tbody.innerHTML = `
    <tr><td colspan="6" class="text-center py-12 text-red-500 font-semibold">${msg}</td></tr>`;
}

// ── Toggle Stock ──────────────────────────────
async function toggleStock(productId) {
  const res = await apiFetch(`/api/admin/products/${productId}/toggle`, { method: 'PATCH' });
  if (res) {
    const idx = adminProducts.findIndex(p => p.id === productId);
    if (idx !== -1) adminProducts[idx] = res;
    renderProductsTable();
    updateStats();
  }
}

// ── Delete ────────────────────────────────────
function openDeleteModal(productId) {
  pendingDeleteId = productId;
  const p = adminProducts.find(pr => pr.id === productId);
  const nameEl = document.getElementById('delete-product-name');
  nameEl.textContent = p ? `"${p.name}" será removido permanentemente.` : 'Esta ação não pode ser desfeita.';
  document.getElementById('delete-modal').classList.add('active');
}

function closeDeleteModal() {
  document.getElementById('delete-modal').classList.remove('active');
  pendingDeleteId = null;
}

function handleDeleteBackdropClick(e) {
  if (e.target === document.getElementById('delete-modal')) closeDeleteModal();
}

async function confirmDelete() {
  if (!pendingDeleteId) return;
  const btn = document.getElementById('delete-confirm-btn');
  btn.textContent = 'Excluindo...';
  btn.disabled = true;

  const res = await apiFetch(`/api/admin/products/${pendingDeleteId}`, { method: 'DELETE' });
  if (res && res.success) {
    adminProducts = adminProducts.filter(p => p.id !== pendingDeleteId);
    renderProductsTable();
    updateStats();
    closeDeleteModal();
  }

  btn.textContent = 'Excluir';
  btn.disabled = false;
}

// ──────────────────────────────────────────────
//  Product Modal (Add / Edit)
// ──────────────────────────────────────────────
function openProductModal(productId = null) {
  const modal = document.getElementById('product-modal');
  const errEl = document.getElementById('modal-error');
  errEl.classList.add('hidden');

  // Clear form
  ['m-name', 'm-price', 'm-image', 'm-description'].forEach(id => {
    document.getElementById(id).value = '';
    document.getElementById(id).classList.remove('error');
  });
  document.getElementById('m-category').value = '';
  document.getElementById('modal-product-id').value = '';
  document.getElementById('img-preview-wrap').style.display = 'none';

  if (productId) {
    // Edit mode
    const p = adminProducts.find(pr => pr.id === productId);
    if (!p) return;
    document.getElementById('modal-title').textContent = 'Editar Produto';
    document.getElementById('modal-product-id').value = p.id;
    document.getElementById('m-name').value = p.name;
    document.getElementById('m-category').value = p.category;
    document.getElementById('m-price').value = p.price;
    document.getElementById('m-image').value = p.image || '';
    document.getElementById('m-description').value = p.description || '';
    if (p.image) {
      document.getElementById('img-preview').src = p.image;
      document.getElementById('img-preview-wrap').style.display = 'block';
    }
  } else {
    document.getElementById('modal-title').textContent = 'Adicionar Produto';
  }

  modal.classList.add('active');
  setTimeout(() => document.getElementById('m-name').focus(), 100);
}

function closeProductModal() {
  document.getElementById('product-modal').classList.remove('active');
}

function handleModalBackdropClick(e) {
  if (e.target === document.getElementById('product-modal')) closeProductModal();
}

function previewImage() {
  const url = document.getElementById('m-image').value.trim();
  const wrap = document.getElementById('img-preview-wrap');
  const img  = document.getElementById('img-preview');
  if (url) {
    img.src = url;
    wrap.style.display = 'block';
  } else {
    wrap.style.display = 'none';
  }
}

async function saveProduct() {
  const errEl = document.getElementById('modal-error');
  errEl.classList.add('hidden');

  const name     = document.getElementById('m-name').value.trim();
  const category = document.getElementById('m-category').value;
  const price    = document.getElementById('m-price').value.trim();
  const image    = document.getElementById('m-image').value.trim();
  const description = document.getElementById('m-description').value.trim();
  const id       = document.getElementById('modal-product-id').value;

  // Validate
  let valid = true;
  [['m-name', name], ['m-price', price]].forEach(([elId, val]) => {
    const el = document.getElementById(elId);
    if (!val) { el.classList.add('error'); valid = false; }
    else el.classList.remove('error');
  });
  const catEl = document.getElementById('m-category');
  if (!category) { catEl.classList.add('error'); valid = false; }
  else catEl.classList.remove('error');

  if (!valid) {
    errEl.textContent = 'Preencha os campos obrigatórios (Nome, Categoria, Preço).';
    errEl.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('modal-save-btn');
  btn.textContent = 'Salvando...';
  btn.disabled = true;

  const body = { name, category, price: parseFloat(price), image, description };
  const isEdit = Boolean(id);
  const endpoint = isEdit ? `/api/admin/products/${id}` : '/api/admin/products';
  const method = isEdit ? 'PUT' : 'POST';

  const result = await apiFetch(endpoint, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  btn.textContent = '💾 Salvar Produto';
  btn.disabled = false;

  if (result && (result.id || result.name)) {
    if (isEdit) {
      const idx = adminProducts.findIndex(p => p.id === id);
      if (idx !== -1) adminProducts[idx] = result;
    } else {
      adminProducts.unshift(result);
    }
    renderProductsTable();
    updateStats();
    closeProductModal();
  } else if (result && result.error) {
    errEl.textContent = result.error;
    errEl.classList.remove('hidden');
  }
}

// ──────────────────────────────────────────────
//  Config
// ──────────────────────────────────────────────
async function loadConfig() {
  const data = await apiFetch('/api/config');
  if (data) {
    document.getElementById('cfg-whatsapp').value = data.whatsapp || '';
    document.getElementById('cfg-delivery').value = data.deliveryFee ?? 0;
  }
}

async function saveConfig() {
  const whatsapp = document.getElementById('cfg-whatsapp').value.trim().replace(/\D/g, '');
  const deliveryFee = parseFloat(document.getElementById('cfg-delivery').value) || 0;
  const msgEl = document.getElementById('config-msg');

  if (!whatsapp) {
    showConfigMsg('Insira o número de WhatsApp.', 'error');
    return;
  }

  const result = await apiFetch('/api/admin/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ whatsapp, deliveryFee }),
  });

  if (result && result.whatsapp) {
    document.getElementById('cfg-whatsapp').value = result.whatsapp;
    document.getElementById('cfg-delivery').value = result.deliveryFee;
    showConfigMsg('✅ Configurações salvas com sucesso!', 'success');
  } else {
    showConfigMsg('Erro ao salvar configurações.', 'error');
  }
}

function showConfigMsg(msg, type) {
  const el = document.getElementById('config-msg');
  el.textContent = msg;
  el.className = type === 'success'
    ? 'rounded-xl px-4 py-3 mb-4 text-sm font-medium bg-green-50 border border-green-200 text-green-700'
    : 'rounded-xl px-4 py-3 mb-4 text-sm font-medium bg-red-50 border border-red-200 text-red-700';
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

// ──────────────────────────────────────────────
//  API Helper
// ──────────────────────────────────────────────
async function apiFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);

    // Session expired
    if (res.status === 401 && url !== '/api/admin/check' && url !== '/api/admin/login') {
      alert('Sessão expirada. Faça login novamente.');
      doLogout();
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error(`apiFetch error [${url}]:`, err);
    return null;
  }
}

// ──────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────
function fmtCurrency(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ══════════════════════════════════════════════
//  BULK IMPORT
// ══════════════════════════════════════════════

// ── State ─────────────────────────────────────
let csvParsedRows = [];     // Array of product objects from CSV parser
let formRowCount = 0;       // Counter for unique form row IDs

// ── Modal open/close ──────────────────────────
function openBulkModal() {
  // Reset state
  csvParsedRows = [];
  document.getElementById('csv-input').value = '';
  document.getElementById('csv-preview-area').classList.add('hidden');
  document.getElementById('csv-preview-body').innerHTML = '';
  document.getElementById('csv-import-btn').disabled = true;
  document.getElementById('csv-import-count').textContent = '0';
  document.getElementById('bulk-feedback').classList.add('hidden');

  // Reset form tab
  formRowCount = 0;
  document.getElementById('form-rows').innerHTML = '';
  addFormRow();   // start with 3 empty rows
  addFormRow();
  addFormRow();

  // Default to CSV tab
  switchBulkTab('csv');

  document.getElementById('bulk-modal').classList.add('active');
}

function closeBulkModal() {
  document.getElementById('bulk-modal').classList.remove('active');
}

function handleBulkBackdropClick(e) {
  if (e.target === document.getElementById('bulk-modal')) closeBulkModal();
}

// ── Tab switch ────────────────────────────────
function switchBulkTab(tab) {
  document.getElementById('bulk-tab-csv').classList.toggle('hidden', tab !== 'csv');
  document.getElementById('bulk-tab-form').classList.toggle('hidden', tab !== 'form');
  document.getElementById('tab-csv').classList.toggle('active', tab === 'csv');
  document.getElementById('tab-form').classList.toggle('active', tab === 'form');
  document.getElementById('bulk-feedback').classList.add('hidden');
}

// ══════════════════════════════════════════════
//  TAB 1 — CSV / Excel Paste
// ══════════════════════════════════════════════

const VALID_CATEGORIES = ['fraldas', 'leites', 'higiene', 'acessorios'];
const CATEGORY_ALIASES = {
  fraldas: ['fralda', 'fraldas', 'diaper'],
  leites: ['leite', 'leites', 'formula', 'fórmula', 'formulas', 'fórmulas', 'nan', 'aptamil'],
  higiene: ['higiene', 'saude', 'saúde', 'higiene e saúde', 'health'],
  acessorios: ['acessorio', 'acessorios', 'acessório', 'acessórios', 'accessories'],
};

/** Normalize category string to a known slug */
function normalizeCategory(raw) {
  if (!raw) return 'acessorios';
  const lower = raw.toLowerCase().trim();
  if (VALID_CATEGORIES.includes(lower)) return lower;
  for (const [slug, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (aliases.some(a => lower.includes(a))) return slug;
  }
  return 'acessorios';
}

/** Detect delimiter used in pasted text */
function detectDelimiter(text) {
  const tabs   = (text.match(/\t/g) || []).length;
  const semis  = (text.match(/;/g)  || []).length;
  const commas = (text.match(/,/g)  || []).length;
  if (tabs >= semis && tabs >= commas) return '\t';
  if (semis >= commas) return ';';
  return ',';
}

/** Detect if first row is a header (contains no numeric price) */
function isHeaderRow(row) {
  if (!row || row.length < 2) return false;
  const second = (row[1] || '').trim().replace(',', '.');
  return isNaN(parseFloat(second));
}

/** Parse raw text into product rows */
function parseCSV(text) {
  const delimiter = detectDelimiter(text);
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  let start = 0;
  const firstRow = lines[0].split(delimiter);
  if (isHeaderRow(firstRow)) start = 1;  // skip header

  const rows = [];
  for (let i = start; i < lines.length; i++) {
    const cells = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    const name  = cells[0] || '';
    if (!name) continue;

    const rawPrice = (cells[1] || '0').replace(',', '.');
    const price    = parseFloat(rawPrice) || 0;
    const category = normalizeCategory(cells[2]);
    const description = cells[3] || '';
    const image    = cells[4] || '';

    rows.push({ name, price, category, description, image, _valid: name.length > 0 && price > 0 });
  }
  return rows;
}

/** Triggered on textarea input — parse and show preview */
function parseCsvPreview() {
  const raw = document.getElementById('csv-input').value;
  csvParsedRows = parseCSV(raw);

  const previewArea = document.getElementById('csv-preview-area');
  const tbody = document.getElementById('csv-preview-body');
  const importBtn = document.getElementById('csv-import-btn');
  const countLabel = document.getElementById('csv-import-count');
  const csvCountLabel = document.getElementById('csv-count-label');

  if (!csvParsedRows.length) {
    previewArea.classList.add('hidden');
    importBtn.disabled = true;
    countLabel.textContent = '0';
    return;
  }

  previewArea.classList.remove('hidden');
  const validCount = csvParsedRows.filter(r => r._valid).length;
  csvCountLabel.textContent = `(${csvParsedRows.length} produto${csvParsedRows.length !== 1 ? 's' : ''} detectado${csvParsedRows.length !== 1 ? 's' : ''})`;
  countLabel.textContent = validCount;
  importBtn.disabled = validCount === 0;

  tbody.innerHTML = csvParsedRows.map((row, idx) => {
    const rowClass = !row._valid ? 'opacity-50' : '';
    const warning  = !row._valid ? '<span title="Linha inválida (nome ou preço ausente)" style="color:#ef4444">⚠</span>' : '✓';
    const imgThumb = row.image
      ? `<img src="${escHtml(row.image)}" class="w-7 h-7 rounded object-cover inline-block" onerror="this.style.display='none'" />`
      : '<span class="text-gray-300 text-xs">—</span>';

    return `
      <tr class="${rowClass}">
        <td class="text-gray-400">${idx + 1}</td>
        <td class="font-medium max-w-[160px] truncate" title="${escHtml(row.name)}">${escHtml(row.name)}</td>
        <td>${row.price > 0 ? fmtCurrency(row.price) : '<span class="text-red-400 text-xs">sem preço</span>'}</td>
        <td><span class="text-xs bg-gray-100 px-2 py-0.5 rounded-full">${escHtml(row.category)}</span></td>
        <td class="max-w-[120px] truncate text-gray-400 text-xs" title="${escHtml(row.description)}">${row.description || '—'}</td>
        <td>${imgThumb}</td>
        <td>
          <button onclick="removeCsvRow(${idx})" class="text-gray-300 hover:text-red-500 transition text-sm px-1" title="Remover linha">✕</button>
        </td>
      </tr>`;
  }).join('');
}

function removeCsvRow(idx) {
  csvParsedRows.splice(idx, 1);
  // Re-render preview without re-parsing
  const tbody = document.getElementById('csv-preview-body');
  const importBtn = document.getElementById('csv-import-btn');
  const countLabel = document.getElementById('csv-import-count');
  const csvCountLabel = document.getElementById('csv-count-label');

  if (!csvParsedRows.length) {
    document.getElementById('csv-preview-area').classList.add('hidden');
    importBtn.disabled = true;
    countLabel.textContent = '0';
    return;
  }

  const validCount = csvParsedRows.filter(r => r._valid).length;
  csvCountLabel.textContent = `(${csvParsedRows.length} produto${csvParsedRows.length !== 1 ? 's' : ''})`;
  countLabel.textContent = validCount;
  importBtn.disabled = validCount === 0;

  tbody.innerHTML = csvParsedRows.map((row, i) => {
    const rowClass = !row._valid ? 'opacity-50' : '';
    const imgThumb = row.image
      ? `<img src="${escHtml(row.image)}" class="w-7 h-7 rounded object-cover inline-block" onerror="this.style.display='none'" />`
      : '<span class="text-gray-300 text-xs">—</span>';
    return `
      <tr class="${rowClass}">
        <td class="text-gray-400">${i + 1}</td>
        <td class="font-medium max-w-[160px] truncate">${escHtml(row.name)}</td>
        <td>${row.price > 0 ? fmtCurrency(row.price) : '<span class="text-red-400 text-xs">sem preço</span>'}</td>
        <td><span class="text-xs bg-gray-100 px-2 py-0.5 rounded-full">${escHtml(row.category)}</span></td>
        <td class="max-w-[120px] truncate text-gray-400 text-xs">${row.description || '—'}</td>
        <td>${imgThumb}</td>
        <td><button onclick="removeCsvRow(${i})" class="text-gray-300 hover:text-red-500 transition text-sm px-1">✕</button></td>
      </tr>`;
  }).join('');
}

function clearCsvInput() {
  document.getElementById('csv-input').value = '';
  csvParsedRows = [];
  document.getElementById('csv-preview-area').classList.add('hidden');
  document.getElementById('csv-import-btn').disabled = true;
  document.getElementById('csv-import-count').textContent = '0';
}

/** Send all valid CSV rows to the API */
async function importFromCsv() {
  const toImport = csvParsedRows.filter(r => r._valid);
  if (!toImport.length) return;

  const btn = document.getElementById('csv-import-btn');
  btn.disabled = true;
  btn.textContent = `Importando… 0 / ${toImport.length}`;

  await bulkSendProducts(toImport, (done, total) => {
    btn.textContent = `Importando… ${done} / ${total}`;
  });

  btn.textContent = `⚡ Importar ${toImport.length} produtos`;
  btn.disabled = false;
}

// ══════════════════════════════════════════════
//  TAB 2 — Multi-row Form
// ══════════════════════════════════════════════

function addFormRow() {
  const id = ++formRowCount;
  const container = document.getElementById('form-rows');
  const row = document.createElement('div');
  row.className = 'row-item';
  row.id = `form-row-${id}`;
  row.innerHTML = `
    <input
      type="text"
      class="adm-input row-name"
      placeholder="Nome do produto *"
      data-row="${id}"
    />
    <input
      type="number"
      class="adm-input row-price"
      placeholder="R$ 0,00"
      min="0"
      step="0.01"
      data-row="${id}"
    />
    <select class="adm-input row-cat" data-row="${id}">
      <option value="fraldas">👶 Fraldas</option>
      <option value="leites">🍼 Leites</option>
      <option value="higiene">🧴 Higiene</option>
      <option value="acessorios">🎒 Acessórios</option>
    </select>
    <button class="row-remove-btn" onclick="removeFormRow(${id})" title="Remover linha" aria-label="Remover">✕</button>
  `;
  container.appendChild(row);

  // Focus name field of new row
  setTimeout(() => row.querySelector('.row-name').focus(), 50);
}

function removeFormRow(id) {
  const row = document.getElementById(`form-row-${id}`);
  if (row) row.remove();
  // Ensure at least 1 row remains
  if (!document.getElementById('form-rows').children.length) addFormRow();
}

/** Read all rows from the multi-form tab */
function readFormRows() {
  const rows = document.querySelectorAll('#form-rows .row-item');
  const products = [];
  rows.forEach(row => {
    const name  = (row.querySelector('.row-name')?.value || '').trim();
    const price = parseFloat(row.querySelector('.row-price')?.value || '0') || 0;
    const cat   = row.querySelector('.row-cat')?.value || 'acessorios';
    if (name) products.push({ name, price, category: cat, description: '', image: '', _valid: price > 0 });
  });
  return products;
}

async function importFromForm() {
  const products = readFormRows().filter(p => p.name);

  if (!products.length) {
    showBulkFeedback('Preencha pelo menos um produto antes de importar.', 'error');
    return;
  }

  const hasInvalid = products.some(p => !p._valid);
  if (hasInvalid) {
    const confirmed = confirm(`Algumas linhas não têm preço definido (ficará como R$ 0,00). Deseja continuar mesmo assim?`);
    if (!confirmed) return;
  }

  const btn = document.getElementById('form-import-btn');
  btn.disabled = true;
  btn.textContent = `Importando… 0 / ${products.length}`;

  await bulkSendProducts(products, (done, total) => {
    btn.textContent = `Importando… ${done} / ${total}`;
  });

  btn.textContent = '⚡ Importar Todos os Produtos';
  btn.disabled = false;
}

// ══════════════════════════════════════════════
//  Shared: send array of products to API
// ══════════════════════════════════════════════
async function bulkSendProducts(products, onProgress) {
  let success = 0;
  let errors  = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const body = {
      name:        p.name,
      category:    p.category,
      price:       p.price,
      image:       p.image || '',
      description: p.description || '',
    };

    const result = await apiFetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (result && result.id) {
      adminProducts.unshift(result);
      success++;
    } else {
      errors++;
    }

    onProgress(i + 1, products.length);
  }

  renderProductsTable();
  updateStats();

  if (errors === 0) {
    showBulkFeedback(`✅ ${success} produto${success !== 1 ? 's' : ''} importado${success !== 1 ? 's' : ''} com sucesso!`, 'success');
    // Auto-close after 2.5s on full success
    setTimeout(closeBulkModal, 2500);
  } else {
    showBulkFeedback(
      `⚠️ ${success} importado${success !== 1 ? 's' : ''} com sucesso, ${errors} falha${errors !== 1 ? 's' : ''}.`,
      'warning'
    );
  }
}

function showBulkFeedback(msg, type) {
  const el = document.getElementById('bulk-feedback');
  el.textContent = msg;
  const styles = {
    success: 'bg-green-50 border border-green-200 text-green-700',
    error:   'bg-red-50 border border-red-200 text-red-700',
    warning: 'bg-amber-50 border border-amber-200 text-amber-800',
  };
  el.className = `mx-6 mt-3 rounded-xl px-4 py-3 text-sm font-medium ${styles[type] || styles.success}`;
  el.classList.remove('hidden');
}
