import { theme } from '@app-rennesvtc/shared';

// Design client « Accueil » : noir chaud, cartes #141614, vert #22C55E. Importé avant App pour que tous les styles lisent ces couleurs.
Object.assign(theme.colors, {
  background: '#0B0C0B',
  card: '#141614',
  cardBorder: '#262A26',
  accent: '#22C55E',
  accentText: '#0B0C0B',
  accentLight: '#4ADE80',
  accentTint: 'rgba(34,197,94,0.12)',
  accentHalo: 'rgba(34,197,94,0.2)',
  text: '#F2F2EE',
  textMuted: '#9AA19A',
  error: '#FF5C5C',
  input: '#141614',
  inputBorder: '#2E332E',
  pill: '#1A1D1A',
});
// Mode clair : version plus profonde du même vert (le #22C55E est trop pâle pour le texte sur fond clair).
theme.lightOverrides = { accent: '#15803D', accentLight: '#15803D', accentTint: 'rgba(21,128,61,0.12)', accentHalo: 'rgba(21,128,61,0.2)', accentSoft: '#DCF3E5' };
theme.fonts.title = 'Outfit_600SemiBold';
