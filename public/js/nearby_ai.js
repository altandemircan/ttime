let aiAbortController = null;
let aiDebounceTimeout = null;
// BUNU DOSYA BAŞINDA tanımla (global olmalı)
let aiActiveRequest = 0;

// Görsel doğrulama fonksiyonu
function getBestCityForAI(pointInfo) {
    if (!pointInfo) return window.selectedCity || '';
    return pointInfo.city || pointInfo.county || pointInfo.locality || window.selectedCity || '';
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
    if (loadingDiv) loadingDiv.style.opacity = '1';
    
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
            } catch (e) { console.warn('Backup source failed:', e); }
        }
    } catch (error) { console.warn('Error handling fallback:', error); }
    imgElement.src = PLACEHOLDER_IMG;
    if (loadingDiv) loadingDiv.style.opacity = '0';
};

function showMarkerOnExpandedMap(lat, lon, name, day) {
  const expObj = window.expandedMaps && window.expandedMaps[`route-map-day${day}`];
  const bigMap = expObj && expObj.expandedMap;
  if (bigMap) {
    L.marker([lat, lon]).addTo(bigMap).bindPopup(`<b>${name}</b>`);
  }
}

// Seçilen nokta için fotoğraf yükleme
async function loadClickedPointImage(pointName) {
    const img = document.getElementById('clicked-point-img');
    if (!img) return;
    try {
        let imageUrl = null;
        if (typeof getPexelsImage === "function") {
            try {
                imageUrl = await getPexelsImage(pointName + " " + (window.selectedCity || ""));
                if (imageUrl && imageUrl !== PLACEHOLDER_IMG && await isImageValid(imageUrl)) {
                    img.src = imageUrl; img.style.opacity = "1"; return;
                }
            } catch (e) {}
        }
        if (typeof getPixabayImage === "function") {
            try {
                imageUrl = await getPixabayImage(pointName);
                if (imageUrl && imageUrl !== PLACEHOLDER_IMG && await isImageValid(imageUrl)) {
                    img.src = imageUrl; img.style.opacity = "1"; return;
                }
            } catch (e) {}
        }
        img.style.opacity = "0.6";
    } catch (error) { img.style.opacity = "0.6"; }
}

// Noktayı sepete ekleme
window.addClickedPointToCart = async function(lat, lng, day) {
    try {
        window.currentDay = parseInt(day);
        const pointInfo = window._currentPointInfo || { name: "Selected Point", address: "", opening_hours: "" };
        const placeName = pointInfo.name;
        let imageUrl = "img/placeholder.png";
        if (typeof getPexelsImage === "function") {
            try { imageUrl = await getPexelsImage(placeName + " " + (window.selectedCity || "")); } catch (e) {}
        }
        addToCart(placeName, imageUrl, day, "Place", pointInfo.address || "", null, null, pointInfo.opening_hours || "", null, { lat: lat, lng: lng }, "");
        closeNearbyPopup();
    } catch (error) { console.error('Error adding point:', error); }
};

// GeoJSON Circle Helper
function createCircleGeoJSON(lat, lng, radiusMeters, points = 64) {
    const coords = [];
    const earthRadius = 6378137;
    for (let i = 0; i < points; i++) {
        const angle = (i * 360) / points;
        const angleRad = (angle * Math.PI) / 180;
        const latRad = (lat * Math.PI) / 180;
        const lngRad = (lng * Math.PI) / 180;
        const d = radiusMeters / earthRadius;
        const circleLat = Math.asin(Math.sin(latRad) * Math.cos(d) + Math.cos(latRad) * Math.sin(d) * Math.cos(angleRad));
        const circleLng = lngRad + Math.atan2(Math.sin(angleRad) * Math.sin(d) * Math.cos(latRad), Math.cos(d) - Math.sin(latRad) * Math.sin(circleLat));
        coords.push([(circleLng * 180) / Math.PI, (circleLat * 180) / Math.PI]);
    }
    coords.push(coords[0]);
    return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} };
}

// Kategori markerlarını temizle
function clearAllCategoryMarkers(map) {
    const categories = ['restaurant', 'hotel', 'market', 'entertainment'];
    categories.forEach(category => {
        const layerKey = `__${category}Layers`;
        if (map && map[layerKey] && Array.isArray(map[layerKey])) {
            map[layerKey].forEach(l => { try { map.removeLayer(l); } catch(e) {} });
            map[layerKey] = [];
        }
    });
    const isMapLibre = map && !!map.addSource;
    if (isMapLibre) {
        categories.forEach(category => {
            const marker3DKey = `_${category}3DMarkers`;
            const layer3DKey = `_${category}3DLayers`;
            if (window[marker3DKey]) { window[marker3DKey].forEach(m => { try { m.remove(); } catch(e){} }); window[marker3DKey] = []; }
            if (window[layer3DKey]) {
                window[layer3DKey].forEach(id => {
                    try { if (map.getLayer(id)) map.removeLayer(id); if (map.getSource(id)) map.removeSource(id); } catch(e) {}
                });
                window[layer3DKey] = [];
            }
        });
    }
    if (window._categoryRadiusCircle) { try { window._categoryRadiusCircle.remove(); } catch(e) {} window._categoryRadiusCircle = null; }
    if (window._categoryRadiusCircle3D && map && map.getSource) {
        try {
            const circleId = window._categoryRadiusCircle3D;
            if (map.getLayer(circleId + '-layer')) map.removeLayer(circleId + '-layer');
            if (map.getLayer(circleId + '-stroke')) map.removeLayer(circleId + '-stroke');
            if (map.getSource(circleId)) map.removeSource(circleId);
        } catch(e) {}
        window._categoryRadiusCircle3D = null;
    }
}

// Click listener for nearby search
function attachClickNearbySearch(map, day, options = {}) {
  const radius = options.radius || 500; 
  if (map.__ttNearbyClickBound) { map.off('click', map.__ttNearbyClickHandler); map.__ttNearbyClickBound = false; }
  let __nearbySingleTimer = null;
  const __nearbySingleDelay = 250;
  const clickHandler = function(e) {
    if (__nearbySingleTimer) clearTimeout(__nearbySingleTimer);
    __nearbySingleTimer = setTimeout(async () => {
        const isMapLibre = !!map.addSource;
        let lat, lng;
        if (isMapLibre) { lat = e.lngLat.lat; lng = e.lngLat.lng; } else { lat = e.latlng.lat; lng = e.latlng.lng; }
        if (window._nearbyPulseMarker) { try { window._nearbyPulseMarker.remove(); } catch(e) {} window._nearbyPulseMarker = null; }
        if (window._nearbyPulseMarker3D) { try { window._nearbyPulseMarker3D.remove(); } catch(e) {} window._nearbyPulseMarker3D = null; }
        showNearbyPlacesByCategory(lat, lng, map, day, 'restaurants');
    }, __nearbySingleDelay);
  };
  map.on('click', clickHandler);
  map.__ttNearbyClickHandler = clickHandler;
  map.__ttNearbyClickBound = true;
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
    banner.innerHTML = `<span>Click the map and view AI-generated information about each spot.</span>`;
    expandedContainer.prepend(banner);
  }
  banner.style.display = 'flex';
  banner.style.cursor = 'pointer';
  banner.style.transition = 'opacity 1s ease-out';
  banner.style.opacity = '0';
  requestAnimationFrame(() => { banner.style.opacity = '1'; });
  const fadeOutBanner = () => {
      if (banner.style.opacity === '0') return;
      banner.style.opacity = '0';
      setTimeout(() => { banner.style.display = 'none'; }, 1000); 
  };
  banner.onclick = function() { fadeOutBanner(); };
  const closeBtn = banner.querySelector('#close-route-info');
  if (closeBtn) { closeBtn.onclick = function(e) { e.stopPropagation(); fadeOutBanner(); }; }
  setTimeout(function() { if (banner.style.display !== 'none') { fadeOutBanner(); } }, 4000);
}

window.addNearbyPlaceToTripFromPopup = async function(index, day, lat, lon) {
    try {
        const place = window._lastNearbyPlaces && window._lastNearbyPlaces[index];
        if (!place) return;
        const p = place.properties;
        const name = p.name || p.formatted || "Unknown Place";
        const address = p.formatted || "";
        const category = place.category || 'Place';
        let imageUrl = "img/placeholder.png";
        if (window._lastNearbyPhotos && window._lastNearbyPhotos[index]) {
            imageUrl = window._lastNearbyPhotos[index];
        } else if (typeof getPexelsImage === "function") {
            try { const city = window.selectedCity || ""; imageUrl = await getPexelsImage(`${name} ${category} ${city}`); } catch (e) {}
        }
        if (typeof addToCart === "function") {
            addToCart(name, imageUrl, parseInt(day), category, address, null, null, p.opening_hours || "", p.place_id, { lat: parseFloat(lat), lng: parseFloat(lon) }, p.website || "");
            const btn = document.activeElement;
            if (btn && btn.tagName === 'BUTTON') {
                const originalText = btn.innerHTML;
                btn.innerHTML = "✓";
                btn.style.color = "green"; btn.style.borderColor = "green";
                setTimeout(() => { btn.innerHTML = originalText; btn.style.color = ""; btn.style.borderColor = ""; }, 2000);
            }
        }
    } catch (error) { console.error("Error adding nearby place to trip:", error); }
};

function handlePopupImageLoading(f, imgId) {
    getImageForPlace(f.properties.name, "restaurant", window.selectedCity || "").then(src => {
        const img = document.getElementById(imgId);
        const spin = document.getElementById(imgId + "-spin");
        if (img && src) { img.src = src; img.classList.remove("hidden-img"); if (img.complete && img.naturalWidth !== 0 && spin) spin.style.display = "none"; }
        if (img) { img.onload = () => { if (spin) spin.style.display = "none"; img.classList.remove("hidden-img"); }; img.onerror = () => { if (spin) spin.style.display = "none"; img.classList.add("hidden-img"); }; }
        else if (spin) { spin.style.display = "none"; }
    }).catch(() => {
        const spin = document.getElementById(imgId + "-spin");
        const img = document.getElementById(imgId);
        if (spin) spin.style.display = "none";
        if (img) img.classList.add("hidden-img");
    });
}

function getSimplePlaceCategory(f) {
    const cats = f.properties.categories || "";
    if (cats.includes('commercial') || cats.includes('market')) return 'markets';
    if (cats.includes('entertainment') || cats.includes('leisure')) return 'entertainment';
    if (cats.includes('restaurant') || cats.includes('cafe') || cats.includes('food')) return 'restaurant';
    if (cats.includes('accommodation') || cats.includes('hotel')) return 'hotel';
    return 'restaurant';
}

// AI açıklaması fetch
async function fetchClickedPointAI(pointName, lat, lng, city, facts, targetDivId = 'ai-point-description') {
    const descDiv = document.getElementById(targetDivId);
    if (!descDiv) return;
    aiActiveRequest++;
    const myRequestId = aiActiveRequest;
    const isIconClick = targetDivId.startsWith('ai-icon-');
    const mainAiDiv = document.getElementById('ai-point-description');
    const targetElement = isIconClick ? mainAiDiv : descDiv;
    if (!targetElement) return;
    if (targetElement.dataset.loading === 'true' && !targetElement.querySelector('.ai-spinner')) return;
    if (targetDivId === 'ai-point-description' || isIconClick) {
        clearTimeout(aiDebounceTimeout);
        if (aiAbortController) aiAbortController.abort();
        aiAbortController = new AbortController();
    }
    const cleanCityContext = (context) => {
        if (!context) return "";
        return context.replace(/\b\d{5}\b/g, '').replace(/\b\d{4}\s?[A-Z]{2}\b/gi, '').replace(/,\s*,/g, ',').replace(/^\s*,\s*|\s*,\s*$/g, '').trim();
    };
    targetElement.dataset.loading = 'true';
    targetElement.style.display = 'block';
    const loadingPhases = [
        { duration: 5000, text: `Loading AI analysis...` }, { duration: 5000, text: `Analyzing ${pointName}...` },
        { duration: 5000, text: `Creating information ...` }, { duration: 5000, text: `Finalizing analysis...` }
    ];
    let currentPhase = 0;
    const loadingTimers = [];
    const showLoadingPhase = (phaseIndex) => {
        const phase = loadingPhases[phaseIndex];
        const previousPhases = loadingPhases.slice(0, phaseIndex);
        targetElement.innerHTML = `
            <div style="padding: 12px; text-align: center; background: #f8f9fa; border-radius: 8px; margin-top: 8px; width: 100%; box-sizing: border-box;">
                <div class="ai-spinner" style="width: 18px; height: 18px; border: 2px solid #8a4af3; border-top: 2px solid transparent; border-radius: 50%; animation: ai-spin 0.8s linear infinite; margin: 0 auto 8px;"></div>
                ${previousPhases.map((p, idx) => `<div style="font-size: 10px; color: #666; margin-bottom: 4px; opacity: 0.7;">✓ ${p.text}</div>`).join('')}
                <div style="font-size: 11px; font-weight: 500; text-transform: uppercase; color: #666; margin-top: ${phaseIndex > 0 ? '8px' : '0'};">${phase.text}</div>
            </div>
            <style>@keyframes ai-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
        `;
    };
    showLoadingPhase(0);
    for (let i = 1; i < loadingPhases.length; i++) {
        const timer = setTimeout(() => { if (myRequestId !== aiActiveRequest) return; showLoadingPhase(i); }, loadingPhases.slice(0, i).reduce((sum, phase) => sum + phase.duration, 0));
        loadingTimers.push(timer);
    }
    const triggerFetch = async () => {
        try {
            const cleanedCity = cleanCityContext(city);
            console.time('AI-API-Response');
            const response = await fetch('/clicked-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ point: pointName, city: cleanedCity, lat, lng, facts }) });
            console.timeEnd('AI-API-Response');
            if (myRequestId !== aiActiveRequest) return;
            const data = await response.json();
            loadingTimers.forEach(timer => clearTimeout(timer));
            targetElement.dataset.loading = 'false';
            let p1Content = data.p1;
            let p2Content = data.p2;
            if (!p1Content || p1Content.length < 5) p1Content = `${pointName} is located in ${city || 'the area'}. Explore the surroundings to discover more.`;
            targetElement.innerHTML = `
                <div style="margin-top: 4px; width: 100%;">
                    <div style="background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #f0f0f0;">
                        <div style="padding: 12px; background: linear-gradient(135deg, #f0f7ff 0%, #e8f4ff 100%); border-bottom: 1px solid #e0e0e0;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="width: 28px; height: 28px; background: #8a4af3; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px;">✨</div>
                                <div><div style="font-weight: 600; font-size: 14px; color: #333;">${pointName}</div><div style="font-size: 11px; color: #666; margin-top: 2px;">AI Insight</div></div>
                            </div>
                        </div>
                        <div style="padding: 12px; font-size: 13px; line-height: 1.5; color: #333; border-bottom: 1px solid #f8f9fa;">
                            <div style="display: flex; align-items: flex-start; gap: 8px;"><span style="font-size: 12px; color: #8a4af3; margin-top: 2px;">📍</span><div style="flex: 1;">${p1Content}</div></div>
                        </div>
                        ${p2Content ? `<div style="padding: 10px 12px; background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); display: flex; align-items: flex-start; gap: 8px;"><span style="font-size: 12px; color: #ff9800;">💡</span><div style="color: #555; font-size: 12px; line-height: 1.4; flex: 1;"><strong style="color: #333; font-size: 11px; display: block; margin-bottom: 2px;">Tip</strong>${p2Content}</div></div>` : ''}
                    </div>
                </div>`;
        } catch (e) {
            loadingTimers.forEach(timer => clearTimeout(timer));
            if (myRequestId !== aiActiveRequest) return;
            if (e.name === 'AbortError') { targetElement.innerHTML = ""; targetElement.style.display = 'none'; return; }
            targetElement.dataset.loading = 'false';
            targetElement.innerHTML = `<div style="padding: 10px; text-align: center; color: #666; font-size: 12px; background: #f9f9f9; border-radius: 6px; margin-top: 8px;"><div style="margin-bottom: 4px;">⚠️ Information unavailable</div><small style="color: #999;">Try clicking another location</small></div>`;
        }
    };
    if (targetDivId === 'ai-point-description' || isIconClick) { aiDebounceTimeout = setTimeout(triggerFetch, 600); }
}

// showNearbyPlacesByCategory (Eski kodlar, değişmedi)
window._categoryCacheData = window._categoryCacheData || {};
async function showNearbyPlacesByCategory(lat, lng, map, day, categoryType = 'restaurants', radiusOverride = null) {
    window._lastSelectedCategory = categoryType;
    const isMapLibre = !!map.addSource;
    const cacheKey = `${lat}-${lng}-${categoryType}`;
    let pointInfo = { name: "Selected Point", address: "" };
    try { pointInfo = await getPlaceInfoFromLatLng(lat, lng); } catch (e) { console.warn('getPlaceInfoFromLatLng failed:', e.message); }
    let currentCityName = "";
    const reverseUrl = `/api/geoapify/reverse?lat=${lat}&lon=${lng}`;
    try {
        const reverseResp = await fetch(reverseUrl);
        const reverseData = await reverseResp.json();
        if (reverseData.features && reverseData.features[0]) {
            const props = reverseData.features[0].properties;
            if (props.country_code === 'tr' || props.country === 'Turkey') { currentCityName = props.county || ""; } else { currentCityName = props.city || ""; }
        }
    } catch (e) { console.error('Reverse geocode error:', e); }
    if (!currentCityName) currentCityName = window.selectedCity || "";
    const country = "Turkey";
    const locationContext = `${currentCityName}, ${country}`;
    const categoryConfig = {
        'restaurants': { apiCategories: 'catering.restaurant,catering.cafe,catering.bar,catering.fast_food,catering.pub', color: '#FF5252', iconUrl: '/img/restaurant_icon.svg', title: 'Restaurants', layerPrefix: 'restaurant' },
        'hotels': { apiCategories: 'accommodation', color: '#2196F3', iconUrl: '/img/accommodation_icon.svg', title: 'Hotels', layerPrefix: 'hotel' },
        'markets': { apiCategories: 'commercial.supermarket,commercial.convenience,commercial.clothing,commercial.shopping_mall', color: '#4CAF50', iconUrl: '/img/market_icon.svg', title: 'Markets', layerPrefix: 'market' },
        'entertainment': { apiCategories: 'entertainment,leisure', color: '#FF9800', iconUrl: '/img/touristic_icon.svg', title: 'Entertainment', layerPrefix: 'entertainment' }
    };
    const config = categoryConfig[categoryType] || categoryConfig.restaurants;
    
    // Popup içeriğini hazırla
    const addPointSection = `<div class="add-point-section" style="margin-bottom: 16px; border-bottom: 1px solid #e0e0e0; padding-bottom: 16px;">
            <div class="point-item" style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 12px; background: #f8f9fa; border-radius: 8px; margin-bottom: 8px;">
                <div class="point-image" style="width: 60px; height: 40px; position: relative; flex-shrink: 0;"><img id="clicked-point-img" src="img/placeholder.png" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px; opacity: 0.8;"><div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 18px;">📍</div></div>
                <div class="point-info" style="flex: 1; min-width: 0;"><div class="point-name-editor" style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;"><span style="font-weight: 600; font-size: 15px; color: #333;">${pointInfo.name}</span></div><div class="point-address" style="font-size: 12px; color: #666;">${pointInfo.address || 'Selected location'}</div></div>
                <div class="point-actions" style="display: flex; flex-direction: column; align-items: center; gap: 4px;"><button class="add-point-to-cart-btn" onclick="window.addClickedPointToCart(${lat}, ${lng}, ${day})" style="width: 36px; height: 36px; background: #1976d2; color: white; border: none; border-radius: 50%; font-size: 18px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">+</button></div>
                <div id="ai-point-description" style="width: 100%; margin-top: 8px; border-top: 1px dashed #ddd; padding-top: 10px;"></div>
            </div></div>`;
    let tabsHtml = '<div class="category-tabs" style="display: flex; gap: 4px; margin-bottom: 16px; border-bottom: 1px solid #e0e0e0;">';
    Object.keys(categoryConfig).forEach(key => {
        const isActive = key === categoryType;
        tabsHtml += `<button class="category-tab ${isActive ? 'active' : ''}" data-tab="${key}" style="flex: 1; padding: 10px 6px; background: ${isActive ? '#f0f7ff' : 'transparent'}; border: none; border-bottom: 2px solid ${isActive ? '#1976d2' : 'transparent'}; cursor: pointer; font-size: 12px; color: ${isActive ? '#1976d2' : '#666'};"><div style="font-weight: ${isActive ? '600' : '500'};">${categoryConfig[key].title}</div></button>`;
    });
    tabsHtml += '</div>';
    const categorySection = `<div class="category-section" style="margin-bottom: 16px;">${tabsHtml}<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;"><div style="font-weight: 600; font-size: 16px; color: #333;" class="category-title">${config.title}</div><div style="margin-left: auto; background: #4caf50; color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: bold;" class="category-count">Loading...</div></div><div class="category-items-container" style="display: flex; flex-direction: column; gap: 10px;"><div style="padding: 20px; text-align: center; color: #666;">Finding ${config.title.toLowerCase()}...</div></div></div>`;
    
    // Popup'ı aç
    const html = `<div><div class="nearby-popup-title" style="font-weight: bold; margin-bottom: 12px; font-size: 16px;">📍 Nearby Places</div>${addPointSection}${categorySection}</div>`;
    showCustomPopup(lat, lng, map, html, true);
    
    window._currentPointInfo = pointInfo;
    setTimeout(() => { loadClickedPointImage(pointInfo.name); }, 30);
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            if (window._lastSelectedCategory === this.dataset.tab) return;
            showNearbyPlacesByCategory(lat, lng, map, day, this.dataset.tab);
        });
    });
    if (pointInfo?.name && pointInfo?.name !== "Selected Point") {
        window.fetchClickedPointAI(pointInfo.name, lat, lng, locationContext, {}, 'ai-point-description');
    }
    
    // Marker işlemleri (Kısaltıldı)
    clearAllCategoryMarkers(map);
    // Pulse temizle
    if (window._nearbyPulseMarker) { try { window._nearbyPulseMarker.remove(); } catch(e) {} window._nearbyPulseMarker = null; }
    if (window._nearbyPulseMarker3D) { try { window._nearbyPulseMarker3D.remove(); } catch(e) {} window._nearbyPulseMarker3D = null; }
    
    // Pulse Ekle
    const pulseHtml = `<div class="tt-pulse-marker"><div class="tt-pulse-dot"><div class="tt-pulse-dot-inner"></div></div><div class="tt-pulse-ring tt-pulse-ring-1"></div><div class="tt-pulse-ring tt-pulse-ring-2"></div><div class="tt-pulse-ring tt-pulse-ring-3"></div><div class="tt-pulse-glow"></div><div class="tt-pulse-inner-ring"></div></div>`;
    if (!!map.addSource) {
        const el = document.createElement('div'); el.className = 'tt-pulse-marker'; el.innerHTML = pulseHtml;
        window._nearbyPulseMarker3D = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(map);
    } else {
        const pulseIcon = L.divIcon({ html: pulseHtml, className: 'tt-pulse-marker', iconSize: [40, 40], iconAnchor: [20, 20] });
        window._nearbyPulseMarker = L.marker([lat, lng], { icon: pulseIcon, interactive: false }).addTo(map);
    }

    // Yerleri getir
    const searchRadius = radiusOverride || 5000;
    const url = `/api/geoapify/places?categories=${config.apiCategories}&lat=${lat}&lon=${lng}&radius=${searchRadius}&limit=30`;
    try {
        const resp = await fetch(url);
        const data = await resp.json();
        window._categoryCacheData[cacheKey] = data;
        
        // Markerları ve listeyi çiz (Basitleştirildi)
        const container = document.querySelector('.category-items-container');
        if (!data.features || data.features.length === 0) {
            document.querySelector('.category-count').textContent = "0";
            if (container) container.innerHTML = `<div style="text-align: center; padding: 20px; color: #999;">No results. <button class="search-wider-btn" onclick="window.showNearbyPlacesByCategory(${lat}, ${lng}, window._currentMap, ${day}, '${categoryType}', 10000)">Search wider (10km)</button></div>`;
            return;
        }
        
        let maxDistance = 0;
        const places = data.features.map((f, idx) => {
            const d = haversine(lat, lng, f.properties.lat, f.properties.lon);
            if (d > maxDistance) maxDistance = d;
            return { feature: f, distance: d, index: idx };
        }).sort((a, b) => a.distance - b.distance).slice(0, 20);
        
        document.querySelector('.category-count').textContent = places.length;
        if (container) {
            container.innerHTML = '';
            // Daire çizimi
            const radiusMeters = Math.ceil(maxDistance);
            if (isMapLibre) {
                const circleId = `category-radius-${categoryType}-${Date.now()}`;
                map.addSource(circleId, { type: 'geojson', data: createCircleGeoJSON(lat, lng, radiusMeters) });
                map.addLayer({ id: circleId + '-layer', type: 'fill', source: circleId, paint: { 'fill-color': '#1976d2', 'fill-opacity': 0.04 } });
                window._categoryRadiusCircle3D = circleId;
            } else {
                window._categoryRadiusCircle = L.circle([lat, lng], { radius: radiusMeters, color: '#1976d2', fillOpacity: 0.04, weight: 0 }).addTo(map);
            }
            
            // Liste öğeleri ve markerlar
            places.forEach((p, idx) => {
               const f = p.feature;
               const imgId = `${config.layerPrefix}-sidebar-img-${idx}-${Date.now()}`;
               const itemHtml = `<div class="category-place-item" style="display: flex; align-items: center; gap: 12px; padding: 10px; background: #f8f9fa; border-radius: 8px; margin-bottom: 10px; border: 1px solid #eee;">
                    <div style="position: relative; width: 60px; height: 40px; flex-shrink: 0;"><img id="${imgId}" src="img/placeholder.png" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;"></div>
                    <div style="flex: 1;"><div style="font-weight: 600;">${f.properties.name}</div><div style="font-size: 0.9rem;">${f.properties.formatted}</div></div>
                    <button onclick="window.addNearbyPlaceToTripFromPopup(${idx}, ${day}, ${f.properties.lat}, ${f.properties.lon})">+</button>
               </div>`;
               const div = document.createElement('div'); div.innerHTML = itemHtml; container.appendChild(div.firstChild);
               getImageForPlace(f.properties.name, config.layerPrefix, window.selectedCity || "").then(src => { if(src) document.getElementById(imgId).src = src; });
               
               // Marker Ekleme
               const popupContent = getFastPlacePopupHTML(f, imgId + '-map', day, config, p.distance);
               if (isMapLibre) {
                   const el = document.createElement('div'); el.innerHTML = getCategoryMarkerHtml(config.color, config.iconUrl, categoryType, p.distance); el.className = 'custom-3d-marker-element';
                   const popup = new maplibregl.Popup({ offset: 25, maxWidth: '360px', closeButton: true, className: 'tt-unified-popup' }).setHTML(popupContent);
                   const m = new maplibregl.Marker({ element: el }).setLngLat([f.properties.lon, f.properties.lat]).setPopup(popup).addTo(map);
                   window[`_${config.layerPrefix}3DMarkers`].push(m);
               } else {
                   const m = L.marker([f.properties.lat, f.properties.lon], { icon: L.divIcon({ html: getCategoryMarkerHtml(config.color, config.iconUrl, categoryType, p.distance), className: "custom-category-marker", iconSize: [32,32] }) }).addTo(map);
                   m.bindPopup(popupContent, { maxWidth: 341 });
                   map[`__${config.layerPrefix}Layers`].push(m);
               }
            });
        }
    } catch (err) { console.error(err); }
}

function getCategoryMarkerHtml(color, iconUrl, categoryType, distance) {
    return `<div style="position:relative;"><div style="position:relative;width:32px;height:32px;background:white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.2);border:3px solid ${color};"><img src="${iconUrl}" style="width:18px;height:18px;"></div></div>`;
}
function getFastPlacePopupHTML(f, imgId, day, config, distance) {
    return `<div class="point-item"><b>${f.properties.name}</b><br>${f.properties.formatted}<br><button onclick="window.addPlaceToTripFromPopup('${imgId}', '${f.properties.name}', '${f.properties.formatted}', ${day}, ${f.properties.lat}, ${f.properties.lon}, '${config.layerPrefix}')">Add to Trip</button></div>`;
}
window.addRestaurantToTripFromPopup = function(imgId, name, address, day, lat, lon) { return window.addPlaceToTripFromPopup(imgId, name, address, day, lat, lon, 'restaurant'); };
window.addHotelToTripFromPopup = function(imgId, name, address, day, lat, lon) { return window.addPlaceToTripFromPopup(imgId, name, address, day, lat, lon, 'hotel'); };
window.addMarketToTripFromPopup = function(imgId, name, address, day, lat, lon) { return window.addPlaceToTripFromPopup(imgId, name, address, day, lat, lon, 'market'); };
window.addEntertainmentToTripFromPopup = function(imgId, name, address, day, lat, lon) { return window.addPlaceToTripFromPopup(imgId, name, address, day, lat, lon, 'entertainment'); };
window.addPlaceToTripFromPopup = function(imgId, name, address, day, lat, lon, categoryType) {
    addToCart(name, '/img/placeholder.png', day, categoryType, address, null, null, null, null, { lat: Number(lat), lng: Number(lon) }, "");
    alert("Added!");
};

// ============================================
// NEARBY POPUP & VIEW SWITCHER (BALZOOK + CSS FIX)
// ============================================

// 1. CSS DÜZELTMESİNİ ENJEKTE ET (Beyaz Ekran Sorunu İçin)
(function injectNearbyStyles() {
    const styleId = 'nearby-css-fix';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
        /* Verdiğin CSS'i buraya gömüyoruz ama background'u düzeltiyoruz */
        @keyframes slideIn { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slideOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(100%); } }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.7; } 100% { transform: scale(1); opacity: 1; } }

        /* KRİTİK DÜZELTME: Container şeffaf, İçerik beyaz */
        #custom-nearby-popup {
            scrollbar-width: thin;
            scrollbar-color: #8a4af3 #f1f1f1;
            position: fixed; top: 60px; width: 415px; right: 0; height: 100%; z-index: 1008;
            background: transparent !important; /* BEYAZ EKRANI ÖNLER */
            pointer-events: none; /* Haritaya tıklamaya izin ver */
            overflow-y: visible; /* Buton taşabilsin */
            display: flex; flex-direction: column; justify-content: flex-start; flex-wrap: nowrap;
            transition: 0.3s ease;
        }
        
        /* İçerik Kısmı */
        .nearby-popup-content {
            background: #fff; /* İçerik beyaz kalsın */
            pointer-events: auto; /* İçeriğe tıklanabilsin */
            overflow-y: auto;
            max-height: calc(100vh - 80px);
            padding: 20px;
            box-shadow: -2px 0 5px rgba(0,0,0,0.1);
        }

        /* Mobilde */
        @media (max-width: 480px) {
            #custom-nearby-popup { top: 0px !important; right: 0px !important; left: 0px !important; bottom: 0px !important; width: auto !important; max-width: none !important; }
        }
        
        /* Diğer stillerin */
        .nearby-popup-close-btn { position: absolute; top: 12px; right: 12px; width: 28px; height: 28px; border: none; background: #f44336; color: #fff; border-radius: 50%; cursor: pointer; font-size: 16px; font-weight: bold; display: flex; align-items: center; justify-content: center; z-index: 10001; box-shadow: 0 2px 8px rgba(244,67,54,0.3); transition: all 0.2s; }
        .nearby-popup-close-btn:hover { background: #d32f2f; transform: scale(1.1); }
        .nearby-loading-spinner { display: inline-block; width: 20px; height: 20px; border: 2px solid #1976d2; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite; }
        .nearby-place-item { margin: 8px 0; display: flex; align-items: center; min-height: 50px; }
        .nearby-popup-title { font-weight: bold; font-size: 16px; margin-bottom: 15px; color: #1976d2; border-bottom: 2px solid #e3f2fd; padding-bottom: 10px; }
    `;
    document.head.appendChild(style);
})();

// 2. KAPATMA
window.closeNearbyPopup = function() {
    const popup = document.getElementById('custom-nearby-popup');
    const btn = document.getElementById('nearby-view-switcher-btn');
    if (popup) popup.remove();
    if (btn) btn.remove();
    document.querySelectorAll('.sidebar-overlay').forEach(s => s.classList.remove('open'));
    const mapContainer = document.querySelector('.leaflet-container, .maplibregl-map');
    if (mapContainer) { mapContainer.style.display = 'block'; mapContainer.style.opacity = '1'; }
    if (window._nearbyPulseMarker) window._nearbyPulseMarker.remove();
    if (window._nearbyPulseMarker3D) window._nearbyPulseMarker3D.remove();
};

// 3. BUTON OLUŞTURUCU (BALZOOK)
function setupViewSwitcherButton(mapInstance) {
    if (document.getElementById('nearby-view-switcher-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'nearby-view-switcher-btn';
    btn.innerHTML = '<span>🗺️</span> <span>Show Map</span>';
    btn.style.cssText = `position: fixed !important; bottom: 30px !important; left: 50% !important; transform: translateX(-50%) !important; z-index: 2147483647 !important; padding: 12px 24px; background: #333; color: #fff; border: none; border-radius: 50px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); font-weight: bold; display: flex; align-items: center; gap: 8px; cursor: pointer; pointer-events: auto;`;
    
    btn.onclick = function(e) {
        e.stopPropagation();
        const popup = document.getElementById('custom-nearby-popup');
        const contentDiv = popup ? popup.querySelector('.nearby-popup-content') : null;
        if (!contentDiv) return;

        if (contentDiv.style.display !== 'none') {
            // LİSTEYİ GİZLE -> HARİTA GÖRÜNÜR
            contentDiv.style.display = 'none';
            this.innerHTML = '<span>📋</span> <span>Show List</span>';
            this.style.background = '#1976d2';
            // Haritayı zorla güncelle (Beyaz ekran fix)
            if (mapInstance) {
                setTimeout(() => { if (mapInstance.invalidateSize) mapInstance.invalidateSize(); if (mapInstance.resize) mapInstance.resize(); }, 10);
            }
        } else {
            // LİSTEYİ GÖSTER
            contentDiv.style.display = 'block';
            this.innerHTML = '<span>🗺️</span> <span>Show Map</span>';
            this.style.background = '#333';
        }
    };
    document.body.appendChild(btn);
}

// 4. POPUP AÇMA (HEPSİNİ BİRLEŞTİREN)
window.showCustomPopup = function(lat, lng, map, content, showCloseButton = true) {
    window.closeNearbyPopup(); // Temizlik

    const popupContainer = document.createElement('div');
    popupContainer.id = 'custom-nearby-popup';
    const closeBtn = showCloseButton ? `<button onclick="window.closeNearbyPopup()" class="nearby-popup-close-btn" title="Close">X</button>` : '';
    popupContainer.innerHTML = `${closeBtn}<div class="nearby-popup-content">${content}</div>`;
    document.body.appendChild(popupContainer);
    window._currentNearbyPopupElement = popupContainer;

    // Pulse
    if (!!map.addSource) {
        const el = document.createElement('div'); el.className = 'tt-pulse-marker'; 
        el.innerHTML = `<div class="tt-pulse-dot"></div><div class="tt-pulse-ring"></div>`; // Basitleştirilmiş
        window._nearbyPulseMarker3D = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(map);
    } else {
        const pulseIcon = L.divIcon({ html: `<div class="tt-pulse-marker"><div class="tt-pulse-dot"></div></div>`, className: 'tt-pulse-marker' });
        window._nearbyPulseMarker = L.marker([lat, lng], { icon: pulseIcon, interactive: false }).addTo(map);
    }

    // Mobilde Butonu Koy
    if (window.innerWidth < 768) {
        setTimeout(() => {
            const mainChat = document.getElementById('main-chat');
            const isMapExpanded = !mainChat || window.getComputedStyle(mainChat).display === 'none';
            if (isMapExpanded) {
                setupViewSwitcherButton(map);
            }
        }, 300);
    }
};

window.addEventListener('hashchange', window.closeNearbyPopup);