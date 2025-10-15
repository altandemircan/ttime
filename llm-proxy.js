const express = require('express');
const router = express.Router();
const axios = require('axios');

router.post('/plan-summary', async (req, res) => {
    const { city } = req.body;
    const t0 = Date.now();

    const prompt = `
You are an expert travel assistant.
Provide the following information about the city "${city}":
{
  "summary": "A 2-3 sentence inspiring and informative summary about the city for travelers.",
  "tip": "A creative travel tip specific to this city.",
  "highlight": "A unique highlight or must-see point for a visitor."
}
Respond only as JSON. Do not include any extra text, explanation, or code block.
`.trim();

    try {
        const response = await axios.post('http://localhost:11434/api/generate', {
            model: "llama3.2:3b",
            prompt,
            stream: false
        });

        let data = response.data.response.trim();

        // Kod bloğu veya fazlalık varsa temizle
        if (data.startsWith('```json')) {
            data = data.replace(/```json|```/g, '').trim();
        } else if (data.startsWith('```')) {
            data = data.replace(/```/g, '').trim();
        }

        let aiResult;
        try {
            aiResult = JSON.parse(data);
        } catch (e) {
            // Regex fallback
            const summary = (data.match(/"summary"\s*:\s*"([^"]+)"/) || [])[1] || "";
            const tip = (data.match(/"tip"\s*:\s*"([^"]+)"/) || [])[1] || "";
            const highlight = (data.match(/"highlight"\s*:\s*"([^"]+)"/) || [])[1] || "";
            aiResult = { summary, tip, highlight };
        }

        const elapsedMs = Date.now() - t0;
        res.json({ ...aiResult, elapsedMs });
    } catch (error) {
        const elapsedMs = Date.now() - t0;
        res.json({ summary: "", tip: "", highlight: "", error: "AI bilgi alınamadı.", elapsedMs });
    }
});

module.exports = router;