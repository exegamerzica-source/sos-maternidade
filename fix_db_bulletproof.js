const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, 'db.json');

const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

// Strict inclusion and exclusion for Leites
const LEITE_EXACT = ['aptamil', 'nan', 'nestogeno', 'enfamil', 'ninho', 'milnutri', 'pregomin', 'neocate', 'similac', 'infatrini', 'nutren', 'composto lácteo', 'leite em pó', 'fórmula infantil', 'formula infantil'];

const LEITE_EXCLUDE = ['tira', 'extrator', 'dosador', 'recipiente', 'pote', 'copo', 'mamadeira', 'bico', 'chupeta', 'meia', 'creme', 'pomada', 'lenço', 'toalha', 'sabonete', 'shampoo', 'óleo', 'colônia', 'talco', 'absorvente', 'fralda', 'pano', 'protetor', 'concha', 'bomba', 'saco'];

function isRealMilk(name) {
    const n = name.toLowerCase();
    // Must contain a milk brand/keyword
    const hasMilk = LEITE_EXACT.some(kw => n.includes(kw));
    if (!hasMilk) return false;
    
    // Must NOT contain accessories or hygiene keywords
    const hasBad = LEITE_EXCLUDE.some(kw => n.includes(kw));
    if (hasBad) return false;
    
    return true;
}

// 1. First, correct miscategorized items
for (let p of db.products) {
    if (p.category === 'leites') {
        if (!isRealMilk(p.name)) {
            // Reassign to correct category
            const n = p.name.toLowerCase();
            if (n.includes('tira') || n.includes('extrator') || n.includes('dosador') || n.includes('mamadeira') || n.includes('copo') || n.includes('bico')) {
                p.category = 'acessorios';
            } else if (n.includes('creme') || n.includes('pomada') || n.includes('óleo') || n.includes('toalha') || n.includes('lenço')) {
                p.category = 'higiene';
            } else if (n.includes('meia') || n.includes('touca') || n.includes('luva') || n.includes('sapatinho')) {
                p.category = 'roupas';
            } else {
                p.category = 'acessorios'; // Fallback
            }
        }
    }
}

// 2. Double check if any actual milks are hiding in other categories
for (let p of db.products) {
    if (p.category !== 'leites' && isRealMilk(p.name)) {
        p.category = 'leites';
    }
}

fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');

const stats = {};
db.products.forEach(p => { stats[p.category] = (stats[p.category] || 0) + 1; });
console.log('✅ Banco de dados corrigido a prova de erros!');
console.table(stats);
