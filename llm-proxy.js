const express = require('express');
const axios = require('axios');
const router = express.Router();

router.post('/plan-summary', async (req, res) => {
    const { city, country } = req.body;   // <-- country de gelsin

    // city ve country birleştir
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
        const response = await axios.post('http://localhost:11434/api/generate', {
            model: "llama2:13b",
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