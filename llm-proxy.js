const express = require('express');
const axios = require('axios');
const router = express.Router();

// Plan summary endpoint
router.post('/plan-summary', async (req, res) => {
    const { city, country } = req.body;
    if (!city) {
        res.status(400).send('City is required');
        return;
    }
    const aiReqCity = country ? `${city}, ${country}` : city;

    // DEBUG: Her sorguda şehir ne gidiyor görün
    console.log("AIReqCity:", aiReqCity);

const prompt = `
You are an expert travel assistant.
For the city "${aiReqCity}", respond ONLY with a valid JSON object with these fields (no code block, no explanation):

{
  "summary": "...",
  "tip": "...",
  "highlight": "..."
}

If you don't know the answer, put "Bilgi yok." for that field.
`.trim();

    try {
        const response = await axios.post('http://127.0.0.1:11434/api/chat', {
            model: "gemma:2b",
            messages: [{ role: "user", content: prompt }],
            stream: false,
            max_tokens: 200
        });

        // Yanıtı debug et!
        console.log("Ollama response:", response.data);

        // Gemma yanıtı şu formatta gelir:
        // { model: ..., message: { role: 'assistant', content: '{...}' }, ... }
        let jsonText = '';
        if (typeof response.data === 'object' && response.data.message && response.data.message.content) {
            jsonText = response.data.message.content;
        } else if (typeof response.data === 'string') {
            const match = response.data.match(/\{[\s\S]*?\}/);
            if (match) {
                jsonText = match[0];
            }
        }

        let jsonResponse;
        try {
            jsonResponse = JSON.parse(jsonText);
        } catch (e) {
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
You are a friendly and knowledgeable travel assistant.
Help users discover and plan trips by providing clear, concise, and useful information about destinations, activities, food, transportation, hotels, and local tips.
Give brief answers (maximum 150 characters) unless more detail is requested.
If asked about something unrelated to travel, politely say you only answer travel-related questions.
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
                max_tokens: 200 // Yanıtın 300 karakteri geçmemesi için yeterli
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