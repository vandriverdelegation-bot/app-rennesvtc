// Formats francais deterministes (pas de dependance a Intl) pour l'accueil client.
export const COMPANY_PHONE = '+33768425262';

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const pad = (n) => String(n).padStart(2, '0');

export const longDay = (d) => cap(`${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`); // « Jeudi 26 novembre »
export const shortDay = (d) => `${cap(DAYS[d.getDay()].slice(0, 3))}. ${d.getDate()} ${MONTHS[d.getMonth()]}`; // « Mar. 14 octobre »
export const timeOf = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const euro = (price) => `${Number(price).toFixed(2).replace('.', ',')} €`;

// « Dans 23 jours », « Demain », « Dans 2 h »...
export function relativeWhen(d, now = new Date()) {
  const dayStart = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((dayStart(d) - dayStart(now)) / 86400000);
  if (days >= 2) return `Dans ${days} jours`;
  if (days === 1) return 'Demain';
  const mins = Math.round((d - now) / 60000);
  if (mins <= 0) return 'Maintenant';
  if (mins < 60) return `Dans ${mins} min`;
  return `Dans ${Math.round(mins / 60)} h`;
}

export const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

// Distance a vol d'oiseau entre deux points (km) ; la route reelle est environ 1,3 fois plus longue.
export function crowKm(a, b) {
  if (!a?.lat || !a?.lng || !b?.lat || !b?.lng) return null;
  const R = 6371, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// Minutes de trajet estimees en ville pour une distance a vol d'oiseau (x1,3, 25 km/h).
export const cityMinutes = (km) => Math.max(1, Math.round(((km * 1.3) / 25) * 60));
export const km1 = (km) => (Math.round(km * 10) / 10).toString().replace('.', ',');
