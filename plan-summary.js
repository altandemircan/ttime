const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const http = require('http');
const router = express.Router();

/* 🔒 KEEP-ALIVE AGENT */
const keepAliveAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 60000,
    maxSockets: 5,
    timeout: 0
});

const CACHE_FILE = path.join(__dirname, 'ai_cache_db.json');

// --- BAŞLANGIÇTA VARSA ESKİ CACHE'İ YÜKLE ---
let aiCache = {};
if (fs.existsSync(CACHE_FILE)) {
    try {
        const rawData = fs.readFileSync(CACHE_FILE, 'utf8');
        aiCache = JSON.parse(rawData);
        console.log(`[AI SERVER] ${Object.keys(aiCache).length} kayıt diskten yüklendi.`);
    } catch (e) {
        aiCache = {};
    }
}

// Helper: Diske Kaydet
function saveCacheToDisk() {
    const dataToSave = {};
    for (const key in aiCache) {
        if (aiCache[key].status === 'done') {
            dataToSave[key] = aiCache[key];
        }
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(dataToSave, null, 2));
}

// --- ENDPOINT ---
router.post('/', async (req, res) => {
    const { city, country } = req.body;
    if (!city) {
        res.status(400).send('City is required');
        return;
    }

    console.log(`[AI PLAN-REQ] city="${city}" country="${country}"`);

    const cacheKey = country ? `${city}-${country}` : city;
    console.log(`[AI REQ] ${cacheKey}`);

    // --- CACHE DOSYASINI TEKRAR OKU + TEMİZLE ---
    let cleanedCache = {};
    if (fs.existsSync(CACHE_FILE)) {
        try {
            cleanedCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
            let cleanedCount = 0;

            for (const key in cleanedCache) {
                if (cleanedCache[key]?.data?.summary === "Info unavailable.") {
                    delete cleanedCache[key];
                    cleanedCount++;
                }
            }

            if (cleanedCount > 0) {
                console.log(`[AI SERVER] ${cleanedCount} bozuk cache kaydı temizlendi.`);
                fs.writeFileSync(CACHE_FILE, JSON.stringify(cleanedCache, null, 2));
            }

            aiCache = cleanedCache;

        } catch (e) {
            console.error('[AI SERVER] Cache bozuk, siliniyor:', e.message);
            aiCache = {};
            try { fs.unlinkSync(CACHE_FILE); } catch {}
        }
    }

    // --- YENİ İŞLEM ---
    const processingPromise = (async () => {
        const aiReqCity = country ? `${city}, ${country}` : city;
        const activeModel = "llama3:8b";

        console.log(`[AI START] Model: ${activeModel} | City: ${aiReqCity}`);

        const prompt = `
You are a strictly factual travel guide.
Provide specific travel insights for the city "${aiReqCity}" ONLY in ENGLISH.
RULES:
1. Do NOT hallucinate. If unknown, state "Info not available".
2. Verify landmarks are INSIDE "${aiReqCity}".
3. Respond ONLY with a valid JSON object:
{ "summary": "...", "tip": "...", "highlight": "..." }
`.trim();

        console.log('[AI] Prompt:', prompt);

        try {
            console.log('[AI] Ollama /api/generate çağrısı yapılıyor...');

            const response = await axios({
                method: 'post',
                url: 'http://127.0.0.1:11434/api/generate',
                httpAgent: keepAliveAgent,
                data: {
                    model: activeModel,
                    prompt,
                    stream: false,
                    format: "json",
                    options: {
                        temperature: 0.1,
                        top_p: 0.9,
                        max_tokens: 200
                    }
                },
                timeout: 0 // ❗ ASLA TIMEOUT OLMAZ
            });

            console.log('[AI] Ollama response status:', response.status);

            let jsonText = response.data?.response || '';

            if (!jsonText) {
                console.log('[AI] Response boş:', response.data);
                throw new Error('Empty AI response');
            }

            try {
                const parsed = JSON.parse(jsonText);
                console.log('[AI] JSON parse başarılı');
                return parsed;
            } catch (err) {
                console.error('[AI] JSON parse hatası:', err.message);
                const match = jsonText.match(/\{[\s\S]*\}/);
                if (match) {
                    return JSON.parse(match[0]);
                }
                throw err;
            }

        } catch (err) {
            console.error("LLM Error:", err.message);
            console.error("LLM Error details:", err.response?.data || 'No response data');
            return {
                summary: "Info unavailable.",
                tip: "Info unavailable.",
                highlight: "Info unavailable."
            };
        }
    })();

    // --- PENDING ---
    aiCache[cacheKey] = {
        status: 'pending',
        promise: processingPromise
    };

    // --- BEKLE ---
    try {
        const result = await processingPromise;

        aiCache[cacheKey] = {
            status: 'done',
            data: result
        };

        saveCacheToDisk();

        console.log(`[AI DONE] ${cacheKey} tamamlandı.`);
        console.log(`[AI PLAN-RESP for city=${city}]`, result);

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json(result);

    } catch (error) {
        console.error(`[AI ERROR] ${cacheKey}:`, error.message);
        delete aiCache[cacheKey];
        res.status(500).json({ error: 'AI Error' });
    }
});

module.exports = router;
