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
            model: "llama3.2:3b",
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
  "summary": "A 100-word inspiring summary of the trip.",
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
        const response = await axios({
          method: 'post',
          url: 'http://localhost:11434/api/generate',
          data: {
            model: "llama3.2:3b",
            prompt,
            stream: true
          },
          responseType: 'stream'
        });

        let data = '';
        response.data.on('data', (chunk) => {
          data += chunk.toString(); // Her gelen chunk ile birleştir
        });
        response.data.on('end', () => {
          // Tüm cevap geldi, JSON parse et
          // Kod bloğu varsa temizle
          if (data.startsWith('```json')) {
            data = data.replace(/```json|```/g, '').trim();
          } else if (data.startsWith('```')) {
            data = data.replace(/```/g, '').trim();
          }
          // JSON parse et
          let aiResult;
          try {
            aiResult = JSON.parse(data);
          } catch (e) {
            // Regex ile ayıkla (senin kodunda olduğu gibi)
          }
          res.json(aiResult);
        });
    } catch (error) {
        console.log(`[AI] Ollama hata: ${Date.now() - t0} ms`, error?.message);
        res.json({ summary: "", tip: "", highlight: "", error: "AI plan özeti alınamadı." });
    }
});

module.exports = router;