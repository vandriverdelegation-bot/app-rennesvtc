import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView, ActivityIndicator } from 'react-native';
import { theme, computeTrajetSimplePrice } from '@app-rennesvtc/shared';
import { supabase } from '../lib/supabase';
import { getDistanceKm } from '../lib/directions';
import AddressAutocomplete from './AddressAutocomplete';

function parseDateTime(dateStr, timeStr) {
  if (!dateStr && !timeStr) return null;
  const [day, month, year] = dateStr.split('/').map((n) => parseInt(n, 10));
  const [hour, minute] = timeStr.split(':').map((n) => parseInt(n, 10));
  if (!day || !month || !year || isNaN(hour) || isNaN(minute)) return undefined; // invalide
  return new Date(year, month - 1, day, hour, minute);
}

const PAYMENT_METHODS = [
  { value: 'carte_a_bord', label: 'CB a bord' },
  { value: 'especes', label: 'Especes' },
];

export default function CreateRide({ session, vehicleCategory, canEditPrice, onDone, onCancel }) {
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [stops, setStops] = useState([]);
  const [roundTrip, setRoundTrip] = useState(false);
  const [returnDate, setReturnDate] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [laterDate, setLaterDate] = useState(''); // JJ/MM/AAAA, vide = course immediate
  const [laterTime, setLaterTime] = useState(''); // HH:MM
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [passengerCount, setPassengerCount] = useState('1');
  const [childSeats, setChildSeats] = useState(0);
  const [boosterSeats, setBoosterSeats] = useState(0);
  const [price, setPrice] = useState(null);
  const [priceManual, setPriceManual] = useState(false);
  const [priceError, setPriceError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setPrice(null);
    setPriceManual(false);
    setPriceError('');
    if (!pickup || !dropoff) return;
    const when = parseDateTime(laterDate, laterTime) || new Date();
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
          when,
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
  }, [pickup, dropoff, laterDate, laterTime, passengerCount, childSeats, boosterSeats, stops]);

  function parseScheduledAt() {
    if (!laterDate && !laterTime) return null;
    const when = parseDateTime(laterDate, laterTime);
    if (!when) throw new Error('Date/heure invalide (format JJ/MM/AAAA et HH:MM).');
    return when.toISOString();
  }

  async function handleCreate() {
    setErrorMsg('');
    if (!clientName || !clientPhone) {
      setErrorMsg('Nom et telephone du client requis.');
      return;
    }
    if (!pickup || !dropoff) {
      setErrorMsg('Choisissez une adresse de depart et une destination dans la liste.');
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
    if (priceManual && !price) {
      setErrorMsg('Saisissez le prix (tarification en mode Manuel pour cette gamme).');
      return;
    }
    let scheduled_at;
    try {
      scheduled_at = parseScheduledAt();
    } catch (e) {
      setErrorMsg(e.message);
      return;
    }
    let return_scheduled_at = null;
    if (roundTrip) {
      const returnWhen = parseDateTime(returnDate, returnTime);
      if (!returnWhen) {
        setErrorMsg('Date/heure de retour invalide (format JJ/MM/AAAA et HH:MM).');
        return;
      }
      return_scheduled_at = returnWhen.toISOString();
    }

    setSubmitting(true);
    const { error } = await supabase.from('rides').insert({
      driver_id: session.user.id,
      client_id: null,
      client_name: clientName,
      client_phone: clientPhone,
      pickup_address: pickup.address,
      pickup_lat: pickup.lat,
      pickup_lng: pickup.lng,
      dropoff_address: dropoff.address,
      dropoff_lat: dropoff.lat,
      dropoff_lng: dropoff.lng,
      vehicle_category: vehicleCategory,
      payment_method: paymentMethod,
      service_type: 'trajet_simple',
      price,
      created_by: 'chauffeur',
      passenger_count: parseInt(passengerCount, 10) || 1,
      child_seats: childSeats,
      booster_seats: boosterSeats,
      stop_addresses: stops.filter(Boolean).map((s) => s.address),
      round_trip: roundTrip,
      return_scheduled_at,
      scheduled_at,
      status: 'accepted',
    });
    setSubmitting(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    onDone();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Creer une reservation</Text>
      <Text style={styles.hint}>Pour une course recue par telephone ou en direct.</Text>
      {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

      <Text style={styles.label}>Nom du client</Text>
      <TextInput style={styles.input} value={clientName} onChangeText={setClientName} placeholder="Nom du client" placeholderTextColor={theme.colors.textMuted} />

      <Text style={styles.label}>Telephone du client</Text>
      <TextInput style={styles.input} value={clientPhone} onChangeText={setClientPhone} placeholder="0600000000" placeholderTextColor={theme.colors.textMuted} keyboardType="phone-pad" />

      <Text style={styles.label}>Depart</Text>
      <AddressAutocomplete placeholder="Adresse de depart" onSelect={setPickup} />

      {stops.map((stop, i) => (
        <View key={i} style={styles.row}>
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

      <Text style={styles.label}>Destination</Text>
      <AddressAutocomplete placeholder="Adresse de destination" onSelect={setDropoff} />

      <TouchableOpacity style={styles.row} onPress={() => setRoundTrip((v) => !v)}>
        <View style={[styles.checkbox, roundTrip && styles.checkboxChecked]}>
          {roundTrip ? <Text style={styles.checkboxMark}>✓</Text> : null}
        </View>
        <Text style={styles.label}>Aller-retour</Text>
      </TouchableOpacity>

      {roundTrip && (
        <>
          <Text style={styles.label}>Date et heure du retour</Text>
          <View style={styles.row}>
            <TextInput style={[styles.input, styles.rowInput]} value={returnDate} onChangeText={setReturnDate} placeholder="JJ/MM/AAAA" placeholderTextColor={theme.colors.textMuted} />
            <TextInput style={[styles.input, styles.rowInput]} value={returnTime} onChangeText={setReturnTime} placeholder="HH:MM" placeholderTextColor={theme.colors.textMuted} />
          </View>
        </>
      )}

      <Text style={styles.label}>Date et heure (laisser vide pour tout de suite)</Text>
      <View style={styles.row}>
        <TextInput style={[styles.input, styles.rowInput]} value={laterDate} onChangeText={setLaterDate} placeholder="JJ/MM/AAAA" placeholderTextColor={theme.colors.textMuted} />
        <TextInput style={[styles.input, styles.rowInput]} value={laterTime} onChangeText={setLaterTime} placeholder="HH:MM" placeholderTextColor={theme.colors.textMuted} />
      </View>

      <Text style={styles.label}>Passagers / sieges</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.rowInput]}
          value={passengerCount}
          onChangeText={setPassengerCount}
          placeholder="Passagers"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="numeric"
        />
        <TextInput
          style={[styles.input, styles.rowInput]}
          value={String(childSeats)}
          onChangeText={(t) => setChildSeats(parseInt(t, 10) || 0)}
          placeholder="Sieges auto"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="numeric"
        />
        <TextInput
          style={[styles.input, styles.rowInput]}
          value={String(boosterSeats)}
          onChangeText={(t) => setBoosterSeats(parseInt(t, 10) || 0)}
          placeholder="Rehausseurs"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="numeric"
        />
      </View>

      <Text style={styles.label}>Mode de reglement</Text>
      <View style={styles.row}>
        {PAYMENT_METHODS.map((m) => (
          <TouchableOpacity
            key={m.value}
            style={[styles.choice, paymentMethod === m.value && styles.choiceSelected]}
            onPress={() => setPaymentMethod(m.value)}
          >
            <Text style={paymentMethod === m.value ? styles.choiceTextSelected : styles.choiceText}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Prix</Text>
      {priceManual ? <Text style={styles.hint}>Tarification en mode Manuel pour cette gamme : saisissez le prix.</Text> : null}
      {priceError ? <Text style={styles.error}>{priceError}</Text> : null}
      {price === null && !priceManual && !priceError && pickup && dropoff ? <ActivityIndicator color={theme.colors.accent} /> : null}
      {canEditPrice || priceManual ? (
        <TextInput
          style={styles.input}
          value={price !== null ? String(price) : ''}
          onChangeText={(t) => setPrice(parseFloat(t.replace(',', '.')) || null)}
          placeholder="Prix en euros"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="decimal-pad"
        />
      ) : (
        <Text style={styles.priceValue}>{price !== null ? `${price} €` : '-'}</Text>
      )}

      <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? 'Creation...' : 'Creer la reservation'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onCancel}>
        <Text style={styles.link}>Annuler</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', backgroundColor: theme.colors.background },
  content: { padding: 16, gap: 10 },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.text },
  hint: { color: theme.colors.textMuted, marginBottom: 8 },
  label: { fontWeight: '700', marginTop: 8, color: theme.colors.textMuted, fontSize: 12 },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    backgroundColor: theme.colors.input,
    borderRadius: theme.radius,
    padding: 12,
    color: theme.colors.text,
  },
  row: { flexDirection: 'row', gap: 8 },
  rowInput: { flex: 1 },
  choice: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    backgroundColor: theme.colors.input,
    borderRadius: theme.radius,
    paddingVertical: 10,
    alignItems: 'center',
  },
  choiceSelected: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  choiceText: { color: theme.colors.text },
  choiceTextSelected: { color: theme.colors.accentText, fontWeight: '700' },
  priceValue: { color: theme.colors.accent, fontWeight: '700', fontSize: 18 },
  removeStop: { color: theme.colors.error, fontSize: 16, paddingHorizontal: 6, alignSelf: 'center' },
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
  button: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: { color: theme.colors.accentText, fontWeight: '700' },
  link: { color: theme.colors.accent, textAlign: 'center', marginTop: 12, marginBottom: 24 },
  error: { color: theme.colors.error },
});
