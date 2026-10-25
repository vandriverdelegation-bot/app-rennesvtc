const PDFDocument = require('pdfkit');

const SERVICE_LABELS = { trajet_simple: 'Trajet simple', mise_a_disposition: 'Mise a disposition', forfait: 'Forfait' };

function fmt(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

// Logo de l'entreprise (reglage Apparence). pdfkit n'accepte que PNG et JPEG.
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

const PAGE_W = 612; // Letter, comme le modele fourni par Jim
const MARGIN = 36;
const BODY = 16;

// Genere le "billet collectif" (bon de commande) reglementaire au format PDF.
// Voir arretes du 14 fevrier 1986 (article 5) et du 6 janvier 1993 (article 3).
// Mise en page : tout centre, logo en haut, blocs espaces - conforme au modele de Jim.
async function buildBonCommandePdf({ company, driver, vehicle, ride }) {
  const logo = await loadLogo(company?.logo_url);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: MARGIN });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const innerW = PAGE_W - 2 * MARGIN;
    let offset = 0; // decalage cumule quand une ligne passe sur deux lignes ou qu'on ajoute une ligne

    const centered = (text, y, size, bold) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
      doc.text(text, MARGIN, y + offset, { width: innerW, align: 'center' });
    };

    // "Libelle : valeur" centre ; si trop long, le libelle puis la valeur sur deux lignes.
    const line = (label, value, y) => {
      const text = value == null || value === '' ? '-' : String(value);
      const l = `${label} : `;
      doc.fontSize(BODY);
      const w1 = doc.font('Helvetica-Bold').widthOfString(l);
      const w2 = doc.font('Helvetica').widthOfString(text);
      if (w1 + w2 <= innerW) {
        doc.font('Helvetica-Bold').text(l, (PAGE_W - w1 - w2) / 2, y + offset, { continued: true, lineBreak: false });
        doc.font('Helvetica').text(text, { lineBreak: false });
      } else {
        centered(`${label} :`, y, BODY, true);
        centered(text, y + 19, BODY, false);
        offset += doc.heightOfString(text, { width: innerW }) + 2;
      }
    };

    // Logo
    if (logo) {
      try {
        doc.image(logo, (PAGE_W - 160) / 2, 14, { fit: [160, 160], align: 'center' });
      } catch (e) {
        // image illisible : le document reste valable sans logo
      }
    }

    // En-tete reglementaire : titre sur une seule ligne, ajuste a la largeur disponible
    doc.font('Helvetica-Bold').fontSize(14);
    const titleSize = Math.min(14, (14 * innerW) / doc.widthOfString('SERVICE DE VOITURE DE TRANSPORT AVEC CHAUFFEUR BILLET COLLECTIF'));
    centered('SERVICE DE VOITURE DE TRANSPORT AVEC CHAUFFEUR BILLET COLLECTIF', 184, titleSize, true);
    centered('(Arrete du 14 Fevrier 1986 - Article 5) et', 238, 13, false);
    centered('(Arrete du 6 Janvier 1993 - Article 3)', 254, 13, false);

    // Entreprise
    const companyName = company?.company_legal_name || 'Rennes VTC';
    centered(companyName, 316, BODY, true);
    centered('Location de vehicule avec chauffeur', 335, BODY, false);
    centered(`${companyName.toUpperCase()} ${company?.company_siret ?? ''} ${company?.company_address ?? ''}`.replace(/\s+/g, ' ').trim(), 360, BODY, false);

    // Conducteur
    line('Conducteur', [driver?.full_name, driver?.vtc_card_number].filter(Boolean).join(' '), 389);
    line('SIRET/SIREN', driver?.siret || company?.company_siret, 415);

    // Passager
    line('Passager', ride.client_name, 453);
    line('Numero de telephone du passager', ride.client_phone, 472);

    // Dates
    line('Commande', fmt(ride.created_at), 496);
    if (ride.service_type === 'mise_a_disposition') {
      const start = ride.scheduled_at || ride.created_at;
      const end = ride.duration_hours ? new Date(new Date(start).getTime() + ride.duration_hours * 3600000) : null;
      line('Heure de debut', fmt(start), 515);
      offset += 19;
      line('Heure de fin', end ? fmt(end) : '-', 515);
    } else {
      line('Prise en charge', fmt(ride.scheduled_at || ride.created_at), 515);
    }

    // Lieux
    line('Lieu prise en charge', ride.pickup_address, 553);
    line('Destination', ride.dropoff_address, 591);

    // Prestation
    line('Type de prestation', SERVICE_LABELS[ride.service_type] ?? ride.service_type, 629);
    line('Tarif', ride.price != null ? `${Number(ride.price).toFixed(2)} EUR` : 'A confirmer', 648);

    // Vehicule
    line('Nom du vehicule', vehicle?.display_name, 676);
    line("Plaque d'immatriculation", vehicle?.plate, 695);

    doc.end();
  });
}

module.exports = { buildBonCommandePdf };
