// Görsel doğrulama fonksiyonu
async function isImageValid(url, timeout = 3000) {
    if (!url || url === PLACEHOLDER_IMG) return false;
    
    return new Promise((resolve) => {
        const img = new Image();
        const timer = setTimeout(() => {
            img.onload = img.onerror = null;
            resolve(false);
        }, timeout);
        
        img.onload = function() {
            clearTimeout(timer);
            resolve(this.width >= 50 && this.height >= 50);
        };
        
        img.onerror = function() {
            clearTimeout(timer);
            resolve(false);
        };
        
        img.src = url;
    });
}

// Görsel hata yönetimi
window.handleImageError = async function(imgElement, placeName, index) {
    if (imgElement.dataset.errorHandled === 'true') {
        imgElement.src = PLACEHOLDER_IMG;
        return;
    }
    
    imgElement.dataset.errorHandled = 'true';
    
    const loadingDiv = imgElement.parentNode?.querySelector('.img-loading');
    if (loadingDiv) {
        loadingDiv.style.opacity = '1';
    }
    
    try {
        const backupSources = [
            () => getPixabayImage && getPixabayImage(placeName),
            () => getPexelsImage && getPexelsImage(placeName.split(' ')[0])
        ];
        
        for (const getBackup of backupSources) {
            try {
                const backupUrl = await getBackup();
                if (backupUrl && backupUrl !== PLACEHOLDER_IMG && await isImageValid(backupUrl)) {
                    imgElement.src = backupUrl;
                    if (loadingDiv) loadingDiv.style.opacity = '0';
                    return;
                }
            } catch (e) {
                console.warn('Backup image source failed:', e);
            }
        }
    } catch (error) {
        console.warn('Error handling image fallback:', error);
    }
    
    imgElement.src = PLACEHOLDER_IMG;
    if (loadingDiv) loadingDiv.style.opacity = '0';
};

function showMarkerOnExpandedMap(lat, lon, name, day) {
  // Büyük harita (expand map)
  const expObj = window.expandedMaps && window.expandedMaps[`route-map-day${day}`];
  const bigMap = expObj && expObj.expandedMap;
  if (bigMap) {
    L.marker([lat, lon]).addTo(bigMap).bindPopup(`<b>${name}</b>`);
  }
}

// Seçilen nokta için fotoğraf yükleme fonksiyonu
async function loadClickedPointImage(pointName) {
    const img = document.getElementById('clicked-point-img');
    if (!img) return;

    try {
        let imageUrl = null;
        
        // Önce Pexels'tan dene
        if (typeof getPexelsImage === "function") {
            try {
                imageUrl = await getPexelsImage(pointName + " " + (window.selectedCity || ""));
                if (imageUrl && imageUrl !== PLACEHOLDER_IMG && await isImageValid(imageUrl)) {
                    img.src = imageUrl;
                    img.style.opacity = "1";
                    return;
                }
            } catch (e) {
                console.warn('Pexels image failed:', e);
            }
        }
        
        // Sonra Pixabay'dan dene
        if (typeof getPixabayImage === "function") {
            try {
                imageUrl = await getPixabayImage(pointName);
                if (imageUrl && imageUrl !== PLACEHOLDER_IMG && await isImageValid(imageUrl)) {
                    img.src = imageUrl;
                    img.style.opacity = "1";
                    return;
                }
            } catch (e) {
                console.warn('Pixabay image failed:', e);
            }
        }
        
        // Hiçbiri çalışmazsa placeholder kalsın ama opacity'yi düzelt
        img.style.opacity = "0.6";
        
    } catch (error) {
        console.warn('Image loading error:', error);
        img.style.opacity = "0.6";
    }
}

// Nokta adını düzenleme fonksiyonu
window.editPointName = function() {
    const displaySpan = document.getElementById('point-name-display');
    const inputField = document.getElementById('point-name-input');
    
    if (!displaySpan || !inputField) return;
    
    // Display'i gizle, input'u göster
    displaySpan.style.display = 'none';
    inputField.style.display = 'flex';
    inputField.focus();
    inputField.select();
    
    // Enter veya blur ile kaydet
    const saveEdit = function() {
        const newName = inputField.value.trim();
        if (newName) {
            displaySpan.textContent = newName;
            if (window._currentPointInfo) {
                window._currentPointInfo.name = newName;
            }
        }
        // Input'u gizle, display'i göster
        inputField.style.display = 'none';
        displaySpan.style.display = 'block';
    };
    
    inputField.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            saveEdit();
        } else if (e.key === 'Escape') {
            // İptal et - orijinal değeri koru
            inputField.value = displaySpan.textContent;
            inputField.style.display = 'none';
            displaySpan.style.display = 'block';
        }
    });
    
    inputField.addEventListener('blur', saveEdit);
};

// Güncellenen tıklanan noktayı sepete ekleme fonksiyonu
window.addClickedPointToCart = async function(lat, lng, day) {
    try {
        window.currentDay = parseInt(day); // Gün sabitleme

const pointInfo = window._currentPointInfo || { name: "Selected Point", address: "", opening_hours: "" };        const placeName = pointInfo.name;
        
        let imageUrl = "img/placeholder.png";
        if (typeof getPexelsImage === "function") {
            try {
                imageUrl = await getPexelsImage(placeName + " " + (window.selectedCity || ""));
            } catch (e) { /* ... */ }
        }
        
        addToCart(
            placeName,
            imageUrl,
            day,
            "Place",
            pointInfo.address || "",
            null, null,
            pointInfo.opening_hours || "",
            null,
            { lat: lat, lng: lng },
            ""
        );

        closeNearbyPopup();
        
    } catch (error) {
        console.error('Error adding point:', error);
    }
};
// updateCart() BURADAN SİLİNDİ! (addToCart zaten yapıyor)
if (typeof updateCart === "function") updateCart();

// FIX: addToCart fonksiyonunu da güncelleyelim
window.addNearbyPlaceToTripFromPopup = async function(idx, day, placeLat, placeLng) {
    if (!window._lastNearbyPlaces || !window._lastNearbyPlaces[idx]) return;
    
    // 1. Current Day'i sabitle
    window.currentDay = parseInt(day);

    const f = window._lastNearbyPlaces[idx];
    const photo = (window._lastNearbyPhotos && window._lastNearbyPhotos[idx]) ? window._lastNearbyPhotos[idx] : "img/placeholder.png";
    const actualLat = parseFloat(placeLat);
    const actualLng = parseFloat(placeLng);
    
    console.log(`Adding place: ${f.properties.name}`);
    
    // 2. addToCart (updateCart'ı bu tetikleyecek)
    addToCart(
        f.properties.name || "Unnamed",
        photo,
        day,
        "Place",
        f.properties.formatted || "",
        null, null,
        f.properties.opening_hours || "",
        null,
        { lat: actualLat, lng: actualLng },
        f.properties.website || ""
    );
    
    // updateCart() BURADAN SİLİNDİ!

    closeNearbyPopup();

    // 3. Expanded map varsa başarı popup'ı
    const expandedMapData = Object.values(window.expandedMaps || {}).find(m => m.day == day);
    if (expandedMapData && expandedMapData.expandedMap) {
        const map = expandedMapData.expandedMap;
        L.popup()
            .setLatLng([actualLat, actualLng])
            .setContent(`<div style="text-align:center;"><b>${f.properties.name}</b><br><small style="color:#4caf50;">✓ Added!</small></div>`)
            .openOn(map);
        setTimeout(() => map.closePopup(), 2000);
        // İsteğe bağlı: map.setView([actualLat, actualLng], map.getZoom(), { animate: true });
    }
};
if (typeof updateCart === "function") updateCart();

// Custom popup sistemi - Hem 2D hem 3D uyumlu
function showCustomPopup(lat, lng, map, content, showCloseButton = true) {
    // Önceki popup'ı kapat
    if (typeof closeNearbyPopup === 'function') closeNearbyPopup();
    
    // Popup container oluştur
    const popupContainer = document.createElement('div');
    popupContainer.id = 'custom-nearby-popup';
    
    const closeButtonHtml = showCloseButton ? `
        <button onclick="closeNearbyPopup()" class="nearby-popup-close-btn" title="Close">×</button>
    ` : '';
    
    popupContainer.innerHTML = `${closeButtonHtml}<div class="nearby-popup-content">${content}</div>`;
    document.body.appendChild(popupContainer);
    window._currentNearbyPopupElement = popupContainer;
    
    // --- PULSE MARKER EKLEME (Hem Leaflet hem MapLibre uyumlu) ---
    
    // 1. Temizlik
    if (window._nearbyPulseMarker) { 
        try { window._nearbyPulseMarker.remove(); } catch(_) {} 
        window._nearbyPulseMarker = null; 
    }
    if (window._nearbyPulseMarker3D) {
        try { window._nearbyPulseMarker3D.remove(); } catch(_) {}
        window._nearbyPulseMarker3D = null;
    }

    // 2. Marker HTML
    const pulseHtml = `
      <div class="nearby-pulse-marker">
        <div class="nearby-pulse-core"></div>
        <div class="nearby-pulse-ring"></div>
        <div class="nearby-pulse-ring2"></div>
      </div>
    `;

    // 3. Harita Tipine Göre Ekleme
    const isMapLibre = !!map.addSource; // MapLibre kontrolü

    if (isMapLibre) {
        // --- 3D MOD (MapLibre) ---
        const el = document.createElement('div');
        el.className = 'nearby-pulse-icon-wrapper'; // CSS class
        el.innerHTML = pulseHtml;
        
        window._nearbyPulseMarker3D = new maplibregl.Marker({ element: el })
            .setLngLat([lng, lat])
            .addTo(map);
            
    } else {
        // --- 2D MOD (Leaflet) ---
        const pulseIcon = L.divIcon({
            html: pulseHtml,
            className: 'nearby-pulse-icon-wrapper',
            iconSize: [18,18],
            iconAnchor: [9,9]
        });
        window._nearbyPulseMarker = L.marker([lat, lng], { icon: pulseIcon, interactive:false }).addTo(map);
    }
}

// Popup kapatma fonksiyonu
// Popup kapatma fonksiyonunu güncelle (tüm kategorileri temizleyecek şekilde)
window.closeNearbyPopup = function() {
  // 1. Popup DOM Elementini Kaldır
  const popupElement = document.getElementById('custom-nearby-popup');
  if (popupElement) {
    popupElement.remove();
  }
  
  // 2. Global Değişken Temizliği (Leaflet & MapLibre)
  if (window._nearbyPulseMarker) {
      try { window._nearbyPulseMarker.remove(); } catch(e) {}
      window._nearbyPulseMarker = null;
  }
  if (window._nearbyPulseMarker3D) {
      try { window._nearbyPulseMarker3D.remove(); } catch(e) {}
      window._nearbyPulseMarker3D = null;
  }

  // 3. TÜM KATEGORİLERİN MARKERLARINI TEMİZLE
  const categories = ['restaurant', 'hotel', 'market', 'entertainment'];
  
  categories.forEach(category => {
    // 3D MapLibre temizliği
    const marker3DKey = `_${category}3DMarkers`;
    const layer3DKey = `_${category}3DLayers`;
    
    if (window[marker3DKey]) {
      window[marker3DKey].forEach(m => { try { m.remove(); } catch(e){} });
      window[marker3DKey] = [];
    }
    
    if (window._maplibre3DInstance && window[layer3DKey]) {
      window[layer3DKey].forEach(id => {
        if (window._maplibre3DInstance.getLayer(id)) window._maplibre3DInstance.removeLayer(id);
        if (window._maplibre3DInstance.getSource(id)) window._maplibre3DInstance.removeSource(id);
      });
      window[layer3DKey] = [];
    }
  });

  // 4. LEAFLET KATMAN TARAMASI (Tüm kategoriler için)
  const mapsToCheck = [];
  if (window.leafletMaps) mapsToCheck.push(...Object.values(window.leafletMaps));
  if (window.expandedMaps) mapsToCheck.push(...Object.values(window.expandedMaps).map(o => o.expandedMap));

  mapsToCheck.forEach(map => {
      if (map && map.eachLayer) {
          // Önce kategori katmanlarını temizle
          const categoryLayers = ['restaurant', 'hotel', 'market', 'entertainment'];
          categoryLayers.forEach(category => {
              const layerKey = `__${category}Layers`;
              if (map[layerKey]) {
                  map[layerKey].forEach(l => {
                      try { l.remove(); } catch(e) {}
                  });
                  map[layerKey] = [];
              }
          });
          
          // Sonra pulse marker'ları temizle
          map.eachLayer(layer => {
              // 'nearby-pulse-icon-wrapper' veya 'custom-loc-icon-leaflet' classına sahip ikonları sil
              if (layer.options && layer.options.icon && layer.options.icon.options) {
                  const cls = layer.options.icon.options.className;
                  if (cls === 'nearby-pulse-icon-wrapper' || cls === 'custom-loc-icon-leaflet') {
                      try { map.removeLayer(layer); } catch(e) {}
                  }
              }
          });
      }
  });
  
  // 5. Diğer temizlikler
  if (window.leafletMaps) {
      Object.values(window.leafletMaps).forEach(map => {
          const categoryLayers = ['restaurant', 'hotel', 'market', 'entertainment'];
          categoryLayers.forEach(category => {
              const layerKey = `__${category}Layers`;
              if (map[layerKey]) {
                  map[layerKey].forEach(l => { try { l.remove(); } catch(e){} });
                  map[layerKey] = [];
              }
          });
      });
  }
  
  if (window.expandedMaps) {
      Object.values(window.expandedMaps).forEach(obj => {
          if (obj.expandedMap) {
              const categoryLayers = ['restaurant', 'hotel', 'market', 'entertainment'];
              categoryLayers.forEach(category => {
                  const layerKey = `__${category}Layers`;
                  if (obj.expandedMap[layerKey]) {
                      obj.expandedMap[layerKey].forEach(l => { try { l.remove(); } catch(e){} });
                      obj.expandedMap[layerKey] = [];
                  }
              });
          }
      });
  }

  window._currentNearbyPopupElement = null;
};
// Ayrıca, haritaya tıklandığında tüm kategorileri temizleyen fonksiyon
function clearAllCategoryMarkers(map) {
    const categories = ['restaurant', 'hotel', 'market', 'entertainment'];
    
    // 2D Harita (Leaflet) temizliği
    categories.forEach(category => {
        const layerKey = `__${category}Layers`;
        if (map && map[layerKey]) {
            map[layerKey].forEach(l => {
                try { l.remove(); } catch(e) {}
            });
            map[layerKey] = [];
        }
    });
    
    // 3D Harita (MapLibre) temizliği
    if (window._maplibre3DInstance === map) {
        categories.forEach(category => {
            const marker3DKey = `_${category}3DMarkers`;
            const layer3DKey = `_${category}3DLayers`;
            
            if (window[marker3DKey]) {
                window[marker3DKey].forEach(m => { try { m.remove(); } catch(e){} });
                window[marker3DKey] = [];
            }
            
            if (window[layer3DKey]) {
                window[layer3DKey].forEach(id => {
                    if (map.getLayer(id)) map.removeLayer(id);
                    if (map.getSource(id)) map.removeSource(id);
                });
                window[layer3DKey] = [];
            }
        });
    }
}
function showSearchButton(lat, lng, map, options = {}) {
    // PROXY KULLANIMI: Direct API key removed
    const bufferMeters = options.radius || 1000;
    const categories = options.categories || "catering.restaurant";
    const url = `/api/geoapify/places?categories=${categories}&lat=${lat}&lon=${lng}&radius=${bufferMeters}&limit=50`;

    // Haritada buton göster
    const button = L.control({position: 'topright'});
    button.onAdd = function () {
        const div = L.DomUtil.create('div', 'custom-search-btn');
        div.innerHTML = '<button id="search-restaurants-btn" style="padding:8px 16px;border-radius:8px;background:#1976d2;color:#fff;font-weight:600;">Bu alanda restoran ara</button>';
        div.onclick = async function() {
            // Restoranları çek
            try {
                const resp = await fetch(url);
                const data = await resp.json();
                if (!data.features || data.features.length === 0) {
                    alert("No restaurants found in this area!");

                    map.removeControl(button);
                    return;
                }
                data.features.forEach(f => {
                    L.marker([f.properties.lat, f.properties.lon])
                        .addTo(map)
                        .bindPopup(`<b>${f.properties.name || "Restoran"}</b>`);
                });
alert(`${data.features.length} restaurants found in this area.`);
                map.removeControl(button);
            } catch(e) {
                console.error("Search error:", e);
                alert("Restoranlar aranırken hata oluştu.");
            }
        };
        return div;
    };
    button.addTo(map);
}

// attachClickNearbySearch fonksiyonunu da güncelleyelim
function attachClickNearbySearch(map, day, options = {}) {
  const radius = options.radius || 500; 

  // Eski listener varsa temizle
  if (map.__ttNearbyClickBound) {
      map.off('click', map.__ttNearbyClickHandler);
      map.__ttNearbyClickBound = false;
  }

  let __nearbySingleTimer = null;
  const __nearbySingleDelay = 250;

  // Yeni Tıklama İşleyicisi
  const clickHandler = function(e) {
    if (__nearbySingleTimer) clearTimeout(__nearbySingleTimer);
    
    __nearbySingleTimer = setTimeout(async () => {
      console.log("[Nearby] Map clicked at:", e.latlng); 
      
      // Tüm kategori markerlarını temizle
      clearAllCategoryMarkers(map);
      
      // Varsa açık popup'ı kapat
      if (typeof closeNearbyPopup === 'function') closeNearbyPopup();
      
      // Yeni popup'ı aç
      if (typeof showNearbyPlacesPopup === 'function') {
          showNearbyPlacesPopup(e.latlng.lat, e.latlng.lng, map, day, radius);
      }
    }, __nearbySingleDelay);
  };

  // Event'i haritaya bağla
  map.on('click', clickHandler);
  
  map.__ttNearbyClickHandler = clickHandler;
  map.__ttNearbyClickBound = true;

  // Zoom veya çift tıklama sırasında tek tık işlemini iptal et
  map.on('dblclick', () => { if (__nearbySingleTimer) clearTimeout(__nearbySingleTimer); });
  map.on('zoomstart', () => { if (__nearbySingleTimer) clearTimeout(__nearbySingleTimer); });
  map.on('movestart', () => { if (__nearbySingleTimer) clearTimeout(__nearbySingleTimer); });
}

function getFastRestaurantPopupHTML(f, imgId, day) {
    // Spinner CSS'ini garanti et
    if (!document.getElementById('img-loading-spinner-style')) {
        const s = document.createElement('style');
        s.id = 'img-loading-spinner-style';
        s.innerHTML = `
            .img-loading-spinner { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 24px; height: 24px; border: 3px solid #eee; border-top: 3px solid #1976d2; border-radius: 50%; animation: img-spin 1s linear infinite; z-index: 2; }
            @keyframes img-spin { to { transform: translate(-50%, -50%) rotate(360deg); } }
            .hidden-img { opacity: 0; }
            .point-image img { transition: opacity 0.3s; }
        `;
        document.head.appendChild(s);
    }

    const name = f.properties.name || "Restaurant";
    const address = f.properties.formatted || "";
    const lat = f.properties.lat;
    const lon = f.properties.lon;
    
    // Güvenli tırnak işaretleri
    const safeName = name.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
    const safeAddress = address.replace(/'/g, "&apos;").replace(/"/g, "&quot;");

    return `
      <div class="point-item" style="display: flex; align-items: center; gap: 12px; padding: 8px; background: #f8f9fa; border-radius: 8px; margin-bottom: 0px;">
        <div class="point-image" style="width: 48px; height: 48px; position: relative; flex-shrink: 0;">
          <img id="${imgId}" class="hidden-img" src="img/placeholder.png" alt="${safeName}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">
          <div class="img-loading-spinner" id="${imgId}-spin"></div>
        </div>
        <div class="point-info" style="flex: 1; min-width: 0;">
          <div class="point-name-editor" style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
            <span style="font-weight: 600; font-size: 14px; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${safeName}</span>
          </div>
          <div class="point-address" style="display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: 11px;
    color: #666;
    line-height: 1.2;
    font-weight: 400;
    text-align: left;">${safeAddress}</div>
        </div>
        <div class="point-actions" style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
          <button class="add-point-to-cart-btn"
            onclick="window.addRestaurantToTripFromPopup('${imgId}', '${safeName}', '${safeAddress}', ${day}, ${lat}, ${lon})"
            style="width: 32px; height: 32px; background: #1976d2; color: white; border: none; border-radius: 50%; font-size: 18px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
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

async function searchRestaurantsAt(lat, lng, map) {
    // PROXY KULLANIMI: API Key removed
    const bufferMeters = 1000; // 1 km çap
    const url = `/api/geoapify/places?categories=catering.restaurant&lat=${lat}&lon=${lng}&radius=${bufferMeters}&limit=50`;
    
    try {
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
    } catch(e) {
        console.error("Search error:", e);
alert("An error occurred during the search.");
    }
}


function getFastHotelPopupHTML(f, imgId, day) {
    const name = f.properties.name || "Hotel";
    const address = f.properties.formatted || "";
    const lat = f.properties.lat;
    const lon = f.properties.lon;
    
    const safeName = name.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
    const safeAddress = address.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
    
    return `
      <div class="point-item" style="display: flex; align-items: center; gap: 12px; padding: 8px; background: #f8f9fa; border-radius: 8px; margin-bottom: 0px;">
        <div class="point-image" style="width: 48px; height: 48px; position: relative; flex-shrink: 0;">
          <img id="${imgId}" class="hidden-img" src="img/placeholder.png" alt="${safeName}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">
          <div class="img-loading-spinner" id="${imgId}-spin"></div>
        </div>
        <div class="point-info" style="flex: 1; min-width: 0;">
          <div class="point-name-editor" style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
            <span style="font-weight: 600; font-size: 14px; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${safeName}</span>
          </div>
          <div class="point-address" style="display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            font-size: 11px;
            color: #666;
            line-height: 1.2;
            font-weight: 400;
            text-align: left;">${safeAddress}</div>
        </div>
        <div class="point-actions" style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
          <button class="add-point-to-cart-btn"
            onclick="window.addHotelToTripFromPopup('${imgId}', '${safeName}', '${safeAddress}', ${day}, ${lat}, ${lon})"
            style="width: 32px; height: 32px; background: #1976d2; color: white; border: none; border-radius: 50%; font-size: 18px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
            +
          </button>
        </div>
      </div>
    `;
}

function getBlueHotelMarkerHtml() {
    return `
      <div class="custom-marker-outer" style="
        position:relative;
        width:32px;height:32px;
        background:#1976d2;
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        box-shadow:0 2px 8px #888;
        border:2px solid #fff;
      ">
        <img src="https://www.svgrepo.com/show/327200/hotel.svg"
             style="width:18px;height:18px;filter:invert(1) brightness(2);" alt="Hotel">
      </div>
    `;
}


function handleHotelPopupImageLoading(f, imgId) {
    getImageForPlace(f.properties.name, "hotel", window.selectedCity || "")
        .then(src => {
            const img = document.getElementById(imgId);
            const spin = document.getElementById(imgId + "-spin");
            if (img && src) {
                img.src = src;
                img.classList.remove("hidden-img");
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


function getFastMarketPopupHTML(f, imgId, day) {
    const name = f.properties.name || "Market";
    const address = f.properties.formatted || "";
    const lat = f.properties.lat;
    const lon = f.properties.lon;
    
    const safeName = name.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
    const safeAddress = address.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
    
    return `
      <div class="point-item" style="display: flex; align-items: center; gap: 12px; padding: 8px; background: #f8f9fa; border-radius: 8px; margin-bottom: 0px;">
        <div class="point-image" style="width: 48px; height: 48px; position: relative; flex-shrink: 0;">
          <img id="${imgId}" class="hidden-img" src="img/placeholder.png" alt="${safeName}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">
          <div class="img-loading-spinner" id="${imgId}-spin"></div>
        </div>
        <div class="point-info" style="flex: 1; min-width: 0;">
          <div class="point-name-editor" style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
            <span style="font-weight: 600; font-size: 14px; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${safeName}</span>
          </div>
          <div class="point-address" style="display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            font-size: 11px;
            color: #666;
            line-height: 1.2;
            font-weight: 400;
            text-align: left;">${safeAddress}</div>
        </div>
        <div class="point-actions" style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
          <button class="add-point-to-cart-btn"
            onclick="window.addMarketToTripFromPopup('${imgId}', '${safeName}', '${safeAddress}', ${day}, ${lat}, ${lon})"
            style="width: 32px; height: 32px; background: #4caf50; color: white; border: none; border-radius: 50%; font-size: 18px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
            +
          </button>
        </div>
      </div>
    `;
}

function getGreenMarketMarkerHtml() {
    return `
      <div class="custom-marker-outer" style="
        position:relative;
        width:32px;height:32px;
        background:#4caf50;
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        box-shadow:0 2px 8px #888;
        border:2px solid #fff;
      ">
        <img src="https://www.svgrepo.com/show/327200/shopping-cart.svg"
             style="width:18px;height:18px;filter:invert(1) brightness(2);" alt="Market">
      </div>
    `;
}



function handleMarketPopupImageLoading(f, imgId) {
    getImageForPlace(f.properties.name, "market", window.selectedCity || "")
        .then(src => {
            const img = document.getElementById(imgId);
            const spin = document.getElementById(imgId + "-spin");
            if (img && src) {
                img.src = src;
                img.classList.remove("hidden-img");
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


function getFastEntertainmentPopupHTML(f, imgId, day) {
    const name = f.properties.name || "Entertainment";
    const address = f.properties.formatted || "";
    const lat = f.properties.lat;
    const lon = f.properties.lon;
    
    const safeName = name.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
    const safeAddress = address.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
    
    return `
      <div class="point-item" style="display: flex; align-items: center; gap: 12px; padding: 8px; background: #f8f9fa; border-radius: 8px; margin-bottom: 0px;">
        <div class="point-image" style="width: 48px; height: 48px; position: relative; flex-shrink: 0;">
          <img id="${imgId}" class="hidden-img" src="img/placeholder.png" alt="${safeName}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">
          <div class="img-loading-spinner" id="${imgId}-spin"></div>
        </div>
        <div class="point-info" style="flex: 1; min-width: 0;">
          <div class="point-name-editor" style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
            <span style="font-weight: 600; font-size: 14px; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${safeName}</span>
          </div>
          <div class="point-address" style="display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            font-size: 11px;
            color: #666;
            line-height: 1.2;
            font-weight: 400;
            text-align: left;">${safeAddress}</div>
        </div>
        <div class="point-actions" style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
          <button class="add-point-to-cart-btn"
            onclick="window.addEntertainmentToTripFromPopup('${imgId}', '${safeName}', '${safeAddress}', ${day}, ${lat}, ${lon})"
            style="width: 32px; height: 32px; background: #ff9800; color: white; border: none; border-radius: 50%; font-size: 18px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
            +
          </button>
        </div>
      </div>
    `;
}

function getOrangeEntertainmentMarkerHtml() {
    return `
      <div class="custom-marker-outer" style="
        position:relative;
        width:32px;height:32px;
        background:#ff9800;
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        box-shadow:0 2px 8px #888;
        border:2px solid #fff;
      ">
        <img src="https://www.svgrepo.com/show/327200/theater.svg"
             style="width:18px;height:18px;filter:invert(1) brightness(2);" alt="Entertainment">
      </div>
    `;
}

function handleEntertainmentPopupImageLoading(f, imgId) {
    getImageForPlace(f.properties.name, "entertainment", window.selectedCity || "")
        .then(src => {
            const img = document.getElementById(imgId);
            const spin = document.getElementById(imgId + "-spin");
            if (img && src) {
                img.src = src;
                img.classList.remove("hidden-img");
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
        const categories = [
            "catering.restaurant",
            "catering.cafe",
            "catering.bar",
            "catering.fast_food",
            "catering.pub"
        ].join(",");
        
        // PROXY KULLANIMI: API Key removed
        const url = `/api/geoapify/places?categories=${categories}&lat=${lat}&lon=${lng}&radius=${radiusMeters}&limit=50`; // 50 ile 200 arasında proxy limiti var mı kontrol etmek gerekir, default 10. Server side kodu 200'ü kabul ediyorsa limit=200 yapabilirsiniz.

        // DOĞRU: RESTORANLARI ÇEK
        try {
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
        } catch (e) {
            console.error("Error fetching nearby places:", e);
            alert("Error fetching nearby places.");
        }
    });

    return routeLine;
}

function showRouteInfoBanner(day) {
  const expandedContainer = document.getElementById(`expanded-map-${day}`);
  if (!expandedContainer) return;

  let banner = expandedContainer.querySelector('#route-info-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'route-info-banner';
    banner.className = 'route-info-banner';
    banner.innerHTML = `
      <span>Click the map to list nearby restaurants, cafes and bars.</span>
    `;
    expandedContainer.prepend(banner);
  }
  
  // --- Stil ve Animasyon Ayarları ---
  banner.style.display = 'flex';
  banner.style.cursor = 'pointer';
  banner.style.transition = 'opacity 1s ease-out'; // Geçiş süresi
  
  // Başlangıçta görünür olması için (browser render'ı yakalasın diye ufak gecikme)
  banner.style.opacity = '0';
  requestAnimationFrame(() => {
      banner.style.opacity = '1';
  });

  // --- ORTAK KAPATMA FONKSİYONU ---
  // Bu fonksiyon çağrıldığında banner yavaşça solar ve sonra yok olur.
  const fadeOutBanner = () => {
      // Zaten kapanıyorsa tekrar işlem yapma
      if (banner.style.opacity === '0') return;

      // 1. Opaklığı düşür (Fade out başlar)
      banner.style.opacity = '0';

      // 2. Animasyon bitince (1 saniye sonra) ekrandan tamamen kaldır
      setTimeout(() => {
          banner.style.display = 'none';
      }, 1000); 
  };

  // --- TIKLAYINCA KAPAT (Yavaşça) ---
  banner.onclick = function() {
    fadeOutBanner();
  };

  // --- X BUTONU VARSA ONA DA EKLE ---
  const closeBtn = banner.querySelector('#close-route-info');
  if (closeBtn) {
    closeBtn.onclick = function(e) {
      e.stopPropagation();
      fadeOutBanner();
    };
  }

  // --- OTOMATİK KAPANMA (4 saniye sonra yavaşça) ---
  setTimeout(function() {
    // Eğer kullanıcı henüz kapatmadıysa otomatik kapat
    if (banner.style.display !== 'none') {
        fadeOutBanner();
    }
  }, 4000);
}

async function getRestaurantPopupHTML(f, day) {
const name = f.properties.name || "Restaurant";
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
          <div class="point-address" style="display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: 11px;
    color: #666;
    line-height: 1.2;
    font-weight: 400;
    text-align: left;">
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
        const categories = "catering.restaurant,catering.cafe,catering.bar,catering.fast_food,catering.pub";
        // PROXY KULLANIMI
        const url = `/api/geoapify/places?categories=${categories}&lat=${lat}&lon=${lng}&radius=1000&limit=20`;
        try {
            const resp = await fetch(url);
            const data = await resp.json();
            if (!data.features || data.features.length === 0) {
alert("No restaurants/cafes/bars found in this area!");
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
alert(`${data.features.length} restaurants/cafes/bars have been displayed in this area.`);
        } catch (err) {
alert("An error occurred while fetching restaurants. Please try again.");
        }
    });
}

function getSimplePlaceCategory(f) {
    const cats = f.properties.categories || "";
    
    // 1. MARKETS
    if (cats.includes('commercial') || cats.includes('market')) {
        return 'markets';
    }
    
    // 2. ENTERTAINMENT
    if (cats.includes('entertainment') || cats.includes('leisure')) {
        return 'entertainment';
    }
    
    // 3. RESTAURANT
    if (cats.includes('restaurant') || cats.includes('cafe') || cats.includes('food')) {
        return 'restaurant';
    }
    
    // 4. HOTEL
    if (cats.includes('accommodation') || cats.includes('hotel')) {
        return 'hotel';
    }
    
    return 'restaurant';
}

async function getPlacesForCategory(city, category, limit = 5, radius = 3000, code = null) {
  const geoCategory = code || geoapifyCategoryMap[category] || placeCategories[category];
  if (!geoCategory) {
    return [];
  }
  const coords = await getCityCoordinates(city);
  if (!coords || !coords.lat || !coords.lon || isNaN(coords.lat) || isNaN(coords.lon)) {
    return [];
  }
  const url = `/api/geoapify/places?categories=${geoCategory}&lon=${coords.lon}&lat=${coords.lat}&radius=${radius}&limit=${limit}`;
  let resp, data;
  try {
    resp = await fetch(url);
    data = await resp.json();
  } catch (e) {
    return [];
  }
 if (data.features && data.features.length > 0) {
    const filtered = data.features.filter(f =>
      !!f.properties.name && f.properties.name.trim().length > 2
    );
    const result = filtered.map(f => {
      const props = f.properties || {};
      let lat = Number(
        props.lat ??
        props.latitude ??
        (f.geometry && f.geometry.coordinates && f.geometry.coordinates[1])
      );
      let lon = Number(
        props.lon ??
        props.longitude ??
        (f.geometry && f.geometry.coordinates && f.geometry.coordinates[0])
      );
      if (!Number.isFinite(lat)) lat = null;
      if (!Number.isFinite(lon)) lon = null;
      return {
        name: props.name,
        name_en: props.name_en,
        name_latin: props.name_latin,
        address: props.formatted || "",
        lat,
        lon,
        location: (lat !== null && lon !== null) ? { lat, lng: lon } : null,
        website: props.website || '',
        opening_hours: props.opening_hours || '',
        categories: props.categories || [],
        city: city,
        properties: props
      };
    });

       console.log('getPlacesForCategory:', {
      city,
      category,
      radius,
      limit,
      places: result.map(p => ({
        name: p.name,
        lat: p.lat,
        lon: p.lon,
        address: p.address,
        categories: p.categories
      }))
    });

    // ---- BURAYA EKLE ----
    // Sıralamayı şehir merkezine en yakın olanı öne alacak şekilde yap!
    const sorted = result.sort((a, b) => {
      const da = haversine(a.lat, a.lon, coords.lat, coords.lon);
      const db = haversine(b.lat, b.lon, coords.lat, coords.lon);
      return da - db;
    });
    return sorted;

  }
  return [];
}


async function showNearbyPlacesPopup(lat, lng, map, day, radius = 2000) {
    // 1. Önce kesinlikle eskileri temizle
    if (typeof closeNearbyPopup === 'function') {
        closeNearbyPopup();
    }
    
    // 2. Tüm kategori markerlarını temizle
    clearAllCategoryMarkers(map);

    // ORİJİNAL ÇALIŞAN KATEGORİLER - daha az kategori, daha güvenli
    const categoryGroups = {
        "restaurants": "catering.restaurant",
        "hotels": "accommodation",
        "shops": "commercial.supermarket,commercial.convenience,commercial.clothing,commercial.shopping_mall",
        "entertainment": "leisure,entertainment"
    };

    const allCategories = "catering.restaurant,accommodation,commercial.supermarket,commercial.convenience,commercial.clothing,commercial.shopping_mall,leisure,entertainment";
    const url = `/api/geoapify/places?categories=${allCategories}&lat=${lat}&lon=${lng}&radius=${radius}&limit=20`;

    const loadingContent = `
        <div class="nearby-loading-message">
            <div class="nearby-loading-spinner"></div>
            <small class="nearby-loading-text">Searching nearby places...</small>
        </div>
    `;
    
    showCustomPopup(lat, lng, map, loadingContent, false);

    const isMapLibre = !!map.addSource;
    if (isMapLibre) {
         map.flyTo({ center: [lng, lat], zoom: 15, speed: 0.8 });
    } else {
         const currentZoom = map.getZoom();
         if (currentZoom < 14) map.flyTo([lat, lng], 15, { duration: 0.5 });
         else map.panTo([lat, lng], { animate: true, duration: 0.4 });
    }

    try {
        let pointInfo = { name: "Selected Point", address: "" };
        try { pointInfo = await getPlaceInfoFromLatLng(lat, lng); } catch (e) {}

        const resp = await fetch(url);
        
        // HTTP hata kontrolü
        if (!resp.ok) {
            console.error('API Error:', resp.status, resp.statusText);
            showCustomPopup(lat, lng, map, '<div style="color:red; padding:10px;">API Error: ' + resp.status + ' ' + resp.statusText + '</div>', true);
            return;
        }
        
        const data = await resp.json();

        // DEBUG: Gelen datayı konsola yazdır
        console.log('Geoapify Response:', {
            totalFeatures: data.features?.length || 0,
            features: data.features?.slice(0, 3).map(f => ({
                name: f.properties.name,
                categories: f.properties.categories
            }))
        });

        // Kategorilere göre yerleri grupla
        let categorizedPlaces = {
            restaurants: [],
            hotels: [],
            markets: [],
            entertainment: []
        };

        let allPlaces = [];
        let placeIdToIndexMap = {};
        
        if (data.features && data.features.length > 0) {
            allPlaces = data.features
                .filter(f => {
                    const hasName = !!f.properties.name && f.properties.name.trim().length > 2;
                    return hasName;
                })
                .map(f => ({ 
                    ...f, 
                    distance: haversine(lat, lng, f.properties.lat, f.properties.lon),
                    // BASİT KATEGORİ BELİRLEME
                    category: getSimplePlaceCategory(f)
                }))
                .sort((a, b) => a.distance - b.distance);

            // Her yer için benzersiz ID oluştur
            allPlaces.forEach((place, index) => {
                const placeId = place.properties.place_id || `place-${index}`;
                placeIdToIndexMap[placeId] = index;
            });

            // Kategorilere ayır - BASİT YÖNTEM
            allPlaces.forEach(place => {
                const cat = place.category;
                if (cat === 'restaurant') categorizedPlaces.restaurants.push(place);
                else if (cat === 'hotel') categorizedPlaces.hotels.push(place);
                else if (cat === 'markets') categorizedPlaces.markets.push(place);
                else if (cat === 'entertainment') categorizedPlaces.entertainment.push(place);
            });

            // DEBUG: Kategori sayıları
            console.log('Category counts:', Object.keys(categorizedPlaces).map(k => ({[k]: categorizedPlaces[k].length})));

            // Her kategori için maksimum 5 yer göster
            Object.keys(categorizedPlaces).forEach(key => {
                categorizedPlaces[key] = categorizedPlaces[key].slice(0, 5);
            });
        }

        // Tab başlıkları
        const tabTitles = {
            restaurants: { icon: "🍽️", title: "Restaurants", count: categorizedPlaces.restaurants.length },
            hotels: { icon: "🏨", title: "Hotels", count: categorizedPlaces.hotels.length },
            markets: { icon: "🛒", title: "Markets", count: categorizedPlaces.markets.length },
            entertainment: { icon: "🎭", title: "Entertainment", count: categorizedPlaces.entertainment.length }
        };

        // Buton etiketleri
        const buttonLabels = {
            restaurants: { text: "Show more restaurants", color: "#1976d2" },
            hotels: { text: "Show more hotels", color: "#1976d2" },
            markets: { text: "Show more markets", color: "#1976d2" },
            entertainment: { text: "Show more entertainment", color: "#1976d2" }
        };

        // Tıkalanan nokta bölümü
        const addPointSection = `
            <div class="add-point-section" style="margin-bottom: 16px; border-bottom: 1px solid #e0e0e0; padding-bottom: 16px;">
                <div class="point-item" style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 12px; background: #f8f9fa; border-radius: 8px; margin-bottom: 8px;">
                    <div class="point-image" style="width: 48px; height: 48px; position: relative; flex-shrink: 0;">
                        <img id="clicked-point-img" src="img/placeholder.png" alt="Selected Point" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px; opacity: 0.8;">
                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 18px;">📍</div>
                    </div>
                    <div class="point-info" style="flex: 1; min-width: 0;">
                        <div class="point-name-editor" style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                            <span id="point-name-display" style="font-weight: 600; font-size: 15px; cursor: pointer; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" onclick="window.editPointName()">${pointInfo.name}</span>
                            <button onclick="window.editPointName()" style="background: none; border: none; font-size: 13px; cursor: pointer; color: #666; padding: 2px;">✏️</button>
                            <input type="text" id="point-name-input" value="${pointInfo.name}" style="display: none; flex: 1; padding: 5px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;">
                        </div>
                        <div class="point-address" style="font-size: 12px; color: #666; line-height: 1.3;">
                            ${pointInfo.address || 'Selected location'}
                        </div>
                    </div>
                    <div class="point-actions" style="display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0;">
                        <div style="font-size: 11px; color: #999;">Selected</div>
                        <button class="add-point-to-cart-btn" onclick="window.addClickedPointToCart(${lat}, ${lng}, ${day})" style="width: 36px; height: 36px; background: #1976d2; color: white; border: none; border-radius: 50%; font-size: 18px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">+</button>
                    </div>
                    <div id="ai-point-description" style="width: 100%; margin-top: 8px; border-top: 1px dashed #ddd; padding-top: 10px;"></div>
                </div>
            </div>
        `;

        // Aktif tab belirle (en fazla içeriğe sahip olan)
        let activeTab = 'restaurants';
        let maxCount = 0;
        Object.keys(tabTitles).forEach(key => {
            if (categorizedPlaces[key].length > maxCount) {
                maxCount = categorizedPlaces[key].length;
                activeTab = key;
            }
        });

        // Tab HTML'ini oluştur
        let tabsHtml = '<div class="category-tabs" style="display: flex; gap: 4px; margin-bottom: 16px; border-bottom: 1px solid #e0e0e0;">';
        
        Object.keys(tabTitles).forEach(key => {
            const tab = tabTitles[key];
            const isActive = key === activeTab;
            const badgeStyle = tab.count > 0 ? 'background: #4caf50; color: white;' : 'background: #ccc; color: #666;';
            
            tabsHtml += `
                <button class="category-tab ${isActive ? 'active' : ''}" 
                        data-tab="${key}"
                        style="flex: 1; padding: 10px 6px; background: ${isActive ? '#f0f7ff' : 'transparent'}; 
                               border: none; border-bottom: 2px solid ${isActive ? '#1976d2' : 'transparent'}; 
                               cursor: pointer; font-size: 12px; color: ${isActive ? '#1976d2' : '#666'}; 
                               display: flex; flex-direction: column; align-items: center; gap: 4px;">
                    <div style="font-size: 16px;">${tab.icon}</div>
                    <div style="font-weight: ${isActive ? '600' : '500'}; white-space: nowrap;">${tab.title}</div>
                    <div style="font-size: 10px; padding: 1px 6px; border-radius: 10px; ${badgeStyle}">
                        ${tab.count}
                    </div>
                </button>
            `;
        });
        
        tabsHtml += '</div>';

        // Fotoğrafları önceden çekmek için promise'lar oluştur
        let photoPromises = {};
        Object.keys(categorizedPlaces).forEach(key => {
            photoPromises[key] = categorizedPlaces[key].map(async (place) => {
                const name = place.properties.name || "";
                const cityQuery = name + " " + (window.selectedCity || "");
                try {
                    let imageUrl = null;
                    if (typeof getPexelsImage === "function") imageUrl = await getPexelsImage(cityQuery);
                    if (imageUrl && imageUrl !== PLACEHOLDER_IMG && await isImageValid(imageUrl)) return imageUrl;
                    if (typeof getPixabayImage === "function") imageUrl = await getPixabayImage(name);
                    if (imageUrl && imageUrl !== PLACEHOLDER_IMG && await isImageValid(imageUrl)) return imageUrl;
                    return PLACEHOLDER_IMG;
                } catch (error) { return PLACEHOLDER_IMG; }
            });
        });

        // Fotoğrafları çek
        let categorizedPhotos = {};
        for (const key in photoPromises) {
            categorizedPhotos[key] = await Promise.all(photoPromises[key]);
        }

        // Tab içerikleri için container
        let tabContentsHtml = '<div class="tab-contents">';

        Object.keys(categorizedPlaces).forEach(key => {
            const places = categorizedPlaces[key];
            const photos = categorizedPhotos[key] || [];
            const isActive = key === activeTab;
            const buttonConfig = buttonLabels[key] || buttonLabels.restaurants;
            
            tabContentsHtml += `
                <div class="tab-content ${isActive ? 'active' : ''}" 
                     data-tab="${key}"
                     style="display: ${isActive ? 'block' : 'none'};">
            `;
            
            if (places.length === 0) {
                // YER BULUNMAZSA GENİŞ ALAN ARAMA BUTONU
                tabContentsHtml += `
                    <div style="text-align: center; padding: 30px 20px; color: #999; font-size: 13px;">
                        <div style="font-size: 24px; margin-bottom: 8px;">${tabTitles[key].icon}</div>
                        No ${tabTitles[key].title.toLowerCase()} found in this area
                        <div style="margin-top: 16px;">
                            <button class="search-wider-btn" 
                                    data-category="${key}"
                                    style="padding:10px 18px; border-radius:9px; background:#ff9800; color:#fff; font-size:14px; font-weight:bold; cursor:pointer; border:none;">
                                🔍 Search wider area
                            </button>
                        </div>
                    </div>
                `;
            } else {
                places.forEach((place, index) => {
                    const p = place.properties;
                    const name = p.name || "(No name)";
                    const photo = photos[index] || PLACEHOLDER_IMG;
                    const distStr = place.distance < 1000 ? 
                        `${Math.round(place.distance)} m` : 
                        `${(place.distance / 1000).toFixed(2)} km`;
                    const safeName = name.replace(/'/g, "\\'");
                    const locationContext = [p.suburb, p.city, p.country].filter(Boolean).join(', ');
                    
                    const placeId = p.place_id || `place-${key}-${index}`;
                    const allPlacesIndex = placeIdToIndexMap[placeId] || allPlaces.findIndex(pl => 
                        pl.properties.place_id === p.place_id || 
                        pl.properties.name === p.name
                    );
                    
                    tabContentsHtml += `
                        <div class="category-place-item" 
                             style="display: flex; align-items: center; gap: 12px; padding: 10px; 
                                    background: #f8f9fa; border-radius: 8px; margin-bottom: 8px; 
                                    border: 1px solid #eee;">
                            <div style="position: relative; width: 42px; height: 42px; flex-shrink: 0;">
                                <img src="${photo}" 
                                     alt="${name}"
                                     style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">
                                <div onclick="event.stopPropagation(); window.fetchClickedPointAI('${safeName}', ${p.lat}, ${p.lon}, '${locationContext}', {}, 'ai-point-description')" 
                                     style="position: absolute; bottom: -4px; right: -4px; width: 20px; height: 20px; background: #8a4af3; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.3); z-index: 10;">
                                    <span style="font-size: 10px; color: white;">✨</span>
                                </div>
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-weight: 600; font-size: 13px; color: #333; 
                                            margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis;">
                                    ${name}
                                </div>
                                <div style="font-size: 11px; color: #777; overflow: hidden; 
                                            text-overflow: ellipsis; white-space: nowrap;">
                                    ${p.formatted || ""}
                                </div>
                            </div>
                            <div style="display: flex; flex-direction: column; align-items: center; 
                                        gap: 4px; flex-shrink: 0;">
                                <div style="font-size: 10px; color: #999; white-space: nowrap;">
                                    ${distStr}
                                </div>
                                <button onclick="window.addNearbyPlaceToTripFromPopup(${allPlacesIndex}, ${day}, '${p.lat}', '${p.lon}')"
                                        style="width: 30px; height: 30px; background: #fff; 
                                               border: 1px solid #ddd; border-radius: 50%; 
                                               cursor: pointer; color: #1976d2; font-weight: bold; 
                                               font-size: 16px; display: flex; align-items: center; 
                                               justify-content: center;">
                                    +
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                // Yer bulunursa "Show more" butonu
                tabContentsHtml += `
                    <div style="text-align:center; margin: 20px 0 4px 0; padding-top: 12px; border-top: 1px solid #eee;">
                        <button class="show-category-btn" 
                                data-category="${key}"
                                style="padding:10px 18px; border-radius:9px; background:#1976d2; color:#fff; font-size:14px; font-weight:bold; cursor:pointer; border:none;">
                            ${buttonConfig.text}
                        </button>
                    </div>
                `;
            }
            
            tabContentsHtml += '</div>';
        });

        tabContentsHtml += '</div>';

        const html = `
            <div style="max-width: 380px;">
                <div class="nearby-popup-title" style="font-weight: bold; margin-bottom: 12px; font-size: 16px;">
                    📍 Nearby Places
                </div>
                ${addPointSection}
                ${tabsHtml}
                ${tabContentsHtml}
            </div>
        `;

        showCustomPopup(lat, lng, map, html, true);

        // Global kayıtlar
        window._lastNearbyPlaces = allPlaces;
        window._lastNearbyPhotos = [];

        allPlaces.forEach((place, index) => {
            let foundPhoto = PLACEHOLDER_IMG;
            
            Object.keys(categorizedPlaces).forEach(key => {
                const catIndex = categorizedPlaces[key].findIndex(p => 
                    p.properties.place_id === place.properties.place_id ||
                    p.properties.name === place.properties.name
                );
                if (catIndex !== -1 && categorizedPhotos[key] && categorizedPhotos[key][catIndex]) {
                    foundPhoto = categorizedPhotos[key][catIndex];
                }
            });
            
            window._lastNearbyPhotos[index] = foundPhoto;
        });

        window._lastNearbyDay = day;
        window._currentPointInfo = pointInfo;

        loadClickedPointImage(pointInfo.name);

        setTimeout(() => {
            document.querySelectorAll('.category-tab').forEach(tab => {
                tab.addEventListener('click', function() {
                    const tabId = this.dataset.tab;
                    
                    document.querySelectorAll('.category-tab').forEach(t => {
                        t.style.background = t.dataset.tab === tabId ? '#f0f7ff' : 'transparent';
                        t.style.borderBottomColor = t.dataset.tab === tabId ? '#1976d2' : 'transparent';
                        t.style.color = t.dataset.tab === tabId ? '#1976d2' : '#666';
                        t.style.fontWeight = t.dataset.tab === tabId ? '600' : '500';
                    });
                    
                    document.querySelectorAll('.tab-content').forEach(content => {
                        content.style.display = content.dataset.tab === tabId ? 'block' : 'none';
                    });
                });
            });

            document.querySelectorAll('.show-category-btn').forEach(btn => {
                btn.onclick = function() {
                    const category = this.dataset.category;
                    
                    if (typeof closeNearbyPopup === 'function') closeNearbyPopup();
                    
                    if (category === 'restaurants') {
                        showNearbyRestaurants(lat, lng, map, day);
                    } else if (category === 'hotels') {
                        showNearbyHotels(lat, lng, map, day);
                    } else if (category === 'markets') {
                        showNearbyMarkets(lat, lng, map, day);
                    } else if (category === 'entertainment') {
                        showNearbyEntertainment(lat, lng, map, day);
                    }
                };
            });

            // "Search wider area" butonları için event handler
            document.querySelectorAll('.search-wider-btn').forEach(btn => {
                btn.onclick = function() {
                    const category = this.dataset.category;
                    const widerRadius = 5000;   // Daha geniş alan (5km)
                    
                    if (typeof closeNearbyPopup === 'function') closeNearbyPopup();
                    
                    // Daha geniş alanda arama yap
                    if (category === 'restaurants') {
                        showNearbyPlacesByCategory(lat, lng, map, day, 'restaurants', widerRadius);
                    } else if (category === 'hotels') {
                        showNearbyPlacesByCategory(lat, lng, map, day, 'hotels', widerRadius);
                    } else if (category === 'markets') {
                        showNearbyPlacesByCategory(lat, lng, map, day, 'markets', widerRadius);
                    } else if (category === 'entertainment') {
                        showNearbyPlacesByCategory(lat, lng, map, day, 'entertainment', widerRadius);
                    }
                };
            });
        }, 250);

        // Şehir bilgisi ve AI açıklaması
        let currentCityName = window.selectedCity || "";
        if (pointInfo && (pointInfo.county || pointInfo.city)) {
            currentCityName = pointInfo.county || pointInfo.city;
        }
        
        if (pointInfo?.name && pointInfo?.name !== "Selected Point") {
            const category = pointInfo?.category || pointInfo?.type || "place"; 
            const locationContext = [pointInfo?.suburb, pointInfo?.city, currentCityName, pointInfo?.country || "Turkey"]
                .filter(Boolean).join(', ');
            
            window.fetchClickedPointAI(pointInfo.name, lat, lng, locationContext, { category }, 'ai-point-description');
        }

    } catch (error) {
        console.error('Nearby places fetch error:', error);
        showCustomPopup(lat, lng, map, '<div style="color:red; padding:10px;">Error loading nearby places.</div>', true);
    }
}



let aiAbortController = null;
let aiDebounceTimeout = null;
async function fetchClickedPointAI(pointName, lat, lng, city, facts, targetDivId = 'ai-point-description') {
    const descDiv = document.getElementById(targetDivId);
    if (!descDiv) return;
    
    // Eğer targetDivId ai-icon- ile başlıyorsa (alt itemlardaki AI ikonu)
    const isIconClick = targetDivId.startsWith('ai-icon-');
    const mainAiDiv = document.getElementById('ai-point-description');
    
    // Eğer alt itemdaki AI ikonuna tıklandıysa, üstteki div'i kullan
    const targetElement = isIconClick ? mainAiDiv : descDiv;
    
    if (!targetElement) return;
    
    // Çoklu istek koruması
    if (targetElement.dataset.loading === 'true' && !targetElement.querySelector('.ai-spinner')) {
        return;
    }
    
    if (targetDivId === 'ai-point-description' || isIconClick) {
        clearTimeout(aiDebounceTimeout);
        if (aiAbortController) aiAbortController.abort();
        aiAbortController = new AbortController();
    }
    
    // Şehir bilgisini temizle
    const cleanCityContext = (context) => {
        if (!context) return "";
        return context
            .replace(/\b\d{5}\b/g, '')
            .replace(/\b\d{4}\s?[A-Z]{2}\b/gi, '')
            .replace(/,\s*,/g, ',')
            .replace(/^\s*,\s*|\s*,\s*$/g, '')
            .trim();
    };
    
    // Loading state
    targetElement.dataset.loading = 'true';
    targetElement.style.display = 'block';
    targetElement.innerHTML = `
        <div style="padding: 12px; text-align: center; background: #f8f9fa; border-radius: 8px; margin-top: 8px; width: 100%; box-sizing: border-box;">
            <div class="ai-spinner" style="width: 18px; height: 18px; border: 2px solid #8a4af3; border-top: 2px solid transparent; border-radius: 50%; animation: ai-spin 0.8s linear infinite; margin: 0 auto 8px;"></div>
            <div style="font-size: 11px; font-weight: 500; text-transform: uppercase; color: #666;">Analyzing ${pointName}...</div>
        </div>
        <style>@keyframes ai-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
    `;
    
    const triggerFetch = async () => {
        try {
            // Şehir context'ini temizle
            const cleanedCity = cleanCityContext(city);
            
            const response = await fetch('/llm-proxy/clicked-ai', {
                method: 'POST',
                signal: (targetDivId === 'ai-point-description' || isIconClick) ? aiAbortController.signal : null,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    point: pointName, 
                    city: cleanedCity, 
                    lat, 
                    lng, 
                    facts 
                })
            });
            
            const data = await response.json();
            
            // Başarılı yanıt işleme
            targetElement.dataset.loading = 'false';
            
            // Yanıtı formatla
            let p1Content = data.p1 || `Explore ${pointName} in ${cleanedCity.split(',')[0] || 'this area'}.`;
            let p2Content = data.p2 || '';
            
            // P1'i düzgün cümlelere böl
            const sentences = p1Content.split(/[.!?]+/).filter(s => s.trim().length > 0);
            if (sentences.length === 1) {
                p1Content = sentences[0] + '. Discover this location and its surroundings.';
            }
            
            // allPlacesIndex'i bul - AI ikonuna tıklandığında çalışan yerin indeksini bul
            let allPlacesIndex = -1;
            if (isIconClick && window._lastNearbyPlaces) {
                // targetDivId'den indeksi çıkar (örnek: "ai-icon-2")
                const idxMatch = targetDivId.match(/ai-icon-(\d+)/);
                if (idxMatch) {
                    allPlacesIndex = parseInt(idxMatch[1]);
                }
            }
            
            // HTML oluştur - İKİ AYRI BÖLÜM
            targetElement.innerHTML = `
                <div style="margin-top: 12px; width: 100%;">
                    <!-- Seçili Nokta Bölümü -->
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 12px; margin-bottom: 12px; border: 1px solid #e0e0e0;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                            <div style="width: 24px; height: 24px; background: #1976d2; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">📍</div>
                            <div style="font-weight: 600; font-size: 13px; color: #333;">Selected Point</div>
                        </div>
                        <div style="font-size: 12px; color: #666; line-height: 1.4;">
                            This is the location you clicked on the map. You can add it to your trip or explore nearby places.
                        </div>
                    </div>
                    
                    <!-- AI Analiz Edilen Yer Bölümü -->
                    <div style="background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #f0f0f0;">
                        <div style="padding: 12px; background: linear-gradient(135deg, #f0f7ff 0%, #e8f4ff 100%); border-bottom: 1px solid #e0e0e0;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="width: 28px; height: 28px; background: #8a4af3; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px;">✨</div>
                                <div>
                                    <div style="font-weight: 600; font-size: 14px; color: #333;">${pointName}</div>
                                    <div style="font-size: 11px; color: #666; margin-top: 2px;">AI Analysis</div>
                                </div>
                            </div>
                        </div>
                        
                        <div style="padding: 12px; font-size: 13px; line-height: 1.5; color: #333; border-bottom: 1px solid #f8f9fa;">
                            <div style="display: flex; align-items: flex-start; gap: 8px;">
                                <span style="font-size: 12px; color: #8a4af3; margin-top: 2px;">📍</span>
                                <div style="flex: 1;">${p1Content}</div>
                            </div>
                        </div>
                        
                        ${p2Content ? `
                        <div style="padding: 10px 12px; background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); display: flex; align-items: flex-start; gap: 8px;">
                            <span style="font-size: 12px; color: #ff9800;">💡</span>
                            <div style="color: #555; font-size: 12px; line-height: 1.4; flex: 1;">
                                <strong style="color: #333; font-size: 11px; display: block; margin-bottom: 2px;">Local Tip</strong>
                                ${p2Content}
                            </div>
                        </div>` : ''}
                        
                        <!-- Ekleme Butonu (sadece alt itemlar için) -->
                        ${isIconClick && allPlacesIndex !== -1 ? `
                        <div style="padding: 10px 12px; border-top: 1px solid #f0f0f0; text-align: center;">
                            <button onclick="window.addNearbyPlaceToTripFromPopup(${allPlacesIndex}, ${window._lastNearbyDay || 1}, '${lat}', '${lng}')"
                                    style="padding: 8px 16px; background: #8a4af3; color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                                <span>+</span>
                                Add "${pointName}" to Day ${window._lastNearbyDay || 1}
                            </button>
                        </div>
                        ` : ''}
                    </div>
                </div>`;
                
        } catch (e) {
            if (e.name === 'AbortError') {
                targetElement.innerHTML = "";
                targetElement.style.display = 'none';
                return;
            }
            
            console.error('AI fetch error:', e);
            targetElement.dataset.loading = 'false';
            targetElement.innerHTML = `
                <div style="padding: 10px; text-align: center; color: #666; font-size: 12px; background: #f9f9f9; border-radius: 6px; margin-top: 8px;">
                    <div style="margin-bottom: 4px;">⚠️ Information unavailable</div>
                    <small style="color: #999;">Try clicking another location</small>
                </div>`;
        }
    };
    
    // Debounce süresi
    const debounceTime = (targetDivId === 'ai-point-description' || isIconClick) ? 600 : 0;
    
    if (targetDivId === 'ai-point-description' || isIconClick) {
        aiDebounceTimeout = setTimeout(triggerFetch, debounceTime);
    } else {
        triggerFetch();
    }
} // <--- FONKSİYONUN KAPANMASI


async function showNearbyPlacesByCategory(lat, lng, map, day, categoryType = 'restaurants') {
    const isMapLibre = !!map.addSource;
    
    // Kategori konfigürasyonları
    const categoryConfig = {
        'restaurants': {
            apiCategories: 'catering.restaurant,catering.cafe,catering.bar,catering.fast_food,catering.pub',
            color: '#1976d2',
            iconUrl: 'https://www.svgrepo.com/show/327200/restaurant-sharp.svg',
            buttonText: 'Show Restaurants',
            placeholderIcon: '/img/restaurant_icon.svg',
            layerPrefix: 'restaurant'
        },
        'hotels': {
            apiCategories: 'accommodation',
            color: '#1976d2',
            iconUrl: 'https://www.svgrepo.com/show/327200/hotel.svg',
            buttonText: 'Show Hotels',
            placeholderIcon: '/img/hotel_icon.svg',
            layerPrefix: 'hotel'
        },
        'markets': {
            apiCategories: 'commercial.supermarket,commercial.convenience,commercial.clothing,commercial.shopping_mall',
            color: '#1976d2',
            iconUrl: 'https://www.svgrepo.com/show/327200/shopping-cart.svg',
            buttonText: 'Show Markets',
            placeholderIcon: '/img/market_icon.svg',
            layerPrefix: 'market'
        },
        'entertainment': {
            apiCategories: 'entertainment,leisure',
            color: '#1976d2',
            iconUrl: 'https://www.svgrepo.com/show/327200/theater.svg',
            buttonText: 'Show Entertainment',
            placeholderIcon: '/img/entertainment_icon.svg',
            layerPrefix: 'entertainment'
        }
    };
    
    const config = categoryConfig[categoryType] || categoryConfig.restaurants;
    
    // Temizlik
    const layerKey = `__${config.layerPrefix}Layers`;
    const marker3DKey = `_${config.layerPrefix}3DMarkers`;
    const layer3DKey = `_${config.layerPrefix}3DLayers`;
    
    if (map[layerKey]) {
        map[layerKey].forEach(l => l.remove());
        map[layerKey] = [];
    }
    
    if (window[layer3DKey]) {
        window[layer3DKey].forEach(id => {
            if (map.getLayer(id)) map.removeLayer(id);
            if (map.getSource(id)) map.removeSource(id);
        });
        window[layer3DKey] = [];
    }
    
    if (window[marker3DKey]) {
        window[marker3DKey].forEach(m => m.remove());
        window[marker3DKey] = [];
    }
    
    // API'den veri çek
    const url = `/api/geoapify/places?categories=${config.apiCategories}&lat=${lat}&lon=${lng}&radius=1000&limit=20`;
    
    try {
        const resp = await fetch(url);
        const data = await resp.json();
        
        if (!data.features || data.features.length === 0) {
            alert(`No ${categoryType} found nearby.`);
            return;
        }
        
        data.features.forEach((f, idx) => {
            const pLng = f.properties.lon;
            const pLat = f.properties.lat;
            const imgId = `${config.layerPrefix}-img-${idx}-${Date.now()}`;
            
            let popupContent = getFastPlacePopupHTML(f, imgId, day, config);
            
            if (isMapLibre) {
                // 3D HARİTA (MapLibre)
                window[layer3DKey] = window[layer3DKey] || [];
                window[marker3DKey] = window[marker3DKey] || [];
                
                // Çizgi ekle
                const sourceId = `${config.layerPrefix}-line-src-${idx}`;
                const layerId = `${config.layerPrefix}-line-layer-${idx}`;
                if (!map.getSource(sourceId)) {
                    map.addSource(sourceId, {
                        type: 'geojson',
                        data: {
                            type: 'Feature',
                            geometry: { type: 'LineString', coordinates: [[lng, lat], [pLng, pLat]] }
                        }
                    });
                    map.addLayer({
                        id: layerId,
                        type: 'line',
                        source: sourceId,
                        layout: { 'line-join': 'round', 'line-cap': 'round' },
                        paint: { 
                            'line-color': config.color, 
                            'line-width': 4, 
                            'line-opacity': 0.8, 
                            'line-dasharray': [2, 2] 
                        }
                    });
                    window[layer3DKey].push(layerId, sourceId);
                }
                
                // Marker ekle
                const el = document.createElement('div');
                el.innerHTML = getCategoryMarkerHtml(config.color, config.iconUrl, categoryType);
                el.className = 'custom-3d-marker-element';
                el.style.cursor = 'pointer';
                el.style.zIndex = '2000';
                
                const popup = new maplibregl.Popup({ 
                    offset: 25, 
                    maxWidth: '360px',
                    closeButton: true,
                    className: 'tt-unified-popup'
                }).setHTML(popupContent);
                
                popup.on('open', () => {
                    handlePlacePopupImageLoading(f, imgId, categoryType);
                });
                
                const marker = new maplibregl.Marker({ element: el })
                    .setLngLat([pLng, pLat])
                    .setPopup(popup)
                    .addTo(map);
                
                el.addEventListener('click', (e) => { 
                    e.stopPropagation(); 
                    marker.togglePopup(); 
                });
                window[marker3DKey].push(marker);
            } else {
                // 2D HARİTA (Leaflet)
                map[layerKey] = map[layerKey] || [];
                
                // Çizgi
                const line = L.polyline([[lat, lng], [pLat, pLng]], { 
                    color: config.color, 
                    weight: 4, 
                    opacity: 0.95, 
                    dashArray: "8,8" 
                }).addTo(map);
                map[layerKey].push(line);
                
                // Marker
                const marker = L.marker([pLat, pLng], {
                    icon: L.divIcon({ 
                        html: getCategoryMarkerHtml(config.color, config.iconUrl, categoryType), 
                        className: "", 
                        iconSize: [32,32], 
                        iconAnchor: [16,16] 
                    })
                }).addTo(map);
                map[layerKey].push(marker);
                
                marker.bindPopup(popupContent, { maxWidth: 341 });
                marker.on("popupopen", function() { 
                    handlePlacePopupImageLoading(f, imgId, categoryType);
                });
            }
        });
        
    } catch (err) {
        console.error(err);
        alert(`Error fetching ${categoryType}.`);
    }
}

// Yardımcı fonksiyon: Kategoriye göre marker HTML'i
function getCategoryMarkerHtml(color, iconUrl, categoryType) {
    return `
      <div class="custom-marker-outer" style="
        position:relative;
        width:32px;height:32px;
        background:${color};
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        box-shadow:0 2px 8px #888;
        border:2px solid #fff;
      ">
        <img src="${iconUrl}"
             style="width:18px;height:18px;filter:invert(1) brightness(2);" alt="${categoryType}">
      </div>
    `;
}

// Yardımcı fonksiyon: Popup HTML'i
function getFastPlacePopupHTML(f, imgId, day, config) {
    const name = f.properties.name || config.layerPrefix.charAt(0).toUpperCase() + config.layerPrefix.slice(1);
    const address = f.properties.formatted || "";
    const lat = f.properties.lat;
    const lon = f.properties.lon;
    
    const safeName = name.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
    const safeAddress = address.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
    
    return `
      <div class="point-item" style="display: flex; align-items: center; gap: 12px; padding: 8px; background: #f8f9fa; border-radius: 8px; margin-bottom: 0px;">
        <div class="point-image" style="width: 48px; height: 48px; position: relative; flex-shrink: 0;">
          <img id="${imgId}" class="hidden-img" src="img/placeholder.png" alt="${safeName}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">
          <div class="img-loading-spinner" id="${imgId}-spin"></div>
        </div>
        <div class="point-info" style="flex: 1; min-width: 0;">
          <div class="point-name-editor" style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
            <span style="font-weight: 600; font-size: 14px; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${safeName}</span>
          </div>
          <div class="point-address" style="display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            font-size: 11px;
            color: #666;
            line-height: 1.2;
            font-weight: 400;
            text-align: left;">${safeAddress}</div>
        </div>
        <div class="point-actions" style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
          <button class="add-point-to-cart-btn"
            onclick="window.addPlaceToTripFromPopup('${imgId}', '${safeName}', '${safeAddress}', ${day}, ${lat}, ${lon}, '${config.layerPrefix}')"
            style="width: 32px; height: 32px; background: ${config.color}; color: white; border: none; border-radius: 50%; font-size: 18px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
            +
          </button>
        </div>
      </div>
    `;
}

// Yardımcı fonksiyon: Popup açıldığında resim yükleme
function handlePlacePopupImageLoading(f, imgId, categoryType) {
    getImageForPlace(f.properties.name, categoryType, window.selectedCity || "")
        .then(src => {
            const img = document.getElementById(imgId);
            const spin = document.getElementById(imgId + "-spin");
            if (img && src) {
                img.src = src;
                img.classList.remove("hidden-img");
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

// Sepete ekleme fonksiyonu (tüm kategoriler için)
window.addPlaceToTripFromPopup = function(imgId, name, address, day, lat, lon, categoryType) {
    window.currentDay = parseInt(day);
    
    const categoryIcons = {
        'restaurant': '/img/restaurant_icon.svg',
        'hotel': '/img/hotel_icon.svg',
        'market': '/img/market_icon.svg',
        'entertainment': '/img/entertainment_icon.svg'
    };
    
    const img = document.getElementById(imgId);
    const defaultIcon = categoryIcons[categoryType] || '/img/placeholder.png';
    const imgSrc = (img && img.src && img.src !== "" && !img.classList.contains("hidden-img"))
        ? img.src
        : defaultIcon;
    
    // Sepete ekle
    addToCart(
        name,
        imgSrc,
        day,
        categoryType.charAt(0).toUpperCase() + categoryType.slice(1),
        address,
        null, null, null, null,
        { lat: Number(lat), lng: Number(lon) },
        ""
    );
    
    // Temizlik
    const layer3DKey = `_${categoryType}3DLayers`;
    const marker3DKey = `_${categoryType}3DMarkers`;
    
    if (window._maplibre3DInstance) {
        if (window[layer3DKey]) {
            window[layer3DKey].forEach(id => {
                if (window._maplibre3DInstance.getLayer(id)) window._maplibre3DInstance.removeLayer(id);
                if (window._maplibre3DInstance.getSource(id)) window._maplibre3DInstance.removeSource(id);
            });
            window[layer3DKey] = [];
        }
        if (window[marker3DKey]) {
            window[marker3DKey].forEach(m => m.remove());
            window[marker3DKey] = [];
        }
    }
    
    const allMaps = [];
    if (window.leafletMaps) allMaps.push(...Object.values(window.leafletMaps));
    if (window.expandedMaps) allMaps.push(...Object.values(window.expandedMaps).map(o => o.expandedMap));
    
    allMaps.forEach(map => {
        const layerKey = `__${categoryType}Layers`;
        if (map && map[layerKey]) {
            map[layerKey].forEach(l => {
               try { l.remove(); } catch(e) {}
            });
            map[layerKey] = [];
        }
    });
    
    alert(`${name} added to your trip!`);
};

// ============================================
// ESKİ FONKSİYONLARI YENİ TEKİL FONKSİYONLARA YÖNLENDİR
// ============================================

async function showNearbyRestaurants(lat, lng, map, day) {
    return showNearbyPlacesByCategory(lat, lng, map, day, 'restaurants', 1000);
}

async function showNearbyHotels(lat, lng, map, day) {
    return showNearbyPlacesByCategory(lat, lng, map, day, 'hotels', 1000);
}

async function showNearbyMarkets(lat, lng, map, day) {
    return showNearbyPlacesByCategory(lat, lng, map, day, 'markets', 1000);
}

async function showNearbyEntertainment(lat, lng, map, day) {
    return showNearbyPlacesByCategory(lat, lng, map, day, 'entertainment', 1000);
}

// Eski fonksiyonları yeni fonksiyona yönlendir (geriye dönük uyumluluk)
window.addRestaurantToTripFromPopup = function(imgId, name, address, day, lat, lon) {
    return window.addPlaceToTripFromPopup(imgId, name, address, day, lat, lon, 'restaurant');
};

window.addHotelToTripFromPopup = function(imgId, name, address, day, lat, lon) {
    return window.addPlaceToTripFromPopup(imgId, name, address, day, lat, lon, 'hotel');
};

window.addMarketToTripFromPopup = function(imgId, name, address, day, lat, lon) {
    return window.addPlaceToTripFromPopup(imgId, name, address, day, lat, lon, 'market');
};

window.addEntertainmentToTripFromPopup = function(imgId, name, address, day, lat, lon) {
    return window.addPlaceToTripFromPopup(imgId, name, address, day, lat, lon, 'entertainment');
};