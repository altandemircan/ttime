
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

// Ana fonksiyon — ÇİZGİ, MARKER, POPUP, SPINNER, FOTO HER ŞEY DAHİL!
function addRoutePolylineWithClick(map, coords) {
    const polyline = L.polyline(coords, {
        color: '#1976d2',
        weight: 7,
        opacity: 0.93
    }).addTo(map);

    // --- When polyline is clicked, open a popup ---
    polyline.on('click', async function(e) {
        if (e.originalEvent) e.originalEvent.stopPropagation();

        // Show popup info to the user
        polyline.bindPopup(
            `<b>Nearby restaurants will be listed</b><br>
             <span style="font-size:13px;color:#333;">The closest restaurant/cafe/bar locations will be displayed below.</span>`, 
            { maxWidth: 320 }
        ).openPopup(e.latlng);

        const lat = e.latlng.lat, lng = e.latlng.lng;
        const bufferMeters = 1000;
        const apiKey = window.GEOAPIFY_API_KEY || "d9a0dce87b1b4ef6b49054ce24aeb462";
        const categories = [
            "catering.restaurant",
            "catering.cafe",
            "catering.bar",
            "catering.fast_food",
            "catering.pub"
        ].join(",");
        const url = `https://api.geoapify.com/v2/places?categories=${categories}&filter=circle:${lng},${lat},${bufferMeters}&limit=50&apiKey=${apiKey}`;
        const resp = await fetch(url);
        const data = await resp.json();

        if (!data.features || data.features.length === 0) {
            alert("No restaurant/cafe/bar found in this area!");
            return;
        }

        // Sort the 10 nearest places
        const haversine = (lat1, lon1, lat2, lon2) => {
            const R = 6371000, toRad = x => x * Math.PI / 180;
            const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
            const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
            return 2 * R * Math.asin(Math.sqrt(a));
        };
        const nearest10 = data.features
            .map(f => ({
                ...f,
                distance: haversine(lat, lng, f.properties.lat, f.properties.lon)
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 10);

        nearest10.forEach((f, idx) => {
            // --- Green line ---
            L.polyline([
                [lat, lng],
                [f.properties.lat, f.properties.lon]
            ], {
                color: "#22bb33", // GREEN
                weight: 4,
                opacity: 0.95,
                dashArray: "8,8"
            }).addTo(map);

            // --- Purple marker ---
            const icon = L.divIcon({
                html: getPurpleRestaurantMarkerHtml(),
                className: "",
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });
            const marker = L.marker([f.properties.lat, f.properties.lon], { icon }).addTo(map);

            // Popup
            const imgId = `rest-img-${f.properties.place_id || idx}`;
            const html = getFastRestaurantPopupHTML(f, imgId, window.currentDay || 1);
            marker.bindPopup(html, { maxWidth: 320 });
            marker.on("popupopen", function() {
                handlePopupImageLoading(f, imgId);
            });
        });

        alert(`The ${nearest10.length} closest restaurant/cafe/bar locations have been displayed.`);
    });

    return polyline;
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

window.addRestaurantToTrip = function(name, image, address, day, lat, lon) {
    addToCart(
        name,
        image,
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

function showRouteInfoBanner() {
  const banner = document.getElementById('route-info-banner');
  if (!banner) return;
  banner.style.display = 'flex';

  // Kapatınca gizle
  document.getElementById('close-route-info').onclick = () => {
    banner.style.display = 'none';
  };

  // İstersen otomatik gizle (ör. 8 saniye sonra)
  // setTimeout(() => banner.style.display = "none", 8000);
}

// Haritayı açtığında çağır:
