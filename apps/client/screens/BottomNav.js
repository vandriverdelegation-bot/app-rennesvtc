import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from '../icons';
import { FONT } from '../ui';

const ITEMS = [
  { key: 'home', label: 'Accueil', icon: 'navhome' },
  { key: 'bookings', label: 'Réservations', icon: 'calendar' },
  { key: 'account', label: 'Compte', icon: 'user' },
];

// Barre de navigation flottante du design : Accueil, Reservations, Compte.
export default function BottomNav({ active, onPress }) {
  return (
    <View style={styles.nav}>
      {ITEMS.map((it) => {
        const on = it.key === active;
        return (
          <TouchableOpacity key={it.key} style={styles.item} onPress={() => onPress(it.key)} accessibilityRole="button" accessibilityState={{ selected: on }}>
            <Icon name={it.icon} color={on ? 'g' : 'm'} size={22} />
            <Text style={[styles.label, on && styles.labelOn]}>{it.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { position: 'absolute', left: 16, right: 16, bottom: 20, height: 68, borderRadius: 24, backgroundColor: 'rgba(24,27,24,0.96)', borderWidth: 1, borderColor: '#2A2E2A', flexDirection: 'row', alignItems: 'center' },
  item: { flex: 1, alignItems: 'center', gap: 4 },
  label: { color: '#9AA19A', fontSize: 11, fontFamily: FONT.medium },
  labelOn: { color: '#5BD42A', fontFamily: FONT.semi },
});
