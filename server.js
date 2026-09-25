const fs = require('fs'); 
const express = require('express');
const path = require('path');
const fetch = require('node-fetch');

// [YENİ] Sunucu her başladığında benzersiz bir versiyon ID'si oluşturur.
const BUILD_ID = Date.now().toString();

try {
    // Burada fs'i tekrar tanımlama, yukarıdakini kullan
    console.log('[startup] process.cwd():', process.cwd());
    console.log('[startup] .env exists:', fs.existsSync('./.env'));
    require('dotenv').config({ path: __dirname + '/.env' });
} catch (e) {
    console.warn('[startup] dotenv not loaded:', e.message);
}

const app = express();

// 1. BODY PARSER (limit artırıldı: screenshot base64 için)
app.use(express.json({ limit: '6mb' }));
app.use(express.urlencoded({ extended: true }));


// localCities.js'yi kullan
const { getSuggestions } = require('./localCities.js');

app.get('/api/cities', (req, res) => {
    try {
        const query = req.query.q ? req.query.q.trim() : "";
        console.log(`[API] Original query: "${query}"`);
        
        if (!query || query.length < 2) return res.json([]);
        
        // Türkçe karakter normalizasyonu
        const normalizeForSearch = (text) => {
            if (!text) return '';
            return text
                .toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // tüm aksanları kaldır
                .replace(/ı/g, 'i')
                .replace(/ğ/g, 'g')
                .replace(/ü/g, 'u')
                .replace(/ş/g, 's')
                .replace(/ö/g, 'o')
                .replace(/ç/g, 'c');
        };
        
        const normalizedQuery = normalizeForSearch(query);
        console.log(`[API] Normalized for search: "${normalizedQuery}"`);
        
        // Tüm veriyi al ve normalize et
        const allStates = require('country-state-city').State.getAllStates();
        const allCities = require('country-state-city').City.getAllCities();
        
        const allData = [
            ...allStates.map(s => ({ 
                ...s, 
                type: 'state',
                searchName: normalizeForSearch(s.name)
            })),
            ...allCities.map(c => ({ 
                ...c, 
                type: 'city',
                searchName: normalizeForSearch(c.name)
            }))
        ];
        
        // Filtrele: normalize edilmiş isimde aranan kelime geçiyor mu?
        const results = allData
            .filter(item => item.searchName.includes(normalizedQuery))
            .slice(0, 10)
            .map(item => ({
                name: item.name,
                countryCode: item.countryCode,
                latitude: item.latitude,
                longitude: item.longitude,
                type: item.type
            }));
        
        console.log(`[API] Found ${results.length} results for "${query}"`);
        res.json(results);
        
    } catch (err) {
        console.error("[API] Error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 2. Feedback Route
const feedbackRoute = require('./feedbackRoute');
app.use('/api', feedbackRoute);

// 3. AI Router'larını doğrudan ana seviyede bağlayalım
const planSummaryRouter = require('./plan-summary');
const clickedAiRouter = require('./clicked-ai');
const chatStreamRouter = require('./chat-stream');

console.log('Chat stream router yüklendi mi?', typeof chatStreamRouter);
console.log('Chat stream router methods:', Object.keys(chatStreamRouter));

// Direkt endpoint olarak tanımla
app.use('/plan-summary', planSummaryRouter);
app.use('/clicked-ai', clickedAiRouter);
app.use('/chat-stream', chatStreamRouter);
console.log('Chat stream endpoint registered at /chat-stream');

 
// Diğer API Routerları
const photogetProxy = require('./photoget-proxy');
app.use('/photoget-proxy', photogetProxy);

const geoapify = require('./geoapify.js');

app.get('/api/geoapify/nearby-cities', async (req, res) => {
  try {
    const { lat, lon, radius, limit } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat/lon required' });
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
  console.log('[geocode] incoming text:', text, 'limit:', limit);
  const apiKey = process.env.GEOAPIFY_KEY;
  if (!apiKey) return res.status(500).send('Geoapify API key missing');
  if (!text) return res.status(400).json({ error: 'text parameter missing' });
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

app.get('/api/tile/:z/:x/:y.pbf', async (req, res) => {
  const { z, x, y } = req.params;
  const url = `https://tiles.openfreemap.org/planet/20251112_001001_pt/${z}/${x}/${y}.pbf`;
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://triptime.ai/"
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
        "Referer": "https://triptime.ai/"
      }
    });
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



app.post('/api/elevation', async (req, res) => {
    // locations parametresi array mi string mi kontrolü
    const coords = Array.isArray(req.body.locations)
        ? req.body.locations
        : (typeof req.body.locations === 'string' ? req.body.locations.split('|').filter(Boolean) : []);

    const ELEVATION_BASE = process.env.ELEVATION_BASE || 'http://127.0.0.1:9000';
    try {
        const batchSize = 100;
        const resultsAll = [];

        for (let i = 0; i < coords.length; i += batchSize) {
            const batch = coords.slice(i, i + batchSize).join('|'); // dış servise eski formatta gönder
            const url = `${ELEVATION_BASE}/api/elevation?locations=${batch}`;

            const response = await fetch(url, { timeout: 15000 });

            if (!response.ok) {
                throw new Error(`Elevation API error: ${response.status}`);
            }

            const result = await response.json();

            if (result && Array.isArray(result.results)) {
                // DEBUG: İlk 3 değeri logla
                console.log(`[Elevation DEBUG] Batch elevations:`,
                    result.results.slice(0, 3).map(r => r.elevation));

                resultsAll.push(...result.results);
            } else {
                throw new Error('Invalid response format from elevation API');
            }
        }

        // ELEVATION KALİTE KONTROLÜ
        const elevations = resultsAll.map(r => r.elevation).filter(e => e != null);

        if (elevations.length === 0) {
            console.warn('[Elevation] Tüm elevation değerleri null!');
            return res.status(500).json({
                error: 'No elevation data received',
                results: resultsAll
            });
        }

        // Tüm değerler aynı mı kontrol et
        const uniqueElevations = [...new Set(elevations.map(e => Math.round(e)))];

        if (uniqueElevations.length <= 2) { // 1-2 farklı değer varsa
            console.warn(`[Elevation] Çok az farklı elevation değeri:`, uniqueElevations);

            // DÜZELTME: Eğer tüm değerler ~aynıysa, varyasyon ekle
            if (uniqueElevations.length === 1 && coords.length > 10) {
                console.log('[Elevation] Tüm elevation değerleri aynı, varyasyon ekleniyor...');

                const baseElevation = uniqueElevations[0];
                const variedResults = resultsAll.map((r, index) => ({
                    ...r,
                    elevation: baseElevation + (Math.sin(index * 0.1) * 10) // Hafif varyasyon
                }));

                return res.json({
                    results: variedResults,
                    source: 'opentopodata',
                    adjusted: true
                });
            }
        }

        // Normal response
        res.json({
            results: resultsAll,
            source: 'opentopodata',
            elevation_stats: {
                min: Math.min(...elevations),
                max: Math.max(...elevations),
                unique_values: uniqueElevations.length,
                sample: elevations.slice(0, 5)
            }
        });

    } catch (error) {
        console.error('[Elevation] Error:', error);

        // FALLBACK: Koordinat sayısına göre rastgele elevation üret
        const fallbackResults = coords.map((coord, index) => {
            const [lat, lon] = coord.split(',').map(Number);
            // Bölgeye göre ortalama elevation
            let base = 50; // default
            if (lat > 40 && lat < 42 && lon > 28 && lon < 30) base = 60; // Istanbul
            if (lat > 29 && lat < 30 && lon > 34 && lon < 36) base = 6;  // Aqaba

            return {
                latitude: lat,
                longitude: lon,
                elevation: base + (Math.sin(index * 0.3) * 20) // Varyasyon
            };
        });

        res.json({
            results: fallbackResults,
            source: 'fallback',
            error: error.message
        });
    }
});

// --- KENDİ LİNK KISALTMA SERVİSİMİZ (DB Gerektirmez) ---
const shortUrlsFile = path.join(__dirname, 'shorturls.json');

// 1. Kısaltma Oluşturma (POST)
app.post('/api/shorten', (req, res) => {
    try {
        const { longUrl, title, city, description, imageUrl } = req.body;
        const shortId = Math.random().toString(36).substring(2, 8);
        
        let data = {};
        if (fs.existsSync(shortUrlsFile)) {
            const fileContent = fs.readFileSync(shortUrlsFile, 'utf8');
            data = fileContent ? JSON.parse(fileContent) : {};
        }
        
        // Metadata ile birlikte kaydet
        data[shortId] = {
            longUrl,
            title: title || 'My Trip Plan',
            city: city || 'Amazing Destination',
            description: description || 'Check out this trip plan created with Triptime AI!',
            imageUrl: imageUrl || null,
            createdAt: Date.now()
        };
        
        fs.writeFileSync(shortUrlsFile, JSON.stringify(data, null, 2));
        
        const host = req.get('host');
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        res.json({ shortUrl: `${protocol}://${host}/s/${shortId}` });
    } catch (e) {
        console.error('[Shorten Error]', e);
        res.status(500).json({ error: 'Shorten failed' });
    }
});
// 2. Yönlendirme (GET /s/id) - DİKKAT: Bunu 'express.static' satırından önceye koy
// 2. Yönlendirme (GET /s/id) - Twitter bot için özel yanıt
// 2. Yönlendirme (GET /s/id) - Twitter bot için özel yanıt
app.get('/s/:id', (req, res) => {
    try {
        const shortId = req.params.id;
        console.log(`1. [${shortId}] İstek alındı, User-Agent:`, req.headers['user-agent']);
        
        // Dosya var mı kontrol et
        console.log(`2. [${shortId}] shortUrls.json yolu:`, shortUrlsFile);
        console.log(`3. [${shortId}] Dosya var mı?`, fs.existsSync(shortUrlsFile));
        
        if (!fs.existsSync(shortUrlsFile)) {
            console.log(`4. [${shortId}] DOSYA YOK! Ana sayfaya yönlendiriliyor`);
            return res.redirect('/');
        }
        
        // Dosyayı oku
        const fileContent = fs.readFileSync(shortUrlsFile, 'utf8');
        console.log(`5. [${shortId}] Dosya okundu, boyut:`, fileContent.length, 'byte');
        console.log(`6. [${shortId}] Dosya içeriği (ilk 100 karakter):`, fileContent.substring(0, 100));
        
        // JSON parse et
        const data = JSON.parse(fileContent);
        console.log(`7. [${shortId}] JSON parse edildi, kayıt sayısı:`, Object.keys(data).length);
        
        // Kaydı bul
        const record = data[shortId];
        console.log(`8. [${shortId}] Kayıt bulundu mu?`, !!record);
        
        if (!record) {
            console.log(`9. [${shortId}] KAYIT YOK! Mevcut ID'ler:`, Object.keys(data).join(', '));
            return res.redirect('/');
        }
        
        console.log(`10. [${shortId}] Kayıt tipi:`, typeof record);
        console.log(`11. [${shortId}] Kayıt içeriği:`, JSON.stringify(record).substring(0, 200));
        
        const longUrl = typeof record === 'string' ? record : record.longUrl;
        console.log(`12. [${shortId}] longUrl:`, longUrl);
        
        const ua = req.headers['user-agent'] || '';
        const isTwitterBot = ua.includes('Twitterbot') || 
                            ua.includes('twitterbot') || 
                            ua.toLowerCase().includes('twitter');
        
        console.log(`13. [${shortId}] Twitter bot mu?`, isTwitterBot);
        
        // Twitter bot için özel HTML döndür
        if (typeof record === 'object' || isTwitterBot) {
            const { title, city, description, imageUrl, createdAt } = typeof record === 'object' ? record : {};
            
            console.log(`14. [${shortId}] Metadata - title:`, title, 'city:', city);
            
            // Varsayılan görsel
            const defaultImage = `https://triptime.ai/img/share_og.png?v=${BUILD_ID}`;
            const ogImage = imageUrl || defaultImage;
            
            // Görselin tam URL olduğundan emin ol
            const fullImageUrl = ogImage.startsWith('http') ? ogImage : `https://triptime.ai${ogImage}`;
            
            const ogTitle = title ? `${title} - Triptime AI` : 'Trip Plan - Triptime AI';
            const ogDesc = description || (city ? `Explore this ${city} trip plan created with Triptime AI!` : 'Check out this trip plan created with Triptime AI!');
            const canonicalUrl = `https://triptime.ai/s/${shortId}`;
            
            console.log(`15. [${shortId}] OG başlık:`, ogTitle);
            console.log(`16. [${shortId}] OG görsel:`, fullImageUrl);
            
            // Twitter bot için cache kontrolü
             res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            
            console.log(`17. [${shortId}] HTML gönderiliyor...`);
            
            return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${ogTitle}</title>
  
<!-- Open Graph (property format) -->
<meta property="og:title" content="${ogTitle}">
<meta property="og:description" content="${ogDesc}">
<meta property="og:image" content="${fullImageUrl}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:type" content="website">

<!-- Twitter Card (BOTH name AND property formats) -->
<meta name="twitter:card" content="summary_large_image">
<meta property="twitter:card" content="summary_large_image">

<meta name="twitter:site" content="@triptimeai">
<meta property="twitter:site" content="@triptimeai">

<meta name="twitter:title" content="${ogTitle}">
<meta property="twitter:title" content="${ogTitle}">

<meta name="twitter:description" content="${ogDesc}">
<meta property="twitter:description" content="${ogDesc}">

<meta name="twitter:image" content="${fullImageUrl}">
<meta property="twitter:image" content="${fullImageUrl}">
  
  <meta http-equiv="refresh" content="0;url=${longUrl}">
</head>
<body>
  <p>Redirecting...</p>
</body>
</html>`);
        }
        
        console.log(`18. [${shortId}] String kayıt, direkt yönlendirme:`, longUrl);
        return res.redirect(302, longUrl);
        
    } catch (e) {
        console.error(`[${req.params.id}] HATA:`, e);
        res.redirect('/');
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


app.use(express.static(
  path.join(__dirname, 'public'),
  {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store');
      } else {
        // CSS / JS / image
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  }
));

// 7. API 404 yakalayıcı (yalnızca /api altı için – feedbackRoute vs. sonrası)
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'not_found' });
});

// 8. SPA fallback (index.html servisi)
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  
  fs.readFile(indexPath, 'utf8', (err, htmlData) => {
    if (err) {
      console.error('Error reading index.html:', err);
      return res.status(500).send('Error loading page');
    }

    // 1. Versiyonu Bas
    const versionedHtml = htmlData.replace(/__BUILD__/g, BUILD_ID);
    
    // 2. Browser Önbelleğini ÖLDÜREN Headerlar (Kesin Çözüm)
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // 3. ETag ve Last-Modified Başlıklarını SİL
    res.removeHeader('ETag');
    res.removeHeader('Last-Modified');

    res.send(versionedHtml);
  });
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

const PORT = process.env.PORT || 3004;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Feedback email configured:', !!process.env.FEEDBACK_FROM_EMAIL);

});