// Vol / train et ajout a l'agenda, communs aux deux applis (JavaScript pur, aucun module natif).

// Le depart est-il un aeroport (vol) ou une gare (train) ? Reponse : 'vol', 'train' ou null.
function detectTransport(address) {
  const a = String(address ?? '');
  if (/a[ée]roport|airport|a[ée]rogare/i.test(a)) return 'vol';
  if (/\bgare\b|train station|railway station/i.test(a) && !/routi[eè]re|bus station/i.test(a)) return 'train';
  return null;
}

const TRANSPORT_LABELS = {
  vol: { name: 'vol', field: 'Numéro de vol', example: 'AF1234', follow: 'Suivre le vol' },
  train: { name: 'train', field: 'Numéro de train', example: '8601', follow: 'Suivre le train' },
};

const utc = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// Lien « Ajouter à l'agenda » : Google Agenda sur Android, fichier .ics (Calendrier Apple ou autre) ailleurs.
// ride doit contenir scheduled_at et tracking_token ; renvoie null si la course n'a pas d'heure.
function agendaUrl(ride, { backendUrl, platform, role = 'client' }) {
  if (!ride?.scheduled_at || !ride?.tracking_token) return null;
  if (platform === 'android') {
    const start = new Date(ride.scheduled_at);
    const hours = ride.service_type === 'mise_a_disposition' && ride.duration_hours > 0 ? ride.duration_hours : 1;
    const end = new Date(start.getTime() + hours * 3600000);
    const short = (s) => String(s ?? '').split(',').slice(0, 2).join(',').trim();
    const details = [
      `Départ : ${ride.pickup_address}`,
      ...(ride.stop_addresses ?? []).map((s) => `Arrêt : ${s}`),
      `Destination : ${ride.dropoff_address}`,
      ride.transport_number ? `${ride.transport_type === 'train' ? 'Train' : 'Vol'} ${ride.transport_number}` : null,
      ride.passenger_count ? `Passagers : ${ride.passenger_count}` : null,
      'Rennes VTC',
    ].filter(Boolean).join('\n');
    // URLSearchParams est incomplet dans React Native : on encode a la main.
    const q = Object.entries({
      action: 'TEMPLATE',
      text: `Rennes VTC : ${short(ride.pickup_address)} > ${short(ride.dropoff_address)}`,
      dates: `${utc(start)}/${utc(end)}`,
      details,
      location: ride.pickup_address ?? '',
    }).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return `https://calendar.google.com/calendar/render?${q}`;
  }
  return `${backendUrl}/public/ics/${ride.tracking_token}${role === 'driver' ? '?role=driver' : ''}`;
}

// Page de suivi du vol / du train (le serveur renvoie vers le suivi en direct).
const transportUrl = (backendUrl, ride) => (ride?.transport_number && ride?.tracking_token ? `${backendUrl}/transport/${ride.tracking_token}` : null);

module.exports = { detectTransport, TRANSPORT_LABELS, agendaUrl, transportUrl };
