const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export async function getDistanceKm(origin, destination) {
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  const meters = data.routes?.[0]?.legs?.[0]?.distance?.value;
  if (!meters) throw new Error("Impossible de calculer l'itineraire");
  return meters / 1000;
}
