// Suivi d'un train par son numero, sans cle ni compte : donnees ouvertes SNCF en temps reel (GTFS-RT, TGV INOUI / OUIGO / Intercites / TER).
const { transit_realtime } = require('gtfs-realtime-bindings');
const GARES = require('./data/gares-sncf.json'); // code UIC -> nom de gare (extrait du GTFS SNCF)

const FEED_URL = 'https://proxy.transport.data.gouv.fr/resource/sncf-gtfs-rt-trip-updates';
const CACHE_MS = 60 * 1000;
let cache = { at: 0, trips: [] };

async function loadTrips() {
  if (Date.now() - cache.at < CACHE_MS) return cache.trips;
  const res = await fetch(FEED_URL, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`flux SNCF ${res.status}`);
  const feed = transit_realtime.FeedMessage.decode(new Uint8Array(await res.arrayBuffer()));
  cache = { at: Date.now(), trips: feed.entity.map((e) => e.tripUpdate).filter(Boolean) };
  return cache.trips;
}

const num = (v) => (v == null ? null : Number(v));
const plain = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Arrets du train dans l'ordre, avec heure reelle (heure prevue + retard) ; le retard est repris d'un arret au suivant s'il n'est pas redonne.
function stopsOf(tu) {
  let lastDelay = 0;
  return tu.stopTimeUpdate.map((s) => {
    const arr = s.arrival, dep = s.departure;
    const arrDelay = arr?.delay ?? dep?.delay ?? lastDelay;
    const depDelay = dep?.delay ?? arr?.delay ?? lastDelay;
    lastDelay = depDelay;
    const code = (String(s.stopId).match(/(\d{7,8})$/) || [])[1];
    return {
      name: GARES[code] ?? `Gare ${code ?? '?'}`,
      arrTime: num(arr?.time), arrDelay,
      depTime: num(dep?.time), depDelay,
      skipped: s.scheduleRelationship === 1,
    };
  });
}

// Train correspondant au numero, le plus proche de l'heure de la course. Renvoie null si inconnu.
async function findTrain(number, whenIso) {
  const n = (String(number).match(/\d+$/) || [])[0];
  if (!n) return null;
  const re = new RegExp(`^OCE[A-Z]{2}${n}F`);
  const target = whenIso ? new Date(whenIso).getTime() / 1000 : Date.now() / 1000;
  let best = null;
  for (const tu of await loadTrips()) {
    if (!re.test(tu.trip?.tripId ?? '')) continue;
    const stops = stopsOf(tu);
    const times = stops.flatMap((s) => [s.arrTime, s.depTime]).filter(Boolean);
    if (!times.length) continue;
    const gap = Math.min(...times.map((t) => Math.abs(t - target)));
    if (!best || gap < best.gap) best = { gap, stops, canceled: tu.trip.scheduleRelationship === 3 };
  }
  return best && best.gap < 36 * 3600 ? best : null; // pas de train ce jour-la dans les donnees
}

// Arret de la gare de depart du client (le nom de la gare figure dans l'adresse) ; sinon terminus. shortcut: "Paris Montparnasse" tape « Montparnasse » n'est pas reconnu, on retombe sur le terminus.
function pickStop(stops, pickupAddress) {
  const addr = ` ${plain(pickupAddress).replace(/[^a-z0-9]+/g, ' ')} `;
  const hit = stops.filter((s) => addr.includes(` ${plain(s.name).replace(/[^a-z0-9]+/g, ' ').trim()} `)).sort((a, b) => b.name.length - a.name.length)[0];
  return hit ?? stops[stops.length - 1];
}

module.exports = { findTrain, pickStop };
