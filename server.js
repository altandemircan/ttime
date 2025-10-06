// --- dotenv safe load ---
try {
  require('dotenv').config({ /* quiet: true */ });
  console.log('[startup] dotenv loaded');
} catch (e) {
  console.warn('[startup] dotenv not loaded:', e.code || e.message);
}

const express = require('express');
const path = require('path');
const app = express();

// 1. BODY PARSER
app.use(express.json({ limit: '6mb' }));
app.use(express.urlencoded({ extended: true }));

// 2. Feedback Route
const feedbackRoute = require('./feedbackRoute');
app.use('/api', feedbackRoute);

// 3. Diğer API Routerları
const llmProxy = require('./llm-proxy');
const photogetProxy = require('./photoget-proxy');
app.use('/llm-proxy', llmProxy);
app.use('/photoget-proxy', photogetProxy);

// 4. Health endpoint
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    envMailConfigured: !!process.env.FEEDBACK_FROM_EMAIL
  });
});

// 5. Test endpoint
app.get('/test-root', (req, res) => {
  res.json({ message: 'Root test OK' });
});

// 6. Statik dosyalar
app.use(express.static(path.join(__dirname, 'public')));

// 7. API 404 yakalayıcı (sadece /api altında, tanımlı route’lardan sonra)
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'not_found' });
});

// 8. SPA fallback (en sona)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 9. Global error handler
app.use((err, req, res, next) => {
  console.error('[GLOBAL ERROR]', err);
  if (res.headersSent) return;
  if (req.path.startsWith('/api')) {
    return res.status(500).json({
      error: 'internal_error',
      detail: process.env.NODE_ENV === 'production' ? undefined : (err.message || 'error')
    });
  }
  res.status(500).send('Internal Server Error');
});

// Port (Nginx 3003’e bakıyorsa 3003 yap)
const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Feedback email configured:', !!process.env.FEEDBACK_FROM_EMAIL);
});
