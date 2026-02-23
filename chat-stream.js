const express = require('express');
const axios = require('axios');
const http = require('http');
const router = express.Router();

/* 🔒 KEEP-ALIVE AGENT (ASIL OLAY BU) */
const keepAliveAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 60000,
    maxSockets: 5,
    timeout: 0
});

router.get('/', async (req, res) => {
    console.log("[BACKEND] Yeni chat-stream AI SSE isteği geldi", new Date().toISOString());

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let finished = false;

    /* 🔁 SSE HEARTBEAT — PROXY / NODE TIMEOUT ENGELLEYİCİ */
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
- Travel
- Trips
- Cities
- Countries
- Geography
- Transportation
- Routes
- Food & drink
- Attractions
- Hotels
- Travel planning

If the question is NOT related to travel:

- Do NOT answer the personal or unrelated question.
- Do NOT mention any restriction.
- Politely redirect the conversation to travel.
- Ask a travel-related question to continue naturally.

Example behavior:
"I’m here to help with travel planning. Are you planning a trip somewhere?"

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
        let ollamaResponse;
        let lastError;

        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                console.log(`[BACKEND] Ollama attempt ${attempt} başlıyor`, Date.now());

                ollamaResponse = await axios({
                    method: 'post',
                    url: 'http://127.0.0.1:11434/api/chat',
                    httpAgent: keepAliveAgent,
                    data: {
                        model: 'llama3:8b',
                        messages,
                        stream: true,
                        temperature: 0.7,
                        max_tokens: 120,
                        stop: ["\n\n", "Tip:", "Note:"]
                    },
                    responseType: 'stream',
                    timeout: 0 // ❗ ASLA TIMEOUT OLMAZ
                });

                console.log(`[BACKEND] Ollama attempt ${attempt} BAŞARILI`, Date.now());
                break;

            } catch (err) {
                lastError = err;
                console.log(`[chat-stream] Attempt ${attempt} failed`, err.message);
                if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
            }
        }

        if (!ollamaResponse) throw lastError;

        let firstChunkTime = null;

        ollamaResponse.data.on('data', chunk => {
            if (finished) return;
            const str = chunk.toString().trim();
            if (!str) return;

            if (!firstChunkTime) {
                firstChunkTime = Date.now();
                console.log("[BACKEND] Ollama ilk chunk geldi", firstChunkTime);
            }

            res.write(`data: ${str}\n\n`);
        });

        ollamaResponse.data.on('end', () => {
            if (finished) return;
            finished = true;
            clearInterval(heartbeat);
            console.log("[BACKEND] Ollama stream bitti", Date.now());
            res.write('event: end\ndata: [DONE]\n\n');
            res.end();
        });

        ollamaResponse.data.on('error', err => {
            if (finished) return;
            finished = true;
            clearInterval(heartbeat);
            console.log("[BACKEND] Ollama stream error", err.message);
            res.write(`event: error\ndata: ${err.message}\n\n`);
            res.end();
        });

        req.on('close', () => {
            if (finished) return;
            finished = true;
            clearInterval(heartbeat);
            console.log("[BACKEND] SSE connection kapandı");
            res.end();
        });

    } catch (error) {
        finished = true;
        clearInterval(heartbeat);
        res.write(`event: error\ndata: ${error.message}\n\n`);
        res.end();
        console.error('[OLLAMA ERROR]', error);
    }
});

module.exports = router;
