const express = require('express');
const axios = require('axios');
const router = express.Router();

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
        // Sadece aktif OLLAMA portunu kullan!
        const response = await axios.post('http://127.0.0.1:11434/api/generate', {
    model: "llama3:8b",
    prompt,
    stream: false
});
        console.log("Ollama response:", response.data);

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json(response.data);
    } catch (error) {
        console.error('LLM Proxy Error:', error?.response?.data || error?.message || error);
        res.status(500).send('AI bilgi alınamadı.');
    }
});
router.get('/test', (req, res) => res.send('llm-proxy test OK'));

router.get('/chat-stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let finished = false;

    // Tüm mesaj geçmişini frontendden al
    let messages = [];
    try {
        messages = JSON.parse(req.query.messages || "[]");
    } catch (e) {
        messages = [];
    }
    // Son user mesajına karakter limiti ekle
    if (messages.length > 0) {
        const lastIdx = messages.length - 1;
        if (messages[lastIdx].role === "user") {
            messages[lastIdx].content += "\nYour answer MUST NOT exceed 600 characters.";
        }
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
        max_tokens: 800 // <-- Bunu artır!
    },
    responseType: 'stream',
    timeout: 180000 // istersen artır, ama asıl max_tokens!
})

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