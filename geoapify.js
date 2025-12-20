const fetch = require("node-fetch");

const GEOAPIFY_KEY = process.env.GEOAPIFY_KEY;

// Genel Geoapify GET proxy fonksiyonu
async function geoapifyGet(endpoint, params = {}) {
  if (!GEOAPIFY_KEY) throw new Error("Geoapify API key missing!");

  const searchParams = new URLSearchParams({ ...params, apiKey: GEOAPIFY_KEY });
  const url = `https://api.geoapify.com${endpoint}?${searchParams.toString()}`;

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Geoapify error: ${resp.status}`);
  return await resp.json();
}

// Autocomplete endpoint’i
// Node.js backend'de (proxy kodunuzda)

async function autocomplete(query, limit = 10) {
  const data = await geoapifyGet("/v1/geocode/autocomplete", {
    text: query,
    limit: limit + 10, // Daha fazla sonuç al
    filter: "countrycode:tr", // Sadece Türkiye (opsiyonel)
    bias: "countrycode:tr" // Türkiye'ye öncelik ver
  });
  
  // Backend'de filtreleme yap
  const filteredFeatures = (data.features || []).filter(item => {
    const p = item.properties || {};
    const name = (p.name || "").toLowerCase();
    const type = (p.result_type || '').toLowerCase();
    
    // Ticari sonuçları filtrele
    if (name.includes("finance center") || 
        name.includes("business center") ||
        name.includes("shopping")) {
      return false;
    }
    
    // Türkiye'deki büyük şehirler için county/administrative tiplerini kabul et
    const turkishBigCities = ['istanbul', 'izmir', 'ankara', 'antalya'];
    const isBigCityQuery = turkishBigCities.some(city => 
      query.toLowerCase().includes(city)
    );
    
    if (isBigCityQuery) {
      return ['city', 'county', 'administrative', 'region'].includes(type);
    }
    
    return ['city', 'town', 'village', 'municipality'].includes(type);
  });
  
  return {
    ...data,
    features: filteredFeatures.slice(0, limit)
  };
}

// Places search endpoint’i
async function places({ categories, lon, lat, radius = 6000, limit = 10 }) {
  return geoapifyGet("/v2/places", {
    categories,
    filter: `circle:${lon},${lat},${radius}`,
    limit
  });
}

// YENİ: Bölgeye yakın şehirleri çek
async function nearbyCities({ lat, lon, radius = 80000, limit = 10 }) {
  return geoapifyGet("/v1/geocode/search", {
    lat,
    lon,
    type: "city",
    radius,
    limit
  });
}

module.exports = {
  autocomplete,
  places,
  nearbyCities
};