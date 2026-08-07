const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, 'db.json');

const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

let count = 0;
for (let p of db.products) {
  // Apenas aplica se ainda não tiver oldPrice para evitar aplicar desconto duplo se rodar 2x
  if (!p.oldPrice && p.price > 0) {
    p.oldPrice = p.price;
    p.price = Number((p.price * 0.78).toFixed(2));
    count++;
  }
}

fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');

console.log(`✅ Aplicado 22% de desconto em ${count} produtos!`);
