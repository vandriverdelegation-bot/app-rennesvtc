// Calcul du prix d'un trajet simple, fidele a l'ancien back-office :
// tarif jour/nuit (dimanches et jours feries au tarif de nuit), majorations
// d'evenement en pourcentage, zones a tarif fixe (chaque zone a son propre tarif jour/nuit),
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

// Dimanches et jours feries : tarif de nuit toute la journee. Le samedi est au tarif de la semaine.
// Les heures et le jour sont ceux de l'appareil (le serveur est regle sur Europe/Paris).
function isNightRate(start, end, when) {
  return when.getDay() === 0 || isFrenchHoliday(when) || isNightTime(start, end, when);
}

// Majoration d'evenement (salon...) : pourcentage par gamme pendant une periode ; si plusieurs se chevauchent, la plus forte.
function eventPercent(events, category, when) {
  const t = when.getTime();
  const actives = (events ?? []).filter((e) => t >= Date.parse(e.starts_at) && t <= Date.parse(e.ends_at));
  return Math.max(0, ...actives.map((e) => Number(e['pct_' + category]) || 0));
}

// Prix majore et arrondi au centime ; vaut aussi pour la mise a disposition et les forfaits.
function applyEventSurcharge(price, events, category, when) {
  return Math.round(price * (1 + eventPercent(events, category, when) / 100) * 100) / 100;
}

// Retourne { price, manual, zoneUsed } ou price est null si manual=true (prix a fixer manuellement).
function computeTrajetSimplePrice({ pricing, zones, pickup, dropoff, km, when, events }) {
  if (pricing.manual_mode) {
    return { price: null, manual: true, zoneUsed: null };
  }

  const zonePickup = pricing.zone_pricing_pickup ? findMatchingZone(zones, pickup) : null;
  const zoneDropoff = !zonePickup && pricing.zone_pricing_dropoff ? findMatchingZone(zones, dropoff) : null;
  const zoneUsed = zonePickup ?? zoneDropoff ?? null;

  let price;
  let zoneFee = 0;

  if (zoneUsed) {
    const useNight = isNightRate(zoneUsed.night_start, zoneUsed.night_end, when);
    // Un tarif de nuit laisse a 0 reprend celui de jour.
    price = (useNight && Number(zoneUsed.night_price) > 0) ? zoneUsed.night_price : zoneUsed.day_price;
    price = Math.max(price, (useNight ? zoneUsed.min_price_night : zoneUsed.min_price_day) || 0);
    zoneFee = Number(zoneUsed.pickup_fee) || 0;
  } else {
    const night = isNightRate(pricing.night_start, pricing.night_end, when);
    const base = night ? pricing.base_price_night ?? pricing.base_price : pricing.base_price;
    const perKm = night ? pricing.price_per_km_night ?? pricing.price_per_km : pricing.price_per_km;
    const min = night ? pricing.min_price_night ?? pricing.min_price : pricing.min_price;
    price = Math.max(base + perKm * km, min);
  }

  price += zoneFee;

  return { price: applyEventSurcharge(price, events, pricing.vehicle_category, when), manual: false, zoneUsed };
}

module.exports = { computeTrajetSimplePrice, applyEventSurcharge, eventPercent, isFrenchHoliday, haversineKm };
