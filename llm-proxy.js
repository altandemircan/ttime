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


// --- ENDPOINT: NEARBY AI (GÜÇLENDİRİLMİŞ VERSİYON) ---
// --- ENDPOINT: NEARBY AI (DEBUG VERSİYONU) ---
router.post('/nearby-ai', async (req, res) => {
    const { lat, lng } = req.body;
    console.log('------------------------------------------------');
    console.log(`[NEARBY DEBUG] İstek geldi: Lat: ${lat}, Lng: ${lng}`);

    // 1. Koordinat ve API Key Kontrolü
    if (!lat || !lng) {
        console.error('[NEARBY DEBUG] HATA: Koordinatlar eksik!');
        return res.json({ settlement: null, nature: null, historic: null });
    }

    const apiKey = process.env.GEOAPIFY_KEY;
    if (!apiKey) {
        console.error('[NEARBY DEBUG] HATA: .env dosyasında GEOAPIFY_KEY bulunamadı!');
        return res.json({ settlement: null, nature: null, historic: null });
    }

    // 2. Yardımcı Fonksiyon (Detaylı Loglama ile)
    const fetchCategory = async (catName, categories, radius = 20000) => {
        try {
            // URL oluşturma
            const url = `https://api.geoapify.com/v2/places`;
            const params = {
                categories: categories,
                filter: `circle:${lng},${lat},${radius}`,
                bias: `proximity:${lng},${lat}`,
                limit: 3,
                apiKey: apiKey
            };

            console.log(`[NEARBY DEBUG] ${catName} aranıyor...`);
            
            // Axios ile istek at (Timeout süresini artırdık)
            const response = await axios.get(url, { params, timeout: 10000 });
            
            const features = response.data?.features || [];
            console.log(`[NEARBY DEBUG] ${catName} sonuç sayısı: ${features.length}`);

            // İsmi olan ilk geçerli yeri bul
            const validPlace = features.find(f => f.properties && (f.properties.name || f.properties.formatted));

            if (validPlace) {
                const pName = validPlace.properties.name || validPlace.properties.formatted;
                console.log(`[NEARBY DEBUG] ✅ ${catName} BULUNDU: ${pName}`);
                return {
                    name: pName,
                    facts: validPlace.properties
                };
            }
            
            console.warn(`[NEARBY DEBUG] ⚠️ ${catName} için sonuç döndü ama isimli yer yok.`);
            return null;

        } catch (error) {
            // HATA DETAYINI YAKALA
            if (error.response) {
                // Sunucu cevap verdi ama hata kodu (401, 400, 500 vb.)
                console.error(`[NEARBY DEBUG] ❌ ${catName} API Hatası: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            } else if (error.request) {
                // İstek gitti ama cevap gelmedi (Network hatası)
                console.error(`[NEARBY DEBUG] ❌ ${catName} Ağ Hatası (Cevap yok):`, error.message);
            } else {
                // Kod hatası
                console.error(`[NEARBY DEBUG] ❌ ${catName} Kod Hatası:`, error.message);
            }
            return null;
        }
    };

    try {
        // 3. Paralel Sorgular
        // Kategorileri biraz daha genelleştirdim ki kesin sonuç dönsün
        const [settlement, nature, historic] = await Promise.all([
            fetchCategory("Settlement", "place", 15000), // Tüm 'place' kategorisi
            fetchCategory("Nature", "natural,leisure.park,beach", 30000), // 30km yarıçap
            fetchCategory("Historic", "historic,tourism,religion", 30000) // 30km yarıçap
        ]);

        const result = { settlement, nature, historic };
        res.json(result);

    } catch (e) {
        console.error('[NEARBY DEBUG] Genel Promise Hatası:', e);
        res.status(500).json({ error: e.message });
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