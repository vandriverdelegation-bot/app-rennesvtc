import { theme } from '@app-rennesvtc/shared';

// Design client « Accueil » : noir chaud, cartes #141614, vert #5BD42A. Importé avant App pour que tous les styles lisent ces couleurs.
Object.assign(theme.colors, {
  background: '#0B0C0B',
  card: '#141614',
  cardBorder: '#262A26',
  accent: '#5BD42A',
  accentText: '#0B0C0B',
  text: '#F2F2EE',
  textMuted: '#9AA19A',
  error: '#FF5C5C',
  input: '#141614',
  inputBorder: '#2E332E',
  pill: '#1A1D1A',
});
theme.fonts.title = 'Outfit_600SemiBold';
