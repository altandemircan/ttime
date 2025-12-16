const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// --- AYARLAR ---
const CACHE_FILE = path.join(__dirname, 'ai_cache.json');

// --- 1. BAŞLANGIÇTA VARSA ESKİ CACHE'İ YÜKLE ---
let aiCache = {};
if (fs.existsSync(CACHE_FILE)) {
    try {
        const rawData = fs.readFileSync(CACHE_FILE, 'utf8');
        aiCache = JSON.parse(rawData);
        console.log(`[Startup] ${Object.keys(aiCache).length} adet kayıt diskten yüklendi.`);
    } catch (e) {
        console.error("[Startup] Cache dosyası bozuktu, sıfırdan başlandı.");
        aiCache = {};
    }
}

// Helper: Diske Kaydetme Fonksiyonu
function saveCacheToDisk() {
    // Sadece tamamlanmış (done) verileri kaydet, promise'leri kaydetme
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

    const cacheKey = country ? `${city}-${country}` : city;
    console.log(`[AI Request] ${cacheKey}`);

    // 1. KONTROL: Zaten var mı?
    if (aiCache[cacheKey]) {
        // A) İşlem bitmiş (Disk'ten veya RAM'den geldi)
        if (aiCache[cacheKey].status === 'done') {
            console.log(`[Cache Hit] ${cacheKey} hazır.`);
            return res.json(aiCache[cacheKey].data);
        }

        // B) İşlem şu an sürüyor (RAM'de Promise var)
        if (aiCache[cacheKey].status === 'pending' && aiCache[cacheKey].promise) {
            console.log(`[Cache Wait] ${cacheKey} bekleniyor...`);
            try {
                const data = await aiCache[cacheKey].promise;
                return res.json(data);
            } catch (error) {
                delete aiCache[cacheKey]; // Hata varsa sil ki tekrar denensin
            }
        }
    }

    // 2. YENİ İŞLEM BAŞLAT (Arka Plan Görevi)
    const processingPromise = (async () => {
        const aiReqCity = country ? `${city}, ${country}` : city;
        const prompt = `
        You are an expert travel guide. 
        For the city "${aiReqCity}", provide specific travel insights ONLY in ENGLISH.
        Respond ONLY with a valid JSON object matching this structure:
        {
          "summary": "A captivating 1-sentence overview.",
          "tip": "One specific insider tip.",
          "highlight": "The single most unmissable landmark."
        }
        If unknown, put "Info not available."
        `.trim();

        console.log(`[AI Start] ${cacheKey} için Ollama'ya gidiliyor...`);

        const response = await axios.post('http://127.0.0.1:11434/api/chat', {
            model: "gemma:2b",
            messages: [{ role: "user", content: prompt }],
            stream: false,
            max_tokens: 200
        });

        // JSON Parse
        let jsonText = '';
        if (typeof response.data === 'object' && response.data.message) {
            jsonText = response.data.message.content;
        } else if (typeof response.data === 'string') {
            const match = response.data.match(/\{[\s\S]*?\}/);
            if (match) jsonText = match[0];
        }

        return JSON.parse(jsonText);
    })();

    // 3. PENDING OLARAK İŞARETLE
    aiCache[cacheKey] = {
        status: 'pending',
        promise: processingPromise
    };

    // 4. SONUCU BEKLE VE DİSKE YAZ
    try {
        const result = await processingPromise;
        
        // Veriyi güncelle
        aiCache[cacheKey] = {
            status: 'done',
            data: result
        };

        // DİSKE KALICI OLARAK YAZ
        saveCacheToDisk();
        console.log(`[AI Saved] ${cacheKey} diske yazıldı.`);

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json(result);

    } catch (error) {
        console.error(`[AI Error] ${cacheKey}:`, error.message);
        delete aiCache[cacheKey]; // Hatalı kaydı sil
        res.status(500).json({ error: 'AI Error' });
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

    const model = 'gemma:2b';

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