// E-mails de course au format « Rennes VTC » (modele valide par Jim) : bandeau, details, carte chauffeur, suivi, assistance.
// Tableaux et styles en ligne, pour s'afficher correctement dans Gmail, Outlook, Apple Mail. Images : backend/public/mail/.
const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://app-rennesvtc.onrender.com';
const GREEN = '#47C415';
// Photo de la carte chauffeur : selon le modele reel du vehicule (la Camry peut servir en Confort comme en Affaires), sinon selon la gamme.
function carPhoto(vehicleName, gamme) {
  const n = String(vehicleName || '');
  if (/camry/i.test(n)) return 'camry';
  if (/classe\s*e\b|e-class/i.test(n)) return 'classe-e';
  if (/classe\s*v\b|\bvan\b|vito|v-class/i.test(n)) return 'van';
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
  driver_accepted: { title: ['Course', 'confirmée'], intro: 'Vous avez accepté cette course. Retrouvez ci-dessous ses détails et votre bon de commande.' },
  no_show: { title: ['Passager', 'absent'], intro: 'Le chauffeur a attendu sur place : la course est clôturée pour non-présentation du passager.' },
  completed: { title: ['Course', 'terminée'], intro: 'Votre course est terminée. Merci de votre confiance.' },
};

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const img = (base, name, w, h, alt = '', style = '') => `<img src="${base}/mail/${name}" width="${w}" height="${h}" alt="${esc(alt)}" style="display:block;border:0;outline:none;width:${w}px;height:${h}px;${style}">`;
const inline = (tag) => tag.replace('display:block', 'display:inline-block;vertical-align:middle');
// Pictogramme : image de fond d'une cellule (Gmail, Apple Mail), <img> de secours pour Outlook.
const ico = (base, name, w, h, mode = 'block', extra = '') => {
  const url = `${base}/mail/${name}`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="${mode === 'inline' ? 'display:inline-block;vertical-align:middle;' : ''}${extra}"><tr><td width="${w}" height="${h}" style="width:${w}px;height:${h}px;font-size:0;line-height:0;background-image:url('${url}');background-repeat:no-repeat;background-position:center;background-size:${w}px ${h}px"><div style="width:${w}px;height:${h}px;font-size:0;line-height:0">&nbsp;</div><!--[if mso]><img src="${url}" width="${w}" height="${h}" style="display:block;border:0"><![endif]--></td></tr></table>`;
};

// ride : { gamme: 'confort'|'affaires'|'van', passenger, whenText, pickup, dropoff, price?, paymentLabel?, ref?, mad?, durationHours? }
// driver : { firstName, vehicleName, plate }   trackingUrl : lien de suivi (facultatif)
function buildRideMail({ kind, ride, driver, extraDrivers = [], trackingUrl, bonUrl, accueilUrl, accueilFullUrl, base = BASE_URL }) {
  const k = KINDS[kind] ?? KINDS.received;
  const gamme = ['confort', 'affaires', 'van'].includes(ride.gamme) ? ride.gamme : 'affaires';
  const mad = !!ride.mad;
  const FONT = 'Segoe UI,Helvetica,Arial,sans-serif';
  const LINE = '1px solid #d9dcd8';
  const LIGHT = (c) => `background:${c};background-image:linear-gradient(${c},${c});`;

  // Cellule du tableau « Details » : pictogramme, intitule, valeur.
  const cell = (icon, w, h, label, value, extra = '') => `
    <td valign="top" width="50%" class="col" style="padding:16px 14px;${extra}"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
      ${icon ? `<td valign="top" width="52" style="padding:2px 0 0">${ico(base, `i_${icon}.png`, w, h)}</td>` : '<td valign="top" width="52"></td>'}
      <td valign="top" style="font-family:${FONT};font-size:13.5px;color:#454a47;line-height:1.35">${esc(label)}<br><span style="font-size:17px;color:#0c0d0d;font-weight:600;line-height:1.35">${value}</span></td>
    </tr></table></td>`;

  const rows = `
    <tr>${cell('user', 28, 32, 'Passager', esc(ride.passenger || '—'), `border-right:${LINE};border-bottom:${LINE};`)}${cell('calendar', 31, 32, mad ? 'Date et heure de début' : 'Date et heure de prise en charge', esc(ride.whenText), `border-bottom:${LINE};`)}</tr>
    <tr>${cell('pin', 27, 34, 'Lieu de départ', esc(ride.pickup), `border-right:${LINE};`)}${cell('flag', 38, 32, mad ? `Mise à disposition${ride.durationHours ? ' (' + esc(ride.durationHours) + ' h)' : ''}` : 'Destination', esc(mad && !ride.dropoff ? 'Selon votre programme' : ride.dropoff))}</tr>
    ${ride.showPrice ? `<tr>${cell(null, 0, 0, 'Tarif de la course', ride.price == null ? 'À confirmer' : esc(ride.price) + ' €', `border-top:${LINE};border-right:${LINE};`)}${cell(null, 0, 0, 'Règlement', esc(ride.paymentLabel || ''), `border-top:${LINE};`)}</tr>` : ''}`;

  const infoRow = ride.clientPhone || ride.paxText ? `<tr>${cell(null, 0, 0, 'Téléphone du client', esc(ride.clientPhone || '—'), `border-top:${LINE};border-right:${LINE};`)}${cell(null, 0, 0, 'Passagers', esc(ride.paxText || '—'), `border-top:${LINE};`)}</tr>` : '';
  const photoKey = carPhoto(driver?.vehicleName, gamme);
  const isMercedes = /mercedes/i.test(driver?.vehicleName || '');
  const driverCard = driver ? `
    <tr><td style="padding:0 20px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0b0c0d" style="${LIGHT('#0b0c0d')}border-radius:14px;overflow:hidden;table-layout:fixed"><tr>
      <td width="124" align="center" class="avc" style="padding:16px 8px 16px 20px">${img(base, 'avatar.png', 100, 100, 'Chauffeur', '')}</td>
      <td valign="middle" style="padding:14px 8px;border-left:2px solid ${GREEN};font-family:${FONT}">
        <div style="color:${GREEN};font-size:15px;font-weight:700;text-transform:uppercase;padding-left:14px">Votre chauffeur</div>
        <div style="color:#ffffff;font-size:30px;font-weight:700;margin:1px 0 7px;padding-left:14px">${esc(driver.firstName || 'Votre chauffeur')}</div>
        ${driver.vehicleName ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:14px;font-size:0">&nbsp;</td>${isMercedes ? `<td valign="middle" style="padding:0 9px 0 0">${ico(base, 'i_star.png', 30, 30)}</td>` : ''}<td valign="middle" style="font-family:${FONT};color:#ffffff;font-size:17.5px;font-weight:600;white-space:nowrap" class="vname vtitle">${esc(driver.vehicleName)}</td></tr></table>` : ''}
        ${driver.plate ? `<div style="color:#c4c9c5;font-size:14px;margin-top:3px;padding-left:14px;white-space:nowrap" class="vname">Immatriculation : ${esc(driver.plate)}</div>` : ''}
      </td>
      <td width="220" align="right" valign="middle" class="hide-m" style="padding:0">${img(base, `car_${photoKey}.jpg`, 210, 110, 'Votre véhicule')}</td>
    </tr><tr><td colspan="2" class="show-m" style="display:none;mso-hide:all;max-height:0;overflow:hidden;font-size:0;line-height:0;padding:0" align="center">${img(base, `car_${photoKey}.jpg`, 210, 110, 'Votre véhicule', 'width:100%;max-width:320px;height:auto;margin:0 auto')}</td></tr></table></td></tr>` : '';

  // Mission a plusieurs chauffeurs : les autres chauffeurs, sous la carte du chauffeur principal.
  const extraLabel = (e) => `${e.firstName || 'Chauffeur'}${e.vehicleName ? ` - ${e.vehicleName}` : ''}${e.plate ? ` (${e.plate})` : ''}`;
  const extraRow = driver && extraDrivers.length ? `
    <tr><td style="padding:0 20px 18px;font-family:${FONT};font-size:15px;color:#2e332f;line-height:1.5"><strong style="color:#0c0d0d">${extraDrivers.length > 1 ? 'Chauffeurs supplémentaires' : 'Chauffeur supplémentaire'} :</strong><br>${extraDrivers.map((e) => esc(extraLabel(e))).join('<br>')}</td></tr>` : '';

  // Carte d'action : suivi en direct (donneur d'ordre) ou bon de commande (chauffeur).
  const actionCard = (icon, iw, ih, title, body, label, url, showUrl) => `
    <tr><td style="padding:0 20px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f1f2f0" style="${LIGHT('#f1f2f0')}border-radius:14px"><tr>
      <td width="104" align="center" class="hide-m" style="padding:20px 6px 20px 20px">${ico(base, icon, iw, ih)}</td>
      <td class="trk" style="padding:18px 22px 18px 14px;border-left:2px solid ${GREEN};font-family:${FONT}">
        <div style="padding-left:6px">
        <div style="font-size:17px;font-weight:700;color:#0c0d0d;text-transform:uppercase">${esc(title)}</div>
        <div style="font-size:15px;color:#2e332f;line-height:1.5;margin:4px 0 14px">${esc(body)}</div>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="${GREEN}" style="background:${GREEN};border-radius:30px"><a href="${esc(url)}" style="display:inline-block;padding:14px 34px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">${esc(label)} &nbsp;&rsaquo;</a></td></tr></table>
        ${showUrl ? `<div style="font-size:11.5px;color:#7a807c;margin-top:10px;word-break:break-all">${esc(url)}</div>` : ''}</div>
      </td></tr></table></td></tr>`;
  const tracking = trackingUrl ? actionCard('i_map.png', 70, 62, 'Suivi de votre mission en direct', 'Retrouvez à tout moment les informations relatives à votre prestation et suivez votre chauffeur en temps réel.', 'ACCÉDER AU SUIVI EN DIRECT', trackingUrl, true) : '';
  const bon = bonUrl ? actionCard('i_doc.png', 62, 62, 'Bon de commande', 'Retrouvez tous les détails de la mission : client, trajet, tarif. Le bon de commande est aussi joint à ce message au format PDF.', 'AFFICHER LE BON DE COMMANDE', bonUrl, false) : '';

  // Tablette d'accueil du client : image cliquable (taille reelle), a afficher sur une tablette a l'arrivee.
  const accueil = accueilUrl ? `<tr><td style="padding:0 20px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0b0c0d" style="border-radius:14px;overflow:hidden"><tr><td style="padding:14px 16px 6px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-transform:uppercase">Tablette d’accueil</td></tr><tr><td style="padding:0 16px 8px;font-family:${FONT};font-size:13px;color:#d8dcd9;line-height:1.5">À afficher à l’arrivée du client. Touchez l’image pour l’ouvrir en grand.</td></tr><tr><td style="padding:0 0 0"><a href="${esc(accueilFullUrl || accueilUrl)}"><img src="${esc(accueilUrl)}" width="600" alt="Tablette d’accueil - ${esc(ride.passenger || '')}" style="display:block;border:0;width:100%;max-width:600px;height:auto"></a></td></tr></table></td></tr>` : '';

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>Rennes VTC</title>
<style>:root{color-scheme:light only;supported-color-schemes:light}
@media only screen and (max-width:520px){
  .col,.fcol{box-sizing:border-box!important}
  .col{display:block!important;width:100%!important;border-right:0!important}
  .ttl{font-size:26px!important;line-height:1.12!important;padding-left:14px!important}
  .pad{padding-left:16px!important;padding-right:16px!important}
  .intro{font-size:15px!important}
  .hide-m{display:none!important}
  .trk{border-left:0!important;padding:18px 16px!important}
  .show-m{display:table-cell!important;max-height:none!important;font-size:inherit!important;line-height:normal!important;padding:0 0 4px!important}
  .vname{white-space:normal!important}
  .vtitle{font-size:15.5px!important}
  .avc{width:92px!important;padding:12px 4px 12px 12px!important}
  .avc img{width:72px!important;height:72px!important}
  .fcol{display:block!important;width:100%!important;border-left:0!important;padding:8px 0!important;white-space:normal!important}
}</style></head>
<body style="margin:0;padding:0;${LIGHT('#e9ebe8')}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#e9ebe8" style="${LIGHT('#e9ebe8')}"><tr><td align="center" style="${LIGHT('#e9ebe8')}padding:18px 8px">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:100%;max-width:640px;table-layout:fixed;${LIGHT('#ffffff')}border-radius:16px;overflow:hidden">
  <tr><td>${img(base, 'header.jpg', 640, 219, 'Rennes VTC - Votre temps mérite l’excellence', 'width:100%;max-width:640px;height:auto')}</td></tr>
  <tr><td class="pad" style="padding:0 28px 6px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td valign="middle" style="padding-right:20px">${ico(base, 'check.png', 70, 70)}</td>
    <td valign="middle" class="ttl" style="border-left:3px solid ${GREEN};padding-left:20px;font-family:${FONT};font-size:34px;font-weight:700;line-height:1.06;color:#0c0d0d">${esc(k.title[0])}<br><span style="color:#35b00f">${esc(k.title[1])}</span></td>
  </tr></table></td></tr>
  <tr><td class="pad intro" style="padding:16px 28px 18px;font-family:${FONT};font-size:16px;color:#1a1d1b;line-height:1.55">Bonjour,<br>${esc(k.intro)}</td></tr>
  <tr><td style="padding:0 20px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f1f2f0" style="${LIGHT('#f1f2f0')}border-radius:14px;overflow:hidden">
    <tr><td colspan="2" style="padding:0"><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
      <td bgcolor="#0b0c0d" width="1" style="background:#0b0c0d;padding:11px 38px 11px 18px;border-radius:0 0 20px 0;font-family:${FONT};font-size:15.5px;font-weight:700;color:#ffffff;white-space:nowrap">${ico(base, 'i_tabcal.png', 25, 25, 'inline', 'margin-right:12px')}DÉTAILS DE VOTRE COURSE</td>
      <td style="border-bottom:2px solid ${GREEN};font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>
    ${rows}${infoRow}
  </table></td></tr>
  ${driverCard}${extraRow}
  ${tracking}${bon}${accueil}
  <tr><td bgcolor="#0b0c0d" style="${LIGHT('#0b0c0d')}padding:22px 22px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="66" valign="middle" class="fcol">${ico(base, 'i_headset.png', 50, 50)}</td>
    <td valign="middle" class="fcol" style="font-family:${FONT};padding-right:14px"><div style="color:${GREEN};font-size:15px;font-weight:700;text-transform:uppercase">Une assistance à votre écoute</div><div style="color:#d8dcd9;font-size:13.5px;line-height:1.5;margin-top:3px">Pour toute question ou assistance concernant cette réservation, notre équipe reste à votre disposition.</div></td>
    <td valign="middle" class="fcol" style="border-left:2px solid ${GREEN};padding-left:16px;font-family:${FONT};font-size:14px;color:#ffffff;line-height:2.15;white-space:nowrap">
      ${ico(base, 'i_phone.png', 22, 22, 'inline', 'margin-right:9px')}<a href="tel:+33768425262" style="color:#ffffff;text-decoration:none">+33 7 68 42 52 62</a> <span style="background:${GREEN};color:#ffffff;font-size:11px;padding:3px 9px;border-radius:12px;vertical-align:middle">Urgence 24h/24</span><br>
      ${ico(base, 'i_mail.png', 24, 21, 'inline', 'margin-right:9px')}<a href="mailto:contact@rennesvtc.com" style="color:#ffffff;text-decoration:none">contact@rennesvtc.com</a><br>
      ${ico(base, 'i_globe.png', 23, 23, 'inline', 'margin-right:9px')}<a href="https://www.rennesvtc.com" style="color:#ffffff;text-decoration:none">www.rennesvtc.com</a></td>
  </tr></table></td></tr>
  <tr><td>${img(base, 'thanks.jpg', 640, 82, 'Merci de votre confiance. L’équipe Rennes VTC', 'width:100%;max-width:640px;height:auto')}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    'Bonjour,', '', k.intro, '',
    `Passager : ${ride.passenger || '-'}`,
    `Date et heure : ${ride.whenText}`,
    `Départ : ${ride.pickup}`,
    ride.dropoff ? `Destination : ${ride.dropoff}` : null,
    ride.showPrice ? `Tarif : ${ride.price == null ? 'à confirmer' : ride.price + ' €'}` : null,
    driver ? `Chauffeur : ${driver.firstName}${driver.vehicleName ? ` - ${driver.vehicleName}` : ''}${driver.plate ? ` (${driver.plate})` : ''}` : null,
    driver && extraDrivers.length ? `Chauffeur${extraDrivers.length > 1 ? 's' : ''} supplémentaire${extraDrivers.length > 1 ? 's' : ''} : ${extraDrivers.map(extraLabel).join(' ; ')}` : null,
    trackingUrl ? `\nSuivi en direct : ${trackingUrl}` : null,
    bonUrl ? `\nBon de commande : ${bonUrl}` : null,
    accueilFullUrl ? `\nTablette d’accueil : ${accueilFullUrl}` : null,
    '\nMerci de votre confiance.\nL’équipe Rennes VTC - 07 68 42 52 62 - contact@rennesvtc.com',
  ].filter((l) => l !== null).join('\n');

  return { html, text };
}

module.exports = { buildRideMail, KINDS };
