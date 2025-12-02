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