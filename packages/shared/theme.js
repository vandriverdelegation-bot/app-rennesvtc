const theme = {
  colors: {
    background: '#0E0F10',
    card: '#1B1C1E',
    cardBorder: '#2A2B2E',
    accent: '#47C415',
    accentText: '#0E0F10',
    text: '#FFFFFF',
    textMuted: '#9AA0A6',
    error: '#FF5C5C',
    input: '#1B1C1E',
    inputBorder: '#33353A',
    pill: '#232427',
    accentLight: '#7EE04F',
    accentTint: 'rgba(91,212,42,0.12)',
    accentHalo: 'rgba(91,212,42,0.2)',
    accentSoft: '#1F241F',
    navBg: 'rgba(24,27,24,0.96)',
  },
  fonts: { title: undefined },
  radius: 12,
  spacing: 16,
  mode: 'dark',
};

// Mode clair : ivoire et blanc, vert plus profond (le vert vif est illisible sur fond clair).
const LIGHT_COLORS = {
  background: '#F5F5F0',
  card: '#FFFFFF',
  cardBorder: '#E1E4DB',
  accent: '#2F8F10',
  accentText: '#FFFFFF',
  text: '#151715',
  textMuted: '#5E665E',
  error: '#D13030',
  input: '#FFFFFF',
  inputBorder: '#C9CEC4',
  pill: '#EAEDE5',
  accentLight: '#2F8F10',
  accentTint: 'rgba(47,143,16,0.12)',
  accentHalo: 'rgba(47,143,16,0.2)',
  accentSoft: '#E3F0DC',
  navBg: 'rgba(255,255,255,0.96)',
};

// Palette sombre propre a chaque appli (posee par son applyTheme avant le premier setThemeMode).
let darkColors = null;

// Change le mode : les couleurs de theme.colors sont remplacees sur place, les styles themedStyles se recalculent au prochain rendu.
function setThemeMode(mode) {
  if (!darkColors) darkColors = { ...theme.colors };
  theme.mode = mode === 'light' ? 'light' : 'dark';
  Object.assign(theme.colors, theme.mode === 'light' ? LIGHT_COLORS : darkColors);
}

// Remplace StyleSheet.create : la fabrique est rappelee (une fois) pour chaque mode, a la premiere lecture dans ce mode.
function themedStyles(factory) {
  const { StyleSheet } = require('react-native');
  const cache = {};
  return new Proxy({}, {
    get(_, key) {
      cache[theme.mode] ??= StyleSheet.create(factory());
      return cache[theme.mode][key];
    },
  });
}


// Preference d'apparence de l'appli (light | dark), gardee sur l'appareil. Sombre par defaut.
// Applique le mode tout de suite (avant le rendu des ecrans) ; `loaded` passe a true une fois la preference relue.
function useThemeMode() {
  const { useState, useEffect } = require('react');
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  const [pref, setPref] = useState('dark');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem('theme_mode').then((v) => { if (['light', 'dark'].includes(v)) setPref(v); }).catch(() => {}).then(() => setLoaded(true));
  }, []);
  const mode = pref;
  setThemeMode(mode);
  const choose = (v) => { setPref(v); AsyncStorage.setItem('theme_mode', v).catch(() => {}); };
  return { pref, mode, choose, loaded };
}

// Interrupteur « Mode clair » des menus (desactive = mode sombre).
function ThemeSwitch({ value, onChange }) {
  const React = require('react');
  const { View, Text, Switch } = require('react-native');
  const c = theme.colors;
  const h = React.createElement;
  return h(View, { style: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder, borderRadius: 18, padding: 16 } },
    h(View, { style: { flex: 1 } },
      h(Text, { style: { color: c.text, fontSize: 15, fontWeight: '600' } }, 'Mode clair'),
      h(Text, { style: { color: c.textMuted, fontSize: 12, marginTop: 2 } }, value === 'light' ? 'Activé : fond clair' : 'Désactivé : fond sombre')),
    h(Switch, { value: value === 'light', onValueChange: (on) => onChange(on ? 'light' : 'dark'), trackColor: { false: c.inputBorder, true: c.accent }, thumbColor: '#FFFFFF', accessibilityLabel: 'Mode clair' }));
}

module.exports = { theme, setThemeMode, themedStyles, useThemeMode, ThemeSwitch };
