const { City, State } = require('country-state-city');

function getSuggestions(query) {
    if (!query || query.length < 2) return [];

    const q = query.toLowerCase().trim();
    console.log(`[LocalCities] Searching for: "${q}"`);

    // 1. Önce State'lerde ara (Istanbul, London vb. burada)
    const states = State.getAllStates()
        .filter(s => s.name && s.name.toLowerCase().includes(q))
        .map(s => ({
            name: s.name,
            countryCode: s.countryCode,
            latitude: s.latitude,
            longitude: s.longitude,
            type: 'state'
        }));

    // 2. Sonra City'lerde ara (İlçeler ve küçük şehirler)
    const cities = City.getAllCities()
        .filter(c => c.name && c.name.toLowerCase().includes(q))
        .map(c => ({
            name: c.name,
            countryCode: c.countryCode,
            latitude: c.latitude,
            longitude: c.longitude,
            type: 'city'
        }));

    // İkisini birleştir, ilk 10 sonucu dön
    const combined = [...states, ...cities].slice(0, 10);
    
    console.log(`[LocalCities] Found ${combined.length} results`);
    return combined;
}

module.exports = { getSuggestions };