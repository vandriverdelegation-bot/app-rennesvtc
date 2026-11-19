import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme, themedStyles } from '@app-rennesvtc/shared';
import { Icon } from '../icons';

const ITEMS = [
  { key: 'courses', label: 'Courses', icon: 'car' },
  { key: 'map', label: 'Carte', icon: 'route' },
  { key: 'calendar', label: 'Calendrier', icon: 'calendar' },
  { key: 'messages', label: 'Messages', icon: 'message' },
  { key: 'profile', label: 'Profil', icon: 'user' },
];

// Barre du bas du chauffeur : Courses, Carte, Calendrier, Messages, Profil.
export default function DriverTabs({ active, onPress, unread }) {
  return (
    <View style={styles.bar}>
      {ITEMS.map((it) => {
        const on = it.key === active;
        return (
          <TouchableOpacity key={it.key} style={styles.item} onPress={() => onPress(it.key)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={it.label}>
            <View>
              <Icon name={it.icon} color={on ? 'g' : 'm'} size={24} />
              {it.key === 'messages' && unread ? <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text></View> : null}
            </View>
            <Text style={[styles.label, on && styles.labelOn]}>{it.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = themedStyles(() => ({
  bar: { width: '100%', flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8, paddingBottom: 10, backgroundColor: theme.colors.card, borderTopWidth: 1, borderTopColor: theme.colors.cardBorder },
  item: { flex: 1, alignItems: 'center', gap: 3, minHeight: 48 },
  label: { color: theme.colors.textMuted, fontSize: 11 },
  labelOn: { color: theme.colors.accent, fontWeight: '700' },
  badge: { position: 'absolute', top: -4, right: -10, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#FF4D4D', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
}));
