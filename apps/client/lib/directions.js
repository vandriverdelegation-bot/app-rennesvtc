// Le calcul d'itineraire passe par le serveur, qui detient seul la cle Google.

// waypoints : arrets intermediaires ; la distance est celle du trajet complet, arrets compris.
async function fetchRoute(origin, destination, waypoints = []) {
  const res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/public/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin, destination, waypoints }),
  }).catch((e) => ({ ok: false, json: async () => ({ error: e.message }) }));
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.km) throw new Error(data.error || "Impossible de calculer l'itineraire");
  return data;
}

export async function getDistanceKm(origin, destination, waypoints) {
  return (await fetchRoute(origin, destination, waypoints)).km;
}
