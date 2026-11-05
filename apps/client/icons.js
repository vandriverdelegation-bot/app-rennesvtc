import { Image } from 'react-native';
import { theme } from '@app-rennesvtc/shared';

// Pictogrammes du design (PNG : w = blanc, g = vert, m = gris, k = noir).
const ICONS = {
  bell: { w: require('./assets/ui/bell_w.png') },
  search: { k: require('./assets/ui/search_k.png') },
  arrow: { g: require('./assets/ui/arrow_g.png') },
  plane: { g: require('./assets/ui/plane_g.png') },
  train: { g: require('./assets/ui/train_g.png') },
  home: { g: require('./assets/ui/home_g.png') },
  van: { m: require('./assets/ui/van_m.png') },
  user: { m: require('./assets/ui/user_m.png'), g: require('./assets/ui/user_g.png') },
  luggage: { m: require('./assets/ui/luggage_m.png') },
  phone: { w: require('./assets/ui/phone_w.png') },
  message: { g: require('./assets/ui/message_g.png'), w: require('./assets/ui/message_w.png') },
  calendar: { g: require('./assets/ui/calendar_g.png'), m: require('./assets/ui/calendar_m.png') },
  navhome: { g: require('./assets/ui/navhome_g.png'), m: require('./assets/ui/navhome_m.png') },
  repeat: { g: require('./assets/ui/repeat_g.png') },
  dots: { w: require('./assets/ui/dots_w.png') },
  star: { g: require('./assets/ui/star_g.png') },
};

// color : w = adaptatif (blanc en mode sombre, texte en mode clair), white = toujours blanc (sur fond vert), g = vert, m = gris, k = noir (texte du bouton vert).
// En mode clair les pictogrammes sont recolores (tintColor) ; en mode sombre ils gardent leurs couleurs d'origine.
export function Icon({ name, color = 'w', size = 24, style }) {
  const set = ICONS[name];
  const key = color === 'white' ? 'w' : color;
  const c = theme.colors;
  const tint = theme.mode === 'light' ? { w: c.text, g: c.accent, m: c.textMuted, k: c.accentText }[color] : undefined;
  return <Image source={set[key] ?? Object.values(set)[0]} style={[{ width: size, height: size }, tint && { tintColor: tint }, style]} resizeMode="contain" />;
}
