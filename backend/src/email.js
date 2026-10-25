// Domaine mail.rennesvtc.com verifie sur Resend (sous-domaine dedie, pour ne pas
// toucher a la redirection de boite mail du domaine principal).
const FROM = 'Rennes VTC <noreply@mail.rennesvtc.com>';
const ADMIN_EMAIL = 'vandriverdelegation@gmail.com';

async function sendEmail(to, subject, text, attachments) {
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
        from: FROM,
        to,
        subject,
        text,
        ...(attachments ? { attachments } : {}),
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

// Adresse des alertes : reglage de l'admin (Apparence), sinon adresse par defaut ci-dessus.
async function sendAdminEmail(subject, text) {
  let to = ADMIN_EMAIL;
  try {
    const { supabaseAdmin } = require('./supabaseAdmin');
    const { data } = await supabaseAdmin.from('app_settings').select('admin_email').eq('id', true).single();
    if (data?.admin_email) to = data.admin_email;
  } catch (e) {
    console.log('Adresse des alertes admin illisible, adresse par defaut utilisee:', e.message);
  }
  return sendEmail(to, subject, text);
}

module.exports = { sendEmail, sendAdminEmail };
