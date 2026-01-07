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

router.post('/clicked-ai', async (req, res) => {
    const { point, city, lat, lng, facts } = req.body;
    
    // 1. POINT-AI MANTIĞI (TEMİZLENMİŞ)
   // Backend prompt ve veri hazırlığı
const getPointInfo = async () => {
    // Veriyi temizle ve koordinat odaklı hale getir
    const cleanFacts = { 
        latitude: lat, 
        longitude: lng, 
        full_address_context: city 
    };
    
    if (facts) {
        Object.keys(facts).forEach(k => {
            if (facts[k] && facts[k] !== 'unknown' && typeof facts[k] !== 'object') {
                cleanFacts[k] = facts[k];
            }
        });
    }
    const factsJson = JSON.stringify(cleanFacts);

const prompt = `Task: Local Neighborhood Expert. Language: English.
Place: "${point}"
Specific Location: "${city}" (Coordinates: ${lat}, ${lng})

STRICT RULES FOR CONTENT:
1. "p1": You MUST mention the specific city or district from "${city}" in the description. Do NOT use vague terms like "this region" or "this city". Be specific (e.g., "Located in Antalya's ${city.split(',')[0]} area..."). 
2. Write 2 sentences about the place's vibe. If you don't know the specific history of "${point}", describe it based on its real-world location on Tonguç Caddesi/Antalya context.
3. "p2": Give a practical local tip. If you don't have one, leave it empty "".
4. NO placeholders (e.g., [insert...]), NO "Global" word.
5. NO robotic phrases like "Located in the heart of...". Talk like a local who lives there.

Return ONLY JSON: {"p1": "...", "p2": "..."}`;

    try {
        const response = await axios.post('http://127.0.0.1:11434/api/chat', {
            model: "llama3:8b",
            messages: [{ role: "user", content: prompt }],
            stream: false, 
            format: "json", 
            options: { 
                temperature: 0.3, // Biraz daha yaratıcı ama kontrollü
                num_predict: 200,
                top_p: 0.9
            }
        }, { timeout: 25000 });

        let content = response.data?.message?.content || "{}";
        const result = JSON.parse(content);

        // Final Temizlik: Eğer AI yine de placeholder sızdırdıysa temizle
        if (result.p1 && result.p1.includes('[')) result.p1 = result.p1.replace(/\[.*?\]/g, '').trim();
        if (result.p2 && result.p2.includes('[')) result.p2 = "";

        return result;
    } catch (err) { 
        return { 
            p1: `Discover the local charm of ${point || 'this location'} in ${city || 'this area'}.`, 
            p2: "" 
        }; 
    }
};

    // 2. NEARBY MANTIĞI
    const getNearby = async () => {
        const apiKey = process.env.GEOAPIFY_KEY;
        const fetchCat = async (cat, rad) => {
            try {
                const url = `https://api.geoapify.com/v2/places?categories=${cat}&filter=circle:${lng},${lat},${rad}&bias=proximity:${lng},${lat}&limit=5&apiKey=${apiKey}`;
                const resp = await axios.get(url, { timeout: 10000 });
                return (resp.data?.features || [])
                    .filter(f => f.properties && f.properties.name && f.properties.name !== point)
                    .slice(0, 2).map(f => ({ name: f.properties.name, facts: f.properties }));
            } catch (e) { return []; }
        };
        const [s, n, h] = await Promise.all([
            fetchCat('administrative.area.city', 15000),
            fetchCat('natural', 20000),
            fetchCat('tourism', 25000)
        ]);
        return { settlement: s, nature: n, historic: h };
    };

    try {
        const [aiResult, nearbyResult] = await Promise.all([getPointInfo(), getNearby()]);
        res.json({ ...aiResult, nearby: nearbyResult });
    } catch (e) {
        res.status(500).json({ error: "Fetch failed" });
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