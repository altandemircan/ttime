const express = require('express');
const axios = require('axios');
const router = express.Router();

router.post('/', async (req, res) => {
    const { point, city, facts } = req.body;
    
    if (!city || city.trim() === '') {
        console.warn("WARN: AI request city parametresi boş geliyor!", point);
    }
    
    console.log(`[AI REQUEST] point=${point}, city=${city}`);
    console.log(`[AI FACTS]`, JSON.stringify(facts, null, 2));

    // Enhanced facts'i prompt'a ekle
    const factsContext = buildFactsContext(facts);
    
    const prompt = `You are an expert local tour guide in ${city || 'this destination'}. 
A traveler selected the location "${point}" on the map.

${factsContext}

IMPORTANT GUIDELINES:
1. Focus specifically on "${point}". Describe what makes it unique, historical, or worth seeing.
2. Use the provided context to ensure accuracy.
3. Keep the tone engaging, brief, and practical for travelers.
4. Give a real, actionable tip for visiting "${point}".
5. Avoid generic boilerplate statements.

Return ONLY this valid JSON (no explanation, no markdown, no text outside JSON!):
{
  "p1": "engaging description focused on ${point}",
  "p2": "practical visitor tip for ${point}"
}`;

    // Helper function to build facts context
    function buildFactsContext(facts) {
        if (!facts || Object.keys(facts).length === 0) {
            return "";
        }
        
        let context = "ADDITIONAL CONTEXT ABOUT THIS PLACE:\n";
        
        if (facts.category) {
            context += `- Type: ${facts.category}\n`;
        }
        
        if (facts.place_type && facts.place_type !== facts.category) {
            context += `- Place type: ${facts.place_type}\n`;
        }
        
        if (facts.state) {
            context += `- Region/State: ${facts.state}\n`;
        }
        
        if (facts.city && facts.city !== city.split(',')[0]) {
            context += `- City: ${facts.city}\n`;
        }
        
        if (facts.popularity_score) {
            const popularityDesc = facts.popularity_score > 7 ? "popular tourist attraction" : 
                                   facts.popularity_score > 4 ? "known local spot" : "lesser-known place";
            context += `- Popularity: ${popularityDesc} (score: ${facts.popularity_score}/10)\n`;
        }
        
        if (facts.address_short) {
            context += `- Address: ${facts.address_short}\n`;
        }
        
        if (facts.nearby_places && facts.nearby_places.length > 0) {
            context += `- Nearby places: ${facts.nearby_places.slice(0, 3).join(', ')}\n`;
        }
        
        return context;
    }

    try {
        const response = await axios({
            method: 'post',
            url: 'https://api.groq.com/openai/v1/chat/completions',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            data: {
                model: "openai/gpt-oss-120b",
                messages: [
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" },
                temperature: 0.7,
                max_tokens: 200
            },
            timeout: 15000
        });

        const rawContent = response.data?.choices?.[0]?.message?.content || '{}';
        let result = { p1: "", p2: "" };

        try {
            const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
            const contentToParse = jsonMatch ? jsonMatch[0] : rawContent;
            
            const parsed = JSON.parse(contentToParse);
            result = {
                p1: parsed.p1 || `Explore ${point} in ${city}.`,
                p2: parsed.p2 || `Check opening hours before visiting.`
            };
        } catch (err) {
            console.error('AI JSON parse error:', err.message);
            result = {
                p1: `${point} is located in ${city}. It's worth exploring.`,
                p2: `Consider visiting during daylight hours for the best experience.`
            };
        }

        console.log(`[AI RESPONSE for ${point}]`, {
            city: city,
            factsUsed: Object.keys(facts || {}).length,
            responseLength: result.p1.length + result.p2.length
        });

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json(result);

    } catch (e) {
        console.error("AI error:", e.response?.data || e.message);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json({ 
        p1: `${point} is located in ${city || 'this area'}. It offers a unique experience for visitors.`,
        p2: `Plan your visit according to the weather and local conditions.`
        });
    }
});

module.exports = router; 