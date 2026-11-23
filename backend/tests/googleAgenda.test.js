const test = require('node:test');
const assert = require('node:assert');
process.env.SUPABASE_URL ||= 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'x';
const { eventFor, signState, checkState, hashOf } = require('../src/googleAgenda');

const ride = { scheduled_at: '2026-11-26T15:25:00.000Z', service_type: 'trajet_simple', pickup_address: 'Sud-Gare, Rennes, France', dropoff_address: '1 Av. de l\'Aeroport, 35136 Saint-Jacques-de-la-Lande, France', client_name: 'Mme Dupont', client_phone: '0612345678', passenger_count: 4, price: 90, payment_method: 'especes', tracking_token: 'abc123', transport_type: 'train', transport_number: '8601', stop_addresses: ['Hotel X'] };

test('evenement Google Agenda : titre, heures, details', () => {
  const ev = eventFor(ride);
  assert.match(ev.summary, /^Rennes VTC : Sud-Gare, Rennes > /);
  assert.strictEqual(ev.start.dateTime, '2026-11-26T15:25:00.000Z');
  assert.strictEqual(ev.end.dateTime, '2026-11-26T16:25:00.000Z');
  assert.match(ev.description, /Train 8601/);
  assert.match(ev.description, /Mme Dupont \(0612345678\)/);
  assert.match(ev.description, /Arret : Hotel X/);
  assert.strictEqual(eventFor({ ...ride, service_type: 'mise_a_disposition', duration_hours: 3 }).end.dateTime, '2026-11-26T18:25:00.000Z');
});

test('empreinte : change quand la course change, pas sinon', () => {
  assert.strictEqual(hashOf(eventFor(ride)), hashOf(eventFor({ ...ride })));
  assert.notStrictEqual(hashOf(eventFor(ride)), hashOf(eventFor({ ...ride, price: 95 })));
  assert.notStrictEqual(hashOf(eventFor(ride)), hashOf(eventFor({ ...ride, scheduled_at: '2026-11-26T16:00:00.000Z' })));
});

test('state de connexion : valide 10 min, refuse une falsification', () => {
  const s = signState(1000);
  assert.ok(checkState(s, 1000 + 5 * 60000));
  assert.ok(!checkState(s, 1000 + 11 * 60000));
  assert.ok(!checkState(s.replace(/.$/, (c) => (c === '0' ? '1' : '0')), 1000 + 1000));
  assert.ok(!checkState('', 1000));
});

test('compte Google attendu : rennesvtc@gmail.com par defaut', () => {
  delete process.env.GOOGLE_AGENDA_COMPTE;
  assert.strictEqual(require('../src/googleAgenda').WANTED(), 'rennesvtc@gmail.com');
});
