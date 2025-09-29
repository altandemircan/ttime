/**
 * Uygulama giriş noktası
 */
require('dotenv').config();

const express = require('express');
const path = require('path');
const app = express();




// (Opsiyonel) Eğer farklı origin'den istek geleceğini düşünüyorsan CORS aç:
// const cors = require('cors');
// app.use(cors({ origin: true, credentials: true }));

// 1. BODY PARSER (limit artırıldı: screenshot base64 için)
app.use(express.json({ limit: '6mb' }));
// (İstersen ayrıca form-data için multer ekleyebilirsin; şimdilik gerek yok)
app.use(express.urlencoded({ extended: true }));
// 2. Feedback Route (DOSYA KONUMUNA DİKKAT)
// Eğer feedbackRoute.js kökteyse:
const feedbackRoute = require('./feedbackRoute');
// Eğer server/feedback-route.js diye klasöre taşırsan:
// const feedbackRoute = require('./server/feedback-route');
app.use('/api', feedbackRoute); 

// 3. Diğer API Routerları
const llmProxy = require('./llm-proxy');    
const photogetProxy = require('./photoget-proxy');

app.use('/llm-proxy', llmProxy);
app.use('/photoget-proxy', photogetProxy);

// 4. Basit health / status endpoint
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    envMailConfigured: !!process.env.FEEDBACK_FROM_EMAIL
  });
});

// 5. Test endpoint (isteğe bağlı)
app.get('/test-root', (req, res) => {
  res.json({ message: 'Root test OK' });
});

// 6. Statik dosyalar
app.use(express.static(path.join(__dirname, 'public')));

// 7. API 404 yakalayıcı (yalnızca /api altı için – feedbackRoute vs. sonrası)
// Bunu static'ten ÖNCE koyma; yoksa index.html engellenir. API’lerin ardından:
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'not_found' });
});

// 8. SPA fallback (EN SONA KOY)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 9. Genel hata yakalayıcı (express next(err) ile gelenler)
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Feedback email configured:', !!process.env.FEEDBACK_FROM_EMAIL);
});