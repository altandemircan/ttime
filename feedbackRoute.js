const express = require('express');
const nodemailer = require('nodemailer');

const router = express.Router();

console.log('[feedbackRoute] loaded (cid attachment version)');

const MAX_SCREENSHOT_LEN = 4_000_000; // allow a bit more (base64 chars)
const DATA_URL_REGEX = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/i;

function escapeHtml(s) {
  return (s || '').toString().replace(/[<>&"]/g, c => ({
    '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'
  }[c]));
}

router.post('/feedback', async (req, res) => {
  const { message, type, userEmail, screenshot } = req.body || {};

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'message_required' });
  }

  let attachment = null;
  let inlineImgHtml = '';
  if (screenshot) {
    if (typeof screenshot !== 'string') {
      return res.status(400).json({ error: 'invalid_screenshot_type' });
    }
    if (screenshot.length > MAX_SCREENSHOT_LEN) {
      return res.status(413).json({ error: 'screenshot_too_large' });
    }
    const match = screenshot.match(DATA_URL_REGEX);
    if (!match) {
      return res.status(400).json({ error: 'invalid_screenshot_format' });
    }
    const extRaw = match[1].toLowerCase();
    const ext = extRaw === 'jpeg' ? 'jpg' : extRaw;
    const b64 = match[2];

    attachment = {
      filename: `screenshot.${ext}`,
      content: b64,
      encoding: 'base64',
      cid: 'feedback-screenshot@local' // unique content id
    };

    inlineImgHtml = `
      <p style="margin:16px 0 4px;font-weight:600;">Screenshot:</p>
      <img src="cid:feedback-screenshot@local"
           alt="screenshot"
           style="max-width:600px;display:block;border:1px solid #ddd;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,0.08);" />
    `;
  }

  const safeType = escapeHtml(type || 'general');
  const safeEmail = escapeHtml(userEmail || '-');
  const safeMsg = escapeHtml(message);

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:14px;color:#1e293b;line-height:1.5;">
      <h2 style="margin:0 0 12px;font-size:18px;color:#8a4af3;">New Feedback</h2>
      <p style="margin:4px 0;"><strong>Type:</strong> ${safeType}</p>
      <p style="margin:4px 0;"><strong>Email:</strong> ${safeEmail}</p>
      <p style="margin:12px 0 4px;"><strong>Message:</strong></p>
      <pre style="white-space:pre-wrap;margin:0;background:#f7f7f9;padding:12px;border:1px solid #e3e3e8;border-radius:8px;font-family:ui-monospace,Menlo,Consolas,monospace;color:#111;">
${safeMsg}
      </pre>
      ${inlineImgHtml}
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee;">
      <div style="font-size:11px;color:#666;">Sent at: ${new Date().toISOString()}</div>
    </div>
  `;

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.FEEDBACK_FROM_EMAIL,
        pass: process.env.FEEDBACK_FROM_PASS
      }
    });

    const mailOptions = {
      from: process.env.FEEDBACK_FROM_EMAIL,
      to: 'altandemircan@gmail.com',
      subject: 'Feedback - ' + (type || 'general'),
      html,
      replyTo: userEmail || undefined,
      attachments: attachment ? [attachment] : []
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[feedback] SENT', info.messageId, 'attachment:', !!attachment);
    return res.json({ ok: true, hasScreenshot: !!attachment });
  } catch (e) {
    console.error('[feedback] ERROR', e.message);
    return res.status(500).json({ error: 'send_failed' });
  }
});

router.get('/feedback/ping', (req, res) => res.json({ ok: true, route: 'alive' }));

module.exports = router;