// Tant qu'aucun domaine n'est verifie sur Resend, le sandbox ne peut envoyer
// qu'a l'adresse du compte Resend (ADMIN_EMAIL) - les emails aux clients
// echoueront silencieusement (log seulement) jusqu'a verification du domaine.
const ADMIN_EMAIL = 'vandriverdelegation@gmail.com';

async function sendEmail(to, subject, text) {
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
        to,
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

function sendAdminEmail(subject, text) {
  return sendEmail(ADMIN_EMAIL, subject, text);
}

module.exports = { sendEmail, sendAdminEmail };
