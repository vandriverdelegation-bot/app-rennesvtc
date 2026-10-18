import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { VEHICLE_CATEGORIES, theme } from '@app-rennesvtc/shared';
import { supabase } from '../lib/supabase';

const DAYS = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
  { value: 0, label: 'Dimanche' },
];

export default function DriverSettings({ session, currentCategory, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [onlineStatus, setOnlineStatus] = useState(false);
  const [phone, setPhone] = useState('');
  const [availability, setAvailability] = useState(
    Object.fromEntries(DAYS.map((d) => [d.value, { start: '', end: '' }]))
  );

  useEffect(() => {
    supabase
      .from('profiles')
      .select('online_status, phone')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        setOnlineStatus(!!data?.online_status);
        setPhone(data?.phone ?? '');
      });
    supabase
      .from('driver_availability')
      .select('day_of_week, start_time, end_time')
      .eq('driver_id', session.user.id)
      .then(({ data }) => {
        if (!data) return;
        setAvailability((prev) => {
          const next = { ...prev };
          data.forEach((row) => {
            next[row.day_of_week] = { start: row.start_time?.slice(0, 5) ?? '', end: row.end_time?.slice(0, 5) ?? '' };
          });
          return next;
        });
      });
  }, []);

  async function handleSelect(category) {
    setSaving(true);
    setErrorMsg('');
    const { error } = await supabase
      .from('profiles')
      .update({ vehicle_category: category })
      .eq('id', session.user.id);
    setSaving(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    onSaved(category);
  }

  async function handleToggleOnline(value) {
    setOnlineStatus(value);
    await supabase.from('profiles').update({ online_status: value }).eq('id', session.user.id);
  }

  async function handleSavePhone() {
    await supabase.from('profiles').update({ phone }).eq('id', session.user.id);
  }

  async function handleSaveAvailability() {
    setSaving(true);
    setErrorMsg('');
    const toUpsert = [];
    const toDelete = [];
    DAYS.forEach((d) => {
      const { start, end } = availability[d.value];
      if (start && end) {
        toUpsert.push({ driver_id: session.user.id, day_of_week: d.value, start_time: start, end_time: end });
      } else {
        toDelete.push(d.value);
      }
    });
    if (toUpsert.length > 0) {
      await supabase.from('driver_availability').upsert(toUpsert, { onConflict: 'driver_id,day_of_week' });
    }
    if (toDelete.length > 0) {
      await supabase.from('driver_availability').delete().eq('driver_id', session.user.id).in('day_of_week', toDelete);
    }
    setSaving(false);
  }

  function updateDay(day, field, value) {
    setAvailability((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Votre gamme de vehicule</Text>
      <Text style={styles.hint}>
        Choisissez la gamme de votre vehicule principal. Vous ne recevrez que les courses de cette
        gamme.
      </Text>
      {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
      {VEHICLE_CATEGORIES.map((c) => (
        <TouchableOpacity
          key={c.value}
          style={[styles.option, currentCategory === c.value && styles.optionSelected]}
          onPress={() => handleSelect(c.value)}
          disabled={saving}
        >
          <Text style={styles.optionIcon}>{c.icon}</Text>
          <Text style={currentCategory === c.value ? styles.optionTextSelected : styles.optionText}>
            {c.label}
          </Text>
        </TouchableOpacity>
      ))}

      <View style={styles.row}>
        <Text style={styles.title}>Statut</Text>
        <Switch value={onlineStatus} onValueChange={handleToggleOnline} trackColor={{ true: theme.colors.accent }} />
        <Text style={styles.hint}>{onlineStatus ? 'En ligne' : 'Hors ligne'}</Text>
      </View>

      <Text style={styles.title}>Telephone</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        onBlur={handleSavePhone}
        placeholder="0600000000"
        placeholderTextColor={theme.colors.textMuted}
        keyboardType="phone-pad"
      />

      <Text style={styles.title}>Disponibilites hebdomadaires</Text>
      <Text style={styles.hint}>Laissez vide un jour ou vous ne travaillez pas.</Text>
      {DAYS.map((d) => (
        <View key={d.value} style={styles.dayRow}>
          <Text style={styles.dayLabel}>{d.label}</Text>
          <TextInput
            style={styles.timeInput}
            value={availability[d.value].start}
            onChangeText={(v) => updateDay(d.value, 'start', v)}
            placeholder="08:00"
            placeholderTextColor={theme.colors.textMuted}
          />
          <TextInput
            style={styles.timeInput}
            value={availability[d.value].end}
            onChangeText={(v) => updateDay(d.value, 'end', v)}
            placeholder="20:00"
            placeholderTextColor={theme.colors.textMuted}
          />
        </View>
      ))}
      <TouchableOpacity style={styles.saveButton} onPress={handleSaveAvailability} disabled={saving}>
        <Text style={styles.saveButtonText}>Enregistrer mes disponibilites</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { width: '100%', flex: 1, backgroundColor: theme.colors.background },
  container: { width: '100%', alignItems: 'center', gap: 12, padding: 24, backgroundColor: theme.colors.background },
  title: { fontSize: 16, fontWeight: '700', color: theme.colors.text, alignSelf: 'flex-start', marginTop: 8 },
  hint: { textAlign: 'center', color: theme.colors.textMuted },
  option: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    backgroundColor: theme.colors.input,
    borderRadius: theme.radius,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionSelected: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  optionIcon: { fontSize: 18 },
  optionText: { color: theme.colors.text },
  optionTextSelected: { color: theme.colors.accentText, fontWeight: '700' },
  error: { color: theme.colors.error },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', justifyContent: 'center' },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    backgroundColor: theme.colors.input,
    borderRadius: theme.radius,
    padding: 12,
    color: theme.colors.text,
  },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' },
  dayLabel: { width: 80, color: theme.colors.text },
  timeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    backgroundColor: theme.colors.input,
    borderRadius: theme.radius,
    padding: 10,
    color: theme.colors.text,
  },
  saveButton: {
    width: '100%',
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  saveButtonText: { color: theme.colors.accentText, fontWeight: '700' },
});
