const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

// Les appels Google passent par le serveur, qui detient seul la cle (rien de secret dans l'appli).
export async function autocompleteAddress(input) {
  if (!input || input.length < 3) return [];
  const res = await fetch(`${BACKEND}/public/places/autocomplete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  });
  const data = await res.json().catch(() => ({}));
  return data.suggestions ?? [];
}

export async function getPlaceLocation(placeId) {
  const res = await fetch(`${BACKEND}/public/places/details`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placeId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Adresse introuvable');
  return { address: data.address, lat: data.lat, lng: data.lng };
}
