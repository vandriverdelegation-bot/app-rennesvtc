const { supabaseAdmin } = require('./supabaseAdmin');

// extra.channelId : alerte chauffeur (sonnerie speciale). Chaque appareil a son propre canal (profiles.push_channel, enregistre
// par l'app qui l'a cree) : un canal inconnu de l'appareil ferait disparaitre la notification, donc sans canal enregistre on n'en envoie pas.
async function sendPush(tokens, title, body, extra = {}) {
  const list = [...new Set(tokens.filter(Boolean))];
  if (list.length === 0) return;

  let channels = {};
  if (extra.channelId) {
    const { data } = await supabaseAdmin.from('profiles').select('push_token, push_channel').in('push_token', list);
    channels = Object.fromEntries((data ?? []).map((p) => [p.push_token, p.push_channel]));
  }
  const messages = list.map((to) => ({ to, title, body, ...(channels[to] ? { channelId: channels[to] } : {}) }));

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });
  const tickets = (await res.json().catch(() => ({}))).data ?? [];
  tickets.filter((t) => t.status === 'error').forEach((t) => console.error('push refuse :', t.message, t.details?.error ?? ''));
}

module.exports = { sendPush };
