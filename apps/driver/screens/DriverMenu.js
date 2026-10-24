import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { registerPushToken, theme } from '@app-rennesvtc/shared';
import { supabase } from '../lib/supabase';
import DriverSettings from './DriverSettings';

const STATUS_LABELS = { completed: 'Terminee', cancelled: 'Annulee', accepted: 'En cours' };

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

function HistoryView({ session, onBack }) {
  const [rides, setRides] = useState(null);

  useEffect(() => {
    supabase
      .from('rides')
      .select('id, pickup_address, dropoff_address, price, status, scheduled_at, created_at')
      .eq('driver_id', session.user.id)
      .in('status', ['accepted', 'completed', 'cancelled'])
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setRides(data ?? []));
  }, []);

  const done = (rides ?? []).filter((r) => r.status === 'completed');
  const total = done.reduce((sum, r) => sum + (Number(r.price) || 0), 0);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <BackLink onPress={onBack} />
      <Text style={styles.title}>Historique de mes courses</Text>
      {rides === null ? (
        <ActivityIndicator color={theme.colors.accent} />
      ) : rides.length === 0 ? (
        <Text style={styles.muted}>Aucune course pour le moment.</Text>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.itemHint}>Courses terminees (50 dernieres)</Text>
            <Text style={styles.big}>{done.length} · {total.toFixed(2)} €</Text>
          </View>
          {rides.map((r) => (
            <View key={r.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.itemHint}>{formatDate(r)}</Text>
                <Text style={r.status === 'completed' ? styles.statusOk : styles.itemHint}>{STATUS_LABELS[r.status]}</Text>
              </View>
              <Text style={styles.itemLabel}>{r.pickup_address}</Text>
              <Text style={styles.itemHint}>vers {r.dropoff_address}</Text>
              <View style={styles.rowBetween}>
                <Text style={styles.price}>{r.price != null ? `${Number(r.price).toFixed(2)} €` : '-'}</Text>
                <TouchableOpacity
                  onPress={() =>
                    Linking.openURL(`${process.env.EXPO_PUBLIC_BACKEND_URL}/driver/bon-commande/${r.id}?token=${session.access_token}`)
                  }
                >
                  <Text style={styles.link}>Bon de commande</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const euro = (n) => `${n.toFixed(2)} €`;
const rideDate = (r) => new Date(r.scheduled_at ?? r.created_at);

function RevenueView({ session, onBack }) {
  const [rides, setRides] = useState(null);

  useEffect(() => {
    supabase
      .from('rides')
      .select('price, scheduled_at, created_at')
      .eq('driver_id', session.user.id)
      .eq('status', 'completed')
      .limit(2000)
      .then(({ data }) => setRides(data ?? []));
  }, []);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfDay.getDate() - ((startOfDay.getDay() + 6) % 7)); // lundi
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const sumSince = (since) => {
    const list = (rides ?? []).filter((r) => !since || rideDate(r) >= since);
    return { count: list.length, total: list.reduce((s, r) => s + (Number(r.price) || 0), 0) };
  };
  const periods = [
    { label: "Aujourd'hui", ...sumSince(startOfDay) },
    { label: 'Cette semaine', ...sumSince(startOfWeek) },
    { label: 'Ce mois-ci', ...sumSince(startOfMonth) },
    { label: 'Depuis le debut', ...sumSince(null) },
  ];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <BackLink onPress={onBack} />
      <Text style={styles.title}>Chiffre d'affaires</Text>
      {rides === null ? (
        <ActivityIndicator color={theme.colors.accent} />
      ) : (
        periods.map((p) => (
          <View key={p.label} style={styles.card}>
            <Text style={styles.itemHint}>{p.label}</Text>
            <Text style={styles.big}>{euro(p.total)}</Text>
            <Text style={styles.itemHint}>{p.count} course(s) terminee(s)</Text>
          </View>
        ))
      )}
      <Text style={styles.muted}>Calcule sur les courses terminees, tous modes de reglement confondus.</Text>
    </ScrollView>
  );
}

function ComptesView({ session, onBack }) {
  const [rides, setRides] = useState(null);

  useEffect(() => {
    supabase
      .from('rides')
      .select('id, pickup_address, dropoff_address, price, client_name, scheduled_at, created_at, paid_at')
      .eq('driver_id', session.user.id)
      .eq('payment_method', 'compte')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => setRides(data ?? []));
  }, []);

  const pending = (rides ?? []).filter((r) => !r.paid_at);
  const paid = (rides ?? []).filter((r) => r.paid_at);
  const pendingTotal = pending.reduce((s, r) => s + (Number(r.price) || 0), 0);

  const RideCard = ({ r }) => (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.itemHint}>{formatDate(r)}</Text>
        <Text style={r.paid_at ? styles.statusOk : styles.pendingText}>
          {r.paid_at ? `Payee le ${new Date(r.paid_at).toLocaleDateString('fr-FR')}` : 'En attente'}
        </Text>
      </View>
      {r.client_name ? <Text style={styles.itemLabel}>{r.client_name}</Text> : null}
      <Text style={styles.itemLabel}>{r.pickup_address}</Text>
      <Text style={styles.itemHint}>vers {r.dropoff_address}</Text>
      <Text style={styles.price}>{r.price != null ? euro(Number(r.price)) : '-'}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <BackLink onPress={onBack} />
      <Text style={styles.title}>Courses en compte</Text>
      {rides === null ? (
        <ActivityIndicator color={theme.colors.accent} />
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.itemHint}>En attente de paiement</Text>
            <Text style={styles.big}>{euro(pendingTotal)}</Text>
            <Text style={styles.itemHint}>{pending.length} course(s)</Text>
          </View>
          {pending.length === 0 ? <Text style={styles.muted}>Aucune course en attente de paiement.</Text> : pending.map((r) => <RideCard key={r.id} r={r} />)}
          {paid.length > 0 ? <Text style={[styles.title, styles.gap]}>Deja reglees</Text> : null}
          {paid.map((r) => <RideCard key={r.id} r={r} />)}
        </>
      )}
      <Text style={styles.muted}>Le reglement est confirme par l'administrateur une fois le paiement recu.</Text>
    </ScrollView>
  );
}

function NotificationsView({ session, onBack }) {
  const [enabled, setEnabled] = useState(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('push_token').eq('id', session.user.id).single();
    setEnabled(!!data?.push_token);
  }, []);
  useEffect(() => {
    load();
  }, []);

  async function handleToggle(value) {
    setMessage('');
    if (value) {
      await registerPushToken(supabase, session.user.id);
      const { data } = await supabase.from('profiles').select('push_token').eq('id', session.user.id).single();
      setEnabled(!!data?.push_token);
      if (!data?.push_token) {
        setMessage("Activation impossible : autorisez les notifications pour l'app dans les reglages du telephone (indisponible dans Expo Go).");
      }
    } else {
      await supabase.from('profiles').update({ push_token: null }).eq('id', session.user.id);
      setEnabled(false);
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <BackLink onPress={onBack} />
      <Text style={styles.title}>Notifications</Text>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemLabel}>Nouvelles courses</Text>
            <Text style={styles.itemHint}>Etre prevenu des qu'une course de votre gamme est disponible.</Text>
          </View>
          <Switch value={!!enabled} onValueChange={handleToggle} disabled={enabled === null} trackColor={{ true: theme.colors.accent }} />
        </View>
      </View>
      {message ? <Text style={styles.error}>{message}</Text> : null}
    </ScrollView>
  );
}

function AccountView({ session, onBack, profile }) {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <BackLink onPress={onBack} />
      <Text style={styles.title}>Mon compte</Text>
      <View style={styles.card}>
        <Text style={styles.itemHint}>Nom</Text>
        <Text style={styles.itemLabel}>{profile?.full_name ?? 'Non renseigne'}</Text>
        <Text style={[styles.itemHint, styles.gap]}>Email</Text>
        <Text style={styles.itemLabel}>{session.user.email}</Text>
        <Text style={[styles.itemHint, styles.gap]}>Telephone</Text>
        <Text style={styles.itemLabel}>{profile?.phone ?? 'Non renseigne'}</Text>
        <Text style={[styles.itemHint, styles.gap]}>N° carte VTC</Text>
        <Text style={styles.itemLabel}>{profile?.vtc_card_number ?? 'Non renseigne'}</Text>
      </View>
      <Text style={styles.muted}>Pour modifier votre nom ou votre numero de carte VTC, contactez l'administrateur.</Text>
    </ScrollView>
  );
}

export default function DriverMenu({ session, onClose }) {
  const [view, setView] = useState('menu');
  const [profile, setProfile] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadProfile = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, phone, vtc_card_number, vehicle_category, online_status')
      .eq('id', session.user.id)
      .single();
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
    // Un chauffeur deconnecte ne doit plus apparaitre "en ligne" pour l'admin.
    await supabase.from('profiles').update({ online_status: false }).eq('id', session.user.id);
    await supabase.auth.signOut();
  }

  if (view === 'revenue') return <RevenueView session={session} onBack={() => setView('menu')} />;
  if (view === 'comptes') return <ComptesView session={session} onBack={() => setView('menu')} />;
  if (view === 'history') return <HistoryView session={session} onBack={() => setView('menu')} />;
  if (view === 'notifications') return <NotificationsView session={session} onBack={() => setView('menu')} />;
  if (view === 'account') return <AccountView session={session} profile={profile} onBack={() => setView('menu')} />;
  if (view === 'settings') {
    return (
      <View style={styles.scroll}>
        <View style={styles.settingsBack}>
          <BackLink onPress={() => { loadProfile(); setView('menu'); }} />
        </View>
        <DriverSettings
          session={session}
          currentCategory={profile?.vehicle_category}
          onSaved={(category) => setProfile((p) => ({ ...p, vehicle_category: category }))}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Reglages</Text>
      <MenuItem label="Mon compte" hint={profile?.full_name ?? session.user.email} onPress={() => setView('account')} />
      <MenuItem label="Chiffre d'affaires" hint="Jour, semaine, mois, total" onPress={() => setView('revenue')} />
      <MenuItem label="Courses en compte" hint="Paiements en attente et regles" onPress={() => setView('comptes')} />
      <MenuItem label="Historique de mes courses" hint="Courses acceptees, terminees, bons de commande" onPress={() => setView('history')} />
      <MenuItem label="Notifications" hint="Alertes de nouvelles courses" onPress={() => setView('notifications')} />
      <MenuItem
        label="Gamme, statut, telephone et disponibilites"
        hint={profile?.online_status ? 'Vous etes en ligne' : 'Vous etes hors ligne'}
        onPress={() => setView('settings')}
      />
      <TouchableOpacity style={styles.logout} onPress={handleLogout} disabled={loggingOut}>
        <Text style={styles.logoutText}>{loggingOut ? 'Deconnexion...' : 'Se deconnecter'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { width: '100%', flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, gap: 12 },
  settingsBack: { paddingHorizontal: 16, paddingTop: 8 },
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
  card: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: 18,
    padding: 16,
    gap: 2,
  },
  gap: { marginTop: 10 },
  big: { color: theme.colors.accent, fontSize: 22, fontWeight: '800' },
  price: { color: theme.colors.accent, fontWeight: '700', fontSize: 15 },
  statusOk: { color: theme.colors.accent, fontSize: 12, fontWeight: '700' },
  pendingText: { color: '#F5A524', fontSize: 12, fontWeight: '700' },
  link: { color: theme.colors.accent, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  logout: {
    borderWidth: 1,
    borderColor: theme.colors.error,
    borderRadius: theme.radius,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  logoutText: { color: theme.colors.error, fontWeight: '700' },
});
