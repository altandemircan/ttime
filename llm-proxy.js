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
        const activeModel = "gemma2:9b"; // Kullandığın model ismini buraya yaz
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

    const model = 'gemma2:9b';

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
    const { point, city, lat, lng, facts } = req.body;

    // 1. DİNAMİK KATEGORİ ANALİZİ (Şehir isminden bağımsız)
    const extractCategoryInfo = () => {
        // Varsayılan değerler
        let category = "landmark";
        let subDetails = "";

        if (facts) {
            // OSM verisinden en anlamlı etiketi bulmaya çalış
            const keys = ['amenity', 'tourism', 'leisure', 'historic', 'shop', 'building', 'cuisine'];
            
            for (const key of keys) {
                if (facts[key] && facts[key] !== 'yes') {
                    // Örn: amenity="cafe" -> category="cafe"
                    category = facts[key].replace(/_/g, ' ');
                    
                    // Eğer 'cuisine' varsa detaya ekle (Örn: "italian")
                    if (facts.cuisine) subDetails += ` serving ${facts.cuisine.replace(/_/g, ' ')} cuisine`;
                    break;
                }
            }
        }
        
        return { category, subDetails };
    };

    const { category, subDetails } = extractCategoryInfo();
    const cleanCity = city ? city.split(',')[0].trim() : "the area";

    // 2. EVRENSEL PROMPT (Universal Prompt)
    // Şehir ismi veya özel isim geçirmeden, sadece kategoriye odaklanan kurallar.
    const prompt = `# ROLE: Professional Travel Journalist
# TASK: Describe "${point}" in ${cleanCity}.
# CATEGORY: ${category}

# RULES:
1. NEVER start with the name of the place or the city.
2. NEVER use "is a...", "located in...", "popular spot", "operates as".
3. Use sensory language (aromas, sights, sounds, vibes).
4. Sentence 1: Focus on the immediate feeling of being there.
5. Sentence 2: Focus on why a local or traveler would care.

# OUTPUT JSON ONLY:
{
  "p1": "Your 2 sentences here.",
  "p2": "Short tip here."
}`;

    try {
        const response = await axios.post('http://127.0.0.1:11434/api/chat', {
            model: "gemma2:9b", 
            messages: [{ role: "user", content: prompt }],
            stream: false,
            format: "json",
            options: {
                temperature: 0.8, // Daha doğal dil için yüksek sıcaklık
                top_p: 0.9,
                repeat_penalty: 1.2, // Kendini tekrar etmeyi önler
                num_predict: 100 // Kısa ve öz yanıt
            }
        }, { timeout: 12000 });

        let content = response.data?.message?.content || "{}";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) content = jsonMatch[0];
        
        const result = JSON.parse(content);

        // Robotik cevap yakalama filtresi (Son güvenlik önlemi)
        if (result.p1 && (result.p1.includes("operates as") || result.p1.includes("is a place"))) {
             throw new Error("Robotic output detected");
        }

        res.json({
            p1: result.p1 || `${point} is a distinctive ${category} in ${cleanCity}, contributing to the local atmosphere.`,
            p2: result.p2 || "Check local listings for hours.",
            metadata: { generated: true }
        });

    } catch (e) {
        console.error('AI Processing Error:', e.message);
        
        // 3. KATEGORİ BAZLI GENERIC FALLBACK (Yedek)
        // AI çökerse kategoriye göre mantıklı bir İngilizce cümle döndürür.
        const fallbacks = {
            'cafe': `A local spot in ${cleanCity} perfect for enjoying a beverage and taking a moment to relax.`,
            'restaurant': `A dining destination offering a taste of culinary traditions in a comfortable setting.`,
            'park': `An open green space providing a natural escape within the city environment.`,
            'museum': `A cultural institution preserving history and heritage, offering insights into the past.`,
            'shop': `A commercial location contributing to the daily rhythm and trade of the neighborhood.`,
            'hotel': `Accommodation providing hospitality and a base for exploring the surrounding area.`,
            'historic': `A site of historical significance, standing as a testament to the region's past.`
        };

        // Kategori adını içeren en uygun yedeği bul
        let bestFallback = `${point} is a notable location in ${cleanCity}, adding to the character of the neighborhood.`;
        
        Object.keys(fallbacks).forEach(key => {
            if (category.toLowerCase().includes(key)) bestFallback = fallbacks[key];
        });

        res.json({ 
            p1: bestFallback, 
            p2: "Verify opening hours before visiting.",
            error: "fallback_active"
        });
    }
});




module.exports = router;