import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, FlatList, ActivityIndicator, Linking, ScrollView, BackHandler, TextInput } from 'react-native';
import * as Location from 'expo-location';
import { theme, whatsappUrl } from '@app-rennesvtc/shared';
import { supabase } from '../lib/supabase';
import DriverSettings from './DriverSettings';
import CreateRide from './CreateRide';
import RideMiniMap from './RideMiniMap';
import { Btn, Card, Pill, RouteBlock, SectionLabel } from '../ui';

// " · 3 ans" a afficher a cote du pictogramme siege enfant ("3, 7" -> " · 3, 7 ans").
const agesLabel = (ages) => {
  const t = (ages ?? '').trim();
  if (!t) return '';
  return ' · ' + (/ans|an|mois/i.test(t) ? t : t + ' ans');
};

const STEP_LABELS = { not_started: 'A venir', en_route: 'En route', on_site: 'Sur place', completed: 'Terminee' };

const PAYMENT_LABELS = {
  carte_a_bord: 'CB a bord',
  especes: 'Especes',
  compte: 'En compte',
};

const SERVICE_LABELS = {
  trajet_simple: 'Trajet simple',
  mise_a_disposition: 'Mise a disposition',
  forfait: 'Forfait',
};

const VEHICLE_LABELS = { confort: 'Confort', affaires: 'Affaires', van: 'Van' };

function formatRideDateTime(scheduledAt) {
  if (!scheduledAt) return 'Des que possible';
  const d = new Date(scheduledAt);
  return d.toLocaleDateString('fr-FR') + ' a ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function DriverHome({ session }) {
  const [vehicleCategory, setVehicleCategory] = useState(undefined); // undefined = chargement initial
  const [permissions, setPermissions] = useState({ can_create_rides: false });
  const [onlineStatus, setOnlineStatus] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateRide, setShowCreateRide] = useState(false);
  const [activeRide, setActiveRide] = useState(undefined);
  const [pendingRides, setPendingRides] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [clientInfo, setClientInfo] = useState(null);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [colleagues, setColleagues] = useState([]);
  const [releaseTarget, setReleaseTarget] = useState('all'); // 'all' ou id d'un collegue
  const [releasing, setReleasing] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [priceEditing, setPriceEditing] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const locationSubscription = useRef(null);

  async function refresh() {
    const { data: active } = await supabase
      .from('rides')
      .select('id, pickup_address, dropoff_address, status, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, payment_method, service_type, price, ride_step, passenger_count, luggage_count, child_seats, booster_seats, child_ages, client_note, vehicle_category')
      .eq('driver_id', session.user.id)
      .eq('status', 'accepted')
      .maybeSingle();
    setActiveRide(active ?? null);

    if (!active) {
      const { data: pending } = await supabase
        .from('rides')
        .select('id, pickup_address, dropoff_address, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, status, payment_method, service_type, price, scheduled_at, created_at, passenger_count, luggage_count, child_seats, booster_seats, child_ages, client_note')
        .eq('status', 'dispatched')
        .order('created_at', { ascending: true });
      setPendingRides(pending ?? []);
    }
  }

  async function fetchProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('vehicle_category, can_create_rides, can_edit_price, online_status')
      .eq('id', session.user.id)
      .single();
    setVehicleCategory(data?.vehicle_category ?? null);
    setPermissions({ can_create_rides: !!data?.can_create_rides, can_edit_price: !!data?.can_edit_price });
    setOnlineStatus(!!data?.online_status);
  }

  useEffect(() => {
    fetchProfile();
  }, []);

  // Tant que le chauffeur est en ligne, transmet periodiquement sa position
  // pour que l'admin le voie sur la carte meme hors course.
  useEffect(() => {
    if (!onlineStatus) return;
    async function pingLocation() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await supabase
        .from('profiles')
        .update({ last_lat: position.coords.latitude, last_lng: position.coords.longitude })
        .eq('id', session.user.id);
    }
    pingLocation();
    const interval = setInterval(pingLocation, 60000);
    return () => clearInterval(interval);
  }, [onlineStatus]);

  useEffect(() => {
    if (!vehicleCategory) return;
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [vehicleCategory]);

  // Envoie la position GPS du chauffeur uniquement une fois en route (jamais avant), pour le suivi cote client.
  useEffect(() => {
    async function startTracking() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      locationSubscription.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 20 },
        (position) => {
          supabase
            .from('rides')
            .update({
              driver_lat: position.coords.latitude,
              driver_lng: position.coords.longitude,
            })
            .eq('id', activeRide.id)
            .eq('driver_id', session.user.id)
            .then(() => {});
        }
      );
    }

    if (activeRide && ['en_route', 'on_site'].includes(activeRide.ride_step)) {
      startTracking();
    }
    return () => {
      locationSubscription.current?.remove();
      locationSubscription.current = null;
    };
  }, [activeRide?.id, activeRide?.ride_step]);

  // Coordonnees du client, recuperees via le backend une fois la course acceptee.
  useEffect(() => {
    setClientInfo(null);
    if (!activeRide?.id) return;
    fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/driver/ride-client/${activeRide.id}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(setClientInfo)
      .catch(() => {});
  }, [activeRide?.id]);

  // Bouton Retour d'Android : ferme l'ecran ouvert (saisie, reglages) au lieu de quitter l'app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showCreateRide) { setShowCreateRide(false); return true; }
      if (showSettings) { setShowSettings(false); return true; }
      return false;
    });
    return () => sub.remove();
  }, [showCreateRide, showSettings]);

  async function openRelease() {
    setReleaseOpen(true);
    setReleaseTarget('all');
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/driver/colleagues`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setColleagues((await res.json()).filter((c) => !c.isMe));
    } catch (e) {}
  }

  async function handleRelease() {
    setReleasing(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/driver/rides/${activeRide.id}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ assignTo: releaseTarget }),
      });
      if (!res.ok) setErrorMsg((await res.json()).error ?? 'Erreur du serveur');
    } catch (e) {
      setErrorMsg('Connexion au serveur impossible.');
    }
    setReleasing(false);
    setReleaseOpen(false);
    refresh();
  }

  async function handleAccept(rideId) {
    setErrorMsg('');
    const { data, error } = await supabase
      .from('rides')
      .update({ driver_id: session.user.id, status: 'accepted' })
      .eq('id', rideId)
      .eq('status', 'dispatched')
      .select();

    if (error) {
      setErrorMsg(error.message);
      return;
    }
    if (!data || data.length === 0) {
      setErrorMsg('Cette course vient d’etre acceptee par un autre chauffeur.');
    } else {
      fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/notify/accepted`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ rideId }),
      }).catch(() => {});
    }
    refresh();
  }

  // Previent le client du changement d'etape (notification push).
  function notifyStep(rideId, step) {
    fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/notify/step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ rideId, step }),
    }).catch(() => {});
  }

  async function handleComplete() {
    await supabase
      .from('rides')
      .update({ status: 'completed', ride_step: 'completed' })
      .eq('id', activeRide.id)
      .eq('driver_id', session.user.id);
    notifyStep(activeRide.id, 'completed');
    refresh();
  }

  async function handleAdvanceStep(nextStep) {
    await supabase
      .from('rides')
      .update({ ride_step: nextStep })
      .eq('id', activeRide.id)
      .eq('driver_id', session.user.id);
    notifyStep(activeRide.id, nextStep);
    refresh();
  }

  // Apres "Je suis sur place" on guide vers la destination ; avant, vers le depart.
  function navTarget() {
    return activeRide.ride_step === 'on_site'
      ? { lat: activeRide.dropoff_lat, lng: activeRide.dropoff_lng, label: 'la destination' }
      : { lat: activeRide.pickup_lat, lng: activeRide.pickup_lng, label: 'le depart' };
  }

  function handleNavigate(app) {
    const { lat, lng } = navTarget();
    const urls = {
      waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
      google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      other: `geo:${lat},${lng}?q=${lat},${lng}`, // Android propose alors tous les GPS installes
    };
    setNavOpen(false);
    Linking.openURL(urls[app]).catch(() => Linking.openURL(urls.google));
  }

  async function handleSavePrice() {
    const value = parseFloat(newPrice.replace(',', '.'));
    if (isNaN(value) || value < 0) {
      setErrorMsg('Saisissez un tarif valide.');
      return;
    }
    setErrorMsg('');
    const { error } = await supabase.from('rides').update({ price: value }).eq('id', activeRide.id).eq('driver_id', session.user.id);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setPriceEditing(false);
    refresh();
  }

  function handleDownloadBonCommande() {
    const url = `${process.env.EXPO_PUBLIC_BACKEND_URL}/driver/bon-commande/${activeRide.id}?token=${session.access_token}`;
    Linking.openURL(url);
  }

  if (vehicleCategory === undefined) {
    return <ActivityIndicator style={styles.container} color={theme.colors.accent} />;
  }

  if (!vehicleCategory || showSettings) {
    return (
      <DriverSettings
        session={session}
        currentCategory={vehicleCategory}
        onSaved={(category) => {
          setVehicleCategory(category);
          fetchProfile();
          setShowSettings(false);
        }}
      />
    );
  }

  if (showCreateRide) {
    return (
      <CreateRide
        session={session}
        vehicleCategory={vehicleCategory}
        canEditPrice={permissions.can_edit_price}
        onCancel={() => setShowCreateRide(false)}
        onDone={() => {
          setShowCreateRide(false);
          refresh();
        }}
      />
    );
  }

  if (activeRide === undefined) {
    return <ActivityIndicator style={styles.container} color={theme.colors.accent} />;
  }

  if (activeRide) {
    const seats = (activeRide.child_seats ?? 0) > 0 || (activeRide.booster_seats ?? 0) > 0;
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.activeContent}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Course en cours</Text>
          <Pill highlight>{STEP_LABELS[activeRide.ride_step ?? 'not_started']}</Pill>
        </View>

        <Card>
          <View style={styles.rowBetween}>
            <SectionLabel>Prix</SectionLabel>
            <Text style={styles.bigPrice}>{activeRide.price != null ? `${Number(activeRide.price).toFixed(2)} €` : '-'}</Text>
          </View>
          {permissions.can_edit_price ? (
            priceEditing ? (
              <View style={{ gap: 8 }}>
                <TextInput style={styles.priceInput} value={newPrice} onChangeText={setNewPrice} keyboardType="decimal-pad" placeholder="Nouveau tarif en euros" placeholderTextColor={theme.colors.textMuted} />
                <View style={styles.contactRow}>
                  <View style={{ flex: 1 }}><Btn title="Enregistrer" onPress={handleSavePrice} /></View>
                  <View style={{ flex: 1 }}><Btn title="Annuler" variant="secondary" onPress={() => setPriceEditing(false)} /></View>
                </View>
              </View>
            ) : (
              <Btn title="Modifier le tarif" variant="secondary" onPress={() => { setNewPrice(String(activeRide.price ?? '')); setPriceEditing(true); }} />
            )
          ) : null}
          <View style={styles.pillRow}>
            <Pill>{SERVICE_LABELS[activeRide.service_type]}</Pill>
            <Pill>{PAYMENT_LABELS[activeRide.payment_method]}</Pill>
            {activeRide.vehicle_category ? <Pill>Gamme {VEHICLE_LABELS[activeRide.vehicle_category]}</Pill> : null}
          </View>
          <View style={styles.pillRow}>
            <Pill>👥 {activeRide.passenger_count ?? 1} passager(s)</Pill>
            <Pill>🧳 {activeRide.luggage_count ?? 0} bagage(s)</Pill>
            {activeRide.child_seats > 0 ? <Pill highlight>👶 Siege auto x{activeRide.child_seats}{agesLabel(activeRide.child_ages)}</Pill> : null}
            {activeRide.booster_seats > 0 ? <Pill highlight>🧒 Rehausseur x{activeRide.booster_seats}{agesLabel(activeRide.child_ages)}</Pill> : null}
          </View>
          {!seats ? <Text style={styles.mutedSmall}>Aucun siege enfant demande.</Text> : null}
          {activeRide.client_note ? <ClientNote text={activeRide.client_note} /> : null}
        </Card>

        <Card>
          <RouteBlock pickup={activeRide.pickup_address} dropoff={activeRide.dropoff_address} />
          {!navOpen ? (
            <Btn title={`Naviguer vers ${navTarget().label}`} onPress={() => setNavOpen(true)} />
          ) : (
            <View style={{ gap: 10 }}>
              <SectionLabel>Choisir mon GPS</SectionLabel>
              <Btn title="Waze" onPress={() => handleNavigate('waze')} />
              <Btn title="Google Maps" variant="secondary" onPress={() => handleNavigate('google')} />
              <Btn title="Autre application GPS" variant="secondary" onPress={() => handleNavigate('other')} />
              <Btn title="Annuler" variant="secondary" onPress={() => setNavOpen(false)} />
            </View>
          )}
        </Card>

        {clientInfo ? (
          <Card>
            <SectionLabel>Client</SectionLabel>
            <Text style={styles.clientName}>{clientInfo.name ?? 'Non renseigne'}</Text>
            <Text style={styles.mutedSmall}>{clientInfo.phone ?? 'Telephone non renseigne'}</Text>
            {clientInfo.phone ? (
              <View style={styles.contactRow}>
                <View style={{ flex: 1 }}>
                  <Btn title="Appeler" onPress={() => Linking.openURL(`tel:${clientInfo.phone}`)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Btn title="WhatsApp" variant="whatsapp" onPress={() => Linking.openURL(whatsappUrl(clientInfo.phone))} />
                </View>
              </View>
            ) : null}
          </Card>
        ) : null}

        {(activeRide.ride_step ?? 'not_started') === 'not_started' && <Btn title="Je suis en route" onPress={() => handleAdvanceStep('en_route')} />}
        {activeRide.ride_step === 'en_route' && <Btn title="Je suis arrive" onPress={() => handleAdvanceStep('on_site')} />}
        {activeRide.ride_step === 'on_site' && <Btn title="Terminer la course" onPress={handleComplete} />}
        <Btn title="Telecharger le bon de commande" variant="secondary" onPress={handleDownloadBonCommande} />
        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
        {!releaseOpen ? (
          <Btn title="Me desister / dispatcher la course" variant="secondary" onPress={openRelease} />
        ) : (
          <Card>
            <SectionLabel>Remettre la course en dispatch</SectionLabel>
            {[{ id: 'all', label: 'Tous les chauffeurs de ma gamme' }, ...colleagues.map((c) => ({ id: c.id, label: `${c.name} - ${VEHICLE_LABELS[c.vehicle_category] ?? c.vehicle_category}${c.online ? ' (en ligne)' : ''}` }))].map((opt) => (
              <TouchableOpacity key={opt.id} style={[styles.releaseOption, releaseTarget === opt.id && styles.releaseOptionSelected]} onPress={() => setReleaseTarget(opt.id)}>
                <Text style={releaseTarget === opt.id ? styles.releaseTextSelected : styles.releaseText}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
            <Btn title={releasing ? 'Envoi...' : 'Confirmer le dispatch'} onPress={handleRelease} disabled={releasing} />
            <Btn title="Annuler" variant="secondary" onPress={() => setReleaseOpen(false)} />
          </Card>
        )}
      </ScrollView>
    );
  }

  return (
    <View style={styles.listScreen}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Courses disponibles</Text>
        <Pill>{pendingRides.length}</Pill>
      </View>
      {permissions.can_create_rides ? <Btn title="+ Saisir une reservation" onPress={() => setShowCreateRide(true)} /> : null}
      {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
      {pendingRides.length === 0 ? (
        <Card>
          <Text style={styles.clientName}>Aucune course pour le moment</Text>
          <Text style={styles.mutedSmall}>Les nouvelles courses de votre gamme apparaissent ici automatiquement.</Text>
        </Card>
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={{ gap: 14, paddingBottom: 24 }}
          data={pendingRides}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Card>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <SectionLabel>Date et heure</SectionLabel>
                  <Text style={styles.dateValue}>{formatRideDateTime(item.scheduled_at)}</Text>
                </View>
                <Text style={styles.bigPrice}>{item.price != null ? `${Number(item.price).toFixed(2)} €` : '-'}</Text>
              </View>
              <View style={styles.pillRow}>
                <Pill>👥 {item.passenger_count ?? 1}</Pill>
                <Pill>🧳 {item.luggage_count ?? 0}</Pill>
                {item.child_seats > 0 || item.booster_seats > 0 ? <Pill highlight>👶 Siege{agesLabel(item.child_ages)}</Pill> : null}
                <Pill>{PAYMENT_LABELS[item.payment_method]}</Pill>
              </View>
              <RouteBlock pickup={item.pickup_address} dropoff={item.dropoff_address} />
              {item.client_note ? <ClientNote text={item.client_note} /> : null}
              <RideMiniMap
                pickupLat={item.pickup_lat}
                pickupLng={item.pickup_lng}
                dropoffLat={item.dropoff_lat}
                dropoffLng={item.dropoff_lng}
              />
              <Btn title="Accepter la course" onPress={() => handleAccept(item.id)} />
            </Card>
          )}
        />
      )}
      <TouchableOpacity onPress={() => setShowSettings(true)}>
        <Text style={styles.link}>Changer ma gamme de vehicule</Text>
      </TouchableOpacity>
    </View>
  );
}

function ClientNote({ text }) {
  return (
    <View style={styles.noteBox}>
      <SectionLabel>Information du client</SectionLabel>
      <Text style={styles.noteText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  noteBox: { borderWidth: 1, borderColor: theme.colors.accent, borderRadius: 14, padding: 12, gap: 4 },
  noteText: { color: theme.colors.text, fontSize: 15 },
  scroll: { width: '100%', flex: 1, backgroundColor: theme.colors.background },
  activeContent: { padding: 16, gap: 14, paddingBottom: 32 },
  listScreen: { width: '100%', flex: 1, backgroundColor: theme.colors.background, padding: 16, gap: 14 },
  container: { width: '100%', flex: 1, alignItems: 'center', gap: 12, backgroundColor: theme.colors.background, padding: 16 },
  list: { width: '100%' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, fontWeight: '800', color: theme.colors.text },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bigPrice: { color: theme.colors.accent, fontSize: 26, fontWeight: '800' },
  dateValue: { color: theme.colors.text, fontSize: 17, fontWeight: '700', marginTop: 2 },
  clientName: { color: theme.colors.text, fontSize: 18, fontWeight: '700' },
  mutedSmall: { color: theme.colors.textMuted, fontSize: 13 },
  contactRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  error: { color: theme.colors.error },
  priceInput: { borderWidth: 1, borderColor: theme.colors.inputBorder, backgroundColor: theme.colors.input, borderRadius: 12, padding: 12, color: theme.colors.text, fontSize: 18 },
  releaseOption: { borderWidth: 1, borderColor: theme.colors.inputBorder, borderRadius: 12, padding: 12 },
  releaseOptionSelected: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  releaseText: { color: theme.colors.text },
  releaseTextSelected: { color: theme.colors.accentText, fontWeight: '800' },
  link: { color: theme.colors.accent, textAlign: 'center', marginTop: 4, marginBottom: 12 },
});
