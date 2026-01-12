const express = require('express');
const axios = require('axios');
const router = express.Router();

router.post('/', async (req, res) => {
    const { point, city, facts } = req.body; // facts'i de al

    const prompt = `You are a travel guide for ${city}. 
Write a short summary and a tip about visiting this city.

Return ONLY a JSON object with these exact keys:
{
  "p1": "short summary about ${city}", 
  "p2": "one tip for travelers"
}

Rules:
- p1: 1-2 sentences with a quick overview about ${city} (its location, main attractions, general vibe)
- p2: 1 simple tip or suggestion for first-time visitors
- Use simple, natural English
- Respond only with the JSON object above.`;

    try {
        const response = await axios.post('http://127.0.0.1:11434/api/generate', {
            model: "llama3:8b",
            prompt: prompt,
            stream: false,
            options: {
                temperature: 0.7,  // Biraz daha yaratıcı olsun
                top_p: 0.9,
                repeat_penalty: 1.1,
                num_predict: 150
            }
        }, { timeout: 30000 });

        let content = response.data?.response || "{}";
        console.log('Ollama response:', content); // DEBUG

        const jsonMatch = content.match(/\{[\s\S]*?\}/);
        let result = { p1: "", p2: "" };
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                result = {
                    p1: parsed.p1 || "",
                    p2: parsed.p2 || ""
                };
            } catch (parseErr) {
                console.error('JSON parse error:', parseErr.message);
            }
        }

        console.log('Result to frontend:', result); // DEBUG
        res.json(result);

    } catch (e) {
        console.error("AI error:", e.message);
        res.json({ p1: "", p2: "" });
    }
});

module.exports = router; 