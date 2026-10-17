const Notifications = require('expo-notifications');
const Device = require('expo-device');

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

    const { data: token } = await Notifications.getExpoPushTokenAsync();
    await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
  } catch (e) {
    console.log('registerPushToken: notifications push indisponibles -', e.message);
  }
}

module.exports = { registerPushToken };
