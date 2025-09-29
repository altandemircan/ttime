const express = require('express');
const nodemailer = require('nodemailer');

const router = express.Router();

console.log('[feedbackRoute] yüklendi');

router.get('/feedback/ping', (req, res) => {
  res.json({ ok: true, route: 'alive' });
});

router.post('/feedback', async (req, res) => {
  console.log('[feedback] HIT BODY=', req.body);

  try {
    const { message, type, userEmail } = req.body || {};
    if (!message) {
      console.log('[feedback] message yok');
      return res.status(400).json({ error: 'message_required' });
    }

    // Transporter (debug açık)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.FEEDBACK_FROM_EMAIL,
        pass: process.env.FEEDBACK_FROM_PASS
      },
      logger: true,
      debug: true
    });

    const info = await transporter.sendMail({
      from: process.env.FEEDBACK_FROM_EMAIL,
      to: 'altandemircan@gmail.com',
      subject: 'Feedback DEBUG - ' + (type || 'genel'),
      text: message + '\nUser: ' + (userEmail || '-')
    });

    console.log('[feedback] SENT messageId=', info.messageId, 'accepted=', info.accepted);
    res.json({ ok: true });
  } catch (e) {
    console.error('[feedback] ERROR', e.message);
    res.status(500).json({ error: 'send_failed', detail: e.message });
  }
});

module.exports = router;