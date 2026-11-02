// E-mails de course au format « Rennes VTC » (modele valide par Jim) : bandeau, details, carte chauffeur, suivi, assistance.
// Tableaux et styles en ligne, pour s'afficher correctement dans Gmail, Outlook, Apple Mail. Images : backend/public/mail/.
const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://app-rennesvtc.onrender.com';
const GREEN = '#47C415';
// Photo de la carte chauffeur : selon le modele reel du vehicule (la Camry peut servir en Confort comme en Affaires), sinon selon la gamme.
function carPhoto(vehicleName, gamme) {
  const n = String(vehicleName || '');
  if (/camry/i.test(n)) return 'camry';
  if (/classes*e|e-class/i.test(n)) return 'classe-e';
  if (/classes*v|van|vito|v-class/i.test(n)) return 'van';
  return { confort: 'camry', affaires: 'classe-e', van: 'van' }[gamme] || 'classe-e';
}

// Titre (2 lignes) et phrase d'introduction de chaque etape.
const KINDS = {
  received: { title: ['Votre demande', 'est bien reçue'], intro: 'Nous avons bien reçu votre demande de réservation. Un chauffeur vous sera attribué très prochainement.' },
  accepted: { title: ['Votre chauffeur', 'est affecté'], intro: "Nous vous confirmons qu'un chauffeur a été affecté à votre réservation." },
  en_route: { title: ['Votre chauffeur', 'est en route'], intro: 'Votre chauffeur se dirige vers le point de prise en charge.' },
  on_site: { title: ['Votre chauffeur', 'est arrivé'], intro: 'Votre chauffeur est sur place et vous attend.' },
  on_board: { title: ['Passager', 'à bord'], intro: 'Le passager est à bord : la course est en cours.' },
  dropped: { title: ['Passager', 'déposé'], intro: 'Le passager a été déposé à destination.' },
  completed: { title: ['Course', 'terminée'], intro: 'Votre course est terminée. Merci de votre confiance.' },
};

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const img = (base, name, w, h, alt = '', style = '') => `<img src="${base}/mail/${name}" width="${w}" height="${h}" alt="${esc(alt)}" style="display:block;border:0;outline:none;width:${w}px;height:${h}px;${style}">`;
const inline = (tag) => tag.replace('display:block', 'display:inline-block;vertical-align:middle');

// ride : { gamme: 'confort'|'affaires'|'van', passenger, whenText, pickup, dropoff, price?, paymentLabel?, ref?, mad?, durationHours? }
// driver : { firstName, vehicleName, plate }   trackingUrl : lien de suivi (facultatif)
function buildRideMail({ kind, ride, driver, trackingUrl, base = BASE_URL }) {
  const k = KINDS[kind] ?? KINDS.received;
  const gamme = ['confort', 'affaires', 'van'].includes(ride.gamme) ? ride.gamme : 'affaires';
  const mad = !!ride.mad;
  const FONT = 'Segoe UI,Helvetica,Arial,sans-serif';
  const LINE = '1px solid #d9dcd8';

  // Cellule du tableau « Details » : pictogramme, intitule, valeur.
  const cell = (icon, w, h, label, value, extra = '') => `
    <td valign="top" width="50%" style="padding:16px 14px;${extra}"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
      ${icon ? `<td valign="top" width="52" style="padding:2px 0 0">${img(base, `i_${icon}.png`, w, h)}</td>` : '<td width="6"></td>'}
      <td valign="top" style="font-family:${FONT};font-size:13.5px;color:#454a47;line-height:1.35">${esc(label)}<br><span style="font-size:17px;color:#0c0d0d;font-weight:600;line-height:1.35">${value}</span></td>
    </tr></table></td>`;

  const rows = `
    <tr>${cell('user', 28, 32, 'Passager', esc(ride.passenger || '—'), `border-right:${LINE};border-bottom:${LINE};`)}${cell('calendar', 31, 32, mad ? 'Date et heure de début' : 'Date et heure de prise en charge', esc(ride.whenText), `border-bottom:${LINE};`)}</tr>
    <tr>${cell('pin', 27, 34, 'Lieu de départ', esc(ride.pickup), `border-right:${LINE};`)}${cell('flag', 38, 32, mad ? `Mise à disposition${ride.durationHours ? ' (' + esc(ride.durationHours) + ' h)' : ''}` : 'Destination', esc(mad && !ride.dropoff ? 'Selon votre programme' : ride.dropoff))}</tr>
    ${ride.showPrice ? `<tr>${cell(null, 0, 0, 'Tarif de la course', ride.price == null ? 'À confirmer' : esc(ride.price) + ' €', `border-top:${LINE};border-right:${LINE};`)}${cell(null, 0, 0, 'Règlement', esc(ride.paymentLabel || ''), `border-top:${LINE};`)}</tr>` : ''}`;

  const photoKey = carPhoto(driver?.vehicleName, gamme);
  const isMercedes = /mercedes/i.test(driver?.vehicleName || '');
  const driverCard = driver ? `
    <tr><td style="padding:0 20px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0b0c0d" style="background:#0b0c0d;border-radius:14px;overflow:hidden"><tr>
      <td width="124" align="center" style="padding:16px 8px 16px 20px">${img(base, 'avatar.png', 100, 100, 'Chauffeur')}</td>
      <td valign="middle" style="padding:14px 8px;border-left:2px solid ${GREEN};font-family:${FONT}">
        <div style="color:${GREEN};font-size:15px;font-weight:700;text-transform:uppercase;padding-left:14px">Votre chauffeur</div>
        <div style="color:#ffffff;font-size:30px;font-weight:700;margin:1px 0 7px;padding-left:14px">${esc(driver.firstName || 'Votre chauffeur')}</div>
        ${driver.vehicleName ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:14px;font-size:0">&nbsp;</td>${isMercedes ? `<td valign="middle" style="padding:0 9px 0 0">${img(base, 'i_star.png', 30, 30)}</td>` : ''}<td valign="middle" style="font-family:${FONT};color:#ffffff;font-size:17.5px;font-weight:600;white-space:nowrap">${esc(driver.vehicleName)}</td></tr></table>` : ''}
        ${driver.plate ? `<div style="color:#c4c9c5;font-size:14.5px;margin-top:3px;padding-left:14px">Immatriculation : ${esc(driver.plate)}</div>` : ''}
      </td>
      <td width="220" align="right" valign="middle" style="padding:0">${img(base, `car_${photoKey}.jpg`, 210, 110, 'Votre véhicule')}</td>
    </tr></table></td></tr>` : '';

  const tracking = trackingUrl ? `
    <tr><td style="padding:0 20px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f1f2f0" style="background:#f1f2f0;border-radius:14px"><tr>
      <td width="104" align="center" style="padding:20px 6px 20px 20px">${img(base, 'i_map.png', 70, 62)}</td>
      <td style="padding:18px 22px 18px 14px;border-left:2px solid ${GREEN};font-family:${FONT}">
        <div style="padding-left:6px">
        <div style="font-size:17px;font-weight:700;color:#0c0d0d;text-transform:uppercase">Suivi de votre mission en direct</div>
        <div style="font-size:15px;color:#2e332f;line-height:1.5;margin:4px 0 14px">Retrouvez à tout moment les informations relatives à votre prestation et suivez votre chauffeur en temps réel.</div>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="${GREEN}" style="background:${GREEN};border-radius:30px"><a href="${esc(trackingUrl)}" style="display:inline-block;padding:14px 34px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">ACCÉDER AU SUIVI EN DIRECT &nbsp;&rsaquo;</a></td></tr></table>
        <div style="font-size:11.5px;color:#7a807c;margin-top:10px;word-break:break-all">${esc(trackingUrl)}</div></div>
      </td></tr></table></td></tr>` : '';

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Rennes VTC</title></head>
<body style="margin:0;padding:0;background:#e9ebe8"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#e9ebe8"><tr><td align="center" style="padding:18px 8px">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:640px;max-width:100%;background:#ffffff;border-radius:16px;overflow:hidden">
  <tr><td>${img(base, 'header.jpg', 640, 219, 'Rennes VTC - Votre temps mérite l’excellence')}</td></tr>
  <tr><td style="padding:0 28px 6px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td valign="middle" style="padding-right:20px">${img(base, 'check.png', 70, 70)}</td>
    <td valign="middle" style="border-left:3px solid ${GREEN};padding-left:20px;font-family:${FONT};font-size:34px;font-weight:700;line-height:1.06;color:#0c0d0d">${esc(k.title[0])}<br><span style="color:#35b00f">${esc(k.title[1])}</span></td>
  </tr></table></td></tr>
  <tr><td style="padding:16px 28px 18px;font-family:${FONT};font-size:16px;color:#1a1d1b;line-height:1.55">Bonjour,<br>${esc(k.intro)}</td></tr>
  <tr><td style="padding:0 20px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f1f2f0" style="background:#f1f2f0;border-radius:14px;overflow:hidden">
    <tr><td colspan="2" style="padding:0"><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
      <td bgcolor="#0b0c0d" width="1" style="background:#0b0c0d;padding:11px 26px 11px 18px;border-radius:0 0 20px 0;font-family:${FONT};font-size:15.5px;font-weight:700;color:#ffffff;white-space:nowrap">${inline(img(base, 'i_tabcal.png', 25, 25, '', 'margin-right:12px'))}DÉTAILS DE VOTRE COURSE</td>
      <td style="border-bottom:2px solid ${GREEN};font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>
    ${rows}
  </table></td></tr>
  ${driverCard}
  ${tracking}
  <tr><td bgcolor="#0b0c0d" style="background:#0b0c0d;padding:22px 22px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="66" valign="middle">${img(base, 'i_headset.png', 50, 50)}</td>
    <td valign="middle" style="font-family:${FONT};padding-right:14px"><div style="color:${GREEN};font-size:15px;font-weight:700;text-transform:uppercase">Une assistance à votre écoute</div><div style="color:#d8dcd9;font-size:13.5px;line-height:1.5;margin-top:3px">Pour toute question ou assistance concernant cette réservation, notre équipe reste à votre disposition.</div></td>
    <td valign="middle" style="border-left:2px solid ${GREEN};padding-left:16px;font-family:${FONT};font-size:14px;color:#ffffff;line-height:2.15;white-space:nowrap">
      ${inline(img(base, 'i_phone.png', 22, 22, '', 'margin-right:9px'))}<a href="tel:+33768425262" style="color:#ffffff;text-decoration:none">+33 7 68 42 52 62</a> <span style="background:${GREEN};color:#ffffff;font-size:11px;padding:3px 9px;border-radius:12px;vertical-align:middle">Urgence 24h/24</span><br>
      ${inline(img(base, 'i_mail.png', 24, 21, '', 'margin-right:9px'))}<a href="mailto:contact@rennesvtc.com" style="color:#ffffff;text-decoration:none">contact@rennesvtc.com</a><br>
      ${inline(img(base, 'i_globe.png', 23, 23, '', 'margin-right:9px'))}<a href="https://www.rennesvtc.com" style="color:#ffffff;text-decoration:none">www.rennesvtc.com</a></td>
  </tr></table></td></tr>
  <tr><td>${img(base, 'thanks.jpg', 640, 82, 'Merci de votre confiance. L’équipe Rennes VTC')}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    'Bonjour,', '', k.intro, '',
    `Passager : ${ride.passenger || '-'}`,
    `Date et heure : ${ride.whenText}`,
    `Départ : ${ride.pickup}`,
    ride.dropoff ? `Destination : ${ride.dropoff}` : null,
    ride.showPrice ? `Tarif : ${ride.price == null ? 'à confirmer' : ride.price + ' €'}` : null,
    driver ? `Chauffeur : ${driver.firstName}${driver.vehicleName ? ` - ${driver.vehicleName}` : ''}${driver.plate ? ` (${driver.plate})` : ''}` : null,
    trackingUrl ? `\nSuivi en direct : ${trackingUrl}` : null,
    '\nMerci de votre confiance.\nL’équipe Rennes VTC - 07 68 42 52 62 - contact@rennesvtc.com',
  ].filter((l) => l !== null).join('\n');

  return { html, text };
}

module.exports = { buildRideMail, KINDS };
