// Tablette d'accueil : image de bienvenue (1672 x 941) avec le nom du client ecrit dans le cadre vert.
// Le texte est dessine en vectoriel a partir de la police (aucune police a installer sur le serveur).
const path = require('path');

const FOND = path.join(__dirname, '../assets/accueil-fond.jpg');
let font = null; // police chargee au premier usage
const IMG = { w: 1672, h: 941 };
// Interieur du cadre vert de l'image (en pixels de l'image d'origine).
const BOX = { x: 64, y: 516, w: 1544, h: 206 };

const cache = new Map(); // nom + largeur -> JPEG ; quelques dizaines d'entrees suffisent
function remember(key, buf) {
  if (cache.size >= 60) cache.delete(cache.keys().next().value);
  cache.set(key, buf);
  return buf;
}

// Dessin du nom : majuscules, centre, taille ajustee pour tenir dans le cadre.
function nameSvg(rawName, outW) {
  const text = String(rawName ?? '').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 60);
  if (!text) return '';
  font ??= require('fontkit').openSync(path.join(__dirname, '../assets/Outfit_700Bold.ttf'));
  const run = font.layout(text);
  const spacing = 0.06 * font.unitsPerEm; // leger espacement entre les lettres, dans l'esprit du « WELCOME »
  const total = run.glyphs.reduce((sum, g) => sum + g.advanceWidth, 0) + spacing * (run.glyphs.length - 1);
  const cap = font.capHeight || 0.7 * font.unitsPerEm;
  const scale = Math.min((0.5 * BOX.h) / cap, (0.92 * BOX.w) / total);
  let x = BOX.x + (BOX.w - total * scale) / 2;
  const baseline = BOX.y + BOX.h / 2 + (cap * scale) / 2;
  const paths = run.glyphs.map((g) => {
    const d = g.path.toSVG();
    const out = d ? `<path transform="translate(${x.toFixed(2)} ${baseline.toFixed(2)}) scale(${scale.toFixed(5)} ${(-scale).toFixed(5)})" d="${d}"/>` : '';
    x += (g.advanceWidth + spacing) * scale;
    return out;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${Math.round((outW * IMG.h) / IMG.w)}" viewBox="0 0 ${IMG.w} ${IMG.h}"><g fill="#FFFFFF">${paths.join('')}</g></svg>`;
}

// JPEG de la tablette pour ce nom ; width : largeur de sortie (par defaut celle de l'image d'origine).
async function renderAccueil(name, width) {
  const w = Math.min(Math.max(parseInt(width, 10) || IMG.w, 300), IMG.w);
  const key = `${w}|${name ?? ''}`;
  if (cache.has(key)) return cache.get(key);
  const svg = nameSvg(name, w);
  const sharp = require('sharp');
  let img = sharp(FOND);
  if (svg) img = img.composite([{ input: Buffer.from(svg) }]);
  if (w !== IMG.w) img = img.resize({ width: w });
  return remember(key, await img.jpeg({ quality: 90 }).toBuffer());
}

module.exports = { renderAccueil };
