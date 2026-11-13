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

const DARK = 'FF0E0F10', GREEN = 'FF47C415', GREEN_SOFT = 'FFE8F7DD', GREY = 'FFF7F9F8', GREY2 = 'FFEEF1EF', LINE = 'FFDDE2DF', MUTED = 'FF6B7570', TEXT = 'FF1B1F1D';
const EURO = '#,##0.00 "€"';
const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const FONT = (o = {}) => ({ name: 'Calibri', size: 10.5, color: { argb: TEXT }, ...o });
// Couleur de chaque statut : texte fonce sur fond clair, comme une pastille.
const STATUS_STYLE = {
  'Terminée': ['FF1B7F3A', 'FFE3F5E8'], 'Acceptée': ['FF1D5FA8', 'FFE4EFFB'], 'Dispatchée': ['FF9A6A00', 'FFFFF3D6'],
  'En attente': ['FF5B6560', 'FFECEFED'], 'Annulée': ['FFB3261E', 'FFFCE4E2'],
};

async function buildWorkbook(rows, f, driverName) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Rennes VTC';
  wb.created = new Date();
  wb.title = 'Extraction des réservations';
  const info = describeFilters(f);
  if (f.driver) info[2][1] = driverName || 'Chauffeur choisi';
  const stats = summarize(rows);
  rows.sort((a, b) => a.sortKey - b.sortKey);
  const generated = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'long', timeStyle: 'short' }).format(new Date());
  const euroText = (n) => `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} €`;
  // Resume des filtres actifs, pour l'en-tete (ce qui n'est pas filtre n'apparait pas).
  const active = info.filter(([, v]) => !/^(Tous|Toutes|Aucun|Toutes les dates)$/.test(v)).map(([k, v]) => `${k} : ${v}`);

  // ================= Feuille 1 : le detail, une ligne par reservation =================
  // [titre, cle, largeur, format, alignement]
  const cols = [
    ['N° dossier', 'ref', 13, null, 'center'], ['Date', 'day', 13, 'dd/mm/yyyy', 'center'], ['Heure', 'time', 17, null, 'center'],
    ['Client', 'client', 28, null, 'left'], ['Téléphone client', 'clientPhone', 18, null, 'left'],
    ['Chauffeur', 'driver', 26, null, 'left'], ['Téléphone chauffeur', 'driverPhone', 18, null, 'left'],
    ['Départ', 'pickup', 40, null, 'left'], ['Arrêts', 'stops', 30, null, 'left'], ['Destination', 'dropoff', 40, null, 'left'],
    ['Gamme', 'category', 12, null, 'center'], ['Passagers', 'passengers', 11, '0', 'center'],
    ['Statut', 'status', 14, null, 'center'], ['Paiement', 'payment', 14, null, 'center'], ['Prix', 'price', 14, EURO, 'right'],
    ['Note chauffeur', 'driverNote', 36, null, 'left'],
  ];
  const N = cols.length;
  const HEAD = 5; // lignes 1 a 4 : bandeau ; ligne 5 : titres des colonnes
  const ws = wb.addWorksheet('Réservations', {
    views: [{ state: 'frozen', xSplit: 4, ySplit: HEAD, showGridLines: false }],
    properties: { tabColor: { argb: GREEN }, defaultRowHeight: 20 },
  });
  ws.columns = cols.map(([, key, width]) => ({ key, width }));

  // Bandeau : titre, filtres, chiffres, filet vert.
  const band = (r, height, text, font) => {
    const row = ws.getRow(r);
    row.height = height;
    for (let c = 1; c <= N; c++) row.getCell(c).fill = fill(DARK);
    if (text) { const cell = row.getCell(1); cell.value = text; cell.font = font; cell.alignment = { vertical: 'middle', indent: 1 }; }
  };
  band(1, 40, 'Rennes VTC — Réservations', { name: 'Calibri', size: 20, bold: true, color: { argb: 'FFFFFFFF' } });
  band(2, 22, active.length ? active.join('   ·   ') : 'Toutes les réservations', { name: 'Calibri', size: 11, color: { argb: 'FFC9D1CC' } });
  band(3, 22, `${stats.count} réservation${stats.count > 1 ? 's' : ''}${stats.cancelled ? ` dont ${stats.cancelled} annulée${stats.cancelled > 1 ? 's' : ''}` : ''}   ·   ${euroText(stats.total)} hors annulées   ·   généré le ${generated}`, { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF7BE04A' } });
  const strip = ws.getRow(4); strip.height = 5; for (let c = 1; c <= N; c++) strip.getCell(c).fill = fill(GREEN);

  // Titres des colonnes.
  const head = ws.getRow(HEAD);
  head.height = 34;
  cols.forEach(([title, , , , align], i) => {
    const cell = head.getCell(i + 1);
    cell.value = title;
    cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = fill('FF1F2623');
    cell.alignment = { vertical: 'middle', horizontal: align, wrapText: true, indent: align === 'left' ? 1 : 0 };
    cell.border = { bottom: { style: 'medium', color: { argb: GREEN } } };
  });

  // Lignes : hauteur ajustee au texte, alternance de fond, statut en pastille de couleur.
  const wrapKeys = new Set(['client', 'driver', 'pickup', 'stops', 'dropoff', 'driverNote']);
  rows.forEach((r, idx) => {
    const rowNum = HEAD + 1 + idx;
    const row = ws.getRow(rowNum);
    const cancelled = r.statusKey === 'cancelled';
    let lines = 1;
    cols.forEach(([, key, width, fmt, align], i) => {
      const cell = row.getCell(i + 1);
      cell.value = r[key] === '' || r[key] === undefined ? null : r[key];
      if (fmt) cell.numFmt = fmt;
      cell.font = FONT(cancelled ? { color: { argb: 'FF8A938E' }, strike: key !== 'status' } : {});
      cell.alignment = { vertical: 'middle', horizontal: align, wrapText: wrapKeys.has(key), indent: align === 'left' ? 1 : 0 };
      cell.fill = fill(idx % 2 ? GREY : 'FFFFFFFF');
      cell.border = { bottom: { style: 'thin', color: { argb: LINE } } };
      if (wrapKeys.has(key) && typeof cell.value === 'string') lines = Math.max(lines, Math.ceil(cell.value.length / (width * 1.05)));
    });
    row.height = Math.max(22, lines * 14.5 + 8);
    const st = STATUS_STYLE[r.status];
    const statusCell = row.getCell(cols.findIndex((c) => c[1] === 'status') + 1);
    if (st) { statusCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: st[0] } }; statusCell.fill = fill(st[1]); }
    row.getCell(cols.findIndex((c) => c[1] === 'price') + 1).font = FONT({ bold: true, ...(cancelled ? { color: { argb: 'FF8A938E' }, strike: true } : {}) });
    row.getCell(1).font = FONT({ color: { argb: MUTED }, ...(cancelled ? { strike: true } : {}) });
  });
  const lastData = Math.max(HEAD + rows.length, HEAD + 1);
  ws.autoFilter = { from: { row: HEAD, column: 1 }, to: { row: lastData, column: N } };

  // Total : SUBTOTAL suit les filtres appliques dans Excel (les lignes masquees ne comptent pas).
  const priceCol = cols.findIndex((c) => c[1] === 'price') + 1;
  const L = ws.getColumn(priceCol).letter;
  const totalRow = ws.getRow(lastData + 1);
  totalRow.height = 28;
  for (let c = 1; c <= N; c++) { const cell = totalRow.getCell(c); cell.fill = fill(GREEN_SOFT); cell.border = { top: { style: 'medium', color: { argb: GREEN } } }; cell.font = FONT({ bold: true, size: 11 }); cell.alignment = { vertical: 'middle' }; }
  const labelCell = totalRow.getCell(priceCol - 1);
  labelCell.value = 'Total affiché';
  labelCell.alignment = { vertical: 'middle', horizontal: 'right' };
  const totalCell = totalRow.getCell(priceCol);
  totalCell.value = { formula: `SUBTOTAL(109,${L}${HEAD + 1}:${L}${lastData})`, result: rows.reduce((t, r) => t + (r.price ?? 0), 0) };
  totalCell.numFmt = EURO;
  totalCell.alignment = { vertical: 'middle', horizontal: 'right' };
  const note = ws.getRow(lastData + 3).getCell(1);
  note.value = 'Le total suit les filtres Excel : filtrez une colonne (client, chauffeur, statut...) et il se recalcule. Les réservations annulées sont barrées ; elles comptent dans le total de cette feuille mais pas dans la synthèse.';
  note.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: MUTED } };

  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, horizontalCentered: true, margins: { left: 0.35, right: 0.35, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 }, printTitlesRow: `${HEAD}:${HEAD}` };
  ws.headerFooter = { oddFooter: '&L&9Rennes VTC — Extraction des réservations&R&9Page &P / &N' };

  // ================= Feuille 2 : synthese =================
  const sy = wb.addWorksheet('Synthèse', { views: [{ showGridLines: false }], properties: { tabColor: { argb: DARK }, defaultRowHeight: 20 } });
  sy.columns = [{ width: 34 }, { width: 18 }, { width: 20 }, { width: 18 }];
  const bandSy = (r, height, text, font) => {
    const row = sy.getRow(r); row.height = height;
    for (let c = 1; c <= 4; c++) row.getCell(c).fill = fill(DARK);
    if (text) { sy.mergeCells(r, 1, r, 4); const cell = row.getCell(1); cell.value = text; cell.font = font; cell.alignment = { vertical: 'middle', indent: 1 }; }
  };
  bandSy(1, 44, 'Rennes VTC — Synthèse', { name: 'Calibri', size: 20, bold: true, color: { argb: 'FFFFFFFF' } });
  bandSy(2, 22, `Généré le ${generated}`, { name: 'Calibri', size: 11, color: { argb: 'FFC9D1CC' } });
  const stripSy = sy.getRow(3); stripSy.height = 5; for (let c = 1; c <= 4; c++) stripSy.getCell(c).fill = fill(GREEN);

  // Chiffres cles : quatre tuiles (titre en petit, valeur en grand).
  const tiles = [['RÉSERVATIONS', stats.count, '0'], ['DONT ANNULÉES', stats.cancelled, '0'], ['MONTANT TOTAL (HORS ANNULÉES)', stats.total, EURO], ['MONTANT MOYEN PAR COURSE', stats.average, EURO]];
  sy.getRow(5).height = 22; sy.getRow(6).height = 36;
  tiles.forEach(([label, value, fmt], i) => {
    const a = sy.getCell(5, i + 1), b = sy.getCell(6, i + 1);
    a.value = label; a.font = { name: 'Calibri', size: 8.5, bold: true, color: { argb: MUTED } }; a.fill = fill(GREY2); a.alignment = { vertical: 'bottom', horizontal: 'left', indent: 1, wrapText: true };
    a.border = { top: { style: 'medium', color: { argb: GREEN } }, left: { style: 'medium', color: { argb: 'FFFFFFFF' } } };
    b.value = value; b.numFmt = fmt; b.font = { name: 'Calibri', size: 20, bold: true, color: { argb: TEXT } }; b.fill = fill(GREY2); b.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    b.border = { left: { style: 'medium', color: { argb: 'FFFFFFFF' } } };
  });

  let r = 8;
  const section = (text) => {
    sy.mergeCells(r, 1, r, 4);
    const c = sy.getCell(r, 1); c.value = text; c.font = { name: 'Calibri', size: 13, bold: true, color: { argb: TEXT } };
    for (let k = 1; k <= 4; k++) sy.getCell(r, k).border = { bottom: { style: 'medium', color: { argb: GREEN } } };
    sy.getRow(r).height = 26; r += 1;
  };
  const tableHead = (labels) => {
    labels.forEach((t, i) => { const c = sy.getCell(r, i + 1); c.value = t; c.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = fill('FF1F2623'); c.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right', indent: i === 0 ? 1 : 0 }; });
    sy.getRow(r).height = 24; r += 1;
  };
  let zebra = 0;
  const dataRow = (values, fmts = []) => {
    values.forEach((v, i) => {
      const c = sy.getCell(r, i + 1); c.value = v; if (fmts[i]) c.numFmt = fmts[i];
      c.font = FONT({ size: 11 }); c.fill = fill(zebra % 2 ? GREY : 'FFFFFFFF');
      c.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right', indent: i === 0 ? 1 : 0 };
      c.border = { bottom: { style: 'thin', color: { argb: LINE } } };
    });
    sy.getRow(r).height = 22; zebra += 1; r += 1;
  };
  const table = (heading, labels, list, totalLabel) => {
    section(heading); tableHead(labels); zebra = 0;
    const withShare = labels.length === 4;
    const sum = list.reduce((t, g) => t + (g.total ?? 0), 0);
    list.forEach((g) => dataRow(withShare ? [g.name, g.count, g.total, sum ? g.total / sum : 0] : labels.length === 3 ? [g.name, g.count, g.total] : [g.name, g.count], [null, '0', EURO, '0%']));
    if (totalLabel && list.length > 1) {
      const vals = withShare ? [totalLabel, list.reduce((t, g) => t + g.count, 0), sum, 1] : [totalLabel, list.reduce((t, g) => t + g.count, 0), sum];
      vals.forEach((v, i) => { const c = sy.getCell(r, i + 1); c.value = v; c.numFmt = [null, '0', EURO, '0%'][i]; c.font = FONT({ bold: true, size: 11 }); c.fill = fill(GREEN_SOFT); c.border = { top: { style: 'medium', color: { argb: GREEN } } }; c.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right', indent: i === 0 ? 1 : 0 }; });
      sy.getRow(r).height = 24; r += 1;
    }
    r += 1;
  };
  table('Par chauffeur (hors annulées)', ['Chauffeur', 'Courses', 'Montant', 'Part du montant'], stats.byDriver, 'Total');
  table('Par statut', ['Statut', 'Réservations'], stats.byStatus);
  table('Par moyen de paiement (hors annulées)', ['Paiement', 'Courses', 'Montant'], stats.byPayment, 'Total');
  table('Par gamme (hors annulées)', ['Gamme', 'Courses', 'Montant'], stats.byCategory, 'Total');

  // Filtres utilises pour cette extraction.
  section('Filtres appliqués');
  info.forEach(([k, v], i) => {
    const a = sy.getCell(r, 1), b = sy.getCell(r, 2);
    a.value = k; a.font = FONT({ bold: true, size: 11, color: { argb: MUTED } }); a.alignment = { indent: 1, vertical: 'middle' };
    sy.mergeCells(r, 2, r, 4);
    b.value = v; b.font = FONT({ size: 11 }); b.alignment = { vertical: 'middle', wrapText: true };
    for (let k2 = 1; k2 <= 4; k2++) sy.getCell(r, k2).border = { bottom: { style: 'thin', color: { argb: LINE } } };
    sy.getRow(r).height = Math.max(22, Math.ceil(String(v).length / 52) * 15 + 7); r += 1;
  });
  sy.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, horizontalCentered: true };
  sy.headerFooter = { oddFooter: '&L&9Rennes VTC — Synthèse&R&9Page &P / &N' };
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
