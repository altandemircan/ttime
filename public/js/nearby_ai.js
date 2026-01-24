
let aiAbortController = null;
let aiDebounceTimeout = null;
// BUNU DOSYA BAŞINDA tanımla (global olmalı)
let aiActiveRequest = 0;


// Görsel doğrulama fonksiyonu
function getBestCityForAI(pointInfo) {
    if (!pointInfo) return window.selectedCity || '';
    
    // Öncelik sırası:
    // 1. Tıklanan noktanın city bilgisi
    // 2. county bilgisi
    // 3. locality bilgisi
    // 4. Global selectedCity
    
    return pointInfo.city || 
           pointInfo.county || 
           pointInfo.locality || 
           window.selectedCity || 
           '';
}

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

function showCustomPopup(lat, lng, map, content, showCloseButton = true) {
    // Önceki popup'ı kapat
    if (typeof closeNearbyPopup === 'function') closeNearbyPopup();
    
    // Popup container oluştur
    const popupContainer = document.createElement('div');
    popupContainer.id = 'custom-nearby-popup';
    
    const closeButtonHtml = showCloseButton ? `
        <button onclick="closeNearbyPopup()" class="sidebar-toggle" title="Close"><img src="/img/close-icon.svg" alt="Close"></button>
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

    // 2. YENİ VE ÇARPIÇI PULSE MARKER HTML
    const pulseHtml = `
      <div class="tt-pulse-marker">
        <!-- Ana dot (daha büyük ve parlaktır) -->
        <div class="tt-pulse-dot">
          <div class="tt-pulse-dot-inner"></div>
        </div>
        
        <!-- Hızlı pulsating rings -->
        <div class="tt-pulse-ring tt-pulse-ring-1"></div>
        <div class="tt-pulse-ring tt-pulse-ring-2"></div>
        <div class="tt-pulse-ring tt-pulse-ring-3"></div>
        
        <!-- Parlaklık efekti -->
        <div class="tt-pulse-glow"></div>
        
        <!-- İç halka (daha hızlı) -->
        <div class="tt-pulse-inner-ring"></div>
      </div>
    `;

    // CSS'i inline ekle (eğer henüz eklenmemişse)
    if (!document.getElementById('tt-pulse-styles')) {
        const style = document.createElement('style');
        style.id = 'tt-pulse-styles';
        style.textContent = `
            .tt-pulse-marker {
                position: relative;
                width: 40px;
                height: 40px;
                pointer-events: none;
                z-index: 1000;
                filter: drop-shadow(0 0 8px rgba(25, 118, 210, 0.5));
            }
            
            .tt-pulse-dot {
                position: absolute;
                left: 50%;
                top: 50%;
                width: 20px;
                height: 20px;
                transform: translate(-50%, -50%);
                background: linear-gradient(135deg, #1976d2, #64b5f6);
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 
                    0 0 15px rgba(25, 118, 210, 0.8),
                    0 0 30px rgba(25, 118, 210, 0.4),
                    inset 0 2px 4px rgba(255, 255, 255, 0.5);
                z-index: 10;
                animation: tt-pulse-dot 2s ease-in-out infinite;
            }
            
            .tt-pulse-dot-inner {
                position: absolute;
                width: 6px;
                height: 6px;
                background: white;
                border-radius: 50%;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
            }
            
            .tt-pulse-ring {
                position: absolute;
                left: 50%;
                top: 50%;
                border: 2px solid rgba(25, 118, 210, 0.8);
                border-radius: 50%;
                transform: translate(-50%, -50%);
                opacity: 0;
            }
            
            .tt-pulse-ring-1 {
                width: 20px;
                height: 20px;
                animation: tt-pulse-wave 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            }
            
            .tt-pulse-ring-2 {
                width: 20px;
                height: 20px;
                animation: tt-pulse-wave 2s cubic-bezier(0.4, 0, 0.2, 1) infinite 0.3s;
            }
            
            .tt-pulse-ring-3 {
                width: 20px;
                height: 20px;
                animation: tt-pulse-wave 2s cubic-bezier(0.4, 0, 0.2, 1) infinite 0.6s;
            }
            
            .tt-pulse-glow {
                position: absolute;
                left: 50%;
                top: 50%;
                width: 40px;
                height: 40px;
                transform: translate(-50%, -50%);
                background: radial-gradient(circle, rgba(25, 118, 210, 0.3) 0%, transparent 70%);
                border-radius: 50%;
                z-index: 1;
                animation: tt-pulse-glow 2s ease-in-out infinite;
            }
            
            .tt-pulse-inner-ring {
                position: absolute;
                left: 50%;
                top: 50%;
                width: 30px;
                height: 30px;
                border: 1.5px solid rgba(255, 255, 255, 0.9);
                border-radius: 50%;
                transform: translate(-50%, -50%);
                animation: tt-pulse-inner 1.5s linear infinite;
                opacity: 0.7;
            }
            
            @keyframes tt-pulse-dot {
                0%, 100% { 
                    transform: translate(-50%, -50%) scale(1);
                    box-shadow: 
                        0 0 15px rgba(25, 118, 210, 0.8),
                        0 0 30px rgba(25, 118, 210, 0.4);
                }
                50% { 
                    transform: translate(-50%, -50%) scale(1.1);
                    box-shadow: 
                        0 0 25px rgba(25, 118, 210, 1),
                        0 0 50px rgba(25, 118, 210, 0.6);
                }
            }
            
            @keyframes tt-pulse-wave {
                0% {
                    width: 20px;
                    height: 20px;
                    opacity: 0.8;
                    border-width: 2px;
                }
                100% {
                    width: 80px;
                    height: 80px;
                    opacity: 0;
                    border-width: 1px;
                }
            }
            
            @keyframes tt-pulse-glow {
                0%, 100% { opacity: 0.5; }
                50% { opacity: 0.8; }
            }
            
            @keyframes tt-pulse-inner {
                0% { 
                    transform: translate(-50%, -50%) rotate(0deg) scale(1);
                    opacity: 0.7;
                }
                100% { 
                    transform: translate(-50%, -50%) rotate(360deg) scale(1.2);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // 3. Harita Tipine Göre Ekleme
    const isMapLibre = !!map.addSource;

    if (isMapLibre) {
        // --- 3D MOD (MapLibre) ---
        const el = document.createElement('div');
        el.className = 'tt-pulse-marker';
        el.innerHTML = pulseHtml;
        
        window._nearbyPulseMarker3D = new maplibregl.Marker({ 
            element: el,
            anchor: 'center'
        })
        .setLngLat([lng, lat])
        .addTo(map);
            
    } else {
        // --- 2D MOD (Leaflet) ---
        const pulseIcon = L.divIcon({
            html: pulseHtml,
            className: 'tt-pulse-marker',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });
        window._nearbyPulseMarker = L.marker([lat, lng], { icon: pulseIcon, interactive: false }).addTo(map);
    }
}

// Yardımcı fonksiyon: GeoJSON circle oluştur
function createCircleGeoJSON(lat, lng, radiusMeters, points = 64) {
    const coords = [];
    const earthRadius = 6378137; // metre
    
    for (let i = 0; i < points; i++) {
        const angle = (i * 360) / points;
        const angleRad = (angle * Math.PI) / 180;
        
        const latRad = (lat * Math.PI) / 180;
        const lngRad = (lng * Math.PI) / 180;
        
        const d = radiusMeters / earthRadius;
        
        const circleLat = Math.asin(
            Math.sin(latRad) * Math.cos(d) + 
            Math.cos(latRad) * Math.sin(d) * Math.cos(angleRad)
        );
        
        const circleLng = lngRad + Math.atan2(
            Math.sin(angleRad) * Math.sin(d) * Math.cos(latRad),
            Math.cos(d) - Math.sin(latRad) * Math.sin(circleLat)
        );
        
        coords.push([
            (circleLng * 180) / Math.PI,
            (circleLat * 180) / Math.PI
        ]);
    }
    
    // Kapanış için ilk noktayı tekrar ekle
    coords.push(coords[0]);
    
    return {
        type: 'Feature',
        geometry: {
            type: 'Polygon',
            coordinates: [coords]
        },
        properties: {}
    };
}

// Popup kapatma fonksiyonunu güncelle (tüm kategorileri temizleyecek şekilde)
window.closeNearbyPopup = function() {
    // 1. SADECE POPUP DOM ELEMENTINI KALDIR
    const popupElement = document.getElementById('custom-nearby-popup');
    if (popupElement) {
        popupElement.remove();
    }
    
    // 2. PULSE MARKER'I SİL
    if (window._nearbyPulseMarker) {
        try { window._nearbyPulseMarker.remove(); } catch(e) {}
        window._nearbyPulseMarker = null;
    }
    if (window._nearbyPulseMarker3D) {
        try { window._nearbyPulseMarker3D.remove(); } catch(e) {}
        window._nearbyPulseMarker3D = null;
    }
    
    // 3. RADIUS DAİRELERİNİ SİL (sadece ilk tıklama için)
    if (window._nearbyRadiusCircle) {
        try { window._nearbyRadiusCircle.remove(); } catch(e) {}
        window._nearbyRadiusCircle = null;
    }
    if (window._nearbyRadiusCircle3D && window._maplibre3DInstance) {
        try {
            const map = window._maplibre3DInstance;
            const circleId = window._nearbyRadiusCircle3D;
            if (map.getLayer(circleId + '-layer')) map.removeLayer(circleId + '-layer');
            if (map.getLayer(circleId + '-stroke')) map.removeLayer(circleId + '-stroke');
            if (map.getSource(circleId)) map.removeSource(circleId);
        } catch(e) {}
        window._nearbyRadiusCircle3D = null;
    }
    
    // 4. KATEGORİ DAİRELERİNİ SİL
    if (window._categoryRadiusCircle) {
        try { window._categoryRadiusCircle.remove(); } catch(e) {}
        window._categoryRadiusCircle = null;
    }
    if (window._categoryRadiusCircle3D && window._maplibre3DInstance) {
        try {
            const map = window._maplibre3DInstance;
            const circleId = window._categoryRadiusCircle3D;
            if (map.getLayer(circleId + '-layer')) map.removeLayer(circleId + '-layer');
            if (map.getLayer(circleId + '-stroke')) map.removeLayer(circleId + '-stroke');
            if (map.getSource(circleId)) map.removeSource(circleId);
        } catch(e) {}
        window._categoryRadiusCircle3D = null;
    }
    
    window._currentNearbyPopupElement = null;
};
// Ayrıca, haritaya tıklandığında tüm kategorileri temizleyen fonksiyon
function clearAllCategoryMarkers(map) {
    const categories = ['restaurant', 'hotel', 'market', 'entertainment'];
    
    // SADECE KATEGORİ LAYER'LARINI SİL - map.eachLayer() KULLANMA!
    categories.forEach(category => {
        const layerKey = `__${category}Layers`;
        if (map && map[layerKey] && Array.isArray(map[layerKey])) {
            map[layerKey].forEach(l => {
                try {
                    map.removeLayer(l);
                } catch(e) {}
            });
            map[layerKey] = [];
        }
    });
    
    // 3D HARITA TEMİZLİĞİ
    const isMapLibre = map && !!map.addSource;
    if (isMapLibre) {
        categories.forEach(category => {
            const marker3DKey = `_${category}3DMarkers`;
            const layer3DKey = `_${category}3DLayers`;
            
            if (window[marker3DKey]) {
                window[marker3DKey].forEach(m => { try { m.remove(); } catch(e){} });
                window[marker3DKey] = [];
            }
            
            if (window[layer3DKey]) {
                window[layer3DKey].forEach(id => {
                    try {
                        if (map.getLayer(id)) map.removeLayer(id);
                        if (map.getSource(id)) map.removeSource(id);
                    } catch(e) {}
                });
                window[layer3DKey] = [];
            }
        });
    }
    
    // KATEGORİ DAİRELERİNİ SİL
    if (window._categoryRadiusCircle) {
        try { window._categoryRadiusCircle.remove(); } catch(e) {}
        window._categoryRadiusCircle = null;
    }
    if (window._categoryRadiusCircle3D && map && map.getSource) {
        try {
            const circleId = window._categoryRadiusCircle3D;
            if (map.getLayer(circleId + '-layer')) map.removeLayer(circleId + '-layer');
            if (map.getLayer(circleId + '-stroke')) map.removeLayer(circleId + '-stroke');
            if (map.getSource(circleId)) map.removeSource(circleId);
        } catch(e) {}
        window._categoryRadiusCircle3D = null;
    }
    
    // HİÇBİR map.eachLayer() KULLANMA!
}

// attachClickNearbySearch fonksiyonunu güncelle
function attachClickNearbySearch(map, day, options = {}) {
  const radius = options.radius || 500; 

  // Eski listener varsa temizle
  if (map.__ttNearbyClickBound) {
      map.off('click', map.__ttNearbyClickHandler);
      map.__ttNearbyClickBound = false;
  }

  let __nearbySingleTimer = null;
  const __nearbySingleDelay = 250;

const clickHandler = function(e) {
    if (__nearbySingleTimer) clearTimeout(__nearbySingleTimer);
    
    __nearbySingleTimer = setTimeout(async () => {
        const isMapLibre = !!map.addSource;
        let lat, lng;
        
        if (isMapLibre) {
            lat = e.lngLat.lat;
            lng = e.lngLat.lng;
        } else {
            lat = e.latlng.lat;
            lng = e.latlng.lng;
        }
        
        // Pulse marker temizle
        if (window._nearbyPulseMarker) {
            try { window._nearbyPulseMarker.remove(); } catch(e) {}
            window._nearbyPulseMarker = null;
        }
        if (window._nearbyPulseMarker3D) {
            try { window._nearbyPulseMarker3D.remove(); } catch(e) {}
            window._nearbyPulseMarker3D = null;
        }
        
        // Eğer kategori seçilmişse direkt markerları göster
        if (window._lastSelectedCategory) {
            showNearbyPlacesByCategory(lat, lng, map, day, window._lastSelectedCategory);
        } else {
            // İlk tıklama: sidebar aç
            const popupElement = document.getElementById('custom-nearby-popup');
            if (popupElement) {
                popupElement.remove();
            }
            
            if (typeof showNearbyPlacesPopup === 'function') {
                showNearbyPlacesPopup(lat, lng, map, day, radius);
            }
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





function showRouteInfoBanner(day) {
  const expandedContainer = document.getElementById(`expanded-map-${day}`);
  if (!expandedContainer) return;

  let banner = expandedContainer.querySelector('#route-info-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'route-info-banner';
    banner.className = 'route-info-banner';
    banner.innerHTML = `
      <span>Click the map and view AI-generated information about each spot.</span>
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


// Add this function to nearby_ai.js to handle the click event
window.addNearbyPlaceToTripFromPopup = async function(index, day, lat, lon) {
    try {
        // 1. Retrieve the place data from the global cache created in showNearbyPlacesPopup
        const place = window._lastNearbyPlaces && window._lastNearbyPlaces[index];
        
        if (!place) {
            console.error("Place not found in cache. Index:", index);
            return;
        }

        const p = place.properties;
        const name = p.name || p.formatted || "Unknown Place";
        const address = p.formatted || "";
        const category = place.category || 'Place'; // Uses the category logic from generation
        
        // 2. Try to get an image (or use placeholder)
        let imageUrl = "img/placeholder.png";
        
        // If we have a cached photo list, try to use it (optional optimization)
        // Otherwise, fetch a new one or use placeholder
        if (typeof getPexelsImage === "function") {
            try {
                // Determine search query for image
                const city = window.selectedCity || "";
                imageUrl = await getPexelsImage(`${name} ${category} ${city}`);
            } catch (e) {
                console.warn('Image fetch failed, using placeholder');
            }
        }

        // 3. Add to Cart using the mainscript.js function
        if (typeof addToCart === "function") {
            addToCart(
                name,
                imageUrl,
                parseInt(day),
                category,
                address,
                null, // rating
                null, // user_ratings_total
                p.opening_hours || "",
                p.place_id,
                { lat: parseFloat(lat), lng: parseFloat(lon) },
                p.website || ""
            );
            
            // Visual Feedback (Change button content temporarily)
            const btn = document.activeElement;
            if (btn && btn.tagName === 'BUTTON') {
                const originalText = btn.innerHTML;
                btn.innerHTML = "✓";
                btn.style.color = "green";
                btn.style.borderColor = "green";
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.style.color = "";
                    btn.style.borderColor = "";
                }, 2000);
            }
        } else {
            console.error("addToCart function is missing!");
        }

    } catch (error) {
        console.error("Error adding nearby place to trip:", error);
    }
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




async function showNearbyPlacesPopup(lat, lng, map, day, radius = 2000) {

    console.log('[DEBUG] TIKLANAN NOKTANIN TAM BİLGİLERİ:');
console.log('Koordinatlar:', { lat, lng });



    // 1. Önce kesinlikle eskileri temizle
    if (typeof closeNearbyPopup === 'function') {
        closeNearbyPopup();
    }


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
    <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        min-height: 100%;
        width: 100%;
        padding: 20px;
        box-sizing: border-box;
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: white;
            padding-bottom: 80px;
    ">
        <div style="
            width: 36px;
    height: 36px;
    border: 4px solid rgba(25, 118, 210, 0.1);
    border-top: 4px solid #1976d2;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 20px;
        "></div>
        <div style="
            font-size: 16px;
            font-weight: 600;
            color: #333;
            margin-bottom: 8px;
            text-align: center;
        ">
            Searching nearby places
        </div>
        <div style="
            font-size: 14px;
            color: #666;
            max-width: 280px;
            line-height: 1.5;
            text-align: center;
        ">
            Looking for restaurants, hotels, markets and entertainment spots...
        </div>
    </div>
    <style>
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        @media (max-width: 768px) {
            .nearby-loading-spinner {
                width: 50px;
                height: 50px;
                border-width: 3px;
            }
            .nearby-loading-text {
                font-size: 16px;
            }
        }
    </style>
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
    try { 
        pointInfo = await getPlaceInfoFromLatLng(lat, lng); 
        console.log('[GEOAPIFY REVERSE RESULT] Full data:', pointInfo);
    } catch (e) {
        console.warn('getPlaceInfoFromLatLng failed:', e.message);
    }
    
   
    
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
                categorizedPlaces[key] = categorizedPlaces[key].slice(0, 10);
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
    restaurants: { text: "Show more", color: "#1976d2" },
    hotels: { text: "Show more", color: "#1976d2" },
    markets: { text: "Show more", color: "#1976d2" },
    entertainment: { text: "Show more", color: "#1976d2" }
};

        // Tıkalanan nokta bölümü
        const addPointSection = `
            <div class="add-point-section" style="margin-bottom: 16px; border-bottom: 1px solid #e0e0e0; padding-bottom: 16px;">
                <div class="point-item" style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 12px; background: #f8f9fa; border-radius: 8px; margin-bottom: 8px;">
                    <div class="point-image" style="width: 48px; height: 48px; position: relative; flex-shrink: 0;">
                        <img id="clicked-point-img" src="img/placeholder.png" alt="Clicked Point" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px; opacity: 0.8;">
                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 18px;">📍</div>
                    </div>
                    <div class="point-info" style="flex: 1; min-width: 0;">
                        <div class="point-name-editor" style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                            <span id="point-name-display" style="font-weight: 600; font-size: 15px; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${pointInfo.name}</span>
                            
                                                    </div>
                        <div class="point-address" style="font-size: 12px; color: #666; line-height: 1.3;">
                            ${pointInfo.address || 'Selected location'}
                        </div>
                    </div>
                    <div class="point-actions" style="display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0;">
                        <div style="font-size: 11px; color: #999;">Clicked</div>
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
    tabContentsHtml += `
        <div style="text-align: center; padding: 30px 20px; color: #999; font-size: 13px;">
            <div style="font-size: 24px; margin-bottom: 8px;">${tabTitles[key].icon}</div>
            No ${tabTitles[key].title.toLowerCase()} found in this area
            <div style="margin-top: 16px;">
                <button class="search-wider-btn" 
                        data-category="${key}"
                        style="padding:10px 18px; border-radius:9px; background:#1976d2; color:#fff; font-size:14px; font-weight:bold; cursor:pointer; border:none;">
                    Search wider area
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
                                    background: #f8f9fa; border-radius: 8px; margin-bottom: 10px; 
                                    border: 1px solid #eee;">
                            <div style="position: relative; width: 60px; height: 40px; flex-shrink: 0;">
                                <img src="${photo}" 
                                     alt="${name}"
                                     style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">
                                <div onclick="event.stopPropagation(); window.fetchClickedPointAI('${safeName}', ${p.lat}, ${p.lon}, '${locationContext}', {}, 'ai-point-description')" 
                                     style="position: absolute; bottom: -4px; right: -4px; width: 20px; height: 20px; background: #8a4af3; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.3); z-index: 10;">
                                    <span style="font-size: 10px; color: white;">✨</span>
                                </div>
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-weight: 600; font-size: 0.9rem; color: #333; 
                                            margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis;">
                                    ${name}
                                </div>
                                <div style="font-size: 0.9rem; color: #777; overflow: hidden; 
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
                    style="padding: 10px;
    margin: 16px 0;
    width: 100%;
    font-weight: 600;
    align-items: center;
    justify-content: center;
    border: 1px solid #ffffff;
    border-radius: 8px;
    background: #5588d0;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 0.9rem;
    color: #ffffff;
    box-shadow: rgba(149, 157, 165, 0.2) 0px 8px 24px;">
                Show more on the map
            </button>
        </div>
    `;
}
            
            tabContentsHtml += '</div>';
        });

        tabContentsHtml += '</div>';

        const html = `
            <div>
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
           // 1. KATEGORİ SEKMELERİ (Tab Click)
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

    // 2. "SHOW MORE ON THE MAP" BUTONU (Düzeltilen Kısım)
    document.querySelectorAll('.show-category-btn').forEach(btn => {
        btn.onclick = function() {
            const category = this.dataset.category;
            window._lastSelectedCategory = category;

            // --- FİX BAŞLANGIÇ: Mavi Pulse Marker'ı Temizle ---
            if (window._nearbyPulseMarker) {
                try { window._nearbyPulseMarker.remove(); } catch(e) {}
                window._nearbyPulseMarker = null;
            }
            if (window._nearbyPulseMarker3D) {
                try { window._nearbyPulseMarker3D.remove(); } catch(e) {}
                window._nearbyPulseMarker3D = null;
            }
            // --- FİX BİTİŞ ---

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

    // 3. "SEARCH WIDER AREA" BUTONU (Buna da ekleme yaptık)
    document.querySelectorAll('.search-wider-btn').forEach(btn => {
        btn.onclick = function(e) {
            e.stopPropagation();
            const category = this.dataset.category;
            const widerRadius = 5000;
            
            // --- FİX: Burada da Pulse Marker'ı Temizle ---
            if (window._nearbyPulseMarker) {
                try { window._nearbyPulseMarker.remove(); } catch(e) {}
                window._nearbyPulseMarker = null;
            }
            if (window._nearbyPulseMarker3D) {
                try { window._nearbyPulseMarker3D.remove(); } catch(e) {}
                window._nearbyPulseMarker3D = null;
            }
            // --- FİX SONU ---

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
let currentCityName = "";
let reverseData = null; // Değişkeni dışarıda tanımla

// 1. Önce reverse geocode yap
const reverseUrl = `/api/geoapify/reverse?lat=${lat}&lon=${lng}`;
try {
    const reverseResp = await fetch(reverseUrl);
    reverseData = await reverseResp.json();
    console.log('[FULL REVERSE GEOCODE RESPONSE]:', JSON.stringify(reverseData, null, 2));
    
    if (reverseData.features && reverseData.features[0]) {
        const props = reverseData.features[0].properties;
        console.log('[REVERSE GEOCODE PROPERTIES]:');
        console.log('- City:', props.city);
        console.log('- County:', props.county);
        console.log('- Country:', props.country);
        console.log('- Country Code:', props.country_code);
        
        // KURAL: Türkiye için county, diğer ülkeler için city
        if (props.country_code === 'tr' || props.country === 'Turkey') {
            // TÜRKİYE: county kullan
            currentCityName = props.county || "";
            console.log('[TÜRKİYE] County kullanılıyor:', currentCityName);
        } else {
            // DÜNYA: city kullan
            currentCityName = props.city || "";
            console.log('[DÜNYA] City kullanılıyor:', currentCityName);
        }
    }
} catch (e) {
    console.error('Reverse geocode error:', e);
}

// 2. Hala boşsa pointInfo'dan al
if (!currentCityName && pointInfo) {
    console.log('pointInfo structure:', pointInfo);
    
    // address içinden şehir çıkarmaya çalış
    if (pointInfo.address) {
        const addressParts = pointInfo.address.split(',');
        if (addressParts.length > 1) {
            // Adresin son parçasını al
            const lastPart = addressParts[addressParts.length - 1].trim();
            // Sayıları ve posta kodlarını temizle
            currentCityName = lastPart.replace(/\d+/g, '').replace('Turkey', '').trim();
        }
    }
}

// 3. Hala boşsa global city
if (!currentCityName) {
    currentCityName = window.selectedCity || "";
}

// DEBUG: Şehir adını konsola yazdır
console.log('[AI CITY DEBUG] Final city name:', currentCityName, {
    country: reverseData?.features?.[0]?.properties?.country,
    country_code: reverseData?.features?.[0]?.properties?.country_code,
    isTurkey: (reverseData?.features?.[0]?.properties?.country_code === 'tr' || 
               reverseData?.features?.[0]?.properties?.country === 'Turkey')
});
        
// Şehir bilgisi ve AI açıklaması kısmını güncelle:
if (pointInfo?.name && pointInfo?.name !== "Selected Point") {
    const category = pointInfo?.category || pointInfo?.type || "place";
    
    // currentCityName'i kullan
    if (!currentCityName || !currentCityName.trim()) {
        console.warn('[AI REQUEST] Şehir adı tespit edilemedi!', { 
            lat, 
            lng, 
            pointInfo,
            country: reverseData?.features?.[0]?.properties?.country,
            isTurkey: (reverseData?.features?.[0]?.properties?.country_code === 'tr')
        });
        return;
    }
    
    // AI için ülke bilgisini de ekle
    const country = reverseData?.features?.[0]?.properties?.country || "Turkey";
    const locationContext = `${currentCityName}, ${country}`;
    
    // ENHANCED AI FACTS (filtrelenmiş)
    const enhancedFacts = {};
    const props = reverseData?.features?.[0]?.properties;
    
    if (props) {
        // 1. Kategori/Tür bilgisi (varsa ve generic değilse)
        if (props.category && props.category !== "amenity" && !props.category.includes("unknown")) {
            enhancedFacts.category = props.category;
        }
        
        // 2. State/İl bilgisi (varsa ve boş değilse)
        if (props.state && props.state.trim() && props.state !== props.county) {
            enhancedFacts.state = props.state;
        }
        
        // 3. City bilgisi (varsa, boş değilse ve county'den farklıysa)
        if (props.city && props.city.trim() && props.city !== props.county) {
            enhancedFacts.city = props.city;
        }
        
        // 4. Popülerlik skoru (varsa ve anlamlı bir değerse)
        if (props.rank?.popularity && props.rank.popularity > 1) {
            enhancedFacts.popularity_score = Math.round(props.rank.popularity * 10) / 10;
        }
        
        // 5. Result type (varsa ve generic değilse)
        if (props.result_type && props.result_type !== "amenity") {
            enhancedFacts.place_type = props.result_type;
        }
        
        // 6. Formatted address (kısa versiyon, 100 karakterden azsa)
        if (props.formatted && props.formatted.length < 100) {
            enhancedFacts.address_short = props.formatted;
        }
    }
    
    // 7. Yakındaki yerler (varsa ve limitli)
    if (allPlaces && allPlaces.length > 0) {
        const nearbyNames = allPlaces
            .slice(0, 3)
            .map(p => p.properties.name)
            .filter(name => name && name.trim() && name !== pointInfo.name);
        
        if (nearbyNames.length > 0) {
            enhancedFacts.nearby_places = nearbyNames;
        }
    }
    
    console.log('AI request with enhanced facts:', { 
        point: pointInfo.name, 
        locationContext: locationContext,
        enhancedFacts: enhancedFacts,
        isTurkey: (country === 'Turkey' || reverseData?.features?.[0]?.properties?.country_code === 'tr'),
        lat: lat,
        lng: lng 
    });
    
    window.fetchClickedPointAI(
        pointInfo.name, 
        lat, 
        lng, 
        locationContext, 
        enhancedFacts, // Filtrelenmiş enhanced facts gönder
        'ai-point-description'
    );
}
    } catch (error) {
        console.error('Nearby places fetch error:', error);
        showCustomPopup(lat, lng, map, '<div style="color:red; padding:10px;">Error loading nearby places.</div>', true);
    }
}




// AI açıklaması fetch ve yazım fonksiyonu
async function fetchClickedPointAI(pointName, lat, lng, city, facts, targetDivId = 'ai-point-description') {
    const descDiv = document.getElementById(targetDivId);
    if (!descDiv) return;

    // --- EN GÜNCEL İSTEK KORUMASI / REQUEST GUARD ---
    aiActiveRequest++; // Yeni her çağrıda artır
    const myRequestId = aiActiveRequest;

    const isIconClick = targetDivId.startsWith('ai-icon-');
    const mainAiDiv = document.getElementById('ai-point-description');
    const targetElement = isIconClick ? mainAiDiv : descDiv;

    if (!targetElement) return;

    if (targetElement.dataset.loading === 'true' && !targetElement.querySelector('.ai-spinner')) {
        return;
    }

    if (targetDivId === 'ai-point-description' || isIconClick) {
        clearTimeout(aiDebounceTimeout);
        if (aiAbortController) aiAbortController.abort();
        aiAbortController = new AbortController();
    }

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

    // Aşamalı loading mesajları
    const loadingPhases = [
        { duration: 5000, text: `Loading AI analysis...` },
        { duration: 5000, text: `Analyzing ${pointName}...` },
        { duration: 5000, text: `Creating information ...` },
        { duration: 5000, text: `Finalizing analysis...` }
    ];

    let currentPhase = 0;
    const loadingTimers = [];

    const showLoadingPhase = (phaseIndex) => {
        const phase = loadingPhases[phaseIndex];
        const previousPhases = loadingPhases.slice(0, phaseIndex);

        targetElement.innerHTML = `
            <div style="padding: 12px; text-align: center; background: #f8f9fa; border-radius: 8px; margin-top: 8px; width: 100%; box-sizing: border-box;">
                <div class="ai-spinner" style="width: 18px; height: 18px; border: 2px solid #8a4af3; border-top: 2px solid transparent; border-radius: 50%; animation: ai-spin 0.8s linear infinite; margin: 0 auto 8px;"></div>
                
                ${previousPhases.map((p, idx) => `
                    <div style="font-size: 10px; color: #666; margin-bottom: 4px; opacity: 0.7;">
                        ✓ ${p.text}
                    </div>
                `).join('')}
                
                <div style="font-size: 11px; font-weight: 500; text-transform: uppercase; color: #666; margin-top: ${phaseIndex > 0 ? '8px' : '0'};">
                    ${phase.text}
                </div>
            </div>
            <style>@keyframes ai-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
        `;
    };

    // İlk loading göster
    showLoadingPhase(0);
    currentPhase = 0;

    // Sonraki aşamaları planla
    for (let i = 1; i < loadingPhases.length; i++) {
        const timer = setTimeout(() => {
            // Eğer bu loading artık eski ise daha değişiklik yapma!
            if (myRequestId !== aiActiveRequest) return;
            currentPhase = i;
            showLoadingPhase(i);
        }, loadingPhases.slice(0, i).reduce((sum, phase) => sum + phase.duration, 0));
        loadingTimers.push(timer);
    }

   // API çağrısını hemen başlat
    const triggerFetch = async () => {
        try {
            const cleanedCity = cleanCityContext(city);

            console.time('AI-API-Response');
            const response = await fetch('/clicked-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    point: pointName, 
                    city: cleanedCity, 
                    lat, 
                    lng, 
                    facts 
                })
            });
            console.timeEnd('AI-API-Response');

            // --- YALNIZCA EN GÜNCEL İSTEKTE SONUÇ YAZ ---
            if (myRequestId !== aiActiveRequest) {
                console.log('IGNORED: Eski AI request response (başka tıklama daha güncel).');
                return;
            }

            console.log('API Response status:', response.status);
            const data = await response.json();
            console.log('API Data received:', data);

            // Loading temizle
            loadingTimers.forEach(timer => clearTimeout(timer));
            targetElement.dataset.loading = 'false';

            // İçerik
            let p1Content = data.p1;
            let p2Content = data.p2;

            // Çok nadir durumlarda (Server tamamen boş dönerse) son koruma
            if (!p1Content || p1Content.length < 5) {
                p1Content = `${pointName} is located in ${city || 'the area'}. Explore the surroundings to discover more.`;
            }

            targetElement.innerHTML = `
                <div style="margin-top: 4px; width: 100%;">
                    <div style="background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #f0f0f0;">
                        <div style="padding: 12px; background: linear-gradient(135deg, #f0f7ff 0%, #e8f4ff 100%); border-bottom: 1px solid #e0e0e0;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="width: 28px; height: 28px; background: #8a4af3; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px;">✨</div>
                                <div>
                                    <div style="font-weight: 600; font-size: 14px; color: #333;">${pointName}</div>
                                    <div style="font-size: 11px; color: #666; margin-top: 2px;">AI Insight</div>
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
                                    <strong style="color: #333; font-size: 11px; display: block; margin-bottom: 2px;">Tip</strong>
                                    ${p2Content}
                                </div>
                            </div>` : ''}
                    </div>
                </div>`;

            console.log('targetElement after update:', targetElement);
            console.log('Update complete!');
        } catch (e) {
            loadingTimers.forEach(timer => clearTimeout(timer));

            if (myRequestId !== aiActiveRequest) {
                console.log("IGNORED: AI error (requestId not most recent)");
                return;
            }

            if (e.name === 'AbortError') {
                console.log('Request aborted');
                targetElement.innerHTML = "";
                targetElement.style.display = 'none';
                return;
            }
            targetElement.dataset.loading = 'false';
            targetElement.innerHTML = `
                <div style="padding: 10px; text-align: center; color: #666; font-size: 12px; background: #f9f9f9; border-radius: 6px; margin-top: 8px;">
                    <div style="margin-bottom: 4px;">⚠️ Information unavailable</div>
                    <small style="color: #999;">Try clicking another location</small>
                </div>`;
        }
    };

    if (targetDivId === 'ai-point-description' || isIconClick) {
        aiDebounceTimeout = setTimeout(triggerFetch, 600); // SADECE BİR KERE
    }
}


async function showNearbyPlacesByCategory(lat, lng, map, day, categoryType = 'restaurants') {
    window._lastSelectedCategory = categoryType;

    const isMapLibre = !!map.addSource;
    
    // +++ YENİ NOKTA İÇİN AI BİLGİSİ AL +++
    let pointInfo = { name: "Selected Point", address: "" };
    try { 
        pointInfo = await getPlaceInfoFromLatLng(lat, lng); 
    } catch (e) {
        console.warn('getPlaceInfoFromLatLng failed:', e.message);
    }
    
    // Reverse geocode için şehir adı al
    let currentCityName = "";
    const reverseUrl = `/api/geoapify/reverse?lat=${lat}&lon=${lng}`;
    try {
        const reverseResp = await fetch(reverseUrl);
        const reverseData = await reverseResp.json();
        
        if (reverseData.features && reverseData.features[0]) {
            const props = reverseData.features[0].properties;
            if (props.country_code === 'tr' || props.country === 'Turkey') {
                currentCityName = props.county || "";
            } else {
                currentCityName = props.city || "";
            }
        }
    } catch (e) {
        console.error('Reverse geocode error:', e);
    }
    
    if (!currentCityName) {
        currentCityName = window.selectedCity || "";
    }
    
    // AI'ye sor
    const country = "Turkey";
    const locationContext = `${currentCityName}, ${country}`;
    
   // Sidebar aç
    const addPointSection = `
        <div class="add-point-section" style="margin-bottom: 16px; border-bottom: 1px solid #e0e0e0; padding-bottom: 16px;">
            <div class="point-item" style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 12px; background: #f8f9fa; border-radius: 8px; margin-bottom: 8px;">
                <div class="point-image" style="width: 48px; height: 48px; position: relative; flex-shrink: 0;">
                    <img id="clicked-point-img" src="img/placeholder.png" alt="Clicked Point" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px; opacity: 0.8;">
                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 18px;">📍</div>
                </div>
                <div class="point-info" style="flex: 1; min-width: 0;">
                    <div class="point-name-editor" style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                        <span id="point-name-display" style="font-weight: 600; font-size: 15px; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${pointInfo.name}</span>
                    </div>
                    <div class="point-address" style="font-size: 12px; color: #666; line-height: 1.3;">
                        ${pointInfo.address || 'Selected location'}
                    </div>
                </div>
                <div class="point-actions" style="display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0;">
                    <div style="font-size: 11px; color: #999;">Clicked</div>
                    <button class="add-point-to-cart-btn" onclick="window.addClickedPointToCart(${lat}, ${lng}, ${day})" style="width: 36px; height: 36px; background: #1976d2; color: white; border: none; border-radius: 50%; font-size: 18px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">+</button>
                </div>
                <div id="ai-point-description" style="width: 100%; margin-top: 8px; border-top: 1px dashed #ddd; padding-top: 10px;"></div>
            </div>
        </div>
    `;

    const html = `
        <div>
            <div class="nearby-popup-title" style="font-weight: bold; margin-bottom: 12px; font-size: 16px;">
                📍 Nearby Places
            </div>
            ${addPointSection}
        </div>
    `;

    showCustomPopup(lat, lng, map, html, true);
    window._currentPointInfo = pointInfo;
    
    if (pointInfo?.name && pointInfo?.name !== "Selected Point") {
        window.fetchClickedPointAI(
            pointInfo.name, 
            lat, 
            lng, 
            locationContext, 
            {}, 
            'ai-point-description'
        );
    }
    
    // +++ SIDEBAR'I AÇTIKTAN SONRA +++
    // CSS
    if (!document.getElementById('hide-leaflet-default-icon')) {
        const style = document.createElement('style');
        style.id = 'hide-leaflet-default-icon';
        style.textContent = `
            .custom-category-marker {
                opacity: 1 !important;
            }
        `;
        document.head.appendChild(style);
    }
    
    clearAllCategoryMarkers(map);
    
    // Pulse marker temizle
    if (window._nearbyPulseMarker) {
        try { window._nearbyPulseMarker.remove(); } catch(e) {}
        window._nearbyPulseMarker = null;
    }
    if (window._nearbyPulseMarker3D) {
        try { window._nearbyPulseMarker3D.remove(); } catch(e) {}
        window._nearbyPulseMarker3D = null;
    }
    
    // Yeni pulse marker HTML
    const pulseHtml = `
      <div class="tt-pulse-marker">
        <div class="tt-pulse-dot">
          <div class="tt-pulse-dot-inner"></div>
        </div>
        <div class="tt-pulse-ring tt-pulse-ring-1"></div>
        <div class="tt-pulse-ring tt-pulse-ring-2"></div>
        <div class="tt-pulse-ring tt-pulse-ring-3"></div>
        <div class="tt-pulse-glow"></div>
        <div class="tt-pulse-inner-ring"></div>
      </div>
    `;
    
    // CSS'i ekle (eğer yoksa)
    if (!document.getElementById('tt-pulse-styles')) {
        const style = document.createElement('style');
        style.id = 'tt-pulse-styles';
        style.textContent = `
            .tt-pulse-marker {
                position: relative;
                width: 40px;
                height: 40px;
                pointer-events: none;
                z-index: 1000;
                filter: drop-shadow(0 0 8px rgba(25, 118, 210, 0.5));
            }
            
            .tt-pulse-dot {
                position: absolute;
                left: 50%;
                top: 50%;
                width: 20px;
                height: 20px;
                transform: translate(-50%, -50%);
                background: linear-gradient(135deg, #1976d2, #64b5f6);
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 
                    0 0 15px rgba(25, 118, 210, 0.8),
                    0 0 30px rgba(25, 118, 210, 0.4),
                    inset 0 2px 4px rgba(255, 255, 255, 0.5);
                z-index: 10;
                animation: tt-pulse-dot 2s ease-in-out infinite;
            }
            
            .tt-pulse-dot-inner {
                position: absolute;
                width: 6px;
                height: 6px;
                background: white;
                border-radius: 50%;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
            }
            
            .tt-pulse-ring {
                position: absolute;
                left: 50%;
                top: 50%;
                border: 2px solid rgba(25, 118, 210, 0.8);
                border-radius: 50%;
                transform: translate(-50%, -50%);
                opacity: 0;
            }
            
            .tt-pulse-ring-1 {
                width: 20px;
                height: 20px;
                animation: tt-pulse-wave 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            }
            
            .tt-pulse-ring-2 {
                width: 20px;
                height: 20px;
                animation: tt-pulse-wave 2s cubic-bezier(0.4, 0, 0.2, 1) infinite 0.3s;
            }
            
            .tt-pulse-ring-3 {
                width: 20px;
                height: 20px;
                animation: tt-pulse-wave 2s cubic-bezier(0.4, 0, 0.2, 1) infinite 0.6s;
            }
            
            .tt-pulse-glow {
                position: absolute;
                left: 50%;
                top: 50%;
                width: 40px;
                height: 40px;
                transform: translate(-50%, -50%);
                background: radial-gradient(circle, rgba(25, 118, 210, 0.3) 0%, transparent 70%);
                border-radius: 50%;
                z-index: 1;
                animation: tt-pulse-glow 2s ease-in-out infinite;
            }
            
            .tt-pulse-inner-ring {
                position: absolute;
                left: 50%;
                top: 50%;
                width: 30px;
                height: 30px;
                border: 1.5px solid rgba(255, 255, 255, 0.9);
                border-radius: 50%;
                transform: translate(-50%, -50%);
                animation: tt-pulse-inner 1.5s linear infinite;
                opacity: 0.7;
            }
            
            @keyframes tt-pulse-dot {
                0%, 100% { 
                    transform: translate(-50%, -50%) scale(1);
                    box-shadow: 
                        0 0 15px rgba(25, 118, 210, 0.8),
                        0 0 30px rgba(25, 118, 210, 0.4);
                }
                50% { 
                    transform: translate(-50%, -50%) scale(1.1);
                    box-shadow: 
                        0 0 25px rgba(25, 118, 210, 1),
                        0 0 50px rgba(25, 118, 210, 0.6);
                }
            }
            
            @keyframes tt-pulse-wave {
                0% {
                    width: 20px;
                    height: 20px;
                    opacity: 0.8;
                    border-width: 2px;
                }
                100% {
                    width: 80px;
                    height: 80px;
                    opacity: 0;
                    border-width: 1px;
                }
            }
            
            @keyframes tt-pulse-glow {
                0%, 100% { opacity: 0.5; }
                50% { opacity: 0.8; }
            }
            
            @keyframes tt-pulse-inner {
                0% { 
                    transform: translate(-50%, -50%) rotate(0deg) scale(1);
                    opacity: 0.7;
                }
                100% { 
                    transform: translate(-50%, -50%) rotate(360deg) scale(1.2);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Pulse marker'ı haritaya ekle
    if (isMapLibre) {
        const el = document.createElement('div');
        el.className = 'tt-pulse-marker';
        el.innerHTML = pulseHtml;
        
        window._nearbyPulseMarker3D = new maplibregl.Marker({ 
            element: el,
            anchor: 'center'
        })
        .setLngLat([lng, lat])
        .addTo(map);
    } else {
        const pulseIcon = L.divIcon({
            html: pulseHtml,
            className: 'tt-pulse-marker',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });
        window._nearbyPulseMarker = L.marker([lat, lng], { icon: pulseIcon, interactive: false }).addTo(map);
    }
    
    // Kategori konfigürasyonları
    const categoryConfig = {
        'restaurants': {
            apiCategories: 'catering.restaurant,catering.cafe,catering.bar,catering.fast_food,catering.pub',
            color: '#FF5252',
            iconUrl: '/img/restaurant_icon.svg',
            buttonText: 'Show Restaurants',
            placeholderIcon: '/img/restaurant_icon.svg',
            layerPrefix: 'restaurant'
        },
        'hotels': {
            apiCategories: 'accommodation',
            color: '#2196F3',
            iconUrl: '/img/accommodation_icon.svg',
            buttonText: 'Show Hotels',
            placeholderIcon: '/img/hotel_icon.svg',
            layerPrefix: 'hotel'
        },
        'markets': {
            apiCategories: 'commercial.supermarket,commercial.convenience,commercial.clothing,commercial.shopping_mall',
            color: '#4CAF50',
            iconUrl: '/img/market_icon.svg',
            buttonText: 'Show Markets',
            placeholderIcon: '/img/market_icon.svg',
            layerPrefix: 'market'
        },
        'entertainment': {
            apiCategories: 'entertainment,leisure',
            color: '#FF9800',
            iconUrl: '/img/touristic_icon.svg',
            buttonText: 'Show Entertainment',
            placeholderIcon: '/img/entertainment_icon.svg',
            layerPrefix: 'entertainment'
        }
    };
    
    const config = categoryConfig[categoryType] || categoryConfig.restaurants;
    
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
    
    if (window._categoryRadiusCircle) {
        try { window._categoryRadiusCircle.remove(); } catch(_) {}
        window._categoryRadiusCircle = null;
    }
    if (window._categoryRadiusCircle3D) {
        try {
            const circleId = window._categoryRadiusCircle3D;
            if (map.getLayer(circleId + '-layer')) map.removeLayer(circleId + '-layer');
            if (map.getLayer(circleId + '-stroke')) map.removeLayer(circleId + '-stroke');
            if (map.getSource(circleId)) map.removeSource(circleId);
        } catch(_) {}
        window._categoryRadiusCircle3D = null;
    }
    
    const url = `/api/geoapify/places?categories=${config.apiCategories}&lat=${lat}&lon=${lng}&radius=5000&limit=30`;
    
    try {
        const resp = await fetch(url);
        const data = await resp.json();
        
        if (!data.features || data.features.length === 0) {
            alert(`No ${categoryType} found nearby.`);
            return;
        }
        
        let maxDistance = 0;
        const placesWithDistance = [];
        
        data.features.forEach((f, idx) => {
            const pLng = f.properties.lon;
            const pLat = f.properties.lat;
            
            const distance = haversine(lat, lng, pLat, pLng);
            placesWithDistance.push({
                feature: f,
                distance: distance,
                index: idx
            });
            
            if (distance > maxDistance) {
                maxDistance = distance;
            }
        });
        
        placesWithDistance.sort((a, b) => a.distance - b.distance);
        
        const topPlaces = placesWithDistance.slice(0, 20);
        
        console.log(`${categoryType} - En uzak mesafe: ${maxDistance.toFixed(0)}m, Toplam: ${placesWithDistance.length}`);
        
        if (maxDistance > 0) {
            const circleColor = '#1976d2';
            const radiusMeters = Math.ceil(maxDistance);
            
            if (isMapLibre) {
                const circleId = `category-radius-${categoryType}-${Date.now()}`;
                const circleGeoJSON = createCircleGeoJSON(lat, lng, radiusMeters);
                
                map.addSource(circleId, {
                    type: 'geojson',
                    data: circleGeoJSON
                });
                
                map.addLayer({
                    id: circleId + '-layer',
                    type: 'fill',
                    source: circleId,
                    paint: {
                        'fill-color': circleColor,
                        'fill-opacity': 0.04,
                        'fill-outline-color': 'transparent'
                    }
                });
                
                window._categoryRadiusCircle3D = circleId;
                
            } else {
                window._categoryRadiusCircle = L.circle([lat, lng], {
                    radius: radiusMeters,
                    color: circleColor,
                    weight: 0,
                    opacity: 0,
                    fillColor: circleColor,
                    fillOpacity: 0.04,
                    dashArray: null,
                    className: `category-radius-circle`
                }).addTo(map);
                
                console.log(`🌀 ${categoryType} daire: ${topPlaces.length} item, en uzak: ${maxDistance.toFixed(0)}m, daire: ${radiusMeters.toFixed(0)}m`);
            }
        }
        
        topPlaces.forEach((placeData, idx) => {
            const f = placeData.feature;
            const distance = placeData.distance;
            const pLng = f.properties.lon;
            const pLat = f.properties.lat;
            const imgId = `${config.layerPrefix}-img-${idx}-${Date.now()}`;
            
            let popupContent = getFastPlacePopupHTML(f, imgId, day, config, distance);
            
            if (isMapLibre) {
                window[layer3DKey] = window[layer3DKey] || [];
                window[marker3DKey] = window[marker3DKey] || [];
                
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
                            'line-color': '#4CAF50',
                            'line-width': 4,
                            'line-opacity': 0.7,
                            'line-dasharray': [8, 6]
                        }
                    });
                    window[layer3DKey].push(layerId, sourceId);
                }
                
                const el = document.createElement('div');
                el.innerHTML = getCategoryMarkerHtml(config.color, config.iconUrl, categoryType, distance);
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
                map[layerKey] = map[layerKey] || [];
                
                const line = L.polyline([[lat, lng], [pLat, pLng]], { 
                    color: '#4CAF50',
                    weight: 4,
                    opacity: 0.7, 
                    dashArray: "8,6"
                }).addTo(map);
                map[layerKey].push(line);
                
                const marker = L.marker([pLat, pLng], {
                    icon: L.divIcon({ 
                        html: getCategoryMarkerHtml(config.color, config.iconUrl, categoryType, distance), 
                        className: "custom-category-marker", 
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
        
        if (window._categoryRadiusCircle) {
            try { window._categoryRadiusCircle.remove(); } catch(_) {}
            window._categoryRadiusCircle = null;
        }
    }
}

// Marker HTML'i de güncelleyelim (mesafe yazısını daire renginde yapalım)
function getCategoryMarkerHtml(color, iconUrl, categoryType, distance = null) {
    const distanceText = distance ? 
        `<div style="position:absolute; bottom:-10px; left:50%; transform:translateX(-50%); font-size:9px; color:#1976d2; font-weight:bold; white-space:nowrap; background:white; padding:1px 3px; border-radius:3px; border:1px solid #eee;">
            ${distance < 1000 ? Math.round(distance)+'m' : (distance/1000).toFixed(1)+'km'}
        </div>` : '';
    
    return `
      <div style="position:relative;">
        <div style="
            position:relative;
            width:32px;height:32px;
            background:white;
            border-radius:50%;
            display:flex;
            align-items:center;
            justify-content:center;
            box-shadow:0 2px 8px rgba(0,0,0,0.2);
            border:3px solid ${color}; /* KATEGORİ RENGİ (sadece border) */
        ">
            <img src="${iconUrl}"
                 style="width:18px;height:18px;" alt="${categoryType}">
        </div>
        ${distanceText}
      </div>
    `;
}

// Yardımcı fonksiyon: Popup HTML'i (mesafe bilgisi ile)
function getFastPlacePopupHTML(f, imgId, day, config, distance = null) {
    const name = f.properties.name || config.layerPrefix.charAt(0).toUpperCase() + config.layerPrefix.slice(1);
    const address = f.properties.formatted || "";
    const lat = f.properties.lat;
    const lon = f.properties.lon;
    
    const safeName = name.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
    const safeAddress = address.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
    
    const distanceText = distance ? 
        `<div style="font-size:11px; color:#666; margin-bottom:4px;">
            📏 ${distance < 1000 ? Math.round(distance)+' meters' : (distance/1000).toFixed(2)+' km'} away
        </div>` : '';
    
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
          ${distanceText}
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
            style="width: 32px; height: 32px; background: #9159ed; color: white; border: none; border-radius: 50%; font-size: 18px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
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