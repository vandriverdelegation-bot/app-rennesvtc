import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { theme } from '@app-rennesvtc/shared';

const LABELS = { client: 'Client', chauffeur: 'Chauffeur', donneur_ordre: "Donneur d'ordre" };

// Chat d'une course entre le chauffeur et le client / donneur d'ordre (me = 'chauffeur' ou 'client').
// Les messages passent par le serveur et sont relus toutes les 4 secondes.
export default function RideChat({ session, rideId, me }) {
  const [messages, setMessages] = useState([]);
  const [open, setOpen] = useState(true);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const scroller = useRef(null);
  const tokenRef = useRef(session.access_token);
  tokenRef.current = session.access_token;
  const url = `${process.env.EXPO_PUBLIC_BACKEND_URL}/rides/${rideId}/messages`;
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}` });

  async function load() {
    try {
      const res = await fetch(url, { headers: headers() });
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages);
      setOpen(data.open);
    } catch (e) {
      // reseau instable : prochain tour
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [rideId]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify({ body }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Envoi impossible.');
      setText('');
      await load();
    } catch (e) {
      setError(e.message);
    }
    setSending(false);
  }

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Messages</Text>
      <ScrollView ref={scroller} style={styles.list} nestedScrollEnabled onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}>
        {messages.length === 0 ? <Text style={styles.empty}>Aucun message pour le moment.</Text> : null}
        {messages.map((m) => {
          const mine = m.role === me;
          return (
            <View key={m.id} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              {!mine ? <Text style={styles.who}>{LABELS[m.role] ?? m.role}</Text> : null}
              <Text style={mine ? styles.mineText : styles.theirsText}>{m.body}</Text>
            </View>
          );
        })}
      </ScrollView>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {open ? (
        <View style={styles.row}>
          <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="Votre message..." placeholderTextColor={theme.colors.textMuted} maxLength={1000} multiline />
          <TouchableOpacity style={styles.send} onPress={send} disabled={sending}>
            <Text style={styles.sendText}>{sending ? '...' : 'Envoyer'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.empty}>Le chat est ferme (course terminee ou sans chauffeur).</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8, borderTopWidth: 1, borderTopColor: theme.colors.cardBorder, paddingTop: 12 },
  title: { color: theme.colors.text, fontWeight: '700', fontSize: 16 },
  list: { maxHeight: 240 },
  empty: { color: theme.colors.textMuted, fontSize: 13 },
  bubble: { maxWidth: '82%', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 6 },
  mine: { alignSelf: 'flex-end', backgroundColor: theme.colors.accent },
  theirs: { alignSelf: 'flex-start', backgroundColor: theme.colors.inputBorder },
  who: { color: theme.colors.textMuted, fontSize: 11, marginBottom: 2 },
  mineText: { color: theme.colors.accentText, fontSize: 15 },
  theirsText: { color: theme.colors.text, fontSize: 15 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  input: { flex: 1, maxHeight: 100, borderWidth: 1, borderColor: theme.colors.inputBorder, backgroundColor: theme.colors.input, borderRadius: theme.radius, padding: 10, color: theme.colors.text },
  send: { backgroundColor: theme.colors.accent, borderRadius: theme.radius, paddingHorizontal: 16, paddingVertical: 12 },
  sendText: { color: theme.colors.accentText, fontWeight: '700' },
  error: { color: theme.colors.error, fontSize: 13 },
});
