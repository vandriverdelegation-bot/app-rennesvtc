import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme, themedStyles } from '@app-rennesvtc/shared';

const SECONDS = 45;

// En-tete d'une course proposee : cloche, « Nouvelle course » et compte a rebours de 45 s.
// Le compte a rebours est un repere visuel : a 00:00 la course reste proposee (rien n'est refuse automatiquement).
export default function OfferBanner() {
  const [left, setLeft] = useState(SECONDS);
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return (
    <View style={styles.wrap}>
      <View style={styles.bell}><Text style={styles.bellText}>🔔</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Nouvelle course</Text>
        <Text style={styles.sub}>{left > 0 ? 'À accepter dans :' : 'En attente de votre réponse'}</Text>
      </View>
      <Text style={[styles.count, left === 0 && { color: theme.colors.textMuted }]}>{mm}:{ss}</Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 6 },
  bell: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: theme.colors.accent, backgroundColor: theme.colors.accentTint, alignItems: 'center', justifyContent: 'center' },
  bellText: { fontSize: 22 },
  title: { color: theme.colors.text, fontSize: 20, fontWeight: '800' },
  sub: { color: theme.colors.textMuted, fontSize: 13 },
  count: { color: theme.colors.accent, fontSize: 32, fontWeight: '800' },
}));
