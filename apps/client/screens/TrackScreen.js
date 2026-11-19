import { useEffect, useState } from 'react';
import { Image, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { theme, whatsappUrl, themedStyles } from '@app-rennesvtc/shared';
import { COMPANY_PHONE, crowKm, cityMinutes, km1, shortDay, timeOf } from '../lib/format';
import { Icon } from '../icons';
import { FONT } from '../ui';
import RideCard from './RideCard';
import RouteSketch from './RouteSketch';

const c = theme.colors;

const STEP_TITLES = {
  not_started: 'Chauffeur confirmé',
  en_route: 'Votre chauffeur est en route',
  on_site: 'Votre chauffeur est arrivé',
  on_board: 'Vous êtes en route',
};

function whenText(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  return `${same ? "Aujourd'hui" : shortDay(d)} à ${timeOf(d)}`;
}

function Step({ title, sub, last }) {
  return (
    <View style={styles.step}>
      <View style={styles.rail}>
        <View style={styles.dot} />
        {last ? null : <View style={styles.line} />}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : 14 }}>
        <Text style={styles.stepTitle}>{title}</Text>
        {sub ? <Text style={styles.stepSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

// Suivi de la course en cours : position du chauffeur, contact, vehicule, etapes. « Voir le detail » ouvre la reservation complete (chat, annulation...).
export default function TrackScreen({ ride, session, onBack, onChanged }) {
  const [driver, setDriver] = useState(null);
  const [detail, setDetail] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/client/ride-driver/${ride.id}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => alive && setDriver(d))
      .catch(() => {});
    return () => { alive = false; };
  }, [ride.id]);

  const step = ride.ride_step ?? 'not_started';
  const live = ['en_route', 'on_site', 'on_board'].includes(step) && ride.driver_lat && ride.driver_lng;
  const pickup = { lat: ride.pickup_lat, lng: ride.pickup_lng };
  const dropoff = { lat: ride.dropoff_lat, lng: ride.dropoff_lng };
  const target = step === 'on_board' ? dropoff : pickup;
  const km = live ? crowKm({ lat: ride.driver_lat, lng: ride.driver_lng }, target) : null;
  const points = [{ latitude: ride.pickup_lat, longitude: ride.pickup_lng }, { latitude: ride.dropoff_lat, longitude: ride.dropoff_lng }];
  if (live) points.push({ latitude: ride.driver_lat, longitude: ride.driver_lng });
  const phone = driver?.phone || COMPANY_PHONE;
  const startedAt = ride.step_times?.[step];
  const when = ride.scheduled_at ? whenText(ride.scheduled_at) : 'Dès que possible';
  const transport = ride.transport_number ? ` · ${ride.transport_type === 'train' ? 'Train' : 'Vol'} ${ride.transport_number}` : '';

  if (detail) {
    return (
      <View style={styles.root}>
        <View style={styles.bar}>
          <TouchableOpacity onPress={() => setDetail(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Retour au suivi"><Text style={styles.back}>‹</Text></TouchableOpacity>
          <Text style={styles.barTitle}>Détail de ma course</Text>
          <View style={{ width: 28 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
          <RideCard ride={ride} session={session} onChanged={() => { onChanged?.(); }} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.bar}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Retour"><Text style={styles.back}>‹</Text></TouchableOpacity>
        <Text style={styles.barTitle}>Suivi de ma course</Text>
        <TouchableOpacity onPress={() => Linking.openURL(`tel:${COMPANY_PHONE}`)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Besoin d'aide ? Appeler Rennes VTC">
          <Icon name="headset" color="w" size={26} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View>
          <RouteSketch points={points} height={290} style={{ borderRadius: 0 }} />
          <View style={styles.chip}>
            <Icon name="navhome" color="g" size={24} />
            <View>
              {km != null ? (
                <>
                  <Text style={styles.chipBig}>À {cityMinutes(km * 1)} min</Text>
                  <Text style={styles.chipSmall}>{km1(km)} km</Text>
                </>
              ) : (
                <>
                  <Text style={styles.chipBig}>{ride.status === 'accepted' ? 'Chauffeur confirmé' : 'En attente'}</Text>
                  <Text style={styles.chipSmall}>{when}</Text>
                </>
              )}
            </View>
          </View>
        </View>

        <View style={styles.sheet}>
          <View style={styles.driverRow}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{(driver?.name ?? 'C')[0].toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>{driver?.name ?? 'Votre chauffeur'}</Text>
              <Text style={styles.driverSub}>Rennes VTC</Text>
            </View>
            <TouchableOpacity style={styles.round} onPress={() => Linking.openURL(`tel:${phone}`)} accessibilityLabel="Appeler le chauffeur"><Icon name="phone" color="g" size={22} /></TouchableOpacity>
            <TouchableOpacity style={styles.round} onPress={() => setDetail(true)} accessibilityLabel="Messages"><Icon name="message" color="g" size={22} /></TouchableOpacity>
          </View>

          {driver?.vehicle ? (
            <View style={styles.vehicle}>
              <View style={{ flex: 1 }}>
                <Text style={styles.vehicleName}>{driver.vehicle.display_name}</Text>
                <Text style={styles.plate}>{[driver.vehicle.color, driver.vehicle.plate].filter(Boolean).join(' · ')}</Text>
              </View>
              {driver.vehicle.photo_url ? <Image source={{ uri: driver.vehicle.photo_url }} style={styles.vehiclePhoto} resizeMode="cover" /> : null}
            </View>
          ) : null}

          <View style={{ marginTop: 14 }}>
            <Step title={STEP_TITLES[step] ?? 'Chauffeur confirmé'} sub={startedAt ? whenText(startedAt) : when} />
            <Step title="Prise en charge" sub={`${km != null && step !== 'on_board' ? `Dans ${cityMinutes(km)} min · ${km1(km)} km · ` : ''}${ride.pickup_address}${transport}`} />
            <Step title="Destination" sub={ride.dropoff_address} last />
          </View>

          <TouchableOpacity style={styles.detailBtn} onPress={() => setDetail(true)} activeOpacity={0.85}>
            <Text style={styles.detailText}>Voir le détail de ma course</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, width: '100%', backgroundColor: c.background },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 },
  back: { color: c.text, fontSize: 38, lineHeight: 38, width: 28 },
  barTitle: { color: c.text, fontSize: 19, fontFamily: FONT.title },
  chip: { position: 'absolute', top: 14, left: 16, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, backgroundColor: 'rgba(10,12,10,0.88)', borderWidth: 1, borderColor: c.cardBorder },
  chipBig: { color: '#F2F2EE', fontSize: 20, fontFamily: FONT.title },
  chipSmall: { color: '#9AA19A', fontSize: 14, fontFamily: FONT.body },
  sheet: { marginTop: -22, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24, gap: 6 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.accentSoft, borderWidth: 2, borderColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: c.accentLight, fontSize: 24, fontFamily: FONT.title },
  driverName: { color: c.text, fontSize: 20, fontFamily: FONT.title },
  driverSub: { color: c.textMuted, fontSize: 13, fontFamily: FONT.body },
  round: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.accentTint, alignItems: 'center', justifyContent: 'center' },
  vehicle: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  vehicleName: { color: c.text, fontSize: 17, fontFamily: FONT.semi },
  plate: { color: c.textMuted, fontSize: 14, fontFamily: FONT.body, marginTop: 2 },
  vehiclePhoto: { width: 150, height: 76, borderRadius: 14 },
  step: { flexDirection: 'row', gap: 12 },
  rail: { width: 18, alignItems: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: c.accent, backgroundColor: c.card, marginTop: 4 },
  line: { flex: 1, width: 2, backgroundColor: c.accent, opacity: 0.5, marginTop: 2 },
  stepTitle: { color: c.text, fontSize: 16, fontFamily: FONT.semi },
  stepSub: { color: c.textMuted, fontSize: 13, fontFamily: FONT.body, marginTop: 2 },
  detailBtn: { marginTop: 16, minHeight: 52, borderRadius: 26, borderWidth: 1.5, borderColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  detailText: { color: c.text, fontSize: 16, fontFamily: FONT.title },
}));
