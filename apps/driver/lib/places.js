const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export async function autocompleteAddress(input) {
  if (!input || input.length < 3) return [];
  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
    },
    body: JSON.stringify({
      input,
      includedRegionCodes: ['fr'],
    }),
  });
  const data = await res.json();
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter(Boolean)
    .map((p) => ({ placeId: p.placeId, text: p.text.text }));
}

export async function getPlaceLocation(placeId) {
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'location,formattedAddress',
    },
  });
  const data = await res.json();
  return {
    address: data.formattedAddress,
    lat: data.location.latitude,
    lng: data.location.longitude,
  };
}
