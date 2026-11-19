import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme, themedStyles } from '@app-rennesvtc/shared';
import { RouteBlock } from '../ui';

const COLLECT = { especes: 'Espèces à encaisser', carte_a_bord: 'Carte bancaire à bord à encaisser', compte: 'Course en compte : rien à encaisser' };

// Distance a vol d'oiseau entre depart et arrivee (indicatif).
function crowKm(ride) {
  if (!ride.pickup_lat || !ride.dropoff_lat) return null;
  const R = 6371, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(ride.dropoff_lat - ride.pickup_lat), dLng = rad(ride.dropoff_lng - ride.pickup_lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(ride.pickup_lat)) * Math.cos(rad(ride.dropoff_lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function minutes(ride) {
  const t = ride.step_times ?? {};
  if (!t.on_board || !t.dropped) return null;
  const m = Math.round((new Date(t.dropped) - new Date(t.on_board)) / 60000);
  return m > 0 && m < 600 ? m : null;
}

function Stat({ value, label }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// Fin de course : recapitulatif, somme a encaisser, retour a l'accueil.
export default function EndRide({ ride, onClose }) {
  const km = crowKm(ride);
  const min = minutes(ride);
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.check}><Text style={styles.checkMark}>✓</Text></View>
          <Text style={styles.title}>Course terminée !</Text>
          <Text style={styles.sub}>Merci pour votre service</Text>
          <View style={styles.recap}>
            <RouteBlock pickup={ride.pickup_address} dropoff={ride.dropoff_address} />
            <View style={styles.stats}>
              {min ? <Stat value={`${min} min`} label="Durée" /> : null}
              {km != null ? <Stat value={`≈ ${(Math.round(km * 10) / 10).toString().replace('.', ',')} km`} label="Distance" /> : null}
              {ride.price != null ? <Stat value={`${Number(ride.price).toFixed(2).replace('.', ',')} €`} label="Course" /> : null}
            </View>
          </View>
          <View style={styles.collect}>
            <Text style={styles.collectLabel}>Paiement</Text>
            <Text style={styles.collectValue}>{COLLECT[ride.payment_method] ?? ''}</Text>
          </View>
          <TouchableOpacity style={styles.home} onPress={onClose} activeOpacity={0.85} accessibilityRole="button">
            <Text style={styles.homeText}>Retour à l'accueil</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 22, paddingTop: 70, paddingBottom: 40, alignItems: 'center', gap: 12 },
  check: { width: 110, height: 110, borderRadius: 55, borderWidth: 4, borderColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentTint, marginBottom: 6 },
  checkMark: { color: theme.colors.accent, fontSize: 60, lineHeight: 66, fontWeight: '800' },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '800' },
  sub: { color: theme.colors.textMuted, fontSize: 17, marginBottom: 8 },
  recap: { alignSelf: 'stretch', borderRadius: 24, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.cardBorder, padding: 16, gap: 10 },
  stats: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: theme.colors.cardBorder, paddingTop: 12, marginTop: 4 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  statLabel: { color: theme.colors.textMuted, fontSize: 13 },
  collect: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', borderRadius: 16, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.cardBorder, padding: 14 },
  collectLabel: { color: theme.colors.textMuted, fontSize: 15 },
  collectValue: { color: theme.colors.text, fontSize: 15, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  home: { alignSelf: 'stretch', minHeight: 56, borderRadius: 28, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  homeText: { color: theme.colors.accentText, fontSize: 18, fontWeight: '800' },
}));
