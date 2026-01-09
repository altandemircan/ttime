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

    // POSTA KODU ve GEREKSİZ BİLGİLERİ TEMİZLEME FONKSİYONU
    const cleanFactsData = (facts) => {
        const cleanFacts = { 
            latitude: lat, 
            longitude: lng,
            place_type: "place"
        };
        
        // Anahtar kelimeleri kontrol et (cafe, restaurant, museum vb.)
        const typeKeywords = ['category', 'type', 'class', 'kind'];
        let foundType = "place";
        
        if (facts) {
            Object.keys(facts).forEach(k => {
                const value = facts[k];
                
                // Posta kodu (postcode, postal_code, zip) ve gereksiz alanları atla
                if (k.toLowerCase().includes('post') || 
                    k.toLowerCase().includes('zip') ||
                    k.toLowerCase().includes('code') ||
                    k === 'country_code' ||
                    k === 'countrycode' ||
                    k === 'osm_id' ||
                    k === 'datasource' ||
                    k === 'place_id') {
                    return;
                }
                
                // Tür/ kategori bilgisini bul
                if (typeKeywords.includes(k.toLowerCase()) && value && value !== 'unknown') {
                    foundType = value;
                }
                
                // Diğer yararlı bilgileri ekle
                if (value && value !== 'unknown' && typeof value !== 'object' && value.toString().trim() !== '') {
                    // Adres parçalarını kontrol et (posta kodları içermesin)
                    if (typeof value === 'string') {
                        const postalCodePattern = /\b\d{5}\b|\b\d{4}\s?[A-Z]{2}\b/i;
                        if (postalCodePattern.test(value)) {
                            return;
                        }
                    }
                    cleanFacts[k] = value;
                }
            });
        }
        
        // Kategoriyi temizle ve standardize et
        const rawCategory = foundType.replace(/\./g, ' ').toUpperCase();
        const categoryMap = {
            'CAFE': 'cafe',
            'RESTAURANT': 'restaurant', 
            'HOTEL': 'hotel',
            'MUSEUM': 'museum',
            'PARK': 'park',
            'HOSPITAL': 'hospital',
            'SHOP': 'shop',
            'MARKET': 'market',
            'BAKERY': 'bakery',
            'PHARMACY': 'pharmacy',
            'UNIVERSITY': 'university',
            'SCHOOL': 'school',
            'CHURCH': 'church',
            'MOSQUE': 'mosque',
            'TEMPLE': 'temple',
            'BEACH': 'beach',
            'LAKE': 'lake',
            'MOUNTAIN': 'mountain',
            'CASTLE': 'castle',
            'HISTORICAL': 'historical site',
            'ARCHAEOLOGICAL': 'archaeological site'
        };
        
        const cleanCategory = categoryMap[rawCategory] || rawCategory.toLowerCase();
        cleanFacts.place_type = cleanCategory;
        
        // Şehir bilgisini temizle (posta kodlarını çıkar)
        let cleanCity = city || "";
        if (cleanCity) {
            const postalCodePattern = /\b\d{5}\b|\b\d{4}\s?[A-Z]{2}\b/i;
            cleanCity = cleanCity.replace(postalCodePattern, '').replace(/,\s*,/g, ',').trim();
            cleanCity = cleanCity.replace(/^,\s*|\s*,$/g, ''); // Baştaki/sondaki virgülleri temizle
        }
        
        cleanFacts.full_address_context = cleanCity;
        
        return { cleanFacts, cleanCategory, cleanCity };
    };

    const getPointInfo = async () => {
        const { cleanFacts, cleanCategory, cleanCity } = cleanFactsData(facts || {});
        
        // DAHA KALİTELİ PROMPT YAPISI
       const prompt = `Task: Act as a local guide. Return JSON only.
Data: ${point}, ${cleanCity.split(',')[0]}, ${cleanCategory}.
Facts: ${JSON.stringify(cleanFacts)}

Format: {"p1": "sentence1. sentence2.", "p2": "tip"}

Rules:
- p1: 2 sentences about atmosphere/significance in ${cleanCity.split(',')[0]}.
- p2: 1 short tip.
- No postal codes. No generic "is a place" filler.

Example: {"p1": "This authentic ${cleanCategory} captures the vibrant spirit of ${cleanCity.split(',')[0]} with its unique local charm. Visitors often praise the welcoming atmosphere and its central role in the neighborhood.", "p2": "Best visited during late afternoon for the best view."}`;

        try {
            const response = await axios.post('http://127.0.0.1:11434/api/chat', {
                model: "gemma2:9b",
                messages: [{ role: "user", content: prompt }],
                stream: false, 
                format: "json", 
                options: { 
                    temperature: 0.1, // Biraz yaratıcılık ama fazla değil
                    num_predict: 80,
                    top_k: 10,
                    top_p: 0.9,
                    repeat_penalty: 1.1
                }
            }, { timeout: 30000 });

            let content = response.data?.message?.content || "{}";
            
            // JSON temizliği
            try {
                // JSON dışı karakterleri temizle
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) content = jsonMatch[0];
                
                const result = JSON.parse(content);
                
                // Placeholder ve gereksiz ifadeleri temizle
                if (result.p1) {
                    result.p1 = result.p1
                        .replace(/\[.*?\]/g, '')
                        .replace(/\(.*?\)/g, '')
                        .replace(/\b(?:postal code|zip code|post code)\s*\d*/gi, '')
                        .replace(/this is a\s+/gi, '')
                        .replace(/\s+\./g, '.')
                        .replace(/\.\./g, '.')
                        .trim();
                    
                    // Cümle sayısını kontrol et
                    const sentences = result.p1.split(/[.!?]+/).filter(s => s.trim().length > 0);
                    if (sentences.length !== 2) {
                        // Cümleleri ayarla
                        if (sentences.length > 2) {
                            result.p1 = sentences.slice(0, 2).join('. ') + '.';
                        } else if (sentences.length === 1) {
                            result.p1 = sentences[0] + '. This ' + cleanCategory + ' offers a local experience in ' + cleanCity.split(',')[0] + '.';
                        }
                    }
                }
                
                if (result.p2) {
                    result.p2 = result.p2
                        .replace(/\[.*?\]/g, '')
                        .replace(/note:/gi, '')
                        .replace(/tip:/gi, '')
                        .replace(/recommendation:/gi, '')
                        .trim();
                    
                    if (result.p2.toLowerCase().includes('unknown') || 
                        result.p2.length < 10 || 
                        result.p2.toLowerCase().includes('no specific')) {
                        result.p2 = "";
                    }
                }
                
                return result;
                
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                // Fallback response
                const cityName = cleanCity.split(',')[0] || 'the area';
                return { 
                    p1: `This ${cleanCategory} in ${cityName} offers local character and atmosphere. It serves as a notable spot for both residents and visitors exploring ${cityName}.`, 
                    p2: "" 
                };
            }
            
        } catch (err) { 
            console.error('AI API error:', err);
            const cityName = (cleanCity || city || '').split(',')[0] || 'the area';
            return { 
                p1: `Explore the local atmosphere of this ${cleanCategory} in ${cityName}. The spot offers a glimpse into daily life and the surrounding area.`, 
                p2: "" 
            }; 
        }
    };

    // 2. NEARBY MANTIĞI (Aynı kalabilir)
    const getNearby = async () => {
        const apiKey = process.env.GEOAPIFY_KEY;
        const fetchCat = async (cat, rad) => {
            try {
                const url = `https://api.geoapify.com/v2/places?categories=${cat}&filter=circle:${lng},${lat},${rad}&bias=proximity:${lng},${lat}&limit=5&apiKey=${apiKey}`;
                const resp = await axios.get(url, { timeout: 10000 });
                return (resp.data?.features || [])
                    .filter(f => f.properties && f.properties.name && f.properties.name !== point)
                    .slice(0, 2).map(f => ({ 
                        name: f.properties.name, 
                        facts: f.properties,
                        lat: f.properties.lat,
                        lon: f.properties.lon
                    }));
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
        
        // Yanıtı iyileştir
        const enhancedResult = {
            ...aiResult,
            nearby: nearbyResult,
            metadata: {
                point: point,
                city: cleanFactsData(facts || {}).cleanCity,
                category: cleanFactsData(facts || {}).cleanCategory,
                coordinates: { lat, lng }
            }
        };
        
        res.json(enhancedResult);
    } catch (e) {
        console.error('Overall fetch failed:', e);
        res.status(500).json({ 
            error: "Fetch failed",
            p1: `Discover this location in ${city ? city.split(',')[0] : 'the area'}.`, 
            p2: "" 
        });
    }
});

module.exports = router;