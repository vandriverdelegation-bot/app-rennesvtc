import { useState } from 'react';
import { Linking, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { theme, whatsappUrl, themedStyles } from '@app-rennesvtc/shared';
import { COMPANY_PHONE, crowKm, euro, km1 } from '../lib/format';
import { Icon } from '../icons';
import { FONT } from '../ui';

const c = theme.colors;
const RECENT_MS = 7 * 24 * 3600 * 1000;

// Derniere course terminee depuis moins de 7 jours et pas encore notee (l'historique est du plus recent au plus ancien).
export function rideToRate(history) {
  const r = (history ?? []).find((h) => h.status === 'completed');
  if (!r || r.rating) return null;
  return Date.now() - new Date(r.scheduled_at ?? r.created_at).getTime() < RECENT_MS ? r : null;
}

function minutesOf(ride) {
  const t = ride.step_times ?? {};
  const from = t.on_board, to = t.dropped ?? t.completed;
  if (!from || !to) return null;
  const m = Math.round((new Date(to) - new Date(from)) / 60000);
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

// Ecran de fin de course : recapitulatif, note en etoiles (gardee pour Rennes VTC), puis invitation — pour toutes les notes — a partager son avis sur Google.
export default function EndScreen({ ride, session, onClose, onHistory }) {
  const [stars, setStars] = useState(0);
  const [reviewUrl, setReviewUrl] = useState(null); // renseigne une fois la note enregistree
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function rate(n) {
    if (busy || reviewUrl) return;
    setStars(n);
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/client/rides/${ride.id}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ rating: n }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Erreur');
      setReviewUrl(json.reviewUrl);
    } catch (e) {
      setStars(0);
      setError("La note n'a pas pu être enregistrée. Réessayez.");
    }
    setBusy(false);
  }

  const km = crowKm({ lat: ride.pickup_lat, lng: ride.pickup_lng }, { lat: ride.dropoff_lat, lng: ride.dropoff_lng });
  const minutes = minutesOf(ride);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.check}><Text style={styles.checkMark}>✓</Text></View>
          <Text style={styles.title}>Course terminée !</Text>
          <Text style={styles.sub}>Merci pour votre confiance</Text>

          <View style={styles.recap}>
            <View style={styles.line}><View style={styles.dotStart} /><View style={{ flex: 1 }}><Text style={styles.addr}>{ride.pickup_address}</Text></View></View>
            <View style={styles.line}><View style={styles.dotEnd} /><View style={{ flex: 1 }}><Text style={styles.addr}>{ride.dropoff_address}</Text></View></View>
            <View style={styles.stats}>
              {minutes ? <Stat value={`${minutes} min`} label="Durée" /> : null}
              {km != null ? <Stat value={`≈ ${km1(km)} km`} label="Distance" /> : null}
              {ride.price != null ? <Stat value={euro(ride.price)} label="Montant" /> : null}
            </View>
          </View>

          {reviewUrl ? (
            <View style={styles.rate}>
              <Text style={styles.rateTitle}>Merci pour votre note !</Text>
              <Text style={styles.starsDone}>{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</Text>
              <Text style={styles.rateText}>Vous pouvez aussi partager votre avis publiquement sur Google : il s'écrit sur la page Google de Rennes VTC, avec votre compte Google.</Text>
              <TouchableOpacity style={styles.google} onPress={() => Linking.openURL(reviewUrl)} activeOpacity={0.85} accessibilityRole="link">
                <Text style={styles.googleText}>Écrire mon avis sur Google</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Linking.openURL(whatsappUrl(COMPANY_PHONE))} accessibilityRole="link">
                <Text style={styles.link}>Une remarque ? Nous écrire en privé</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.rate}>
              <Text style={styles.rateTitle}>Comment avez-vous trouvé votre course ?</Text>
              <View style={styles.row}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity key={n} onPress={() => rate(n)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }} accessibilityLabel={`${n} étoile${n > 1 ? 's' : ''}`} accessibilityRole="button">
                    <Text style={[styles.star, n <= stars && styles.starOn]}>{n <= stars ? '★' : '☆'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
          )}

          <TouchableOpacity style={styles.history} onPress={() => { onClose(); onHistory?.(); }} activeOpacity={0.85}>
            <Text style={styles.historyText}>Voir mon historique</Text>
            <Icon name="arrow" color="k" size={18} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} accessibilityRole="button"><Text style={styles.later}>Fermer</Text></TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, backgroundColor: c.background },
  content: { paddingHorizontal: 22, paddingTop: 70, paddingBottom: 40, alignItems: 'center', gap: 12 },
  check: { width: 110, height: 110, borderRadius: 55, borderWidth: 4, borderColor: c.accent, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentTint, marginBottom: 6 },
  checkMark: { color: c.accent, fontSize: 60, lineHeight: 66, fontWeight: '800' },
  title: { color: c.text, fontSize: 30, fontFamily: FONT.title },
  sub: { color: c.textMuted, fontSize: 17, fontFamily: FONT.body, marginBottom: 8 },
  recap: { alignSelf: 'stretch', borderRadius: 24, backgroundColor: '#F7F8F5', paddingVertical: 16, paddingHorizontal: 18, gap: 10 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  dotStart: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: '#22C55E', backgroundColor: '#F7F8F5', marginTop: 3 },
  dotEnd: { width: 14, height: 14, borderRadius: 3, backgroundColor: '#141714', marginTop: 3 },
  addr: { color: '#141714', fontSize: 16, fontFamily: FONT.semi },
  stats: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#E4E7E1', paddingTop: 12, marginTop: 4 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: '#141714', fontSize: 18, fontFamily: FONT.title },
  statLabel: { color: '#6A716A', fontSize: 13, fontFamily: FONT.body },
  rate: { alignSelf: 'stretch', borderRadius: 22, backgroundColor: '#C6EDAD', padding: 16, gap: 10, alignItems: 'center' },
  rateTitle: { color: '#12281A', fontSize: 17, fontFamily: FONT.title, textAlign: 'center' },
  rateText: { color: '#2C4A33', fontSize: 14, textAlign: 'center', fontFamily: FONT.medium },
  row: { flexDirection: 'row', gap: 10 },
  star: { color: '#3A6B3F', fontSize: 42 },
  starOn: { color: '#FFC933' },
  starsDone: { color: '#FFC933', fontSize: 28, letterSpacing: 4 },
  google: { alignSelf: 'stretch', minHeight: 50, borderRadius: 25, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  googleText: { color: c.accentText, fontSize: 16, fontFamily: FONT.title },
  link: { color: '#14532D', fontSize: 14, fontFamily: FONT.semi },
  error: { color: c.error, fontSize: 13, textAlign: 'center' },
  history: { alignSelf: 'stretch', minHeight: 54, borderRadius: 27, backgroundColor: c.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  historyText: { color: c.accentText, fontSize: 17, fontFamily: FONT.title },
  later: { color: c.textMuted, fontSize: 14, fontFamily: FONT.medium, paddingVertical: 8 },
}));
