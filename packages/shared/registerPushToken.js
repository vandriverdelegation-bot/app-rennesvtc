// Enregistre le jeton de notification push de cet appareil pour cet utilisateur.
// N'echoue jamais bruyamment : sans permission, sans projet EAS configure ou dans
// Expo Go (qui n'embarque pas les modules de notifications), l'app continue de
// fonctionner normalement, simplement sans notifications push.
async function registerPushToken(supabase, userId) {
  try {
    // Expo Go n'embarque pas les modules natifs de notifications : on verifie leur
    // presence avant de charger expo-notifications, dont le simple chargement
    // declenche sinon une erreur (meme dans un try/catch).
    const constantsModule = require('expo-constants');
    const Constants = constantsModule.default ?? constantsModule;
    if (Constants.appOwnership === 'expo') return 'Indisponible dans Expo Go.';
    const Notifications = require('expo-notifications');
    const Device = require('expo-device');

    if (!Device.isDevice) return 'Indisponible sur un simulateur.';
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return 'Notifications refusees pour cette app dans les reglages du telephone.';

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.log('registerPushToken: aucun projectId EAS configure dans app.json');
      return 'Projet EAS introuvable dans la configuration.';
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
  } catch (e) {
    console.log('registerPushToken: notifications push indisponibles -', e.message);
    return e.message; // renvoye pour etre affiche dans l'ecran Notifications
  }
}

module.exports = { registerPushToken };
