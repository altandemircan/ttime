const express = require('express');
const router = express.Router();
const axios = require('axios');

router.post('/plan-summary', async (req, res) => {
    const { city, days } = req.body;

    // Eski: plan listesini prompta ekliyordun
    // const places = Array.isArray(plan) ? ... (bunları kaldırıyoruz)

    // YENİ PROMPT — plan yok, sadece city ve days
    const prompt = `
${city} trip plan ${days || 2} days
Respond as JSON: { "summary": "...", "tip": "...", "highlight": "..." }
`.trim();

    try {
        const response = await axios.post('http://localhost:11434/api/generate', {
            model: "llama3.2:3b",
            prompt,
            stream: false
        });

        let data = response.data.response.trim();

        // JSON/kod bloğu varsa çıkar
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

        if (!aiResult.summary && !aiResult.tip && !aiResult.highlight) {
            return res.json({ summary: "", tip: "", highlight: "", error: "AI plan özeti alınamadı." });
        }

        res.json(aiResult);
    } catch (error) {
        res.json({ summary: "", tip: "", highlight: "", error: "AI plan özeti alınamadı." });
    }
});

module.exports = router;