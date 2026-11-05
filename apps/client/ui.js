import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme, themedStyles } from '@app-rennesvtc/shared';

const c = theme.colors;

// Polices du design : Outfit pour les titres, Inter pour le texte (chargees dans App.js).
export const FONT = { title: 'Outfit_600SemiBold', bold: 'Outfit_700Bold', body: 'Inter_400Regular', medium: 'Inter_500Medium', semi: 'Inter_600SemiBold' };

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionLabel({ children }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

// Pastille d'information ; "highlight" la met en avant.
export function Pill({ children, highlight }) {
  return (
    <View style={[styles.pill, highlight && styles.pillHighlight]}>
      <Text style={[styles.pillText, highlight && styles.pillTextHighlight]}>{children}</Text>
    </View>
  );
}

// Depart (rond vert) et arrivee (carre clair) relies par un pointille, facon fil d'itineraire.
export function RouteBlock({ pickup, dropoff }) {
  return (
    <View style={styles.route}>
      <View style={styles.routeRail}>
        <View style={styles.dotStart} />
        <View style={styles.dashes}>
          {Array.from({ length: 24 }, (_, i) => (
            <View key={i} style={styles.dash} />
          ))}
        </View>
        <View style={styles.dotEnd} />
      </View>
      <View style={styles.routeTexts}>
        <View>
          <Text style={styles.routeLabel}>DÉPART</Text>
          <Text style={styles.routeAddress}>{pickup}</Text>
        </View>
        <View>
          <Text style={styles.routeLabel}>ARRIVÉE</Text>
          <Text style={styles.routeAddress}>{dropoff}</Text>
        </View>
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

const styles = themedStyles(() => ({
  card: {
    width: '100%',
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.cardBorder,
    borderRadius: 22,
    padding: 16,
    gap: 12,
  },
  sectionLabel: { color: c.textMuted, fontSize: 11, fontFamily: FONT.semi, letterSpacing: 1.3, textTransform: 'uppercase' },
  pill: { borderWidth: 1, borderColor: c.inputBorder, backgroundColor: c.pill, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  pillHighlight: { backgroundColor: c.accent, borderColor: c.accent },
  pillText: { color: c.text, fontSize: 13, fontFamily: FONT.semi },
  pillTextHighlight: { color: c.accentText },
  route: { flexDirection: 'row', gap: 14 },
  routeRail: { width: 10, marginTop: 5 },
  dotStart: { position: 'absolute', top: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent },
  dotEnd: { position: 'absolute', bottom: 0, width: 10, height: 10, borderRadius: 3, backgroundColor: c.text },
  dashes: { position: 'absolute', top: 16, bottom: 16, left: 4, width: 2, overflow: 'hidden', gap: 4 }, // hors flux : seul le texte fixe la hauteur
  dash: { width: 2, height: 4, backgroundColor: c.inputBorder },
  routeTexts: { flex: 1, gap: 18 },
  routeLabel: { color: c.textMuted, fontSize: 11, fontFamily: FONT.medium, letterSpacing: 1.3, marginBottom: 3 },
  routeAddress: { color: c.text, fontSize: 15, fontFamily: FONT.medium, lineHeight: 21 },
  btn: { borderRadius: 14, minHeight: 52, paddingVertical: 15, justifyContent: 'center', alignItems: 'center', alignSelf: 'stretch' },
  btnPrimary: { backgroundColor: c.accent },
  btnSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.inputBorder },
  btnWhatsapp: { backgroundColor: '#25D366' },
  btnText: { fontFamily: FONT.title, fontSize: 16 },
}));
