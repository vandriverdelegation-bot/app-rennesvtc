import { useState } from 'react';
import { View } from 'react-native';
import { theme } from '@app-rennesvtc/shared';

// Schema du trajet sans carte native : fond de plan stylise (rues, riviere), depart (rond vert), arrivee (carre clair) et chauffeur (vert cerne de blanc).
// shortcut: pas de vrai fond de carte, a remplacer quand react-native-maps (plantage au demarrage) sera resolu.
// Couleurs du fond de plan : [fond, grandes rues, petites rues, riviere, arrivee, bord du chauffeur].
const MAP = { dark: ['#1A1D1A', '#242824', '#202420', '#1F3A44', '#F2F2EE', '#0B0C0B'], light: ['#E8EBE2', '#FFFFFF', '#F6F7F2', '#BCDDE8', '#151715', '#FFFFFF'] };
// Rues du design (repere 342 x 150) : [x1, y1, x2, y2, epaisseur, couleur (indice dans MAP)]
const STREETS = [
  [-10, 30, 360, 46, 6, 1],
  [-10, 104, 360, 92, 6, 1],
  [60, -10, 80, 160, 6, 1],
  [170, -10, 160, 160, 6, 1],
  [262, -10, 282, 160, 6, 1],
  [-10, 68, 360, 70, 2.5, 2],
  [118, -10, 122, 160, 2.5, 2],
  [214, -10, 222, 160, 2.5, 2],
  [310, -10, 318, 160, 2.5, 2],
  [-10, 128, 80, 123, 9, 3],
  [80, 123, 220, 126, 9, 3],
  [220, 126, 360, 118, 9, 3],
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
  const m = MAP[theme.mode];
  const GREEN = theme.colors.accent;
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
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={[{ width: '100%', height, borderRadius: 18, backgroundColor: m[0], overflow: 'hidden' }, style]}>
      {STREETS.map(([x1, y1, x2, y2, w, color], i) => seg(x1 * sx, y1 * sy, x2 * sx, y2 * sy, w, m[color], i))}
      {seg(a.x, a.y, b.x, b.y, 10, theme.colors.accentTint, 'glow')}
      {seg(a.x, a.y, b.x, b.y, 3.5, GREEN, 'route')}
      {halo(a, 'a1', 22, theme.colors.accentHalo)}
      {halo(a, 'a2', 12, GREEN)}
      {halo(b, 'b1', 22, theme.mode === 'light' ? 'rgba(21,23,21,0.15)' : 'rgba(242,242,238,0.15)')}
      {halo(b, 'b2', 12, m[4], 3)}
      {d ? <View style={{ position: 'absolute', left: d.x - 10, top: d.y - 10, width: 20, height: 20, borderRadius: 10, backgroundColor: GREEN, borderWidth: 3, borderColor: m[5] }} /> : null}
    </View>
  );
}
