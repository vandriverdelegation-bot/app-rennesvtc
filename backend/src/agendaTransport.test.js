const test = require('node:test');
const assert = require('node:assert');
process.env.SUPABASE_URL ||= 'http://localhost'; process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'x';
const { normalizeTransport, buildIcs, transportPage } = require('./agendaTransport');

test('numero de vol et de train', () => {
  assert.deepStrictEqual(normalizeTransport('vol', ' af 1234 '), { ok: true, type: 'vol', number: 'AF1234' });
  assert.strictEqual(normalizeTransport('vol', 'TOTO').ok, false);
  assert.deepStrictEqual(normalizeTransport('train', 'tgv 8601'), { ok: true, type: 'train', number: 'TGV 8601' });
  assert.strictEqual(normalizeTransport('train', '12').ok, false);
  assert.deepStrictEqual(normalizeTransport('vol', ''), { ok: true, type: null, number: null });
  assert.strictEqual(normalizeTransport('bus', '1234').ok, false);
});

test('fichier agenda : dates UTC, lignes pliees, pas de client pour le client', () => {
  const ride = { id: 'abc', scheduled_at: '2026-11-20T18:30:00Z', pickup_address: 'Gare de Rennes, Place de la Gare, 35000 Rennes, France', dropoff_address: "Aéroport; Rennes, Saint-Jacques-de-la-Lande", passenger_count: 2, client_name: 'Jean Dupont', driver_note: 'Panneau au nom', transport_type: 'train', transport_number: 'TGV 8601' };
  const c = buildIcs(ride, false);
  assert.match(c, /DTSTART:20261120T183000Z/);
  assert.match(c, /DTEND:20261120T193000Z/);
  assert.ok(!c.includes('Jean Dupont'));
  assert.match(c.replace(/\r\n /g, ''), /Train TGV 8601/);
  assert.ok(c.split('\r\n').every((l) => Buffer.byteLength(l) <= 75));
  assert.match(buildIcs(ride, true).replace(/\r\n /g, ''), /Client : Jean Dupont/);
});

test('page de suivi : vol redirige, train copie le numero, rien sans numero', () => {
  assert.match(transportPage({ transport_type: 'vol', transport_number: 'AF1234' }), /flightaware\.com\/live\/flight\/AF1234/);
  const t = transportPage({ transport_type: 'train', transport_number: 'TGV 8601', pickup_address: '<b>x</b>' });
  assert.match(t, /sncf-connect\.com/); assert.match(t, /8601/); assert.ok(!t.includes('<b>x</b>'));
  assert.match(transportPage({}), /Aucun numéro/);
});

test('page train : suivi en direct avec retard, ou repli sans donnees', () => {
  const { transportPage } = require('./agendaTransport');
  const ride = { transport_type: 'train', transport_number: '8601', scheduled_at: '2026-11-20T10:00:00Z', pickup_address: 'Gare de Rennes' };
  const t0 = Date.parse('2026-11-20T10:00:00Z') / 1000;
  const train = { canceled: false, stops: [
    { name: 'Paris Montparnasse', arrTime: null, arrDelay: 0, depTime: t0 - 7200, depDelay: 0 },
    { name: 'Rennes', arrTime: t0 + 900, arrDelay: 900, depTime: t0 + 1080, depDelay: 900 },
  ] };
  const live = transportPage(ride, train);
  assert.match(live, /Retard \+15 min/);
  assert.match(live, /http-equiv="refresh"/);
  assert.match(transportPage(ride, null), /Ouvrir SNCF Connect/);
});
