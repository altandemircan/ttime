const { City } = require('country-state-city');

// Performans için tüm şehirleri bir kez hafızaya alıyoruz
const allCities = City.getAllCities();

/**
 * Şehir ismine göre yerel veritabanında arama yapar
 * @param {string} query - Arama metni
 * @param {number} limit - Maksimum sonuç sayısı
 */
function searchCities(query, limit = 10) {
    if (!query || query.length < 2) return [];

    const search = query.toLowerCase();

    // Filtreleme: İsim içerenleri bul ve limit kadarını döndür
    return allCities
        .filter(city => city.name.toLowerCase().includes(search))
        .slice(0, limit)
        .map(city => ({
            name: city.name,
            countryCode: city.countryCode,
            latitude: city.latitude,
            longitude: city.longitude
        }));
}

module.exports = {
    searchCities
};