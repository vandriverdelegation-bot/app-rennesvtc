// Verification rapide du moteur de tarification. Lancer avec : node pricingEngine.test.js
const assert = require('assert');
const { computeTrajetSimplePrice, isFrenchHoliday } = require('./pricingEngine');

assert.strictEqual(isFrenchHoliday(new Date(2026, 11, 25)), true, 'Noel est ferie');
assert.strictEqual(isFrenchHoliday(new Date(2026, 3, 6)), true, 'lundi de Paques 2026 est ferie');
assert.strictEqual(isFrenchHoliday(new Date(2026, 2, 15)), false, 'jour normal non ferie');

const pricing = {
  base_price: 5, price_per_km: 1, min_price: 10,
  base_price_night: 8, price_per_km_night: 1.5, min_price_night: 15,
  night_start: '22:00', night_end: '06:00',
  day_saturday_surcharge: 3, day_sunday_surcharge: 5, day_holiday_surcharge: 10,
  night_saturday_surcharge: 3, night_sunday_surcharge: 5, night_holiday_surcharge: 10,
  price_per_passenger: 2, passenger_threshold: 3,
  child_seat_price: 4, booster_seat_price: 2, stop_price: 3, pickup_fee: 1,
  manual_mode: false, zone_pricing_pickup: false, zone_pricing_dropoff: false,
};

// Trajet de jour, semaine, sans supplement : base + km*prix, + prise en charge.
const r1 = computeTrajetSimplePrice({
  pricing, zones: [], pickup: { lat: 48.1, lng: -1.6 }, dropoff: { lat: 48.2, lng: -1.7 },
  km: 10, when: new Date(2026, 2, 16, 14, 0), passengerCount: 1, childSeats: 0, boosterSeats: 0, stopsCount: 0,
});
assert.strictEqual(r1.price, 16, `jour simple attendu 16, obtenu ${r1.price}`); // 5 + 10*1 + 1(prise en charge)

// Trajet de nuit, samedi : tarif nuit + majoration samedi (celle de nuit).
const r2 = computeTrajetSimplePrice({
  pricing, zones: [], pickup: { lat: 48.1, lng: -1.6 }, dropoff: { lat: 48.2, lng: -1.7 },
  km: 10, when: new Date(2026, 2, 14, 23, 30), passengerCount: 1, childSeats: 0, boosterSeats: 0, stopsCount: 0,
});
assert.strictEqual(r2.price, 27, `nuit samedi attendu 27, obtenu ${r2.price}`); // 8 + 15 + 3 + 1

// Zone correspondante : tarif propre a la zone (jour), pas de calcul km.
const zone = {
  lat: 48.1, lng: -1.6, radius_km: 5,
  day_start: '07:00', day_end: '19:00', day_price: 20, min_price_day: 15,
  day_saturday_surcharge: 0, day_sunday_surcharge: 0, day_holiday_surcharge: 0,
  night_start: '19:00', night_end: '07:00', night_price: 25, min_price_night: 20,
  night_saturday_surcharge: 0, night_sunday_surcharge: 0, night_holiday_surcharge: 0,
  price_per_passenger: 0, passenger_threshold: 0, pickup_fee: 1,
};
const r3 = computeTrajetSimplePrice({
  pricing: { ...pricing, zone_pricing_pickup: true },
  zones: [zone],
  pickup: { lat: 48.1, lng: -1.6 }, dropoff: { lat: 49, lng: -1.7 },
  km: 50, when: new Date(2026, 2, 16, 14, 0), passengerCount: 1, childSeats: 0, boosterSeats: 0, stopsCount: 0,
});
assert.strictEqual(r3.price, 21, `zone jour attendu 21 (20 + prise en charge de la zone), obtenu ${r3.price}`);

// Meme zone mais de nuit : tarif nuit de la zone.
const r3b = computeTrajetSimplePrice({
  pricing: { ...pricing, zone_pricing_pickup: true },
  zones: [zone],
  pickup: { lat: 48.1, lng: -1.6 }, dropoff: { lat: 49, lng: -1.7 },
  km: 50, when: new Date(2026, 2, 16, 23, 0), passengerCount: 1, childSeats: 0, boosterSeats: 0, stopsCount: 0,
});
assert.strictEqual(r3b.price, 26, `zone nuit attendu 26 (25 + prise en charge de la zone), obtenu ${r3b.price}`);

// Mode manuel : pas de prix calcule.
const r4 = computeTrajetSimplePrice({ pricing: { ...pricing, manual_mode: true }, zones: [], pickup: {}, dropoff: {}, km: 0, when: new Date(), passengerCount: 1, childSeats: 0, boosterSeats: 0, stopsCount: 0 });
assert.strictEqual(r4.price, null);
assert.strictEqual(r4.manual, true);

console.log('pricingEngine: OK');
