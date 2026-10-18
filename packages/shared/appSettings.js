const { theme } = require('./theme');

// Recupere les parametres d'apparence et applique la couleur d'accent au
// theme partage (mutation en place : tous les ecrans qui lisent
// theme.colors.accent/accentText en beneficient des le prochain rendu).
async function fetchAppSettings(supabase) {
  const { data } = await supabase.from('app_settings').select('*').eq('id', true).single();
  if (data?.accent_color) {
    theme.colors.accent = data.accent_color;
    theme.colors.accentText = data.accent_contrast === 'white' ? '#FFFFFF' : '#0E0F10';
  }
  return data ?? null;
}

module.exports = { fetchAppSettings };
