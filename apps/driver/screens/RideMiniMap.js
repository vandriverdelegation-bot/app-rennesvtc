import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import RouteSketch from './RouteSketch';
import { theme } from '@app-rennesvtc/shared';
import { getRouteInfo } from '../lib/directions';

// Carte miniature non interactive avec le trace du trajet, plus distance et duree.
export default function RideMiniMap({ pickupLat, pickupLng, dropoffLat, dropoffLng }) {
  const [routeInfo, setRouteInfo] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!pickupLat || !dropoffLat) return;
    setRouteInfo(null);
    setError(false);
    getRouteInfo({ lat: pickupLat, lng: pickupLng }, { lat: dropoffLat, lng: dropoffLng })
      .then(setRouteInfo)
      .catch(() => setError(true));
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng]);

  if (!pickupLat || !dropoffLat) return null;

  return (
    <View>
      <RouteSketch style={styles.map} points={[{ latitude: pickupLat, longitude: pickupLng }, { latitude: dropoffLat, longitude: dropoffLng }]} />
      {routeInfo ? (
        <Text style={styles.info}>{routeInfo.km} km · {routeInfo.durationMin} min</Text>
      ) : error ? (
        <Text style={styles.infoMuted}>Trajet indisponible</Text>
      ) : (
        <Text style={styles.infoMuted}>Calcul du trajet...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  map: { marginTop: 8 },
  info: { color: theme.colors.accent, fontWeight: '700', fontSize: 13, marginTop: 4 },
  infoMuted: { color: theme.colors.textMuted, fontSize: 12, marginTop: 4 },
});
