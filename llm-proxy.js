const express = require('express');
const router = express.Router();
const axios = require('axios');


router.post('/plan-summary', async (req, res) => {
    const { plan, city, days } = req.body;
    const places = Array.isArray(plan) ? plan.map(p => ({
        name: p.name,
        category: p.category,
        day: p.day
    })) : [];
    const prompt = `
You are an expert travel assistant. Given this ${days}-day trip plan for ${city}:
${JSON.stringify(places, null, 2)}
Please write:
- An inspiring and positive summary of this trip (max 60 words).
- A creative tip for the traveler.
- A highlight that makes this trip special.
Respond as formatted JSON: { "summary": "...", "tip": "...", "highlight": "..." }
    `.trim();

    try {
        const response = await axios.post('http://localhost:11434/api/generate', {
            model: "llama3.2:3b",
            prompt,
            stream: false
        });

        let data = response.data.response.trim();

        // Ollama bazen kod bloğu veya metin döndürebilir, JSON değilse düzelt:
        // Kod bloğu varsa çıkar
        if (data.startsWith('```json')) {
            data = data.replace(/```json|```/g, '').trim();
        } else if (data.startsWith('```')) {
            data = data.replace(/```/g, '').trim();
        }

        // Sonunda fazlalık karakterler olabiliyor, JSON.parse bozulmasın diye
        let aiResult;
        try {
            aiResult = JSON.parse(data);
        } catch (e) {
            // JSON parse edilemiyorsa, regex ile manuel ayıkla
            const summary = (data.match(/"summary"\s*:\s*"([^"]+)"/) || [])[1] || "";
            const tip = (data.match(/"tip"\s*:\s*"([^"]+)"/) || [])[1] || "";
            const highlight = (data.match(/"highlight"\s*:\s*"([^"]+)"/) || [])[1] || "";
            aiResult = { summary, tip, highlight };
        }

        if (!aiResult.summary && !aiResult.tip && !aiResult.highlight) {
            return res.json({ summary: "", tip: "", highlight: "", error: "AI plan özeti alınamadı." });
        }

        res.json(aiResult);
    } catch (error) {
        res.json({ summary: "", tip: "", highlight: "", error: "AI plan özeti alınamadı." });
    }
});

module.exports = router;