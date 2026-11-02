import { theme } from '@app-rennesvtc/shared';

// Design chauffeur « Nuit verte » : noir profond, cartes tres sombres a liseré vert. Importe avant App pour que tous les styles lisent ces couleurs.
Object.assign(theme.colors, {
  background: '#050606',
  card: '#0b0e0b',
  cardBorder: '#1c241a',
  pill: '#141718',
  input: '#0f1111',
  inputBorder: '#2f3336',
});
