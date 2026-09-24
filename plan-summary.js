const express = require('express');
const axios = require('axios');
const router = express.Router();

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
        const activeModel = "openai/gpt-oss-120b";

        console.log(`[AI START (Groq)] Model: ${activeModel} | City: ${aiReqCity}`);

        const prompt = `
You are a strictly factual travel guide.
Provide specific travel insights for the city "${aiReqCity}" ONLY in ENGLISH.
RULES:
1. Do NOT hallucinate. If unknown, state "Info not available".
2. Verify landmarks are INSIDE "${aiReqCity}".
3. Respond ONLY with a valid JSON object containing these exact keys: summary, tip, highlight.
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
                    temperature: 0.1,
                    max_tokens: 600,
                    reasoning_effort: "low"
                },
                timeout: 15000 
            });

            let jsonText = response.data?.choices?.[0]?.message?.content || '';
            const finishReason = response.data?.choices?.[0]?.finish_reason;
            if (!jsonText) {
                console.error(`[AI EMPTY CONTENT] city="${aiReqCity}" finish_reason=${finishReason}`);
                throw new Error('Empty AI response');
            }

            try {
                return JSON.parse(jsonText);
            } catch (err) {
                const match = jsonText.match(/\{[\s\S]*\}/);
                if (match) return JSON.parse(match[0]);
                throw err;
            }

        } catch (err) {
            console.error(
                `[AI LLM ERROR] city="${aiReqCity}" status=${err.response?.status || 'N/A'} ` +
                `message=${err.message}`
            );
            if (err.response?.data) {
                console.error('[AI LLM ERROR] response body:', JSON.stringify(err.response.data));
            }
            if (!process.env.GROQ_API_KEY) {
                console.error('[AI LLM ERROR] GROQ_API_KEY is NOT set in environment!');
            }
            return {
                summary: "Info unavailable.",
                tip: "Info unavailable.",
                highlight: "Info unavailable.",
                __failed: true
            };
        }
    })();
 
    aiCache[cacheKey] = {
        status: 'pending',
        promise: processingPromise
    };

    try {
        const result = await processingPromise;

        if (result && result.__failed) {
            // Başarısız/fallback sonucu kalıcı önbelleğe yazma; bir sonraki
            // istek tekrar denesin.
            delete aiCache[cacheKey];
        } else {
            aiCache[cacheKey] = {
                status: 'done',
                data: result
            };
        }

        console.log(`[AI DONE] ${cacheKey} tamamlandı.`);
        
        const { __failed, ...clientResult } = result || {};

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json(clientResult);

    } catch (error) {
        console.error(`[AI ERROR] ${cacheKey}:`, error.message);
        delete aiCache[cacheKey];
        res.status(500).json({ error: 'AI Error' });
    }
});

module.exports = router;