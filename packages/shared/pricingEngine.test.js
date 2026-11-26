// Verification rapide du moteur de tarification. Lancer avec : node pricingEngine.test.js
const assert = require('assert');
const { computeTrajetSimplePrice, applyEventSurcharge, isFrenchHoliday } = require('./pricingEngine');

assert.strictEqual(isFrenchHoliday(new Date(2026, 11, 25)), true, 'Noel est ferie');
assert.strictEqual(isFrenchHoliday(new Date(2026, 3, 6)), true, 'lundi de Paques 2026 est ferie');
assert.strictEqual(isFrenchHoliday(new Date(2026, 2, 15)), false, 'jour normal non ferie');

const pricing = {
  base_price: 5, price_per_km: 1, min_price: 10,
  base_price_night: 8, price_per_km_night: 1.5, min_price_night: 15,
  night_start: '22:00', night_end: '06:00',
  day_saturday_surcharge: 3, day_sunday_surcharge: 5, day_holiday_surcharge: 10,
  night_saturday_surcharge: 3, night_sunday_surcharge: 5, night_holiday_surcharge: 10,
  manual_mode: false, zone_pricing_pickup: false, zone_pricing_dropoff: false,
};

// Trajet de jour, semaine : prise en charge + km*prix (les arrets sont deja dans le km).
const r1 = computeTrajetSimplePrice({
  pricing, zones: [], pickup: { lat: 48.1, lng: -1.6 }, dropoff: { lat: 48.2, lng: -1.7 },
  km: 10, when: new Date(2026, 2, 16, 14, 0),
});
assert.strictEqual(r1.price, 15, `jour simple attendu 15, obtenu ${r1.price}`); // 5 + 10*1

// Trajet de nuit, un samedi : tarif de nuit, sans majoration de week-end.
const r2 = computeTrajetSimplePrice({
  pricing, zones: [], pickup: { lat: 48.1, lng: -1.6 }, dropoff: { lat: 48.2, lng: -1.7 },
  km: 10, when: new Date(2026, 2, 14, 23, 30),
});
assert.strictEqual(r2.price, 23, `nuit samedi attendu 23, obtenu ${r2.price}`); // 8 + 15

// Zone correspondante : prise en charge de la gamme + km au prix de la zone, minimum de la zone, supplement de la zone.
const zone = {
  lat: 48.1, lng: -1.6, radius_km: 5,
  price_per_km_day: 2, min_price_day: 30, price_per_km_night: 3, min_price_night: 40,
  night_start: '19:00', night_end: '07:00', pickup_fee: 1,
};
const inZone = (km, when, z = zone) => computeTrajetSimplePrice({
  pricing: { ...pricing, zone_pricing_pickup: true }, zones: [z],
  pickup: { lat: 48.1, lng: -1.6 }, dropoff: { lat: 49, lng: -1.7 }, km, when,
});
const jour = new Date(2026, 2, 16, 14, 0), nuit = new Date(2026, 2, 16, 23, 0);
assert.strictEqual(inZone(50, jour).price, 106, 'zone jour : 5 + 50 x 2 + 1');
assert.strictEqual(inZone(50, nuit).price, 159, 'zone nuit : 8 + 50 x 3 + 1');
assert.strictEqual(inZone(2, jour).price, 31, 'minimum de la zone (30) + supplement 1');
assert.strictEqual(inZone(50, nuit, { ...zone, price_per_km_night: 0, min_price_night: 0 }).price, 109, 'nuit vide : km de jour, prise en charge de nuit');
const horsGamme = inZone(50, jour, { ...zone, price_per_km_day: 0 });
assert.strictEqual(horsGamme.price, 55, 'gamme non concernee : calcul classique');
assert.strictEqual(horsGamme.zoneUsed, null);

// Mode manuel : pas de prix calcule.
const r4 = computeTrajetSimplePrice({ pricing: { ...pricing, manual_mode: true }, zones: [], pickup: {}, dropoff: {}, km: 0, when: new Date() });
assert.strictEqual(r4.price, null);
assert.strictEqual(r4.manual, true);

const base = { zones: [], pickup: { lat: 48.1, lng: -1.6 }, dropoff: { lat: 48.2, lng: -1.7 }, km: 10 };
const at = (when, extra) => computeTrajetSimplePrice({ ...base, pricing: { ...pricing, vehicle_category: 'van' }, when, ...extra }).price;
// Samedi apres-midi = tarif de jour ; dimanche et jour ferie apres-midi = tarif de nuit.
assert.strictEqual(at(new Date(2026, 2, 14, 14, 0)), 15, 'samedi : tarif de jour');
assert.strictEqual(at(new Date(2026, 2, 15, 14, 0)), 23, 'dimanche : tarif de nuit');
assert.strictEqual(at(new Date(2026, 6, 14, 14, 0)), 23, '14 juillet : tarif de nuit');

// Majoration d'evenement : seulement pendant la periode, par gamme, la plus forte si chevauchement.
const salon = (de, fin, van) => ({ starts_at: de.toISOString(), ends_at: fin.toISOString(), pct_confort: 5, pct_affaires: 5, pct_van: van });
const events = [salon(new Date(2026, 2, 16, 8, 0), new Date(2026, 2, 18, 20, 0), 20), salon(new Date(2026, 2, 16, 0, 0), new Date(2026, 2, 16, 23, 0), 10)];
assert.strictEqual(at(new Date(2026, 2, 16, 14, 0), { events }), 18, 'pendant le salon : +20 %');
assert.strictEqual(at(new Date(2026, 2, 19, 14, 0), { events }), 15, 'apres le salon : prix normal');
assert.strictEqual(applyEventSurcharge(100, events, 'confort', new Date(2026, 2, 17, 10, 0)), 105);
assert.strictEqual(applyEventSurcharge(100, undefined, 'confort', new Date()), 100);

console.log('pricingEngine: OK');
