require('dotenv').config();
const nodemailer = require('nodemailer');

(async () => {
  const t = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.FEEDBACK_FROM_EMAIL,
      pass: process.env.FEEDBACK_FROM_PASS
    },
    logger: true,
    debug: true
  });

  try {
    await t.sendMail({
      from: process.env.FEEDBACK_FROM_EMAIL,
      to: 'altandemircan@gmail.com',
      subject: 'Manual Test',
      text: 'Bu bir testtir'
    });
    console.log('MANUAL SEND OK');
  } catch(e) {
    console.error('MANUAL SEND ERROR:', e.message);
  }
})();