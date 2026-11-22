// Tests des « 7 portes » de securite. Chaque test decrit le comportement SUR attendu : il echoue tant que la porte est ouverte.
// Lancer : npm run securite   (depuis le dossier backend)  -  ou : node --test tests/securite.test.js
//   - par defaut : demarre une copie locale du serveur (taches de fond coupees) et la teste avec la vraie base ;
//   - BACKEND_URL=https://app-rennesvtc.onrender.com : teste le serveur en ligne (le test de plantage est alors ignore, sauf ALLOW_CRASH_TEST=1).
// Les comptes et courses de test sont crees puis supprimes par le test lui-meme (« TEST SECURITE »), jamais ceux de vrais clients.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

// Cle publique (anon) et adresse de la base : lues dans le fichier .env de l'appli client (jamais ecrites ici).
function readEnvFile(file) {
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
}
const clientEnv = readEnvFile(path.join(__dirname, '../../apps/client/.env'));
const URL = process.env.SUPABASE_URL;
const ANON = clientEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anonClient = () => createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

const REMOTE = process.env.BACKEND_URL;
const PORT = 3998;
const BASE = REMOTE || `http://127.0.0.1:${PORT}`;
const TAG = 'TEST SECURITE';
const suffix = crypto.randomBytes(4).toString('hex');
const password = 'Tt!' + crypto.randomBytes(12).toString('hex'); // mot de passe jetable, jamais affiche

const created = { users: [], rides: [] };
let server = null;
const who = {}; // A, B (clients), C (candidat), D (chauffeur sans droit sur le prix)

async function api(p, { method = 'GET', token, body, headers = {} } = {}) {
  const res = await fetch(BASE + p, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch (e) { /* page ou texte */ }
  return { status: res.status, headers: res.headers, json };
}

async function makeUser(label, role, extra = {}) {
  const email = `secu-${label.toLowerCase()}-${suffix}@rennesvtc-test.local`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role } });
  assert.ifError(error);
  created.users.push(data.user.id);
  if (Object.keys(extra).length) await admin.from('profiles').update(extra).eq('id', data.user.id);
  const c = anonClient();
  const { data: s, error: e2 } = await c.auth.signInWithPassword({ email, password });
  assert.ifError(e2);
  who[label] = { id: data.user.id, email, token: s.session.access_token, db: c };
}

const baseRide = () => ({
  pickup_address: 'Test securite A', dropoff_address: 'Test securite B', vehicle_category: 'confort', service_type: 'trajet_simple',
  payment_method: 'especes', passenger_count: 1, price: 40, client_name: TAG, client_phone: '0000000000',
  scheduled_at: new Date(Date.now() + 5 * 864e5).toISOString(),
});
async function serviceRide(extra) {
  // Toujours « acceptee » par le chauffeur de test (ou dispatchee a un compte de test) : jamais visible des vrais chauffeurs.
  const { data, error } = await admin.from('rides').insert({ ...baseRide(), status: 'accepted', driver_id: who.D.id, ...extra }).select().single();
  assert.ifError(error);
  created.rides.push(data.id);
  return data;
}

test.before(async () => {
  if (!REMOTE) {
    server = spawn(process.execPath, ['src/index.js'], { cwd: path.join(__dirname, '..'), env: { ...process.env, PORT: String(PORT), DISABLE_JOBS: '1' }, stdio: 'ignore' });
    for (let i = 0; i < 40; i++) {
      try { if ((await fetch(BASE + '/')).ok) break; } catch (e) { /* pas encore pret */ }
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  await makeUser('A', 'client');
  await makeUser('B', 'client');
  await makeUser('C', 'candidat', { vehicle_categories: ['confort'], vehicle_category: 'confort' });
  await makeUser('D', 'chauffeur', { vehicle_categories: ['confort'], vehicle_category: 'confort', can_edit_price: false, is_owner: false });
});

test.after(async () => {
  if (created.rides.length) await admin.from('rides').delete().in('id', created.rides);
  await admin.from('rides').delete().eq('client_name', TAG); // filet : toute course de test oubliee
  for (const id of created.users) await admin.auth.admin.deleteUser(id);
  if (server) server.kill();
});

// ---------- Porte 6 : plantage par un inconnu ----------
test('6a. une signature mal formee ne plante pas le serveur', { skip: REMOTE && !process.env.ALLOW_CRASH_TEST }, async () => {
  const bad = encodeURIComponent('é'.repeat(40));
  const r1 = await fetch(`${BASE}/public/accueil/abc?sig=${bad}`).catch(() => ({ status: 0 }));
  assert.equal(r1.status, 403, 'la requete piegee doit etre refusee proprement (403)');
  const r2 = await fetch(`${BASE}/public/bon-commande/abc?d=x&sig=${bad}`).catch(() => ({ status: 0 }));
  assert.equal(r2.status, 403);
  const alive = await fetch(`${BASE}/`).then((r) => r.status).catch(() => 0);
  assert.equal(alive, 200, 'le serveur doit repondre apres la requete piegee');
});

// ---------- Portes 3 et 4 : prix et statut ----------
test('3a. un client ne peut pas se donner une course acceptee, attribuee, a prix libre', async () => {
  const { data, error } = await who.A.db.from('rides').insert({ ...baseRide(), client_id: who.A.id, status: 'accepted', driver_id: who.D.id, price: 0.01, ride_step: 'on_board', driver_note: 'Note officielle', surcharge_amount: -50 }).select().single();
  if (data) { created.rides.push(data.id); await admin.from('rides').delete().eq('id', data.id); }
  assert.ifError(error);
  assert.equal(data.status, 'pending');
  assert.equal(data.driver_id, null);
  assert.equal(data.ride_step, 'not_started');
  assert.equal(data.driver_note, null);
  assert.equal(Number(data.surcharge_amount), 0);
  assert.equal(data.price_checked, false, 'le prix saisi par un client doit etre marque « a verifier »');
});

test('3b. le serveur corrige un prix truque (mise a disposition) apres la creation', async () => {
  const { data: tarif } = await admin.from('pricing_hourly').select('price_per_hour').eq('vehicle_category', 'confort').single();
  const { data: ride, error } = await who.A.db.from('rides').insert({ ...baseRide(), client_id: who.A.id, service_type: 'mise_a_disposition', duration_hours: 3, price: 1 }).select().single();
  assert.ifError(error);
  created.rides.push(ride.id);
  const r = await api('/notify/new-ride', { method: 'POST', token: who.A.token, body: { rideId: ride.id } });
  assert.equal(r.status, 200);
  const { data: after } = await admin.from('rides').select('price, price_checked').eq('id', ride.id).single();
  assert.equal(Number(after.price), Math.round(3 * tarif.price_per_hour * 100) / 100, 'le prix doit etre recalcule par le serveur');
  await admin.from('rides').delete().eq('id', ride.id);
  assert.equal(after.price_checked, true);
});

test('3c. un chauffeur sans droit « prix » ne peut pas changer le prix de sa course', async () => {
  const ride = await serviceRide({ status: 'accepted', driver_id: who.D.id, price: 80 });
  const { error } = await who.D.db.from('rides').update({ price: 1 }).eq('id', ride.id);
  const { data: after } = await admin.from('rides').select('price').eq('id', ride.id).single();
  assert.ok(error, 'la base doit refuser la modification');
  assert.equal(Number(after.price), 80);
  // et il peut toujours faire avancer sa course
  const { error: e2 } = await who.D.db.from('rides').update({ ride_step: 'en_route' }).eq('id', ride.id);
  assert.ifError(e2);
});

test('4a. un candidat chauffeur (dossier non valide) ne voit ni n\'accepte une course dispatchee', async () => {
  const ride = await serviceRide({ status: 'dispatched', driver_id: null, dispatched_to: who.C.id });
  const { data: seen } = await who.C.db.from('rides').select('id').eq('id', ride.id);
  assert.equal((seen ?? []).length, 0, 'le candidat ne doit pas voir la course');
  await who.C.db.from('rides').update({ driver_id: who.C.id, status: 'accepted' }).eq('id', ride.id);
  const { data: after } = await admin.from('rides').select('status, driver_id').eq('id', ride.id).single();
  assert.equal(after.status, 'dispatched', 'le candidat ne doit pas pouvoir accepter');
  assert.equal(after.driver_id, null);
});

// ---------- Porte 4 : a qui appartient chaque donnee ----------
test('4b. un client ne lit, ne modifie et n\'annule pas la course d\'un autre', async () => {
  const ride = await serviceRide({ client_id: who.A.id });
  const { data: seen } = await who.B.db.from('rides').select('id').eq('id', ride.id);
  assert.equal((seen ?? []).length, 0);
  await who.B.db.from('rides').update({ price: 1 }).eq('id', ride.id);
  const { data: same } = await admin.from('rides').select('price').eq('id', ride.id).single();
  assert.equal(Number(same.price), 40);
  const { data: profiles } = await who.B.db.from('profiles').select('id').eq('id', who.A.id);
  assert.equal((profiles ?? []).length, 0);
  for (const [m, p, b] of [
    ['GET', `/rides/${ride.id}/messages`], ['POST', `/rides/${ride.id}/messages`, { body: 'x' }], ['GET', `/client/ride-driver/${ride.id}`],
    ['POST', `/client/rides/${ride.id}/cancel`, {}], ['POST', `/client/rides/${ride.id}/rating`, { rating: 5 }],
    ['POST', `/client/rides/${ride.id}/transport`, { type: 'vol', number: 'AF1234' }], ['GET', `/driver/ride-client/${ride.id}`], ['GET', `/driver/bon-commande/${ride.id}`],
  ]) {
    const r = await api(p, { method: m, token: who.B.token, body: b });
    assert.ok([403, 404].includes(r.status), `${m} ${p} doit refuser (obtenu ${r.status})`);
  }
  const { data: still } = await admin.from('rides').select('status').eq('id', ride.id).single();
  assert.equal(still.status, 'accepted', 'la course de A ne doit pas avoir bouge');
});

test('4c. les routes « notify » refusent un compte qui n\'est pas concerne par la course', async () => {
  const ride = await serviceRide({ client_id: who.A.id });
  for (const [p, b] of [
    ['/notify/surcharge', { rideId: ride.id, amount: 999, reason: 'Cliquez sur ce lien' }],
    ['/notify/new-ride', { rideId: ride.id, fromAdmin: true }],
    ['/notify/dispatch', { rideId: ride.id }],
    ['/notify/accepted', { rideId: ride.id }],
  ]) {
    const r = await api(p, { method: 'POST', token: who.B.token, body: b });
    assert.equal(r.status, 403, `${p} : un autre client doit etre refuse (obtenu ${r.status})`);
  }
  // les usages normaux continuent de marcher : le client de la course annonce sa propre demande
  const ok = await api('/notify/new-ride', { method: 'POST', token: who.A.token, body: { rideId: ride.id } });
  assert.equal(ok.status, 200);
});

// ---------- Porte 5 : espace admin ----------
test('5a. les routes admin refusent un compte connecte qui n\'est pas admin', async () => {
  for (const [m, p] of [['GET', '/admin/backup'], ['GET', '/admin/driver-invitations'], ['GET', '/admin/export/reservations'], ['POST', '/admin/chauffeurs'], ['DELETE', '/admin/rides/00000000-0000-0000-0000-000000000000'], ['GET', '/admin/navettes/events'], ['POST', '/admin/mail-test'], ['GET', '/clients/search?q=ab']]) {
    for (const who_ of [who.A, who.D, who.C]) {
      const r = await api(p, { method: m, token: who_.token, body: m === 'GET' ? undefined : {} });
      assert.equal(r.status, 403, `${m} ${p} doit etre refuse a un non-admin (obtenu ${r.status})`);
    }
    const anon = await api(p, { method: m, body: m === 'GET' ? undefined : {} });
    assert.equal(anon.status, 401, `${m} ${p} doit exiger une connexion (obtenu ${anon.status})`);
  }
});

// ---------- Porte 6 : limites ----------
test('6b. les routes publiques limitent le nombre d\'appels par minute', async () => {
  let blocked = 0;
  for (let i = 0; i < 70; i++) if ((await api('/public/estimate-price', { method: 'POST', body: {} })).status === 429) blocked++;
  assert.ok(blocked > 0, 'estimate-price doit finir par repondre 429');
  blocked = 0;
  for (let i = 0; i < 15; i++) if ((await api('/public/book', { method: 'POST', body: {} })).status === 429) blocked++;
  assert.ok(blocked > 0, 'public/book doit finir par repondre 429');
});

test('6c. un compte ne peut pas inonder les routes de notification', async () => {
  const ride = await serviceRide({ client_id: who.A.id });
  let blocked = 0;
  for (let i = 0; i < 45; i++) if ((await api('/notify/new-ride', { method: 'POST', token: who.A.token, body: { rideId: ride.id } })).status === 429) blocked++;
  assert.ok(blocked > 0, 'notify/new-ride doit finir par repondre 429');
});

// ---------- Porte 1 : ce que le navigateur recoit ----------
test('1a. en-tetes de securite et acces entre sites', async () => {
  const r = await api('/admin/', { headers: { Origin: 'https://exemple-attaquant.test' } });
  assert.equal(r.headers.get('x-powered-by'), null, 'ne pas annoncer Express');
  assert.match(String(r.headers.get('x-frame-options') || r.headers.get('content-security-policy') || ''), /DENY|frame-ancestors/i, 'le back-office ne doit pas pouvoir etre affiche dans la page d\'un autre site');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(r.headers.get('strict-transport-security'), 'HSTS attendu');
  assert.ok(r.headers.get('referrer-policy'));
  const acao = r.headers.get('access-control-allow-origin');
  assert.ok(!acao || (acao !== '*' && !acao.includes('attaquant')), 'un site inconnu ne doit pas etre autorise (CORS)');
});

test('1b. aucune cle secrete dans les pages envoyees au navigateur', async () => {
  const secrets = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.GMAIL_APP_PASSWORD, process.env.RESEND_API_KEY, process.env.GOOGLE_MAPS_API_KEY].filter((s) => s && s.length > 8);
  for (const p of ['/admin/', '/reserver/', '/suivi/x', '/conditions/', '/inscription-chauffeur/x', '/navette/x']) {
    const html = await (await fetch(BASE + p)).text();
    for (const s of secrets) assert.ok(!html.includes(s), `${p} contient un secret`);
    assert.ok(!/service_role|sb_secret_|AIza[0-9A-Za-z_-]{20,}/.test(html), `${p} contient un motif de cle secrete`);
  }
});

// ---------- Porte 3 : ce que voit un inconnu ----------
test('3d. un visiteur sans compte ne lit ni les donnees privees, ni l\'adresse admin, ni les plaques', async () => {
  const anon = anonClient();
  for (const t of ['profiles', 'rides', 'clients', 'ride_messages', 'driver_documents', 'driver_invitations', 'email_log', 'navette_signups', 'admin_settings']) {
    const { data } = await anon.from(t).select('*').limit(1);
    assert.equal((data ?? []).length, 0, `${t} : un inconnu ne doit rien lire`);
  }
  const { data: s } = await anon.from('app_settings').select('*').eq('id', true).single();
  assert.ok(s, 'les reglages d\'apparence restent publics');
  assert.equal('admin_email' in s, false, 'l\'adresse d\'alerte admin ne doit plus etre publique');
  const { error: e1 } = await anon.from('vehicles').select('plate').limit(1);
  const { error: e2 } = await anon.from('vehicles').select('driver_id').limit(1);
  assert.ok(e1 && e2, 'plaque et chauffeur ne doivent plus etre lisibles sans compte');
  const { data: v } = await anon.from('vehicles').select('vehicle_category, photo_url').eq('active', true);
  assert.ok((v ?? []).length > 0, 'les photos de gamme restent publiques (module de reservation)');
});

test('3e. un utilisateur ne peut pas se donner le role admin ni des droits', async () => {
  await who.A.db.from('profiles').update({ role: 'admin', is_owner: true, can_edit_price: true }).eq('id', who.A.id);
  const { data } = await admin.from('profiles').select('role, is_owner, can_edit_price').eq('id', who.A.id).single();
  assert.equal(data.role, 'client');
  assert.equal(data.is_owner, false);
  assert.equal(!!data.can_edit_price, false);
});
