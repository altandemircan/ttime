const express = require('express');
const router = express.Router();
const axios = require('axios');

let ollamaWarmed = false; // Model ısındı mı?

// Modeli ısıtmak için sunucu açılışında dummy istek at:
async function warmUpOllama() {
    try {
        const prompt = "Say hello in JSON: {\"summary\":\"Hello\"}";
        const t0 = Date.now();
        await axios.post('http://localhost:11434/api/generate', {
            model: "llama3.2:1b",
            prompt,
            stream: false
        });
        console.log(`[Ollama] Warm-up complete in ${Date.now() - t0} ms.`);
        ollamaWarmed = true;
    } catch (e) {
        console.log("[Ollama] Warm-up failed:", e.message);
    }
}
warmUpOllama();

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
Respond ONLY as JSON with these 3 fields:
{
  "summary": "A 60-word inspiring summary of the trip.",
  "tip": "A creative tip for the traveler.",
  "highlight": "A highlight that makes this trip special."
}
IMPORTANT:
- Each field MUST be filled and unique.
- DO NOT merge them.
- DO NOT add any label like "Summary:", "Tip:", or "Highlight:" inside the values.
- NO explanation, NO markdown, NO code block. Just plain JSON object.
`.trim();

    const t0 = Date.now();
    try {
        const response = await axios.post('http://localhost:11434/api/generate', {
            model: "llama3.2:1b",
            prompt,
            stream: false
        });

        let data = response.data.response.trim();

        // Ollama bazen kod bloğu veya metin döndürebilir, JSON değilse düzelt:
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
            console.log(`[AI] Yanıt alınamadı. Süre: ${Date.now() - t0} ms`);
            return res.json({ summary: "", tip: "", highlight: "", error: "AI plan özeti alınamadı." });
        }

        console.log(`[AI] Yanıt süresi: ${Date.now() - t0} ms / city: ${city} days: ${days}`);

        res.json(aiResult);
    } catch (error) {
        console.log(`[AI] Ollama hata: ${Date.now() - t0} ms`, error?.message);
        res.json({ summary: "", tip: "", highlight: "", error: "AI plan özeti alınamadı." });
    }
});

module.exports = router;