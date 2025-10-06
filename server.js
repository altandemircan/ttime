// --- dotenv safe load ---
try {
  require('dotenv').config({ /* quiet: true */ });
  console.log('[startup] dotenv loaded');
} catch (e) {
  console.warn('[startup] dotenv not loaded:', e.code || e.message);
}

const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const app = express();

// 1. BODY PARSER (limit artırıldı: screenshot base64 için)
app.use(express.json({ limit: '6mb' }));
app.use(express.urlencoded({ extended: true }));

// 2. Feedback Route (DOSYA KONUMUNA DİKKAT)
const feedbackRoute = require('./feedbackRoute');
app.use('/api', feedbackRoute);

// 3. Diğer API Routerları
const llmProxy = require('./llm-proxy');
const photogetProxy = require('./photoget-proxy');
const mapBox = require("./mapBox");

app.use('/llm-proxy', llmProxy);
app.use('/photoget-proxy', photogetProxy);

// 3.b MAPBOX ENDPOINTLERİ
// Directions endpoint
app.get("/api/mapbox/directions", async (req, res) => {
  const { coordinates, profile, alternatives, overview, geometries } = req.query;
  try {
    const data = await mapBox.directions({
      coordinates,
      profile: profile || "walking",
      alternatives: alternatives || false,
      overview: overview || "full",
      geometries: geometries || "geojson"
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Geocoding endpoint (isteğe bağlı)
app.get("/api/mapbox/geocode", async (req, res) => {
  const { query, limit } = req.query;
  try {
    const data = await mapBox.geocode({ query, limit: limit ? parseInt(limit) : 5 });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// MAPBOX TILE PROXY ENDPOINT (asıl önemli kısım)
app.get('/api/mapbox/tiles/:style/:z/:x/:y.png', async (req, res) => {
  const { style, z, x, y } = req.params;
  const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
  if (!MAPBOX_TOKEN) {
    return res.status(500).send('Mapbox token not configured');
  }
  const tileUrl = `https://api.mapbox.com/styles/v1/mapbox/${style}/tiles/256/${z}/${x}/${y}@2x?access_token=${MAPBOX_TOKEN}`;
  try {
    const response = await fetch(tileUrl);
    if (!response.ok) {
      return res.status(response.status).send('Mapbox tile error');
    }
    res.set('Content-Type', 'image/png');
    response.body.pipe(res);
  } catch (e) {
    res.status(500).send('Tile proxy error');
  }
});

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

// 7. API 404 yakalayıcı (yalnızca /api altı için – feedbackRoute vs. sonrası)
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