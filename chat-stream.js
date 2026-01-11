const express = require('express');
const axios = require('axios');
const router = express.Router();

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

    const point = req.query.point || "";
    const cleanCity = req.query.city || "";
    const cleanCategory = req.query.category || "";
    const cleanFacts = req.query.facts ? JSON.parse(req.query.facts) : {};

    const prompt = `[STRICT GUIDELINES - BE PRECISE AND FACTUAL]
    1. ROLE: You are a professional local tour guide with deep knowledge of the area.
    2. POINT: "${point}"
    3. LOCATION: "${cleanCity || 'this location'}"
    4. CATEGORY: ${cleanCategory}
    5. AVAILABLE FACTS: ${JSON.stringify(cleanFacts)}

    [OUTPUT REQUIREMENTS]
    - Return ONLY valid JSON: {"p1": "text", "p2": "text"}
    - "p1": Exactly 2 informative sentences about this place.
    - "p2": 1 practical tip or recommendation (or empty string if none).

    [CONTENT RULES]
    - ALWAYS mention "${cleanCity.split(',')[0]}" in p1 if city is provided.
    - NEVER mention postal codes, zip codes, or administrative codes.
    - Focus on: atmosphere, local significance, architectural style, typical visitors.
    - If specific info is unknown, describe typical features of a ${cleanCategory} in ${cleanCity.split(',')[0]}.
    - Use natural, engaging language but stay factual.
    - Avoid generic phrases like "is a place" or "is located".
    - Do NOT invent names, dates, or events unless in facts.
    - For nature spots: mention landscape, flora/fauna, activities.
    - For businesses: mention typical offerings, ambiance, clientele.
    - For historical sites: mention period, significance, preservation.
    - Tips (p2): practical advice like "Visit early to avoid crowds" or "Try the local specialty".

    [EXAMPLE FORMAT]
    Good: {"p1": "This historic cafe in Beyoglu has been serving traditional Turkish coffee since 1950. Its antique decor and central location make it popular with both locals and tourists.", "p2": "Try their signature Turkish delight with the coffee."}
    Bad: {"p1": "This is a cafe. It is located in Istanbul.", "p2": ""}

    Now generate for: ${point} in ${cleanCity} (${cleanCategory})`;

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