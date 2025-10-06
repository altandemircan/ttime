const fetch = require("node-fetch");

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;

// Directions API (rota çizimi)
async function directions({ coordinates, profile = "walking", alternatives = false, overview = "full", geometries = "geojson" }) {
  if (!MAPBOX_TOKEN) throw new Error("Mapbox token missing!");
  if (!coordinates) throw new Error("Coordinates required!");

  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}?alternatives=${alternatives}&geometries=${geometries}&overview=${overview}&access_token=${MAPBOX_TOKEN}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Mapbox error: ${resp.status}`);
  return await resp.json();
}

// Geocoding API (adres/yer arama)
async function geocode({ query, limit = 5 }) {
  if (!MAPBOX_TOKEN) throw new Error("Mapbox token missing!");
  if (!query) throw new Error("Query required!");

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=${limit}&access_token=${MAPBOX_TOKEN}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Mapbox geocode error: ${resp.status}`);
  return await resp.json();
}

module.exports = {
  directions,
  geocode
};