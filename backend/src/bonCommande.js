const PDFDocument = require('pdfkit');

const SERVICE_LABELS = { trajet_simple: 'Trajet simple', mise_a_disposition: 'Mise a disposition', forfait: 'Forfait' };

function fmt(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

// Genere le "billet collectif" (bon de commande) reglementaire au format PDF.
// Voir arretes du 14 fevrier 1986 (article 5) et du 6 janvier 1993 (article 3).
function buildBonCommandePdf({ company, driver, vehicle, ride }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const line = (label, value) => doc.font('Helvetica-Bold').fontSize(11).text(`${label} : `, { continued: true }).font('Helvetica').text(value ?? '-');

    doc.font('Helvetica-Bold').fontSize(14).text('SERVICE DE VOITURE DE TRANSPORT AVEC CHAUFFEUR');
    doc.moveDown(0.3).fontSize(14).text('BILLET COLLECTIF');
    doc.moveDown(0.5).font('Helvetica').fontSize(10);
    doc.text('(Arrete du 14 Fevrier 1986 - Article 5)');
    doc.text('et');
    doc.text('(Arrete du 6 Janvier 1993 - Article 3)');
    doc.moveDown(1);

    const companyName = company?.company_legal_name || 'Rennes VTC';
    doc.font('Helvetica-Bold').fontSize(13).text(companyName);
    doc.font('Helvetica').fontSize(10).text('Location de vehicule avec chauffeur');
    doc.text(`${companyName.toUpperCase()} ${company?.company_siret ?? ''} ${company?.company_address ?? ''}`.trim());
    doc.moveDown(1);

    line('Conducteur', [driver?.full_name, driver?.vtc_card_number].filter(Boolean).join(' '));
    line('SIRET/SIREN', driver?.siret || company?.company_siret);
    line('Passager', ride.client_name);
    line('Numero de telephone du passager', ride.client_phone);
    doc.moveDown(0.5);

    line('Commande', fmt(ride.created_at));
    if (ride.service_type === 'mise_a_disposition') {
      const start = ride.scheduled_at || ride.created_at;
      const end = ride.duration_hours ? new Date(new Date(start).getTime() + ride.duration_hours * 3600000) : null;
      line('Heure de debut', fmt(start));
      line('Heure de fin', end ? fmt(end) : '-');
    } else {
      line('Prise en charge', fmt(ride.scheduled_at || ride.created_at));
    }
    line('Lieu prise en charge', ride.pickup_address);
    line('Destination', ride.dropoff_address);
    line('Type de prestation', SERVICE_LABELS[ride.service_type] ?? ride.service_type);
    line('Tarif', ride.price != null ? `${ride.price} EUR` : 'A confirmer');
    doc.moveDown(0.5);

    line('Nom du vehicule', vehicle?.display_name);
    line('Plaque d\'immatriculation', vehicle?.plate);

    doc.end();
  });
}

module.exports = { buildBonCommandePdf };
