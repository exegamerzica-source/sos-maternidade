const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, 'db.json');

const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

const VTEX_API = 'https://www.paguemenos.com.br/api/catalog_system/pub/products/search';
const KWS = ['aptamil', 'nan', 'nestogeno', 'enfamil', 'ninho', 'milnutri', 'pregomin', 'neocate', 'similac', 'fórmula infantil'];

function normalizeName(name) {
  return name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-záàãâéêíóõôúç0-9 ]/gi, '').replace(/\s+/g, ' ').trim();
}

async function run() {
  const existingNames = new Set(db.products.map(p => normalizeName(p.name)));
  let added = 0;

  console.log('🚀 Buscando Fórmulas REAIS e de Alta Qualidade na Pague Menos (VTEX API)...');

  for (const kw of KWS) {
    try {
      // _from=0&_to=15 limitando pra não estourar e pegar só os mais relevantes de cada marca
      const url = `${VTEX_API}/${encodeURIComponent(kw)}?_from=0&_to=15`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const products = await res.json();
      
      for (const prod of products) {
        if (!prod.productName) continue;
        
        const normName = normalizeName(prod.productName);
        if (existingNames.has(normName)) continue;
        
        // VTEX structure
        const item = prod.items?.[0];
        if (!item) continue;
        const seller = item.sellers?.[0];
        const price = seller?.commertialOffer?.Price;
        if (!price || price <= 0) continue;
        
        const image = item.images?.[0]?.imageUrl || '';
        if (!image) continue;

        // Strict verification
        const n = prod.productName.toLowerCase();
        const isBad = ['mamadeira', 'chupeta', 'bico', 'tira', 'extrator', 'creme', 'fralda', 'lenço', 'sabonete', 'meia', 'absorvente', 'copo', 'prato'].some(b => n.includes(b));
        if (isBad) continue;

        const desc = (prod.description || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim().substring(0, 250);

        db.products.push({
          id: `pm-leite-${Date.now()}-${Math.random().toString(36).substring(2,7)}`,
          name: prod.productName,
          category: 'leites',
          price: price,
          image: image,
          description: desc,
          inStock: true
        });

        existingNames.add(normName);
        added++;
      }
    } catch(e) {
      console.log(`Erro no kw ${kw}`);
    }
  }

  console.log(`✅ Adicionados ${added} leites e fórmulas PUROS!`);

  // Re-sort
  const HIGH_URGENCY = ['fralda', 'nan', 'aptamil', 'fórmula', 'leite', 'nestogeno', 'enfamil'];
  const MED_URGENCY = ['lenço', 'mamadeira', 'tira leite', 'chupeta', 'pomada'];

  function getUrgency(p) {
      const text = (p.name + ' ' + (p.description || '')).toLowerCase();
      if (HIGH_URGENCY.some(k => text.includes(k))) return 100;
      if (MED_URGENCY.some(k => text.includes(k))) return 50;
      return 0;
  }

  const CAT_ORDER = { fraldas: 0, leites: 1, higiene: 2, acessorios: 3, roupas: 4, brinquedos: 5, moveis: 6 };
  db.products.sort((a, b) => {
    const scoreA = getUrgency(a);
    const scoreB = getUrgency(b);
    if (scoreA !== scoreB) return scoreB - scoreA;
    const catA = CAT_ORDER[a.category] ?? 9;
    const catB = CAT_ORDER[b.category] ?? 9;
    if (catA !== catB) return catA - catB;
    return (b.price || 0) - (a.price || 0);
  });

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  
  const stats = {};
  db.products.forEach(p => { stats[p.category] = (stats[p.category] || 0) + 1; });
  console.table(stats);
}

run();
