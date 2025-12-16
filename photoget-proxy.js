const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

// API anahtarlarını buraya göm, kodda görünmez!
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || "6ImCnE5JqwodPohCUGrjLidyyay3nVxBNs8cfTWmM4QxhotFpIORSgkJ";
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY || "5665396-cecac079f1dc817f19e65bb40";

// GET /photoget-proxy?query=...&source=pexels|pixabay
router.get('/', async (req, res) => {
    const { query, source = 'pexels' } = req.query;
    if (!query) return res.status(400).json({ error: 'Query is required.' });

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


// --- YENİ EKLENEN KISIM (SLIDER İÇİN ÇOKLU RESİM) ---
// GET /photoget-proxy/slider?query=...&count=5
router.get('/slider', async (req, res) => {
    const { query, source = 'pexels', count = 5 } = req.query; // Varsayılan 5 resim
    if (!query) return res.status(400).json({ error: 'Query is required.' });

    try {
        let images = [];

        if (source === 'pexels') {
            // Pexels'ten 'count' kadar resim çekiyoruz
            const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}`;
            const response = await fetch(url, {
                headers: { Authorization: PEXELS_API_KEY }
            });
            const data = await response.json();
            
            if (data.photos && data.photos.length > 0) {
                // Rastgele seçmek yerine hepsini listeye ekliyoruz
                images = data.photos.map(photo => photo.src.large || photo.src.medium);
            }

        } else if (source === 'pixabay') {
            // Pixabay'den 'count' kadar resim çekiyoruz
            const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&image_type=photo&per_page=${count}&safesearch=true`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.hits && data.hits.length > 0) {
                // Hepsini listeye ekliyoruz
                images = data.hits.map(hit => hit.largeImageURL || hit.webformatURL);
            }
        }

        // Dönen cevap: { images: ["url1", "url2", "url3"...] }
        if (images.length > 0) {
            res.json({ images });
        } else {
            res.json({ images: [], error: 'No images found for slider.' });
        }

    } catch (err) {
        console.error("Slider Proxy Error:", err);
        res.status(500).json({ error: err.message || 'API error' });
    }
});

module.exports = router;