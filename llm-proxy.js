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
    

router.post('/clicked-ai', async (req, res) => {
    const { point, city, lat, lng, facts } = req.body;

    // 1. DİNAMİK KATEGORİ ANALİZİ (Geliştirilmiş)
    const extractCategoryInfo = () => {
        let category = "landmark";
        let subDetails = "";
        let emotion = "interesting"; // Varsayılan duygu
        
        if (facts) {
            const keys = ['amenity', 'tourism', 'leisure', 'historic', 'shop', 'building', 'cuisine'];
            
            for (const key of keys) {
                if (facts[key] && facts[key] !== 'yes') {
                    category = facts[key].replace(/_/g, ' ');
                    
                    // Kategoriye göre duygu belirle
                    const emotionMap = {
                        'cafe': 'cozy', 'restaurant': 'delicious', 'bar': 'vibrant',
                        'park': 'peaceful', 'museum': 'captivating', 'gallery': 'inspiring',
                        'hotel': 'comfortable', 'shop': 'charming', 'bakery': 'aromatic',
                        'library': 'quiet', 'theatre': 'dramatic', 'cinema': 'entertaining',
                        'pharmacy': 'essential', 'bank': 'secure', 'post_office': 'reliable'
                    };
                    
                    emotion = emotionMap[category] || "interesting";
                    
                    if (facts.cuisine) {
                        subDetails = `specializing in ${facts.cuisine.replace(/_/g, ' ')} cuisine`;
                    }
                    break;
                }
            }
        }
        
        return { category, subDetails, emotion };
    };

    const { category, subDetails, emotion } = extractCategoryInfo();
    const cleanCity = city ? city.split(',')[0].trim() : "the area";

    // 2. GELİŞTİRİLMİŞ PROMPT
    const prompt = `You are a professional travel writer with a keen eye for authentic local experiences.
    
TASK: Write a compelling 2-sentence description about "${point}" in ${cleanCity}.
CATEGORY: ${category} ${subDetails ? `(${subDetails})` : ''}

CRITICAL RULES:
1. NEVER start with "${point}" or "${cleanCity}".
2. NEVER use "is a", "located in", "popular", "famous", "well-known", "operates as".
3. Use vivid sensory language (sights, sounds, smells, atmosphere).
4. First sentence: Immediate sensory experience (what you feel/see/hear/smell when you're there).
5. Second sentence: Why this place matters to locals or travelers.
6. Keep it authentic, avoid generic tourist clichés.
7. Maximum 200 characters total.

OUTPUT FORMAT (JSON only):
{
  "p1": "First sensory sentence here...",
  "p2": "Practical tip or local insight here (max 80 chars)"
}

EXAMPLE for a cafe in Paris:
{
  "p1": "The rich aroma of freshly ground coffee mingles with the soft murmur of conversation, creating an inviting atmosphere perfect for people-watching.",
  "p2": "Try the croissants in the morning when they're still warm from the oven."
}`;

    try {
        // DEĞİŞTİRİLDİ: /api/chat -> /api/generate
        const response = await axios.post('http://127.0.0.1:11434/api/generate', {
            model: "llama3:8b", 
            prompt: prompt,  // DEĞİŞTİRİLDİ: messages -> prompt
            stream: false,
            options: {
                temperature: 0.7,
                top_p: 0.9,
                repeat_penalty: 1.1,
                num_predict: 120
            }
        }, { timeout: 60000 }); // Timeout artırıldı

        // RESPONSE PARSING - DEĞİŞTİRİLDİ
        let content = response.data?.response || "{}";
        
        console.log('[AI RAW RESPONSE]', content);
        
        // JSON extraction
        const jsonMatch = content.match(/\{[\s\S]*?\}(?=\s*(?:\n|$|\}|\{|\[))/);
        if (jsonMatch) {
            content = jsonMatch[0];
        } else {
            // Fallback: Try to extract JSON-like structure
            const p1Match = content.match(/"p1"\s*:\s*"([^"]+)"/);
            const p2Match = content.match(/"p2"\s*:\s*"([^"]+)"/);
            
            if (p1Match && p2Match) {
                content = JSON.stringify({
                    p1: p1Match[1],
                    p2: p2Match[1]
                });
            }
        }
        
        const result = JSON.parse(content);
        
        // QUALITY CHECKS
        const forbiddenPhrases = [
            "is a", "located in", "popular", "famous", "well-known", 
            "operates as", "you can find", "this place is"
        ];
        
        let qualityPass = true;
        forbiddenPhrases.forEach(phrase => {
            if (result.p1?.toLowerCase().includes(phrase)) {
                qualityPass = false;
            }
        });
        
        if (!qualityPass || !result.p1 || result.p1.length < 20) {
            throw new Error("Quality check failed");
        }
        
        // ENHANCE WITH EMOTION
        const enhancedP1 = enhanceWithEmotion(result.p1, emotion);
        const enhancedP2 = result.p2 || `Visit during off-peak hours for a more local experience.`;

        res.json({
            p1: enhancedP1,
            p2: enhancedP2,
            metadata: { 
                generated: true,
                category: category,
                emotion: emotion,
                model: "llama3:8b"
            }
        });

    } catch (e) {
        console.error('AI Processing Error:', e.message);
        
        // IMPROVED FALLBACK (category-specific)
        const fallbacks = {
            'cafe': `The inviting aroma of coffee fills the air as soft chatter creates a cozy atmosphere perfect for lingering over a hot drink.`,
            'restaurant': `Sizzling sounds from the kitchen mix with tantalizing aromas, promising a memorable culinary journey through local flavors.`,
            'park': `Dappled sunlight filters through leaves while the distant sounds of the city fade into peaceful natural surroundings.`,
            'museum': `Silence hangs respectfully in air filled with history, where each exhibit tells a story waiting to be discovered.`,
            'shop': `Carefully curated displays invite browsing, with each item telling a story of local craftsmanship and tradition.`,
            'hotel': `A welcoming ambiance offers respite from exploration, blending comfort with a sense of local character.`,
            'historic': `Whispers of the past seem to echo through aged stones, connecting visitors to generations of stories.`,
            'bar': `Low lighting and lively conversations create an energetic yet intimate setting for evening relaxation.`,
            'bakery': `The irresistible scent of fresh bread and pastries wafts through the air, tempting every passerby.`,
            'market': `A vibrant tapestry of colors, sounds, and scents showcases the authentic rhythm of daily local life.`
        };
        
        // Find best match
        let bestFallback = fallbacks[category] || 
            `An authentic spot in ${cleanCity} where local character and atmosphere create memorable experiences.`;
        
        Object.keys(fallbacks).forEach(key => {
            if (category.toLowerCase().includes(key)) {
                bestFallback = fallbacks[key];
            }
        });
        
        res.json({ 
            p1: bestFallback, 
            p2: "Check local opening times as hours may vary seasonally.",
            metadata: { 
                generated: false,
                fallback: true,
                category: category
            }
        });
    }
});


module.exports = router;