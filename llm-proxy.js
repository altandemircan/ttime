const express = require('express');
const axios = require('axios');
const router = express.Router();

router.post('/plan-summary', async (req, res) => {
    const { city } = req.body;

const prompt = `
Write a JSON object only, with no explanations or markdown, for the city "${city}".
Keys: summary (2 sentences), tip, highlight.
Example: {"summary":"...","tip":"...","highlight":"..."}
`.trim();

    try {
        const response = await axios.post('http://localhost:11434/api/generate', {
            model: "gemma:2b",
            prompt,
            stream: true
        }, { responseType: 'stream' });

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        response.data.pipe(res);
    } catch (error) {
        res.status(500).send('AI bilgi alınamadı.');
    }
});

module.exports = router;