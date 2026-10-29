import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '@app-rennesvtc/shared';

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
export const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

// Petit calendrier mensuel : un point vert sous chaque jour qui a une réservation, appui = filtre sur ce jour.
export default function RideCalendar({ rides, selectedDay, onSelectDay }) {
  const today = new Date();
  const [view, setView] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const counts = {};
  rides.forEach((r) => {
    if (r.scheduled_at) counts[dayKey(new Date(r.scheduled_at))] = (counts[dayKey(new Date(r.scheduled_at))] ?? 0) + 1;
  });

  const first = (view.getDay() + 6) % 7; // lundi = 0
  const count = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  const shift = (n) => setView(new Date(view.getFullYear(), view.getMonth() + n, 1));

  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <TouchableOpacity onPress={() => shift(-1)} style={styles.nav}><Text style={styles.navText}>‹</Text></TouchableOpacity>
        <Text style={styles.title}>{MONTHS[view.getMonth()]} {view.getFullYear()}</Text>
        <TouchableOpacity onPress={() => shift(1)} style={styles.nav}><Text style={styles.navText}>›</Text></TouchableOpacity>
      </View>
      <View style={styles.grid}>
        {DAYS.map((l, i) => <Text key={i} style={[styles.cell, styles.weekday]}>{l}</Text>)}
        {cells.map((day, i) => {
          if (!day) return <View key={i} style={styles.cell} />;
          const key = `${view.getFullYear()}-${view.getMonth() + 1}-${day}`;
          const selected = selectedDay === key;
          const isToday = key === dayKey(today);
          return (
            <TouchableOpacity key={i} style={[styles.cell, selected && styles.selected, isToday && !selected && styles.today]} onPress={() => onSelectDay(selected ? null : key)}>
              <Text style={[styles.dayText, selected && styles.selectedText]}>{day}</Text>
              {counts[key] ? <View style={[styles.dot, selected && { backgroundColor: theme.colors.accentText }]} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: theme.colors.card, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.cardBorder, padding: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  nav: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
  navText: { color: theme.colors.accent, fontSize: 26, fontWeight: '700' },
  title: { color: theme.colors.text, fontWeight: '700', fontSize: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  weekday: { color: theme.colors.textMuted, fontSize: 12, textAlign: 'center', textAlignVertical: 'center' },
  dayText: { color: theme.colors.text, fontSize: 14 },
  selected: { backgroundColor: theme.colors.accent },
  selectedText: { color: theme.colors.accentText, fontWeight: '700' },
  today: { borderWidth: 1, borderColor: theme.colors.accent },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: theme.colors.accent, marginTop: 2 },
});
