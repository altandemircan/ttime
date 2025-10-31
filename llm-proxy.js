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
ONLY output pure JSON. No markdown, no explanation, no code block.

{
  "summary": "A 2-3 sentence inspiring and informative summary about the city "${aiReqCity}" for travelers.",
  "tip": "A creative travel tip specific to this city.",
  "highlight": "A unique highlight or must-see point for a visitor."
}
`.trim();

    try {
        // Sadece aktif OLLAMA portunu kullan!
        const response = await axios.post('http://127.0.0.1:11434/api/generate', {
    model: "llama2:7b",
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

module.exports = router; 