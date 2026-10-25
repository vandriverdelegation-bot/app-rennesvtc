import { useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { theme, whatsappUrl } from '@app-rennesvtc/shared';
import { supabase } from '../lib/supabase';
import { Btn, Card, Pill, RouteBlock, SectionLabel } from '../ui';

const STATUS_LABELS = {
  pending: "En attente d'un chauffeur",
  dispatched: "En attente d'un chauffeur",
  accepted: 'Chauffeur confirme',
};
const VEHICLE_LABELS = { confort: 'Confort', affaires: 'Affaires', van: 'Van' };
const CANCEL_DELAY_HOURS = 24;

function formatWhen(ride) {
  if (!ride.scheduled_at) return 'Des que possible';
  const d = new Date(ride.scheduled_at);
  return d.toLocaleDateString('fr-FR') + ' a ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function MiniMap({ ride }) {
  const points = [
    { latitude: ride.pickup_lat, longitude: ride.pickup_lng },
    { latitude: ride.dropoff_lat, longitude: ride.dropoff_lng },
  ];
  if (ride.driver_lat && ride.driver_lng) points.push({ latitude: ride.driver_lat, longitude: ride.driver_lng });
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const region = {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    latitudeDelta: Math.max((Math.max(...lats) - Math.min(...lats)) * 1.8, 0.02),
    longitudeDelta: Math.max((Math.max(...lngs) - Math.min(...lngs)) * 1.8, 0.02),
  };
  return (
    <MapView style={styles.map} region={region} scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false}>
      <Marker coordinate={points[0]} pinColor={theme.colors.accent} />
      <Marker coordinate={points[1]} pinColor="red" />
      {points[2] ? <Marker coordinate={points[2]} pinColor="#3B82F6" /> : null}
      <Polyline coordinates={points.slice(0, 2)} strokeColor={theme.colors.accent} strokeWidth={3} />
    </MapView>
  );
}

// Reservation du client : recapitulatif, petite carte, coordonnees du chauffeur et annulation.
export default function RideCard({ ride, session, onChanged, showMap = true }) {
  const [driverInfo, setDriverInfo] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');

  const accepted = ride.status === 'accepted';
  const hoursLeft = ride.scheduled_at ? (new Date(ride.scheduled_at) - Date.now()) / 3600000 : 0;
  const locked = accepted && hoursLeft < CANCEL_DELAY_HOURS; // chauffeur engage et course trop proche

  useEffect(() => {
    setDriverInfo(null);
    if (!accepted) return;
    fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/client/ride-driver/${ride.id}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(setDriverInfo)
      .catch(() => {});
  }, [ride.id, accepted]);

  function confirmCancel() {
    Alert.alert('Annuler cette reservation ?', `${formatWhen(ride)}\n${ride.pickup_address}`, [
      { text: 'Non, la garder', style: 'cancel' },
      { text: 'Oui, annuler', style: 'destructive', onPress: doCancel },
    ]);
  }

  async function doCancel() {
    setCancelling(true);
    setError('');
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/client/rides/${ride.id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) setError((await res.json()).error ?? "Erreur lors de l'annulation");
      else onChanged?.();
    } catch (e) {
      setError('Connexion au serveur impossible.');
    }
    setCancelling(false);
  }

  return (
    <Card>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <SectionLabel>Date et heure</SectionLabel>
          <Text style={styles.when}>{formatWhen(ride)}</Text>
        </View>
        <Text style={styles.price}>{ride.price != null ? `${Number(ride.price).toFixed(2)} €` : 'Prix a confirmer'}</Text>
      </View>

      <View style={styles.pillRow}>
        <Pill highlight={accepted}>{STATUS_LABELS[ride.status] ?? ride.status}</Pill>
        {ride.vehicle_category ? <Pill>{VEHICLE_LABELS[ride.vehicle_category]}</Pill> : null}
        <Pill>👥 {ride.passenger_count ?? 1}</Pill>
        <Pill>🧳 {ride.luggage_count ?? 0}</Pill>
        {ride.child_seats > 0 || ride.booster_seats > 0 ? <Pill>👶 Siege</Pill> : null}
        {ride.round_trip ? <Pill>Aller-retour</Pill> : null}
      </View>

      <RouteBlock pickup={ride.pickup_address} dropoff={ride.dropoff_address} />
      {showMap && ride.pickup_lat && ride.dropoff_lat ? <MiniMap ride={ride} /> : null}

      {accepted ? (
        <View style={styles.driverBox}>
          <SectionLabel>Votre chauffeur</SectionLabel>
          <Text style={styles.driverName}>{driverInfo?.name ?? 'Chauffeur'}</Text>
          {driverInfo?.phone ? (
            <>
              <Text style={styles.muted}>{driverInfo.phone}</Text>
              <View style={styles.contactRow}>
                <View style={{ flex: 1 }}>
                  <Btn title="Appeler" onPress={() => Linking.openURL(`tel:${driverInfo.phone}`)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Btn title="WhatsApp" variant="whatsapp" onPress={() => Linking.openURL(whatsappUrl(driverInfo.phone))} />
                </View>
              </View>
            </>
          ) : driverInfo ? (
            <Text style={styles.muted}>Telephone non renseigne</Text>
          ) : null}
        </View>
      ) : null}

      {locked ? (
        <View style={styles.lockedBox}>
          <Text style={styles.lockedTitle}>Annulation impossible</Text>
          <Text style={styles.muted}>La course a lieu dans moins de {CANCEL_DELAY_HOURS} h. Contactez le chauffeur.</Text>
        </View>
      ) : (
        <Btn title={cancelling ? 'Annulation...' : 'Annuler la reservation'} variant="secondary" onPress={confirmCancel} disabled={cancelling} />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  when: { color: theme.colors.text, fontSize: 17, fontWeight: '700', marginTop: 2 },
  price: { color: theme.colors.accent, fontSize: 22, fontWeight: '800' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  map: { width: '100%', height: 150, borderRadius: 14 },
  driverBox: { gap: 4, borderTopWidth: 1, borderTopColor: theme.colors.cardBorder, paddingTop: 12 },
  driverName: { color: theme.colors.text, fontSize: 18, fontWeight: '700' },
  muted: { color: theme.colors.textMuted, fontSize: 13 },
  contactRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  lockedBox: { borderWidth: 1, borderColor: theme.colors.error, borderRadius: 14, padding: 12, gap: 2 },
  lockedTitle: { color: theme.colors.error, fontWeight: '800' },
  error: { color: theme.colors.error },
});
