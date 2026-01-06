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
async function autocomplete(query, limit = 6) {
  return geoapifyGet("/v1/geocode/autocomplete", {
    text: query,
    limit
  });
}

// Places search endpoint’i
async function places({ categories, lon, lat, radius = 6000, limit = 10 }) {
  return geoapifyGet("/v2/places", {
    categories,
    filter: `circle:${lon},${lat},${radius}`,
    limit
  });
}

// Bölgeye yakın şehirleri çek
async function nearbyCities({ lat, lon, radius = 80000, limit = 10 }) {
  return geoapifyGet("/v1/geocode/search", {
    lat,
    lon,
    type: "city",
    radius,
    limit
  });
}

// YENİ: Yakın yerleri getir (3 kategori)
async function nearbyPlaces({ lat, lon, radius = 25000 }) {
  try {
    // 1. Yerleşim (köy, kasaba, şehir)
    const settlement = await geoapifyGet("/v2/places", {
      categories: "place.city,place.town,place.village,place.suburb",
      filter: `circle:${lon},${lat},${radius}`,
      limit: 1,
      bias: `proximity:${lon},${lat}`
    });

    // 2. Doğa
    const nature = await geoapifyGet("/v2/places", {
      categories: "natural,leisure.park,beach",
      filter: `circle:${lon},${lat},${radius}`,
      limit: 1,
      bias: `proximity:${lon},${lat}`
    });

    // 3. Tarihi
    const historic = await geoapifyGet("/v2/places", {
      categories: "historic,heritage,tourism.attraction,tourism.museum",
      filter: `circle:${lon},${lat},${radius}`,
      limit: 1,
      bias: `proximity:${lon},${lat}`
    });

    return {
      settlement: settlement.features?.[0]?.properties || null,
      nature: nature.features?.[0]?.properties || null,
      historic: historic.features?.[0]?.properties || null
    };
  } catch (error) {
    console.error("Nearby places error:", error);
    return { settlement: null, nature: null, historic: null };
  }
}

module.exports = {
  autocomplete,
  places,
  nearbyCities,
  nearbyPlaces
};