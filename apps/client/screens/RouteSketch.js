import { useState } from 'react';
import { View } from 'react-native';

// Schema du trajet sans carte native : fond de plan stylise (rues, riviere), depart (rond vert), arrivee (carre clair) et chauffeur (vert cerne de blanc).
// shortcut: pas de vrai fond de carte, a remplacer quand react-native-maps (plantage au demarrage) sera resolu.
const GREEN = '#5BD42A';
const LIGHT = '#F2F2EE';
// Rues du design (repere 342 x 150) : [x1, y1, x2, y2, epaisseur, couleur]
const STREETS = [
  [-10, 30, 360, 46, 6, '#242824'],
  [-10, 104, 360, 92, 6, '#242824'],
  [60, -10, 80, 160, 6, '#242824'],
  [170, -10, 160, 160, 6, '#242824'],
  [262, -10, 282, 160, 6, '#242824'],
  [-10, 68, 360, 70, 2.5, '#202420'],
  [118, -10, 122, 160, 2.5, '#202420'],
  [214, -10, 222, 160, 2.5, '#202420'],
  [310, -10, 318, 160, 2.5, '#202420'],
  [-10, 128, 80, 123, 9, '#1F3A44'],
  [80, 123, 220, 126, 9, '#1F3A44'],
  [220, 126, 360, 118, 9, '#1F3A44'],
];

function seg(x1, y1, x2, y2, w, color, key) {
  return (
    <View
      key={key}
      style={{ position: 'absolute', left: x1, top: y1 - w / 2, width: Math.hypot(x2 - x1, y2 - y1), height: w, borderRadius: w / 2, backgroundColor: color, transform: [{ rotate: `${Math.atan2(y2 - y1, x2 - x1)}rad` }], transformOrigin: 'left center' }}
    />
  );
}

export default function RouteSketch({ points, height = 150, style }) {
  const [W, setW] = useState(342);
  const pad = 30;
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const spanLat = Math.max(Math.max(...lats) - Math.min(...lats), 1e-6);
  const spanLng = Math.max(Math.max(...lngs) - Math.min(...lngs), 1e-6);
  const [a, b, d] = points.map((p) => ({
    x: pad + ((p.longitude - Math.min(...lngs)) / spanLng) * (W - 2 * pad),
    y: pad + (1 - (p.latitude - Math.min(...lats)) / spanLat) * (height - 2 * pad),
  }));
  const sx = W / 342;
  const sy = height / 150;
  const halo = (p, key, size, color, radius) => (
    <View key={key} style={{ position: 'absolute', left: p.x - size / 2, top: p.y - size / 2, width: size, height: size, borderRadius: radius ?? size / 2, backgroundColor: color }} />
  );
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={[{ width: '100%', height, borderRadius: 18, backgroundColor: '#1A1D1A', overflow: 'hidden' }, style]}>
      {STREETS.map(([x1, y1, x2, y2, w, color], i) => seg(x1 * sx, y1 * sy, x2 * sx, y2 * sy, w, color, i))}
      {seg(a.x, a.y, b.x, b.y, 10, 'rgba(91,212,42,0.18)', 'glow')}
      {seg(a.x, a.y, b.x, b.y, 3.5, GREEN, 'route')}
      {halo(a, 'a1', 22, 'rgba(91,212,42,0.2)')}
      {halo(a, 'a2', 12, GREEN)}
      {halo(b, 'b1', 22, 'rgba(242,242,238,0.15)')}
      {halo(b, 'b2', 12, LIGHT, 3)}
      {d ? <View style={{ position: 'absolute', left: d.x - 10, top: d.y - 10, width: 20, height: 20, borderRadius: 10, backgroundColor: GREEN, borderWidth: 3, borderColor: '#0B0C0B' }} /> : null}
    </View>
  );
}
