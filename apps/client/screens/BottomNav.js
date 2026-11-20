import { theme, themedStyles } from '@app-rennesvtc/shared';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../icons';
import { FONT } from '../ui';

const ITEMS = [
  { key: 'home', label: 'Accueil', icon: 'navhome' },
  { key: 'courses', label: 'Mes courses', icon: 'calendar' },
  { key: 'notifications', label: 'Notifications', icon: 'bell' },
  { key: 'account', label: 'Mon compte', icon: 'user' },
];

// Barre de navigation flottante : Accueil, Mes courses, Notifications, Mon compte.
export default function BottomNav({ active, onPress }) {
  const insets = useSafeAreaInsets(); // la barre du telephone (Android) ne doit pas recouvrir les boutons
  return (
    <View style={[styles.nav, { height: 62 + insets.bottom, paddingBottom: insets.bottom + 4 }]}>
      {ITEMS.map((it) => {
        const on = it.key === active;
        return (
          <TouchableOpacity key={it.key} style={styles.item} onPress={() => onPress(it.key)} accessibilityRole="button" accessibilityState={{ selected: on }}>
            <Icon name={it.icon} color={on ? 'g' : 'm'} size={22} />
            <Text style={[styles.label, on && styles.labelOn]}>{it.label}</Text>
            {on ? <View style={styles.bar} /> : <View style={{ height: 5 }} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = themedStyles(() => ({
  nav: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 78, borderTopWidth: 1, borderTopColor: theme.colors.cardBorder, backgroundColor: theme.colors.card, flexDirection: 'row', alignItems: 'center', paddingBottom: 6 },
  item: { flex: 1, alignItems: 'center', gap: 4 },
  label: { color: theme.colors.textMuted, fontSize: 11, fontFamily: FONT.medium },
  labelOn: { color: theme.colors.accent, fontFamily: FONT.semi },
  bar: { width: 28, height: 3, borderRadius: 2, backgroundColor: theme.colors.accent, marginTop: 2 },
}));
