import { theme } from '@app-rennesvtc/shared';

// « Jour ivoire » : fond ivoire, cartes blanches, vert profond. Importé avant App pour que tous les styles lisent ces couleurs.
Object.assign(theme.colors, {
  background: '#F6F3EC',
  card: '#FFFFFF',
  cardBorder: '#E2DDCF',
  accent: '#1F5E3B',
  accentText: '#FFFFFF',
  text: '#17211B',
  textMuted: '#6B746E',
  error: '#C23B3B',
  input: '#FFFFFF',
  inputBorder: '#D9D3C3',
  pill: '#F0ECE1',
});
theme.fonts.title = 'serif';
