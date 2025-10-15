const express = require('express');
const router = express.Router();
const axios = require('axios');

router.post('/plan-summary', async (req, res) => {
    const { city } = req.body;

//     const prompt = `
// You are an expert travel assistant.
// Provide the following information about the city "${city}":
// {
//   "summary": "A 2-3 sentence inspiring and informative summary about the city for travelers.",
//   "tip": "A creative travel tip specific to this city.",
//   "highlight": "A unique highlight or must-see point for a visitor."
// }
// Respond only as JSON. Do not include any extra text, explanation, or code block.
// `.trim();


    const prompt = `
You are an expert travel assistant.
Write a single, inspiring sentence as a summary for the city "${city}" for a traveler.
Respond only as plain text. Do not include any extra text, explanation, or code block.
`.trim();



    try {
        // Streaming olarak Ollama'dan al
        const response = await axios.post('http://localhost:11434/api/generate', {
            model: "llama3.2:3b",
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