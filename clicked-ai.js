const express = require('express');
const axios = require('axios');
const router = express.Router();

router.post('/clicked-ai', async (req, res) => {
    const { point, city } = req.body;

    const prompt = `Return ONLY raw JSON.
No explanations. No markdown. No backticks.

{
  "p1": "Sensory sentence about ${point} in ${city}",
  "p2": "Short local tip"
}`;

    try {
        const response = await axios.post('http://127.0.0.1:11434/api/generate', {
            model: "llama3:8b",
            prompt: prompt,
            stream: false,
            options: {
                temperature: 0.5,
                top_p: 0.9,
                repeat_penalty: 1.1,
                num_predict: 120
            }
        }, { timeout: 30000 });

        let content = response.data?.response
            || response.data?.message?.content
            || "{}";

        const jsonMatch = content.match(/\{[\s\S]*?\}/);
        let result = { p1: "", p2: "" };
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            result = {
                p1: parsed.p1 || "",
                p2: parsed.p2 || ""
            };
        }

        res.json(result);

    } catch (e) {
        console.error("AI error:", e.message);
        res.json({ p1: "", p2: "" });
    }
});

module.exports = router;