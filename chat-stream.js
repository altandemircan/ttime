const express = require('express');
const { Groq } = require('groq-sdk');
const http = require('http');
const router = express.Router();

// Groq client başlatma (process.env.GROQ_API_KEY otomatik okunur)
const groq = new Groq();

router.get('/', async (req, res) => {
    console.log("[BACKEND] Yeni chat-stream Groq SSE isteği geldi", new Date().toISOString());

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let finished = false;

    const heartbeat = setInterval(() => {
        if (!finished) {
            res.write(`: ping\n\n`);
        }
    }, 15000);

    let userMessages = [];
    try {
        userMessages = JSON.parse(req.query.messages || "[]");
    } catch (e) {
        userMessages = [];
    }

    const point = req.query.point || "";
    const cleanCity = req.query.city || "";
    const cleanCategory = req.query.category || "";

    const prompt = `
[STRICT GUIDELINES - KEEP RESPONSE UNDER 500 CHARACTERS]

[DOMAIN RESTRICTION – TRAVEL ONLY]
You are ONLY allowed to answer questions related to:
- Travel, Trips, Cities, Countries, Geography, Transportation, Routes, Food & drink, Attractions, Hotels, Travel planning.

If the question is NOT related to travel, politely redirect the conversation to travel without mentioning any restriction.

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
- DO NOT exceed 500 characters.
`;

    const messages = [
        { role: "system", content: prompt },
        ...userMessages.filter(m => m.role !== "system")
    ];

    try {
        console.log(`[BACKEND] Groq API çağrısı başlıyor...`);

        const chatCompletion = await groq.chat.completions.create({
            messages: messages,
            model: "openai/gpt-oss-120b",
            temperature: 0.7,
            max_tokens: 500,
            top_p: 1,
            stream: true
        });

        let firstChunkTime = null;

        for await (const chunk of chatCompletion) {
            if (finished) break;

            const contentPiece = chunk.choices[0]?.delta?.content || "";

            if (contentPiece) {
                if (!firstChunkTime) {
                    firstChunkTime = Date.now();
                    console.log("[BACKEND] Groq ilk chunk geldi", firstChunkTime);
                }
                res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: contentPiece } }] })}\n\n`);
            }
        }

        if (!finished) {
            finished = true;
            clearInterval(heartbeat);
            console.log("[BACKEND] Groq stream bitti", Date.now());
            res.write('event: end\ndata: [DONE]\n\n');
            res.end();
        }

    } catch (error) {
        if (finished) return;
        finished = true;
        clearInterval(heartbeat);
        console.error('[GROQ ERROR]', error);
        res.write(`event: error\ndata: ${error.message}\n\n`);
        res.end();
    }

    req.on('close', () => {
        if (finished) return;
        finished = true;
        clearInterval(heartbeat);
        console.log("[BACKEND] SSE connection kapandı");
        res.end();
    });
});

module.exports = router;