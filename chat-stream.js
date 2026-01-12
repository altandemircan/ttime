const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/', async (req, res) => {
    console.log("[BACKEND] Yeni chat-stream AI SSE isteği geldi", new Date().toISOString());
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
        // RETRY MEKANİZMASI - 2 deneme
        let ollamaResponse;
        let lastError;
        
        for (let attempt = 1; attempt <= 2; attempt++) {
    try {
        console.log(`[BACKEND] Ollama attempt ${attempt} başlıyor`, Date.now());
                ollamaResponse = await axios({
                    method: 'post',
                    url: 'http://127.0.0.1:11434/api/chat',
                    data: {
                        model,
                        messages,
                        stream: true,
                        max_tokens: 120,
                        temperature: 0.7,
                        stop: ["\n\n", "Practical Tip:", "Tip:", "Note:"]
                    },
                    responseType: 'stream',
                    timeout: attempt === 1 ? 30000 : 60000 // İlk 30sn, ikinci 60sn
                });
                console.log(`[BACKEND] Ollama attempt ${attempt} BAŞARILI`, Date.now());
break; // Başarılı, döngüden çık
            } catch (err) {
                lastError = err;
                console.log(`[chat-stream] Attempt ${attempt} failed:`, err.message);
                if (attempt < 2) {
                    await new Promise(resolve => setTimeout(resolve, 2000)); // 2sn bekle
                }
            }
        }
        
        if (!ollamaResponse) {
            throw lastError || new Error('Ollama connection failed after retries');
        }

        const ollama = ollamaResponse;

      let firstChunkTime = null;
ollama.data.on('data', chunk => {
    if (finished) return;
    const str = chunk.toString().trim();
    if (str) {
        if (!firstChunkTime) {
            firstChunkTime = Date.now();
            console.log("[BACKEND] Ollama ilk data chunk geldi", firstChunkTime);
        }
        res.write(`data: ${str}\n\n`);
    }
});
        ollama.data.on('end', () => {
    console.log("[BACKEND] Ollama stream bitti", Date.now());
    if (!finished) {
        finished = true;
        res.write('event: end\ndata: [DONE]\n\n');
        res.end();
    }
});
       ollama.data.on('error', (err) => {
    console.log("[BACKEND] Ollama stream error", Date.now(), err);
    if (!finished) {
        finished = true;
        res.write(`event: error\ndata: ${err.message}\n\n`);
        res.end();
    }
});

       req.on('close', () => {
    console.log("[BACKEND] SSE HTTP connection kapandı", Date.now());
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