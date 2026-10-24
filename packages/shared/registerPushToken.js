// Enregistre le jeton de notification push de cet appareil pour cet utilisateur.
// N'echoue jamais bruyamment : sans permission, sans projet EAS configure ou dans
// Expo Go (qui n'embarque pas les modules de notifications), l'app continue de
// fonctionner normalement, simplement sans notifications push.
async function registerPushToken(supabase, userId) {
  try {
    const constantsModule = require('expo-constants');
    const Constants = constantsModule.default ?? constantsModule;
    // Expo Go n'embarque pas expo-notifications : meme dans un try/catch, Metro
    // afficherait l'ecran d'erreur rouge au simple chargement du module.
    if (Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo') return;

    const Notifications = require('expo-notifications');
    const Device = require('expo-device');

    if (!Device.isDevice) return;
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.log('registerPushToken: aucun projectId EAS configure dans app.json');
      return;
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
  } catch (e) {
    console.log('registerPushToken: notifications push indisponibles -', e.message);
  }
}

module.exports = { registerPushToken };
