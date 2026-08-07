const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, 'db.json');

const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

// Categorias urgentes (manter todos)
const URGENT_CATS = ['fraldas', 'leites', 'higiene'];
// Categorias extras já limitadas (manter todos)
const LIMITED_CATS = ['roupas', 'moveis', 'brinquedos'];

// Acessórios são muitos (~400). Vamos manter todos os urgentes dentro de acessórios
const URGENT_ACCESSORY_KWS = ['mamadeira', 'chupeta', 'tira leite', 'bomba', 'bico', 'termômetro', 'aspirador'];

let finalProducts = [];
let acessoriosCount = 0;
const MAX_GENERIC_ACCESSORIES = 40; // Manter no máximo 40 acessórios genéricos para "dar volume"

for (const p of db.products) {
  if (URGENT_CATS.includes(p.category) || LIMITED_CATS.includes(p.category)) {
    finalProducts.push(p);
  } else if (p.category === 'acessorios') {
    const nameLower = p.name.toLowerCase();
    const isUrgent = URGENT_ACCESSORY_KWS.some(kw => nameLower.includes(kw));
    
    if (isUrgent) {
      finalProducts.push(p);
    } else {
      if (acessoriosCount < MAX_GENERIC_ACCESSORIES) {
        finalProducts.push(p);
        acessoriosCount++;
      }
    }
  }
}

// Re-ordena o catálogo para que a urgência fique no topo, e os extras no fim
const ORDER = { fraldas: 0, leites: 1, higiene: 2, acessorios: 3, roupas: 4, brinquedos: 5, moveis: 6 };
finalProducts.sort((a, b) => {
  const d = (ORDER[a.category] ?? 9) - (ORDER[b.category] ?? 9);
  return d !== 0 ? d : (b.price || 0) - (a.price || 0); // Preço maior na frente dentro da cat, só pra mesclar
});

db.products = finalProducts;
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');

const stats = {};
db.products.forEach(p => { stats[p.category] = (stats[p.category] || 0) + 1; });

console.log(`\n✅ Catálogo rebalanceado com sucesso!`);
console.log(`📦 Novo Total: ${db.products.length} produtos focados em urgência.`);
console.table(stats);
