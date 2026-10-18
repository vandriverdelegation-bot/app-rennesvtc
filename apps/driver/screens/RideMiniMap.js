import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
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

  const midLat = (pickupLat + dropoffLat) / 2;
  const midLng = (pickupLng + dropoffLng) / 2;
  const latDelta = Math.max(Math.abs(pickupLat - dropoffLat) * 1.8, 0.02);
  const lngDelta = Math.max(Math.abs(pickupLng - dropoffLng) * 1.8, 0.02);

  return (
    <View>
      <MapView
        style={styles.map}
        initialRegion={{ latitude: midLat, longitude: midLng, latitudeDelta: latDelta, longitudeDelta: lngDelta }}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <Marker coordinate={{ latitude: pickupLat, longitude: pickupLng }} pinColor={theme.colors.accent} />
        <Marker coordinate={{ latitude: dropoffLat, longitude: dropoffLng }} pinColor="red" />
        <Polyline
          coordinates={[
            { latitude: pickupLat, longitude: pickupLng },
            { latitude: dropoffLat, longitude: dropoffLng },
          ]}
          strokeColor={theme.colors.accent}
          strokeWidth={3}
        />
      </MapView>
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
  map: { width: '100%', height: 110, borderRadius: theme.radius, marginTop: 8 },
  info: { color: theme.colors.accent, fontWeight: '700', fontSize: 13, marginTop: 4 },
  infoMuted: { color: theme.colors.textMuted, fontSize: 12, marginTop: 4 },
});
