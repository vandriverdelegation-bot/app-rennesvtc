import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, FlatList, ActivityIndicator, Linking, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import { theme } from '@app-rennesvtc/shared';
import { supabase } from '../lib/supabase';
import DriverSettings from './DriverSettings';
import CreateRide from './CreateRide';
import RideMiniMap from './RideMiniMap';

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
        .select('id, pickup_address, dropoff_address, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, status, payment_method, service_type, price, scheduled_at, created_at')
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
      startTracking();
    }
    return () => {
      locationSubscription.current?.remove();
      locationSubscription.current = null;
    };
  }, [activeRide?.id]);

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

  async function handleComplete() {
    await supabase
      .from('rides')
      .update({ status: 'completed', ride_step: 'completed' })
      .eq('id', activeRide.id)
      .eq('driver_id', session.user.id);
    refresh();
  }

  async function handleAdvanceStep(nextStep) {
    await supabase
      .from('rides')
      .update({ ride_step: nextStep })
      .eq('id', activeRide.id)
      .eq('driver_id', session.user.id);
    refresh();
  }

  function handleNavigate() {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${activeRide.pickup_lat},${activeRide.pickup_lng}`;
    Linking.openURL(url);
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
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.container, { flex: undefined, flexGrow: 1 }]}>
        <Text style={styles.title}>Course en cours</Text>
        {clientInfo ? (
          <View style={styles.card}>
            <Text style={styles.label}>Client</Text>
            <Text style={styles.value}>{clientInfo.name ?? 'Non renseigne'}</Text>
            <Text style={styles.label}>Telephone</Text>
            <Text style={styles.value}>{clientInfo.phone ?? 'Non renseigne'}</Text>
            {clientInfo.phone ? (
              <TouchableOpacity style={styles.button} onPress={() => Linking.openURL(`tel:${clientInfo.phone}`)}>
                <Text style={styles.buttonText}>Appeler le client</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
        <View style={styles.card}>
          <Text style={styles.label}>Prestation demandee</Text>
          <View style={styles.badgeRow}>
            <View style={styles.badge}><Text style={styles.badgeText}>{activeRide.passenger_count ?? 1} passager(s)</Text></View>
            <View style={styles.badge}><Text style={styles.badgeText}>{activeRide.luggage_count ?? 0} bagage(s)</Text></View>
            {activeRide.vehicle_category ? (
              <View style={styles.badge}><Text style={styles.badgeText}>Gamme {VEHICLE_LABELS[activeRide.vehicle_category]}</Text></View>
            ) : null}
            {activeRide.child_seats > 0 ? (
              <View style={styles.badgeAlert}><Text style={styles.badgeAlertText}>👶 Siege auto x{activeRide.child_seats}</Text></View>
            ) : null}
            {activeRide.booster_seats > 0 ? (
              <View style={styles.badgeAlert}><Text style={styles.badgeAlertText}>🧒 Rehausseur x{activeRide.booster_seats}</Text></View>
            ) : null}
          </View>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Depart</Text>
          <Text style={styles.value}>{activeRide.pickup_address}</Text>
          <Text style={styles.label}>Destination</Text>
          <Text style={styles.value}>{activeRide.dropoff_address}</Text>
          <Text style={styles.label}>Service</Text>
          <Text style={styles.priceValue}>{SERVICE_LABELS[activeRide.service_type]} · {activeRide.price} €</Text>
          <Text style={styles.label}>Reglement</Text>
          <Text style={styles.value}>{PAYMENT_LABELS[activeRide.payment_method]}</Text>
        </View>
        <TouchableOpacity style={styles.button} onPress={handleNavigate}>
          <Text style={styles.buttonText}>Naviguer vers le depart</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.buttonSecondary} onPress={handleDownloadBonCommande}>
          <Text style={styles.buttonSecondaryText}>Telecharger le bon de commande</Text>
        </TouchableOpacity>
        {(activeRide.ride_step ?? 'not_started') === 'not_started' && (
          <TouchableOpacity style={styles.buttonSecondary} onPress={() => handleAdvanceStep('en_route')}>
            <Text style={styles.buttonSecondaryText}>Je suis en route</Text>
          </TouchableOpacity>
        )}
        {activeRide.ride_step === 'en_route' && (
          <TouchableOpacity style={styles.buttonSecondary} onPress={() => handleAdvanceStep('on_site')}>
            <Text style={styles.buttonSecondaryText}>Je suis arrive</Text>
          </TouchableOpacity>
        )}
        {activeRide.ride_step === 'on_site' && (
          <TouchableOpacity style={styles.buttonSecondary} onPress={handleComplete}>
            <Text style={styles.buttonSecondaryText}>Terminer la course</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Courses disponibles</Text>
      {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
      {pendingRides.length === 0 ? (
        <Text style={styles.mutedText}>Aucune course disponible pour votre gamme.</Text>
      ) : (
        <FlatList
          style={styles.list}
          data={pendingRides}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.label}>Date et heure</Text>
              <Text style={styles.value}>{formatRideDateTime(item.scheduled_at)}</Text>
              <Text style={styles.label}>Depart</Text>
              <Text style={styles.value}>{item.pickup_address}</Text>
              <Text style={styles.label}>Destination</Text>
              <Text style={styles.value}>{item.dropoff_address}</Text>
              <RideMiniMap
                pickupLat={item.pickup_lat}
                pickupLng={item.pickup_lng}
                dropoffLat={item.dropoff_lat}
                dropoffLng={item.dropoff_lng}
              />
              <Text style={styles.label}>Service</Text>
              <Text style={styles.priceValue}>{SERVICE_LABELS[item.service_type]} · {item.price} €</Text>
              <Text style={styles.label}>Reglement</Text>
              <Text style={styles.value}>{PAYMENT_LABELS[item.payment_method]}</Text>
              <TouchableOpacity style={styles.button} onPress={() => handleAccept(item.id)}>
                <Text style={styles.buttonText}>Accepter</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
      {permissions.can_create_rides ? (
        <TouchableOpacity style={styles.buttonSecondary} onPress={() => setShowCreateRide(true)}>
          <Text style={styles.buttonSecondaryText}>Creer une reservation</Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity onPress={() => setShowSettings(true)}>
        <Text style={styles.link}>Changer ma gamme de vehicule</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { width: '100%', flex: 1, backgroundColor: theme.colors.background },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  badge: { borderWidth: 1, borderColor: theme.colors.inputBorder, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  badgeText: { color: theme.colors.text, fontSize: 13 },
  badgeAlert: { backgroundColor: theme.colors.accent, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  badgeAlertText: { color: theme.colors.accentText, fontSize: 13, fontWeight: '700' },
  container: { width: '100%', flex: 1, alignItems: 'center', gap: 12, backgroundColor: theme.colors.background, padding: 16 },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.text, alignSelf: 'flex-start' },
  label: { fontWeight: '700', marginTop: 8, color: theme.colors.textMuted, fontSize: 12 },
  value: { color: theme.colors.text, fontSize: 15 },
  priceValue: { color: theme.colors.accent, fontWeight: '700', fontSize: 15 },
  mutedText: { color: theme.colors.textMuted },
  list: { width: '100%' },
  card: {
    width: '100%',
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: theme.radius,
    padding: 14,
    marginBottom: 12,
  },
  button: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  buttonText: { color: theme.colors.accentText, fontWeight: '700' },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: theme.radius,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  buttonSecondaryText: { color: theme.colors.text, fontWeight: '700' },
  link: { color: theme.colors.accent, marginTop: 12, marginBottom: 12 },
  error: { color: theme.colors.error },
});
