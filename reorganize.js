/**
 * SOS Maternidade — Reorganizador de Catálogo
 * - Remove produtos de teste (imagens picsum.photos)
 * - Remove produtos fora do nicho maternidade (roupas, berços, brinquedos, móveis)
 * - Limpa HTML entities das descrições
 * - Recategoriza tudo com regras detalhadas
 * - Remove preços zerados (inúteis para o cliente)
 * - Deduplicação por nome normalizado
 * - Ordena por categoria e depois por preço
 */

const fs   = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, 'db.json');

// ── Categorias do SOS Maternidade ─────────────────────────
const CATEGORIES = {
  fraldas:    'fraldas',
  leites:     'leites',
  higiene:    'higiene',
  acessorios: 'acessorios',
};

// ── Regras de categorização (ordem importa) ───────────────
const CATEGORY_RULES = [
  // FRALDAS
  { patterns: [/fralda/i, /lenço\s*umed/i, /wipes?/i, /fraldinha/i], cat: 'fraldas' },

  // LEITES & FÓRMULAS
  { patterns: [/fórmula|formula/i, /\bnan\b/i, /aptamil/i, /nestogeno/i, /nestlé\s*beb/i,
               /leite\s*(infantil|em\s*pó|materno|especial)/i, /nutrilon/i, /enfamil/i,
               /similac/i, /frisolac/i, /illuma/i, /novalac/i], cat: 'leites' },

  // HIGIENE & SAÚDE
  { patterns: [/pomada|bepantol|assadura/i, /shampoo|condicion/i, /sabonete/i,
               /creme\s*(hid|nutr|corporal|facial|de\s*banho)/i, /loção|locao/i,
               /termômetro|termometro/i, /nebulizador|inalador/i, /soro\s*fisiol/i,
               /álcool\s*gel|alcool\s*gel/i, /algodão|algodao/i, /hastes\s*flex/i,
               /absorvente/i, /toalha\s*(banho|capuz)/i, /banheira/i,
               /kit\s*higiene|higiene\s*kit/i, /escova\s*(dente|cabelo)/i,
               /pente\s*beb/i, /cortador\s*de\s*unha/i, /lanolina/i,
               /protetor\s*solar/i, /repelente/i, /sabonet/i], cat: 'higiene' },

  // ACESSÓRIOS (tudo que é legítimo para maternidade mas não se encaixa acima)
  { patterns: [/mamadeira/i, /chupeta/i, /mordedor/i, /porta[\s-]?chupeta/i,
               /steriliz|esteriliz/i, /aquecedor\s*de\s*(mamadeira|leite)/i,
               /babá\s*eletrônica|monitor\s*beb/i, /carrinho/i, /passeio/i,
               /mochila\s*canguru/i, /wrap|sling/i, /assento\s*de\s*carro|cadeirinha/i,
               /cinto\s*de\s*segurança/i, /extrator\s*de\s*leite|bombinha/i,
               /protetor\s*de\s*seio/i, /almofada\s*(amament|de\s*gravidez)/i,
               /sutiã\s*(amament|mater)|sutia\s*(amament|mater)/i,
               /cinta\s*pós[\s-]?parto|cinta\s*gestante/i,
               /meia\s*(antivari|compre)/i, /kit\s*(maternidade|beb[eê])/i,
               /bolsa\s*(maternidade|hospital)/i, /travesseiro\s*beb/i,
               /lençol\s*beb/i, /xarope|gripe|febre|col[ií]ica|simethicona/i,
               /lanterna\s*auricular|otoscópio/i, /aspirador\s*nasal/i,
               /porta[\s-]?bebê|bebê\s*conforto/i], cat: 'acessorios' },
];

// ── Produtos FORA do nicho (remover) ─────────────────────
// Roupas, brinquedos grandes, móveis, cama, decoração...
const OUT_OF_SCOPE = [
  /\bmacac[aã]o\b/i,
  /\bbody\s*(espacial|c[oó]s|manga|estampa)/i,
  /\bconjunto\s*(body|roupinha|suedine)/i,
  /\bberço\b/i,
  /cobertor\s*(premium|pelo|alto)/i,
  /\bcadeira\s*de\s*balan/i,
  /\bnaninha\s*bichinho/i,       // bichinho de pelúcia genérico
  /\bmóbile\b/i,
  /\bfantasia\b/i,
  /\bpajama|pijama\b/i,
  /\btijolo\s*(de\s*espuma|brinc)/i,
  /\bcercado\b/i,
  /\bsofá\b/i,
  /\bcolch[aã]o\b/i,
  /\bmesa\s*(de\s*troca|fraldário)\b/i,  // ok manter se for portátil
  /\bguarda[\s-]?roupa\b/i,
  /\bcômoda\b/i,
  /\btape[cç]aria|tapete\s*(decorat|quarto)/i,
  /\blustre\b/i,
  /\bprateleira\b/i,
];

// ── Filtro: manter apenas se for produto de maternidade ───
// Se o nome tem alguma keyword útil → mantém
const IN_SCOPE_OVERRIDE = [
  /fralda/i, /lenço|lenco/i, /pomada/i, /bepantol/i, /creme/i,
  /shampoo/i, /sabonete/i, /termômetro|termometro/i, /soro/i,
  /nebulizador|inalador/i, /mamadeira/i, /chupeta/i, /mordedor/i,
  /steriliz|esteriliz/i, /leite\s*infantil|fórmula|formula/i,
  /\bnan\b/i, /aptamil/i, /nestogeno/i, /nutrilon/i, /enfamil/i,
  /carrinho\s*(de\s*beb|passeio)/i, /cadeirinha\s*(carro|auto)/i,
  /almofada\s*(amament|gestante|gravid)/i, /cinta\s*(gest|pós)/i,
  /extrator|bombinha/i, /aspirador\s*nasal/i, /kit\s*(maternidade|higiene)/i,
  /bolsa\s*maternidade/i, /abafador\s*de\s*ruído/i, /berço\s*(portátil|viagem)/i,
  /toalha\s*capuz/i, /banheira/i, /algodão\s*beb/i, /protetor\s*solar\s*beb/i,
  /fraldário/i, /sutiã|sutia/i, /cobertor\s*beb/i,
];

// ── Limpa HTML entities e HTML tags ──────────────────────
function cleanText(str) {
  if (!str) return '';
  return str
    .replace(/<[^>]+>/g, ' ')
    .replace(/&atilde;/g, 'ã').replace(/&otilde;/g, 'õ')
    .replace(/&eacute;/g, 'é').replace(/&aacute;/g, 'á')
    .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú')
    .replace(/&iacute;/g, 'í').replace(/&ccedil;/g, 'ç')
    .replace(/&Atilde;/g, 'Ã').replace(/&Otilde;/g, 'Õ')
    .replace(/&acirc;/g, 'â').replace(/&ecirc;/g, 'ê')
    .replace(/&ocirc;/g, 'ô').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim()
    .substring(0, 220);
}

// ── Detectar categoria ────────────────────────────────────
function detectCategory(name, existingCat) {
  const haystack = name;
  for (const { patterns, cat } of CATEGORY_RULES) {
    if (patterns.some(p => p.test(haystack))) return cat;
  }
  // Se não bateu em nenhuma regra específica, mantém acessorios
  return 'acessorios';
}

// ── Verificar se está no nicho ────────────────────────────
function isInScope(name) {
  // Se explicitamente fora → remove
  if (OUT_OF_SCOPE.some(p => p.test(name))) {
    // Mas verifica override primeiro
    if (IN_SCOPE_OVERRIDE.some(p => p.test(name))) return true;
    return false;
  }
  return true; // por padrão mantém
}

// ── Normalizar nome para dedup ────────────────────────────
function normalizeName(name) {
  return name.toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, '')   // remove texto entre parênteses
    .replace(/[^a-záàãâéêíóõôúç0-9 ]/gi, '')
    .replace(/\s+/g, ' ').trim();
}

// ── Imagem válida ─────────────────────────────────────────
function isTestImage(url) {
  return !url || url.includes('picsum.photos') || url.includes('placeholder');
}

// ── Main ──────────────────────────────────────────────────
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
const original = db.products.length;

console.log('\n══════════════════════════════════════════');
console.log('  🔧  SOS Maternidade — Reorganizador');
console.log('══════════════════════════════════════════');
console.log(`  📦  Produtos antes: ${original}`);
console.log('──────────────────────────────────────────\n');

const seen   = new Set();
const kept   = [];
let removedTest  = 0;
let removedScope = 0;
let removedPrice = 0;
let removedDedup = 0;
let recategorized = 0;
let cleaned   = 0;

for (const p of db.products) {
  const name = (p.name || '').trim();
  if (!name) continue;

  // 1. Remove produtos de teste (imagem picsum)
  if (isTestImage(p.image)) {
    console.log(`  🗑 [TESTE]      ${name}`);
    removedTest++;
    continue;
  }

  // 2. Remove produtos fora do nicho
  if (!isInScope(name)) {
    console.log(`  🗑 [FORA NICHO] ${name}`);
    removedScope++;
    continue;
  }

  // 3. Remove produtos sem preço
  if (!p.price || p.price <= 0) {
    console.log(`  🗑 [SEM PREÇO]  ${name}`);
    removedPrice++;
    continue;
  }

  // 4. Deduplicação
  const key = normalizeName(name);
  if (seen.has(key)) {
    console.log(`  🗑 [DUPLICATA]  ${name}`);
    removedDedup++;
    continue;
  }
  seen.add(key);

  // 5. Recategorizar
  const newCat = detectCategory(name, p.category);
  if (newCat !== p.category) {
    console.log(`  🔄 [CATEG] ${p.category} → ${newCat} | ${name}`);
    recategorized++;
    p.category = newCat;
  }

  // 6. Limpar descrição
  const cleanedDesc = cleanText(p.description || '');
  if (cleanedDesc !== (p.description || '')) cleaned++;
  p.description = cleanedDesc;

  // 7. Garantir inStock como boolean
  p.inStock = p.inStock !== false;

  kept.push(p);
}

// ── Ordenar: por categoria, depois por preço ascendente ──
const ORDER = { fraldas: 0, leites: 1, higiene: 2, acessorios: 3 };
kept.sort((a, b) => {
  const catDiff = (ORDER[a.category] ?? 9) - (ORDER[b.category] ?? 9);
  if (catDiff !== 0) return catDiff;
  return (a.price || 0) - (b.price || 0);
});

// ── Salva ─────────────────────────────────────────────────
db.products = kept;
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');

// ── Estatísticas por categoria ────────────────────────────
const stats = { fraldas: 0, leites: 0, higiene: 0, acessorios: 0 };
kept.forEach(p => { if (stats[p.category] !== undefined) stats[p.category]++; });

console.log('\n══════════════════════════════════════════');
console.log(`  ✅  Catálogo reorganizado!`);
console.log('──────────────────────────────────────────');
console.log(`  Antes:         ${original} produtos`);
console.log(`  Removidos`);
console.log(`    🗑 Testes:   ${removedTest}`);
console.log(`    🗑 Fora nicho: ${removedScope}`);
console.log(`    🗑 Sem preço: ${removedPrice}`);
console.log(`    🗑 Duplicatas: ${removedDedup}`);
console.log(`  🔄 Recategorizados: ${recategorized}`);
console.log(`  🧹 Descrições limpas: ${cleaned}`);
console.log('──────────────────────────────────────────');
console.log(`  RESULTADO:     ${kept.length} produtos`);
console.log(`    👶 Fraldas:     ${stats.fraldas}`);
console.log(`    🍼 Leites:      ${stats.leites}`);
console.log(`    🧴 Higiene:     ${stats.higiene}`);
console.log(`    🎒 Acessórios:  ${stats.acessorios}`);
console.log('══════════════════════════════════════════\n');
