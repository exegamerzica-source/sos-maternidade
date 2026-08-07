const fs = require('fs');
const path = require('path');

const p = (file) => path.join(__dirname, file);

// 1. Update index.html
let html = fs.readFileSync(p('public/index.html'), 'utf8');
html = html.replace(/SOS Maternidade/g, 'BabyFlash');
html = html.replace(/<title>.*?<\/title>/g, '<title>BabyFlash — Delivery Expresso</title>');
html = html.replace(/content="#e11d48"/g, 'content="#38bdf8"');
html = html.replace(/bg-rose-50/g, 'bg-sky-50');
html = html.replace(/from-red-700 via-red-600 to-rose-600/g, 'from-sky-500 via-sky-400 to-teal-400');
html = html.replace(/text-red-600/g, 'text-sky-600');
html = html.replace(/bg-rose-100/g, 'bg-sky-100');
html = html.replace(/border-rose-100/g, 'border-sky-100');
html = html.replace(/text-rose-600/g, 'text-sky-600');
html = html.replace(/text-rose-400/g, 'text-sky-400');
html = html.replace(/text-rose-500/g, 'text-sky-500');
html = html.replace(/text-rose-700/g, 'text-sky-700');
html = html.replace(/bg-rose-600/g, 'bg-sky-500');
html = html.replace(/hover:bg-rose-100/g, 'hover:bg-sky-100');
html = html.replace(/ring-rose-500/g, 'ring-sky-500');
html = html.replace(/from-rose-600 to-rose-500/g, 'from-sky-500 to-teal-400');
html = html.replace(/hover:bg-rose-700/g, 'hover:bg-sky-600');

// Replace the text logo with image logo
const oldLogo = `<div class="w-9 h-9 rounded-full bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-md">
        <span class="text-lg">🍼</span>
      </div>`;
const newLogo = `<img src="/assets/logo.png" alt="BabyFlash Logo" class="w-10 h-10 object-contain" />`;
html = html.replace(oldLogo, newLogo);

// Replace the emergency text
html = html.replace('🚨 PLANTÃO SOS MATERNIDADE', '⚡ DELIVERY BABYFLASH');

fs.writeFileSync(p('public/index.html'), html);

// 2. Update app.js
let js = fs.readFileSync(p('public/js/app.js'), 'utf8');
js = js.replace(/SOS Maternidade/g, 'BabyFlash');
js = js.replace(/bg-rose-50/g, 'bg-sky-50');
js = js.replace(/text-rose-600/g, 'text-sky-600');
js = js.replace(/from-rose-600 to-rose-500/g, 'from-sky-500 to-teal-400');
fs.writeFileSync(p('public/js/app.js'), js);

// 3. Update style.css
let css = fs.readFileSync(p('public/css/style.css'), 'utf8');
css = css.replace(/SOS Maternidade/g, 'BabyFlash');
css = css.replace(/#e11d48/g, '#0ea5e9'); // sky-500
css = css.replace(/rgba\(225, 29, 72/g, 'rgba(14, 165, 233'); // shadow colors
css = css.replace(/#ffe4e6/g, '#e0f2fe'); // hover bg
css = css.replace(/#be123c/g, '#0284c7'); // sky-600 for cart bar
css = css.replace(/#fb7185/g, '#38bdf8'); // cat pill gradient
css = css.replace(/#fff1f2/g, '#f0f9ff'); // active pay option bg
css = css.replace(/#fecdd3/g, '#bae6fd'); // hero gradient end
fs.writeFileSync(p('public/css/style.css'), css);

// 4. Update db.json
let db = JSON.parse(fs.readFileSync(p('db.json'), 'utf8'));
db.config.storeName = 'BabyFlash';
fs.writeFileSync(p('db.json'), JSON.stringify(db, null, 2));

// 5. Update api/index.js
let api = fs.readFileSync(p('api/index.js'), 'utf8');
api = api.replace(/SOS Maternidade/g, 'BabyFlash');
fs.writeFileSync(p('api/index.js'), api);

console.log("Rebranding complete!");
