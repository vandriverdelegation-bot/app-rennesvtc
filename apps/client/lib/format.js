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
