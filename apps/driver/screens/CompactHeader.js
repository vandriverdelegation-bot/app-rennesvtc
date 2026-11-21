import { Image, Platform, StatusBar, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, themedStyles } from '@app-rennesvtc/shared';

// En-tete reduit : photo de nuit de Rennes, titre a gauche (fleche de retour facultative), logo de Rennes VTC a droite.
export default function CompactHeader({ title, onBack }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const topPad = Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0);
  const h = topPad + 104;
  const dark = theme.mode === 'light' ? '245,245,240' : '5,6,6';
  return (
    <View style={[styles.wrap, { height: h }]}>
      <Image source={require('../assets/header-photo.jpg')} style={{ position: 'absolute', top: 0, left: 0, width, height: h, resizeMode: 'cover' }} resizeMode="cover" />
      <View pointerEvents="none" style={styles.fade}>
        {Array.from({ length: 8 }, (_, i) => <View key={i} style={{ flex: 1, backgroundColor: `rgba(${dark},${((i + 1) / 8) ** 2.2})` }} />)}
      </View>
      <View style={[styles.row, { top: topPad + 12 }]}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityLabel="Retour" accessibilityRole="button">
            <Text style={styles.arrow}>←</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
      </View>
      <Image source={require('../assets/logo-rennesvtc.png')} style={[styles.logo, { top: topPad + 4 }]} resizeMode="contain" accessibilityLabel="Rennes VTC" />
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: { width: '100%', overflow: 'hidden', backgroundColor: '#050606' },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 34 },
  row: { position: 'absolute', left: 18, right: 130, flexDirection: 'row', alignItems: 'center', gap: 14 },
  arrow: { color: theme.colors.accent, fontSize: 34, lineHeight: 36 },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', flexShrink: 1, textShadowColor: 'rgba(0,0,0,0.75)', textShadowRadius: 8 },
  logo: { position: 'absolute', right: 12, width: 108, height: 81 },
}));
