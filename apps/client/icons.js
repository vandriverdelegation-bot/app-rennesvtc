import { Image } from 'react-native';
import { theme } from '@app-rennesvtc/shared';

// Pictogrammes du design (PNG : w = blanc, g = vert, m = gris, k = noir).
const ICONS = {
  bell: { w: require('./assets/ui/bell_w.png'), g: require('./assets/ui/bell_g.png'), m: require('./assets/ui/bell_m.png'), k: require('./assets/ui/bell_k.png') },
  search: { w: require('./assets/ui/search_w.png'), g: require('./assets/ui/search_g.png'), m: require('./assets/ui/search_m.png'), k: require('./assets/ui/search_k.png') },
  arrow: { w: require('./assets/ui/arrow_w.png'), g: require('./assets/ui/arrow_g.png'), m: require('./assets/ui/arrow_m.png'), k: require('./assets/ui/arrow_k.png') },
  plane: { w: require('./assets/ui/plane_w.png'), g: require('./assets/ui/plane_g.png'), m: require('./assets/ui/plane_m.png'), k: require('./assets/ui/plane_k.png') },
  train: { w: require('./assets/ui/train_w.png'), g: require('./assets/ui/train_g.png'), m: require('./assets/ui/train_m.png'), k: require('./assets/ui/train_k.png') },
  home: { w: require('./assets/ui/home_w.png'), g: require('./assets/ui/home_g.png'), m: require('./assets/ui/home_m.png'), k: require('./assets/ui/home_k.png') },
  van: { w: require('./assets/ui/van_w.png'), g: require('./assets/ui/van_g.png'), m: require('./assets/ui/van_m.png'), k: require('./assets/ui/van_k.png') },
  user: { w: require('./assets/ui/user_w.png'), g: require('./assets/ui/user_g.png'), m: require('./assets/ui/user_m.png'), k: require('./assets/ui/user_k.png') },
  luggage: { w: require('./assets/ui/luggage_w.png'), g: require('./assets/ui/luggage_g.png'), m: require('./assets/ui/luggage_m.png'), k: require('./assets/ui/luggage_k.png') },
  phone: { w: require('./assets/ui/phone_w.png'), g: require('./assets/ui/phone_g.png'), m: require('./assets/ui/phone_m.png'), k: require('./assets/ui/phone_k.png') },
  message: { w: require('./assets/ui/message_w.png'), g: require('./assets/ui/message_g.png'), m: require('./assets/ui/message_m.png'), k: require('./assets/ui/message_k.png') },
  calendar: { w: require('./assets/ui/calendar_w.png'), g: require('./assets/ui/calendar_g.png'), m: require('./assets/ui/calendar_m.png'), k: require('./assets/ui/calendar_k.png') },
  navhome: { w: require('./assets/ui/navhome_w.png'), g: require('./assets/ui/navhome_g.png'), m: require('./assets/ui/navhome_m.png'), k: require('./assets/ui/navhome_k.png') },
  repeat: { w: require('./assets/ui/repeat_w.png'), g: require('./assets/ui/repeat_g.png'), m: require('./assets/ui/repeat_m.png'), k: require('./assets/ui/repeat_k.png') },
  dots: { w: require('./assets/ui/dots_w.png'), g: require('./assets/ui/dots_g.png'), m: require('./assets/ui/dots_m.png'), k: require('./assets/ui/dots_k.png') },
  star: { w: require('./assets/ui/star_w.png'), g: require('./assets/ui/star_g.png'), m: require('./assets/ui/star_m.png'), k: require('./assets/ui/star_k.png') },
  settings: { w: require('./assets/ui/settings_w.png'), g: require('./assets/ui/settings_g.png'), m: require('./assets/ui/settings_m.png'), k: require('./assets/ui/settings_k.png') },
  wallet: { w: require('./assets/ui/wallet_w.png'), g: require('./assets/ui/wallet_g.png'), m: require('./assets/ui/wallet_m.png'), k: require('./assets/ui/wallet_k.png') },
  info: { w: require('./assets/ui/info_w.png'), g: require('./assets/ui/info_g.png'), m: require('./assets/ui/info_m.png'), k: require('./assets/ui/info_k.png') },
  flag: { w: require('./assets/ui/flag_w.png'), g: require('./assets/ui/flag_g.png'), m: require('./assets/ui/flag_m.png'), k: require('./assets/ui/flag_k.png') },
  clock: { w: require('./assets/ui/clock_w.png'), g: require('./assets/ui/clock_g.png'), m: require('./assets/ui/clock_m.png'), k: require('./assets/ui/clock_k.png') },
  plusc: { w: require('./assets/ui/plusc_w.png'), g: require('./assets/ui/plusc_g.png'), m: require('./assets/ui/plusc_m.png'), k: require('./assets/ui/plusc_k.png') },
  close: { w: require('./assets/ui/close_w.png'), g: require('./assets/ui/close_g.png'), m: require('./assets/ui/close_m.png'), k: require('./assets/ui/close_k.png') },
  history: { w: require('./assets/ui/history_w.png'), g: require('./assets/ui/history_g.png'), m: require('./assets/ui/history_m.png'), k: require('./assets/ui/history_k.png') },
  pin: { w: require('./assets/ui/pin_w.png'), g: require('./assets/ui/pin_g.png'), m: require('./assets/ui/pin_m.png'), k: require('./assets/ui/pin_k.png') },
  headset: { w: require('./assets/ui/headset_w.png'), g: require('./assets/ui/headset_g.png'), m: require('./assets/ui/headset_m.png'), k: require('./assets/ui/headset_k.png') },
  cash: { w: require('./assets/ui/cash_w.png'), g: require('./assets/ui/cash_g.png'), m: require('./assets/ui/cash_m.png'), k: require('./assets/ui/cash_k.png') },
  tag: { w: require('./assets/ui/tag_w.png'), g: require('./assets/ui/tag_g.png'), m: require('./assets/ui/tag_m.png'), k: require('./assets/ui/tag_k.png') },
  mail: { w: require('./assets/ui/mail_w.png'), g: require('./assets/ui/mail_g.png'), m: require('./assets/ui/mail_m.png'), k: require('./assets/ui/mail_k.png') },
  check: { w: require('./assets/ui/check_w.png'), g: require('./assets/ui/check_g.png'), m: require('./assets/ui/check_m.png'), k: require('./assets/ui/check_k.png') },
  back: { w: require('./assets/ui/back_w.png'), g: require('./assets/ui/back_g.png'), m: require('./assets/ui/back_m.png'), k: require('./assets/ui/back_k.png') },
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
