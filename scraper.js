/**
 * SOS Maternidade — Scraper de produtos
 * Fonte: alobebe.com.br (VTEX)
 *
 * Uso: node scraper.js [--limit=100] [--categoria=fraldas]
 * Importa os produtos direto no db.json.
 */

const fs   = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');

// ── Configurações ──────────────────────────────────────────
const BASE_URL  = 'https://www.alobebe.com.br';
const PAGE_SIZE = 49;   // máximo da API VTEX

// Mapeia categorias do site para os slugs do SOS Maternidade
const CATEGORY_MAP = [
  { pattern: /fralda/i,               slug: 'fraldas'    },
  { pattern: /leite|fórmula|formula|nan|aptamil|nestlé|nutrilon/i, slug: 'leites'     },
  { pattern: /higiene|saúde|saude|pomada|creme|shampoo|sabonete|lenço|lenco|termômetro|termometro|nebulizador/i, slug: 'higiene' },
  { pattern: /.*/,                    slug: 'acessorios' },   // fallback
];

const HEADERS = {
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer':         BASE_URL,
};

// ── Helpers ────────────────────────────────────────────────
function detectCategory(product) {
  const haystack = [
    product.productName,
    ...(product.categories || []),
  ].join(' ');

  for (const { pattern, slug } of CATEGORY_MAP) {
    if (pattern.test(haystack)) return slug;
  }
  return 'acessorios';
}

function extractPrice(product) {
  try {
    const item = product.items?.[0];
    const seller = item?.sellers?.[0];
    return seller?.commertialOffer?.Price || seller?.commertialOffer?.ListPrice || 0;
  } catch { return 0; }
}

function extractImage(product) {
  try {
    const img = product.items?.[0]?.images?.[0];
    if (!img) return '';
    // Pega a URL original (sem resize) para melhor qualidade
    return (img.imageUrl || '').replace(/-\d+(-\d+)?\.jpg/, '.jpg').split('?')[0];
  } catch { return ''; }
}

function cleanDescription(html) {
  return (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Fetcher com retry ──────────────────────────────────────
async function fetchProducts(from, to) {
  const url = `${BASE_URL}/api/catalog_system/pub/products/search?_from=${from}&_to=${to}&O=OrderByTopSaleDESC`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      // VTEX retorna 206 Partial Content — tudo bem, há dados
      if (res.status === 200 || res.status === 206) {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }
      console.warn(`  ⚠ HTTP ${res.status} na página ${from}-${to}, tentativa ${attempt}/3`);
    } catch (e) {
      console.warn(`  ⚠ Erro na tentativa ${attempt}/3:`, e.message);
    }
    await sleep(1500 * attempt);
  }
  return [];
}

// ── Main ───────────────────────────────────────────────────
async function main() {
  // Parse args
  const args     = Object.fromEntries(process.argv.slice(2).map(a => a.replace('--','').split('=')));
  const maxItems = parseInt(args.limit || '200', 10);

  console.log('\n══════════════════════════════════════════');
  console.log('  🔍  SOS Maternidade — Scraper Alo Bebê');
  console.log('══════════════════════════════════════════');
  console.log(`  URL:    ${BASE_URL}`);
  console.log(`  Limite: ${maxItems} produtos`);
  console.log('══════════════════════════════════════════\n');

  // Lê db.json atual
  let db;
  try {
    db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    console.error('❌ Não encontrei db.json em:', DB_PATH);
    process.exit(1);
  }

  const existingNames = new Set(db.products.map(p => p.name.toLowerCase().trim()));

  // Coleta produtos em páginas
  const scraped = [];
  let page = 0;

  while (scraped.length < maxItems) {
    const from = page * PAGE_SIZE;
    const to   = from + PAGE_SIZE;

    process.stdout.write(`  📦 Coletando produtos ${from}–${to}… `);
    const batch = await fetchProducts(from, to);

    if (!batch.length) {
      console.log('fim do catálogo.');
      break;
    }

    scraped.push(...batch);
    console.log(`✓ ${batch.length} recebidos (total: ${scraped.length})`);

    if (batch.length < PAGE_SIZE) break;  // última página
    page++;
    await sleep(600);   // respeita rate-limit
  }

  console.log(`\n  🔄 Processando ${scraped.length} produtos…`);

  // Converte para o formato do SOS Maternidade
  let added   = 0;
  let skipped = 0;
  let noPrice = 0;

  for (const raw of scraped) {
    if (added >= maxItems) break;

    const name  = (raw.productName || '').trim();
    const price = extractPrice(raw);
    const image = extractImage(raw);
    const desc  = cleanDescription(raw.description || raw.metaTagDescription || '');
    const cat   = detectCategory(raw);

    if (!name) { skipped++; continue; }

    // Evita duplicatas por nome
    if (existingNames.has(name.toLowerCase())) {
      skipped++;
      continue;
    }

    if (price === 0) noPrice++;

    const product = {
      id:          `scraped-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      name,
      price,
      category:    cat,
      image,
      description: desc,
      inStock:     true,
    };

    db.products.push(product);
    existingNames.add(name.toLowerCase());
    added++;

    // Pequeno delay visual
    await sleep(5);
  }

  // Salva db.json
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');

  // Relatório final
  console.log('\n══════════════════════════════════════════');
  console.log(`  ✅  ${added} produtos importados!`);
  if (skipped > 0)  console.log(`  ⏭  ${skipped} ignorados (duplicatas ou sem nome)`);
  if (noPrice > 0)  console.log(`  ⚠   ${noPrice} produtos sem preço (R$ 0,00 — edite no admin)`);
  console.log(`  📦  Total no catálogo: ${db.products.length} produtos`);
  console.log('══════════════════════════════════════════\n');
  console.log('  🔄  Reinicie o servidor (Ctrl+C e node server.js) para ver os novos produtos.\n');
}

main().catch(e => {
  console.error('\n❌ Erro fatal:', e.message);
  process.exit(1);
});
