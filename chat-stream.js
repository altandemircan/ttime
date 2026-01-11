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

    // MİNİMAL PROMPT - AI kendi halleder
    const systemPrompt = `You are a helpful local guide. 
Provide useful information about places in a friendly, conversational way.`;

    // Eğer point varsa context ekle
    const contextPrompt = point ? `The user is asking about "${point}" in ${cleanCity}.` : "";

    const messages = [
        { role: "system", content: systemPrompt },
        ...userMessages
    ];

    // Point varsa son mesaja ekle
    if (point) {
        messages.push({ 
            role: "user", 
            content: `Tell me about ${point} in ${cleanCity}.` 
        });
    }

    const model = 'llama3:8b';

    try {
        const ollama = await axios({
            method: 'post',
            url: 'http://127.0.0.1:11434/api/chat',
            data: {
                model,
                messages,
                stream: true,
                max_tokens: 400
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
                        res.write(`data: ${JSON.stringify({content: data.message.content})}\n\n`);
                    }
                } catch (e) {
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