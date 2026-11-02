import { Image } from 'react-native';

// Pictogrammes du design chauffeur (PNG : w = blanc, g = vert, m = gris, k = noir).
const ICONS = {
  calendar: { w: require('./assets/ui/calendar_w.png'), g: require('./assets/ui/calendar_g.png'), m: require('./assets/ui/calendar_m.png'), k: require('./assets/ui/calendar_k.png') },
  chevron: { w: require('./assets/ui/chevron_w.png'), g: require('./assets/ui/chevron_g.png'), m: require('./assets/ui/chevron_m.png'), k: require('./assets/ui/chevron_k.png') },
  users: { w: require('./assets/ui/users_w.png'), g: require('./assets/ui/users_g.png'), m: require('./assets/ui/users_m.png'), k: require('./assets/ui/users_k.png') },
  luggage: { w: require('./assets/ui/luggage_w.png'), g: require('./assets/ui/luggage_g.png'), m: require('./assets/ui/luggage_m.png'), k: require('./assets/ui/luggage_k.png') },
  card: { w: require('./assets/ui/card_w.png'), g: require('./assets/ui/card_g.png'), m: require('./assets/ui/card_m.png'), k: require('./assets/ui/card_k.png') },
  ban: { w: require('./assets/ui/ban_w.png'), g: require('./assets/ui/ban_g.png'), m: require('./assets/ui/ban_m.png'), k: require('./assets/ui/ban_k.png') },
  close: { w: require('./assets/ui/close_w.png'), g: require('./assets/ui/close_g.png'), m: require('./assets/ui/close_m.png'), k: require('./assets/ui/close_k.png') },
  menu: { w: require('./assets/ui/menu_w.png'), g: require('./assets/ui/menu_g.png'), m: require('./assets/ui/menu_m.png'), k: require('./assets/ui/menu_k.png') },
  route: { w: require('./assets/ui/route_w.png'), g: require('./assets/ui/route_g.png'), m: require('./assets/ui/route_m.png'), k: require('./assets/ui/route_k.png') },
  plus: { w: require('./assets/ui/plus_w.png'), g: require('./assets/ui/plus_g.png'), m: require('./assets/ui/plus_m.png'), k: require('./assets/ui/plus_k.png') },
  xcircle: { w: require('./assets/ui/xcircle_w.png'), g: require('./assets/ui/xcircle_g.png'), m: require('./assets/ui/xcircle_m.png'), k: require('./assets/ui/xcircle_k.png') },
  car: { w: require('./assets/ui/car_w.png'), g: require('./assets/ui/car_g.png'), m: require('./assets/ui/car_m.png'), k: require('./assets/ui/car_k.png') },
};

export const ACCEPT_ICON = require('./assets/ui/accept.png');
export const PIN_ICON = require('./assets/ui/pin_r.png');
export const HEADER_IMAGE = require('./assets/ui/header.jpg');

export function Icon({ name, color = 'w', size = 24, style }) {
  return <Image source={ICONS[name][color]} style={[{ width: size, height: size }, style]} resizeMode="contain" />;
}
