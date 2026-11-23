// Calcul du prix d'un trajet simple, fidele a l'ancien back-office :
// tarif jour/nuit (chacun avec ses propres majorations samedi/dimanche/
// ferie), zones a tarif fixe (chaque zone a son propre tarif jour/nuit),
// et mode Manuel (pas de calcul automatique).
// Pas de supplement : passagers et sieges enfants ne sont pas factures, et les arrets intermediaires
// sont deja dans le kilometrage (km = trajet complet, arrets compris). Seule la zone peut ajouter
// un supplement de prise en charge (identique pour toutes les gammes).

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

// Une zone sans tarif (jour et nuit a 0) pour cette gamme n'est pas concernee : le calcul classique s'applique.
function findMatchingZone(zones, point) {
  return (zones ?? []).find((z) => (Number(z.day_price) > 0 || Number(z.night_price) > 0) && haversineKm({ lat: z.lat, lng: z.lng }, point) <= z.radius_km);
}

function toMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function isNightTime(start, end, when) {
  if (!start || !end) return false;
  const minutes = when.getHours() * 60 + when.getMinutes();
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === e) return false;
  if (s < e) return minutes >= s && minutes < e;
  return minutes >= s || minutes < e; // plage a cheval sur minuit
}

// Ajoute la majoration samedi/dimanche/ferie qui correspond au jour de la semaine.
function applyWeekendSurcharge(price, when, surcharges) {
  if (isFrenchHoliday(when)) return price + surcharges.holiday;
  if (when.getDay() === 0) return price + surcharges.sunday;
  if (when.getDay() === 6) return price + surcharges.saturday;
  return price;
}

// Retourne { price, manual, zoneUsed } ou price est null si manual=true (prix a fixer manuellement).
function computeTrajetSimplePrice({ pricing, zones, pickup, dropoff, km, when }) {
  if (pricing.manual_mode) {
    return { price: null, manual: true, zoneUsed: null };
  }

  const zonePickup = pricing.zone_pricing_pickup ? findMatchingZone(zones, pickup) : null;
  const zoneDropoff = !zonePickup && pricing.zone_pricing_dropoff ? findMatchingZone(zones, dropoff) : null;
  const zoneUsed = zonePickup ?? zoneDropoff ?? null;

  let price;
  let zoneFee = 0;

  if (zoneUsed) {
    const useNight = isNightTime(zoneUsed.night_start, zoneUsed.night_end, when);
    // Un tarif de nuit laisse a 0 reprend celui de jour.
    price = (useNight && Number(zoneUsed.night_price) > 0) ? zoneUsed.night_price : zoneUsed.day_price;
    price = Math.max(price, (useNight ? zoneUsed.min_price_night : zoneUsed.min_price_day) || 0);
    price = applyWeekendSurcharge(price, when, useNight
      ? { saturday: zoneUsed.night_saturday_surcharge, sunday: zoneUsed.night_sunday_surcharge, holiday: zoneUsed.night_holiday_surcharge }
      : { saturday: zoneUsed.day_saturday_surcharge, sunday: zoneUsed.day_sunday_surcharge, holiday: zoneUsed.day_holiday_surcharge });
    zoneFee = Number(zoneUsed.pickup_fee) || 0;
  } else {
    const night = isNightTime(pricing.night_start, pricing.night_end, when);
    const base = night ? pricing.base_price_night ?? pricing.base_price : pricing.base_price;
    const perKm = night ? pricing.price_per_km_night ?? pricing.price_per_km : pricing.price_per_km;
    const min = night ? pricing.min_price_night ?? pricing.min_price : pricing.min_price;
    price = Math.max(base + perKm * km, min);
    price = applyWeekendSurcharge(price, when, night
      ? { saturday: pricing.night_saturday_surcharge, sunday: pricing.night_sunday_surcharge, holiday: pricing.night_holiday_surcharge }
      : { saturday: pricing.day_saturday_surcharge, sunday: pricing.day_sunday_surcharge, holiday: pricing.day_holiday_surcharge });
  }

  price += zoneFee;

  return { price: Math.round(price * 100) / 100, manual: false, zoneUsed };
}

module.exports = { computeTrajetSimplePrice, isFrenchHoliday, haversineKm };
