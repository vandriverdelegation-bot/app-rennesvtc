import { useState } from 'react';
import { View } from 'react-native';
import { theme } from '@app-rennesvtc/shared';

// Schema du trajet sans carte native : depart (vert), arrivee (rouge) et chauffeur (noir) projetes dans un cadre.
// shortcut: pas de fond de carte, a remplacer quand react-native-maps (plantage au demarrage) sera resolu.
export default function RouteSketch({ points, height = 110, style }) {
  const [W, setW] = useState(300);
  const pad = 22;
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const spanLat = Math.max(Math.max(...lats) - Math.min(...lats), 1e-6);
  const spanLng = Math.max(Math.max(...lngs) - Math.min(...lngs), 1e-6);
  const [a, b, c] = points.map((p) => ({
    x: pad + ((p.longitude - Math.min(...lngs)) / spanLng) * (W - 2 * pad),
    y: pad + (1 - (p.latitude - Math.min(...lats)) / spanLat) * (height - 2 * pad),
  }));
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const dot = (p, color, size = 14) => (
    <View style={{ position: 'absolute', left: p.x - size / 2, top: p.y - size / 2, width: size, height: size, borderRadius: size / 2, backgroundColor: color, borderWidth: 2, borderColor: '#FFFFFF' }} />
  );
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={[{ width: '100%', height, borderRadius: theme.radius, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.cardBorder, overflow: 'hidden' }, style]}>
      <View style={{ position: 'absolute', left: a.x, top: a.y - 1.5, width: len, height: 3, backgroundColor: theme.colors.accent, transform: [{ rotate: `${angle}rad` }], transformOrigin: 'left center' }} />
      {dot(a, theme.colors.accent)}
      {dot(b, '#E5484D')}
      {c ? dot(c, '#0A0A0A', 18) : null}
    </View>
  );
}
