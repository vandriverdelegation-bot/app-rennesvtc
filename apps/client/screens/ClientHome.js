import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, TextInput, ScrollView, Image, Linking } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { supabase } from '../lib/supabase';
import { VEHICLE_CATEGORIES, theme, computeTrajetSimplePrice, whatsappUrl } from '@app-rennesvtc/shared';
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
];

function parseDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const [day, month, year] = dateStr.split('/').map((n) => parseInt(n, 10));
  const [hour, minute] = timeStr.split(':').map((n) => parseInt(n, 10));
  if (!day || !month || !year || isNaN(hour) || isNaN(minute)) return undefined; // invalide
  return new Date(year, month - 1, day, hour, minute);
}

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

function VehicleChoice({ value, onChange, photos }) {
  return (
    <View style={styles.choiceRow}>
      {VEHICLE_CATEGORIES.map((o) => (
        <TouchableOpacity
          key={o.value}
          style={[styles.vehicleOption, value === o.value && styles.choiceOptionSelected]}
          onPress={() => onChange(o.value)}
        >
          {photos[o.value] ? (
            <Image source={{ uri: photos[o.value] }} style={styles.vehiclePhoto} resizeMode="cover" />
          ) : null}
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
  const [stops, setStops] = useState([]); // points d'arret intermediaires
  const [roundTrip, setRoundTrip] = useState(false);
  const [returnDate, setReturnDate] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [vehicleCategory, setVehicleCategory] = useState(null);
  const [vehiclePhotos, setVehiclePhotos] = useState({});
  const [serviceType, setServiceType] = useState(null);
  const [durationHours, setDurationHours] = useState('2');
  const [forfaits, setForfaits] = useState([]);
  const [selectedForfaitId, setSelectedForfaitId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [passengerCount, setPassengerCount] = useState('1');
  const [childSeats, setChildSeats] = useState(0);
  const [boosterSeats, setBoosterSeats] = useState(0);
  const [luggageCount, setLuggageCount] = useState(0);
  const [childAges, setChildAges] = useState('');
  const [driverInfo, setDriverInfo] = useState(null);
  const [price, setPrice] = useState(null);
  const [priceManual, setPriceManual] = useState(false);
  const [priceError, setPriceError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function fetchActiveRide() {
    const { data } = await supabase
      .from('rides')
      .select(
        'id, pickup_address, dropoff_address, status, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, driver_lat, driver_lng, payment_method, vehicle_category, service_type, price, stop_addresses, round_trip'
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

  // Photo d'un vehicule actif par gamme, pour illustrer le choix de gamme.
  useEffect(() => {
    supabase
      .from('vehicles')
      .select('vehicle_category, photo_url')
      .eq('active', true)
      .not('photo_url', 'is', null)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        const photos = {};
        (data ?? []).forEach((v) => {
          if (!photos[v.vehicle_category]) photos[v.vehicle_category] = v.photo_url;
        });
        setVehiclePhotos(photos);
      });
  }, []);

  // Coordonnees du chauffeur, recuperees via le backend des que la course est acceptee.
  const acceptedRideId = activeRide?.status === 'accepted' ? activeRide.id : null;
  useEffect(() => {
    setDriverInfo(null);
    if (!acceptedRideId) return;
    fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/client/ride-driver/${acceptedRideId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(setDriverInfo)
      .catch(() => {});
  }, [acceptedRideId]);

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
    setPriceManual(false);
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
      Promise.all([
        supabase.from('pricing_simple').select('*').eq('vehicle_category', vehicleCategory).single(),
        supabase.from('pricing_zones').select('*').eq('vehicle_category', vehicleCategory).eq('active', true),
      ]).then(async ([{ data: pricing }, { data: zones }]) => {
        if (!pricing) return;
        try {
          const km = await getDistanceKm(pickup, dropoff);
          const result = computeTrajetSimplePrice({
            pricing,
            zones: zones ?? [],
            pickup,
            dropoff,
            km,
            when: new Date(),
            passengerCount: parseInt(passengerCount, 10) || 1,
            childSeats,
            boosterSeats,
            stopsCount: stops.length,
          });
          setPrice(result.price);
          setPriceManual(result.manual);
        } catch (e) {
          setPriceError("Impossible de calculer le prix pour cet itineraire.");
        }
      });
    }
  }, [vehicleCategory, serviceType, pickup, dropoff, durationHours, selectedForfaitId, forfaits, passengerCount, childSeats, boosterSeats, stops]);

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
    if (!price && !priceManual) {
      setErrorMsg('Le prix est en cours de calcul, patientez.');
      return;
    }
    if ((childSeats > 0 || boosterSeats > 0) && !childAges.trim()) {
      setErrorMsg("Indiquez l'age de l'enfant (siege auto ou rehausseur).");
      return;
    }
    let returnScheduledAt = null;
    if (roundTrip) {
      const parsed = parseDateTime(returnDate, returnTime);
      if (!parsed) {
        setErrorMsg('Indiquez la date et l\'heure du retour (JJ/MM/AAAA et HH:MM).');
        return;
      }
      returnScheduledAt = parsed.toISOString();
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
        price: priceManual ? null : price,
        created_by: 'client',
        passenger_count: parseInt(passengerCount, 10) || 1,
        child_seats: childSeats,
        booster_seats: boosterSeats,
        luggage_count: luggageCount,
        child_ages: childSeats > 0 || boosterSeats > 0 ? childAges.trim() : null,
        stop_addresses: stops.filter(Boolean).map((s) => s.address),
        round_trip: roundTrip,
        return_scheduled_at: returnScheduledAt,
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
    setStops([]);
    setRoundTrip(false);
    setReturnDate('');
    setReturnTime('');
    setVehicleCategory(null);
    setServiceType(null);
    setSelectedForfaitId(null);
    setPaymentMethod(null);
    setPassengerCount('1');
    setChildSeats(0);
    setBoosterSeats(0);
    setLuggageCount(0);
    setChildAges('');
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
            {activeRide.price != null ? `${activeRide.price} €` : 'Prix fixe par le chauffeur'}
          </Text>
          {driverInfo ? (
            <View style={styles.driverBlock}>
              <Text style={styles.sectionLabel}>Votre chauffeur</Text>
              <Text style={styles.status}>{driverInfo.name ?? 'Chauffeur'}</Text>
              {driverInfo.phone ? (
                <>
                  <Text style={styles.paymentLabel}>{driverInfo.phone}</Text>
                  <View style={styles.contactRow}>
                    <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL(`tel:${driverInfo.phone}`)}>
                      <Text style={styles.contactBtnText}>Appeler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.contactBtn, { backgroundColor: '#25D366' }]} onPress={() => Linking.openURL(whatsappUrl(driverInfo.phone))}>
                      <Text style={[styles.contactBtnText, { color: '#FFFFFF' }]}>WhatsApp</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <Text style={styles.paymentLabel}>Telephone non renseigne</Text>
              )}
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContainer}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Demander une course</Text>

      <SectionCard title="Trajet">
        <AddressAutocomplete placeholder="Adresse de depart" onSelect={setPickup} />
        {stops.map((stop, i) => (
          <View key={i} style={styles.stopRow}>
            <View style={{ flex: 1 }}>
              <AddressAutocomplete
                placeholder={`Point d'arret ${i + 1}`}
                onSelect={(loc) => setStops((prev) => prev.map((s, idx) => (idx === i ? loc : s)))}
              />
            </View>
            <TouchableOpacity onPress={() => setStops((prev) => prev.filter((_, idx) => idx !== i))}>
              <Text style={styles.removeStop}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity onPress={() => setStops((prev) => [...prev, null])}>
          <Text style={styles.link}>+ Ajouter un point d'arret</Text>
        </TouchableOpacity>
        <View style={{ height: 8 }} />
        <AddressAutocomplete placeholder="Destination" onSelect={setDropoff} />
        <TouchableOpacity style={styles.row} onPress={() => setRoundTrip((v) => !v)}>
          <View style={[styles.checkbox, roundTrip && styles.checkboxChecked]}>
            {roundTrip ? <Text style={styles.checkboxMark}>✓</Text> : null}
          </View>
          <Text style={styles.inlineLabel}>Aller-retour</Text>
        </TouchableOpacity>
        {roundTrip && (
          <View style={styles.row}>
            <TextInput
              style={[styles.durationInput, { flex: 1 }]}
              value={returnDate}
              onChangeText={setReturnDate}
              placeholder="Retour : JJ/MM/AAAA"
              placeholderTextColor={theme.colors.textMuted}
            />
            <TextInput
              style={[styles.durationInput, { flex: 1 }]}
              value={returnTime}
              onChangeText={setReturnTime}
              placeholder="HH:MM"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
        )}
      </SectionCard>

      <SectionCard title="Gamme de vehicule">
        <VehicleChoice value={vehicleCategory} onChange={setVehicleCategory} photos={vehiclePhotos} />
      </SectionCard>

      <SectionCard title="Service">
        <SegmentedChoice options={SERVICE_TYPES} value={serviceType} onChange={setServiceType} />

        {serviceType === 'trajet_simple' && (
          <View style={styles.choiceRow}>
            <View style={styles.inlineField}>
              <Text style={styles.inlineLabel}>Passagers</Text>
              <TextInput
                style={styles.durationInput}
                keyboardType="numeric"
                value={passengerCount}
                onChangeText={setPassengerCount}
              />
            </View>
            <View style={styles.inlineField}>
              <Text style={styles.inlineLabel}>Bagages</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity style={styles.stepperBtn} onPress={() => setLuggageCount(Math.max(0, luggageCount - 1))}>
                  <Text style={styles.stepperText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{luggageCount}</Text>
                <TouchableOpacity style={styles.stepperBtn} onPress={() => setLuggageCount(luggageCount + 1)}>
                  <Text style={styles.stepperText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.inlineField}>
              <Text style={styles.inlineLabel}>Sieges auto</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity style={styles.stepperBtn} onPress={() => setChildSeats(Math.max(0, childSeats - 1))}>
                  <Text style={styles.stepperText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{childSeats}</Text>
                <TouchableOpacity style={styles.stepperBtn} onPress={() => setChildSeats(childSeats + 1)}>
                  <Text style={styles.stepperText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.inlineField}>
              <Text style={styles.inlineLabel}>Rehausseurs</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity style={styles.stepperBtn} onPress={() => setBoosterSeats(Math.max(0, boosterSeats - 1))}>
                  <Text style={styles.stepperText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{boosterSeats}</Text>
                <TouchableOpacity style={styles.stepperBtn} onPress={() => setBoosterSeats(boosterSeats + 1)}>
                  <Text style={styles.stepperText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {serviceType === 'trajet_simple' && (childSeats > 0 || boosterSeats > 0) && (
          <View style={styles.inlineField}>
            <Text style={styles.inlineLabel}>Age de l'enfant (ex : 3 ans, ou 3 et 7 ans)</Text>
            <TextInput
              style={styles.durationInputWide}
              value={childAges}
              onChangeText={setChildAges}
              placeholder="Age(s) des enfants"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
        )}

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
      {priceManual ? (
        <Text style={styles.priceEstimate}>Prix fixe par le chauffeur a la prise en charge</Text>
      ) : price ? (
        <Text style={styles.priceEstimate}>Prix estime : {price} €</Text>
      ) : null}
      {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
      <TouchableOpacity style={styles.button} onPress={handleRequestRide} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? '...' : 'Demander une course'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', flex: 1, alignItems: 'center', backgroundColor: theme.colors.background },
  scrollView: { width: '100%', flex: 1, backgroundColor: theme.colors.background },
  scrollContainer: { width: '100%', alignItems: 'center', gap: 14, padding: 20, backgroundColor: theme.colors.background },
  map: { width: '100%', flex: 1 },
  statusBar: { width: '100%', padding: 18, backgroundColor: theme.colors.card },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 4, color: theme.colors.text, alignSelf: 'flex-start' },
  status: { fontSize: 16, textAlign: 'center', color: theme.colors.text, fontWeight: '600' },
  paymentLabel: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 4 },
  driverBlock: { marginTop: 14, alignItems: 'center', gap: 4 },
  sectionLabel: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '700' },
  contactRow: { flexDirection: 'row', gap: 10, marginTop: 8, width: '100%' },
  contactBtn: {
    flex: 1,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius,
    paddingVertical: 12,
    alignItems: 'center',
  },
  contactBtnText: { color: theme.colors.accentText, fontWeight: '700' },
  card: {
    width: '100%',
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  sectionLabel: { fontWeight: '800', color: theme.colors.textMuted, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
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
  vehicleOption: {
    flex: 1,
    minWidth: 90,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    backgroundColor: theme.colors.input,
    borderRadius: theme.radius,
    padding: 8,
    alignItems: 'center',
  },
  vehiclePhoto: {
    width: '100%',
    height: 50,
    borderRadius: theme.radius - 4,
    marginBottom: 4,
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
  durationInputWide: {
    width: '100%',
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    backgroundColor: theme.colors.input,
    borderRadius: theme.radius,
    padding: 10,
    color: theme.colors.text,
  },
  priceEstimate: { fontSize: 20, fontWeight: '800', color: theme.colors.accent, marginTop: 4 },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  removeStop: { color: theme.colors.error, fontSize: 16, paddingHorizontal: 6 },
  link: { color: theme.colors.accent, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  checkboxMark: { color: theme.colors.accentText, fontSize: 13, fontWeight: '700' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    backgroundColor: theme.colors.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  stepperValue: { color: theme.colors.text, fontSize: 15, minWidth: 16, textAlign: 'center' },
  button: {
    width: '100%',
    backgroundColor: theme.colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: theme.colors.accentText, fontWeight: '800', fontSize: 16 },
  error: { color: theme.colors.error },
});
