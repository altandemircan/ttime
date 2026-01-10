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
        const activeModel = "qwen:14b"; // Kullandığın model ismini buraya yaz
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
            const response = await axios.post('http://127.0.0.1:11434/api/generate', {
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
      const prompt = `[STRICT GUIDELINES - BE PRECISE AND FACTUAL]
    1. ROLE: You are a professional local tour guide with deep knowledge of the area.
    2. POINT: "${point}"
    3. LOCATION: "${cleanCity || 'this location'}"
    4. CATEGORY: ${cleanCategory}
    5. AVAILABLE FACTS: ${JSON.stringify(cleanFacts)}

    [OUTPUT REQUIREMENTS]
    - Return ONLY valid JSON: {"p1": "text", "p2": "text"}
    - "p1": Exactly 2 informative sentences about this place.
    - "p2": 1 practical tip or recommendation (or empty string if none).

    [CONTENT RULES]
    - ALWAYS mention "${cleanCity.split(',')[0]}" in p1 if city is provided.
    - NEVER mention postal codes, zip codes, or administrative codes.
    - Focus on: atmosphere, local significance, architectural style, typical visitors.
    - If specific info is unknown, describe typical features of a ${cleanCategory} in ${cleanCity.split(',')[0]}.
    - Use natural, engaging language but stay factual.
    - Avoid generic phrases like "is a place" or "is located".
    - Do NOT invent names, dates, or events unless in facts.
    - For nature spots: mention landscape, flora/fauna, activities.
    - For businesses: mention typical offerings, ambiance, clientele.
    - For historical sites: mention period, significance, preservation.
    - Tips (p2): practical advice like "Visit early to avoid crowds" or "Try the local specialty".

    [EXAMPLE FORMAT]
    Good: {"p1": "This historic cafe in Beyoglu has been serving traditional Turkish coffee since 1950. Its antique decor and central location make it popular with both locals and tourists.", "p2": "Try their signature Turkish delight with the coffee."}
    Bad: {"p1": "This is a cafe. It is located in Istanbul.", "p2": ""}

    Now generate for: ${point} in ${cleanCity} (${cleanCategory})`;

    // Mesajları birleştir: system + diğer geçmiş
    const messages = [
        { role: "system", content: prompt },
        ...userMessages.filter(msg => msg.role !== "system") // frontend'den gelen system'ı at!
    ];

    const model = 'qwen:14b';

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

router.post('/clicked-ai', async (req, res) => {
    const { point, city } = req.body;

    const prompt = `You are a travel writer.
Write a sensory, non-generic 2-sentence description about "${point}" in "${city}".
Return ONLY valid JSON: {"p1": "First sentence", "p2": "Local tip"}
`;

    try {
        const response = await axios.post('http://127.0.0.1:11434/api/generate', {
            model: "qwen:14b",
            prompt: prompt,
            stream: false,
            options: {
                temperature: 0.5,
                top_p: 0.9,
                repeat_penalty: 1.1,
                num_predict: 120
            }
        }, { timeout: 30000 });

        let content = response.data?.response
            || response.data?.message?.content
            || "{}";

        // Sadece ilk {...} JSON'u parse et, başka hiçbir şey yapma
        const jsonMatch = content.match(/\{[\s\S]*?\}/);
        let result = { p1: "", p2: "" };
        if (jsonMatch) result = JSON.parse(jsonMatch[0]);

        res.json(result);
    } catch (e) {
        console.error("AI error:", e.message);
        res.json({ p1: "", p2: "" });
    }
}); 

module.exports = router;