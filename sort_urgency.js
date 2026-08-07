const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, 'db.json');

const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

// Keywords que definem altíssima urgência (desespero de madrugada)
const HIGH_URGENCY = [
  'fralda', 'pants', 'roupinha', // Fraldas que acabam
  'nan', 'aptamil', 'fórmula', 'leite', 'nestogeno', // Bebê com fome
  'termômetro', 'aspirador', 'soro', // Bebê doente/entupido
  'chupeta', 'bico', // Bebê chorando muito
  'pomada', 'assadura', 'bepantol', 'desitin' // Dor de assadura
];

// Keywords de média urgência
const MED_URGENCY = [
  'lenço', 'umedecido', 'toalha umedecida',
  'mamadeira', 'tira leite', 'extrator',
  'sabonete', 'shampoo', 'higiene'
];

function getUrgencyScore(product) {
  const text = (product.name + ' ' + (product.description || '')).toLowerCase();
  
  // Se bater com alta urgência, ganha 100 pontos
  if (HIGH_URGENCY.some(kw => text.includes(kw))) return 100;
  
  // Se bater com média urgência, ganha 50 pontos
  if (MED_URGENCY.some(kw => text.includes(kw))) return 50;
  
  // Produtos normais
  return 0;
}

// Ordem das categorias (fallback)
const CAT_ORDER = { fraldas: 0, leites: 1, higiene: 2, acessorios: 3, roupas: 4, brinquedos: 5, moveis: 6 };

db.products.sort((a, b) => {
  const scoreA = getUrgencyScore(a);
  const scoreB = getUrgencyScore(b);
  
  // 1. Ordena pela pontuação de urgência (maior na frente)
  if (scoreA !== scoreB) {
    return scoreB - scoreA;
  }
  
  // 2. Se a urgência for igual, ordena pela categoria principal
  const catA = CAT_ORDER[a.category] ?? 9;
  const catB = CAT_ORDER[b.category] ?? 9;
  if (catA !== catB) {
    return catA - catB;
  }
  
  // 3. Se empatar, os mais baratos primeiro (decisão de compra mais rápida)
  return (a.price || 0) - (b.price || 0);
});

fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');

console.log('✅ Catálogo reordenado com foco MÁXIMO em urgência!');
