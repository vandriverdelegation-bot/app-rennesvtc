import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { registerPushToken, theme } from '@app-rennesvtc/shared';
import { supabase } from '../lib/supabase';
import { Btn, Card } from '../ui';

const STATUS_LABELS = {
  pending: 'En attente',
  dispatched: 'En attente',
  accepted: 'Chauffeur en route',
  completed: 'Terminee',
  cancelled: 'Annulee',
};
const VEHICLE_LABELS = { confort: 'Confort', affaires: 'Affaires', van: 'Van' };

function formatDate(ride) {
  const d = new Date(ride.scheduled_at ?? ride.created_at);
  return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function BackLink({ onPress }) {
  return (
    <TouchableOpacity onPress={onPress}>
      <Text style={styles.back}>← Retour</Text>
    </TouchableOpacity>
  );
}

function MenuItem({ label, hint, onPress }) {
  return (
    <TouchableOpacity style={styles.item} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemLabel}>{label}</Text>
        {hint ? <Text style={styles.itemHint}>{hint}</Text> : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

function AccountView({ session, profile, onBack, onSaved }) {
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [message, setMessage] = useState('');

  async function handleSave() {
    setMessage('');
    const { error } = await supabase.from('profiles').update({ full_name: fullName.trim() || null, phone: phone.trim() || null }).eq('id', session.user.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    onSaved({ ...profile, full_name: fullName.trim() || null, phone: phone.trim() || null });
    setMessage('Enregistre.');
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <BackLink onPress={onBack} />
      <Text style={styles.title}>Mon compte</Text>
      <Card>
        <Text style={styles.itemHint}>Email</Text>
        <Text style={styles.itemLabel}>{session.user.email}</Text>
        <Text style={[styles.itemHint, styles.gap]}>Nom et prenom</Text>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Votre nom" placeholderTextColor={theme.colors.textMuted} />
        <Text style={[styles.itemHint, styles.gap]}>Telephone</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="0600000000" placeholderTextColor={theme.colors.textMuted} keyboardType="phone-pad" />
        <Btn title="Enregistrer" onPress={handleSave} />
        {message ? <Text style={styles.muted}>{message}</Text> : null}
      </Card>
      <Text style={styles.muted}>Votre nom et votre telephone sont transmis a votre chauffeur une fois la course acceptee.</Text>
    </ScrollView>
  );
}

function HistoryView({ session, onBack }) {
  const [rides, setRides] = useState(null);

  useEffect(() => {
    supabase
      .from('rides')
      .select('id, pickup_address, dropoff_address, price, status, vehicle_category, scheduled_at, created_at')
      .eq('client_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setRides(data ?? []));
  }, []);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <BackLink onPress={onBack} />
      <Text style={styles.title}>Mes courses</Text>
      {rides === null ? (
        <ActivityIndicator color={theme.colors.accent} />
      ) : rides.length === 0 ? (
        <Text style={styles.muted}>Aucune course pour le moment.</Text>
      ) : (
        rides.map((r) => (
          <Card key={r.id}>
            <View style={styles.rowBetween}>
              <Text style={styles.itemHint}>{formatDate(r)}</Text>
              <Text style={r.status === 'completed' ? styles.statusOk : styles.itemHint}>{STATUS_LABELS[r.status] ?? r.status}</Text>
            </View>
            <Text style={styles.itemLabel}>{r.pickup_address}</Text>
            <Text style={styles.itemHint}>vers {r.dropoff_address}</Text>
            <View style={styles.rowBetween}>
              <Text style={styles.itemHint}>{VEHICLE_LABELS[r.vehicle_category] ?? ''}</Text>
              <Text style={styles.price}>{r.price != null ? `${Number(r.price).toFixed(2)} €` : '-'}</Text>
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

function NotificationsView({ session, onBack }) {
  const [enabled, setEnabled] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    supabase.from('profiles').select('push_token').eq('id', session.user.id).single().then(({ data }) => setEnabled(!!data?.push_token));
  }, []);

  async function handleToggle(value) {
    setMessage('');
    if (value) {
      const failure = await registerPushToken(supabase, session.user.id);
      const { data } = await supabase.from('profiles').select('push_token').eq('id', session.user.id).single();
      setEnabled(!!data?.push_token);
      if (!data?.push_token) setMessage(`Activation impossible : ${failure || 'raison inconnue'}`);
    } else {
      await supabase.from('profiles').update({ push_token: null }).eq('id', session.user.id);
      setEnabled(false);
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <BackLink onPress={onBack} />
      <Text style={styles.title}>Notifications</Text>
      <Card>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemLabel}>Suivi de ma course</Text>
            <Text style={styles.itemHint}>Etre prevenu quand un chauffeur accepte ma course.</Text>
          </View>
          <Switch value={!!enabled} onValueChange={handleToggle} disabled={enabled === null} trackColor={{ true: theme.colors.accent }} />
        </View>
      </Card>
      {message ? <Text style={styles.error}>{message}</Text> : null}
    </ScrollView>
  );
}

export default function ClientMenu({ session, onClose }) {
  const [view, setView] = useState('menu');
  const [profile, setProfile] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadProfile = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('full_name, phone').eq('id', session.user.id).single();
    setProfile(data);
  }, []);
  useEffect(() => {
    loadProfile();
  }, []);

  // Bouton Retour d'Android : sous-ecran -> menu, puis menu -> accueil.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (view !== 'menu') setView('menu');
      else onClose?.();
      return true;
    });
    return () => sub.remove();
  }, [view]);

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
  }

  function confirmDelete() {
    Alert.alert(
      'Supprimer mon compte ?',
      'Votre compte et vos coordonnees seront supprimes definitivement. Vos reservations a venir seront annulees. Cette action est irreversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/client/account`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${session.access_token}` },
              });
              if (!res.ok) throw new Error((await res.json()).error);
              await supabase.auth.signOut();
            } catch (e) {
              Alert.alert('Suppression impossible', e.message);
            }
          },
        },
      ]
    );
  }

  if (view === 'account') return <AccountView session={session} profile={profile} onBack={() => setView('menu')} onSaved={setProfile} />;
  if (view === 'history') return <HistoryView session={session} onBack={() => setView('menu')} />;
  if (view === 'notifications') return <NotificationsView session={session} onBack={() => setView('menu')} />;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Mon compte</Text>
      <MenuItem label="Mes informations" hint={profile?.full_name ?? session.user.email} onPress={() => setView('account')} />
      <MenuItem label="Mes courses" hint="Historique de mes reservations" onPress={() => setView('history')} />
      <MenuItem label="Notifications" hint="Suivi de ma course" onPress={() => setView('notifications')} />
      <TouchableOpacity style={styles.logout} onPress={handleLogout} disabled={loggingOut}>
        <Text style={styles.logoutText}>{loggingOut ? 'Deconnexion...' : 'Se deconnecter'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={confirmDelete} style={{ alignItems: 'center', padding: 12 }}>
        <Text style={styles.muted}>Supprimer mon compte</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { width: '100%', flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '800', color: theme.colors.text },
  muted: { color: theme.colors.textMuted },
  error: { color: theme.colors.error },
  back: { color: theme.colors.accent, fontWeight: '700', paddingVertical: 4 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: 18,
    padding: 16,
  },
  itemLabel: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  itemHint: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  chevron: { color: theme.colors.accent, fontSize: 26, marginLeft: 8 },
  gap: { marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    backgroundColor: theme.colors.input,
    borderRadius: 12,
    padding: 12,
    color: theme.colors.text,
  },
  price: { color: theme.colors.accent, fontWeight: '800', fontSize: 16 },
  statusOk: { color: theme.colors.accent, fontSize: 12, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  logout: {
    borderWidth: 1,
    borderColor: theme.colors.error,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  logoutText: { color: theme.colors.error, fontWeight: '700' },
});
