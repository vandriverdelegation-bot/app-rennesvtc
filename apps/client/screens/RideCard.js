import { useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme, whatsappUrl } from '@app-rennesvtc/shared';
import { supabase } from '../lib/supabase';
import { COMPANY_PHONE, euro, longDay, plural, relativeWhen, timeOf } from '../lib/format';
import { Icon } from '../icons';
import RouteSketch from './RouteSketch';
import RideChat from './RideChat';
import { FONT, RouteBlock, SectionLabel } from '../ui';

const STATUS_LABELS = {
  pending: "En attente d'un chauffeur",
  dispatched: "En attente d'un chauffeur",
  accepted: 'Chauffeur confirmé',
};
const VEHICLE_LABELS = { confort: 'Confort', affaires: 'Affaires', van: 'Van' };
const CANCEL_DELAY_HOURS = 24;

function MiniMap({ ride }) {
  const points = [
    { latitude: ride.pickup_lat, longitude: ride.pickup_lng },
    { latitude: ride.dropoff_lat, longitude: ride.dropoff_lng },
  ];
  if (['en_route', 'on_site', 'on_board'].includes(ride.ride_step) && ride.driver_lat && ride.driver_lng) points.push({ latitude: ride.driver_lat, longitude: ride.driver_lng });
  return <RouteSketch points={points} height={150} />;
}

function Chip({ icon, children }) {
  return (
    <View style={styles.chip}>
      <Icon name={icon} color="m" size={18} />
      <Text style={styles.chipText}>{children}</Text>
    </View>
  );
}

function ActionBtn({ icon, label, onPress, style }) {
  return (
    <TouchableOpacity style={[styles.action, style]} onPress={onPress} activeOpacity={0.8} accessibilityLabel={label}>
      <Icon name={icon} color="w" size={17} />
      {label ? <Text style={styles.actionText}>{label}</Text> : null}
    </TouchableOpacity>
  );
}

// Reservation du client : statut, date, prix, trajet, details, coordonnees du chauffeur et annulation.
export default function RideCard({ ride, session, onChanged, showMap = true }) {
  const [driverInfo, setDriverInfo] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');

  const accepted = ride.status === 'accepted';
  const when = ride.scheduled_at ? new Date(ride.scheduled_at) : null;
  const hoursLeft = when ? (when - Date.now()) / 3600000 : 0;
  const locked = accepted && hoursLeft < CANCEL_DELAY_HOURS; // chauffeur engage et course trop proche
  const contactPhone = accepted && driverInfo?.phone ? driverInfo.phone : COMPANY_PHONE;

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
    Alert.alert('Annuler cette réservation ?', `${when ? `${longDay(when)} à ${timeOf(when)}` : 'Dès que possible'}\n${ride.pickup_address}`, [
      { text: 'Non, la garder', style: 'cancel' },
      { text: 'Oui, annuler', style: 'destructive', onPress: doCancel },
    ]);
  }

  function openOptions() {
    Alert.alert('Ma réservation', undefined, [
      ...(locked ? [] : [{ text: 'Annuler la réservation', style: 'destructive', onPress: confirmCancel }]),
      { text: 'Fermer', style: 'cancel' },
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
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.statusRow}>
          <View style={[styles.statusPill, !accepted && styles.statusPillWait]}>
            <View style={[styles.statusHalo, !accepted && styles.statusHaloWait]}>
              <View style={[styles.statusDot, !accepted && styles.statusDotWait]} />
            </View>
            <Text style={[styles.statusText, !accepted && { color: theme.colors.textMuted }]}>{STATUS_LABELS[ride.status] ?? ride.status}</Text>
          </View>
          {when ? <Text style={styles.relative}>{relativeWhen(when)}</Text> : null}
        </View>
        <View style={styles.dateRow}>
          {when ? (
            <View style={{ gap: 2 }}>
              <Text style={styles.day}>{longDay(when)}</Text>
              <Text style={styles.time}>{timeOf(when)}</Text>
            </View>
          ) : (
            <Text style={styles.asap}>Dès que possible</Text>
          )}
          <View style={styles.priceBox}>
            <Text style={styles.priceLabel}>{ride.price != null ? 'Prix fixe' : 'Prix'}</Text>
            <Text style={ride.price != null ? styles.price : styles.priceTbd}>{ride.price != null ? euro(ride.price) : 'À confirmer'}</Text>
          </View>
        </View>
      </View>

      {showMap && ride.pickup_lat && ride.dropoff_lat ? (
        <View style={styles.map}>
          <MiniMap ride={ride} />
        </View>
      ) : null}

      <View style={styles.route}>
        <RouteBlock pickup={ride.pickup_address} dropoff={ride.dropoff_address} />
      </View>

      <View style={styles.details}>
        <View style={styles.chips}>
          <Chip icon="van">{VEHICLE_LABELS[ride.vehicle_category] ?? 'Véhicule'}</Chip>
          <Chip icon="user">{plural(ride.passenger_count ?? 1, 'passager')}</Chip>
          <Chip icon="luggage">{plural(ride.luggage_count ?? 0, 'bagage')}</Chip>
        </View>
        {ride.child_seats > 0 || ride.booster_seats > 0 || ride.round_trip ? (
          <Text style={styles.extras}>{[ride.round_trip ? 'Aller-retour' : null, ride.child_seats > 0 ? 'Siège enfant' : null, ride.booster_seats > 0 ? 'Rehausseur' : null].filter(Boolean).join(' · ')}</Text>
        ) : null}
        {accepted ? (
          <View style={styles.driverBox}>
            <SectionLabel>Votre chauffeur</SectionLabel>
            <Text style={styles.driverName}>{driverInfo?.name ?? 'Chauffeur'}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <ActionBtn icon="phone" label="Appeler" style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${contactPhone}`)} />
        <ActionBtn icon="message" label="WhatsApp" style={{ flex: 1 }} onPress={() => Linking.openURL(whatsappUrl(contactPhone))} />
        <ActionBtn icon="dots" onPress={openOptions} style={styles.actionSquare} label="" />
      </View>

      {accepted ? (
        <View style={styles.chat}>
          <RideChat session={session} rideId={ride.id} me="client" />
        </View>
      ) : null}

      {locked ? (
        <View style={styles.lockedBox}>
          <Text style={styles.lockedTitle}>Annulation impossible</Text>
          <Text style={styles.lockedText}>La course a lieu dans moins de {CANCEL_DELAY_HOURS} h. Contactez le chauffeur.</Text>
        </View>
      ) : null}
      {cancelling ? <Text style={styles.muted}>Annulation...</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const c = theme.colors;
const styles = StyleSheet.create({
  card: { width: '100%', borderRadius: 26, backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder, overflow: 'hidden' },
  top: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 16, gap: 14 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 30, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(91,212,42,0.12)', flexShrink: 1 },
  statusPillWait: { backgroundColor: 'rgba(154,161,154,0.12)' },
  statusHalo: { width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(91,212,42,0.2)', alignItems: 'center', justifyContent: 'center', marginLeft: -4 },
  statusHaloWait: { backgroundColor: 'rgba(154,161,154,0.2)' },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent },
  statusDotWait: { backgroundColor: c.textMuted },
  statusText: { color: '#7EE04F', fontSize: 13, fontFamily: FONT.semi, flexShrink: 1 },
  relative: { color: c.textMuted, fontSize: 13, fontFamily: FONT.body },
  dateRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  day: { color: c.textMuted, fontSize: 13, fontFamily: FONT.body },
  time: { color: c.text, fontSize: 40, lineHeight: 42, fontFamily: FONT.title, letterSpacing: -0.8 },
  asap: { color: c.text, fontSize: 26, fontFamily: FONT.title, flex: 1 },
  priceBox: { alignItems: 'flex-end', gap: 2 },
  priceLabel: { color: c.textMuted, fontSize: 12, fontFamily: FONT.body },
  price: { color: c.accent, fontSize: 26, fontFamily: FONT.title },
  priceTbd: { color: c.textMuted, fontSize: 16, fontFamily: FONT.semi },
  map: { marginHorizontal: 12 },
  route: { paddingTop: 18, paddingHorizontal: 20, paddingBottom: 4 },
  details: { paddingVertical: 16, paddingHorizontal: 20, gap: 10 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, borderRadius: 14, backgroundColor: '#1A1D1A', paddingVertical: 10, paddingHorizontal: 10, gap: 6 },
  chipText: { color: c.text, fontSize: 13, fontFamily: FONT.semi },
  extras: { color: c.textMuted, fontSize: 13, fontFamily: FONT.body },
  driverBox: { gap: 4, borderTopWidth: 1, borderTopColor: c.cardBorder, paddingTop: 12 },
  driverName: { color: c.text, fontSize: 17, fontFamily: FONT.title },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingBottom: 20 },
  action: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#2E332E', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionSquare: { width: 48 },
  actionText: { color: c.text, fontSize: 14, fontFamily: FONT.semi },
  chat: { paddingHorizontal: 20, paddingBottom: 20 },
  lockedBox: { marginHorizontal: 20, marginBottom: 20, borderWidth: 1, borderColor: c.error, borderRadius: 14, padding: 12, gap: 2 },
  lockedTitle: { color: c.error, fontFamily: FONT.semi },
  lockedText: { color: c.textMuted, fontSize: 13, fontFamily: FONT.body },
  muted: { color: c.textMuted, fontSize: 13, fontFamily: FONT.body, paddingHorizontal: 20, paddingBottom: 12 },
  error: { color: c.error, paddingHorizontal: 20, paddingBottom: 12 },
});
