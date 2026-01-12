const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const router = express.Router();

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

    // Anahtar oluştur (Örn: "Rome-Italy")
    const cacheKey = country ? `${city}-${country}` : city;
    console.log(`[AI REQ] ${cacheKey}`);
 
    // 1. KONTROL: Cache'de var mı?
    // --- BAŞLANGIÇTA VARSA ESKİ CACHE'İ YÜKLE ---
let aiCache = {};
if (fs.existsSync(CACHE_FILE)) {
    try {
        const rawData = fs.readFileSync(CACHE_FILE, 'utf8');
        aiCache = JSON.parse(rawData);
        console.log(`[AI SERVER] ${Object.keys(aiCache).length} kayıt diskten yüklendi.`);
        
        // Cache'i temizle: "Info unavailable." içerenleri sil
        let cleanedCount = 0;
        for (const key in aiCache) {
            if (aiCache[key].data && 
                aiCache[key].data.summary === "Info unavailable.") {
                delete aiCache[key];
                cleanedCount++;
            }
        }
        if (cleanedCount > 0) {
            console.log(`[AI SERVER] ${cleanedCount} bozuk cache kaydı temizlendi.`);
            saveCacheToDisk(); // Temizlenmiş cache'i kaydet
        }
    } catch (e) {
        console.error('[AI SERVER] Cache dosyası bozuk, sıfırdan başlatılıyor:', e.message);
        aiCache = {};
        // Bozuk dosyayı sil
        try { fs.unlinkSync(CACHE_FILE); } catch {}
    }
}


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

    // RETRY MEKANİZMASI - 2 deneme
    let lastError;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            console.log(`[AI] Ollama çağrısı (attempt ${attempt})...`);
            const response = await axios.post('http://127.0.0.1:11434/api/generate', {
                model: activeModel,
                prompt: prompt,
                stream: false,
                format: "json",
                options: {
                    temperature: 0.1,
                    top_p: 0.9,
                    max_tokens: 200
                }
            }, {
                timeout: attempt === 1 ? 20000 : 40000 // İlk 20sn, ikinci 40sn
            });

            console.log('[AI] Ollama response status:', response.status);

            let jsonText = '';
            if (response.data && response.data.response) {
                jsonText = response.data.response;
                console.log('[AI] Response.text bulundu:', jsonText);
            }

            // JSON'u parse et
            if (jsonText) {
                try {
                    const parsed = JSON.parse(jsonText);
                    console.log('[AI] JSON parse başarılı:', parsed);
                    return parsed;
                } catch (parseErr) {
                    console.error('[AI] JSON parse hatası:', parseErr.message);
                    const match = jsonText.match(/\{[\s\S]*\}/);
                    if (match) {
                        try {
                            const parsed = JSON.parse(match[0]);
                            console.log('[AI] Regex ile parse edildi:', parsed);
                            return parsed;
                        } catch (e2) {
                            console.error('[AI] Regex parse de başarısız');
                        }
                    }
                }
            }

            console.error('[AI] Boş veya geçersiz yanıt');
            return { summary: "Info unavailable.", tip: "Info unavailable.", highlight: "Info unavailable." };
            
        } catch (err) {
            lastError = err;
            console.error(`[AI] Attempt ${attempt} failed:`, err.message);
            if (attempt < 2) {
                await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5sn bekle
            }
        }
    }

    console.error("LLM Error after retries:", lastError?.message);
    return { summary: "Info unavailable.", tip: "Info unavailable.", highlight: "Info unavailable." };
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
        saveCacheToDisk();
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

module.exports = router;