
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
        // Düzenlenmiş nokta bilgisini al
        const pointInfo = window._currentPointInfo || { name: "Seçilen Nokta", address: "", opening_hours: "" };
        const placeName = pointInfo.name;
        
        // Görsel al
        let imageUrl = "img/placeholder.png";
        if (typeof getPexelsImage === "function") {
            try {
                imageUrl = await getPexelsImage(placeName + " " + (window.selectedCity || ""));
                if (!imageUrl || imageUrl === PLACEHOLDER_IMG) {
                    throw new Error("Pexels image not found");
                }
            } catch (e) {
                if (typeof getPixabayImage === "function") {
                    try {
                        imageUrl = await getPixabayImage(placeName);
                    } catch (e2) {
                        imageUrl = "img/placeholder.png";
                    }
                }
            }
        }
        
        // Sepete ekle
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

        
        // Popup'ı kapat
        closeNearbyPopup();
        
        // Başarı mesajı
console.log(`"${placeName}" added to cart!`);
        
    } catch (error) {
    console.error('An error occurred while adding the point to the cart:', error);
alert('An error occurred while adding the point to the cart.');
    }
};
if (typeof updateCart === "function") updateCart();

// FIX: addToCart fonksiyonunu da güncelleyelim
window.addNearbyPlaceToTripFromPopup = async function(idx, day, placeLat, placeLng) {
    if (!window._lastNearbyPlaces || !window._lastNearbyPlaces[idx]) return;
    
    const f = window._lastNearbyPlaces[idx];
    const photo = (window._lastNearbyPhotos && window._lastNearbyPhotos[idx]) ? window._lastNearbyPhotos[idx] : "img/placeholder.png";
    
    // FIX: Mekanın gerçek koordinatlarını kullan
    const actualLat = parseFloat(placeLat);
    const actualLng = parseFloat(placeLng);
    
    console.log(`Adding place: ${f.properties.name} at ${actualLat}, ${actualLng}`); // Debug log
    
    addToCart(
        f.properties.name || "Unnamed",
        photo,
        day,
        "Place",
        f.properties.formatted || "",
        null, null,
        f.properties.opening_hours || "",
        null,
        { lat: actualLat, lng: actualLng }, // FIX: Doğru koordinatlar
        f.properties.website || ""
    );
    
    // Popup'ı kapat ve başarı mesajı göster
    closeNearbyPopup();
    if (typeof updateCart === "function") updateCart();

    
    // Expanded map varsa ona da marker ekle
    const expandedMapData = Object.values(window.expandedMaps || {}).find(m => m.day === day);
    if (expandedMapData && expandedMapData.expandedMap) {
        const map = expandedMapData.expandedMap;
        
        // Başarı popup'ı göster
        L.popup()
            .setLatLng([actualLat, actualLng])
            .setContent(`<div style="text-align:center;"><b>${f.properties.name}</b><br><small style="color:#4caf50;">✓ Added!</small></div>`)
            .openOn(map);
        
        setTimeout(() => map.closePopup(), 2000);
        
        // Haritayı yeni eklenen yere odakla (isteğe bağlı)
        map.setView([actualLat, actualLng], map.getZoom(), { animate: true });
    }
};
if (typeof updateCart === "function") updateCart();

// Custom popup sistemi - harita katmanının üzerinde
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

  // 3. LEAFLET KATMAN TARAMASI (Agresif Temizlik)
  // Eğer global değişken referansı kaybolduysa, haritadaki layerları tarayıp class isminden bulup siler.
  const mapsToCheck = [];
  if (window.leafletMaps) mapsToCheck.push(...Object.values(window.leafletMaps));
  if (window.expandedMaps) mapsToCheck.push(...Object.values(window.expandedMaps).map(o => o.expandedMap));

  mapsToCheck.forEach(map => {
      if (map && map.eachLayer) {
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
  
  // 4. Diğer temizlikler (Restoran markerları vs.)
  if (window._restaurant3DMarkers) {
      window._restaurant3DMarkers.forEach(m => { try { m.remove(); } catch(e){} });
      window._restaurant3DMarkers = [];
  }
  if (window._restaurant3DLayers && window._maplibre3DInstance) {
      window._restaurant3DLayers.forEach(id => {
          if (window._maplibre3DInstance.getLayer(id)) window._maplibre3DInstance.removeLayer(id);
          if (window._maplibre3DInstance.getSource(id)) window._maplibre3DInstance.removeSource(id);
      });
      window._restaurant3DLayers = [];
  }
  
  if (window.leafletMaps) {
      Object.values(window.leafletMaps).forEach(map => {
          if (map.__restaurantLayers) {
              map.__restaurantLayers.forEach(l => { try { l.remove(); } catch(e){} });
              map.__restaurantLayers = [];
          }
      });
  }
  
  if (window.expandedMaps) {
      Object.values(window.expandedMaps).forEach(obj => {
          if (obj.expandedMap && obj.expandedMap.__restaurantLayers) {
              obj.expandedMap.__restaurantLayers.forEach(l => { try { l.remove(); } catch(e){} });
              obj.expandedMap.__restaurantLayers = [];
          }
      });
  }

  window._currentNearbyPopupElement = null;
};

function showSearchButton(lat, lng, map, options = {}) {
    const bufferMeters = options.radius || 1000;
    const categories = options.categories || "catering.restaurant";

    // Proxy üzerinden çağrı: anahtar kullanımı yok
    const url = `/api/geoapify/places?categories=${encodeURIComponent(categories)}&filter=circle:${lng},${lat},${bufferMeters}&limit=50`;

    const button = L.control({ position: 'topright' });
    button.onAdd = function () {
        const div = L.DomUtil.create('div', 'custom-search-btn');
        div.innerHTML = '<button id="search-restaurants-btn" style="padding:8px 16px;border-radius:8px;background:#1976d2;color:#fff;font-weight:600;">Bu alanda restoran ara</button>';
        div.onclick = async function () {
            try {
                const resp = await fetch(url);
                if (!resp.ok) {
                    alert("Restoranlar alınamadı. Lütfen tekrar deneyin.");
                    map.removeControl(button);
                    return;
                }
                const data = await resp.json();
                if (!data.features || data.features.length === 0) {
                    alert("Bu alanda restoran bulunamadı!");
                    map.removeControl(button);
                    return;
                }

                data.features.forEach(f => {
                    const p = f.properties || {};
                    L.marker([p.lat, p.lon]).addTo(map).bindPopup(`<b>${p.name || "Restoran"}</b>`);
                });
                alert(`Bu alanda ${data.features.length} restoran bulundu.`);
            } catch (err) {
                console.error("Restoran arama hatası:", err);
                alert("Restoranlar alınamadı. Lütfen tekrar deneyin.");
            } finally {
                map.removeControl(button);
            }
        };
        return div;
    };
    button.addTo(map);
}
function attachClickNearbySearch(map, day, options = {}) {
  const radius = options.radius || 500; 

  // Eski listener varsa temizle
  if (map.__ttNearbyClickBound) {
      map.off('click', map.__ttNearbyClickHandler);
      map.__ttNearbyClickBound = false;
  }

  let __nearbySingleTimer = null;
  const __nearbySingleDelay = 250;

  // Yeni Tıklama İşleyicisi (Filtresiz)
  const clickHandler = function(e) {
    // Sadece "Nearby Popup" açıkken tıklanırsa onu kapatıp yenisini açmak için devam et.
    // Markerlara tıklayınca zaten L.DomEvent.stopPropagation() marker içinde yapıldığı için burası tetiklenmez.
    // Bu yüzden buradaki manuel "leaflet-interactive" kontrolünü KALDIRIYORUZ.
    
    if (__nearbySingleTimer) clearTimeout(__nearbySingleTimer);
    
    __nearbySingleTimer = setTimeout(async () => {
      console.log("[Nearby] Map clicked at:", e.latlng); // Konsoldan takip edebilirsiniz
      
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
async function showNearbyPlacesPopup(lat, lng, map, day, radius = 500) {
    // 1. Önce kesinlikle eskileri temizle
    if (typeof closeNearbyPopup === 'function') {
        closeNearbyPopup();
    }

    const categories = "accommodation.hotel,catering.restaurant,catering.cafe,leisure.park,entertainment.cinema";
    const url = `https://api.geoapify.com/v2/places?categories=${categories}&filter=circle:${lng},${lat},${radius}&limit=20&apiKey=${apiKey}`;

    // Loading popup göster
    // NOT: Marker oluşturma işini showCustomPopup yapacağı için buradan SİLDİK.
    const loadingContent = `
        <div class="nearby-loading-message">
            <div class="nearby-loading-spinner"></div>
            <small class="nearby-loading-text">Searching nearby...</small>
        </div>
    `;
    
    // showCustomPopup hem popup'ı açar HEM DE pulse marker'ı haritaya koyar.
    showCustomPopup(lat, lng, map, loadingContent, false);

    // Haritayı merkeze al (Marker'ı showCustomPopup koyduğu için sadece pan/fly yapıyoruz)
    const isMapLibre = !!map.addSource;
    if (isMapLibre) {
         map.flyTo({ center: [lng, lat], zoom: 15, speed: 0.8 });
    } else {
         const currentZoom = map.getZoom();
         if (currentZoom < 14) map.flyTo([lat, lng], 15, { duration: 0.5 });
         else map.panTo([lat, lng], { animate: true, duration: 0.4 });
    }

    try {
        // Nokta ismini bul (Reverse Geocoding)
        let pointInfo = { name: "Selected Point", address: "" };
        try { pointInfo = await getPlaceInfoFromLatLng(lat, lng); } catch (e) {}

        const resp = await fetch(url);
        const data = await resp.json();

        let results = [];
        let photos = [];
        let placesHtml = "";

        if (data.features && data.features.length > 0) {
            results = data.features
                .filter(f => !!f.properties.name && f.properties.name.trim().length > 2)
                .map(f => ({ ...f, distance: haversine(lat, lng, f.properties.lat, f.properties.lon) }))
                .sort((a, b) => a.distance - b.distance)
                .slice(0, 10);

            if (results.length > 0) {
                try {
                    photos = await Promise.all(results.map(async (f) => {
                        const name = f.properties.name || "";
                        const cityQuery = name + " " + (window.selectedCity || "");
                        try {
                            let imageUrl = null;
                            if (typeof getPexelsImage === "function") {
                                imageUrl = await getPexelsImage(cityQuery);
                            }
                            if (imageUrl && imageUrl !== PLACEHOLDER_IMG && await isImageValid(imageUrl)) {
                                return imageUrl;
                            }
                            if (typeof getPixabayImage === "function") {
                                imageUrl = await getPixabayImage(name);
                                if (imageUrl && imageUrl !== PLACEHOLDER_IMG && await isImageValid(imageUrl)) {
                                    return imageUrl;
                                }
                            }
                            return PLACEHOLDER_IMG;
                        } catch (error) {
                            return PLACEHOLDER_IMG;
                        }
                    }));
                } catch (photoError) {
                    photos = results.map(() => PLACEHOLDER_IMG);
                }

                placesHtml = results.map((f, idx) => {
                    const name = f.properties.name || "(İsim yok)";
                    const adr = f.properties.formatted || "";
                    const photo = photos[idx] || PLACEHOLDER_IMG;
                    const distStr = f.distance < 1000
                        ? `${Math.round(f.distance)} m`
                        : `${(f.distance / 1000).toFixed(2)} km`;

                    const placeLat = f.properties.lat || f.geometry.coordinates[1];
                    const placeLng = f.properties.lon || f.geometry.coordinates[0];
                    const imgId = `nearby-img-${day}-${idx}`;

                    return `
                        <li class="nearby-place-item">
                            <div class="nearby-place-image">
                                <img id="${imgId}" src="${photo}" alt="${name}" class="nearby-place-img"
                                     onload="this.style.opacity='1'"
                                     onerror="handleImageError(this, '${name}', ${idx})"
                                     data-original-src="${photo}" data-place-name="${name}" data-index="${idx}">
                                <div style="position:absolute;top:0;left:0;width:42px;height:42px;background:#f5f5f5;border-radius:8px;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.3s;" class="img-loading">
                                    <div class="nearby-loading-spinner" style="width:16px;height:16px;"></div>
                                </div>
                            </div>
                            <div class="nearby-place-info">
                                <div class="nearby-place-name">${name}</div>
                                <div class="nearby-place-address">${adr}</div>
                            </div>
                            <div class="nearby-place-actions">
                                <div class="nearby-place-distance">${distStr}</div>
                                <button class="nearby-place-add-btn" onclick="window.addNearbyPlaceToTripFromPopup(${idx}, ${day}, '${placeLat}', '${placeLng}')">+</button>
                            </div>
                        </li>`;
                }).join('');
            } else {
                placesHtml = "<li class='nearby-no-results'>No places found within 500 meters in this area.</li>";
            }
        } else {
            placesHtml = "<li class='nearby-no-results'>No places found within 500 meters in this area.</li>";
        }

        const addPointSection = `
            <div class="add-point-section" style="margin-bottom: 12px; border-bottom: 1px solid #e0e0e0; padding-bottom: 12px;">
                <div class="point-item" style="display: flex; align-items: center; gap: 12px; padding: 8px; background: #f8f9fa; border-radius: 8px; margin-bottom: 8px;">
                    <div class="point-image" style="width: 42px; height: 42px; position: relative;">
                        <img id="clicked-point-img" src="img/placeholder.png" alt="Seçilen Nokta" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px; opacity: 0.8;">
                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 16px;">📍</div>
                    </div>
                    <div class="point-info" style="flex: 1; min-width: 0;">
                        <div class="point-name-editor" style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                            <span id="point-name-display" style="font-weight: 500; font-size: 14px; cursor: pointer; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" onclick="window.editPointName()">${pointInfo.name}</span>
                            <button onclick="window.editPointName()" style="background: none; border: none; font-size: 12px; cursor: pointer; color: #666; padding: 2px;">✏️</button>
                            <input type="text" id="point-name-input" value="${pointInfo.name}" style="display: none; flex: 1; padding: 4px 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;">
                        </div>
                        <div class="point-address" style="font-size: 12px; color: #666; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${pointInfo.address || 'Selected location'}
                        </div>
                    </div>
                    <div class="point-actions" style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                        <div style="font-size: 11px; color: #999; text-align: center;">Clicked</div>
                        <button class="add-point-to-cart-btn" onclick="window.addClickedPointToCart(${lat}, ${lng}, ${day})" style="width: 32px; height: 32px; background: #1976d2; color: white; border: none; border-radius: 50%; font-size: 16px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center;">+</button>
                    </div>
                </div>
            </div>
        `;

        const restaurantBtnHtml = `
            <div style="text-align:center; margin: 20px 0 4px 0;">
                <button id="show-restaurants-btn" style="padding:10px 18px;border-radius:9px;background:#8a4af3;color:#fff;font-size:15px;font-weight:bold;cursor:pointer;">
                    🍽️ Show Restaurants
                </button>
            </div>
        `;

        const html = `
            <div class="nearby-popup-title">📍 Nearby Places</div>
            ${addPointSection}
            <ul class="nearby-places-list">${placesHtml}</ul>
            ${restaurantBtnHtml}
        `;

        showCustomPopup(lat, lng, map, html, true);

        // --- BUTTON EVENT LISTENER ---
        setTimeout(() => {
            const btn = document.getElementById("show-restaurants-btn");
            if (btn) {
                btn.onclick = function() {
                    // Restoranları gösterirken mevcut popup'ı ve markerı temizle
                    if (typeof closeNearbyPopup === 'function') closeNearbyPopup();
                    showNearbyRestaurants(lat, lng, map, day);
                };
            }
        }, 250);

        window._lastNearbyPlaces = results;
        window._lastNearbyPhotos = photos;
        window._lastNearbyDay = day;
        window._currentPointInfo = pointInfo;
        loadClickedPointImage(pointInfo.name);

    } catch (error) {
        console.error('Nearby places fetch error:', error);
        const errorContent = '<div class="nearby-error-message">An error occurred while loading nearby places.</div>';
        showCustomPopup(lat, lng, map, errorContent, true);
    }
}
async function showNearbyRestaurants(lat, lng, map, day) {
    // ---------------------------------------------------------
    // 1. CSS ENJEKSİYONU: 3D MAP POPUP TASARIMINI 2D İLE EŞİTLEME
    // ---------------------------------------------------------
    if (!document.getElementById('tt-popup-unified-styles')) {
        const style = document.createElement('style');
        style.id = 'tt-popup-unified-styles';
        style.innerHTML = `
            /* MapLibre (3D) Popup Konteynerini Sıfırla */
            .maplibregl-popup-content {
                padding: 0 !important;
                background: transparent !important; /* İçerik kendi arkaplanına sahip */
                border-radius: 8px !important;
                box-shadow: 0 3px 14px rgba(0,0,0,0.4) !important;
                width: 341px !important; /* Leaflet ile aynı genişlik */
                max-width: 360px !important;
            }

            /* MapLibre Kapatma Butonunu Leaflet Tarzı Yap */
            .maplibregl-popup-close-button {
                font-size: 18px;
                color: #c3c3c3; /* Leaflet grideki 'x' rengi */
                right: 10px;
                top: 10px;
                background: transparent;
                border: none;
                z-index: 10;
                font-family: sans-serif;
            }
            .maplibregl-popup-close-button:hover {
                color: #555;
                background-color: transparent;
            }

            /* Ok İşaretinin (Tip) Rengini İçerik Rengiyle (#f8f9fa) Eşle */
            .maplibregl-popup-anchor-top .maplibregl-popup-tip,
            .maplibregl-popup-anchor-top-left .maplibregl-popup-tip,
            .maplibregl-popup-anchor-top-right .maplibregl-popup-tip {
                border-bottom-color: #f8f9fa !important;
            }
            .maplibregl-popup-anchor-bottom .maplibregl-popup-tip,
            .maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip,
            .maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip {
                border-top-color: #f8f9fa !important;
            }
            .maplibregl-popup-anchor-left .maplibregl-popup-tip {
                border-right-color: #f8f9fa !important;
            }
            .maplibregl-popup-anchor-right .maplibregl-popup-tip {
                border-left-color: #f8f9fa !important;
            }
        `;
        document.head.appendChild(style);
    }
    // ---------------------------------------------------------

    const isMapLibre = !!map.addSource; // MapLibre kontrolü

    // 2D Temizliği (Leaflet)
    if (map.__restaurantLayers) {
        map.__restaurantLayers.forEach(l => l.remove());
        map.__restaurantLayers = [];
    }
    // 3D Temizliği (MapLibre)
    if (window._restaurant3DLayers) {
        window._restaurant3DLayers.forEach(id => {
            if (map.getLayer(id)) map.removeLayer(id);
            if (map.getSource(id)) map.removeSource(id);
        });
        window._restaurant3DLayers = [];
    }
    if (window._restaurant3DMarkers) {
        window._restaurant3DMarkers.forEach(m => m.remove());
        window._restaurant3DMarkers = [];
    }

    const url = `https://api.geoapify.com/v2/places?categories=catering.restaurant,catering.cafe,catering.bar,catering.fast_food,catering.pub&filter=circle:${lng},${lat},1000&limit=20&apiKey=${apiKey}`;

    try {
        const resp = await fetch(url);
        const data = await resp.json();
        
        if (!data.features || data.features.length === 0) {
            alert("No restaurants found nearby.");
            return;
        }

        data.features.forEach((f, idx) => {
            // Koordinatları al
            const pLng = f.properties.lon;
            const pLat = f.properties.lat;
            const imgId = `rest-img-${idx}-${Date.now()}`; 

            // İçerik HTML'i (Her ikisi için ortak)
            // Not: getFastRestaurantPopupHTML fonksiyonun mevcut ve doğru çalışıyor olmalı
            let popupContent = "";
            if (typeof getFastRestaurantPopupHTML === 'function') {
                popupContent = getFastRestaurantPopupHTML(f, imgId, day);
            } else {
                popupContent = `<b>${f.properties.name || "Restaurant"}</b>`;
            }

            if (isMapLibre) {
                // ==========================================
                // --- 3D HARİTA (MapLibre) ---
                // ==========================================
                window._restaurant3DLayers = window._restaurant3DLayers || [];
                window._restaurant3DMarkers = window._restaurant3DMarkers || [];

                // Yeşil Çizgi
                const sourceId = `rest-line-src-${idx}`;
                const layerId = `rest-line-layer-${idx}`;
                if (!map.getSource(sourceId)) {
                    map.addSource(sourceId, {
                        type: 'geojson',
                        data: {
                            type: 'Feature',
                            geometry: { type: 'LineString', coordinates: [[lng, lat], [pLng, pLat]] } // [lng, lat]
                        }
                    });
                    map.addLayer({
                        id: layerId,
                        type: 'line',
                        source: sourceId,
                        layout: { 'line-join': 'round', 'line-cap': 'round' },
                        paint: { 'line-color': '#22bb33', 'line-width': 4, 'line-opacity': 0.8, 'line-dasharray': [2, 2] }
                    });
                    window._restaurant3DLayers.push(layerId);
                    window._restaurant3DLayers.push(sourceId);
                }

                // Marker Elementi
                const el = document.createElement('div');
                if (typeof getPurpleRestaurantMarkerHtml === 'function') {
                    el.innerHTML = getPurpleRestaurantMarkerHtml(); 
                } else {
                    el.style.cssText = 'background:#8a4af3;width:32px;height:32px;border-radius:50%;border:2px solid white;';
                }
                el.className = 'custom-3d-marker-element';
                el.style.cursor = 'pointer';
                el.style.zIndex = '2000';

                // Popup (CSS ile Leaflet'e benzetildi)
                const popup = new maplibregl.Popup({ 
                    offset: 25, 
                    maxWidth: '360px', 
                    closeButton: true,
                    className: 'tt-unified-popup' // CSS hedeflemesi için
                }).setHTML(popupContent);

                popup.on('open', () => {
                    if (typeof handlePopupImageLoading === 'function') handlePopupImageLoading(f, imgId);
                });

                const marker = new maplibregl.Marker({ element: el })
                    .setLngLat([pLng, pLat])
                    .setPopup(popup)
                    .addTo(map);
                
                // Manuel tıklama kontrolü
                el.addEventListener('click', (e) => { e.stopPropagation(); marker.togglePopup(); });
                window._restaurant3DMarkers.push(marker);

            } else {
                // ==========================================
                // --- 2D HARİTA (Leaflet) ---
                // ==========================================
                map.__restaurantLayers = map.__restaurantLayers || [];
                
                // DÜZELTME: [Lat, Lng] sırasını zorla
                // lat, lng = Kullanıcı konumu
                // pLat, pLng = Restoran konumu
                const line = L.polyline([[lat, lng], [pLat, pLng]], { 
                    color: "#22bb33", weight: 4, opacity: 0.95, dashArray: "8,8" 
                }).addTo(map);
                map.__restaurantLayers.push(line);

                const iconHtml = (typeof getPurpleRestaurantMarkerHtml === 'function') 
                    ? getPurpleRestaurantMarkerHtml() 
                    : '<div style="background:purple;width:20px;height:20px;"></div>';

                const marker = L.marker([pLat, pLng], {
                    icon: L.divIcon({ html: iconHtml, className: "", iconSize: [32,32], iconAnchor: [16,16] })
                }).addTo(map);
                map.__restaurantLayers.push(marker);

                marker.bindPopup(popupContent, { maxWidth: 341 }); // Leaflet standardı
                
                marker.on("popupopen", function() { 
                    if (typeof handlePopupImageLoading === 'function') handlePopupImageLoading(f, imgId); 
                });
            }
        });

    } catch (err) {
        console.error(err);
        alert("Error fetching restaurants.");
    }
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
          <div class="point-address" style="font-size: 11px; color: #666; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${safeAddress}</div>
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



async function searchRestaurantsAt(lat, lng, map) {
    const bufferMeters = 1000; // 1 km çap
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
  
  banner.style.display = 'flex';
  
  // Tıklanabilir olduğunu göstermek için imleci değiştir
  banner.style.cursor = 'pointer';

  // --- TÜM KUTUYA TIKLAYINCA KAPAT ---
  banner.onclick = function() {
    banner.style.display = 'none';
  };

  // X butonuna basılınca da kapansın (Bubble etkisini beklemeden)
  const closeBtn = banner.querySelector('#close-route-info');
  if (closeBtn) {
    closeBtn.onclick = function(e) {
      e.stopPropagation(); // Banner click'ini tetiklemesin, direkt kapatsın
      banner.style.display = 'none';
    };
  }

  // Otomatik kapanma (5 saniye)
  setTimeout(function() {
    if (banner.style.display !== 'none') {
      banner.style.display = 'none';
    }
  }, 5000);
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
        
    // Sepete Ekle
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

    // =========================================================
    // --- RESTORAN MARKERLARINI VE ÇİZGİLERİNİ TEMİZLE ---
    // =========================================================

    // 1. 3D Map (MapLibre) Temizliği
    if (window._maplibre3DInstance) {
        if (window._restaurant3DLayers) {
            window._restaurant3DLayers.forEach(id => {
                if (window._maplibre3DInstance.getLayer(id)) window._maplibre3DInstance.removeLayer(id);
                if (window._maplibre3DInstance.getSource(id)) window._maplibre3DInstance.removeSource(id);
            });
            window._restaurant3DLayers = [];
        }
        if (window._restaurant3DMarkers) {
            window._restaurant3DMarkers.forEach(m => m.remove());
            window._restaurant3DMarkers = [];
        }
    }

    // 2. 2D Map (Leaflet) Temizliği
    const allMaps = [];
    // Aktif tüm Leaflet haritalarını topla
    if (window.leafletMaps) allMaps.push(...Object.values(window.leafletMaps));
    if (window.expandedMaps) allMaps.push(...Object.values(window.expandedMaps).map(o => o.expandedMap));
    
    allMaps.forEach(map => {
        if (map && map.__restaurantLayers) {
            map.__restaurantLayers.forEach(l => {
               try { l.remove(); } catch(e) {}
            });
            map.__restaurantLayers = [];
        }
    });
    // =========================================================

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


async function showNearbyPlacesPopup(lat, lng, map, day, radius = 500) {
  // MapLibre kontrolü
  const isMapLibre = !!map.addSource;

  const apiKey = window.GEOAPIFY_API_KEY || "d9a0dce87b1b4ef6b49054ce24aeb462";
  const categories = "accommodation.hotel,catering.restaurant,catering.cafe,leisure.park,entertainment.cinema";
  const url = `https://api.geoapify.com/v2/places?categories=${categories}&filter=circle:${lng},${lat},${radius}&limit=20&apiKey=${apiKey}`;

  closeNearbyPopup(); // Eskileri temizle

  // Loading popup
  const loadingContent = `
    <div class="nearby-loading-message">
      <div class="nearby-loading-spinner"></div>
      <small class="nearby-loading-text">Searching nearby...</small>
    </div>
  `;
  showCustomPopup(lat, lng, map, loadingContent, false);

  // --- SİNYAL (PULSE) MARKER ---
  const pulseHtml = `
    <div class="user-loc-wrapper">
       <div class="user-loc-ring-1"></div>
       <div class="user-loc-ring-2"></div>
       <div class="user-loc-dot"></div>
    </div>
  `;

  if (isMapLibre) {
      // 3D Harita (MapLibre)
      const el = document.createElement('div');
      el.innerHTML = pulseHtml;
      window._nearbyPulseMarker3D = new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(map);
      
      map.flyTo({ center: [lng, lat], zoom: 15, speed: 0.8 });
  } else {
      // 2D Harita (Leaflet)
      const pulseIcon = L.divIcon({
        className: 'custom-loc-icon-leaflet',
        html: pulseHtml,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      window._nearbyPulseMarker = L.marker([lat, lng], { icon: pulseIcon, interactive: false }).addTo(map);
      
      const currentZoom = map.getZoom();
      if (currentZoom < 14) map.flyTo([lat, lng], 15, { duration: 0.5 });
      else map.panTo([lat, lng], { animate: true, duration: 0.4 });
  }
  // ----------------------------------------------

  try {
    // Nokta bilgisini al
    let pointInfo = { name: "Selected Point", address: "" };
    try { pointInfo = await getPlaceInfoFromLatLng(lat, lng); } catch (e) {}

    const resp = await fetch(url);
    const data = await resp.json();

    let results = [];
    let photos = [];
    let placesHtml = "";

    if (data.features && data.features.length > 0) {
      results = data.features
        .filter(f => !!f.properties.name && f.properties.name.trim().length > 2)
        .map(f => ({ ...f, distance: haversine(lat, lng, f.properties.lat, f.properties.lon) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 10);

      if (results.length > 0) {
        try {
          photos = await Promise.all(results.map(async (f) => {
            const name = f.properties.name || "";
            const cityQuery = name + " " + (window.selectedCity || "");
            try {
              let imageUrl = null;
              if (typeof getPexelsImage === "function") {
                imageUrl = await getPexelsImage(cityQuery);
              }
              if (imageUrl && imageUrl !== PLACEHOLDER_IMG && await isImageValid(imageUrl)) {
                return imageUrl;
              }
              if (typeof getPixabayImage === "function") {
                imageUrl = await getPixabayImage(name);
                if (imageUrl && imageUrl !== PLACEHOLDER_IMG && await isImageValid(imageUrl)) {
                  return imageUrl;
                }
              }
              return PLACEHOLDER_IMG;
            } catch (error) {
              return PLACEHOLDER_IMG;
            }
          }));
        } catch (photoError) {
          photos = results.map(() => PLACEHOLDER_IMG);
        }

        placesHtml = results.map((f, idx) => {
          const name = f.properties.name || "(İsim yok)";
          const adr = f.properties.formatted || "";
          const photo = photos[idx] || PLACEHOLDER_IMG;
          const distStr = f.distance < 1000
            ? `${Math.round(f.distance)} m`
            : `${(f.distance / 1000).toFixed(2)} km`;

          const placeLat = f.properties.lat || f.geometry.coordinates[1];
          const placeLng = f.properties.lon || f.geometry.coordinates[0];
          const imgId = `nearby-img-${day}-${idx}`;

            return `
              <li class="nearby-place-item">
                <div class="nearby-place-image">
                  <img id="${imgId}"
                       src="${photo}"
                       alt="${name}"
                       class="nearby-place-img"
                       onload="this.style.opacity='1'"
                       onerror="handleImageError(this, '${name}', ${idx})"
                       data-original-src="${photo}"
                       data-place-name="${name}"
                       data-index="${idx}">
                  <div style="position:absolute;top:0;left:0;width:42px;height:42px;background:#f5f5f5;border-radius:8px;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.3s;" class="img-loading">
                    <div class="nearby-loading-spinner" style="width:16px;height:16px;"></div>
                  </div>
                </div>
                <div class="nearby-place-info">
                  <div class="nearby-place-name">${name}</div>
                  <div class="nearby-place-address">${adr}</div>
                </div>
                <div class="nearby-place-actions">
                  <div class="nearby-place-distance">${distStr}</div>
                  <button class="nearby-place-add-btn"
                          onclick="window.addNearbyPlaceToTripFromPopup(${idx}, ${day}, '${placeLat}', '${placeLng}')">+</button>
                </div>
              </li>`;
        }).join('');
      } else {
        placesHtml = "<li class='nearby-no-results'>No places found within 500 meters in this area.</li>";
      }
    } else {
      placesHtml = "<li class='nearby-no-results'>No places found within 500 meters in this area.</li>";
    }

    const addPointSection = `
      <div class="add-point-section" style="margin-bottom: 12px; border-bottom: 1px solid #e0e0e0; padding-bottom: 12px;">
        <div class="point-item" style="display: flex; align-items: center; gap: 12px; padding: 8px; background: #f8f9fa; border-radius: 8px; margin-bottom: 8px;">
          <div class="point-image" style="width: 42px; height: 42px; position: relative;">
            <img id="clicked-point-img"
                 src="img/placeholder.png"
                 alt="Seçilen Nokta"
                 style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px; opacity: 0.8;">
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 16px;">📍</div>
          </div>
          <div class="point-info" style="flex: 1; min-width: 0;">
            <div class="point-name-editor" style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
              <span id="point-name-display"
                    style="font-weight: 500; font-size: 14px; cursor: pointer; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                    onclick="window.editPointName()">${pointInfo.name}</span>
              <button onclick="window.editPointName()"
                      style="background: none; border: none; font-size: 12px; cursor: pointer; color: #666; padding: 2px;">✏️</button>
              <input type="text" id="point-name-input" value="${pointInfo.name}"
                     style="display: none; flex: 1; padding: 4px 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;">
            </div>
            <div class="point-address" style="font-size: 12px; color: #666; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${pointInfo.address || 'Selected location'}
            </div>
          </div>
          <div class="point-actions" style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <div style="font-size: 11px; color: #999; text-align: center;">Clicked</div>
            <button class="add-point-to-cart-btn"
                    onclick="window.addClickedPointToCart(${lat}, ${lng}, ${day})"
                    style="width: 32px; height: 32px; background: #1976d2; color: white; border: none; border-radius: 50%; font-size: 16px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center;">+</button>
          </div>
        </div>
      </div>
    `;

    const restaurantBtnHtml = `
      <div style="text-align:center; margin: 20px 0 4px 0;">
        <button id="show-restaurants-btn" style="padding:10px 18px;border-radius:9px;background:#8a4af3;color:#fff;font-size:15px;font-weight:bold;cursor:pointer;">
          🍽️ Show Restaurants
        </button>
      </div>
    `;

    const html = `
      <div class="nearby-popup-title">
        📍 Nearby Places
      </div>
      ${addPointSection}
      <ul class="nearby-places-list">${placesHtml}</ul>
      ${restaurantBtnHtml}
    `;

    showCustomPopup(lat, lng, map, html, true);

    // --- BUTTON EVENT LISTENER GÜNCELLENDİ ---
    setTimeout(() => {
        const btn = document.getElementById("show-restaurants-btn");
        if (btn) {
            btn.onclick = function() {
                // 1. Önce Nearby Popup'ı kapat
                if (typeof closeNearbyPopup === 'function') {
                    closeNearbyPopup();
                }
                // 2. Sonra restoranları haritaya ekle
                showNearbyRestaurants(lat, lng, map, day);
            };
        }
    }, 250);

    window._lastNearbyPlaces = results;
    window._lastNearbyPhotos = photos;
    window._lastNearbyDay = day;
    window._currentPointInfo = pointInfo;
    loadClickedPointImage(pointInfo.name);

  } catch (error) {
    console.error('Nearby places fetch error:', error);
    const errorContent = '<div class="nearby-error-message">An error occurred while loading nearby places.</div>';
    showCustomPopup(lat, lng, map, errorContent, true);
  }
}