const express = require('express');
const axios = require('axios');
const router = express.Router();

// Artık sadece in-memory (bellek içi) çalışıyoruz. 
// Sunucu restart edildiğinde bu veri sıfırlanır.
let aiCache = {};

// --- ENDPOINT ---
router.post('/', async (req, res) => {
    const { city, country } = req.body;
    if (!city) {
        res.status(400).send('City is required');
        return;
    }

    const cacheKey = country ? `${city}-${country}` : city;
    console.log(`[AI PLAN-REQ] key="${cacheKey}"`);

    // --- MEVCUT BELLEK KONTROLÜ ---
    if (aiCache[cacheKey] && aiCache[cacheKey].status === 'done') {
        console.log(`[AI CACHE-HIT] ${cacheKey}`);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.json(aiCache[cacheKey].data);
    }

    if (aiCache[cacheKey] && aiCache[cacheKey].status === 'pending') {
        console.log(`[AI PENDING-WAIT] ${cacheKey}`);
        try {
            const result = await aiCache[cacheKey].promise;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.json(result);
        } catch (err) {
            return res.status(500).json({ error: 'AI Error during pending' });
        }
    }

    // --- YENİ İŞLEM BAŞLAT ---
    const processingPromise = (async () => {
        const aiReqCity = country ? `${city}, ${country}` : city;
        const activeModel = "llama-3.3-70b-versatile";

        console.log(`[AI START (Groq)] Model: ${activeModel} | City: ${aiReqCity}`);

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
            const response = await axios({
                method: 'post',
                url: 'https://api.groq.com/openai/v1/chat/completions',
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                data: {
                    model: activeModel,
                    messages: [
                        { role: "user", content: prompt }
                    ],
                    response_format: { type: "json_object" },
                    temperature: 0.1,
                    max_tokens: 200
                },
                timeout: 15000 
            });

            let jsonText = response.data?.choices?.[0]?.message?.content || '';
            if (!jsonText) throw new Error('Empty AI response');

            try {
                return JSON.parse(jsonText);
            } catch (err) {
                const match = jsonText.match(/\{[\s\S]*\}/);
                if (match) return JSON.parse(match[0]);
                throw err;
            }

        } catch (err) {
            console.error("LLM Error:", err.response?.data || err.message);
            return {
                summary: "Info unavailable.",
                tip: "Info unavailable.",
                highlight: "Info unavailable."
            };
        }
    })();
 
    aiCache[cacheKey] = {
        status: 'pending',
        promise: processingPromise
    };

    try {
        const result = await processingPromise;

        aiCache[cacheKey] = {
            status: 'done',
            data: result
        };

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