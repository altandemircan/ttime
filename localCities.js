const { City, State } = require("country-state-city");

function getSuggestions(query) {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();

    const states = State.getAllStates()
        .filter(s => s.name.toLowerCase().includes(q))
        .map(s => ({
            name: s.name,
            countryCode: s.countryCode, // Frontend beklentisine göre isimlendirmeyi koru
            latitude: s.latitude,
            longitude: s.longitude,
            type: 'state'
        }));

    const cities = City.getAllCities()
        .filter(c => c.name.toLowerCase().includes(q))
        .map(c => ({
            name: c.name,
            countryCode: c.countryCode,
            latitude: c.latitude,
            longitude: c.longitude,
            type: 'city'
        }));

    return [...states, ...cities].slice(0, 10);
}

module.exports = { getSuggestions }; // Bunu eklemezsen server.js'den çağıramazsın