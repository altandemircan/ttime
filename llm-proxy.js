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
    if (aiCache[cacheKey]) {
        if (aiCache[cacheKey].status === 'done') return res.json(aiCache[cacheKey].data);
        if (aiCache[cacheKey].status === 'pending' && aiCache[cacheKey].promise) {
            try { return res.json(await aiCache[cacheKey].promise); } catch (error) { delete aiCache[cacheKey]; }
        }
    }
    const processingPromise = (async () => {
        const aiReqCity = country ? `${city}, ${country}` : city;
        const prompt = `Factual travel guide for "${aiReqCity}". JSON ONLY: { "summary": "...", "tip": "...", "highlight": "..." }`;
        try {
            const response = await axios.post('http://127.0.0.1:11434/api/chat', {
                model: "llama3:8b",
                messages: [{ role: "user", content: prompt }],
                stream: false, format: "json", options: { temperature: 0.1 }
            }, { timeout: 45000 });
            return JSON.parse(response.data?.message?.content || "{}");
        } catch (err) { return { summary: "Info unavailable.", tip: "", highlight: "" }; }
    })();
    aiCache[cacheKey] = { status: 'pending', promise: processingPromise };
    try {
        const result = await processingPromise;
        aiCache[cacheKey] = { status: 'done', data: result };
        saveCacheToDisk();
        res.json(result);
    } catch (error) { res.status(500).json({ error: 'AI Error' }); }
});

// --- ENDPOINT: POINT AI INFO (GÜNCELLENDİ) ---
router.post('/point-ai-info', async (req, res) => {
    const { point, city, country, facts } = req.body;
    if (!point || !city) return res.status(400).send('point and city required');

    const cacheKey = `POINTAI:${point}__${city}`;
    if (aiCache[cacheKey] && aiCache[cacheKey].status === 'done') return res.json(aiCache[cacheKey].data);

    const processingPromise = (async () => {
        const factsJson = JSON.stringify(facts || {}).slice(0, 3500);
        const prompt = `ENGLISH only. POINT: "${point}", CITY: "${city}". FACTS: ${factsJson}. Return ONLY JSON: {"p1":"description", "p2":"practical info"}.`;
        try {
            const response = await axios.post('http://127.0.0.1:11434/api/chat', {
                model: "llama3:8b",
                messages: [{ role: "user", content: prompt }],
                stream: false, format: "json", options: { temperature: 0.1, num_predict: 180 }
            }, { timeout: 45000 });
            
            const content = response.data?.message?.content || "{}";
            const parsed = JSON.parse(content);

            const ensureStr = (v) => {
                if (!v) return "Info not available.";
                if (typeof v === 'object') return JSON.stringify(v).replace(/[{}"]/g, ' ');
                return String(v).trim();
            };
            return { p1: ensureStr(parsed.p1), p2: ensureStr(parsed.p2) };
        } catch (err) { return { p1: "Info not available.", p2: "Info not available." }; }
    })();

    aiCache[cacheKey] = { status: 'pending', promise: processingPromise };
    try {
        const result = await processingPromise;
        aiCache[cacheKey] = { status: 'done', data: result };
        saveCacheToDisk();
        res.json(result);
    } catch (e) { res.status(500).json({ error: "AI Error" }); }
});



// backend'de (express route)
router.post('/api/geoapify/places-nearby', async (req, res) => {
    const { lat, lng } = req.body;
    const GEOAPIFY_KEY = process.env.GEOAPIFY_KEY;
    
    try {
        // 1. Yerleşim yeri
        const settlementUrl = `https://api.geoapify.com/v2/places?categories=place.city,place.town,place.village&filter=circle:${lng},${lat},20000&limit=1&apiKey=${GEOAPIFY_KEY}`;
        
        // 2. Doğa
        const natureUrl = `https://api.geoapify.com/v2/places?categories=natural,leisure.park,beach&filter=circle:${lng},${lat},20000&limit=1&apiKey=${GEOAPIFY_KEY}`;
        
        // 3. Tarihi
        const historicUrl = `https://api.geoapify.com/v2/places?categories=historic,heritage,tourism.attraction&filter=circle:${lng},${lat},20000&limit=1&apiKey=${GEOAPIFY_KEY}`;
        
        const [settlementRes, natureRes, historicRes] = await Promise.all([
            axios.get(settlementUrl).catch(() => null),
            axios.get(natureUrl).catch(() => null),
            axios.get(historicUrl).catch(() => null)
        ]);
        
        const places = [];
        
        // Yerleşim yeri
        if (settlementRes?.data?.features?.[0]) {
            const props = settlementRes.data.features[0].properties;
            places.push({
                name: props.name || "Nearby village",
                type: "settlement"
            });
        }
        
        // Doğa
        if (natureRes?.data?.features?.[0]) {
            const props = natureRes.data.features[0].properties;
            places.push({
                name: props.name || "Nature area",
                type: "nature"
            });
        }
        
        // Tarihi
        if (historicRes?.data?.features?.[0]) {
            const props = historicRes.data.features[0].properties;
            places.push({
                name: props.name || "Historic site",
                type: "historic"
            });
        }
        
        res.json({ places });
    } catch (error) {
        res.json({ places: [] });
    }
});

// --- CHAT STREAM (DOKUNULMADI) ---
router.get('/chat-stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    try {
        const userMessages = JSON.parse(req.query.messages || "[]");
        const ollama = await axios({
            method: 'post', url: 'http://127.0.0.1:11434/api/chat',
            data: { model: 'llama3:8b', messages: [{role:"system", content:"Travel assistant"}, ...userMessages], stream: true },
            responseType: 'stream'
        });
        ollama.data.on('data', chunk => res.write(`data: ${chunk.toString()}\n\n`));
        ollama.data.on('end', () => { res.write('event: end\ndata: [DONE]\n\n'); res.end(); });
    } catch (e) { res.end(); }
});

module.exports = router;