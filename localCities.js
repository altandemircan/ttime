const { City, State } = require("country-state-city");

// Suggestion fonksiyonun tam olarak böyle olmalı:
const searchGlobal = (query) => {
    const q = query.toLowerCase();

    // 1. Eyalet/İl listesinde ara (İstanbul, London, New York burada)
    const states = State.getAllStates()
        .filter(s => s.name.toLowerCase().startsWith(q))
        .map(s => ({ ...s, label: s.name, type: 'state' }));

    // 2. Şehir/İlçe listesinde ara (Kadıköy, Westminster burada)
    const cities = City.getAllCities()
        .filter(c => c.name.toLowerCase().startsWith(q))
        .map(c => ({ ...c, label: c.name, type: 'city' }));

    // İkisini birleştir, ilk 10-15 sonucu fırlat
    return [...states, ...cities].slice(0, 15);
}; 