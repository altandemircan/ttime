const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/', async (req, res) => {
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

    const point = req.query.point || "";
    const cleanCity = req.query.city || "";
    const cleanCategory = req.query.category || "";
    const cleanFacts = req.query.facts ? JSON.parse(req.query.facts) : {};

// PROMPT güncellemesi (satır 26-67 arası):
const prompt = `
[STRICT GUIDELINES - KEEP RESPONSE UNDER 500 CHARACTERS]
1. ROLE: Professional local tour guide for ${cleanCity || 'this location'}.
2. POINT: "${point}"
3. CATEGORY: ${cleanCategory}

[RESPONSE RULES]
- Mention ${cleanCity.split(',')[0]} if provided.
- Focus on: atmosphere, significance, key features.
- Be concise - every word counts.
- Write complete thoughts that can end naturally.
- Use short sentences.
- END your response naturally with a period, exclamation, or question mark.
- DO NOT exceed 500 characters. Count carefully.
- If including a tip, make it part of the main text, not separate.

Now describe: ${point} in ${cleanCity} (${cleanCategory})
`;

    const messages = [
        { role: "system", content: prompt },
        ...userMessages.filter(msg => msg.role !== "system")
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
    max_tokens: 120, // 200'den 120'ye düşürdük - daha kısa cevaplar için
    temperature: 0.7, // Daha kararlı cevaplar için
    stop: ["\n\n", "Practical Tip:", "Tip:", "Note:"] // Erken durma noktaları
},
            responseType: 'stream',
            timeout: 180000
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
        res.write(`event: error\ndata: ${error?.response?.data?.error || error.message}\n\n`);
        res.end();
        console.error('[OLLAMA ERROR]', error?.response?.data || error);
    }
});

module.exports = router;