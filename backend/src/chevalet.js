// Chevalet imprimable des navettes : PDF A5 ou A6 (logo Rennes VTC, logo de l'evenement, nom, QR code, phrase d'invitation).
const path = require('path');
const PDFDocument = require('pdfkit');

const SIZES = { a5: [419.53, 595.28], a6: [297.64, 419.53] };
const GREEN = '#5BD42A';
const TYPES = { mariage: 'Mariage', entreprise: 'Soirée', evenement: 'Événement' };

const frLongDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();

// Reduit la taille du texte jusqu'a ce qu'il tienne dans la boite (largeur x hauteur).
function fit(doc, text, font, width, maxHeight, maxSize, minSize) {
  let size = maxSize;
  doc.font(font);
  while (size > minSize) {
    doc.fontSize(size);
    if (doc.heightOfString(text, { width, align: 'center' }) <= maxHeight) break;
    size -= 0.5;
  }
  return size;
}

// event : { name, type, event_date, pin } ; qrPng / rvtcLogo / eventLogo : Buffer PNG (ou null).
function buildChevaletPdf({ event, format = 'a5', qrPng, rvtcLogo, eventLogo }) {
  const [W, H] = SIZES[format] ?? SIZES.a5;
  const doc = new PDFDocument({ size: [W, H], margin: 0, info: { Title: `Chevalet navette - ${event.name}`, Author: 'Rennes VTC' } });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  doc.registerFont('Outfit', path.join(__dirname, '../assets/Outfit_700Bold.ttf'));
  const m = W * 0.08;
  const cw = W - 2 * m;

  doc.rect(0, 0, W, H).fill('#000000');

  // Logos : Rennes VTC, puis (si present) le logo de l'evenement dans une pastille claire.
  const logoH = H * 0.1;
  let x = 0;
  const items = [];
  if (rvtcLogo) items.push({ img: rvtcLogo, w: logoH * 1.4, h: logoH });
  if (eventLogo) items.push({ img: eventLogo, w: logoH * 1.6, h: logoH, tile: true });
  const gap = W * 0.05;
  const totalW = items.reduce((a, it) => a + it.w + (it.tile ? W * 0.04 : 0), 0) + gap * Math.max(items.length - 1, 0);
  x = (W - totalW) / 2;
  const logoY = H * 0.05;
  if (!items.length) {
    doc.font('Outfit').fontSize(W * 0.07).fillColor('#FFFFFF').text('RENNES ', 0, logoY + logoH * 0.2, { continued: true, align: 'center', width: W }).fillColor(GREEN).text('VTC');
  }
  for (const it of items) {
    if (it.tile) {
      const pad = W * 0.02;
      doc.roundedRect(x, logoY - pad, it.w + 2 * pad, it.h + 2 * pad, W * 0.025).fill('#FFFFFF');
      doc.image(it.img, x + pad, logoY, { fit: [it.w, it.h], align: 'center', valign: 'center' });
      x += it.w + 2 * pad + gap;
    } else {
      doc.image(it.img, x, logoY, { fit: [it.w, it.h], align: 'center', valign: 'center' });
      x += it.w + gap;
    }
  }

  // Type et date
  const kicker = `${TYPES[event.type] ?? 'Événement'} · ${frLongDate(event.event_date)}`.toUpperCase();
  doc.font('Outfit');
  const ks = fit(doc, kicker, 'Outfit', cw, W * 0.06, W * 0.034, W * 0.022);
  doc.fillColor(GREEN).fontSize(ks).text(kicker, m, H * 0.19, { width: cw, align: 'center' });

  // Nom de l'evenement
  const nameBoxH = H * 0.13;
  const ns = fit(doc, event.name, 'Outfit', cw, nameBoxH, W * 0.092, W * 0.045);
  doc.fillColor('#FFFFFF').fontSize(ns).text(event.name, m, H * 0.228, { width: cw, align: 'center', height: nameBoxH, ellipsis: true });

  // QR code sur fond blanc arrondi
  const qr = W * 0.46;
  const qx = (W - qr) / 2;
  const qy = H * 0.385;
  const pad = qr * 0.07;
  doc.roundedRect(qx - pad, qy - pad, qr + 2 * pad, qr + 2 * pad, W * 0.04).fill('#FFFFFF');
  doc.image(qrPng, qx, qy, { width: qr, height: qr });

  // Phrase d'invitation
  const py = qy + qr + pad + H * 0.022;
  doc.rect((W - W * 0.12) / 2, py - H * 0.012, W * 0.12, 2).fill(GREEN);
  const phrase = 'Scannez pour réserver votre navette retour';
  const ps = fit(doc, phrase, 'Outfit', cw, H * 0.1, W * 0.058, W * 0.04);
  doc.fillColor('#FFFFFF').fontSize(ps).text(phrase, m, py + H * 0.012, { width: cw, align: 'center' });
  let y = doc.y + H * 0.008;
  if (event.pin) {
    doc.font('Outfit').fontSize(W * 0.045).fillColor(GREEN).text(`Code PIN : ${event.pin}`, m, y, { width: cw, align: 'center' });
    y = doc.y;
  }

  // Pied de page
  doc.font('Helvetica').fontSize(W * 0.028).fillColor('#8A9690').text('Rennes VTC · Chauffeur privé · www.rennesvtc.com', m, H * 0.955, { width: cw, align: 'center', lineBreak: false });
  doc.end();
  return done;
}

module.exports = { buildChevaletPdf };
