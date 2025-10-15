const express = require('express');
const router = express.Router();
const axios = require('axios');

// --- PASİFLEŞTİRİLEN ENDPOINTLER ---
// Aşağıdaki endpointler artık kullanılmıyor, gereksiz AI yükünü ve yavaşlatmayı önlemek için kapalılar:

// router.post('/clarify-location', async (req, res) => {
//     try {
//         const { query } = req.body;
//         // Basit bir dönüşüm örneği (gerçekte AI entegrasyonu yapılacak)
//         const result = {
//             city: query.split(' ')[0].charAt(0).toUpperCase() + query.split(' ')[0].slice(1),
//             country: ""
//         };
//         res.json(result);
//     } catch (error) {
//         res.status(500).json({ error: "Location clarification failed" });
//     }
// });

// router.post('/suggest-categories', async (req, res) => {
//     const { city, days } = req.body;
//     const prompt = `Suggest ${days} day trip categories for ${city}. Choose from: Coffee, Touristic, Restaurant, Accommodation, Historic, Adventure, Luxury. Respond as JSON array.`;

//     try {
//         const response = await axios.post('http://localhost:11434/api/generate', {
//             model: "llama3.2:1b",
//             prompt,
//             stream: false
//         });
//         res.json(JSON.parse(response.data.response));
//     } catch (error) {
//         res.json([]);
//     }
// });

// router.post('/generate-notes', async (req, res) => {
//     const { name, city, category } = req.body;
//     const prompt = `Describe ${name} in ${city} (category: ${category}) for tourists in 15 words max.`;

//     try {
//         const response = await axios.post('http://localhost:11434/api/generate', {
//             model: "llama3.2:1b",
//             prompt,
//             stream: false
//         });
//         res.json({ notes: response.data.response.trim() });
//     } catch (error) {
//         res.json({ notes: "" });
//     }
// });

// router.post('/trip-info', async (req, res) => {
//     const { tripPlan } = req.body;
//     if (!Array.isArray(tripPlan) || tripPlan.length === 0) {
//         return res.json({ summary: "", error: "No trip steps provided." });
//     }
//     const steps = tripPlan.map(x => x.name).filter(Boolean).join(', ');
//     const prompt = `
// Given these trip steps: ${steps}.
// Write a single-sentence summary in JSON: { "summary": "..." }
// Respond only in valid JSON. Do not use code block formatting or extra text.
// `.trim();

//     try {
//         const response = await axios.post('http://localhost:11434/api/generate', {
//             model: "llama3.2:1b",
//             prompt,
//             stream: false
//         });
//         let data = response.data.response.trim();
//         // Remove code block if present
//         data = data.replace(/```json|```/g, '').trim();
//         let summary = "";
//         try { summary = JSON.parse(data).summary; }
//         catch { summary = (data.match(/"summary"\s*:\s*"([^"]+)"/) || [])[1] || ""; }
//         if (!summary) return res.json({ summary: "", error: "AI trip info could not be generated.", raw: data });
//         res.json({ summary });
//     } catch (error) {
//         res.json({ summary: "", error: "AI trip info could not be generated.", errorDetail: error.message });
//     }
// });

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