// server/feedbackRoute.js
import express from 'express';
import nodemailer from 'nodemailer';

const router = express.Router();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.FEEDBACK_FROM_EMAIL,
    pass: process.env.FEEDBACK_FROM_PASS
  }
});

router.post('/feedback', async (req, res) => {
  try {
    const { type, message, userEmail, screenshot } = req.body || {};
    if (!message) return res.status(400).json({ error:'message required' });

    let html = `
      <h3>Yeni Feedback</h3>
      <p><b>Tür:</b> ${type || '-'}</p>
      <p><b>Gönderen:</b> ${userEmail || '-'}</p>
      <pre style="white-space:pre-wrap;font-family:monospace;">${(message||'').replace(/</g,'&lt;')}</pre>
    `;
    if (screenshot) {
      html += `<p><b>Ekran görüntüsü:</b><br><img src="${screenshot}" style="max-width:600px;border:1px solid #ccc;"></p>`;
    }

    await transporter.sendMail({
      from: process.env.FEEDBACK_FROM_EMAIL,
      to: 'altandemircan@gmail.com',
      subject: `Feedback - ${type || 'genel'}`,
      html
    });

    res.json({ ok:true });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error:'send_failed' });
  }
});

export default router;