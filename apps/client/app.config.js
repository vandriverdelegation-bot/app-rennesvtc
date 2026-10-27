// Ajoute la cle Google Maps du MapView Android depuis l'environnement de build (eas.json).
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: { googleMaps: { apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY } },
    // Fichier Firebase (notifications Android) fourni au build par une variable de type fichier EAS ; absent en local.
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON,
  },
});
