import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { VEHICLE_CATEGORIES, theme } from '@app-rennesvtc/shared';
import { supabase } from '../lib/supabase';

export default function DriverSettings({ session, currentCategory, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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

  return (
    <View style={styles.container}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', flex: 1, alignItems: 'center', gap: 12, padding: 24, backgroundColor: theme.colors.background },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.text },
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
});
