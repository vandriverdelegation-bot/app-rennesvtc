const nodemailer = require('nodemailer');

const SENDER_EMAIL = 'notifications.rennesvtc@gmail.com';
const ADMIN_EMAIL = 'rennesvtc@gmail.com';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: SENDER_EMAIL,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function sendAdminEmail(subject, text) {
  if (!process.env.GMAIL_APP_PASSWORD) {
    console.log('GMAIL_APP_PASSWORD non configure, email non envoye:', subject);
    return;
  }
  await transporter.sendMail({
    from: `Rennes VTC <${SENDER_EMAIL}>`,
    to: ADMIN_EMAIL,
    subject,
    text,
  });
}

module.exports = { sendAdminEmail };
