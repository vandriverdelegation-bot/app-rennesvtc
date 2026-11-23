// Synchronisation des reservations du proprietaire (chauffeur) avec son Google Agenda.
// Connexion par OAuth (bouton du back-office) ; ensuite une tache toutes les 2 minutes ajoute, met a jour ou supprime les evenements.
// Inactif tant que GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET ne sont pas definis sur le serveur.
const crypto = require('crypto');
const { supabaseAdmin } = require('./supabaseAdmin');

const SCOPE = 'https://www.googleapis.com/auth/calendar.events openid email';
const BASE = () => (process.env.PUBLIC_URL || 'https://app-rennesvtc.onrender.com').replace(/\/$/, '');
const REDIRECT = () => `${BASE()}/admin/gcal/callback`;
// Compte Google dont l'agenda est utilise (reglable avec GOOGLE_AGENDA_COMPTE) ; tout autre compte est refuse.
const WANTED = () => (process.env.GOOGLE_AGENDA_COMPTE || 'rennesvtc@gmail.com').toLowerCase();
const configured = () => !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
const stateKey = () => process.env.LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev';

// « state » signe : evite qu'un tiers fasse enregistrer son agenda a la place de celui du proprietaire.
const signState = (ts = Date.now()) => `${ts}.${crypto.createHmac('sha256', stateKey()).update(String(ts)).digest('hex').slice(0, 32)}`;
function checkState(s, now = Date.now()) {
  const [ts, sig] = String(s ?? '').split('.');
  if (!ts || !sig || now - Number(ts) > 10 * 60 * 1000) return false;
  const good = signState(Number(ts)).split('.')[1];
  return good.length === sig.length && crypto.timingSafeEqual(Buffer.from(good), Buffer.from(sig));
}

const TRANSPORT = (r) => (r.transport_number ? `${r.transport_type === 'train' ? 'Train' : 'Vol'} ${r.transport_number}` : null);
const PAYMENT = { carte_a_bord: 'CB a bord', especes: 'Especes', compte: 'En compte' };

// Evenement Google Agenda d'une reservation (fonction pure, testee).
function eventFor(r) {
  const start = new Date(r.scheduled_at);
  const hours = r.service_type === 'mise_a_disposition' && r.duration_hours > 0 ? Number(r.duration_hours) : 1;
  const end = new Date(start.getTime() + hours * 3600000);
  const short = (s) => String(s ?? '').split(',').slice(0, 2).join(',').trim();
  const lines = [
    `Depart : ${r.pickup_address}`,
    ...(r.stop_addresses ?? []).map((s) => `Arret : ${s}`),
    `Destination : ${r.dropoff_address}`,
    TRANSPORT(r),
    r.client_name ? `Client : ${r.client_name}${r.client_phone ? ' (' + r.client_phone + ')' : ''}` : null,
    r.passenger_count ? `Passagers : ${r.passenger_count}` : null,
    r.price != null ? `Prix : ${r.price} EUR (${PAYMENT[r.payment_method] ?? ''})` : null,
    r.driver_note ? `Note : ${r.driver_note}` : null,
    r.tracking_token ? `Suivi : ${BASE()}/transport/${r.tracking_token}` : null,
  ].filter(Boolean);
  return {
    summary: `Rennes VTC : ${short(r.pickup_address)} > ${short(r.dropoff_address)}`,
    location: r.pickup_address,
    description: lines.join('\n'),
    start: { dateTime: start.toISOString(), timeZone: 'Europe/Paris' },
    end: { dateTime: end.toISOString(), timeZone: 'Europe/Paris' },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }] },
  };
}
const hashOf = (ev) => crypto.createHash('sha1').update(JSON.stringify(ev)).digest('hex');

let cache = { token: null, exp: 0 };
async function accessToken(conn) {
  if (cache.token && Date.now() < cache.exp - 60000) return cache.token;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_OAUTH_CLIENT_ID, client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET, refresh_token: conn.refresh_token, grant_type: 'refresh_token' }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw new Error(`Google : ${j.error_description || j.error || res.status}`);
  cache = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return cache.token;
}

async function gcal(conn, method, path, body) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(conn.calendar_id)}/events${path}`, {
    method,
    headers: { Authorization: `Bearer ${await accessToken(conn)}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (method === 'DELETE' && (res.status === 204 || res.status === 404 || res.status === 410)) return null;
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google Agenda ${res.status} : ${j.error?.message ?? ''}`);
  return j;
}

const COLS = 'id, status, driver_id, scheduled_at, service_type, duration_hours, pickup_address, dropoff_address, stop_addresses, client_name, client_phone, passenger_count, price, payment_method, driver_note, tracking_token, transport_type, transport_number, gcal_event_id, gcal_hash';

let last = { at: null, error: null }; // dernier resultat, affiche dans le back-office pour comprendre un probleme

// Aligne l'agenda sur les reservations du chauffeur connecte : ajoute, met a jour, supprime. Renvoie les compteurs.
async function syncAll() {
  const out = { added: 0, updated: 0, removed: 0, errors: 0 };
  last = { at: new Date().toISOString(), error: null };
  if (!configured()) return out;
  const { data: conn } = await supabaseAdmin.from('gcal_connection').select('*').eq('id', true).maybeSingle();
  if (!conn) return out;
  const since = new Date(Date.now() - 2 * 864e5).toISOString();
  const { data: mine, error: mineError } = await supabaseAdmin.from('rides').select(COLS).eq('driver_id', conn.driver_id).in('status', ['accepted', 'completed']).not('scheduled_at', 'is', null).gte('scheduled_at', since);
  if (mineError) { last.error = 'Lecture des courses : ' + mineError.message; out.errors++; return { ...out, error: last.error }; }
  for (const r of mine ?? []) {
    try {
      const ev = eventFor(r), h = hashOf(ev);
      if (!r.gcal_event_id) {
        const created = await gcal(conn, 'POST', '', ev);
        await supabaseAdmin.from('rides').update({ gcal_event_id: created.id, gcal_hash: h }).eq('id', r.id);
        out.added++;
      } else if (r.gcal_hash !== h) {
        await gcal(conn, 'PATCH', `/${encodeURIComponent(r.gcal_event_id)}`, ev);
        await supabaseAdmin.from('rides').update({ gcal_hash: h }).eq('id', r.id);
        out.updated++;
      }
    } catch (e) { out.errors++; last.error = last.error || e.message; console.error('agenda Google :', r.id, e.message); }
  }
  // Courses annulees, reattribuees ou sans heure : on retire l'evenement.
  const keep = new Set((mine ?? []).map((r) => r.id));
  const { data: synced } = await supabaseAdmin.from('rides').select('id, gcal_event_id').not('gcal_event_id', 'is', null);
  for (const r of (synced ?? []).filter((x) => !keep.has(x.id))) {
    try {
      await gcal(conn, 'DELETE', `/${encodeURIComponent(r.gcal_event_id)}`);
      await supabaseAdmin.from('rides').update({ gcal_event_id: null, gcal_hash: null }).eq('id', r.id);
      out.removed++;
    } catch (e) { out.errors++; last.error = last.error || e.message; console.error('agenda Google (suppression) :', r.id, e.message); }
  }
  return { ...out, error: last.error };
}

let timer = null;
const syncSoon = () => { clearTimeout(timer); timer = setTimeout(() => syncAll().catch((e) => console.error('agenda Google', e.message)), 4000); };

function registerGoogleAgenda(app, requireAdmin) {
  app.get('/admin/gcal/status', requireAdmin, async (req, res) => {
    const { data: conn } = await supabaseAdmin.from('gcal_connection').select('google_email, connected_at').eq('id', true).maybeSingle();
    const { count } = await supabaseAdmin.from('rides').select('id', { count: 'exact', head: true }).not('gcal_event_id', 'is', null);
    res.json({ configured: configured(), connected: !!conn, email: conn?.google_email ?? null, events: count ?? 0, last });
  });

  app.post('/admin/gcal/connect', requireAdmin, (req, res) => {
    if (!configured()) return res.status(400).json({ error: "Google Agenda n'est pas encore active sur le serveur (identifiants Google manquants)." });
    const q = new URLSearchParams({ client_id: process.env.GOOGLE_OAUTH_CLIENT_ID, redirect_uri: REDIRECT(), response_type: 'code', scope: SCOPE, access_type: 'offline', prompt: 'consent', state: signState(), login_hint: WANTED() });
    res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${q}` });
  });

  // Retour de Google (navigateur) : pas d'en-tete d'identification, la signature de « state » fait foi.
  app.get('/admin/gcal/callback', async (req, res) => {
    const back = (r) => res.redirect(`/admin/?gcal=${r}`);
    try {
      if (!configured() || !checkState(req.query.state) || !req.query.code) return back('refuse');
      const tok = await (await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code: String(req.query.code), client_id: process.env.GOOGLE_OAUTH_CLIENT_ID, client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET, redirect_uri: REDIRECT(), grant_type: 'authorization_code' }),
      })).json();
      if (!tok.refresh_token) return back('sans-jeton');
      // Google laisse decocher le droit « agenda » sur l'ecran d'autorisation : sans lui, tout ajout serait refuse (403).
      if (!String(tok.scope ?? '').includes('auth/calendar')) return back('droit-agenda-manquant');
      const email = tok.id_token ? JSON.parse(Buffer.from(tok.id_token.split('.')[1], 'base64url').toString()).email : null;
      if (!email || email.toLowerCase() !== WANTED()) return back('mauvais-compte');
      const { data: owner } = await supabaseAdmin.from('profiles').select('id').eq('is_owner', true).limit(1).maybeSingle();
      if (!owner) return back('sans-proprietaire');
      await supabaseAdmin.from('gcal_connection').upsert({ id: true, refresh_token: tok.refresh_token, calendar_id: 'primary', google_email: email, driver_id: owner.id });
      cache = { token: null, exp: 0 };
      syncAll().catch((e) => console.error('agenda Google', e.message));
      back('ok');
    } catch (e) { console.error('agenda Google (retour)', e.message); back('erreur'); }
  });

  app.post('/admin/gcal/sync', requireAdmin, async (req, res) => {
    try { res.json({ ok: true, ...(await syncAll()) }); } catch (e) { last.error = e.message; res.status(500).json({ error: e.message }); }
  });

  app.post('/admin/gcal/disconnect', requireAdmin, async (req, res) => {
    await supabaseAdmin.from('gcal_connection').delete().eq('id', true);
    cache = { token: null, exp: 0 };
    res.json({ ok: true });
  });
}

module.exports = { WANTED, registerGoogleAgenda, syncAll, syncSoon, eventFor, signState, checkState, hashOf };
