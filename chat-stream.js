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

const prompt = `
[STRICT RULES: OBEY EVERY RULE BELOW OR OUTPUT WILL BE REJECTED]
- You are a professional local tour guide.
- Answer ONLY about: "${point}" in "${cleanCity || 'this location'}".
- Your ENTIRE answer (INCLUDING ALL TIPS, SENTENCES, ETC) MUST NOT exceed 300 characters. THIS IS MANDATORY. Do NOT write more.
- Write up to 3 concise sentences maximum. Fewer if possible.
- NO lists, no redundancies, no extra detail.
- If answer would exceed the limit, REMOVE less important info.
- Mention atmosphere, local significance, architectural style, typical visitors.
- If unknown, say what's typical for this category and city.
- If relevant, end with a brief practical tip; else, skip it.
- Separate logical groups with ONE empty line for readability.
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
                max_tokens: 200
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