import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '@app-rennesvtc/shared';

const c = theme.colors;

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionLabel({ children }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

// Pastille d'information ; "highlight" la met en avant (siege enfant par exemple).
export function Pill({ children, highlight }) {
  return (
    <View style={[styles.pill, highlight && styles.pillHighlight]}>
      <Text style={[styles.pillText, highlight && styles.pillTextHighlight]}>{children}</Text>
    </View>
  );
}

// Depart et destination relies par un trait, facon fil d'itineraire.
export function RouteBlock({ pickup, dropoff }) {
  return (
    <View style={styles.route}>
      <View style={styles.routeRail}>
        <View style={[styles.dot, { backgroundColor: c.accent }]} />
        <View style={styles.line} />
        <View style={[styles.dot, { backgroundColor: '#FF5C5C' }]} />
      </View>
      <View style={styles.routeTexts}>
        <Text style={styles.routeLabel}>DEPART</Text>
        <Text style={styles.routeAddress}>{pickup}</Text>
        <Text style={[styles.routeLabel, { marginTop: 14 }]}>DESTINATION</Text>
        <Text style={styles.routeAddress}>{dropoff}</Text>
      </View>
    </View>
  );
}

export function Btn({ title, onPress, variant = 'primary', disabled }) {
  return (
    <TouchableOpacity
      style={[styles.btn, variant === 'primary' && styles.btnPrimary, variant === 'secondary' && styles.btnSecondary, variant === 'whatsapp' && styles.btnWhatsapp, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={[styles.btnText, variant === 'primary' && { color: c.accentText }, variant === 'secondary' && { color: c.text }, variant === 'whatsapp' && { color: '#FFFFFF' }]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.cardBorder,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  sectionLabel: { color: c.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  pill: { borderWidth: 1, borderColor: c.inputBorder, backgroundColor: '#232427', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  pillHighlight: { backgroundColor: c.accent, borderColor: c.accent },
  pillText: { color: c.text, fontSize: 13, fontWeight: '600' },
  pillTextHighlight: { color: c.accentText, fontWeight: '800' },
  route: { flexDirection: 'row', gap: 12 },
  routeRail: { alignItems: 'center', paddingTop: 4, paddingBottom: 6 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  line: { flex: 1, width: 2, backgroundColor: c.inputBorder, marginVertical: 4 },
  routeTexts: { flex: 1 },
  routeLabel: { color: c.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  routeAddress: { color: c.text, fontSize: 15, fontWeight: '600', marginTop: 2 },
  btn: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', alignSelf: 'stretch' },
  btnPrimary: { backgroundColor: c.accent },
  btnSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.inputBorder },
  btnWhatsapp: { backgroundColor: '#25D366' },
  btnText: { fontWeight: '800', fontSize: 15 },
});
