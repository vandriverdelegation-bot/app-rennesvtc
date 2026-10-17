import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { supabase } from '../lib/supabase';
import { VEHICLE_CATEGORIES, theme } from '@app-rennesvtc/shared';
import { getDistanceKm } from '../lib/directions';
import AddressAutocomplete from './AddressAutocomplete';

const STATUS_LABELS = {
  pending: "En attente d'un chauffeur...",
  dispatched: "En attente d'un chauffeur...",
  accepted: 'Un chauffeur a accepte votre course',
};

const PAYMENT_METHODS = [
  { value: 'carte_a_bord', label: 'CB a bord', icon: '💳' },
  { value: 'especes', label: 'Especes', icon: '💶' },
  { value: 'compte', label: 'En compte', icon: '🧾' },
];

const SERVICE_TYPES = [
  { value: 'trajet_simple', label: 'Trajet simple', icon: '📍' },
  { value: 'mise_a_disposition', label: 'Mise a disposition', icon: '⏱️' },
  { value: 'forfait', label: 'Forfait', icon: '🎁' },
];

function SegmentedChoice({ options, value, onChange }) {
  return (
    <View style={styles.choiceRow}>
      {options.map((o) => (
        <TouchableOpacity
          key={o.value}
          style={[styles.choiceOption, value === o.value && styles.choiceOptionSelected]}
          onPress={() => onChange(o.value)}
        >
          {o.icon ? <Text style={styles.choiceIcon}>{o.icon}</Text> : null}
          <Text style={value === o.value ? styles.choiceTextSelected : styles.choiceText}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function SectionCard({ title, children }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {children}
    </View>
  );
}

export default function ClientHome({ session }) {
  const [activeRide, setActiveRide] = useState(undefined); // undefined = chargement initial
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [vehicleCategory, setVehicleCategory] = useState(null);
  const [serviceType, setServiceType] = useState(null);
  const [durationHours, setDurationHours] = useState('2');
  const [forfaits, setForfaits] = useState([]);
  const [selectedForfaitId, setSelectedForfaitId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [price, setPrice] = useState(null);
  const [priceError, setPriceError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function fetchActiveRide() {
    const { data } = await supabase
      .from('rides')
      .select(
        'id, pickup_address, dropoff_address, status, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, driver_lat, driver_lng, payment_method, vehicle_category, service_type, price'
      )
      .eq('client_id', session.user.id)
      .in('status', ['pending', 'dispatched', 'accepted'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveRide(data ?? null);
  }

  useEffect(() => {
    fetchActiveRide();
    const interval = setInterval(fetchActiveRide, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!vehicleCategory) return;
    supabase
      .from('forfaits')
      .select('id, name, price')
      .eq('vehicle_category', vehicleCategory)
      .then(({ data }) => setForfaits(data ?? []));
  }, [vehicleCategory]);

  // Calcule automatiquement le prix estime des que les informations necessaires sont disponibles.
  useEffect(() => {
    setPrice(null);
    setPriceError('');
    if (!vehicleCategory || !serviceType) return;

    if (serviceType === 'forfait') {
      const forfait = forfaits.find((f) => f.id === selectedForfaitId);
      if (forfait) setPrice(forfait.price);
      return;
    }

    if (serviceType === 'mise_a_disposition') {
      const hours = parseFloat(durationHours);
      if (!hours) return;
      supabase
        .from('pricing_hourly')
        .select('price_per_hour, min_hours')
        .eq('vehicle_category', vehicleCategory)
        .single()
        .then(({ data }) => {
          if (!data) return;
          if (hours < data.min_hours) {
            setPriceError(`Duree minimum : ${data.min_hours}h`);
            return;
          }
          setPrice(Math.round(hours * data.price_per_hour * 100) / 100);
        });
      return;
    }

    if (serviceType === 'trajet_simple') {
      if (!pickup || !dropoff) return;
      supabase
        .from('pricing_simple')
        .select('base_price, price_per_km, min_price')
        .eq('vehicle_category', vehicleCategory)
        .single()
        .then(async ({ data }) => {
          if (!data) return;
          try {
            const km = await getDistanceKm(pickup, dropoff);
            const estimated = data.base_price + data.price_per_km * km;
            setPrice(Math.round(Math.max(estimated, data.min_price) * 100) / 100);
          } catch (e) {
            setPriceError("Impossible de calculer le prix pour cet itineraire.");
          }
        });
    }
  }, [vehicleCategory, serviceType, pickup, dropoff, durationHours, selectedForfaitId, forfaits]);

  async function handleRequestRide() {
    setErrorMsg('');
    if (!pickup || !dropoff) {
      setErrorMsg('Choisissez une adresse de depart et une destination dans la liste.');
      return;
    }
    if (!vehicleCategory) {
      setErrorMsg('Choisissez une gamme de vehicule.');
      return;
    }
    if (!serviceType) {
      setErrorMsg('Choisissez un service.');
      return;
    }
    if (serviceType === 'forfait' && !selectedForfaitId) {
      setErrorMsg('Choisissez un forfait.');
      return;
    }
    if (!paymentMethod) {
      setErrorMsg('Choisissez un mode de reglement.');
      return;
    }
    if (!price) {
      setErrorMsg('Le prix est en cours de calcul, patientez.');
      return;
    }
    setSubmitting(true);
    const { data: ride, error } = await supabase
      .from('rides')
      .insert({
        client_id: session.user.id,
        pickup_address: pickup.address,
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        dropoff_address: dropoff.address,
        dropoff_lat: dropoff.lat,
        dropoff_lng: dropoff.lng,
        vehicle_category: vehicleCategory,
        payment_method: paymentMethod,
        service_type: serviceType,
        price,
        duration_hours: serviceType === 'mise_a_disposition' ? parseFloat(durationHours) : null,
        forfait_id: serviceType === 'forfait' ? selectedForfaitId : null,
      })
      .select()
      .single();
    setSubmitting(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/notify/new-ride`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ rideId: ride.id }),
    }).catch(() => {});
    setPickup(null);
    setDropoff(null);
    setVehicleCategory(null);
    setServiceType(null);
    setSelectedForfaitId(null);
    setPaymentMethod(null);
    fetchActiveRide();
  }

  if (activeRide === undefined) {
    return <ActivityIndicator style={styles.container} color={theme.colors.accent} />;
  }

  if (activeRide) {
    return (
      <View style={styles.container}>
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: activeRide.pickup_lat,
            longitude: activeRide.pickup_lng,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          <Marker
            coordinate={{ latitude: activeRide.pickup_lat, longitude: activeRide.pickup_lng }}
            title="Depart"
            pinColor={theme.colors.accent}
          />
          <Marker
            coordinate={{ latitude: activeRide.dropoff_lat, longitude: activeRide.dropoff_lng }}
            title="Destination"
            pinColor="red"
          />
          {activeRide.driver_lat && (
            <Marker
              coordinate={{ latitude: activeRide.driver_lat, longitude: activeRide.driver_lng }}
              title="Chauffeur"
              pinColor="#3B82F6"
            />
          )}
        </MapView>
        <View style={styles.statusBar}>
          <Text style={styles.status}>{STATUS_LABELS[activeRide.status]}</Text>
          <Text style={styles.paymentLabel}>
            {VEHICLE_CATEGORIES.find((c) => c.value === activeRide.vehicle_category)?.label}
            {' · '}
            {PAYMENT_METHODS.find((m) => m.value === activeRide.payment_method)?.label}
            {' · '}
            {activeRide.price} €
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContainer}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Demander une course</Text>

      <SectionCard title="Trajet">
        <AddressAutocomplete placeholder="Adresse de depart" onSelect={setPickup} />
        <View style={{ height: 8 }} />
        <AddressAutocomplete placeholder="Destination" onSelect={setDropoff} />
      </SectionCard>

      <SectionCard title="Gamme de vehicule">
        <SegmentedChoice options={VEHICLE_CATEGORIES} value={vehicleCategory} onChange={setVehicleCategory} />
      </SectionCard>

      <SectionCard title="Service">
        <SegmentedChoice options={SERVICE_TYPES} value={serviceType} onChange={setServiceType} />

        {serviceType === 'mise_a_disposition' && (
          <View style={styles.inlineField}>
            <Text style={styles.inlineLabel}>Duree (heures)</Text>
            <TextInput
              style={styles.durationInput}
              keyboardType="numeric"
              value={durationHours}
              onChangeText={setDurationHours}
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
        )}

        {serviceType === 'forfait' && (
          <View style={styles.inlineField}>
            {forfaits.length === 0 ? (
              <Text style={styles.mutedText}>Aucun forfait disponible pour cette gamme.</Text>
            ) : (
              <View style={styles.choiceRow}>
                {forfaits.map((f) => (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.choiceOption, selectedForfaitId === f.id && styles.choiceOptionSelected]}
                    onPress={() => setSelectedForfaitId(f.id)}
                  >
                    <Text style={selectedForfaitId === f.id ? styles.choiceTextSelected : styles.choiceText}>
                      {f.name} ({f.price}€)
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </SectionCard>

      <SectionCard title="Mode de reglement">
        <SegmentedChoice options={PAYMENT_METHODS} value={paymentMethod} onChange={setPaymentMethod} />
      </SectionCard>

      {priceError ? <Text style={styles.error}>{priceError}</Text> : null}
      {price ? <Text style={styles.priceEstimate}>Prix estime : {price} €</Text> : null}
      {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
      <TouchableOpacity style={styles.button} onPress={handleRequestRide} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? '...' : 'Demander une course'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', flex: 1, alignItems: 'center', backgroundColor: theme.colors.background },
  scrollContainer: { width: '100%', alignItems: 'center', gap: 14, padding: 20, backgroundColor: theme.colors.background },
  map: { width: '100%', flex: 1 },
  statusBar: { width: '100%', padding: 18, backgroundColor: theme.colors.card },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 4, color: theme.colors.text, alignSelf: 'flex-start' },
  status: { fontSize: 16, textAlign: 'center', color: theme.colors.text, fontWeight: '600' },
  paymentLabel: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 4 },
  card: {
    width: '100%',
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: theme.radius,
    padding: 14,
    gap: 10,
  },
  sectionLabel: { fontWeight: '700', color: theme.colors.text, fontSize: 14 },
  mutedText: { color: theme.colors.textMuted },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%' },
  choiceOption: {
    flex: 1,
    minWidth: 90,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    backgroundColor: theme.colors.input,
    borderRadius: theme.radius,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  choiceOptionSelected: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  choiceIcon: { fontSize: 18, marginBottom: 2 },
  choiceText: { color: theme.colors.text, fontSize: 13 },
  choiceTextSelected: { color: theme.colors.accentText, fontWeight: '700', fontSize: 13 },
  inlineField: { marginTop: 4 },
  inlineLabel: { color: theme.colors.textMuted, marginBottom: 6, fontSize: 13 },
  durationInput: {
    width: 90,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    backgroundColor: theme.colors.input,
    borderRadius: theme.radius,
    padding: 10,
    color: theme.colors.text,
  },
  priceEstimate: { fontSize: 20, fontWeight: '800', color: theme.colors.accent, marginTop: 4 },
  button: {
    width: '100%',
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: theme.colors.accentText, fontWeight: '700', fontSize: 16 },
  error: { color: theme.colors.error },
});
