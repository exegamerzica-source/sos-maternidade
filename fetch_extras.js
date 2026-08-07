/**
 * Busca categorias extras (Móveis, Roupas, Brinquedos) na Alo Bebê,
 * limitando a quantidade para não poluir o catálogo focado.
 */
const fs   = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, 'db.json');

const BASE_URL = 'https://www.alobebe.com.br';
const HEADERS  = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
};

const EXTRA_TERMS = [
  { term: 'macacao', limit: 8, cat: 'roupas' },
  { term: 'pijama', limit: 5, cat: 'roupas' },
  { term: 'berco', limit: 4, cat: 'moveis' },
  { term: 'comoda', limit: 3, cat: 'moveis' },
  { term: 'urso', limit: 5, cat: 'brinquedos' },
  { term: 'mobile', limit: 3, cat: 'brinquedos' },
  { term: 'alimentacao', limit: 4, cat: 'moveis' },
  { term: 'andador', limit: 3, cat: 'brinquedos' }
];

function extractPrice(product) {
  try { return product.items?.[0]?.sellers?.[0]?.commertialOffer?.Price || 0; } catch { return 0; }
}

function extractImage(product) {
  try {
    const url = product.items?.[0]?.images?.[0]?.imageUrl || '';
    return url.split('?')[0];
  } catch { return ''; }
}

function cleanText(str) {
  if (!str) return '';
  return str.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 220);
}

function normalizeName(name) {
  return name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-záàãâéêíóõôúç0-9 ]/gi, '').replace(/\s+/g, ' ').trim();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function searchProducts(term) {
  const url = `${BASE_URL}/api/catalog_system/pub/products/search?ft=${term}&_from=0&_to=29`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (res.status === 200 || res.status === 206) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  } catch {}
  return [];
}

async function main() {
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const existing = new Set(db.products.map(p => normalizeName(p.name)));
  let added = 0;

  console.log('\n══════════════════════════════════════════');
  console.log('  🧸  Adicionando produtos extras (Móveis, Roupas, Brinquedos)...');
  console.log('══════════════════════════════════════════\n');

  for (const { term, limit, cat } of EXTRA_TERMS) {
    process.stdout.write(`  Buscando "${term}"... `);
    const results = await searchProducts(term);
    let found = 0;

    for (const raw of results) {
      if (found >= limit) break; // respeita o limite por termo

      const name = (raw.productName || '').trim();
      if (!name) continue;
      const key = normalizeName(name);
      if (existing.has(key)) continue;

      const price = extractPrice(raw);
      if (price <= 0) continue;

      const image = extractImage(raw);
      if (!image) continue;

      const desc = cleanText(raw.description || raw.metaTagDescription || '');

      db.products.push({
        id:          `extra-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        name, price, category: cat, image, description: desc, inStock: true,
      });

      existing.add(key);
      added++;
      found++;
      await sleep(10);
    }

    console.log(`${found} adicionados (Limite: ${limit})`);
    await sleep(400);
  }

  // Ordenação final
  const ORDER = { fraldas: 0, leites: 1, higiene: 2, acessorios: 3, roupas: 4, brinquedos: 5, moveis: 6 };
  db.products.sort((a, b) => {
    const d = (ORDER[a.category] ?? 9) - (ORDER[b.category] ?? 9);
    return d !== 0 ? d : (a.price || 0) - (b.price || 0);
  });

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');

  console.log('\n══════════════════════════════════════════');
  console.log(`  ✅  ${added} produtos extras adicionados!`);
  console.log(`  📦  Total: ${db.products.length} produtos no catálogo`);
  console.log('══════════════════════════════════════════\n');
}

main().catch(e => { console.error('Erro:', e.message); process.exit(1); });
