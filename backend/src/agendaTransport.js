// Agenda (fichier .ics) et suivi du vol / du train d'une reservation.
// Les deux pages publiques sont protegees par le lien secret de la course (tracking_token), comme la page de suivi.
const { supabaseAdmin } = require('./supabaseAdmin');

const TOKEN_RE = /^[a-z0-9]{16,64}$/i;

// Numero de vol ou de train saisi par le client : on garde une forme propre, ou on refuse.
function normalizeTransport(type, number) {
  const raw = String(number ?? '').trim().toUpperCase();
  if (!raw) return { ok: true, type: null, number: null };
  if (type === 'vol') {
    const n = raw.replace(/[\s-]/g, '');
    if (!/^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(n)) return { ok: false, error: 'Numero de vol invalide (exemple : AF1234).' };
    return { ok: true, type, number: n };
  }
  if (type === 'train') {
    const n = raw.replace(/\s+/g, ' ');
    if (!/^[A-Z ]{0,12}\d{3,6}$/.test(n)) return { ok: false, error: 'Numero de train invalide (exemple : 8601).' };
    return { ok: true, type, number: n };
  }
  return { ok: false, error: 'Type invalide (vol ou train).' };
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icsText = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsDate = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
// Lignes de 75 octets maximum (RFC 5545) : on coupe et on reprend avec une espace.
function fold(line) {
  const out = [];
  let rest = Buffer.from(line, 'utf8');
  while (rest.length > 74) {
    let cut = 74;
    while ((rest[cut] & 0xc0) === 0x80) cut--; // ne coupe pas un caractere en deux
    out.push(rest.subarray(0, cut).toString('utf8'));
    rest = Buffer.concat([Buffer.from(' '), rest.subarray(cut)]);
  }
  out.push(rest.toString('utf8'));
  return out.join('\r\n');
}

function transportLabel(ride) {
  if (!ride.transport_number) return null;
  return `${ride.transport_type === 'train' ? 'Train' : 'Vol'} ${ride.transport_number}`;
}

function buildIcs(ride, forDriver) {
  const start = new Date(ride.scheduled_at);
  const hours = ride.service_type === 'mise_a_disposition' && ride.duration_hours > 0 ? ride.duration_hours : 1;
  const end = new Date(start.getTime() + hours * 3600000);
  const place = (a) => String(a ?? '').split(',').slice(0, 2).join(',').trim();
  const lines = [
    `Depart : ${ride.pickup_address}`,
    ...(ride.stop_addresses ?? []).map((s) => `Arret : ${s}`),
    `Destination : ${ride.dropoff_address}`,
    transportLabel(ride) ? `${transportLabel(ride)}` : null,
    forDriver && ride.client_name ? `Client : ${ride.client_name}${ride.client_phone ? ` (${ride.client_phone})` : ''}` : null,
    ride.passenger_count ? `Passagers : ${ride.passenger_count}` : null,
    forDriver && ride.driver_note ? `Note : ${ride.driver_note}` : null,
    'Rennes VTC',
  ].filter(Boolean);
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rennes VTC//Reservation//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${ride.id}@rennesvtc.com`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(`Rennes VTC : ${place(ride.pickup_address)} > ${place(ride.dropoff_address)}`)}`,
    `LOCATION:${icsText(ride.pickup_address)}`,
    `DESCRIPTION:${icsText(lines.join('\n'))}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Course Rennes VTC dans 1 heure',
    'TRIGGER:-PT1H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return ics.map(fold).join('\r\n') + '\r\n';
}

const PAGE_CSS = `*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#0B0C0B;color:#F4F6F2;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:flex;align-items:center;justify-content:center;padding:20px}
.card{width:100%;max-width:440px;background:#151815;border:1px solid #262b26;border-radius:24px;padding:28px 22px;text-align:center}
small{display:block;color:#9AA19A;font-size:13px;margin-bottom:6px}h1{margin:0 0 4px;font-size:40px;letter-spacing:.5px;color:#5BD42A}
p{margin:6px 0;color:#c9cfc8;line-height:1.4}.when{font-size:15px;margin-bottom:18px}
a.btn{display:block;margin-top:12px;padding:15px 16px;border-radius:14px;background:#5BD42A;color:#0B0C0B;font-weight:700;text-decoration:none;font-size:16px}
a.btn.alt{background:transparent;color:#F4F6F2;border:1px solid #3a413a;font-weight:600}
.note{margin-top:16px;font-size:13px;color:#9AA19A}.ok{color:#5BD42A;font-size:14px;margin-top:10px;min-height:18px}`;

function pageShell(inner, head = '') {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Suivi du vol ou du train</title>${head}<style>${PAGE_CSS}</style></head><body><div class="card">${inner}</div></body></html>`;
}

function whenText(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
}

function transportPage(ride) {
  if (!ride?.transport_number) {
    return pageShell('<h1 style="color:#F4F6F2;font-size:24px">Aucun numéro</h1><p>Le client n\'a pas indiqué de numéro de vol ou de train pour cette course.</p>');
  }
  const when = ride.scheduled_at ? `<p class="when">Course prévue le ${esc(whenText(ride.scheduled_at))}<br>${esc(ride.pickup_address)}</p>` : '';
  if (ride.transport_type === 'train') {
    const num = ride.transport_number;
    const digits = (num.match(/\d+$/) ?? [num])[0];
    const q = encodeURIComponent(`train ${digits} SNCF`);
    return pageShell(`
      <small>Train du client</small><h1>${esc(num)}</h1>${when}
      <a class="btn" id="go" href="https://www.sncf-connect.com/" target="_blank" rel="noopener">Ouvrir SNCF Connect</a>
      <a class="btn alt" href="https://www.google.com/search?q=${q}" target="_blank" rel="noopener">Chercher sur Google</a>
      <div class="ok" id="ok"></div>
      <p class="note">Le numéro <b>${esc(digits)}</b> est copié : collez-le dans la barre de recherche de SNCF Connect pour voir le train en direct (la SNCF ne propose pas de lien direct par numéro).</p>
      <script>(function(){var n=${JSON.stringify(digits)};var ok=document.getElementById('ok');function done(){ok.textContent='Numéro copié : '+n;}
      try{navigator.clipboard.writeText(n).then(done,function(){});}catch(e){}
      document.getElementById('go').addEventListener('click',function(){try{navigator.clipboard.writeText(n);}catch(e){}});})();</script>`);
  }
  const id = ride.transport_number;
  const fa = `https://www.flightaware.com/live/flight/${encodeURIComponent(id)}`;
  return pageShell(`
    <small>Vol du client</small><h1>${esc(id)}</h1>${when}
    <p id="msg">Ouverture du suivi en direct…</p>
    <a class="btn" href="${fa}">Suivre le vol en direct</a>
    <a class="btn alt" href="https://www.flightradar24.com/data/flights/${encodeURIComponent(id.toLowerCase())}">Flightradar24</a>
    <a class="btn alt" href="https://www.google.com/search?q=${encodeURIComponent('vol ' + id)}">Statut du vol (Google)</a>
    <script>if(!location.search.includes('stay')){setTimeout(function(){location.replace(${JSON.stringify(fa)});},700);}</script>`, '');
}

function registerAgendaTransport(app, requireSupabaseUser) {
  const loadByToken = async (token) => {
    if (!TOKEN_RE.test(String(token))) return null;
    const { data } = await supabaseAdmin
      .from('rides')
      .select('id, scheduled_at, service_type, duration_hours, pickup_address, dropoff_address, stop_addresses, passenger_count, client_name, client_phone, driver_note, transport_type, transport_number')
      .eq('tracking_token', token)
      .maybeSingle();
    return data;
  };

  // Fichier agenda (Apple Calendrier, Outlook, Google Agenda...) : ?role=driver ajoute client, telephone et note.
  app.get('/public/ics/:token', async (req, res) => {
    const ride = await loadByToken(req.params.token);
    if (!ride || !ride.scheduled_at) return res.status(404).send('Course introuvable');
    res.set({ 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="course-rennes-vtc.ics"', 'Cache-Control': 'no-store' });
    res.send(buildIcs(ride, req.query.role === 'driver'));
  });

  // Page « Suivre le vol / le train » ouverte par le bouton du chauffeur.
  app.get('/transport/:token', async (req, res) => {
    const ride = await loadByToken(req.params.token);
    if (!ride) return res.status(404).send(pageShell('<h1 style="color:#F4F6F2;font-size:24px">Lien introuvable</h1>'));
    res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.send(transportPage(ride));
  });

  // Le client indique ou corrige le numero de vol / train de sa reservation.
  app.post('/client/rides/:rideId/transport', requireSupabaseUser, async (req, res) => {
    const t = normalizeTransport(req.body?.type, req.body?.number);
    if (!t.ok) return res.status(400).json({ error: t.error });
    const { data: ride } = await supabaseAdmin.from('rides').select('id, client_id, status').eq('id', req.params.rideId).single();
    if (!ride || ride.client_id !== req.user.id || !['pending', 'dispatched', 'accepted'].includes(ride.status)) {
      return res.status(404).json({ error: 'Course introuvable' });
    }
    const { error } = await supabaseAdmin.from('rides').update({ transport_type: t.type, transport_number: t.number }).eq('id', ride.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true, transport_type: t.type, transport_number: t.number });
  });
}

module.exports = { registerAgendaTransport, normalizeTransport, buildIcs, transportPage, transportLabel };
