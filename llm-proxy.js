const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// --- AYARLAR ---
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
    // Sadece tamamlanmış verileri kaydet
    const dataToSave = {};
    for (const key in aiCache) {
        if (aiCache[key].status === 'done') {
            dataToSave[key] = aiCache[key];
        }
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(dataToSave, null, 2));
}

// --- ENDPOINT ---
router.post('/plan-summary', async (req, res) => {
    const { city, country } = req.body;
    if (!city) {
        res.status(400).send('City is required');
        return;
    }

    // Anahtar oluştur (Örn: "Rome-Italy")
    const cacheKey = country ? `${city}-${country}` : city;
    console.log(`[AI REQ] ${cacheKey}`);

    // 1. KONTROL: Cache'de var mı?
    if (aiCache[cacheKey]) {
        // A) Hazırsa hemen ver
        if (aiCache[cacheKey].status === 'done') {
            return res.json(aiCache[cacheKey].data);
        }
        // B) Şu an başkası için hazırlanıyorsa bekle
        if (aiCache[cacheKey].status === 'pending' && aiCache[cacheKey].promise) {
            try {
                const data = await aiCache[cacheKey].promise;
                return res.json(data);
            } catch (error) {
                delete aiCache[cacheKey];
            }
        }
    }

    // 2. YENİ İŞLEM BAŞLAT (Burayı güncelliyoruz)
    const processingPromise = (async () => {
        const aiReqCity = country ? `${city}, ${country}` : city;
         
        // --- DEĞİŞİKLİK BURADA BAŞLIYOR ---
        const activeModel = "llama3:8b"; // Kullandığın model ismini buraya yaz
        console.log(`[AI START] Model: ${activeModel} | City: ${aiReqCity}`); // Konsola yazdırır

        const prompt = `
        You are a strictly factual travel guide. 
        Provide specific travel insights for the city "${aiReqCity}" ONLY in ENGLISH.
        RULES:
        1. Do NOT hallucinate. If unknown, state "Info not available".
        2. Verify landmarks are INSIDE "${aiReqCity}".
        3. Respond ONLY with a valid JSON object:
        { "summary": "...", "tip": "...", "highlight": "..." }
        `.trim();

        try {
            const response = await axios.post('http://127.0.0.1:11434/api/chat', {
                model: activeModel, // Yukarıdaki değişkeni kullanıyoruz
                messages: [{ role: "user", content: prompt }],
                stream: false,
                format: "json",
                options: {
                    temperature: 0.1, // Llama 3 için düşük sıcaklık önemli
                    top_p: 0.9,
max_tokens: 200
                }
            });

            // JSON Temizleme (Ollama format:json ile gelirse direkt parse edilebilir ama önlem kalsın)
            let jsonText = '';
            if (typeof response.data === 'object' && response.data.message) {
                jsonText = response.data.message.content;
            } else if (typeof response.data === 'string') {
                const match = response.data.match(/\{[\s\S]*?\}/);
                if (match) jsonText = match[0];
            }

            return JSON.parse(jsonText);
        } catch (err) {
            console.error("LLM Error:", err.message);
            // Hata durumunda boş dön ki cache patlamasın
            return { summary: "Info unavailable.", tip: "Info unavailable.", highlight: "Info unavailable." };
        }
    })();

    // 3. PENDING OLARAK İŞARETLE
    aiCache[cacheKey] = {
        status: 'pending',
        promise: processingPromise
    };

    // 4. BEKLE VE KAYDET
    try {
        const result = await processingPromise;
        
        aiCache[cacheKey] = {
            status: 'done',
            data: result
        };
        saveCacheToDisk(); // Kalıcı kaydet
        console.log(`[AI DONE] ${cacheKey} tamamlandı.`);

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json(result);

    } catch (error) {
        console.error(`[AI ERROR] ${cacheKey}:`, error.message);
        delete aiCache[cacheKey];
        res.status(500).json({ error: 'AI Error' });
    }
});


// --- ENDPOINT: POINT AI INFO (2 paragraphs, no labels) ---
router.post('/point-ai-info', async (req, res) => {
    const { point, city, country, facts } = req.body;

    if (!point || !city) {
        res.status(400).send('point and city are required');
        return;
    }

    const norm = (v) => (typeof v === "string" ? v.trim() : "");
    const aiPoint = norm(point);
    const aiCity = norm(city);
    const aiCountry = norm(country);

    const cacheKey = `POINTAI:${aiPoint}__${aiCity}${aiCountry ? `__${aiCountry}` : ""}`;

    if (aiCache[cacheKey]) {
        if (aiCache[cacheKey].status === 'done') return res.json(aiCache[cacheKey].data);
        if (aiCache[cacheKey].status === 'pending' && aiCache[cacheKey].promise) {
            try { return res.json(await aiCache[cacheKey].promise); } catch { delete aiCache[cacheKey]; }
        }
    }

    const processingPromise = (async () => {
        const activeModel = "llama3:8b";
        const context = aiCountry ? `${aiCity}, ${aiCountry}` : aiCity;
        const factsJson = JSON.stringify(facts || {}).slice(0, 3500);

        const prompt = `
            ENGLISH only. Factual travel guide.
            POINT: "${aiPoint}"
            CITY: "${context}"
            FACTS: ${factsJson}
            Return ONLY JSON: {"p1":"Description paragraph", "p2":"Practical info (phone, website, hours) as a single string"}.
            If info is missing, use "Info not available".
        `.trim();

        try {
            const response = await axios.post('http://127.0.0.1:11434/api/chat', {
                model: activeModel,
                messages: [{ role: "user", content: prompt }],
                stream: false,
                format: "json",
                options: { temperature: 0.1, num_predict: 180 }
            }, { timeout: 40000 });

            let content = response.data?.message?.content || "{}";
            let parsed = {};
            try {
                parsed = JSON.parse(content);
            } catch (e) {
                const match = content.match(/\{[\s\S]*\}/);
                if (match) parsed = JSON.parse(match[0]);
            }
            
            // [object Object] hatasını KESİN önleyen güvenli çevirici
            const safeString = (val) => {
                if (val === null || val === undefined) return "Info not available.";
                if (typeof val === 'object') {
                    return Object.entries(val).map(([k, v]) => `${k}: ${v}`).join(", ") || "Info not available.";
                }
                const s = String(val).trim();
                return (s === "" || s.toLowerCase() === "undefined") ? "Info not available." : s;
            };

            return {
                p1: safeString(parsed.p1),
                p2: safeString(parsed.p2)
            };
        } catch (err) {
            return { p1: "Info not available.", p2: "Info not available." };
        }
    })();

    aiCache[cacheKey] = { status: 'pending', promise: processingPromise };
    try {
        const result = await processingPromise;
        aiCache[cacheKey] = { status: 'done', data: result };
        saveCacheToDisk();
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json(result);
    } catch (error) {
        delete aiCache[cacheKey];
        res.status(500).json({ error: 'AI Error' });
    }
});

// --- ENDPOINT: NEARBY AI (geoapify places + ai for 3 nearest items) ---
router.post('/nearby-ai', async (req, res) => {
    const { lat, lng, city, country } = req.body;
    if (typeof lat !== 'number' || typeof lng !== 'number') return res.status(400).send('lat/lng required');

    const cacheKey = `NEARBYAI:${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (aiCache[cacheKey] && aiCache[cacheKey].status === 'done') return res.json(aiCache[cacheKey].data);

    const processingPromise = (async () => {
        const GEOAPIFY_KEY = process.env.GEOAPIFY_KEY;
        if (!GEOAPIFY_KEY) return { settlement: null, nature: null, historic: null };

        const proximity = `${lng},${lat}`; // lon,lat formatı

        const fetchPlaces = async (categories) => {
            try {
                const url = `https://api.geoapify.com/v2/places?categories=${categories}&filter=circle:${proximity},25000&bias=proximity:${proximity}&limit=1&apiKey=${GEOAPIFY_KEY}`;
                const r = await axios.get(url, { timeout: 12000 });
                const f = r.data?.features?.[0];
                if (!f) return null;
                return { 
                    name: f.properties.name || f.properties.city || f.properties.formatted || "Nearby Place", 
                    formatted: f.properties.formatted || "" 
                };
            } catch (e) { return null; }
        };

        const [s, n, h] = await Promise.all([
            fetchPlaces("place.city,place.town,place.suburb,place.village"),
            fetchPlaces("natural,leisure.park,beach"),
            fetchPlaces("historic,heritage,tourism.attraction,tourism.museum")
        ]);

        const askAI = async (typeLabel, item) => {
            if (!item) return { item: null, ai: { p1: "Info not available." } };
            
            // YEDEK (Fallback): AI hata verirse Geoapify'dan gelen adresi göster
            const fallbackContent = item.formatted || item.name || "Location found nearby.";

            try {
                const prompt = `Briefly describe "${item.name}" in "${city}" as a ${typeLabel}. English. Max 25 words. JSON: {"p1":"..."}`;
                const response = await axios.post('http://127.0.0.1:11434/api/chat', {
                    model: "llama3:8b",
                    messages: [{ role: "user", content: prompt }],
                    stream: false, format: "json",
                    options: { temperature: 0.1, num_predict: 100 }
                }, { timeout: 20000 });
                
                let content = response.data?.message?.content || "{}";
                let parsed = JSON.parse(content);
                const aiResult = (parsed.p1 && typeof parsed.p1 === 'string') ? parsed.p1.trim() : fallbackContent;
                
                return { item, ai: { p1: aiResult } };
            } catch (e) { 
                // AI hata verirse veya timeout olursa Geoapify bilgisini döndür
                return { item, ai: { p1: fallbackContent } }; 
            }
        };

        // Ollama'yı yormamak için AI isteklerini sırayla (sequential) yapıyoruz
        const settlementAI = await askAI("Settlement", s);
        const natureAI = await askAI("Nature Area", n);
        const historicAI = await askAI("Historic Site", h);

        return { settlement: settlementAI, nature: natureAI, historic: historicAI };
    })();

    aiCache[cacheKey] = { status: 'pending', promise: processingPromise };
    try {
        const result = await processingPromise;
        aiCache[cacheKey] = { status: 'done', data: result };
        saveCacheToDisk();
        res.json(result);
    } catch (error) {
        res.status(200).json({ settlement: null, nature: null, historic: null });
    }
});

// Chat stream (SSE) endpoint
router.get('/chat-stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let finished = false;

    // Tüm mesaj geçmişini frontendden al
    let userMessages = [];
    try {
        userMessages = JSON.parse(req.query.messages || "[]");
    } catch (e) {
        userMessages = [];
    }

    // System prompt'u her zaman en başa ekle!
const systemPrompt = `
You are a friendly and knowledgeable travel assistant.
Help users discover and plan trips by providing clear, concise, and useful information about destinations, activities, food, transportation, hotels, and local tips.
Give brief answers (maximum 150 characters) unless more detail is requested.
If asked about something unrelated to travel, politely say you only answer travel-related questions.
`;  

    // Mesajları birleştir: system + diğer geçmiş
    const messages = [
        { role: "system", content: systemPrompt },
        ...userMessages.filter(msg => msg.role !== "system") // frontend'den gelen system'ı at!
    ];

    const model = 'llama3:8b';

    try {
        const ollama = await axios({
            method: 'post',
            url: 'http://127.0.0.1:11434/api/chat',
            data: {
                model,
                messages,
                stream: true,
                max_tokens: 200 // Yanıtın 300 karakteri geçmemesi için yeterli
            },
            responseType: 'stream',
            timeout: 180000 // 3 dakika
        });

        ollama.data.on('data', chunk => {
            if (finished) return;
            const str = chunk.toString().trim();
            if (str) {
                res.write(`data: ${str}\n\n`);
            }
        });

        ollama.data.on('end', () => {
            if (!finished) {
                finished = true;
                res.write('event: end\ndata: [DONE]\n\n');
                res.end();
            }
        });

        ollama.data.on('error', (err) => {
            if (!finished) {
                finished = true;
                res.write(`event: error\ndata: ${err.message}\n\n`);
                res.end();
            }
        });

        req.on('close', () => {
            if (!finished) {
                finished = true;
                res.end();
            }
        });
    } catch (error) {
        finished = true;
        res.write(`event: error\ndata: ${error.message}\n\n`);
        res.end();
    }
});

module.exports = router;