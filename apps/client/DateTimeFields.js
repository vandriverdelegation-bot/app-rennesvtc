import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '@app-rennesvtc/shared';

// Selecteurs de date et d'heure en JS pur (aucun module natif). Les valeurs gardent le format
// des anciens champs texte : 'JJ/MM/AAAA' et 'HH:MM'.
const MONTHS = ['Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'];
const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const pad = (n) => String(n).padStart(2, '0');

function Field({ value, placeholder, onPress, style }) {
  return (
    <TouchableOpacity style={[styles.field, style]} onPress={onPress}>
      <Text style={value ? styles.fieldText : styles.fieldPlaceholder}>{value || placeholder}</Text>
    </TouchableOpacity>
  );
}

function Sheet({ visible, onClose, children }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet}>{children}</Pressable>
      </Pressable>
    </Modal>
  );
}

export function DateField({ value, onChange, placeholder = 'Choisir la date', style }) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [d, m, y] = (value || '').split('/').map((n) => parseInt(n, 10));
  const start = y ? new Date(y, m - 1, 1) : new Date(today.getFullYear(), today.getMonth(), 1);
  const [view, setView] = useState(start);

  const first = (new Date(view.getFullYear(), view.getMonth(), 1).getDay() + 6) % 7; // lundi = 0
  const count = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  const shift = (n) => setView(new Date(view.getFullYear(), view.getMonth() + n, 1));
  const pick = (day) => {
    onChange(`${pad(day)}/${pad(view.getMonth() + 1)}/${view.getFullYear()}`);
    setOpen(false);
  };

  return (
    <>
      <Field value={value} placeholder={placeholder} style={style} onPress={() => { setView(start); setOpen(true); }} />
      <Sheet visible={open} onClose={() => setOpen(false)}>
        <View style={styles.head}>
          <TouchableOpacity onPress={() => shift(-1)} style={styles.nav}><Text style={styles.navText}>‹</Text></TouchableOpacity>
          <Text style={styles.title}>{MONTHS[view.getMonth()]} {view.getFullYear()}</Text>
          <TouchableOpacity onPress={() => shift(1)} style={styles.nav}><Text style={styles.navText}>›</Text></TouchableOpacity>
        </View>
        <View style={styles.grid}>
          {DAYS.map((l, i) => <Text key={i} style={[styles.cell, styles.weekday]}>{l}</Text>)}
          {cells.map((day, i) => {
            if (!day) return <View key={i} style={styles.cell} />;
            const past = new Date(view.getFullYear(), view.getMonth(), day) < today;
            const selected = y === view.getFullYear() && m === view.getMonth() + 1 && d === day;
            return (
              <TouchableOpacity key={i} style={[styles.cell, selected && styles.selected]} disabled={past} onPress={() => pick(day)}>
                <Text style={[styles.dayText, past && styles.past, selected && styles.selectedText]}>{day}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Sheet>
    </>
  );
}

export function TimeField({ value, onChange, placeholder = "Choisir l'heure", style }) {
  const [open, setOpen] = useState(false);
  const [h, mi] = (value || '').split(':').map((n) => parseInt(n, 10));
  const [hour, setHour] = useState(isNaN(h) ? null : h);

  return (
    <>
      <Field value={value} placeholder={placeholder} style={style} onPress={() => { setHour(isNaN(h) ? null : h); setOpen(true); }} />
      <Sheet visible={open} onClose={() => setOpen(false)}>
        <Text style={styles.title}>Heure</Text>
        <View style={styles.grid4}>
          {Array.from({ length: 24 }, (_, i) => (
            <TouchableOpacity key={i} style={[styles.chip, hour === i && styles.selected]} onPress={() => setHour(i)}>
              <Text style={[styles.dayText, hour === i && styles.selectedText]}>{pad(i)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.title, { marginTop: 14 }]}>Minutes</Text>
        <View style={styles.grid4}>
          {Array.from({ length: 12 }, (_, i) => i * 5).map((mm) => (
            <TouchableOpacity
              key={mm}
              style={[styles.chip, hour !== null && h === hour && mi === mm && styles.selected, hour === null && styles.past]}
              disabled={hour === null}
              onPress={() => { onChange(`${pad(hour)}:${pad(mm)}`); setOpen(false); }}
            >
              <Text style={styles.dayText}>{pad(mm)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {hour === null ? <Text style={styles.hint}>Choisissez d'abord l'heure.</Text> : null}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  field: { borderWidth: 1, borderColor: theme.colors.inputBorder, backgroundColor: theme.colors.input, borderRadius: theme.radius, padding: 12, justifyContent: 'center', minHeight: 46 },
  fieldText: { color: theme.colors.text },
  fieldPlaceholder: { color: theme.colors.textMuted },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: theme.colors.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: theme.colors.cardBorder },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  nav: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navText: { color: theme.colors.accent, fontSize: 28, fontWeight: '700' },
  title: { color: theme.colors.text, fontWeight: '700', fontSize: 16, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  grid4: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, justifyContent: 'center' },
  cell: { width: '14.28%', height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 },
  weekday: { color: theme.colors.textMuted, fontSize: 12, textAlignVertical: 'center', textAlign: 'center' },
  chip: { width: '13.5%', height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: theme.colors.inputBorder },
  dayText: { color: theme.colors.text, fontSize: 15 },
  past: { color: '#4A4D52', opacity: 0.5 },
  selected: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  selectedText: { color: theme.colors.accentText, fontWeight: '700' },
  hint: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 8, fontSize: 12 },
});
