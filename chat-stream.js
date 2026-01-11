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

    // BASİT PROMPT - Normal AI chat gibi
    const prompt = `You are a friendly local tour guide in ${cleanCity || "the area"}.
    
The user is asking about "${point}" (${cleanCategory}).
${cleanFacts ? `Available information: ${JSON.stringify(cleanFacts)}` : ""}

Provide a helpful, engaging response in plain text.
Be conversational and natural.`;

    // Tüm mesajları birleştir
    const messages = [
        { role: "system", content: prompt },
        ...userMessages
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
                max_tokens: 300
            },
            responseType: 'stream',
            timeout: 180000
        });

        ollama.data.on('data', chunk => {
            if (finished) return;
            const str = chunk.toString().trim();
            if (str) {
                try {
                    const data = JSON.parse(str);
                    if (data.message && data.message.content) {
                        // Direkt içeriği gönder
                        res.write(`data: ${JSON.stringify({content: data.message.content})}\n\n`);
                    }
                } catch (e) {
                    // JSON değilse olduğu gibi gönder
                    res.write(`data: ${str}\n\n`);
                }
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