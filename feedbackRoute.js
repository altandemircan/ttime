const express = require('express');
const nodemailer = require('nodemailer');

const router = express.Router();

console.log('[feedbackRoute] loaded (final)');

const MAX_SCREENSHOT_LEN = 2_000_000; // ~2MB base64 string
const SS_PREFIX = /^data:image\/(png|jpe?g|webp);base64,/i;

router.post('/feedback', async (req, res) => {
  const body = req.body || {};
  const { message, type, userEmail, screenshot } = body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message_required' });
  }

  // Screenshot validation
  let screenshotHtml = '';
  if (screenshot) {
    if (typeof screenshot !== 'string') {
      return res.status(400).json({ error: 'invalid_screenshot_type' });
    }
    if (screenshot.length > MAX_SCREENSHOT_LEN) {
      return res.status(413).json({ error: 'screenshot_too_large' });
    }
    if (!SS_PREFIX.test(screenshot)) {
      return res.status(400).json({ error: 'invalid_screenshot_format' });
    }
    screenshotHtml = `<p><b>Screenshot:</b><br><img src="${screenshot}" style="max-width:600px;border:1px solid #ccc;border-radius:4px;"></p>`;
  }

  const escapeHtml = s =>
    (s || '').toString().replace(/[<>&"]/g, c => ({
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;'
    }[c]));

  const safeMsg = escapeHtml(message);
  const safeType = escapeHtml(type || 'general');
  const safeEmail = escapeHtml(userEmail || '-');

  const html = `
    <h3>New Feedback</h3>
    <p><b>Type:</b> ${safeType}</p>
    <p><b>Email:</b> ${safeEmail}</p>
    <p><b>Message:</b></p>
    <pre style="white-space:pre-wrap;font-family:monospace;background:#f7f7f7;padding:8px;border:1px solid #ddd;border-radius:4px;">${safeMsg}</pre>
    ${screenshotHtml}
    <hr>
    <small style="color:#888;">Sent at: ${new Date().toISOString()}</small>
  `;

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.FEEDBACK_FROM_EMAIL,
        pass: process.env.FEEDBACK_FROM_PASS
      }
    });

    const info = await transporter.sendMail({
      from: process.env.FEEDBACK_FROM_EMAIL,
      to: 'altandemircan@gmail.com',
      subject: 'Feedback - ' + (type || 'general'),
      html,
      replyTo: userEmail || undefined
    });

    console.log('[feedback] SENT', info.messageId, 'screenshot:', !!screenshot);
    return res.json({ ok: true });
  } catch (e) {
    console.error('[feedback] ERROR', e.message);
    return res.status(500).json({ error: 'send_failed' });
  }
});

router.get('/feedback/ping', (req, res) => res.json({ ok: true, route: 'alive' }));

module.exports = router;