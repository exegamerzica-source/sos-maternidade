/**
 * Scraper Inteligente para O Mundo das Fraldas (Usando WooCommerce API)
 */
const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, 'db.json');

const API_URL = 'https://omundodasfraldas.com.br/wp-json/wc/store/products';

// Mapeamento de palavras-chave para as categorias do nosso sistema
const CATEGORY_MAP = [
  { keywords: ['fralda', 'roupinha pants', 'incontinência'], cat: 'fraldas' },
  { keywords: ['leite', 'fórmula', 'formula', 'nan', 'aptamil'], cat: 'leites' },
  { keywords: ['lenço', 'umedecido', 'pomada', 'assadura', 'sabonete', 'shampoo', 'colônia', 'talco', 'haste', 'algodão'], cat: 'higiene' },
  { keywords: ['mamadeira', 'chupeta', 'mordedor', 'aspirador', 'tira leite', 'bico'], cat: 'acessorios' }
];

function detectCategory(name, wpCategories) {
  const text = (name + ' ' + wpCategories.map(c => c.name).join(' ')).toLowerCase();
  for (const rule of CATEGORY_MAP) {
    if (rule.keywords.some(k => text.includes(k))) return rule.cat;
  }
  return 'acessorios'; // default
}

function cleanHTML(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim().substring(0, 250);
}

function normalizeName(name) {
  return name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-záàãâéêíóõôúç0-9 ]/gi, '').replace(/\s+/g, ' ').trim();
}

async function main() {
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const existingNames = new Set(db.products.map(p => normalizeName(p.name)));
  
  let added = 0;
  let page = 1;
  const maxPages = 5; // Puxar umas 5 páginas (50 produtos) focadas para não estourar

  console.log('\n══════════════════════════════════════════');
  console.log('  🌐 Extraindo de: O Mundo das Fraldas');
  console.log('══════════════════════════════════════════\n');

  while (page <= maxPages) {
    process.stdout.write(`  Buscando página ${page}... `);
    try {
      const res = await fetch(`${API_URL}?page=${page}&per_page=20`);
      if (!res.ok) break;
      const products = await res.json();
      if (!products || products.length === 0) break;

      let foundInPage = 0;
      for (const prod of products) {
        if (!prod.name || !prod.is_in_stock) continue;
        
        const normName = normalizeName(prod.name);
        if (existingNames.has(normName)) continue;

        // O preço vem em centavos como string, ex: "6500" para R$65,00
        const priceNum = parseFloat(prod.prices?.price) / 100;
        if (!priceNum || priceNum <= 0) continue;

        const image = prod.images?.[0]?.src || '';
        if (!image) continue;

        const category = detectCategory(prod.name, prod.categories || []);
        const desc = cleanHTML(prod.short_description || prod.description || '');

        db.products.push({
          id: `omf-${Date.now()}-${Math.random().toString(36).substring(2,7)}`,
          name: prod.name,
          category,
          price: priceNum,
          image,
          description: desc,
          inStock: true
        });

        existingNames.add(normName);
        added++;
        foundInPage++;
      }
      console.log(`${foundInPage} novos produtos adicionados`);
    } catch (e) {
      console.log(`Erro: ${e.message}`);
      break;
    }
    page++;
  }

  // Ordenação final
  const ORDER = { fraldas: 0, leites: 1, higiene: 2, acessorios: 3, roupas: 4, brinquedos: 5, moveis: 6 };
  db.products.sort((a, b) => {
    const d = (ORDER[a.category] ?? 9) - (ORDER[b.category] ?? 9);
    return d !== 0 ? d : (a.price || 0) - (b.price || 0);
  });

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');

  console.log('\n══════════════════════════════════════════');
  console.log(`  ✅ ${added} produtos inteligentemente extraídos!`);
  console.log(`  📦 Total no catálogo atual: ${db.products.length}`);
  console.log('══════════════════════════════════════════\n');
}

main();
