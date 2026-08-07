/**
 * Busca produtos específicos de maternidade na Alo Bebê:
 * fraldas, fórmulas, higiene bebê
 */
const fs   = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, 'db.json');

const BASE_URL = 'https://www.alobebe.com.br';
const HEADERS  = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
};

// Termos de busca focados no nicho
const SEARCH_TERMS = [
  'fralda',
  'formula+infantil',
  'nan',
  'aptamil',
  'nestogeno',
  'huggies',
  'pampers',
  'pompom',
  'babysec',
  'lenco+umedecido',
  'pomada+assadura',
  'bepantol',
  'shampoo+bebe',
  'sabonete+bebe',
  'creme+bebe',
  'soro+nasal',
  'termometro',
  'aspirador+nasal',
  'mamadeira',
  'chupeta',
  'esterilizador',
  'extrator+leite',
  'mordedor',
  'sutiã+amamentacao',
  'cinta+gestante',
  'almofada+amamentacao',
  'carrinho+bebe',
  'bebê+conforto',
  'kit+maternidade',
];

function extractPrice(product) {
  try {
    return product.items?.[0]?.sellers?.[0]?.commertialOffer?.Price || 0;
  } catch { return 0; }
}

function extractImage(product) {
  try {
    const url = product.items?.[0]?.images?.[0]?.imageUrl || '';
    return url.split('?')[0];
  } catch { return ''; }
}

function cleanText(str) {
  if (!str) return '';
  return str
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ').trim()
    .substring(0, 220);
}

const CATEGORY_RULES = [
  { patterns: [/fralda/i, /lenço\s*umed|lenco\s*umed/i, /wipes?/i], cat: 'fraldas' },
  { patterns: [/fórmula|formula/i, /\bnan\b/i, /aptamil/i, /nestogeno/i, /nutrilon/i, /enfamil/i, /leite\s*(infantil|em\s*pó)/i], cat: 'leites' },
  { patterns: [/pomada|bepantol|assadura/i, /shampoo|condicion/i, /sabonete/i, /creme\s*(hid|nutr|corporal)/i, /loção|locao/i, /termômetro|termometro/i, /nebulizador|inalador/i, /soro\s*fisiol/i, /algodão\s*beb/i, /aspirador\s*nasal/i, /absorvente\s*(seio|mama)/i], cat: 'higiene' },
  { patterns: [/mamadeira/i, /chupeta/i, /mordedor/i, /steriliz|esteriliz/i, /extrator|bombinha\s*leite/i, /almofada\s*(amament|gestante)/i, /sutiã|sutia/i, /cinta\s*(gest|pós)/i, /carrinho/i, /cadeirinha/i, /bebê\s*conforto/i, /kit\s*maternidade/i], cat: 'acessorios' },
];

function detectCategory(name) {
  for (const { patterns, cat } of CATEGORY_RULES) {
    if (patterns.some(p => p.test(name))) return cat;
  }
  return 'acessorios';
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
  console.log('  🔍  Buscando produtos específicos...');
  console.log('══════════════════════════════════════════\n');

  for (const term of SEARCH_TERMS) {
    process.stdout.write(`  Buscando "${term}"... `);
    const results = await searchProducts(term);
    let found = 0;

    for (const raw of results) {
      const name  = (raw.productName || '').trim();
      if (!name) continue;
      const key = normalizeName(name);
      if (existing.has(key)) continue;

      const price = extractPrice(raw);
      if (price <= 0) continue;

      const image = extractImage(raw);
      if (!image) continue;

      const cat = detectCategory(name);
      const desc = cleanText(raw.description || raw.metaTagDescription || '');

      db.products.push({
        id:          `spec-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        name, price, category: cat, image, description: desc, inStock: true,
      });

      existing.add(key);
      added++;
      found++;
      await sleep(10);
    }

    console.log(`${found} novos`);
    await sleep(400);
  }

  // Re-ordena tudo
  const ORDER = { fraldas: 0, leites: 1, higiene: 2, acessorios: 3 };
  db.products.sort((a, b) => {
    const d = (ORDER[a.category] ?? 9) - (ORDER[b.category] ?? 9);
    return d !== 0 ? d : (a.price || 0) - (b.price || 0);
  });

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');

  const stats = { fraldas: 0, leites: 0, higiene: 0, acessorios: 0 };
  db.products.forEach(p => { if (stats[p.category] !== undefined) stats[p.category]++; });

  console.log('\n══════════════════════════════════════════');
  console.log(`  ✅  ${added} produtos específicos adicionados!`);
  console.log(`  📦  Total: ${db.products.length} produtos`);
  console.log(`    👶 Fraldas:    ${stats.fraldas}`);
  console.log(`    🍼 Leites:     ${stats.leites}`);
  console.log(`    🧴 Higiene:    ${stats.higiene}`);
  console.log(`    🎒 Acessórios: ${stats.acessorios}`);
  console.log('══════════════════════════════════════════\n');
}

main().catch(e => { console.error('Erro:', e.message); process.exit(1); });
