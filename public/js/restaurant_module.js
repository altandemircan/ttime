
function showMarkerOnExpandedMap(lat, lon, name, day) {
  // Büyük harita (expand map)
  const expObj = window.expandedMaps && window.expandedMaps[`route-map-day${day}`];
  const bigMap = expObj && expObj.expandedMap;
  if (bigMap) {
    L.marker([lat, lon]).addTo(bigMap).bindPopup(`<b>${name}</b>`);
  }
}
function showSearchButton(lat, lng, map, options = {}) {
    // Sadece test için alert bırakabilirsin (çalıştığı belli)
    // alert(`Polyline tıklama noktası: ${lat}, ${lng}`);

    const bufferMeters = options.radius || 1000;
    const apiKey = window.GEOAPIFY_API_KEY || "d9a0dce87b1b4ef6b49054ce24aeb462";
    const categories = options.categories || "catering.restaurant";
    const url = `https://api.geoapify.com/v2/places?categories=${categories}&filter=circle:${lng},${lat},${bufferMeters}&limit=50&apiKey=${apiKey}`;

    // Haritada buton göster
    const button = L.control({position: 'topright'});
    button.onAdd = function () {
        const div = L.DomUtil.create('div', 'custom-search-btn');
        div.innerHTML = '<button id="search-restaurants-btn" style="padding:8px 16px;border-radius:8px;background:#1976d2;color:#fff;font-weight:600;">Bu alanda restoran ara</button>';
        div.onclick = async function() {
            // Restoranları çek
            const resp = await fetch(url);
            const data = await resp.json();
            if (!data.features || data.features.length === 0) {
                alert("Bu alanda restoran bulunamadı!");
                map.removeControl(button);
                return;
            }
            data.features.forEach(f => {
                L.marker([f.properties.lat, f.properties.lon])
                    .addTo(map)
                    .bindPopup(`<b>${f.properties.name || "Restoran"}</b>`);
            });
            alert(`Bu alanda ${data.features.length} restoran bulundu.`);
            map.removeControl(button);
        };
        return div;
    };
    button.addTo(map);
}
async function searchRestaurantsAt(lat, lng, map) {
    const bufferMeters = 1000; // 1 km çap
    const apiKey = window.GEOAPIFY_API_KEY || "d9a0dce87b1b4ef6b49054ce24aeb462";
    const url = `https://api.geoapify.com/v2/places?categories=catering.restaurant&filter=circle:${lng},${lat},${bufferMeters}&limit=50&apiKey=${apiKey}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (!data.features || data.features.length === 0) {
        alert("Bu alanda restoran bulunamadı!");
        return;
    }
    data.features.forEach(f => {
        L.marker([f.properties.lat, f.properties.lon])
            .addTo(map)
            .bindPopup(`<b>${f.properties.name || "Restoran"}</b>`);
    });
    alert(`Bu alanda ${data.features.length} restoran bulundu.`);
}

// Shows nearest restaurants/cafes/bars when the route polyline is clicked
function addRoutePolylineWithClick(map, coords) {
    const routeLine = L.polyline(coords, {
        color: '#1976d2',
        weight: 7,
        opacity: 0.93
    }).addTo(map);

    routeLine.on('click', async function(e) {
        const lat = e.latlng.lat, lng = e.latlng.lng;
        const radiusMeters = 1000;
        const MAX_DISTANCE_METERS = 2200; // 2.2km'den uzakları gösterme
        const apiKey = window.GEOAPIFY_API_KEY || "d9a0dce87b1b4ef6b49054ce24aeb462";
        const categories = [
            "catering.restaurant",
            "catering.cafe",
            "catering.bar",
            "catering.fast_food",
            "catering.pub"
        ].join(",");
        const url = `https://api.geoapify.com/v2/places?categories=${categories}&filter=circle:${lng},${lat},${radiusMeters}&limit=200&apiKey=${apiKey}`;

        // DOĞRU: RESTORANLARI ÇEK
        const response = await fetch(url);
        const data = await response.json();

        if (!data.features || data.features.length === 0) {
            alert("No restaurant/cafe/bar found in this area!");
            return;
        }

        // Filter valid results, sort by distance
        const haversine = (lat1, lon1, lat2, lon2) => {
            const R = 6371000, toRad = x => x * Math.PI / 180;
            const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
            const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
            return 2 * R * Math.asin(Math.sqrt(a));
        };

        const nearest10 = data.features
            .filter(f => Number.isFinite(f.properties.lat) && Number.isFinite(f.properties.lon))
            .map(f => ({
                ...f,
                distance: haversine(lat, lng, f.properties.lat, f.properties.lon)
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 10);

        if (nearest10.length === 0) {
            alert("No nearby restaurant/cafe/bar found!");
            return;
        }

        nearest10.forEach((f, idx) => {
            setTimeout(() => {
                // Draw line from clicked point to restaurant
                L.polyline([
                    [lat, lng],
                    [f.properties.lat, f.properties.lon]
                ], {
                    color: "#22bb33",
                    weight: 4,
                    opacity: 0.95,
                    dashArray: "8,8"
                }).addTo(map);

                // Purple marker
                const icon = L.divIcon({
                    html: getPurpleRestaurantMarkerHtml(),
                    className: "",
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                });
                const marker = L.marker([f.properties.lat, f.properties.lon], { icon }).addTo(map);
                const address = f.properties.formatted || "";
                const name = f.properties.name || "Restaurant";
                const imgId = `rest-img-${f.properties.place_id || idx}`;
                marker.bindPopup(getFastRestaurantPopupHTML(f, imgId, window.currentDay || 1), { maxWidth: 340 });
                marker.on("popupopen", function() {
                    handlePopupImageLoading(f, imgId);
                });
            }, idx * 120);
        });

        alert(`The ${nearest10.length} closest restaurant/cafe/bar locations have been displayed.`);
    });

    return routeLine;
}
function showRouteInfoBanner(day) {
  const banner = document.getElementById('route-info-banner');
  if (!banner) return;

  // Banner'ı görünür yap
  banner.style.display = 'flex';
  
  // Kullanıcının tıklanabilir olduğunu anlaması için imleci 'el' yap
  banner.style.cursor = 'pointer';

  // --- TÜM KUTUYA TIKLAMA OLAYI ---
  // (İçindeki X butonuna, yazıya veya boşluğa tıklansa da çalışır)
  banner.onclick = function() {
    banner.style.display = 'none';
  };
}
async function getRestaurantPopupHTML(f, day) {
    const name = f.properties.name || "Restoran";
    const address = f.properties.formatted || "";
    const lat = f.properties.lat;
    const lon = f.properties.lon;
    // Stock fotoğraf çek (Pexels, Pixabay, fallback img)
    let img = "img/restaurant_icon.svg";
    try {
        img = await getImageForPlace(name, "restaurant", window.selectedCity || "");
    } catch(e) { /* fallback kullan */ }

    return `
      <div class="point-item" style="display: flex; align-items: center; gap: 12px; padding: 8px; background: #f8f9fa; border-radius: 8px; margin-bottom: 8px;">
        <div class="point-image" style="width: 42px; height: 42px; position: relative;">
          <img src="${img}" alt="${name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px; opacity: 1;">
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 16px;">🍽️</div>
        </div>
        <div class="point-info" style="flex: 1; min-width: 0;">
          <div class="point-name-editor" style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
            <span style="font-weight: 500; font-size: 14px; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${name}</span>
          </div>
          <div class="point-address" style="font-size: 12px; color: #666; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${address}
          </div>
        </div>
        <div class="point-actions" style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
          <button class="add-point-to-cart-btn" style="width: 32px; height: 32px; background: #1976d2; color: white; border: none; border-radius: 50%; font-size: 16px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center;"
            onclick="window.addRestaurantToTrip('${name.replace(/'/g,"")}', '${img}', '${address.replace(/'/g,"")}', ${day}, ${lat}, ${lon})">+</button>
        </div>
      </div>
    `;
}


function handlePopupImageLoading(f, imgId) {
    getImageForPlace(f.properties.name, "restaurant", window.selectedCity || "")
        .then(src => {
            const img = document.getElementById(imgId);
            const spin = document.getElementById(imgId + "-spin");
            if (img && src) {
                img.src = src;
                img.classList.remove("hidden-img");
                // Eğer görsel cache'den geldiyse spinnerı hemen kaldır
                if (img.complete && img.naturalWidth !== 0 && spin) spin.style.display = "none";
            }
            if (img) {
                img.onload = () => { if (spin) spin.style.display = "none"; img.classList.remove("hidden-img"); };
                img.onerror = () => { if (spin) spin.style.display = "none"; img.classList.add("hidden-img"); };
            } else if (spin) {
                spin.style.display = "none";
            }
        })
        .catch(() => {
            const spin = document.getElementById(imgId + "-spin");
            const img = document.getElementById(imgId);
            if (spin) spin.style.display = "none";
            if (img) img.classList.add("hidden-img");
        });
}
function getFastRestaurantPopupHTML(f, imgId, day) {
    ensureSpinnerCSS();
    const name = f.properties.name || "Restoran";
    const address = f.properties.formatted || "";
    const lat = f.properties.lat;
    const lon = f.properties.lon;
    return `
      <div class="point-item" style="display: flex; align-items: center; gap: 12px; padding: 8px; background: #f8f9fa; border-radius: 8px; margin-bottom: 8px;">
        <div class="point-image" style="width: 42px; height: 42px; position: relative;">
          <img id="${imgId}" class="hidden-img" src="" alt="${name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">
          <div class="img-loading-spinner" id="${imgId}-spin"></div>
        </div>
        <div class="point-info" style="flex: 1; min-width: 0;">
          <div class="point-name-editor" style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
            <span style="font-weight: 500; font-size: 14px; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${name}</span>
          </div>
          <div class="point-address" style="font-size: 12px; color: #666; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${address}</div>
        </div>
        <div class="point-actions" style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
          <button class="add-point-to-cart-btn"
  onclick="window.addRestaurantToTripFromPopup('${imgId}', '${name.replace(/'/g,"")}', '${address.replace(/'/g,"")}', ${day}, ${lat}, ${lon})"
            style="width: 32px; height: 32px; background: #1976d2; color: white; border: none; border-radius: 50%; font-size: 16px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center;">
            +
          </button>
        </div>
      </div>
    `;
}

function ensureSpinnerCSS() {
    if (document.getElementById('img-loading-spinner-style')) return;
    const style = document.createElement('style');
    style.id = 'img-loading-spinner-style';
    style.innerHTML = `
    .img-loading-spinner {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 32px; height: 32px;
      border: 4px solid #eee;
      border-top: 4px solid #1976d2;
      border-radius: 50%;
      animation: img-spin 1s linear infinite;
      z-index: 2;
    }
    @keyframes img-spin {
      to { transform: translate(-50%, -50%) rotate(360deg); }
    }
    .hidden-img { display: none !important; }
    `;
    document.head.appendChild(style);
}
window.addRestaurantToTripFromPopup = function(imgId, name, address, day, lat, lon) {
    const img = document.getElementById(imgId);
    // Eğer görsel yüklendiyse onun src'sini, yoksa fallback'i kullan
    const imgSrc = (img && img.src && img.src !== "" && !img.classList.contains("hidden-img"))
        ? img.src
        : 'https://dev.triptime.ai/img/restaurant_icon.svg';
    addToCart(
        name,
        imgSrc,
        day,
        "Restaurant",
        address,
        null, null, null, null,
        { lat: Number(lat), lng: Number(lon) },
        ""
    );
    if (typeof updateCart === "function") updateCart();
    alert(`${name} gezi planına eklendi!`);
};
function getRedRestaurantMarkerHtml() {
    return `
      <div class="custom-marker-outer red" style="position:relative;">
        <span class="custom-marker-label">R</span>
      </div>
    `;
}

// Returns custom purple restaurant marker HTML
function getPurpleRestaurantMarkerHtml() {
    return `
      <div class="custom-marker-outer" style="
        position:relative;
        width:32px;height:32px;
        background:#8a4af3;
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        box-shadow:0 2px 8px #888;
        border:2px solid #fff;
      ">
        <img src="https://www.svgrepo.com/show/327200/restaurant-sharp.svg"
             style="width:18px;height:18px;filter:invert(1) brightness(2);" alt="Restaurant">
      </div>
    `;
}

// Add restaurant to trip/cart (called from popup button)
window.addRestaurantToTrip = function(name, image, address, day, lat, lon) {
    addToCart(
        name,
        image || 'img/restaurant_icon.svg',
        day,
        "Restaurant",
        address,
        null, null, null, null,
        { lat: Number(lat), lng: Number(lon) },
        ""
    );
    if (typeof updateCart === "function") updateCart();
    alert(`${name} added to your trip!`);
};

function addRouteWithRestaurantClick(expandedMap, geojson) {
    // Polyline ve varsa eski markerların hepsini temizle
    expandedMap.eachLayer(l => {
        // MaplibreGL layer'ı hariç sil! Zemin kaybolmasın diye
        if (
            (l instanceof L.Polyline || l instanceof L.Marker) &&
            !(l.options && l.options.pane === "tilePane") && // Maplibre default tilePane'de duruyor olabilir
            !(l._maplibreLayer === true)
        ) {
            try { expandedMap.removeLayer(l); } catch (_) {}
        }
    });
    // Temizle
    expandedMap.__restaurantLayers = [];

    // Çift tıkla zoom'u bu expandedMap'te EVRENSEL KAPAT
    expandedMap.doubleClickZoom.disable?.();

    if (!geojson?.features?.[0]?.geometry?.coordinates?.length) return;

    const coords = geojson.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
    const routePolyline = L.polyline(coords, {
        color: "#1976d2",
        weight: 7,
        opacity: 0.93,
        interactive: true
    }).addTo(expandedMap);

    // Çift tıkla zoomu polyline üzerinde de tamamen blokla
    routePolyline.on('dblclick', function(e) {
        if (e) {
            if (e.originalEvent) e.originalEvent.preventDefault();
            L.DomEvent.stop(e);
        }
        return false;
    });

    routePolyline.on('click', async function(e) {
        // Eski restoran marker ve çizgileri temizle (sadece bunlar!)
        expandedMap.__restaurantLayers.forEach(l => {
            if (l && l.remove) { try { l.remove(); } catch(_) {} }
        });
        expandedMap.__restaurantLayers = [];

        const lat = e.latlng.lat, lng = e.latlng.lng;
        const apiKey = window.GEOAPIFY_API_KEY || "d9a0dce87b1b4ef6b49054ce24aeb462";
        const categories = "catering.restaurant,catering.cafe,catering.bar,catering.fast_food,catering.pub";
        const url = `https://api.geoapify.com/v2/places?categories=${categories}&filter=circle:${lng},${lat},1000&limit=20&apiKey=${apiKey}`;
        try {
            const resp = await fetch(url);
            const data = await resp.json();
            if (!data.features || data.features.length === 0) {
                alert("Bu bölgede restoran/kafe/bar bulunamadı!");
                return;
            }
            data.features.forEach((f, idx) => {
                const guideLine = L.polyline([[lat, lng], [f.properties.lat, f.properties.lon]], {
                    color: "#22bb33",
                    weight: 4,
                    opacity: 0.95,
                    dashArray: "8,8",
                    interactive: true
                }).addTo(expandedMap);
                expandedMap.__restaurantLayers.push(guideLine);

                const icon = L.divIcon({
                    html: getPurpleRestaurantMarkerHtml(),
                    className: "",
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                });
                const marker = L.marker([f.properties.lat, f.properties.lon], { icon }).addTo(expandedMap);
                expandedMap.__restaurantLayers.push(marker);

                const imgId = `rest-img-${f.properties.place_id || idx}`;
                marker.bindPopup(getFastRestaurantPopupHTML(f, imgId, window.currentDay || 1), { maxWidth: 340 });
                marker.on("popupopen", function() {
                    handlePopupImageLoading(f, imgId);
                });
            });
            alert(`Bu alanda ${data.features.length} restoran/kafe/bar gösterildi.`);
        } catch (err) {
            alert("Restoranları çekerken hata oluştu. Lütfen tekrar deneyin.");
        }
    });
}