// Domaine mail.rennesvtc.com verifie sur Resend (sous-domaine dedie, pour ne pas
// toucher a la redirection de boite mail du domaine principal).
const FROM = 'Rennes VTC <noreply@mail.rennesvtc.com>';
const ADMIN_EMAIL = 'rennesvtc@gmail.com';

// Trace chaque envoi (reussi ou non) dans email_log ; ne doit jamais faire echouer l'envoi lui-meme.
async function logEmail(to, subject, status, detail) {
  try {
    const { supabaseAdmin } = require('./supabaseAdmin');
    await supabaseAdmin.from('email_log').insert({ to_email: String(to), subject, status, detail: detail ? String(detail).slice(0, 500) : null });
  } catch (e) {
    console.log('Journal email indisponible:', e.message);
  }
}

async function sendEmail(to, subject, text, attachments) {
  if (!process.env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY non configure, email non envoye:', subject);
    await logEmail(to, subject, 'no_key', 'RESEND_API_KEY non configure');
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
    const body = await res.text();
    if (!res.ok) console.log('Echec envoi email:', res.status, body);
    await logEmail(to, subject, res.ok ? 'sent' : 'error', res.ok ? body : res.status + ' ' + body);
  } catch (e) {
    // Un echec d'envoi d'email ne doit jamais faire planter le serveur.
    console.log('Echec envoi email:', e.message);
    await logEmail(to, subject, 'error', e.message);
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
