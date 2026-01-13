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
    
    const prompt = `You are a knowledgeable local tour guide in ${city}. 
A traveler clicked on a point called "${point}" on the map.

${factsContext}

IMPORTANT GUIDELINES:
1. Focus ONLY on "${point}" specifically, not the general area
2. Use the provided context to make your description accurate
3. Keep it brief, practical and useful for a traveler
4. Be specific about what makes "${point}" unique or interesting
5. The tip should be practical advice for visiting "${point}"

Return ONLY this valid JSON (no explanation, no markdown, no text outside JSON!):
{
  "p1": "brief description about ${point} in ${city}",
  "p2": "one practical tip about visiting ${point}"
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
        const response = await axios.post('http://127.0.0.1:11434/api/generate', {
            model: "llama3:8b",
            prompt: prompt,
            stream: false,
            options: {
                temperature: 0.7,
                top_p: 0.9,
                repeat_penalty: 1.1,
                num_predict: 200 // Artırdım çünkü daha fazla context var
            }
        }, { timeout: 60000 });

        let result = { p1: "", p2: "" };
        let content = response.data?.response || "{}";
        
        try {
            // JSON'u temizle (eğer AI ekstra text eklerse)
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                content = jsonMatch[0];
            }
            
            result = JSON.parse(content);
            result = {
                p1: result.p1 || `Explore ${point} in ${city}.`,
                p2: result.p2 || `Check opening hours before visiting.`
            };
        } catch (parseErr) {
            console.error('AI JSON parse error:', parseErr.message, "Content:", content.substring(0, 200));
            
            // Fallback: Eğer JSON parse edilemezse, içeriği manuel parse etmeye çalış
            const lines = content.split('\n').filter(line => line.trim());
            if (lines.length >= 2) {
                result.p1 = lines[0].replace(/^["']|["']$/g, '').trim();
                result.p2 = lines[1].replace(/^["']|["']$/g, '').trim();
            } else {
                result.p1 = `${point} is located in ${city}. It's worth exploring.`;
                result.p2 = `Consider visiting during daylight hours for the best experience.`;
            }
        }

        console.log(`[AI RESPONSE for ${point}]`, {
            city: city,
            factsUsed: Object.keys(facts || {}).length,
            responseLength: result.p1.length + result.p2.length
        });
        
        res.json(result);

    } catch (e) {
        console.error("AI error:", e.message);
        
        // Fallback response
        res.json({ 
            p1: `${point} is a location in ${city}. It offers a unique experience for visitors.`,
            p2: `Plan your visit according to the weather and local conditions.`
        });
    }
});

module.exports = router;

module.exports = router; 