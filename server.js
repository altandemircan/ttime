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

app.use('/llm-proxy', llmProxy);
app.use('/photoget-proxy', photogetProxy);

const geoapify = require('./geoapify.js');

// --- YENİ: /api/geoapify/nearby-cities endpoint’i ---
app.get('/api/geoapify/nearby-cities', async (req, res) => {
  try {
    const { lat, lon, radius, limit } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat/lon gerekli' });
    const data = await geoapify.nearbyCities({
      lat,
      lon,
      radius: radius ? parseInt(radius) : 80000,
      limit: limit ? parseInt(limit) : 10
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- EKLENEN ENDPOINT --- //
app.get('/api/geoapify/geocode', async (req, res) => {
  const { text, limit } = req.query;
  console.log('[geocode] gelen text:', text, 'limit:', limit);
  const apiKey = process.env.GEOAPIFY_KEY;
  if (!apiKey) return res.status(500).send('Geoapify API key eksik');
  if (!text) return res.status(400).json({ error: 'text parametresi eksik' });
  const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(text)}&limit=${limit || 1}&apiKey=${apiKey}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: 'Geoapify error', detail: errorText });
    }
    res.set('Access-Control-Allow-Origin', '*');
    res.json(await response.json());
  } catch (e) {
    res.status(500).json({ error: 'Proxy error', detail: e.message });
  }
});

// --- BURAYA EKLE --- //

// OpenFreeMap TILE PROXY:
// OpenFreeMap VECTOR TILE PROXY (GÜNCEL "planet/20251112_001001_pt" dataset!)

app.get('/api/tile/:z/:x/:y.pbf', async (req, res) => {
  const { z, x, y } = req.params;
  // DOĞRU YOL - planet versiyonunu burada kullan!
  const url = `https://tiles.openfreemap.org/planet/20251112_001001_pt/${z}/${x}/${y}.pbf`;
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://dev.triptime.ai/"
      }
    });
    console.log(`[VECTOR] Proxying: ${url} → Status: ${r.status}`);
    if (!r.ok) return res.status(r.status).send(`Upstream error: ${r.status}`);
    res.set('Content-Type', 'application/x-protobuf');
    res.send(await r.buffer());
  } catch (err) {
    res.status(500).send('Internal proxy error');
  }
});

// Raster tile proxy (OpenFreeMap Natural Earth)
app.get('/api/tile/:z/:x/:y.png', async (req, res) => {
  const { z, x, y } = req.params;
  const url = `https://tiles.openfreemap.org/natural_earth/ne2sr/${z}/${x}/${y}.png`;
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://dev.triptime.ai/"
      }
    });
    // DEBUG
    console.log(`[RASTER] Proxying: ${url} → Status: ${r.status}`);
    if (r.status === 403) return res.status(403).send("Upstream returned 403 Forbidden (rate-limit, IP block, etc)");
    if (r.status === 404) return res.status(404).send("Upstream PNG not found (404)");
    if (!r.ok) return res.status(r.status).send(`Upstream error code: ${r.status}`);
    res.set('Content-Type', 'image/png');
    res.set('Access-Control-Allow-Origin', '*');
    res.send(await r.buffer());
  } catch (err) {
    console.error('[RASTER TILE PROXY ERROR]', err);
    res.status(500).send('Internal proxy error');
  }
});

app.listen(80, () => console.log('Server listening on port 80'));
// --- BURAYA EKLE --- //

// Autocomplete endpoint
app.get('/api/geoapify/autocomplete', async (req, res) => {
  const { q, limit } = req.query;
  try {
    const data = await geoapify.autocomplete(q, limit ? parseInt(limit) : 7);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- YENİ EKLENDİ: /api/geoapify/places ---
app.get('/api/geoapify/places', async (req, res) => {
  try {
    const { categories, lon, lat, radius, limit } = req.query;
    const data = await geoapify.places({
      categories,
      lon,
      lat,
      radius: radius ? parseInt(radius) : 3000,
      limit: limit ? parseInt(limit) : 10
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/elevation', async (req, res) => {
  const { locations } = req.query;

  const ELEVATION_BASE = process.env.ELEVATION_BASE || 'http://127.0.0.1:9000';
  const ELEVATION_DATASET = process.env.ELEVATION_DATASET || 'merit_dem';

  let batchSize = 120; // önce küçük
  try {
    const coords = (locations || "").split('|').filter(Boolean);
    const resultsAll = [];

    for (let i = 0; i < coords.length; i += batchSize) {
      const batch = coords.slice(i, i + batchSize).join('|');
const url = `${ELEVATION_BASE}/api/elevation?locations=${batch}`;
      console.log(`[Elevation BACKEND] Calling: ${url} with ${batch.split('|').length} coords`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 15s
      let response;
      try {
        response = await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        console.warn(`[Elevation] OpenTopoData failed: ${response.status} batch ${batch}`);
        for (let j = i; j < i + batchSize && j < coords.length; j++) {
          resultsAll.push({ elevation: null });
        }
        continue;
      }

      const result = await response.json();
      if (result && Array.isArray(result.results)) {
        resultsAll.push(...result.results);
      } else {
        for (let j = i; j < i + batchSize && j < coords.length; j++) {
          resultsAll.push({ elevation: null });
        }
      }
    }

    res.set('Access-Control-Allow-Origin', '*');
    res.json({ results: resultsAll, source: 'opentopodata' });
  } catch (e) {
    console.error('[Elevation] Error:', e);
    res.status(502).json({ error: 'Elevation API failed.', detail: e.message });
  }
});

app.get('/api/geoapify/reverse', async (req, res) => {
  const { lat, lon } = req.query;
  const apiKey = process.env.GEOAPIFY_KEY;
  const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${apiKey}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return res.status(response.status).send('Geoapify error');
    res.set('Access-Control-Allow-Origin', '*');
    res.json(await response.json());
  } catch (e) {
    res.status(500).send('Proxy error');
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