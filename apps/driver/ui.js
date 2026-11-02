import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '@app-rennesvtc/shared';
import { ACCEPT_ICON, Icon, PIN_ICON } from './icons';

const c = theme.colors;
const GREEN_DARK = '#2f8f12';

// Carte sombre ; « glow » lui donne le contour vert lumineux du design.
export function Card({ children, style, glow }) {
  return <View style={[styles.card, glow && styles.cardGlow, style]}>{children}</View>;
}

export function SectionLabel({ children }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

// Pastille d'information (passagers, bagages, reglement...) ; « highlight » la met en avant (siege enfant par exemple).
export function Pill({ children, highlight, icon }) {
  return (
    <View style={[styles.pill, highlight && styles.pillHighlight]}>
      {icon ? <Icon name={icon} color={highlight ? 'k' : 'm'} size={20} /> : null}
      <Text style={[styles.pillText, highlight && styles.pillTextHighlight]}>{children}</Text>
    </View>
  );
}

// Depart et destination relies par un trait vert, facon fil d'itineraire.
export function RouteBlock({ pickup, dropoff }) {
  return (
    <View style={styles.route}>
      <View style={styles.routeRail}>
        <View style={styles.ring}><View style={styles.ringInner} /></View>
        <View style={styles.line} />
        <Image source={PIN_ICON} style={styles.pin} resizeMode="contain" />
      </View>
      <View style={styles.routeTexts}>
        <Text style={styles.routeLabel}>DÉPART</Text>
        <Text style={styles.routeAddress}>{pickup}</Text>
        <Text style={[styles.routeLabel, { marginTop: 18 }]}>DESTINATION</Text>
        <Text style={styles.routeAddress}>{dropoff}</Text>
      </View>
    </View>
  );
}

// Boutons arrondis du design : « primary » (vert), « accept » (vert avec pastille de validation), « secondary » (contour), « whatsapp ».
// icon : pictogramme a gauche ; chevron : fleche a droite.
export function Btn({ title, onPress, variant = 'primary', disabled, icon, chevron }) {
  const accept = variant === 'accept';
  const solid = variant === 'primary' || accept;
  const textColor = solid || variant === 'whatsapp' ? '#FFFFFF' : c.text;
  return (
    <TouchableOpacity
      style={[styles.btn, chevron && { paddingRight: 50 }, solid && styles.btnPrimary, variant === 'secondary' && styles.btnSecondary, variant === 'whatsapp' && styles.btnWhatsapp, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      {accept ? <Image source={ACCEPT_ICON} style={styles.btnIconAccept} /> : icon ? <Icon name={icon} color={solid ? 'w' : 'w'} size={26} style={styles.btnIcon} /> : null}
      <Text style={[styles.btnText, { color: textColor }, (accept || icon) && { marginLeft: 12 }]}>{title}</Text>
      {chevron ? <Icon name="chevron" color="w" size={24} style={styles.btnChevron} /> : null}
    </TouchableOpacity>
  );
}

// Onglet en forme de pastille : vert plein quand il est actif.
export function TabPill({ label, icon, active, onPress }) {
  return (
    <TouchableOpacity style={[styles.tab, active && styles.tabActive]} onPress={onPress} activeOpacity={0.85}>
      <Icon name={icon} color={active ? 'w' : 'm'} size={24} />
      <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

// Grande ligne d'action (« Saisir une reservation ») : pastille verte + titre + fleche.
export function ActionRow({ title, onPress }) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.actionPlus}><Icon name="plus" color="w" size={26} /></View>
      <Text style={styles.actionTitle}>{title}</Text>
      <Icon name="chevron" color="w" size={24} />
    </TouchableOpacity>
  );
}

// En-tete d'une carte de course : date et heure a gauche, tarif dans un badge vert a droite.
export function RideHeader({ when, price }) {
  return (
    <View style={styles.rideHeader}>
      <Icon name="calendar" color="g" size={32} />
      <View style={{ flex: 1 }}>
        <Text style={styles.dateLabel} numberOfLines={1}>DATE ET HEURE</Text>
        <Text style={styles.dateValue} numberOfLines={2}>{when}</Text>
      </View>
      <View style={styles.priceBadge}>
        <Text style={styles.bigPrice}>{price != null ? `${Number(price).toFixed(2)} €` : '-'}</Text>
      </View>
    </View>
  );
}

// Lien vert avec pictogramme (« Changer ma gamme de vehicule »).
export function LinkRow({ title, icon, onPress }) {
  return (
    <TouchableOpacity style={styles.linkRow} onPress={onPress} activeOpacity={0.8}>
      <Icon name={icon} color="g" size={30} />
      <Text style={styles.linkText}>{title}</Text>
      <Icon name="chevron" color="g" size={22} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.cardBorder,
    borderRadius: 22,
    padding: 18,
    gap: 14,
  },
  cardGlow: {
    borderWidth: 1.5,
    borderColor: GREEN_DARK,
    borderRadius: 28,
    shadowColor: c.accent,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  rideHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateLabel: { color: c.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  dateValue: { color: c.text, fontSize: 17, lineHeight: 22, fontWeight: '700', marginTop: 2 },
  priceBadge: { borderWidth: 1.5, borderColor: GREEN_DARK, backgroundColor: '#0d2308', borderRadius: 16, paddingVertical: 7, paddingHorizontal: 10 },
  bigPrice: { color: c.accent, fontSize: 22, fontWeight: '800' },
  sectionLabel: { color: c.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#242628', backgroundColor: c.pill, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16 },
  pillHighlight: { backgroundColor: c.accent, borderColor: c.accent },
  pillText: { color: c.text, fontSize: 15, fontWeight: '600' },
  pillTextHighlight: { color: c.accentText, fontWeight: '800' },
  route: { flexDirection: 'row', gap: 14 },
  routeRail: { alignItems: 'center', paddingTop: 2, paddingBottom: 4, width: 30 },
  ring: { width: 26, height: 26, borderRadius: 13, borderWidth: 5, borderColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  ringInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.background },
  line: { flex: 1, width: 3, backgroundColor: c.accent, marginVertical: 4 },
  pin: { width: 30, height: 30 },
  routeTexts: { flex: 1 },
  routeLabel: { color: c.accent, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  routeAddress: { color: c.text, fontSize: 18, fontWeight: '600', marginTop: 3, lineHeight: 25 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 999, minHeight: 58, paddingVertical: 14, paddingHorizontal: 22, alignSelf: 'stretch' },
  btnPrimary: { backgroundColor: c.accent, borderWidth: 1, borderColor: '#7BE04A' },
  btnSecondary: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#8A8F94' },
  btnWhatsapp: { backgroundColor: '#25D366' },
  btnText: { fontWeight: '700', fontSize: 18 },
  btnIcon: {},
  btnIconAccept: { width: 34, height: 34 },
  btnChevron: { position: 'absolute', right: 20 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 58, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1.5, borderColor: '#2E3133', backgroundColor: '#101213' },
  tabActive: { backgroundColor: c.accent, borderColor: '#7BE04A' },
  tabText: { flexShrink: 1, color: c.textMuted, fontSize: 12.5, lineHeight: 16, fontWeight: '600', textAlign: 'center' },
  tabTextActive: { color: '#FFFFFF', fontWeight: '700' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 68, paddingHorizontal: 20, borderRadius: 999, borderWidth: 1.5, borderColor: '#2E3133', backgroundColor: '#101213', alignSelf: 'stretch' },
  actionPlus: { width: 42, height: 42, borderRadius: 13, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { flex: 1, color: c.text, fontSize: 19, fontWeight: '600' },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18, borderTopWidth: 1, borderTopColor: '#1d1f20', alignSelf: 'stretch' },
  linkText: { color: c.accent, fontSize: 16, fontWeight: '600' },
});
