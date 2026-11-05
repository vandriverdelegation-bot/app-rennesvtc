// Le calcul d'itineraire passe par le serveur, qui detient seul la cle Google.

async function fetchRoute(origin, destination) {
  const res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/public/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin, destination }),
  }).catch((e) => ({ ok: false, json: async () => ({ error: e.message }) }));
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.km) throw new Error(data.error || "Impossible de calculer l'itineraire");
  return data;
}

export async function getDistanceKm(origin, destination) {
  return (await fetchRoute(origin, destination)).km;
}
