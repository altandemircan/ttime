/**
 * Feedback Route
 * POST /api/feedback
 *
 * Beklenen JSON body:
 * {
 *   "type": "bug" | "feature" | "idea" | "other",
 *   "message": "metin",
 *   "userEmail": "opsiyonel",
 *   "screenshot": "data:image/png;base64,...." (opsiyonel)
 * }
 */

const express = require('express');
const nodemailer = require('nodemailer');

const router = express.Router();

// Basit ayarlar
const ALLOWED_TYPES = new Set(['bug', 'feature', 'idea', 'other', 'genel', 'general']);
const MAX_MESSAGE_LEN = 20000;            // 20K karakter yeterli
const MAX_SCREENSHOT_LEN = 2_000_000;     // ~2MB base64 string (gerekirse arttır)
const SCREENSHOT_PREFIX = /^data:image\/(png|jpe?g|webp);base64,/i;

const FROM_EMAIL = process.env.FEEDBACK_FROM_EMAIL;
const FROM_PASS  = process.env.FEEDBACK_FROM_PASS;

if (!FROM_EMAIL || !FROM_PASS) {
  console.warn('[feedbackRoute] UYARI: FEEDBACK_FROM_EMAIL veya FEEDBACK_FROM_PASS env tanımlı değil!');
}

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: FROM_EMAIL,
    pass: FROM_PASS
  }
});

/**
 * Küçük yardımcı: HTML'e koymadan önce düz metin güvenli hale getir
 */
function escapeHtml(str = '') {
  return str.replace(/[<>&"]/g, c => ({
    '<':'&lt;',
    '>':'&gt;',
    '&':'&amp;',
    '"':'&quot;'
  }[c] || c));
}

/**
 * Basit e‑posta format kontrolü (çok katı değil)
 */
function isValidEmail(email = '') {
  if (!email) return true; // opsiyonel olduğu için boşsa kabul
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post('/feedback', async (req, res) => {
  // LOG: ham bilgiler
  console.log('[feedback] HIT', {
    bodyType: typeof req.body,
    keys: Object.keys(req.body || {}),
  });

  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'invalid_body' });
    }

    let { type, message, userEmail, screenshot } = req.body;

    // Mesaj kontrolleri
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message_required' });
    }
    message = message.trim();
    if (!message) {
      return res.status(400).json({ error: 'message_empty' });
    }
    if (message.length > MAX_MESSAGE_LEN) {
      return res.status(413).json({ error: 'message_too_long' });
    }

    // Tür normalizasyonu
    if (type && typeof type === 'string') {
      type = type.toLowerCase().trim();
    } else {
      type = 'general';
    }
    if (!ALLOWED_TYPES.has(type)) {
      type = 'general';
    }

    // Email kontrolü
    if (userEmail && typeof userEmail === 'string') {
      userEmail = userEmail.trim();
      if (!isValidEmail(userEmail)) {
        return res.status(400).json({ error: 'invalid_email' });
      }
      if (userEmail.length > 120) {
        return res.status(400).json({ error: 'email_too_long' });
      }
    } else {
      userEmail = '';
    }

    // Screenshot kontrolü
    let screenshotHtml = '';
    if (screenshot) {
      if (typeof screenshot !== 'string') {
        return res.status(400).json({ error: 'invalid_screenshot_type' });
      }
      if (screenshot.length > MAX_SCREENSHOT_LEN) {
        return res.status(413).json({ error: 'screenshot_too_large' });
      }
      if (!SCREENSHOT_PREFIX.test(screenshot)) {
        return res.status(400).json({ error: 'invalid_screenshot_format' });
      }
      screenshotHtml = `<p><b>Ekran Görüntüsü:</b><br><img src="${screenshot}" style="max-width:600px;border:1px solid #ccc;"></p>`;
    }

    // HTML mail gövdesi
    const safeMessage = escapeHtml(message);
    const safeUser = escapeHtml(userEmail || '-');
    const safeType = escapeHtml(type);

    const html = `
      <h3>Yeni Feedback</h3>
      <p><b>Tür:</b> ${safeType}</p>
      <p><b>Gönderen (opsiyonel):</b> ${safeUser}</p>
      <p><b>Mesaj:</b></p>
      <pre style="white-space:pre-wrap;font-family:monospace;">${safeMessage}</pre>
      ${screenshotHtml}
      <hr>
      <small style="color:#888;">Otomatik gönderildi • ${new Date().toISOString()}</small>
    `;

    if (!FROM_EMAIL) {
      return res.status(500).json({ error: 'email_not_configured' });
    }

    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to: 'altandemircan@gmail.com',
      subject: `Feedback - ${type}`,
      replyTo: userEmail || undefined,
      html
    });

    console.log('[feedback] SENT', {
      messageId: info && info.messageId,
      accepted: info && info.accepted,
      rejected: info && info.rejected
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('[feedback] ERROR', err && err.message);
    if (process.env.NODE_ENV !== 'production') {
      return res.status(500).json({ error: 'send_failed', detail: err.message });
    }
    return res.status(500).json({ error: 'send_failed' });
  }
});

module.exports = router;