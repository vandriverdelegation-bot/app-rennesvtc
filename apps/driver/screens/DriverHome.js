import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, FlatList, ActivityIndicator, Linking, ScrollView, BackHandler } from 'react-native';
import * as Location from 'expo-location';
import { theme, whatsappUrl } from '@app-rennesvtc/shared';
import { supabase } from '../lib/supabase';
import DriverSettings from './DriverSettings';
import CreateRide from './CreateRide';
import RideMiniMap from './RideMiniMap';
import { Btn, Card, Pill, RouteBlock, SectionLabel } from '../ui';

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
  const locationSubscription = useRef(null);

  async function refresh() {
    const { data: active } = await supabase
      .from('rides')
      .select('id, pickup_address, dropoff_address, status, pickup_lat, pickup_lng, payment_method, service_type, price, ride_step, passenger_count, luggage_count, child_seats, booster_seats, vehicle_category')
      .eq('driver_id', session.user.id)
      .eq('status', 'accepted')
      .maybeSingle();
    setActiveRide(active ?? null);

    if (!active) {
      const { data: pending } = await supabase
        .from('rides')
        .select('id, pickup_address, dropoff_address, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, status, payment_method, service_type, price, scheduled_at, created_at, passenger_count, luggage_count, child_seats, booster_seats')
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

  // Envoie la position GPS du chauffeur pendant qu'une course est en cours, pour le suivi cote client.
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
          <View style={styles.pillRow}>
            <Pill>{SERVICE_LABELS[activeRide.service_type]}</Pill>
            <Pill>{PAYMENT_LABELS[activeRide.payment_method]}</Pill>
            {activeRide.vehicle_category ? <Pill>Gamme {VEHICLE_LABELS[activeRide.vehicle_category]}</Pill> : null}
          </View>
          <View style={styles.pillRow}>
            <Pill>👥 {activeRide.passenger_count ?? 1} passager(s)</Pill>
            <Pill>🧳 {activeRide.luggage_count ?? 0} bagage(s)</Pill>
            {activeRide.child_seats > 0 ? <Pill highlight>👶 Siege auto x{activeRide.child_seats}</Pill> : null}
            {activeRide.booster_seats > 0 ? <Pill highlight>🧒 Rehausseur x{activeRide.booster_seats}</Pill> : null}
          </View>
          {!seats ? <Text style={styles.mutedSmall}>Aucun siege enfant demande.</Text> : null}
        </Card>

        <Card>
          <RouteBlock pickup={activeRide.pickup_address} dropoff={activeRide.dropoff_address} />
          <Btn title="Naviguer vers le depart" onPress={handleNavigate} />
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
                {item.child_seats > 0 || item.booster_seats > 0 ? <Pill highlight>👶 Siege</Pill> : null}
                <Pill>{PAYMENT_LABELS[item.payment_method]}</Pill>
              </View>
              <RouteBlock pickup={item.pickup_address} dropoff={item.dropoff_address} />
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

const styles = StyleSheet.create({
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
  link: { color: theme.colors.accent, textAlign: 'center', marginTop: 4, marginBottom: 12 },
});
