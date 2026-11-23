// Genere les pictogrammes ligne du client (PNG 96x96, 4 couleurs : w blanc, g vert, m gris, k noir) dans apps/client/assets/ui.
// Meme trait que les autres pictogrammes (6 px, extremites arrondies). Lancer : node scripts/make-client-icons.js
const path = require('path');
const sharp = require('sharp');
const COLORS = { w: '#ffffff', g: '#22c55e', m: '#9aa19a', k: '#0b0c0b' };
const ICONS = {
  cash: '<rect x="8" y="24" width="80" height="48" rx="9"/><circle cx="48" cy="48" r="11"/><circle cx="22" cy="48" r="1.5"/><circle cx="74" cy="48" r="1.5"/>',
  tag: '<path d="M46 10h34a6 6 0 0 1 6 6v34L50.500 85.500a6 6 0 0 1-8.500 0L10.500 54a6 6 0 0 1 0-8.500z"/><circle cx="68" cy="28" r="5"/>',
  mail: '<rect x="8" y="22" width="80" height="52" rx="9"/><path d="m12 30 36 26 36-26"/>',
  check: '<path d="m20 50 22 22 36-44" stroke-width="8"/>',
  back: '<path d="M60 18 28 48l32 30"/>',
};
(async () => {
  for (const [name, body] of Object.entries(ICONS)) {
    for (const [v, color] of Object.entries(COLORS)) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">${body.replace(/<circle cx="(22|74)" cy="48" r="1.5"\/>/g, `<circle cx="$1" cy="48" r="2" fill="${color}"/>`)}</svg>`;
      await sharp(Buffer.from(svg), { density: 288 }).resize(96, 96).png().toFile(path.join(__dirname, '../apps/client/assets/ui', `${name}_${v}.png`));
    }
  }
  console.log('ok');
})();
