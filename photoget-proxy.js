require('dotenv').config(); // .env dosyasını okumak için gerekli
const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

// API anahtarlarını artık process.env üzerinden alıyoruz
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

// GET /photoget-proxy?query=...&source=pexels|pixabay
router.get('/', async (req, res) => {
    const { query, source = 'pexels' } = req.query;
    if (!query) return res.status(400).json({ error: 'Query is required.' });

    // Anahtarlar yoksa hata ver
    if (!PEXELS_API_KEY || !PIXABAY_API_KEY) {
        console.error("API Keys missing in .env file");
        return res.status(500).json({ error: 'Server configuration error.' });
    }

    try {
        let imageUrl = null;

        if (source === 'pexels') {
            const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5`;
            const response = await fetch(url, {
                headers: { Authorization: PEXELS_API_KEY }
            });
            const data = await response.json();
            if (data.photos && data.photos.length > 0) {
                const randomPhoto = data.photos[Math.floor(Math.random() * data.photos.length)];
                imageUrl = randomPhoto.src.medium || randomPhoto.src.large || randomPhoto.src.tiny || randomPhoto.src.small || randomPhoto.src.original;
            }
        } else if (source === 'pixabay') {
            const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&image_type=photo&per_page=10&safesearch=true`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.hits && data.hits.length > 0) {
                const randomHit = data.hits[Math.floor(Math.random() * data.hits.length)];
                imageUrl = randomHit.webformatURL || randomHit.largeImageURL;
            }
        }

        if (imageUrl) {
            res.json({ imageUrl });
        } else {
            res.json({ imageUrl: null, error: 'No image found.' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message || 'API error' });
    }
});


// 2. SLIDER ENDPOINT (Pixabay Öncelikli)
router.get('/slider', async (req, res) => {
    let { query, source = 'pixabay', count = 5, page = 1 } = req.query;
    
    // API KEY KONTROLÜ
    if (!PIXABAY_API_KEY) {
        console.error("[Proxy Error] PIXABAY_API_KEY tanımlı değil! .env dosyasını kontrol edin.");
        return res.status(500).json({ error: 'Server config error: API Key missing' });
    }

    console.log(`[Proxy Slider] İstek: ${query} | Kaynak: ${source}`);

    // Yardımcı: Pixabay İsteği
    const fetchFromPixabay = async () => {
        try {
            const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&image_type=photo&per_page=${count}&page=${page}&safesearch=true`;
            console.log(`[Pixabay Req] URL: ${url.replace(PIXABAY_API_KEY, 'HIDDEN_KEY')}`); // Loglarda key gizli kalsın
            
            const response = await fetch(url);
            
            if (!response.ok) {
                const errText = await response.text();
                console.error(`[Pixabay API Error] Status: ${response.status} - ${errText}`);
                return null;
            }

            const data = await response.json();
            console.log(`[Pixabay Res] Bulunan görsel sayısı: ${data.totalHits}`);
            
            return (data.hits || []).map(hit => hit.largeImageURL || hit.webformatURL);
        } catch (e) {
            console.error("[Pixabay Network Error]:", e.message);
            return null;
        }
    };

    try {
        let images = [];

        // SADECE PIXABAY DENE
        if (source === 'pixabay') {
            const pixabayResult = await fetchFromPixabay();
            
            if (pixabayResult === null) {
                return res.status(500).json({ error: 'Pixabay API failed. Check server console.' });
            }
            
            if (pixabayResult.length === 0) {
                console.log("[Pixabay] Sonuç boş döndü.");
            }
            
            images = pixabayResult;

        } else if (source === 'pexels') {
             // Pexels kodları buraya eklenebilir
             // Şimdilik boş bırakıldı
        }
        
        res.json({ images });

    } catch (err) {
        console.error("Slider Proxy Fatal Error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;