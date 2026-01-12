const express = require('express');
const axios = require('axios');
const router = express.Router();

router.post('/', async (req, res) => {
    const { point, city, facts } = req.body; // facts'i de al

    const prompt = `You are a travel guide for ${city}.
Write a short summary and a tip about visiting this city.

Return ONLY this valid JSON (no explanation, no formatting, no text outside the curly braces!):
{
  "p1": "short summary about ${city}",
  "p2": "one tip for travelers"
}`;

// ...
try {
    const response = await axios.post('http://127.0.0.1:11434/api/generate', {
        model: "llama3:8b",
        prompt: prompt,
        stream: false,
        options: {
            temperature: 0.7,
            top_p: 0.9,
            repeat_penalty: 1.1,
            num_predict: 150
        }
    }, { timeout: 60000 }); // 60 saniye, timeout'u artırmanı da öneririm!

    let result = { p1: "", p2: "" };
    let content = response.data?.response || "{}";
    try {
        // AI cevabı MUTLAKA çıplak JSON ise:
        result = JSON.parse(content);
        result = {
            p1: result.p1 || "",
            p2: result.p2 || ""
        };
    } catch (parseErr) {
        console.error('AI JSON parse error:', parseErr.message, "Kaynak içerik:", content);
    }

    console.log('Ollama response:', content);
    console.log('Result to frontend:', result);
    res.json(result);

} catch (e) {
    console.error("AI error:", e.message);
    res.json({ p1: "", p2: "" });
}
});

module.exports = router; 