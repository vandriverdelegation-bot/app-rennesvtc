// Extraction des reservations au format Excel (.xlsx) : filtres, apercu JSON, fichier mis en forme avec feuille de synthese.
const ExcelJS = require('exceljs');
const { supabaseAdmin } = require('./supabaseAdmin');
const { parisToUtc } = require('./navettes');

const STATUS = { pending: 'En attente', dispatched: 'Dispatchée', accepted: 'Acceptée', completed: 'Terminée', cancelled: 'Annulée' };
const STEP = { not_started: 'Pas commencée', en_route: 'Chauffeur en route', on_site: 'Sur place', on_board: 'Passager à bord', dropped: 'Passager déposé', completed: 'Terminée', no_show: 'Non-présentation' };
const PAYMENT = { carte_a_bord: 'CB à bord', especes: 'Espèces', compte: 'En compte' };
const CATEGORY = { confort: 'Confort', affaires: 'Affaires', van: 'Van' };
const SERVICE = { trajet_simple: 'Trajet simple', mise_a_disposition: 'Mise à disposition', forfait: 'Forfait' };
const ORIGIN = { admin: 'Back-office', client: 'Appli client', chauffeur: 'Appli chauffeur', web: 'Site web' };
const MAX_ROWS = 20000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Filtres lus dans l'adresse ; tout ce qui n'est pas reconnu est ignore (jamais envoye tel quel a la base).
function readFilters(q) {
  const pick = (v, allowed) => (allowed.includes(String(v ?? '')) ? String(v) : '');
  const statuses = String(q.status ?? '').split(',').filter((s) => STATUS[s]);
  return {
    from: DATE_RE.test(q.from ?? '') ? q.from : '',
    to: DATE_RE.test(q.to ?? '') ? q.to : '',
    basis: q.basis === 'creation' ? 'creation' : 'course',
    client: String(q.client ?? '').replace(/[,()*%:\\"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60),
    driver: UUID_RE.test(q.driver ?? '') ? q.driver : '',
    statuses,
    service: pick(q.service, Object.keys(SERVICE)),
    category: pick(q.category, Object.keys(CATEGORY)),
    payment: pick(q.payment, Object.keys(PAYMENT)),
    tag: String(q.tag ?? '').replace(/[{}",\\]/g, ' ').trim().slice(0, 40),
  };
}

function applyFilters(query, f) {
  if (f.from || f.to) {
    const a = f.from ? parisToUtc(f.from, 0).toISOString() : null;
    const b = f.to ? parisToUtc(f.to, 1440).toISOString() : null; // fin de journee incluse
    if (f.basis === 'creation') {
      if (a) query = query.gte('created_at', a);
      if (b) query = query.lt('created_at', b);
    } else {
      // Date de la course ; une course immediate (sans date) compte a sa date de saisie.
      const sched = [a && `scheduled_at.gte.${a}`, b && `scheduled_at.lt.${b}`].filter(Boolean).join(',');
      const created = [a && `created_at.gte.${a}`, b && `created_at.lt.${b}`].filter(Boolean).join(',');
      query = query.or(`and(${sched}),and(scheduled_at.is.null,${created})`);
    }
  }
  if (f.client) query = query.or(['client_name', 'client_phone', 'client_email', 'orderer_name'].map((c) => `${c}.ilike.%${f.client}%`).join(','));
  if (f.driver) query = query.or(`driver_id.eq.${f.driver},extra_driver_ids.cs.{${f.driver}}`);
  if (f.statuses.length) query = query.in('status', f.statuses);
  if (f.service) query = query.eq('service_type', f.service);
  if (f.category) query = query.eq('vehicle_category', f.category);
  if (f.payment) query = query.eq('payment_method', f.payment);
  if (f.tag) query = query.contains('tags', [f.tag]);
  return query;
}

async function loadProfiles(ids) {
  const out = {};
  const list = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < list.length; i += 100) {
    const { data } = await supabaseAdmin.from('profiles').select('id, full_name, email, phone').in('id', list.slice(i, i + 100));
    (data ?? []).forEach((p) => { out[p.id] = p; });
  }
  return out;
}

const parisParts = (iso) => Object.fromEntries(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
// Date « calendaire » de Rennes, stockee a minuit UTC pour que Excel affiche le bon jour.
const excelDay = (iso) => { const p = parisParts(iso); return new Date(Date.UTC(+p.year, +p.month - 1, +p.day)); };
const hhmm = (iso) => { const p = parisParts(iso); return `${p.hour}h${p.minute}`; };

async function loadRows(f) {
  const rides = [];
  for (let from = 0; from < MAX_ROWS; from += 1000) {
    const { data, error } = await applyFilters(supabaseAdmin.from('rides').select('*'), f)
      .order('scheduled_at', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true }).order('id', { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rides.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const people = await loadProfiles(rides.flatMap((r) => [r.client_id, r.driver_id, ...(r.extra_driver_ids ?? [])]));
  return rides.map((r) => {
    const client = r.client_id ? people[r.client_id] : null;
    const driver = r.driver_id ? people[r.driver_id] : null;
    const when = r.scheduled_at ?? r.created_at;
    return {
      ref: String(r.id).slice(0, 8).toUpperCase(),
      day: excelDay(when),
      time: r.scheduled_at ? hhmm(r.scheduled_at) : 'Dès que possible',
      sortKey: new Date(when).getTime(),
      client: r.client_name || client?.full_name || '',
      clientPhone: r.client_phone || client?.phone || '',
      clientEmail: r.client_email || client?.email || '',
      orderer: r.orderer_name || '',
      ordererContact: [r.orderer_email, r.orderer_phone].filter(Boolean).join(' / '),
      pickup: r.pickup_address || '',
      stops: (r.stop_addresses ?? []).join(' | '),
      dropoff: r.dropoff_address || '',
      roundTrip: r.round_trip ? 'Oui' : 'Non',
      service: SERVICE[r.service_type] ?? r.service_type ?? '',
      duration: r.service_type === 'mise_a_disposition' ? r.duration_hours ?? null : null,
      category: CATEGORY[r.vehicle_category] ?? '',
      driver: driver ? driver.full_name || driver.email || '' : '',
      driverPhone: driver?.phone || '',
      driverEmail: driver?.email || '',
      extras: (r.extra_driver_ids ?? []).map((id) => people[id]?.full_name || people[id]?.email || '').filter(Boolean).join(', '),
      passengers: r.passenger_count ?? null,
      luggage: r.luggage_count ?? null,
      status: STATUS[r.status] ?? r.status ?? '',
      statusKey: r.status,
      step: r.ride_step ? STEP[r.ride_step] ?? '' : '',
      payment: PAYMENT[r.payment_method] ?? '',
      price: r.price == null ? null : Number(r.price),
      surcharge: r.surcharge_amount == null ? null : Number(r.surcharge_amount),
      tags: (r.tags ?? []).join(', '),
      driverNote: r.driver_note || '',
      clientNote: r.client_note || '',
      createdAt: r.created_at ? new Date(r.created_at) : null,
      origin: ORIGIN[r.created_by] ?? r.created_by ?? '',
    };
  });
}

// Chiffres de la synthese : le montant total ne compte pas les reservations annulees.
function summarize(rows) {
  const live = rows.filter((r) => r.statusKey !== 'cancelled');
  const sum = (list) => list.reduce((t, r) => t + (r.price ?? 0), 0);
  const group = (key, empty) => {
    const map = new Map();
    for (const r of live) { const k = r[key] || empty; const g = map.get(k) ?? { name: k, count: 0, total: 0 }; g.count += 1; g.total += r.price ?? 0; map.set(k, g); }
    return [...map.values()].sort((a, b) => b.total - a.total || b.count - a.count);
  };
  return {
    count: rows.length, cancelled: rows.length - live.length, total: sum(live),
    average: live.length ? sum(live) / live.length : 0,
    byDriver: group('driver', 'Non attribué'), byStatus: (() => { const m = new Map(); rows.forEach((r) => m.set(r.status, (m.get(r.status) ?? 0) + 1)); return [...m].map(([name, count]) => ({ name, count })); })(),
    byPayment: group('payment', 'Non précisé'), byCategory: group('category', 'Non précisée'),
  };
}

function describeFilters(f) {
  const day = (d) => d.split('-').reverse().join('/');
  return [
    ['Période', f.from || f.to ? `${f.from ? `du ${day(f.from)}` : ''}${f.from && f.to ? ' ' : ''}${f.to ? `au ${day(f.to)}` : ''} (${f.basis === 'creation' ? 'date de saisie' : 'date de la course'})` : 'Toutes les dates'],
    ['Client', f.client || 'Tous'],
    ['Chauffeur', f.driver ? '(filtré)' : 'Tous'],
    ['Statut', f.statuses.length ? f.statuses.map((s) => STATUS[s]).join(', ') : 'Tous'],
    ['Type de service', f.service ? SERVICE[f.service] : 'Tous'],
    ['Gamme', f.category ? CATEGORY[f.category] : 'Toutes'],
    ['Paiement', f.payment ? PAYMENT[f.payment] : 'Tous'],
    ['Tag', f.tag || 'Aucun'],
  ];
}

const DARK = 'FF0E0F10', GREEN = 'FF47C415', GREY = 'FFF3F5F4', LINE = 'FFD9DEDB';
const EURO = '#,##0.00 "€"';

async function buildWorkbook(rows, f, driverName) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Rennes VTC';
  wb.created = new Date();
  const info = describeFilters(f);
  if (f.driver) info[2][1] = driverName || 'Chauffeur choisi';
  const stats = summarize(rows);

  // ---- Feuille 1 : le detail, une ligne par reservation ----
  const ws = wb.addWorksheet('Réservations', { views: [{ state: 'frozen', ySplit: 1, xSplit: 3 }], properties: { tabColor: { argb: GREEN } } });
  const cols = [
    ['N° dossier', 'ref', 12], ['Date', 'day', 12, 'dd/mm/yyyy'], ['Heure', 'time', 10],
    ['Client', 'client', 26], ['Téléphone client', 'clientPhone', 17], ['Email client', 'clientEmail', 28],
    ['Donneur d’ordre', 'orderer', 22], ['Contact donneur d’ordre', 'ordererContact', 28],
    ['Chauffeur', 'driver', 24], ['Téléphone chauffeur', 'driverPhone', 17], ['Email chauffeur', 'driverEmail', 28], ['Chauffeurs supplémentaires', 'extras', 26],
    ['Départ', 'pickup', 38], ['Arrêts', 'stops', 30], ['Destination', 'dropoff', 38], ['Aller-retour', 'roundTrip', 11],
    ['Type de service', 'service', 18], ['Durée (h)', 'duration', 10, '0.0'], ['Gamme', 'category', 11],
    ['Passagers', 'passengers', 11, '0'], ['Bagages', 'luggage', 10, '0'],
    ['Statut', 'status', 14], ['Étape', 'step', 18], ['Paiement', 'payment', 13],
    ['Prix (€)', 'price', 13, EURO], ['Majoration (€)', 'surcharge', 14, EURO],
    ['Tags', 'tags', 18], ['Note chauffeur', 'driverNote', 32], ['Note client', 'clientNote', 32],
    ['Saisie le', 'createdAt', 17, 'dd/mm/yyyy hh:mm'], ['Origine', 'origin', 15],
  ];
  ws.columns = cols.map(([header, key, width, numFmt]) => ({ header, key, width, style: numFmt ? { numFmt } : {} }));
  rows.sort((a, b) => a.sortKey - b.sortKey).forEach((r) => ws.addRow(r));

  const head = ws.getRow(1);
  head.height = 32;
  head.eachCell((cell) => {
    cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: GREEN } } };
  });
  const priceCol = cols.findIndex((c) => c[1] === 'price') + 1;
  const last = rows.length + 1;
  for (let i = 2; i <= last; i++) {
    const row = ws.getRow(i);
    row.alignment = { vertical: 'top', wrapText: true };
    row.font = { name: 'Calibri', size: 10.5 };
    if (i % 2 === 1) row.eachCell({ includeEmpty: true }, (c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY } }; });
    row.eachCell({ includeEmpty: true }, (c) => { c.border = { bottom: { style: 'hair', color: { argb: LINE } } }; });
    if (row.getCell('status').value === 'Annulée') row.font = { name: 'Calibri', size: 10.5, color: { argb: 'FF8A938E' }, strike: true };
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(last, 1), column: cols.length } };
  // Ligne de total : SUBTOTAL suit les filtres appliques dans Excel (les lignes masquees ne comptent pas).
  const total = ws.getRow(last + 1);
  const L = ws.getColumn(priceCol).letter;
  total.getCell(priceCol - 1).value = 'Total affiché';
  total.getCell(priceCol).value = { formula: `SUBTOTAL(109,${L}2:${L}${Math.max(last, 2)})`, result: rows.reduce((t, r) => t + (r.price ?? 0), 0) };
  total.getCell(priceCol).numFmt = EURO;
  total.eachCell((c) => { c.font = { name: 'Calibri', bold: true, size: 11 }; c.border = { top: { style: 'medium', color: { argb: GREEN } } }; });
  total.getCell(priceCol - 1).alignment = { horizontal: 'right' };
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } };
  ws.headerFooter = { oddFooter: '&LRennes VTC - Extraction des réservations&RPage &P / &N' };
  ws.pageSetup.printTitlesRow = '1:1';

  // ---- Feuille 2 : synthese ----
  const sy = wb.addWorksheet('Synthèse', { views: [{ showGridLines: false }], properties: { tabColor: { argb: DARK } } });
  sy.columns = [{ width: 32 }, { width: 18 }, { width: 18 }, { width: 4 }, { width: 30 }];
  const generated = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'long', timeStyle: 'short' }).format(new Date());
  sy.mergeCells('A1:E1');
  sy.getCell('A1').value = 'Rennes VTC — Extraction des réservations';
  sy.getCell('A1').font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
  sy.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };
  sy.getCell('A1').alignment = { vertical: 'middle', indent: 1 };
  sy.getRow(1).height = 44;
  sy.mergeCells('A2:E2');
  sy.getCell('A2').value = `Généré le ${generated}`;
  sy.getCell('A2').font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF6B7570' } };
  sy.getCell('A2').alignment = { indent: 1 };

  let r = 4;
  const title = (text) => {
    sy.mergeCells(`A${r}:E${r}`);
    const c = sy.getCell(`A${r}`);
    c.value = text; c.font = { name: 'Calibri', size: 13, bold: true, color: { argb: DARK } };
    c.border = { bottom: { style: 'medium', color: { argb: GREEN } } };
    r += 1;
  };
  const line = (a, b, c, fmt) => {
    sy.getCell(`A${r}`).value = a; sy.getCell(`B${r}`).value = b;
    if (c !== undefined) sy.getCell(`C${r}`).value = c;
    if (fmt) { sy.getCell(`B${r}`).numFmt = fmt; sy.getCell(`C${r}`).numFmt = fmt; }
    ['A', 'B', 'C'].forEach((col) => { sy.getCell(`${col}${r}`).font = { name: 'Calibri', size: 11 }; sy.getCell(`${col}${r}`).border = { bottom: { style: 'hair', color: { argb: LINE } } }; });
    sy.getCell(`B${r}`).alignment = { horizontal: 'left' }; sy.getCell(`C${r}`).alignment = { horizontal: 'right' };
    r += 1;
  };
  const tableHead = (a, b, c) => {
    [[`A${r}`, a], [`B${r}`, b], [`C${r}`, c]].forEach(([addr, v]) => { const cell = sy.getCell(addr); cell.value = v; cell.font = { name: 'Calibri', bold: true, size: 10.5, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } }; cell.alignment = { horizontal: addr[0] === 'A' ? 'left' : addr[0] === 'B' ? 'left' : 'right' }; });
    r += 1;
  };

  title('Filtres appliqués');
  info.forEach(([k, v]) => { sy.getCell(`A${r}`).value = k; sy.getCell(`A${r}`).font = { name: 'Calibri', bold: true, size: 11 }; sy.mergeCells(`B${r}:E${r}`); sy.getCell(`B${r}`).value = v; sy.getCell(`B${r}`).font = { name: 'Calibri', size: 11 }; r += 1; });
  r += 1;
  title('Chiffres clés');
  line('Réservations', stats.count);
  line('dont annulées', stats.cancelled);
  line('Montant total (hors annulées)', stats.total, undefined, EURO);
  line('Montant moyen par course', stats.average, undefined, EURO);
  r += 1;
  title('Par chauffeur (hors annulées)');
  tableHead('Chauffeur', 'Courses', 'Montant');
  stats.byDriver.forEach((g) => line(g.name, g.count, g.total, undefined)) ;
  stats.byDriver.forEach((_, i) => { sy.getCell(`C${r - stats.byDriver.length + i}`).numFmt = EURO; });
  r += 1;
  title('Par statut');
  tableHead('Statut', 'Réservations', '');
  stats.byStatus.forEach((g) => line(g.name, g.count));
  r += 1;
  title('Par moyen de paiement (hors annulées)');
  tableHead('Paiement', 'Courses', 'Montant');
  stats.byPayment.forEach((g) => line(g.name, g.count, g.total));
  stats.byPayment.forEach((_, i) => { sy.getCell(`C${r - stats.byPayment.length + i}`).numFmt = EURO; });
  r += 1;
  title('Par gamme (hors annulées)');
  tableHead('Gamme', 'Courses', 'Montant');
  stats.byCategory.forEach((g) => line(g.name, g.count, g.total));
  stats.byCategory.forEach((_, i) => { sy.getCell(`C${r - stats.byCategory.length + i}`).numFmt = EURO; });
  sy.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  wb.views = [{ activeTab: 0 }];
  return wb;
}

function registerExport(app, requireAdmin) {
  async function driverLabel(id) {
    if (!id) return '';
    const p = (await loadProfiles([id]))[id];
    return p?.full_name || p?.email || '';
  }

  // Apercu : nombre de reservations, montant et premieres lignes.
  app.get('/admin/export/reservations', requireAdmin, async (req, res) => {
    try {
      const f = readFilters(req.query);
      const rows = (await loadRows(f)).sort((a, b) => a.sortKey - b.sortKey);
      const s = summarize(rows);
      res.json({
        count: s.count, cancelled: s.cancelled, total: s.total, truncated: rows.length >= MAX_ROWS,
        rows: rows.slice(0, 8).map((r) => ({ ref: r.ref, day: r.day.toISOString().slice(0, 10), time: r.time, client: r.client, driver: r.driver, trajet: `${r.pickup} → ${r.dropoff}`, status: r.status, price: r.price })),
      });
    } catch (e) {
      console.error('extraction (apercu) :', e.message);
      res.status(500).json({ error: 'Impossible de lire les réservations.' });
    }
  });

  // Fichier Excel.
  app.get('/admin/export/reservations.xlsx', requireAdmin, async (req, res) => {
    try {
      const f = readFilters(req.query);
      const rows = await loadRows(f);
      const wb = await buildWorkbook(rows, f, await driverLabel(f.driver));
      const stamp = new Date().toISOString().slice(0, 10);
      res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="reservations-rennes-vtc-${stamp}.xlsx"`, 'Cache-Control': 'no-store' });
      await wb.xlsx.write(res);
      res.end();
    } catch (e) {
      console.error('extraction (excel) :', e.message);
      if (!res.headersSent) res.status(500).json({ error: "Impossible de créer le fichier Excel." });
    }
  });
}

module.exports = { registerExport, readFilters, applyFilters, loadRows, summarize, buildWorkbook };
