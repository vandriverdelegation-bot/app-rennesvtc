import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import RouteSketch from './RouteSketch';
import { theme, themedStyles } from '@app-rennesvtc/shared';
import { getRouteInfo } from '../lib/directions';
import { Icon } from '../icons';

// Carte miniature non interactive : distance et duree a gauche, trace du trajet a droite.
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
    <View style={styles.box}>
      <View style={styles.info}>
        <Icon name="route" color="g" size={30} />
        {routeInfo ? (
          <Text style={styles.text}>
            <Text style={styles.km}>{routeInfo.km} km</Text>
            <Text style={styles.min}> • {routeInfo.durationMin} min</Text>
          </Text>
        ) : (
          <Text style={styles.muted}>{error ? 'Trajet indisponible' : 'Calcul du trajet...'}</Text>
        )}
      </View>
      <RouteSketch
        style={styles.map}
        height={86}
        points={[{ latitude: pickupLat, longitude: pickupLng }, { latitude: dropoffLat, longitude: dropoffLng }]}
      />
    </View>
  );
}

const styles = themedStyles(() => ({
  box: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.cardBorder, borderRadius: 22, paddingLeft: 16, paddingRight: 6, paddingVertical: 8, gap: 10 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { fontSize: 17 },
  km: { color: theme.colors.text, fontWeight: '600' },
  min: { color: theme.colors.accent, fontWeight: '600' },
  muted: { color: theme.colors.textMuted, fontSize: 13 },
  map: { flex: 1, width: undefined, borderWidth: 0, backgroundColor: 'transparent' },
}));
