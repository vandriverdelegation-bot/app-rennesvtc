const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'rennesvtc@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function sendAdminEmail(subject, text) {
  if (!process.env.GMAIL_APP_PASSWORD) {
    console.log('GMAIL_APP_PASSWORD non configure, email non envoye:', subject);
    return;
  }
  await transporter.sendMail({
    from: 'Rennes VTC <rennesvtc@gmail.com>',
    to: 'rennesvtc@gmail.com',
    subject,
    text,
  });
}

module.exports = { sendAdminEmail };
