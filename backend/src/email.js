// Tant qu'aucun domaine n'est verifie sur Resend, on ne peut envoyer qu'a l'adresse du compte Resend.
const ADMIN_EMAIL = 'vandriverdelegation@gmail.com';

async function sendAdminEmail(subject, text) {
  if (!process.env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY non configure, email non envoye:', subject);
    return;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Rennes VTC <onboarding@resend.dev>',
        to: ADMIN_EMAIL,
        subject,
        text,
      }),
    });
    if (!res.ok) {
      console.log('Echec envoi email:', res.status, await res.text());
    }
  } catch (e) {
    // Un echec d'envoi d'email ne doit jamais faire planter le serveur.
    console.log('Echec envoi email:', e.message);
  }
}

module.exports = { sendAdminEmail };
