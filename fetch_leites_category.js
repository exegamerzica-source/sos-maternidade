const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, 'db.json');

const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
const API_URL = 'https://omundodasfraldas.com.br/wp-json/wc/store/products';

function normalizeName(name) {
  return name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-záàãâéêíóõôúç0-9 ]/gi, '').replace(/\s+/g, ' ').trim();
}

async function fetchLeitesPorCategoria() {
  const existingNames = new Set(db.products.map(p => normalizeName(p.name)));
  let added = 0;

  console.log('Buscando Leites diretamente da Categoria 753 (Leite Infantil)...');

  let page = 1;
  let keepGoing = true;

  while (keepGoing && page <= 5) {
    try {
      const res = await fetch(`${API_URL}?category=753&per_page=30&page=${page}`);
      if (!res.ok) { keepGoing = false; break; }
      const products = await res.json();
      
      if (!products || products.length === 0) { keepGoing = false; break; }

      for (const prod of products) {
        if (!prod.name || !prod.is_in_stock) continue;
        
        const normName = normalizeName(prod.name);
        if (existingNames.has(normName)) continue;

        const priceNum = parseFloat(prod.prices?.price) / 100;
        if (!priceNum || priceNum <= 0) continue;

        const image = prod.images?.[0]?.src || '';
        if (!image) continue;

        const desc = (prod.short_description || prod.description || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim().substring(0, 250);

        db.products.push({
          id: `omf-cat753-${Date.now()}-${Math.random().toString(36).substring(2,7)}`,
          name: prod.name,
          category: 'leites',
          price: priceNum,
          image,
          description: desc,
          inStock: true
        });

        existingNames.add(normName);
        added++;
      }
      page++;
    } catch (e) {
      console.log(`Fim das páginas na página ${page}`);
      keepGoing = false;
    }
  }

  console.log(`Adicionados ${added} leites EXATOS da categoria.`);

  // Cortar acessórios genéricos para manter o balanço que o usuário queria
  // Atualmente tem 228 acessórios, vamos cortar para uns 60
  
  const HIGH_URGENCY = ['fralda', 'pants', 'roupinha', 'nan', 'aptamil', 'fórmula', 'leite', 'nestogeno', 'termômetro', 'aspirador', 'soro', 'chupeta', 'bico', 'pomada', 'assadura', 'bepantol'];
  const MED_URGENCY = ['lenço', 'umedecido', 'mamadeira', 'tira leite', 'extrator', 'sabonete', 'shampoo', 'higiene'];

  function getUrgency(p) {
      const text = (p.name + ' ' + (p.description || '')).toLowerCase();
      if (HIGH_URGENCY.some(k => text.includes(k))) return 100;
      if (MED_URGENCY.some(k => text.includes(k))) return 50;
      return 0;
  }

  let finalProducts = [];
  let genericAccCount = 0;
  
  for(let p of db.products) {
      if (p.category !== 'acessorios') {
          finalProducts.push(p);
      } else {
          // Acessórios
          if (getUrgency(p) > 0) {
              finalProducts.push(p);
          } else if (genericAccCount < 40) {
              finalProducts.push(p);
              genericAccCount++;
          }
      }
  }
  
  db.products = finalProducts;

  // Re-sort final pra interface
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

fetchLeitesPorCategoria();
