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

// Zone correspondante : tarif propre a la zone (jour), pas de calcul km.
const zone = {
  lat: 48.1, lng: -1.6, radius_km: 5,
  day_start: '07:00', day_end: '19:00', day_price: 20, min_price_day: 15,
  day_saturday_surcharge: 0, day_sunday_surcharge: 0, day_holiday_surcharge: 0,
  night_start: '19:00', night_end: '07:00', night_price: 25, min_price_night: 20,
  night_saturday_surcharge: 0, night_sunday_surcharge: 0, night_holiday_surcharge: 0,
  pickup_fee: 1,
};
const r3 = computeTrajetSimplePrice({
  pricing: { ...pricing, zone_pricing_pickup: true },
  zones: [zone],
  pickup: { lat: 48.1, lng: -1.6 }, dropoff: { lat: 49, lng: -1.7 },
  km: 50, when: new Date(2026, 2, 16, 14, 0),
});
assert.strictEqual(r3.price, 21, `zone jour attendu 21 (20 + prise en charge de la zone), obtenu ${r3.price}`);

// Meme zone mais de nuit : tarif nuit de la zone.
const r3b = computeTrajetSimplePrice({
  pricing: { ...pricing, zone_pricing_pickup: true },
  zones: [zone],
  pickup: { lat: 48.1, lng: -1.6 }, dropoff: { lat: 49, lng: -1.7 },
  km: 50, when: new Date(2026, 2, 16, 23, 0),
});
assert.strictEqual(r3b.price, 26, `zone nuit attendu 26 (25 + prise en charge de la zone), obtenu ${r3b.price}`);

// Mode manuel : pas de prix calcule.
const r4 = computeTrajetSimplePrice({ pricing: { ...pricing, manual_mode: true }, zones: [], pickup: {}, dropoff: {}, km: 0, when: new Date() });
assert.strictEqual(r4.price, null);
assert.strictEqual(r4.manual, true);

// Zone dont le tarif de nuit est vide : on garde le tarif de jour la nuit aussi.
const r5 = computeTrajetSimplePrice({
  pricing: { ...pricing, zone_pricing_pickup: true }, zones: [{ ...zone, night_price: 0, min_price_night: 0 }],
  pickup: { lat: 48.1, lng: -1.6 }, dropoff: { lat: 49, lng: -1.7 }, km: 50, when: new Date(2026, 2, 16, 23, 0),
});
assert.strictEqual(r5.price, 21, "zone sans tarif de nuit : tarif de jour");

// Zone sans tarif pour cette gamme (0 / 0) : le calcul classique reprend la main.
const r6 = computeTrajetSimplePrice({
  pricing: { ...pricing, zone_pricing_pickup: true }, zones: [{ ...zone, day_price: 0, night_price: 0 }],
  pickup: { lat: 48.1, lng: -1.6 }, dropoff: { lat: 49, lng: -1.7 }, km: 50, when: new Date(2026, 2, 16, 14, 0),
});
assert.strictEqual(r6.price, 55, "zone vide : calcul classique (5 + 50)");
assert.strictEqual(r6.zoneUsed, null);

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
