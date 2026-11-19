import { theme, themedStyles } from '@app-rennesvtc/shared';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

const styles = themedStyles(() => ({
  nav: { position: 'absolute', left: 16, right: 16, bottom: 20, height: 68, borderRadius: 24, backgroundColor: theme.colors.navBg, borderWidth: 1, borderColor: theme.colors.cardBorder, flexDirection: 'row', alignItems: 'center' },
  item: { flex: 1, alignItems: 'center', gap: 4 },
  label: { color: theme.colors.textMuted, fontSize: 11, fontFamily: FONT.medium },
  labelOn: { color: theme.colors.accent, fontFamily: FONT.semi },
}));
