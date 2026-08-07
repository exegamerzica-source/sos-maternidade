const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');

// Pega o db.json do primeiro commit (antes de reorganizarmos)
const oldDbStr = execSync('git show HEAD:db.json', { encoding: 'utf-8' });
const oldDb = JSON.parse(oldDbStr);

const currentDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
const existingNames = new Set(currentDb.products.map(p => p.name.toLowerCase().trim()));

const rules = [
  { keywords: ['macacão', 'body', 'pijama', 'roupa'], cat: 'roupas', limit: 8 },
  { keywords: ['berço', 'cômoda', 'colchão', 'cadeira de balanço'], cat: 'moveis', limit: 6 },
  { keywords: ['urso', 'pelúcia', 'brinquedo', 'naninha', 'móbile'], cat: 'brinquedos', limit: 6 }
];

let restored = 0;
const counts = { roupas: 0, moveis: 0, brinquedos: 0 };

for (const oldProd of oldDb.products) {
  const name = oldProd.name.toLowerCase();
  
  if (existingNames.has(name)) continue;

  for (const rule of rules) {
    if (counts[rule.cat] >= rule.limit) continue;
    
    if (rule.keywords.some(kw => name.includes(kw))) {
      oldProd.category = rule.cat;
      oldProd.id = `restored-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      currentDb.products.push(oldProd);
      existingNames.add(name);
      counts[rule.cat]++;
      restored++;
      break; // move to next product
    }
  }
}

fs.writeFileSync(DB_PATH, JSON.stringify(currentDb, null, 2), 'utf8');

console.log(`\n✅ ${restored} produtos restaurados!`);
console.log(`   👗 Roupas: ${counts.roupas} (macacões, pijamas)`);
console.log(`   🪑 Móveis: ${counts.moveis} (berços, colchões)`);
console.log(`   🧸 Brinquedos: ${counts.brinquedos} (ursos, naninhas)`);
console.log(`\n📦 Total no catálogo atual: ${currentDb.products.length}\n`);
