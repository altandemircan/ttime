
function getSuggestions(query) {
    if (!query || query.length < 2) return [];

    const q = query.toLowerCase();

    // 1. Önce State'lerde ara (Istanbul, London vb. burada)
    const states = State.getAllStates()
        .filter(s => s.name.toLowerCase().includes(q))
        .map(s => ({
            name: s.name,
            country: s.countryCode,
            lat: s.latitude,
            lon: s.longitude,
            type: 'state'
        }));

    // 2. Sonra City'lerde ara (İlçeler ve küçük şehirler)
    const cities = City.getAllCities()
        .filter(c => c.name.toLowerCase().includes(q))
        .map(c => ({
            name: c.name,
            country: c.countryCode,
            lat: c.latitude,
            lon: c.longitude,
            type: 'city'
        }));

    // İkisini birleştir, ilk 10 sonucu dön
    const combined = [...states, ...cities].slice(0, 10);
    
    return combined;
}