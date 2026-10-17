async function sendPush(tokens, title, body) {
  const messages = tokens
    .filter(Boolean)
    .map((to) => ({ to, title, body }));
  if (messages.length === 0) return;

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });
}

module.exports = { sendPush };
