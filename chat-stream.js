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
[STRICT GUIDELINES - BE PRECISE AND FACTUAL]
1. ROLE: You are a professional local tour guide with deep knowledge of the area.
2. POINT: "${point}"
3. LOCATION: "${cleanCity || 'this location'}"
4. CATEGORY: ${cleanCategory}
5. AVAILABLE FACTS: ${JSON.stringify(cleanFacts)}

[CONTENT RULES - STRICTLY ENFORCE THESE]
- ALWAYS mention "${cleanCity.split(',')[0]}" in your answer if city is provided.
- NEVER mention postal codes, zip codes, or administrative codes.
- Focus on: atmosphere, local significance, architectural style, typical visitors.
- If specific info is unknown, describe typical features of a ${cleanCategory} in ${cleanCity.split(',')[0]}.
- Use natural, engaging language but stay factual.
- Avoid generic phrases like "is a place" or "is located".
- Do NOT invent names, dates, or events unless in facts.
- For nature spots: mention landscape, flora/fauna, activities.
- For businesses: mention typical offerings, ambiance, clientele.
- For historical sites: mention period, significance, preservation.

[CRITICAL RESPONSE LIMITS]
- Your ENTIRE response MUST be between 200-250 characters MAXIMUM.
- Count your characters carefully before responding.
- If you exceed 250 characters, your response will be truncated.
- Write in concise, compact sentences.
- Use abbreviations when possible (e.g., "approx." instead of "approximately").
- Avoid unnecessary adjectives and filler words.
- Do NOT include "Practical Tip:" or similar sections unless they fit within the character limit.
- If relevant, include ONE short visitor tip only if it fits within 250 characters.
- **IMPORTANT**: Stop writing immediately when you reach 250 characters.

Now generate a concise informative answer for: ${point} in ${cleanCity} (${cleanCategory})
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