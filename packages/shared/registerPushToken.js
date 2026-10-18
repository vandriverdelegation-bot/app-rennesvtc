const Notifications = require('expo-notifications');
const Device = require('expo-device');
const Constants = require('expo-constants');

// Enregistre le jeton de notification push de cet appareil pour cet utilisateur.
// N'echoue jamais bruyamment : sans permission ou sans projet EAS configure,
// l'app continue de fonctionner normalement, simplement sans notifications push.
async function registerPushToken(supabase, userId) {
  try {
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
