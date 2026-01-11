const express = require('express');
const axios = require('axios');
const router = express.Router();

router.post('/', async (req, res) => {
    const { point, city, facts } = req.body; // facts'i de al

    const prompt = `You are a local tour guide in ${city}. 
Create a brief, engaging description about "${point}" that appeals to the senses.
Focus on what visitors might see, hear, smell, or feel at this location.

Return ONLY a JSON object with these exact keys:
{
  "p1": "description_here", 
  "p2": "tip_here"
}

Rules:
- p1: 1-2 sentences describing ${point} in a vivid, sensory way
- p2: 1 practical tip or recommendation for visitors
- Use simple, natural English
- Do NOT include any explanations outside the JSON
- If you don't know specific details, describe typical features`;

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