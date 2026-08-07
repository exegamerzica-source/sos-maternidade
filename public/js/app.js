/* ═══════════════════════════════════════════════
   SOS Maternidade — app.js (Store Logic)
   ═══════════════════════════════════════════════ */

'use strict';

// ──────────────────────────────────────────────
//  State
// ──────────────────────────────────────────────
let allProducts = [];
let storeConfig = { whatsapp: '5547999835305', deliveryFee: 0, storeName: 'SOS Maternidade' };
let cart = {};          // { productId: qty }
let currentCategory = 'all';
let selectedPayment = 'Pix';

// ──────────────────────────────────────────────
//  Init
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  startClock();
  loadCartFromStorage();

  try {
    await Promise.all([fetchConfig(), fetchProducts()]);
  } catch (err) {
    console.error('Erro ao carregar dados:', err);
    showToast('Erro ao carregar produtos. Tente novamente.', 'error');
  }

  const sb = document.getElementById('search-bar');
  if (sb) {
    sb.addEventListener('input', () => {
      // Quando o usuário pesquisa, se a categoria não for "all", talvez seja melhor resetar para "all" 
      // ou apenas filtrar na categoria atual. Vamos filtrar na categoria atual, mas é bom voltar pra ALL se não achar nada.
      renderProducts();
    });
  }

  renderProducts();
  updateCartUI();
});

// ──────────────────────────────────────────────
//  Clock
// ──────────────────────────────────────────────
function startClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  function tick() {
    el.textContent = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit', minute: '2-digit', hour12: false
    });
  }
  tick();
  setInterval(tick, 1000);
}

// ──────────────────────────────────────────────
//  API Calls
// ──────────────────────────────────────────────
async function fetchConfig() {
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error('Falha ao buscar configurações');
  storeConfig = await res.json();
  updateDeliveryDisplay();
}

async function fetchProducts() {
  const res = await fetch('/api/products');
  if (!res.ok) throw new Error('Falha ao buscar produtos');
  allProducts = await res.json();
}

// ──────────────────────────────────────────────
//  Product Rendering
// ──────────────────────────────────────────────
const CATEGORY_LABELS = {
  fraldas:    '👶 Fraldas',
  leites:     '🍼 Leites',
  higiene:    '🧴 Higiene',
  acessorios: '🎒 Acessórios',
};

function filterCategory(category, btn) {
  currentCategory = category;
  document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderProducts();
}

function renderProducts() {
  const grid = document.getElementById('product-grid');
  const empty = document.getElementById('empty-state');
  const sb = document.getElementById('search-bar');
  const searchTerm = sb ? sb.value.toLowerCase().trim() : '';

  let filtered = currentCategory === 'all'
    ? allProducts
    : allProducts.filter(p => p.category === currentCategory);

  if (searchTerm) {
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(searchTerm) || 
      (p.description && p.description.toLowerCase().includes(searchTerm))
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    empty.classList.add('flex');
    return;
  }

  empty.classList.add('hidden');
  empty.classList.remove('flex');

  grid.innerHTML = filtered.map(product => buildProductCard(product)).join('');
}

function buildProductCard(p) {
  const inCart = cart[p.id] > 0;
  const qty = cart[p.id] || 0;
  const catLabel = CATEGORY_LABELS[p.category] || p.category;
  const priceStr = formatCurrency(p.price);

  const addBtn = p.inStock
    ? (inCart
        ? `<div class="qty-stepper w-full justify-center">
            <button onclick="changeQty('${p.id}', -1)" aria-label="Diminuir quantidade">−</button>
            <span>${qty}</span>
            <button onclick="changeQty('${p.id}', 1)" aria-label="Aumentar quantidade">+</button>
          </div>`
        : `<button onclick="addToCart('${p.id}')"
            class="w-full bg-gradient-to-r from-rose-600 to-rose-500 text-white font-bold text-sm py-2.5 rounded-xl hover:opacity-90 active:scale-95 transition-all">
            + Adicionar
          </button>`)
    : `<button disabled
          class="w-full bg-gray-200 text-gray-400 font-bold text-sm py-2.5 rounded-xl cursor-not-allowed">
          Esgotado
        </button>`;

  return `
    <div class="product-card" id="card-${p.id}">
      <div class="relative">
        <img
          src="${escapeHtml(p.image) || `https://picsum.photos/seed/${p.id}/400/400`}"
          alt="${escapeHtml(p.name)}"
          loading="lazy"
          onerror="this.src='https://picsum.photos/seed/${p.id}-fallback/400/400'"
        />
        <span class="absolute top-2 right-2 bg-white/90 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
          ${catLabel}
        </span>
        ${!p.inStock ? '<span class="badge-esgotado">Esgotado</span>' : ''}
        ${inCart && p.inStock ? `<span class="absolute bottom-2 right-2 bg-rose-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">${qty}</span>` : ''}
      </div>
      <div class="p-3 flex flex-col flex-1">
        <p class="font-bold text-gray-900 text-sm leading-snug line-clamp-2 mb-1">${escapeHtml(p.name)}</p>
        ${p.description ? `<p class="text-gray-400 text-xs line-clamp-2 mb-2 flex-1">${escapeHtml(p.description)}</p>` : '<div class="flex-1"></div>'}
        <p class="text-rose-600 font-black text-lg mb-2">${priceStr}</p>
        ${addBtn}
      </div>
    </div>`;
}

// Re-render only a single card to avoid full grid reflow
function updateCard(productId) {
  const card = document.getElementById(`card-${productId}`);
  if (!card) return;
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = buildProductCard(product);
  const newCard = tmp.firstElementChild;
  card.replaceWith(newCard);
}

// ──────────────────────────────────────────────
//  Cart Logic
// ──────────────────────────────────────────────
function addToCart(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product || !product.inStock) return;
  cart[productId] = (cart[productId] || 0) + 1;
  saveCartToStorage();
  updateCard(productId);
  updateCartUI();
  showToast(`✓ ${product.name.split(' ').slice(0, 3).join(' ')} adicionado!`);
}

function changeQty(productId, delta) {
  const current = cart[productId] || 0;
  const newQty = current + delta;
  if (newQty <= 0) {
    delete cart[productId];
  } else {
    cart[productId] = newQty;
  }
  saveCartToStorage();
  updateCard(productId);
  updateCartUI();
  renderDrawerItems();
  updateSummary();
}

function removeFromCart(productId) {
  delete cart[productId];
  saveCartToStorage();
  updateCard(productId);
  updateCartUI();
  renderDrawerItems();
  updateSummary();
  if (getCartItemCount() === 0) showEmptyDrawer();
}

function getCartItemCount() {
  return Object.values(cart).reduce((s, q) => s + q, 0);
}

function getCartSubtotal() {
  return Object.entries(cart).reduce((total, [id, qty]) => {
    const p = allProducts.find(pr => pr.id === id);
    return total + (p ? p.price * qty : 0);
  }, 0);
}

function saveCartToStorage() {
  try { localStorage.setItem('sos_cart', JSON.stringify(cart)); } catch {}
}

function loadCartFromStorage() {
  try {
    const saved = localStorage.getItem('sos_cart');
    if (saved) cart = JSON.parse(saved);
  } catch { cart = {}; }
}

// ──────────────────────────────────────────────
//  Cart UI Updates
// ──────────────────────────────────────────────
function updateCartUI() {
  const count = getCartItemCount();
  const subtotal = getCartSubtotal();
  const total = subtotal + storeConfig.deliveryFee;

  // Header cart icon badge
  const headerBadge = document.getElementById('header-cart-count');
  if (headerBadge) {
    headerBadge.textContent = count;
    headerBadge.classList.toggle('hidden', count === 0);
    headerBadge.classList.toggle('flex', count > 0);
  }

  // Bottom bar
  const bar = document.getElementById('cart-bar');
  const badge = document.getElementById('cart-count-badge');
  const totalBar = document.getElementById('cart-total-bar');
  const itemsSummary = document.getElementById('cart-items-summary');

  if (bar) bar.classList.toggle('visible', count > 0);
  if (badge) badge.textContent = count;
  if (totalBar) totalBar.textContent = formatCurrency(total);
  if (itemsSummary) {
    const label = count === 1 ? '1 item no carrinho' : `${count} itens no carrinho`;
    itemsSummary.textContent = label;
  }

  // Drawer item count badge
  const drawerCount = document.getElementById('drawer-item-count');
  if (drawerCount) {
    drawerCount.textContent = count === 1 ? '1 item' : `${count} itens`;
  }
}

function updateSummary() {
  const subtotal = getCartSubtotal();
  const deliveryFee = storeConfig.deliveryFee;
  const total = subtotal + deliveryFee;

  setEl('summary-subtotal', formatCurrency(subtotal));
  setEl('summary-total', formatCurrency(total));
}

function updateDeliveryDisplay() {
  const el = document.getElementById('summary-delivery');
  if (!el) return;
  const fee = storeConfig.deliveryFee;
  el.textContent = fee === 0 ? 'GRÁTIS 🎁' : formatCurrency(fee);
  el.className = fee === 0 ? 'font-semibold text-green-600' : 'font-semibold text-gray-700';
}

// ──────────────────────────────────────────────
//  Drawer
// ──────────────────────────────────────────────
function openDrawer() {
  document.getElementById('drawer-overlay').classList.add('active');
  document.getElementById('drawer-panel').classList.add('active');
  document.body.style.overflow = 'hidden';
  renderDrawerItems();
  updateSummary();
  updateDeliveryDisplay();
}

function closeDrawer() {
  document.getElementById('drawer-overlay').classList.remove('active');
  document.getElementById('drawer-panel').classList.remove('active');
  document.body.style.overflow = '';
}

function showEmptyDrawer() {
  document.getElementById('drawer-empty').classList.remove('hidden');
  document.getElementById('drawer-items').classList.add('hidden');
  document.getElementById('checkout-section').classList.add('hidden');
}

function showCartDrawer() {
  document.getElementById('drawer-empty').classList.add('hidden');
  document.getElementById('drawer-items').classList.remove('hidden');
  document.getElementById('checkout-section').classList.remove('hidden');
}

function renderDrawerItems() {
  const count = getCartItemCount();
  if (count === 0) { showEmptyDrawer(); return; }
  showCartDrawer();

  const container = document.getElementById('drawer-items');
  const entries = Object.entries(cart).filter(([, qty]) => qty > 0);

  container.innerHTML = entries.map(([id, qty]) => {
    const p = allProducts.find(pr => pr.id === id);
    if (!p) return '';
    const itemTotal = formatCurrency(p.price * qty);
    return `
      <div class="flex items-center gap-3 bg-gray-50 rounded-2xl p-3">
        <img
          src="${escapeHtml(p.image) || `https://picsum.photos/seed/${p.id}/80/80`}"
          alt="${escapeHtml(p.name)}"
          class="w-14 h-14 rounded-xl object-cover bg-rose-50 flex-shrink-0"
          onerror="this.src='https://picsum.photos/seed/${p.id}-fb/80/80'"
        />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-bold text-gray-900 line-clamp-2 leading-snug">${escapeHtml(p.name)}</p>
          <p class="text-xs text-gray-400 mt-0.5">${formatCurrency(p.price)} cada</p>
          <p class="text-sm font-black text-rose-600">${itemTotal}</p>
        </div>
        <div class="flex flex-col items-center gap-1.5">
          <div class="qty-stepper">
            <button onclick="changeQty('${p.id}', -1)" aria-label="Diminuir">−</button>
            <span>${qty}</span>
            <button onclick="changeQty('${p.id}', 1)" aria-label="Aumentar">+</button>
          </div>
          <button onclick="removeFromCart('${p.id}')" class="text-[10px] text-gray-400 hover:text-red-500 transition" aria-label="Remover item">
            🗑 remover
          </button>
        </div>
      </div>`;
  }).join('');
}

// ──────────────────────────────────────────────
//  Payment selection
// ──────────────────────────────────────────────
function selectPayment(method) {
  selectedPayment = method;
  document.getElementById('pay-pix').classList.toggle('active', method === 'Pix');
  document.getElementById('pay-card').classList.toggle('active', method === 'Cartão');
}

// ──────────────────────────────────────────────
//  Checkout & WhatsApp
// ──────────────────────────────────────────────
function handleCheckout() {
  if (!validateForm()) return;
  const formData = readFormData();
  const message = buildWhatsAppMessage(formData);
  const encoded = encodeURIComponent(message);
  const url = `https://wa.me/${storeConfig.whatsapp}?text=${encoded}`;
  window.open(url, '_blank');
}

function validateForm() {
  const fields = [
    { id: 'f-name',         label: 'Nome completo' },
    { id: 'f-street',       label: 'Rua/Avenida' },
    { id: 'f-number',       label: 'Número' },
    { id: 'f-neighborhood', label: 'Bairro' },
    { id: 'f-reference',    label: 'Ponto de referência' },
  ];

  let valid = true;
  fields.forEach(f => {
    const el = document.getElementById(f.id);
    const empty = !el.value.trim();
    el.classList.toggle('error', empty);
    if (empty) {
      valid = false;
    } else {
      el.classList.remove('error');
    }
  });

  if (!valid) {
    showToast('⚠️ Preencha todos os campos obrigatórios', 'error');
    document.getElementById('f-name').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return valid;
}

function readFormData() {
  return {
    name:         document.getElementById('f-name').value.trim(),
    street:       document.getElementById('f-street').value.trim(),
    number:       document.getElementById('f-number').value.trim(),
    neighborhood: document.getElementById('f-neighborhood').value.trim(),
    reference:    document.getElementById('f-reference').value.trim(),
    payment:      selectedPayment,
  };
}

function buildWhatsAppMessage(f) {
  const items = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      const p = allProducts.find(pr => pr.id === id);
      if (!p) return '';
      const itemTotal = (p.price * qty).toFixed(2).replace('.', ',');
      return `• ${qty}x ${p.name} - R$ ${itemTotal}`;
    })
    .filter(Boolean)
    .join('\n');

  const subtotal = getCartSubtotal();
  const deliveryFee = storeConfig.deliveryFee;
  const total = subtotal + deliveryFee;
  const feeStr = deliveryFee === 0 ? 'GRÁTIS 🎁' : `R$ ${deliveryFee.toFixed(2).replace('.', ',')}`;

  return (
`👶 *NOVO PEDIDO - SOS MATERNIDADE* 👶
--------------------------------------------------
*Cliente:* ${f.name}
*Endereço:* ${f.street}, ${f.number} - ${f.neighborhood}
*Referência:* ${f.reference}
*Pagamento:* ${f.payment}

📦 *ITENS DO PEDIDO:*
${items}

--------------------------------------------------
*Subtotal:* R$ ${subtotal.toFixed(2).replace('.', ',')}
*Taxa de Entrega:* ${feeStr}
💰 *TOTAL DA COMPRA: R$ ${total.toFixed(2).replace('.', ',')}*
--------------------------------------------------
*Por favor, me envie a chave Pix para pagamento e liberação da entrega!*
--------------------------------------------------`
  );
}

// ──────────────────────────────────────────────
//  Toast
// ──────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  clearTimeout(_toastTimer);

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.background = type === 'error' ? '#ef4444' : '#111827';
  toast.textContent = msg;
  document.body.appendChild(toast);

  _toastTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ──────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────
function formatCurrency(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
