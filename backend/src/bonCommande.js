const PDFDocument = require('pdfkit');

const SERVICE_LABELS = { trajet_simple: 'Transfert', mise_a_disposition: 'Mise à disposition', forfait: 'Forfait' };
const VEHICLE_LABELS = { confort: 'Confort', affaires: 'Affaires', van: 'Van' };
const PAYMENT_LABELS = { carte_a_bord: 'CB à bord', especes: 'Espèces', compte: 'Paiement sur compte' };
const TZ = 'Europe/Paris'; // le serveur est en UTC : on force l'heure de Rennes

const fmtDate = (d) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ });
const fmtTime = (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const fmtDateTime = (d) => `${new Date(d).toLocaleDateString('fr-FR', { timeZone: TZ })} ${fmtTime(d)}`;

// Logo de l'entreprise (réglage Apparence). pdfkit n'accepte que PNG et JPEG.
async function loadLogo(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok || !/png|jpe?g/i.test(res.headers.get('content-type') ?? '')) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch (e) {
    return null;
  }
}

const M = 36; // marge
const W = 523; // largeur utile A4
const GREY = '#C8C8C8';
const LIGHT = '#E8E8E8';
const DISPATCH_PHONE = '07 68 42 52 62';

// Génère la « fiche de mission » (bon de commande / billet collectif) au format PDF.
// Voir arrêtés du 14 février 1986 (article 5) et du 6 janvier 1993 (article 3).
async function buildBonCommandePdf({ company, driver, vehicle, ride }) {
  const logo = await loadLogo(company?.logo_url);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Cellule encadrée, texte centré horizontalement et verticalement.
    const cell = (x, y, w, h, text, { fill, size = 9, bold = false, italic = false, align = 'center', pad = 4 } = {}) => {
      if (fill) doc.rect(x, y, w, h).fillAndStroke(fill, '#000');
      else doc.rect(x, y, w, h).lineWidth(0.8).stroke('#000');
      doc.fillColor('#000');
      if (text == null || text === '') return;
      doc.font(bold ? (italic ? 'Helvetica-BoldOblique' : 'Helvetica-Bold') : italic ? 'Helvetica-Oblique' : 'Helvetica').fontSize(size);
      const inner = w - 2 * pad;
      const textH = doc.heightOfString(String(text), { width: inner, align });
      doc.text(String(text), x + pad, y + Math.max(2, (h - textH) / 2), { width: inner, height: h - 2, align, ellipsis: true });
    };

    doc.lineWidth(0.8);
    const reference = String(ride.id ?? '').slice(0, 8).toUpperCase() || '-';

    // En-tête : logo, coordonnées, titre et numéros de dossier
    if (logo) {
      try {
        doc.image(logo, M, 30, { fit: [84, 84] });
      } catch (e) {
        // image illisible : le document reste valable sans logo
      }
    }
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(10);
    doc.text('Dispatch', M, 124, { continued: true, underline: true }).text(` : ${DISPATCH_PHONE}`, { underline: false });
    if (driver?.vtc_card_number) doc.font('Helvetica-Bold').fontSize(10).text(`Carte professionnelle VTC : ${driver.vtc_card_number}`, M, 138, { underline: false });

    const tx = M + W - 260;
    cell(tx, 30, 260, 24, 'Fiche de mission', { fill: GREY, size: 14, bold: true });
    ['N° de dossier', 'N° de mission', 'N° de version'].forEach((label, i) => cell(tx + i * (260 / 3), 54, 260 / 3, 18, label, { fill: GREY, size: 8, bold: true }));
    [reference, '1', '1'].forEach((v, i) => cell(tx + i * (260 / 3), 72, 260 / 3, 20, v, { size: 9, bold: true }));

    const c1 = 103;
    const c2 = 155;
    const c3 = W - c1 - c2;
    const x2 = M + c1;
    const x3 = M + c1 + c2;
    let y = 158;

    // Ligne A : date / client / chauffeur
    cell(M, y, c1, 20, 'Date', { fill: GREY, size: 10, bold: true });
    cell(x2, y, c2, 20, 'Client', { fill: GREY, size: 10, bold: true });
    cell(x3, y, c3, 20, 'Chauffeur', { fill: GREY, size: 10, bold: true });
    y += 20;
    const when = ride.scheduled_at || ride.created_at;
    cell(M, y, c1, 70, when ? fmtDate(when) : '-', { size: 11, bold: true });
    cell(x2, y, c2, 70, ride.created_at ? `Dossier créé le ${fmtDateTime(ride.created_at)}` : '', { size: 8, italic: true, bold: true });
    cell(x3, y, c3, 34, driver ? [driver.full_name || driver.email, driver.siret ? `SIRET ${driver.siret}` : ''].filter(Boolean).join('\n') : '—', { size: 9, bold: true });
    cell(x3, y + 34, c3 / 2, 16, 'Type de véhicule', { fill: GREY, size: 8, bold: true });
    cell(x3 + c3 / 2, y + 34, c3 / 2, 16, 'Véhicule', { fill: GREY, size: 8, bold: true });
    cell(x3, y + 50, c3 / 2, 20, VEHICLE_LABELS[ride.vehicle_category] ?? '', { size: 9 });
    cell(x3 + c3 / 2, y + 50, c3 / 2, 20, [vehicle?.display_name, vehicle?.plate].filter(Boolean).join(' - '), { size: 8 });
    y += 70;

    // Ligne B : service / passagers / note au chauffeur
    const adults = Math.max(1, (ride.passenger_count ?? 1) - 0);
    cell(M, y, c1, 22, 'Service', { fill: GREY, size: 10, bold: true });
    cell(x2, y, c2, 22, `Passager(s) : ${ride.passenger_count ?? 1}`, { fill: GREY, size: 10, bold: true });
    cell(x3, y, c3, 22, 'Note au chauffeur', { fill: GREY, size: 10, bold: true });
    y += 22;
    const service = SERVICE_LABELS[ride.service_type] ?? ride.service_type ?? '';
    cell(M, y, c1, 40, ride.service_type === 'mise_a_disposition' && ride.duration_hours ? `${service}\n${ride.duration_hours} h` : service, { size: 9, bold: true });
    cell(M, y + 40, c1, 16, 'Tarif / règlement', { fill: LIGHT, size: 8, bold: true });
    cell(M, y + 56, c1, 34, `${ride.price != null ? `${Number(ride.price).toFixed(2).replace('.', ',')} €` : 'À confirmer'}\n${PAYMENT_LABELS[ride.payment_method] ?? ''}`, { size: 9, bold: true });
    const kids = (ride.child_seats ?? 0) + (ride.booster_seats ?? 0);
    cell(x2, y, c2, 90, [
      ride.client_name,
      ride.client_phone,
      `Nombre d'adulte(s) : ${Math.max(adults - kids, 1)}`,
      kids ? `Enfant(s) : ${kids}${ride.child_ages ? ` (${ride.child_ages})` : ''}` : '',
      `Bagage(s) : ${ride.luggage_count ?? 0}`,
    ].filter(Boolean).join('\n'), { size: 9, bold: true });
    const notes = [
      ride.client_note,
      ride.driver_note,
      ride.child_seats > 0 ? `Siège auto x${ride.child_seats}` : '',
      ride.booster_seats > 0 ? `Rehausseur x${ride.booster_seats}` : '',
      (ride.stop_addresses ?? []).length ? `Arrêt(s) : ${ride.stop_addresses.join(' ; ')}` : '',
      ride.round_trip ? `Aller-retour${ride.return_scheduled_at ? ` - retour le ${fmtDateTime(ride.return_scheduled_at)}` : ''}` : '',
    ].filter(Boolean).join('\n');
    cell(x3, y, c3, 90, notes, { size: 9 });
    y += 90;

    // Prise en charge
    cell(M, y, W, 20, 'Prise en charge', { fill: GREY, size: 10, bold: true });
    y += 20;
    cell(M, y, c1, 46, when ? fmtTime(when) : '', { size: 26, bold: true });
    cell(x2, y, W - c1, 46, ride.pickup_address ?? '', { size: 12, bold: true, align: 'left', pad: 8 });
    y += 46;

    // Destination
    const end = ride.service_type === 'mise_a_disposition' && ride.duration_hours && when ? new Date(new Date(when).getTime() + ride.duration_hours * 3600000) : null;
    cell(M, y, W, 20, 'Destination', { fill: GREY, size: 10, bold: true });
    y += 20;
    cell(M, y, W - 130, 46, ride.dropoff_address ?? '', { size: 12, bold: true, align: 'left', pad: 8 });
    cell(M + W - 130, y, 130, 46, end ? fmtTime(end) : '', { size: 26, bold: true });
    y += 46;

    // Informations obligatoires à compléter par le chauffeur
    const col = W / 5;
    cell(M, y, W, 20, 'Informations obligatoires à compléter', { fill: GREY, size: 10, bold: true });
    y += 20;
    ['Heure départ garage', 'Heure retour garage', 'Km départ', 'Km arrivée', 'TOTAL km'].forEach((l, i) => cell(M + i * col, y, col, 18, l, { fill: LIGHT, size: 8, bold: true }));
    y += 18;
    for (let i = 0; i < 5; i++) cell(M + i * col, y, col, 34, '');
    y += 34;

    // Repas, débours, observations
    const left = col * 2;
    cell(M, y, left, 20, 'Repas', { fill: GREY, size: 10, bold: true });
    cell(M + left, y, W - left, 20, 'Observations de fin de mission', { fill: GREY, size: 10, bold: true });
    y += 20;
    cell(M, y, left, 30, '');
    cell(M, y + 30, left, 20, 'Débours chauffeur sur justificatifs', { fill: GREY, size: 9, bold: true });
    ['Parking', 'Péage', 'Divers', 'Total'].forEach((l, i) => {
      cell(M, y + 50 + i * 26, col, 26, l, { fill: LIGHT, size: 9, bold: true });
      cell(M + col, y + 50 + i * 26, col, 26, '');
    });
    cell(M + left, y, W - left, 154, '');

    // Pied de page : l'entité émettrice
    const name = company?.company_legal_name || 'Rennes VTC';
    doc.lineWidth(2.5).moveTo(M, 786).lineTo(M + W, 786).stroke('#000');
    doc.fillColor('#000').font('Helvetica').fontSize(10);
    doc.text(name.toUpperCase(), M, 794, { width: W, align: 'center' });
    doc.text([company?.company_siret ? `SIRET ${company.company_siret}` : '', company?.company_address].filter(Boolean).join(' - '), M, 808, { width: W, align: 'center' });

    doc.end();
  });
}

module.exports = { buildBonCommandePdf };
