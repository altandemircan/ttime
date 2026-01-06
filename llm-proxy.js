const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const CACHE_FILE = path.join(__dirname, 'ai_cache_db.json');

let aiCache = {};
if (fs.existsSync(CACHE_FILE)) {
    try {
        const rawData = fs.readFileSync(CACHE_FILE, 'utf8');
        aiCache = JSON.parse(rawData);
    } catch (e) { aiCache = {}; }
}

function saveCacheToDisk() {
    const dataToSave = {};
    for (const key in aiCache) {
        if (aiCache[key].status === 'done') dataToSave[key] = aiCache[key];
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(dataToSave, null, 2));
}

// --- ENDPOINT: PLAN SUMMARY ---
router.post('/plan-summary', async (req, res) => {
    const { city, country } = req.body;
    if (!city) return res.status(400).send('City is required');
    const cacheKey = country ? `${city}-${country}` : city;

    if (aiCache[cacheKey] && aiCache[cacheKey].status === 'done') return res.json(aiCache[cacheKey].data);

    try {
        const prompt = `Travel guide JSON: {"summary":"...", "tip":"...", "highlight":"..."}. City: ${city}, ${country || ''}`;
        const response = await axios.post('http://127.0.0.1:11434/api/chat', {
            model: "llama3:8b",
            messages: [{ role: "user", content: prompt }],
            stream: false, format: "json", options: { temperature: 0.1 }
        }, { timeout: 45000 });
        const result = JSON.parse(response.data.message.content || "{}");
        aiCache[cacheKey] = { status: 'done', data: result };
        saveCacheToDisk();
        res.json(result);
    } catch (err) { res.json({ summary: "Info unavailable.", tip: "", highlight: "" }); }
});

// --- ENDPOINT: POINT AI INFO ---
router.post('/point-ai-info', async (req, res) => {
    const { point, city, country, facts } = req.body;
    if (!point) return res.status(400).send('point required');

    const cacheKey = `POINTAI:${point}__${city}`;
    if (aiCache[cacheKey] && aiCache[cacheKey].status === 'done') return res.json(aiCache[cacheKey].data);

    try {
        const factsJson = JSON.stringify(facts || {}).slice(0, 3000);
        const prompt = `ENGLISH only. Return JSON: {"p1":"description", "p2":"practical info"}. POINT: "${point}", CITY: "${city}". FACTS: ${factsJson}`;
        const response = await axios.post('http://127.0.0.1:11434/api/chat', {
            model: "llama3:8b",
            messages: [{ role: "user", content: prompt }],
            stream: false, format: "json", options: { temperature: 0.1, num_predict: 180 }
        }, { timeout: 45000 });
        
        const parsed = JSON.parse(response.data.message.content || "{}");
        const ensureStr = (v) => {
            if (!v) return "";
            if (typeof v === 'object') return JSON.stringify(v).replace(/[{}"]/g, ' ');
            return String(v).trim();
        };
        const result = { p1: ensureStr(parsed.p1), p2: ensureStr(parsed.p2) };
        aiCache[cacheKey] = { status: 'done', data: result };
        saveCacheToDisk();
        res.json(result);
    } catch (err) { res.json({ p1: "Info not available.", p2: "" }); }
});

// --- ENDPOINT: NEARBY AI (SADECE GEOAPIFY VERİSİ - AI YOK) ---
router.post('/nearby-ai', async (req, res) => {
    const { lat, lng } = req.body;
    const GEOAPIFY_KEY = process.env.GEOAPIFY_KEY;
    if (!GEOAPIFY_KEY) return res.json({ settlement: null, nature: null, historic: null });

    const fetchPlaces = async (cats) => {
        try {
            const url = `https://api.geoapify.com/v2/places?categories=${cats}&filter=circle:${lng},${lat},25000&bias=proximity:${lng},${lat}&limit=1&apiKey=${GEOAPIFY_KEY}`;
            const r = await axios.get(url, { timeout: 10000 });
            const f = r.data?.features?.[0]?.properties;
            if (!f) return null;
            return { name: f.name || f.city || f.suburb || f.formatted, facts: f };
        } catch (e) { return null; }
    };

    try {
        const [s, n, h] = await Promise.all([
            fetchPlaces("place.city,place.town,place.suburb,place.village"),
            fetchPlaces("natural,leisure.park,beach"),
            fetchPlaces("historic,heritage,tourism.attraction,tourism.museum")
        ]);
        res.json({ settlement: s, nature: n, historic: h });
    } catch (e) { res.json({ settlement: null, nature: null, historic: null }); }
});

router.get('/chat-stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    try {
        const userMessages = JSON.parse(req.query.messages || "[]");
        const ollama = await axios({
            method: 'post', url: 'http://127.0.0.1:11434/api/chat',
            data: { model: 'llama3:8b', messages: [{role:"system", content:"Travel assistant"}, ...userMessages], stream: true },
            responseType: 'stream'
        });
        ollama.data.on('data', c => res.write(`data: ${c.toString()}\n\n`));
        ollama.data.on('end', () => { res.write('event: end\ndata: [DONE]\n\n'); res.end(); });
    } catch (e) { res.end(); }
});

module.exports = router;