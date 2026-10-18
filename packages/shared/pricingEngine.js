// Calcul du prix d'un trajet simple, fidele a l'ancien back-office :
// tarif jour/nuit, majoration samedi/dimanche/jour ferie, zones a tarif
// fixe, supplements (passagers, sieges auto, rehausseurs, points d'arret),
// prise en charge, et mode Manuel (pas de calcul automatique).

function easterSunday(year) {
  // Algorithme de Meeus/Jones/Butcher.
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isFrenchHoliday(date) {
  const year = date.getFullYear();
  const fixed = [
    [0, 1], // Jour de l'an
    [4, 1], // Fete du travail
    [4, 8], // Victoire 1945
    [6, 14], // Fete nationale
    [7, 15], // Assomption
    [10, 1], // Toussaint
    [10, 11], // Armistice
    [11, 25], // Noel
  ];
  if (fixed.some(([month, day]) => date.getMonth() === month && date.getDate() === day)) return true;

  const easter = easterSunday(year);
  const movable = [addDays(easter, 1), addDays(easter, 39), addDays(easter, 50)]; // lundi de Paques, Ascension, lundi de Pentecote
  return movable.some((d) => sameDay(d, date));
}

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function findMatchingZone(zones, point) {
  return (zones ?? []).find((z) => haversineKm({ lat: z.lat, lng: z.lng }, point) <= z.radius_km);
}

function isNightTime(pricing, when) {
  if (!pricing.night_start || !pricing.night_end) return false;
  const toMinutes = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const minutes = when.getHours() * 60 + when.getMinutes();
  const start = toMinutes(pricing.night_start);
  const end = toMinutes(pricing.night_end);
  if (start === end) return false;
  if (start < end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end; // plage a cheval sur minuit
}

// Retourne { price, manual, zoneUsed } ou price est null si manual=true (prix a fixer manuellement).
function computeTrajetSimplePrice({ pricing, zones, pickup, dropoff, km, when, passengerCount, childSeats, boosterSeats, stopsCount }) {
  if (pricing.manual_mode) {
    return { price: null, manual: true, zoneUsed: null };
  }

  const zonePickup = pricing.zone_pricing_pickup ? findMatchingZone(zones, pickup) : null;
  const zoneDropoff = !zonePickup && pricing.zone_pricing_dropoff ? findMatchingZone(zones, dropoff) : null;
  const zoneUsed = zonePickup ?? zoneDropoff ?? null;

  let price;
  if (zoneUsed) {
    price = zoneUsed.price;
  } else {
    const night = isNightTime(pricing, when);
    const base = night ? pricing.base_price_night ?? pricing.base_price : pricing.base_price;
    const perKm = night ? pricing.price_per_km_night ?? pricing.price_per_km : pricing.price_per_km;
    const min = night ? pricing.min_price_night ?? pricing.min_price : pricing.min_price;
    price = Math.max(base + perKm * km, min);
  }

  if (isFrenchHoliday(when)) {
    price += pricing.holiday_surcharge;
  } else if (when.getDay() === 0) {
    price += pricing.sunday_surcharge;
  } else if (when.getDay() === 6) {
    price += pricing.saturday_surcharge;
  }

  if (passengerCount > pricing.passenger_threshold) {
    price += (passengerCount - pricing.passenger_threshold) * pricing.price_per_passenger;
  }
  price += (childSeats ?? 0) * pricing.child_seat_price;
  price += (boosterSeats ?? 0) * pricing.booster_seat_price;
  price += (stopsCount ?? 0) * pricing.stop_price;
  price += pricing.pickup_fee;

  return { price: Math.round(price * 100) / 100, manual: false, zoneUsed };
}

module.exports = { computeTrajetSimplePrice, isFrenchHoliday, haversineKm };
