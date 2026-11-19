import { useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme, whatsappUrl, themedStyles } from '@app-rennesvtc/shared';
import { COMPANY_PHONE } from '../lib/format';
import { FONT } from '../ui';

const c = theme.colors;
const RECENT_MS = 7 * 24 * 3600 * 1000;

// Derniere course terminee depuis moins de 7 jours et pas encore notee (l'historique est du plus recent au plus ancien).
export function rideToRate(history) {
  const r = (history ?? []).find((h) => h.status === 'completed');
  if (!r || r.rating) return null;
  return Date.now() - new Date(r.scheduled_at ?? r.created_at).getTime() < RECENT_MS ? r : null;
}

// Fin de course : le client note ses etoiles ; la note est gardee, puis on l'invite (quelle que soit la note) a partager son avis sur Google.
export default function RateCard({ ride, session, onDone }) {
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

  if (reviewUrl) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Merci pour votre note !</Text>
        <Text style={styles.stars}>{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</Text>
        <Text style={styles.text}>Votre avis compte beaucoup pour nous. Vous pouvez aussi le partager publiquement sur Google (il s'écrit sur la page Google de Rennes VTC, avec votre compte Google).</Text>
        <TouchableOpacity style={styles.google} onPress={() => Linking.openURL(reviewUrl)} activeOpacity={0.85} accessibilityRole="link">
          <Text style={styles.googleText}>Écrire mon avis sur Google</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Linking.openURL(whatsappUrl(COMPANY_PHONE))} accessibilityRole="link">
          <Text style={styles.link}>Une remarque ? Nous écrire en privé</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDone} accessibilityRole="button">
          <Text style={styles.later}>Fermer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Course terminée !</Text>
      <Text style={styles.text}>Comment avez-vous trouvé votre course ?</Text>
      <View style={styles.row}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity key={n} onPress={() => rate(n)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }} accessibilityLabel={`${n} étoile${n > 1 ? 's' : ''}`} accessibilityRole="button">
            <Text style={[styles.star, n <= stars && styles.starOn]}>{n <= stars ? '★' : '☆'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = themedStyles(() => ({
  card: { borderRadius: 22, backgroundColor: c.accentTint, borderWidth: 1, borderColor: c.accent, padding: 18, gap: 10, alignItems: 'center' },
  title: { color: c.text, fontSize: 19, fontFamily: FONT.title },
  text: { color: c.textMuted, fontSize: 14, textAlign: 'center', fontFamily: FONT.medium },
  row: { flexDirection: 'row', gap: 10 },
  star: { color: c.accentLight, fontSize: 40 },
  starOn: { color: '#FFC933' },
  stars: { color: '#FFC933', fontSize: 28, letterSpacing: 4 },
  google: { alignSelf: 'stretch', minHeight: 50, borderRadius: 25, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  googleText: { color: c.accentText, fontSize: 16, fontFamily: FONT.title },
  link: { color: c.accentLight, fontSize: 14, fontFamily: FONT.semi },
  later: { color: c.textMuted, fontSize: 13, fontFamily: FONT.medium, paddingTop: 4 },
  error: { color: c.error, fontSize: 13, textAlign: 'center' },
}));
