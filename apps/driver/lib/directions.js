const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export async function getDistanceKm(origin, destination) {
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&key=${API_KEY}`;
  let data = {};
  for (let attempt = 0; attempt < 2; attempt++) {
    data = await fetch(url).then((r) => r.json()).catch((e) => ({ status: 'RESEAU', error_message: e.message }));
    const meters = data.routes?.[0]?.legs?.[0]?.distance?.value;
    if (meters) return meters / 1000;
    await new Promise((r) => setTimeout(r, 600));
  }
  throw new Error(data.error_message || data.status || "Impossible de calculer l'itineraire");
}

// Distance (km) et duree (minutes) du trajet, pour l'aperçu d'une course.
export async function getRouteInfo(origin, destination) {
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  const leg = data.routes?.[0]?.legs?.[0];
  if (!leg) throw new Error("Impossible de calculer l'itineraire");
  return { km: Math.round((leg.distance.value / 1000) * 10) / 10, durationMin: Math.round(leg.duration.value / 60) };
}
