// Cle Google Maps, fichier Firebase et plugins natifs, avec possibilite d'en retirer (variable STRIP) pour isoler un plantage.
module.exports = ({ config }) => {
  const strip = (process.env.STRIP || '').split(',');
  const plugins = (config.plugins || []).filter((p) => {
    const name = Array.isArray(p) ? p[0] : p;
    return !(strip.includes('splash') && name === 'expo-splash-screen') && !(strip.includes('notif') && name === 'expo-notifications');
  });
  return {
    ...config,
    plugins,
    android: {
      ...config.android,
      googleServicesFile: strip.includes('firebase') ? undefined : process.env.GOOGLE_SERVICES_JSON,
    },
  };
};
