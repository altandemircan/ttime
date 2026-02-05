
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
  // Büyük harita (expand map) referansını al
  const expObj = window.expandedMaps && window.expandedMaps[`route-map-day${day}`];
  const bigMap = expObj && expObj.expandedMap;

  if (bigMap) {
    const marker = L.marker([lat, lon]).addTo(bigMap).bindPopup(`<b>${name}</b>`);

    // ✅ GÜNCELLEME: Markera tıklayınca haritayı o noktaya ortala
    marker.on('click', function() {
        // Mevcut zoom seviyesini koruyarak kaydır
        bigMap.flyTo([lat, lon], bigMap.getZoom(), {
            animate: true,
            duration: 0.5
        });
    });
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

        const pointInfo = window._currentPointInfo || { name: "Selected Point", address: "", opening_hours: "", categories: "" };
        const placeName = pointInfo.name;
        
        // Kategoriyi belirle
        let category = "Place";
        if (pointInfo.categories) {
            category = getSimplePlaceCategoryFromString(pointInfo.categories);
        }
        
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
    category,
    pointInfo.address || "",
    null, null,
    pointInfo.opening_hours || "",
    null,
    { lat: lat, lng: lng },
    "",
    null, null, null,
    getCategoryIcon(category)  // ← BURAYA EKLE
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
          const isMapLibre = !!map.addSource; // MapLibre kontrolü
          let lat, lng;
          
          if (isMapLibre) {
              // MapLibre'de e.lngLat kullanılır
              lat = e.lngLat.lat;
              lng = e.lngLat.lng;
          } else {
              // Leaflet'te e.latlng kullanılır
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
          
          // --- FIX: EN SON SEÇİLEN KATEGORİYİ KULLAN ---
          // Eğer kullanıcı daha önce bir kategori seçtiyse (örn: markets), yeni tıklamada da o açılır.
          // Hiç seçmediyse varsayılan 'restaurants' açılır.
          const targetCategory = window._lastSelectedCategory || 'restaurants';

          // Kategorileri göster
          showNearbyPlacesByCategory(lat, lng, map, day, targetCategory);
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


window.addNearbyPlaceToTripFromPopup = async function(index, day, lat, lon) {
    try {
        // 1. Retrieve the place data from the last items cache (kategori altı dahil!)
        const place = window._lastNearbyPlaces && window._lastNearbyPlaces[index];

        if (!place) {
            console.error("Place not found in cache. Index:", index);
            return;
        }

        const p = place.properties;
        const name = p.name || p.formatted || "Unknown Place";
        const address = p.formatted || "";
        
        // Kategoriyi Geoapify verilerinden doğru şekilde belirle
        const category = getSimplePlaceCategory(place);

        // 2. Try to get an image (or use placeholder)
        let imageUrl = "img/placeholder.png";
        // Eğer ._lastNearbyPhotos dizisi varsa ve sırası denkse onun görselini kullan
        if (window._lastNearbyPhotos && window._lastNearbyPhotos[index]) {
            imageUrl = window._lastNearbyPhotos[index];
        } else if (typeof getPexelsImage === "function") {
            try {
                const city = window.selectedCity || "";
                imageUrl = await getPexelsImage(`${name} ${category} ${city}`);
            } catch (e) {
                // Yedek olarak yukardaki imgUrl kalır
            }
        }

        // 3. EKLE: addToCart ile kategori altı itemi de plana ekle
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

            // ============================================================
            // [KRİTİK DÜZELTME] "cart" verisini LocalStorage'a ELLE yaz
            // ============================================================ 
            // 1. Sayfa yenilendiğinde verinin orada olması için:
            localStorage.setItem('cart', JSON.stringify(window.cart));
            
            // 2. My Trips veritabanına da hemen işle (Thumbnail oluşturmadan hızlı kayıt)
            if (typeof saveCurrentTripToStorage === "function") {
                saveCurrentTripToStorage({ withThumbnail: false, delayMs: 0 });
            }
            // ============================================================

            // Görsel feedback (Buton içeriği ✓ olsun)
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
    
    // 1. COFFEE / CAFE
    if (cats.includes('catering.cafe') || cats.includes('cafe')) {
        return 'Coffee';
    }
    
    // 2. RESTAURANT
    if (cats.includes('catering.restaurant') || cats.includes('restaurant')) {
        return 'Restaurant';
    }
    
    // 3. BAR
    if (cats.includes('catering.bar') || cats.includes('bar')) {
        return 'Bar';
    }
    
    // 4. PUB
    if (cats.includes('catering.pub') || cats.includes('pub')) {
        return 'Pub';
    }
    
    // 5. FAST FOOD
    if (cats.includes('catering.fast_food') || cats.includes('fast_food')) {
        return 'Fast Food';
    }
    
    // 6. HOTEL / ACCOMMODATION
    if (cats.includes('accommodation.hotel') || cats.includes('hotel')) {
        return 'Accommodation';
    }
    
    // 7. HOSTEL
    if (cats.includes('accommodation.hostel') || cats.includes('hostel')) {
        return 'Hostel';
    }
    
    // 8. MUSEUM
    if (cats.includes('entertainment.museum') || cats.includes('museum')) {
        return 'Museum';
    }
    
    // 9. CINEMA
    if (cats.includes('entertainment.cinema') || cats.includes('cinema')) {
        return 'Cinema';
    }
    
    // 10. SUPERMARKET
    if (cats.includes('commercial.supermarket') || cats.includes('supermarket')) {
        return 'Supermarket';
    }
    
    // 11. PHARMACY
    if (cats.includes('healthcare.pharmacy') || cats.includes('pharmacy')) {
        return 'Pharmacy';
    }
    
    // 12. HOSPITAL
    if (cats.includes('healthcare.hospital') || cats.includes('hospital')) {
        return 'Hospital';
    }
    
    // 13. BOOKSTORE
    if (cats.includes('commercial.books') || cats.includes('bookstore')) {
        return 'Bookstore';
    }
    
    // 14. POST OFFICE
    if (cats.includes('service.post') || cats.includes('post_office')) {
        return 'Post Office';
    }
    
    // 15. LIBRARY
    if (cats.includes('education.library') || cats.includes('library')) {
        return 'Library';
    }
    
    // 16. UNIVERSITY
    if (cats.includes('education.university') || cats.includes('university')) {
        return 'University';
    }
    
    // 17. JEWELRY
    if (cats.includes('commercial.jewelry') || cats.includes('jewelry')) {
        return 'Jewelry Shop';
    }
    
    // 18. RELIGION
    if (cats.includes('religion')) {
        return 'Religion';
    }
    
    // 19. TOURISTIC ATTRACTION
    if (cats.includes('tourism.sights') || cats.includes('tourism') || cats.includes('attraction')) {
        return 'Touristic attraction';
    }
    
    // 20. ENTERTAINMENT / LEISURE (genel)
    if (cats.includes('entertainment') || cats.includes('leisure')) {
        return 'Entertainment';
    }
    
    // 21. MARKETS (genel commercial)
    if (cats.includes('commercial') || cats.includes('market') || cats.includes('shopping')) {
        return 'Supermarket';
    }
    
    // 22. ACCOMMODATION (genel)
    if (cats.includes('accommodation')) {
        return 'Accommodation';
    }
    
    // DEFAULT: Place (location ikonu kullanılacak)
    // DEFAULT: Place (location ikonu kullanılacak)
    return 'Place';
}

// String kategorilerden kategori belirle (pointInfo.categories için)
function getSimplePlaceCategoryFromString(cats) {
    if (!cats || typeof cats !== 'string') return 'Place';
    
    const c = cats.toLowerCase();
    
    if (c.includes('cafe') || c.includes('coffee')) return 'Coffee';
    if (c.includes('restaurant')) return 'Restaurant';
    if (c.includes('bar') && !c.includes('barbershop')) return 'Bar';
    if (c.includes('pub')) return 'Pub';
    if (c.includes('fast_food')) return 'Fast Food';
    if (c.includes('hotel')) return 'Accommodation';
    if (c.includes('hostel')) return 'Hostel';
    if (c.includes('museum')) return 'Museum';
    if (c.includes('cinema')) return 'Cinema';
    if (c.includes('supermarket') || c.includes('convenience')) return 'Supermarket';
    if (c.includes('pharmacy')) return 'Pharmacy';
    if (c.includes('hospital')) return 'Hospital';
    if (c.includes('books')) return 'Bookstore';
    if (c.includes('post')) return 'Post Office';
    if (c.includes('library')) return 'Library';
    if (c.includes('university')) return 'University';
    if (c.includes('jewelry')) return 'Jewelry Shop';
    if (c.includes('religion') || c.includes('mosque') || c.includes('church')) return 'Religion';
    if (c.includes('tourism') || c.includes('attraction') || c.includes('sights')) return 'Touristic attraction';
    if (c.includes('entertainment') || c.includes('leisure')) return 'Entertainment';
    if (c.includes('commercial') || c.includes('shop')) return 'Supermarket';
    if (c.includes('accommodation')) return 'Accommodation';
    
    return 'Place';
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
        const categoryCounts = { restaurants: 0, hotels: 0, markets: 0, entertainment: 0 };

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

        // Tıklanan nokta bölümü (FIXED - ReferenceError Düzeltmesi)
    const addPointSection = `
        <div class="add-point-section" style="margin-bottom: 16px; border-bottom: 1px solid #e0e0e0; padding-bottom: 16px;">
            <div class="point-item" style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 12px; background: #f8f9fa; border-radius: 8px; margin-bottom: 8px;">
                <div class="point-image" style="width: 60px; height: 40px; position: relative; flex-shrink: 0;">
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
                    <button class="add-point-to-cart-btn" 
                        onclick="window.addPlaceToTripFromPopup('clicked-point-img', '${(pointInfo.name || '').replace(/'/g, "\\'")}', '${(pointInfo.address || '').replace(/'/g, "\\'")}', ${day}, ${lat}, ${lng}, '${pointInfo.categories || 'place'}')" 
                        style="width: 36px; height: 36px; background: #1976d2; color: white; border: none; border-radius: 50%; font-size: 18px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">+</button>
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
     document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabId = this.dataset.tab;
            window._lastSelectedCategory = tabId;

            // Mavi Pulse Marker'ı Temizle
            if (window._nearbyPulseMarker) {
                try { window._nearbyPulseMarker.remove(); } catch(e) {}
                window._nearbyPulseMarker = null;
            }
            if (window._nearbyPulseMarker3D) {
                try { window._nearbyPulseMarker3D.remove(); } catch(e) {}
                window._nearbyPulseMarker3D = null;
            }

            // Harita marker'larını göster
            showNearbyPlacesByCategory(lat, lng, map, day, tabId);
        });
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
            // console.timeEnd('AI-API-Response');

            // --- YALNIZCA EN GÜNCEL İSTEKTE SONUÇ YAZ ---
            if (myRequestId !== aiActiveRequest) {
                console.log('IGNORED: Eski AI request response (başka tıklama daha güncel).');
                return;
            }

            // console.log('API Response status:', response.status);
            const data = await response.json();
            // console.log('API Data received:', data);

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


// GÜNCELLENMIŞ: showNearbyPlacesByCategory
// Cache for category data
window._categoryCacheData = window._categoryCacheData || {};

// GÜNCELLENMİŞ showNearbyPlacesByCategory (Daire Temizliği Fix)
async function showNearbyPlacesByCategory(lat, lng, map, day, categoryType = 'restaurants', radiusOverride = null) {
    window._lastSelectedCategory = categoryType;

    const isMapLibre = !!map.addSource;
    const cacheKey = `${lat}-${lng}-${categoryType}`;
    
    // +++ YENİ NOKTA İÇİN AI BİLGİSİ AL +++
    let pointInfo = { name: "Selected Point", address: "" };
    try { 
        pointInfo = await getPlaceInfoFromLatLng(lat, lng); 
    } catch (e) {
        console.warn('getPlaceInfoFromLatLng failed:', e.message);
    }
    
    // Reverse geocode
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
    } catch (e) {}
    
    if (!currentCityName) currentCityName = window.selectedCity || "";
    
    const country = "Turkey";
    const locationContext = `${currentCityName}, ${country}`;
    
    // Kategori Yapılandırması
    const categoryConfig = {
        'restaurants': {
            apiCategories: 'catering.restaurant,catering.cafe,catering.bar,catering.fast_food,catering.pub',
            color: '#FF5252',
            iconUrl: 'img/restaurant_icon.svg',
            title: 'Restaurants', layerPrefix: 'restaurant'
        },
        'hotels': {
            apiCategories: 'accommodation',
            color: '#2196F3',
            iconUrl: 'img/accommodation_icon.svg',
            title: 'Hotels', layerPrefix: 'hotel'
        },
        'markets': {
            apiCategories: 'commercial.supermarket,commercial.convenience,commercial.clothing,commercial.shopping_mall',
            color: '#4CAF50',
            iconUrl: 'img/market_icon.svg',
            title: 'Markets', layerPrefix: 'market'
        },
        'entertainment': {
            apiCategories: 'entertainment,leisure',
            color: '#FF9800',
            iconUrl: 'img/entertainment_icon.svg',
            title: 'Entertainment', layerPrefix: 'entertainment'
        }
    };
    
    const config = categoryConfig[categoryType] || categoryConfig.restaurants;
    
    // Popup HTML oluşturma
    const addPointSection = `
        <div class="add-point-section" style="margin-bottom: 16px; border-bottom: 1px solid #e0e0e0; padding-bottom: 16px;">
            <div class="point-item" style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 12px; background: #f8f9fa; border-radius: 8px; margin-bottom: 8px;">
                <div class="point-image" style="width: 60px; height: 40px; position: relative; flex-shrink: 0;">
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
                    <button class="add-point-to-cart-btn" 
                        onclick="window.addPlaceToTripFromPopup('clicked-point-img', '${pointInfo.name.replace(/'/g, "\\'")}', '${(pointInfo.address||"").replace(/'/g, "\\'")}', ${day}, ${lat}, ${lng}, '${pointInfo.categories || 'place'}')" 
                        style="width: 36px; height: 36px; background: #1976d2; color: white; border: none; border-radius: 50%; font-size: 18px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">+</button>
                </div>
                <div id="ai-point-description" style="width: 100%; margin-top: 8px; border-top: 1px dashed #ddd; padding-top: 10px;"></div>
            </div>
        </div>
    `;

    // Tab oluşturma
    let tabsHtml = '<div class="category-tabs" style="display: flex; gap: 4px; margin-bottom: 16px; border-bottom: 1px solid #e0e0e0;">';
    
    Object.keys(categoryConfig).forEach(key => {
        const tab = categoryConfig[key];
        const isActive = key === categoryType;
        // Aktif değilse gri yap, aktifse orijinal rengi göster
        const iconFilter = isActive ? '' : 'filter: grayscale(100%) opacity(0.6);';
        
        tabsHtml += `
            <button class="category-tab ${isActive ? 'active' : ''}" data-tab="${key}"
                    style="flex: 1; padding: 10px 6px; background: ${isActive ? '#f0f7ff' : 'transparent'}; 
                           border: none; border-bottom: 2px solid ${isActive ? '#1976d2' : 'transparent'}; 
                           cursor: pointer; font-size: 12px; color: ${isActive ? '#1976d2' : '#666'}; 
                           display: flex; flex-direction: column; align-items: center; gap: 4px;">
                <img src="${tab.iconUrl}" alt="${tab.title}" style="width: 22px; height: 22px; ${iconFilter}">
                <div style="font-weight: ${isActive ? '600' : '500'}; white-space: nowrap;">${tab.title}</div>
            </button>
        `;
    });
    tabsHtml += '</div>';

    const categorySection = `
        <div class="category-section" style="margin-bottom: 16px;">
            ${tabsHtml}
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <div style="font-weight: 600; font-size: 16px; color: #333;" class="category-title">${config.title}</div>
                <div style="margin-left: auto; background: #4caf50; color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: bold;" class="category-count">Loading...</div>
            </div>
            <div class="category-items-container" style="display: flex; flex-direction: column; gap: 10px;">
                 <div style="padding: 20px; text-align: center; color: #666;">
                    <div class="nearby-loading-spinner" style="width: 24px; height: 24px; border: 3px solid #eee; border-top: 3px solid #1976d2; border-radius: 50%; margin: 0 auto 10px; animation: spin 1s linear infinite;"></div>
                    Finding ${config.title.toLowerCase()}...
                 </div>
            </div>
        </div>
    `;

    const html = `
        <div>
            <div class="nearby-popup-title" style="font-weight: bold; margin-bottom: 12px; font-size: 16px;">
                📍 Nearby Places
            </div>
            ${addPointSection}
            ${categorySection}
        </div>
    `;

    showCustomPopup(lat, lng, map, html, true);
    window._currentPointInfo = pointInfo;
    
    setTimeout(() => { loadClickedPointImage(pointInfo.name); }, 30);

    // Tab Click Listeners
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabId = this.dataset.tab;
            if (window._lastSelectedCategory === tabId) return;
            // UI Update
            document.querySelectorAll('.category-tab').forEach(t => {
                const isSelected = t.dataset.tab === tabId;
                t.style.background = isSelected ? '#f0f7ff' : 'transparent';
                t.style.borderBottomColor = isSelected ? '#1976d2' : 'transparent';
                t.style.color = isSelected ? '#1976d2' : '#666';
                t.style.fontWeight = isSelected ? '600' : '500';
                const img = t.querySelector('img');
                if (img) img.style.filter = isSelected ? '' : 'grayscale(100%) opacity(0.6)';
            });
            showNearbyPlacesByCategory(lat, lng, map, day, tabId);
        });
    });

    if (pointInfo?.name && pointInfo?.name !== "Selected Point") {
        window.fetchClickedPointAI(pointInfo.name, lat, lng, locationContext, {}, 'ai-point-description');
    }

    if (!document.getElementById('hide-leaflet-default-icon')) {
        const style = document.createElement('style');
        style.id = 'hide-leaflet-default-icon';
        style.textContent = `.custom-category-marker { opacity: 1 !important; }`;
        document.head.appendChild(style);
    }

    // --- GENEL TEMİZLİK ---
    clearAllCategoryMarkers(map);

    // Pulse Marker Temizlik
    if (window._nearbyPulseMarker) { try { window._nearbyPulseMarker.remove(); } catch(e) {} window._nearbyPulseMarker = null; }
    if (window._nearbyPulseMarker3D) { try { window._nearbyPulseMarker3D.remove(); } catch(e) {} window._nearbyPulseMarker3D = null; }

    // Pulse Marker Ekle
    const pulseHtml = `
      <div class="tt-pulse-marker">
        <div class="tt-pulse-dot"><div class="tt-pulse-dot-inner"></div></div>
        <div class="tt-pulse-ring tt-pulse-ring-1"></div>
        <div class="tt-pulse-ring tt-pulse-ring-2"></div>
        <div class="tt-pulse-ring tt-pulse-ring-3"></div>
        <div class="tt-pulse-glow"></div>
        <div class="tt-pulse-inner-ring"></div>
      </div>
    `;
    
    if (!document.getElementById('tt-pulse-styles')) {
        const style = document.createElement('style');
        style.id = 'tt-pulse-styles';
        style.textContent = `
            .tt-pulse-marker { position: relative; width: 40px; height: 40px; pointer-events: none; z-index: 1000; filter: drop-shadow(0 0 8px rgba(25, 118, 210, 0.5)); }
            .tt-pulse-dot { position: absolute; left: 50%; top: 50%; width: 20px; height: 20px; transform: translate(-50%, -50%); background: linear-gradient(135deg, #1976d2, #64b5f6); border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px rgba(25, 118, 210, 0.8); z-index: 10; animation: tt-pulse-dot 2s ease-in-out infinite; }
            .tt-pulse-dot-inner { position: absolute; width: 6px; height: 6px; background: white; border-radius: 50%; top: 50%; left: 50%; transform: translate(-50%, -50%); }
            .tt-pulse-ring { position: absolute; left: 50%; top: 50%; border: 2px solid rgba(25, 118, 210, 0.8); border-radius: 50%; transform: translate(-50%, -50%); opacity: 0; }
            .tt-pulse-ring-1 { width: 20px; height: 20px; animation: tt-pulse-wave 2s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
            .tt-pulse-ring-2 { width: 20px; height: 20px; animation: tt-pulse-wave 2s cubic-bezier(0.4, 0, 0.2, 1) infinite 0.3s; }
            .tt-pulse-ring-3 { width: 20px; height: 20px; animation: tt-pulse-wave 2s cubic-bezier(0.4, 0, 0.2, 1) infinite 0.6s; }
            .tt-pulse-glow { position: absolute; left: 50%; top: 50%; width: 40px; height: 40px; transform: translate(-50%, -50%); background: radial-gradient(circle, rgba(25, 118, 210, 0.3) 0%, transparent 70%); border-radius: 50%; z-index: 1; animation: tt-pulse-glow 2s ease-in-out infinite; }
            .tt-pulse-inner-ring { position: absolute; left: 50%; top: 50%; width: 30px; height: 30px; border: 1.5px solid rgba(255, 255, 255, 0.9); border-radius: 50%; transform: translate(-50%, -50%); animation: tt-pulse-inner 1.5s linear infinite; opacity: 0.7; }
            @keyframes tt-pulse-dot { 0%, 100% { transform: translate(-50%, -50%) scale(1); } 50% { transform: translate(-50%, -50%) scale(1.1); } }
            @keyframes tt-pulse-wave { 0% { width: 20px; height: 20px; opacity: 0.8; border-width: 2px; } 100% { width: 80px; height: 80px; opacity: 0; border-width: 1px; } }
            @keyframes tt-pulse-glow { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.8; } }
            @keyframes tt-pulse-inner { 0% { transform: translate(-50%, -50%) rotate(0deg) scale(1); } 100% { transform: translate(-50%, -50%) rotate(360deg) scale(1.2); opacity: 0; } }
        `;
        document.head.appendChild(style);
    }

    if (isMapLibre) {
        const el = document.createElement('div'); el.className = 'tt-pulse-marker'; el.innerHTML = pulseHtml;
        window._nearbyPulseMarker3D = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(map);
    } else {
        const pulseIcon = L.divIcon({ html: pulseHtml, className: 'tt-pulse-marker', iconSize: [40, 40], iconAnchor: [20, 20] });
        window._nearbyPulseMarker = L.marker([lat, lng], { icon: pulseIcon, interactive: false }).addTo(map);
    }

    // --- ESKİ KATMANLARI VE DAİRELERİ TEMİZLE (KRİTİK GÜNCELLEME) ---
    // 1. Önce eski ID ile 3D daireyi temizle
    if (window._categoryRadiusCircle3D) {
        const oldId = window._categoryRadiusCircle3D;
        const targetMap = (map && map.getLayer) ? map : window._maplibre3DInstance;
        if (targetMap && targetMap.getLayer) {
            try {
                if (targetMap.getLayer(oldId + '-layer')) targetMap.removeLayer(oldId + '-layer');
                if (targetMap.getLayer(oldId + '-stroke')) targetMap.removeLayer(oldId + '-stroke');
                if (targetMap.getSource(oldId)) targetMap.removeSource(oldId);
            } catch(e) {}
        }
        window._categoryRadiusCircle3D = null;
    }
    // 2. 2D daireyi temizle
    if (window._categoryRadiusCircle) {
        try { window._categoryRadiusCircle.remove(); } catch(e) {}
        window._categoryRadiusCircle = null;
    }

    const layerKey = `__${config.layerPrefix}Layers`;
    const marker3DKey = `_${config.layerPrefix}3DMarkers`;
    const layer3DKey = `_${config.layerPrefix}3DLayers`;

    if (map[layerKey]) { map[layerKey].forEach(l => l.remove()); map[layerKey] = []; }
    if (window[layer3DKey]) { 
        window[layer3DKey].forEach(id => { 
            const map3d = window._maplibre3DInstance;
            if (map3d && typeof map3d.getLayer === 'function') {
                if (map3d.getLayer(id)) map3d.removeLayer(id); 
                if (map3d.getSource(id)) map3d.removeSource(id);
            }
        }); 
        window[layer3DKey] = []; 
    }
    if (window[marker3DKey]) { window[marker3DKey].forEach(m => m.remove()); window[marker3DKey] = []; }

    // API ÇAĞRISI
    const searchRadius = radiusOverride || 5000;
    const url = `/api/geoapify/places?categories=${config.apiCategories}&lat=${lat}&lon=${lng}&radius=${searchRadius}&limit=30`;

    try {
        const resp = await fetch(url);
        const data = await resp.json();
        window._categoryCacheData[cacheKey] = data;

        if (!data.features || data.features.length === 0) {
            const container = document.querySelector('.category-items-container');
            const countBadge = document.querySelector('.category-count');
            if (countBadge) countBadge.textContent = "0";
            if (container) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #999; font-size: 13px;">
                        No ${config.title.toLowerCase()} found nearby
                         <div style="margin-top: 16px;">
                            <button class="search-wider-btn" 
                                    onclick="window.showNearbyPlacesByCategory(${lat}, ${lng}, window._currentMap, ${day}, '${categoryType}', 10000)"
                                    style="padding:8px 14px; border-radius:6px; background:#1976d2; color:#fff; font-size:12px; font-weight:bold; cursor:pointer; border:none;">
                                Search wider area (10km)
                            </button>
                        </div>
                    </div>`;
            }
            return;
        }

        let maxDistance = 0;
        const placesWithDistance = [];
        data.features.forEach((f, idx) => {
            const pLng = f.properties.lon;
            const pLat = f.properties.lat;
            const distance = haversine(lat, lng, pLat, pLng);
            placesWithDistance.push({ feature: f, distance: distance, index: idx });
            if (distance > maxDistance) maxDistance = distance;
        });
        placesWithDistance.sort((a, b) => a.distance - b.distance);
        const topPlaces = placesWithDistance.slice(0, 20);
        window._lastNearbyPlaces = topPlaces.map(p => p.feature);
        
        const countBadge = document.querySelector('.category-count');
        if (countBadge) countBadge.textContent = topPlaces.length;

        // SIDEBAR LİSTESİ
        const itemsContainer = document.querySelector('.category-items-container');
        if (itemsContainer) {
            itemsContainer.innerHTML = '';
            
            // --- DAİRE ÇİZİMİ (ARTIK BURADA - LİSTE DOLARKEN) ---
            // Bu sayede "Liste var mı?" kontrolünden hemen sonra çizilir
            if (maxDistance > 0) {
                const circleColor = '#1976d2';
                const radiusMeters = Math.ceil(maxDistance);

                if (isMapLibre) {
                    const circleId = `category-radius-${categoryType}-${Date.now()}`;
                    const circleGeoJSON = createCircleGeoJSON(lat, lng, radiusMeters);

                    map.addSource(circleId, { type: 'geojson', data: circleGeoJSON });

                    // 1. FILL LAYER
                    map.addLayer({
                        id: circleId + '-layer',
                        type: 'fill',
                        source: circleId,
                        paint: {
                            'fill-color': circleColor,
                            'fill-opacity': 0.2, 
                            'fill-outline-color': circleColor
                        }
                    });

                    // 2. LINE LAYER
                    map.addLayer({
                        id: circleId + '-stroke',
                        type: 'line',
                        source: circleId,
                        paint: {
                            'line-color': circleColor,
                            'line-width': 2,
                            'line-opacity': 0.8,
                            'line-dasharray': [2, 4]
                        }
                    });

                    window._categoryRadiusCircle3D = circleId;

                } else {
                    window._categoryRadiusCircle = L.circle([lat, lng], {
                        radius: radiusMeters,
                        color: circleColor,
                        weight: 1,
                        opacity: 0.6,
                        fillColor: circleColor,
                        fillOpacity: 0.1,
                        dashArray: "5, 10",
                        className: `category-radius-circle`
                    }).addTo(map);
                }
            }

            // Liste Elemanlarını Ekle
            topPlaces.forEach((placeData, idx) => {
                const f = placeData.feature;
                const distance = placeData.distance;
                const pLng = f.properties.lon;
                const pLat = f.properties.lat;
                const name = f.properties.name || "Unknown";
                const address = f.properties.formatted || "";
                const imgId = `${config.layerPrefix}-sidebar-img-${idx}-${Date.now()}`;
                const distanceText = distance < 1000 ? `${Math.round(distance)} m` : `${(distance / 1000).toFixed(2)} km`;
                const safeName = name.replace(/'/g, "\\'").replace(/"/g, '\\"');
                const locationContext = [f.properties.suburb, f.properties.city, f.properties.country].filter(Boolean).join(', ');

                const itemHtml = `
                    <div class="category-place-item" style="display: flex; align-items: center; gap: 12px; padding: 10px; background: #f8f9fa; border-radius: 8px; margin-bottom: 10px; border: 1px solid #eee;">
                        <div style="position: relative; width: 60px; height: 40px; flex-shrink: 0;">
                            <img id="${imgId}" src="img/placeholder.png" alt="${name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">
                            <div onclick="event.stopPropagation(); window.fetchClickedPointAI('${safeName}', ${pLat}, ${pLng}, '${locationContext}', {}, 'ai-point-description')" 
                                 style="position: absolute; bottom: -4px; right: -4px; width: 20px; height: 20px; background: #8a4af3; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.3); z-index: 10;">
                                <span style="font-size: 10px; color: white;">✨</span>
                            </div>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 600; font-size: 0.9rem; color: #333; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis;">${name}</div>
                            <div style="font-size: 0.9rem; color: #777; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${address}</div>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0;">
                            <div style="font-size: 10px; color: #999; white-space: nowrap;">${distanceText}</div>
                            <button onclick="window.addNearbyPlaceToTripFromPopup(${idx}, ${day}, ${pLat}, ${pLng})"
                                    style="width: 30px; height: 30px; background: #fff; border: 1px solid #ddd; border-radius: 50%; cursor: pointer; color: #1976d2; font-weight: bold; font-size: 16px; display: flex; align-items: center; justify-content: center;">+</button>
                        </div>
                    </div>`;
                
                const itemDiv = document.createElement('div');
                itemDiv.innerHTML = itemHtml;
                itemsContainer.appendChild(itemDiv.firstElementChild);
                getImageForPlace(name, config.layerPrefix, window.selectedCity || "").then(src => { const img = document.getElementById(imgId); if (img && src) img.src = src; }).catch(() => {});
            });
        }

        // MAP MARKERS LOOP
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
                    map.addSource(sourceId, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [[lng, lat], [pLng, pLat]] } } });
                    map.addLayer({ id: layerId, type: 'line', source: sourceId, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#4CAF50', 'line-width': 4, 'line-opacity': 0.7, 'line-dasharray': [8, 6] } });
                    window[layer3DKey].push(layerId, sourceId);
                }

                const el = document.createElement('div');
                el.innerHTML = getCategoryMarkerHtml(config.color, config.iconUrl, categoryType, distance);
                el.className = 'custom-3d-marker-element';
                el.style.cursor = 'pointer';
                el.style.zIndex = '2000';

                const popup = new maplibregl.Popup({ offset: 25, maxWidth: '360px', closeButton: true, className: 'tt-unified-popup' }).setHTML(popupContent);
                popup.on('open', () => { handlePlacePopupImageLoading(f, imgId, categoryType); });

                const marker = new maplibregl.Marker({ element: el }).setLngLat([pLng, pLat]).setPopup(popup).addTo(map);
                el.addEventListener('click', (e) => { 
                    e.stopPropagation(); 
                    const currentPopup = marker.getPopup();
                    if (window._active3DPopup && window._active3DPopup !== currentPopup) {
                        window._active3DPopup.remove();
                    }
                    map.flyTo({ center: [pLng, pLat], zoom: Math.max(map.getZoom(), 16), speed: 0.8, curve: 1, essential: true, offset: [0, 100] });
                    if (!marker.getPopup().isOpen()) {
                        marker.togglePopup();
                        window._active3DPopup = marker.getPopup();
                    } else {
                        marker.togglePopup();
                        window._active3DPopup = null;
                    }
                });
                window[marker3DKey].push(marker);
            } else {
                map[layerKey] = map[layerKey] || [];
                const line = L.polyline([[lat, lng], [pLat, pLng]], { color: '#4CAF50', weight: 4, opacity: 0.7, dashArray: "8,6" }).addTo(map);
                map[layerKey].push(line);
                const marker = L.marker([pLat, pLng], { icon: L.divIcon({ html: getCategoryMarkerHtml(config.color, config.iconUrl, categoryType, distance), className: "custom-category-marker", iconSize: [32,32], iconAnchor: [16,16] }) }).addTo(map);
                map[layerKey].push(marker);
                marker.on('click', function() { const targetZoom = map.getZoom() < 14 ? 15 : map.getZoom(); map.flyTo([pLat, pLng], targetZoom, { animate: true, duration: 0.5 }); });
                marker.bindPopup(popupContent, { maxWidth: 341 });
                marker.on("popupopen", function() { handlePlacePopupImageLoading(f, imgId, categoryType); });
            }
        });

    } catch (err) {
        console.error(err);
        const container = document.querySelector('.category-items-container');
        if (container) container.innerHTML = `<div style="text-align: center; padding: 20px; color: #999; font-size: 13px;">Error loading places</div>`;
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


function getFastPlacePopupHTML(f, imgId, day, config, distance = null) {
    // 1. Değişkenleri Tanımla
    const name = f.properties.name || config.layerPrefix.charAt(0).toUpperCase() + config.layerPrefix.slice(1);
    const address = f.properties.formatted || "";
    const lat = f.properties.lat;
    const lon = f.properties.lon;
    
    // 2. Güvenli Stringler
    const safeName = name.replace(/'/g, "\\'").replace(/"/g, '\\"');
    const safeAddress = address.replace(/'/g, "\\'").replace(/"/g, '\\"');
    const htmlSafeName = name.replace(/"/g, '&quot;');
    
    const activeDay = window.currentDay || day || 1;

    const distanceText = distance ? 
        `${distance < 1000 ? Math.round(distance)+' m' : (distance/1000).toFixed(2)+' km'}` : '';

    // 3. CSS Stili (Popup resetleme)
    if (!document.getElementById('popup-override-styles')) {
        const style = document.createElement('style');
        style.id = 'popup-override-styles';
        style.textContent = `
            .leaflet-popup:has(.category-place-item) .leaflet-popup-content-wrapper,
            .maplibregl-popup:has(.category-place-item) .maplibregl-popup-content {
                background: transparent !important;
                box-shadow: none !important;
                padding: 0 !important;
            }
            .leaflet-popup:has(.category-place-item) .leaflet-popup-content,
            .maplibregl-popup:has(.category-place-item) .maplibregl-popup-content {
                margin: 0 !important;
                width: auto !important;
            }
            .leaflet-popup:has(.category-place-item) .leaflet-popup-tip-container,
            .leaflet-popup:has(.category-place-item) .leaflet-popup-close-button,
            .maplibregl-popup:has(.category-place-item) .maplibregl-popup-tip,
            .maplibregl-popup:has(.category-place-item) .maplibregl-popup-close-button {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }
      
    // 4. HTML Return (FIX: Kapatma butonu hem Leaflet hem MapLibre destekli)
    return `
      <div class="category-place-item" style="position: relative; display: flex; align-items: center; gap: 12px; padding: 10px; 
                                            background: #f8f9fa; border-radius: 8px; margin-bottom: 0px; 
                                            border: 1px solid #eee; box-shadow: 0 3px 14px rgba(0,0,0,0.25);
                                            max-width: 300px; width: 300px;">
        <button onclick="var p = this.closest('.leaflet-popup') || this.closest('.maplibregl-popup'); if(p) p.remove();" 
                style="position: absolute; top: 6px; right: 6px; width: 20px; height: 20px; background: transparent; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #999; z-index: 10; padding: 0; line-height: 1; transition: all 0.2s;">×</button>
        
        <div style="position: relative; width: 60px; height: 40px; flex-shrink: 0;">
          <img id="${imgId}" src="img/placeholder.png" alt="${htmlSafeName}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">
          <div class="img-loading-spinner" id="${imgId}-spin" style="display: none;"></div>
        </div>
        
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 600; font-size: 0.9rem; color: #333; 
                        margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis;">
            ${name}
          </div>
          <div style="font-size: 0.9rem; color: #777; overflow: hidden; 
                        text-overflow: ellipsis; white-space: nowrap;">
            ${address}
          </div>
        </div>
        
        <div style="display: flex; flex-direction: column; align-items: center; 
                    gap: 4px; flex-shrink: 0;">
          <div style="font-size: 10px; color: #999; white-space: nowrap;">
            ${distanceText}
          </div>
          
          <button class="add-point-to-cart-btn" 
              onclick="window.addPlaceToTripFromPopup('${imgId}', '${safeName}', '${safeAddress}', ${activeDay}, ${lat}, ${lon}, '${config.layerPrefix}')" 
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
    
    // Kategori tipini normalize et (küçük harften büyük harfe çevir)
    const categoryMap = {
        'restaurant': 'Restaurant',
        'hotel': 'Accommodation',
        'market': 'Supermarket',
        'entertainment': 'Entertainment',
        'place': 'Place',
        'coffee': 'Coffee',
        'cafe': 'Coffee',
        'bar': 'Bar',
        'pub': 'Pub',
        'fast_food': 'Fast Food',
        'hostel': 'Hostel',
        'museum': 'Museum',
        'cinema': 'Cinema',
        'supermarket': 'Supermarket',
        'pharmacy': 'Pharmacy',
        'hospital': 'Hospital',
        'bookstore': 'Bookstore',
        'post_office': 'Post Office',
        'library': 'Library',
        'university': 'University',
        'jewelry': 'Jewelry Shop',
        'religion': 'Religion',
        'touristic attraction': 'Touristic attraction'
    };
    
    const normalizedCategory = categoryMap[categoryType.toLowerCase()] || categoryType;
    
    const img = document.getElementById(imgId);
    const imgSrc = (img && img.src && img.src !== "" && !img.classList.contains("hidden-img"))
        ? img.src
        : 'img/placeholder.png';
    
    // 1. Sepete ekle
    addToCart(
        name,
        imgSrc,
        day,
        normalizedCategory,
        address,
        null, null, null, null,
        { lat: Number(lat), lng: Number(lon) },
        ""
    );
    
    // ============================================================
    // [EKLENEN DÜZELTME] Kayıt İşlemi (Sayfa yenilenince silinmemesi için)
    // ============================================================
    // 'cart' verisini güncelle (mainscript.js açılışta buradan okur)
    localStorage.setItem('cart', JSON.stringify(window.cart));

    // Veritabanına (My Trips) işle
    if (typeof saveCurrentTripToStorage === "function") {
        saveCurrentTripToStorage({ withThumbnail: false, delayMs: 0 });
    }
    // ============================================================

    // Temizlik ve 3D Layer/Marker Kaldırma İşlemleri
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



// ============================================
// NEARBY POPUP MANAGEMENT & VIEW SWITCHER
// ============================================

// Varsa eski zamanlayıcıları temizle
if (window._nearbyCleanerInterval) clearInterval(window._nearbyCleanerInterval);
if (window._nearbyWatchdog) clearInterval(window._nearbyWatchdog);
if (window._nearbyButtonTimer) clearTimeout(window._nearbyButtonTimer);

// 1. TEMİZLİK VE KAPATMA FONKSİYONU
// 1. TEMİZLİK VE KAPATMA FONKSİYONU (FIXED)
window.closeNearbyPopup = function() {
    // 0. TOGGLE BUTONUNU KALDIR
    const toggleBtn = document.getElementById('nearby-view-switcher-btn');
    if (toggleBtn) {
        toggleBtn.remove();
    }

    // 1. SADECE POPUP DOM ELEMENTINI KALDIR
    const popupElement = document.getElementById('custom-nearby-popup');
    if (popupElement) {
        popupElement.remove();
    }

    // 2. HARITA GÖRÜNÜMÜNÜ GERI AL
    const mapContainer = document.querySelector('.leaflet-container, .maplibregl-map');
    if (mapContainer) {
        mapContainer.style.display = '';
    }

    // 3. PULSE MARKER'I SİL
    if (window._nearbyPulseMarker) {
        try { window._nearbyPulseMarker.remove(); } catch(e) {}
        window._nearbyPulseMarker = null;
    }
    if (window._nearbyPulseMarker3D) {
        try { window._nearbyPulseMarker3D.remove(); } catch(e) {}
        window._nearbyPulseMarker3D = null;
    }
    
    // 4. RADIUS DAİRELERİNİ SİL (Mavi Arama Dairesi)
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
    
    // 5. KATEGORİ DAİRELERİNİ SİL (Yeşil/Kırmızı Kategori Alanı)
    if (window._categoryRadiusCircle) {
        try { window._categoryRadiusCircle.remove(); } catch(e) {}
        window._categoryRadiusCircle = null;
    }
    // --- BURASI DÜZELTİLDİ ---
    if (window._categoryRadiusCircle3D && window._maplibre3DInstance) {
        try {
            const circleId = window._categoryRadiusCircle3D;
            const map3d = window._maplibre3DInstance;
            
            // Önce katmanları (layer) sil
            if (map3d.getLayer(circleId + '-layer')) map3d.removeLayer(circleId + '-layer');
            if (map3d.getLayer(circleId + '-stroke')) map3d.removeLayer(circleId + '-stroke'); // <--- EKLENEN KRİTİK SATIR
            
            // Sonra kaynağı (source) sil
            if (map3d.getSource(circleId)) map3d.removeSource(circleId);
        } catch(e) {
            console.warn("Cleanup error:", e);
        }
        window._categoryRadiusCircle3D = null;
    }
    
    window._currentNearbyPopupElement = null;
};

// ============================================
// NEARBY POPUP VIEW SWITCHER BUTTON (MOBILE ONLY)
// ============================================
function setupViewSwitcherButton(mapInstance) {
    // ✅ Sadece mobile'da göster (768px altında)
    if (window.innerWidth > 768) {
        return; // Desktop'ta buton gösterme
    }

    let oldBtn = document.getElementById('nearby-view-switcher-btn');
    if (oldBtn) oldBtn.remove();

    const btn = document.createElement('button');
    btn.id = 'nearby-view-switcher-btn';
    
    btn.style.cssText = `
        position: fixed !important;
        bottom: 30px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        z-index: 9999999 !important;
        padding: 12px 24px;
        background: #ff9900;
        color: #fff;
        border: none;
        border-radius: 50px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        font-weight: 600;
        font-size: 14px;
        display: flex !important;
        align-items: center;
        gap: 8px;
        cursor: pointer;
    `;
    document.body.appendChild(btn);

    const contentToMap = `<span>🗺️</span> <span>Show Map</span>`;
    const contentToList = `<span>📋</span> <span>Show List</span>`;

    btn.onclick = function(e) {
        e.stopPropagation();
        const popup = document.getElementById('custom-nearby-popup');
        const mapContainer = document.querySelector('.leaflet-container, .maplibregl-map');

        if (!popup) {
            this.remove();
            return;
        }

        const isListVisible = (popup.style.display !== 'none');

        if (isListVisible) {
            popup.style.display = 'none';
            if (mapContainer) mapContainer.style.display = 'block';
            btn.innerHTML = contentToList;
            btn.style.background = '#1976d2';
            if (mapInstance && mapInstance.invalidateSize) setTimeout(() => mapInstance.invalidateSize(), 50);
            if (mapInstance && mapInstance.resize) setTimeout(() => mapInstance.resize(), 50);
        } else {
            popup.style.display = 'block';
            btn.innerHTML = contentToMap;
            btn.style.background = '#333';
        }
    };

    btn.innerHTML = contentToMap;

    const ghostChecker = setInterval(() => {
        if (!document.getElementById('custom-nearby-popup')) {
            btn.remove();
            clearInterval(ghostChecker);
        }
    }, 500);
}

// ✅ SADECE BİR KERE tanımla - duplicate kaldırıldı
const origShowCustomPopup = window.showCustomPopup;
window.showCustomPopup = function(lat, lng, map, content, showCloseButton = true) {
    // Orijinal fonksiyonu çalıştır
    origShowCustomPopup.call(this, lat, lng, map, content, showCloseButton);
    
    // View switcher butonunu ekle (sadece mobile'da)
    setTimeout(() => {
        const popup = document.getElementById('custom-nearby-popup');
        if (popup && window.innerWidth < 768) {
            setupViewSwitcherButton(map);
        }
    }, 100);
};

// 4. SAYFA DEĞİŞİKLİĞİ
window.addEventListener('hashchange', () => {
    window.closeNearbyPopup();
});

// 5. HARITA KAPANIŞI + Event Delegation
document.addEventListener('click', function(e) {
    // Haritayı kapatan close-expanded-map butonuna tıklandığında
    if (e.target && (e.target.classList.contains('close-expanded-map') || e.target.closest('.close-expanded-map'))) {
        const switcherBtn = document.getElementById('nearby-view-switcher-btn');
        if (switcherBtn) {
            switcherBtn.style.display = 'none';
            switcherBtn.remove();
        }
        
        const nearbyPopup = document.getElementById('custom-nearby-popup');
        if (nearbyPopup) {
            nearbyPopup.remove();
        }
    }
});

// ============================================
// CSS: Mobile Only Button
// ============================================
if (!document.getElementById('nearby-mobile-only-style')) {
    const style = document.createElement('style');
    style.id = 'nearby-mobile-only-style';
    style.textContent = `
        #nearby-view-switcher-btn {
            display: none !important;
        }
        
        @media (max-width: 768px) {
            #nearby-view-switcher-btn {
                display: flex !important;
            }
        }
    `;
    document.head.appendChild(style);
}

// === 3D HARİTA İÇİN TIKLAMA DİNLEYİCİSİ (FIX) ===

// 3D Harita değişkenini izle ve tanımlandığı an click eventini bağla
Object.defineProperty(window, '_maplibre3DInstance', {
    configurable: true,
    enumerable: true,
    get: function() {
        return this._maplibre3DInstanceValue;
    },
    set: function(val) {
        this._maplibre3DInstanceValue = val;
        if (val) {
            console.log("3D Map Detected via Setter - Attaching Nearby Click Listener");
            // Biraz gecikmeli ekle ki harita tam yüklensin
            setTimeout(() => {
                if (typeof attachClickNearbySearch === 'function') {
                    attachClickNearbySearch(val, window.currentDay || 1);
                }
            }, 1000);
        }
    }
});

// Ayrıca mevcut bir 3D harita varsa hemen bağla (sayfa yenileme vs durumları için)
setTimeout(() => {
    if (window._maplibre3DInstance && typeof attachClickNearbySearch === 'function') {
        console.log("Existing 3D Map Detected - Attaching Nearby Click Listener");
        attachClickNearbySearch(window._maplibre3DInstance, window.currentDay || 1);
    }
}, 2000);