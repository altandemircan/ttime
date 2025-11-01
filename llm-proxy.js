const express = require('express');
const axios = require('axios');
const router = express.Router();

// Plan summary endpoint
router.post('/plan-summary', async (req, res) => {
    console.log("Plan-summary body:", req.body);
    const { city, country } = req.body;
    if (!city) {
        res.status(400).send('City is required');
        return;
    }
    const aiReqCity = country ? `${city}, ${country}` : city;

    const prompt = `
You are an expert travel assistant.
Provide the following information about the city "${aiReqCity}":
{
  "summary": "A 2-3 sentence inspiring and informative summary about the city for travelers.",
  "tip": "A creative travel tip specific to this city.",
  "highlight": "A unique highlight or must-see point for a visitor."
}
Respond only as JSON. Do not include any extra text, explanation, or code block.
`.trim();

    try {
        // Doğru messages formatı!
        const response = await axios.post('http://127.0.0.1:11434/api/chat', {
            model: "gemma:2b",
            messages: [{ role: "user", content: prompt }],
            stream: false,
            max_tokens: 200
        });
        console.log("Ollama response:", response.data);

        // Yanıtı JSON olarak döndür
        let jsonResponse;
        try {
            jsonResponse = typeof response.data === 'string'
                ? JSON.parse(response.data)
                : response.data;
        } catch (e) {
            // Yanıt JSON değilse, hata logla!
            console.error('Yanıt JSON değil:', response.data);
            res.status(500).send('AI geçersiz yanıt verdi.');
            return;
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json(jsonResponse);
    } catch (error) {
        const errMsg = error?.response?.data || error?.message || String(error);
        console.error('LLM Proxy Error:', errMsg);
        res.status(500).json({ error: 'AI bilgi alınamadı.', details: errMsg });
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
You are Triptime.ai’s intelligent travel assistant.
You ONLY answer questions about travel, trip planning, tourism, city/country information, hotels, routes, food/restaurants, transportation, local activities, and places to visit.

If the user's question is not about travel, reply: "Sorry, I am designed to answer only travel-related questions such as trip planning, places to visit, food, transportation, and hotels."
You are powered by Triptime.ai, and your primary goal is to help users discover and plan amazing trips.

IMPORTANT: Your answer MUST NOT exceed 300 characters.
Each user has a daily limit of 10 questions. If the user reaches the daily limit, do NOT answer further questions and politely inform them to come back tomorrow.
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
                max_tokens: 400 // Yanıtın 300 karakteri geçmemesi için yeterli
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