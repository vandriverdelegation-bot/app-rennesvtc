import { useState } from 'react';
import { Text, View } from 'react-native';
import { theme, themedStyles } from '@app-rennesvtc/shared';
import { Btn, Card, SectionLabel } from '../ui';

const hhmm = (iso) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');

// Etat d'un arret (rides.step_times.stops[i]) : 'done' (reparti ou passe), 'here' (arrive, pas encore reparti), 'todo'.
export const stopState = (ride, i) => {
  const s = ride.step_times?.stops?.[i];
  return s?.skipped || s?.left ? 'done' : s?.arrived ? 'here' : 'todo';
};
// Premier arret pas encore fait (index), ou -1.
export const nextStopIndex = (ride) => (ride.stop_addresses ?? []).findIndex((_, i) => stopState(ride, i) !== 'done');

// Pour chaque arret : « Arrive », puis « Reparti », ou « Passer cet arret ». Ne bloque jamais la fin de la course.
export default function StopsCard({ ride, session, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const current = nextStopIndex(ride);

  async function mark(index, action) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/rides/${ride.id}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ index, action }),
      });
      if (!res.ok) setError((await res.json().catch(() => ({}))).error || 'Action impossible, reessayez.');
    } catch {
      setError('Pas de connexion, reessayez.');
    }
    setBusy(false);
    onChanged();
  }

  return (
    <Card>
      <SectionLabel>Arrets</SectionLabel>
      {ride.stop_addresses.map((address, i) => {
        const s = ride.step_times?.stops?.[i] ?? {};
        const state = stopState(ride, i);
        return (
          <View key={i} style={[styles.stop, i === current && styles.stopCurrent]}>
            <Text style={styles.stopTitle}>Arret {i + 1}</Text>
            <Text style={styles.address}>{address}</Text>
            {state === 'done' ? (
              <Text style={styles.done}>{s.skipped ? 'Arret passe' : `✓ Arrive ${hhmm(s.arrived)} - reparti ${hhmm(s.left)}`}</Text>
            ) : null}
            {state === 'here' ? <Text style={styles.done}>Arrive a {hhmm(s.arrived)}</Text> : null}
            {i === current ? (
              <View style={{ gap: 8 }}>
                {state === 'todo' ? <Btn title="Je suis arrive a l'arret" onPress={() => mark(i, 'arrived')} disabled={busy} /> : null}
                {state === 'here' ? <Btn title="Je repars de l'arret" onPress={() => mark(i, 'left')} disabled={busy} /> : null}
                {state === 'todo' ? <Btn title="Passer cet arret" variant="secondary" onPress={() => mark(i, 'skipped')} disabled={busy} /> : null}
              </View>
            ) : null}
          </View>
        );
      })}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Card>
  );
}

const styles = themedStyles(() => ({
  stop: { borderWidth: 1, borderColor: theme.colors.cardBorder, borderRadius: 12, padding: 12, gap: 6 },
  stopCurrent: { borderColor: theme.colors.accent },
  stopTitle: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '700' },
  address: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  done: { color: theme.colors.textMuted, fontSize: 14 },
  error: { color: '#D93025', fontSize: 14 },
}));
