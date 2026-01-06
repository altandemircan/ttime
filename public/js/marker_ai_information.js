// =========================================================================
// === AI MAP INTERACTION (ENGLISH - 3 TABS) ===
// =========================================================================

// 1. CSS STYLES (Aynı kalacak)
(function addEnglishAIStyles() {
    const styleId = 'tt-ai-simple-styles-en';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
        .ai-popup-simple { font-family: 'Satoshi', sans-serif; min-width: 280px; max-width: 320px; }
        
        /* TABS */
        .ai-simple-tabs { display: flex; border-bottom: 2px solid #f1f5f9; margin-bottom: 10px; }
        .ai-simple-tab { 
            flex: 1; border: none; background: none; padding: 8px 4px; 
            font-size: 0.8rem; font-weight: 600; color: #94a3b8; 
            cursor: pointer; transition: all 0.2s; border-bottom: 2px solid transparent; margin-bottom: -2px;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ai-simple-tab:hover { color: #64748b; }
        .ai-simple-tab.active { color: #8a4af3; border-bottom-color: #8a4af3; }
        
        /* NEARBY BUTTONS */
        .ai-nearby-buttons { margin-top: 12px; border-top: 1px solid #f1f5f9; padding-top: 12px; }
        .ai-nearby-title { font-size: 0.75rem; color: #64748b; margin-bottom: 8px; font-weight: 600; }
        .ai-nearby-btn { 
            display: block; width: 100%; background: #f8fafc; border: 1px solid #e2e8f0;
            padding: 8px 12px; border-radius: 8px; margin-bottom: 6px;
            font-size: 0.8rem; color: #475569; cursor: pointer; text-align: left;
            transition: all 0.2s; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .ai-nearby-btn:hover { 
            background: #f1f5f9; border-color: #cbd5e1; color: #334155;
        }
        .ai-nearby-btn:last-child { margin-bottom: 0; }
        
        /* CONTENT */
        .ai-simple-content { min-height: 100px; font-size: 0.9rem; color: #334155; line-height: 1.8; font-weight: 400; text-align: left; }
        .ai-simple-loading { padding: 20px; text-align: center; color: #94a3b8; font-size: 0.85rem; }
        .ai-point-title { font-weight: 700; color: #0f172a; margin: 0 0 8px 0; font-size: 0.85rem; }
        .ai-point-p { margin: 0 0 10px 0; }
        .ai-point-p:last-child { margin-bottom: 0; }
        .ai-simple-footer { margin-top: 8px; font-size: 0.7rem; color: #cbd5e1; text-align: right; border-top: 1px solid #f8fafc; padding-top: 5px;}
    `;
    document.head.appendChild(style);
})();

// 2. BASİT LOCATION PARSER - SADECE TEMEL BİLGİLER (AYNI)
async function getHierarchicalLocation(lat, lng) {
    try {
        const resp = await fetch(`/api/geoapify/reverse?lat=${lat}&lon=${lng}&limit=1`);
        if (!resp.ok) return null;

        const data = await resp.json();
        if (!data.features || data.features.length === 0) return null;

        const props = data.features[0].properties || {};

        const norm = (v) => (typeof v === "string" ? v.trim() : "");
        const looksLikeRegion = (v) => /region|bölgesi|bolgesi/i.test(norm(v));

        // 1) Nokta / mekan
        let specific = norm(props.name) || null;

        const street = norm(props.street);
        if (specific && (specific === street || /^\d/.test(specific))) specific = null;

        // 2) Şehir/il
        const county = norm(props.county);
        const state = norm(props.state);

        let city =
            county ||
            (!looksLikeRegion(state) ? state : "") ||
            norm(props.state_district) ||
            norm(props.province) ||
            norm(props.city) ||
            "";

        if (looksLikeRegion(city)) city = "";

        const country = norm(props.country) || "";

        // adres-only yakalama
        const isJustAddress = !specific && (!!street || !!norm(props.housenumber) || !!norm(props.postcode));

        const facts = {
            formatted: props.formatted || "",
            name: props.name || "",
            street: props.street || "",
            housenumber: props.housenumber || "",
            postcode: props.postcode || "",
            suburb: props.suburb || "",
            city_raw: props.city || "",
            county: props.county || "",
            state: props.state || "",
            country: props.country || "",
            osm: (props.datasource && props.datasource.raw) ? props.datasource.raw : {}
        };

        return { specific, city, country, isJustAddress, facts };
    } catch (e) {
        console.error(e);
        return null;
    }
}

// marker_ai_information.js içindeki fetchNearbyPlaceNames fonksiyonu

async function fetchNearbyPlaceNames(lat, lng) {
    // ... (Loglar ve error management aynı)
    const response = await fetch('/llm-proxy/nearby-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng })
    });
    if (!response.ok) return [];
    const data = await response.json();
    const places = [];
    const usedNames = new Set();
    const checkAndAdd = (obj, type) => {
        if (obj && obj.name && !usedNames.has(obj.name)) {
            places.push({ 
                name: obj.name, 
                type: type,
                details: obj.facts || {}
            });
            usedNames.add(obj.name);
        }
    };
    checkAndAdd(data.settlement, "settlement");
    checkAndAdd(data.nature, "nature");
    checkAndAdd(data.historic, "historic");
    return places;
}

// --- AI Info Fetch (city/point switch + BUTTONLAR İLE HER ZAMAN GÜNCEL SONUÇ) ---
async function fetchSimpleAI(endpointType, queryName, city, country, facts, containerDiv) {
    const url = endpointType === 'city' ? '/llm-proxy/plan-summary' : '/llm-proxy/point-ai-info';
    const body = endpointType === 'city'
        ? { city, country }
        : { point: queryName, city, country, facts: facts || {} };

    containerDiv.innerHTML = `<div class="ai-simple-loading">Analyzing: <b>${queryName}</b>...</div>`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        const p1 = endpointType === 'city' ? (data.summary || "No info.") : (data.p1 || "No info.");
        const p2 = endpointType === 'city' ? (data.tip || data.highlight || "") : (data.p2 || "");
        containerDiv.innerHTML = `
            <div class="ai-response-wrapper">
                <div class="ai-point-title">${endpointType === 'city' ? 'City' : 'Point'} AI Info:</div>
                <p class="ai-point-p">${p1}</p>
                ${p2 ? `<p class="ai-point-p">${p2}</p>` : ``}
                <div class="nearby-section-target"></div>
            </div>
        `;
        // Eğer tip "point" ise, nearby section'ı başlat
        if (endpointType === 'point') {
            const latVal = facts?.__lat ?? facts?.lat;
            const lngVal = facts?.__lng ?? facts?.lng;
            if (latVal !== undefined && lngVal !== undefined && !isNaN(parseFloat(latVal)) && !isNaN(parseFloat(lngVal))) {
                renderNearbyButtons(parseFloat(latVal), parseFloat(lngVal), city, country, containerDiv.querySelector('.nearby-section-target'));
            }
        }
    } catch (e) {
        containerDiv.innerHTML = `<div style="color:#ef4444; padding:10px;">Connection error.</div>`;
    }
}

async function renderNearbyButtons(lat, lng, city, country, targetDiv) {
    if (!targetDiv) return;
    targetDiv.innerHTML = `
        <div class="ai-nearby-buttons" style="margin-top:15px; border-top:1px solid #f1f5f9; padding-top: 10px;">
            <div class="ai-nearby-title" style="font-weight:700; font-size:0.85rem; margin-bottom:8px; color:#475569;">📍 Nearby Exploration:</div>
            <div id="nearby-status-text" style="font-size:0.75rem; color:#94a3b8; padding: 5px;">
                <span class="spinner" style="display:inline-block; width:8px; height:8px; border:1px solid #ccc; border-top-color:#8a4af3; border-radius:50%; animation:spin 0.8s linear infinite; margin-right:5px;"></span>
                Searching surroundings...
            </div>
        </div>
    `;
    try {
        const res = await fetch('/llm-proxy/nearby-ai', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: parseFloat(lat), lng: parseFloat(lng) })
        });
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        const data = await res.json();
        const nearbyButtonsContainer = targetDiv.querySelector('.ai-nearby-buttons');
        const statusText = targetDiv.querySelector('#nearby-status-text');
        // v3: Dizi olarak bekle!
        if (
            (Array.isArray(data.settlement) && data.settlement.length > 0) ||
            (Array.isArray(data.nature) && data.nature.length > 0) ||
            (Array.isArray(data.historic) && data.historic.length > 0)
        ) {
            let btnsHTML = '';
            const cats = [
                {k:'settlement', i:'🏙️', l:'City'}, 
                {k:'nature', i:'🌳', l:'Nature'}, 
                {k:'historic', i:'🏛️', l:'Historic'}
            ];
            cats.forEach(c => {
                const arr = Array.isArray(data[c.k]) ? data[c.k] : [];
                arr.forEach(place => {
                    const name = (place.name || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
                    const safeCity = (city || '').replace(/'/g, "\\'");
                    const safeCountry = (country || '').replace(/'/g, "\\'");
                    // Facts'i JSON'a çevirip gönderebilirsin, ya da izole bırakabilirsin.
                    // Koord verisini birleştir:
                    let facts = JSON.stringify(Object.assign({}, place.facts || {}, {__lat:lat, __lng:lng}));
                    // " buton içinde tıkırdama yapmasın diye JSON'u single-quoted string'e çek
                    btnsHTML += `
                        <button class="ai-nearby-btn"
                            style="display: block; width: 100%; text-align: left; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; margin-bottom: 6px; cursor: pointer; transition: all 0.2s; font-size: 0.8rem;"
                            onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'"
                            onclick="fetchSimpleAI('point', '${name}', '${safeCity}', '${safeCountry}', ${facts.replace(/"/g,"'")}, this.closest('.ai-simple-content'))">
                            <span style="margin-right:5px;">${c.i}</span> <b>${c.l}:</b> ${place.name}
                        </button>`;
                });
            });
            if (btnsHTML) {
                nearbyButtonsContainer.innerHTML = `<div class="ai-nearby-title" style="font-weight:700; font-size:0.85rem; margin-bottom:8px; color:#475569;">📍 Nearby Exploration:</div>` + btnsHTML;
            } else {
                if (statusText) statusText.innerText = "No specific landmarks found nearby.";
            }
        } else {
            if (statusText) statusText.innerText = "No major landmarks found in this area.";
        }
    } catch (err) {
        const statusText = targetDiv.querySelector('#nearby-status-text');
        if (statusText) statusText.innerText = "Service temporarily unavailable.";
    }
}

// --- MAP CLICK HANDLER (AI popup açma) ---
async function handleMapAIClick(e) {
    const map = e.target;
    const popup = L.popup({ maxWidth: 320 }).setLatLng(e.latlng)
        .setContent('<div style="padding:10px; text-align:center; color:#64748b;">Acquiring location...</div>')
        .openOn(map);
    const loc = await getHierarchicalLocation(e.latlng.lat, e.latlng.lng);
    if (!loc) {
        popup.setContent(`
            <div style="padding:20px; text-align:center;">
                <div style="color:#475569; font-size:0.9rem; margin-bottom:10px;">
                    🏪 Local Business
                </div>
                <div style="color:#64748b; font-size:0.85rem;">
                    This appears to be a local business or service.
                    For travel insights, try clicking on tourist attractions.
                </div>
            </div>
        `);
        return;
    }
    if (!loc.facts || typeof loc.facts !== 'object') loc.facts = {};
    loc.facts.__lat = e.latlng.lat;
    loc.facts.__lng = e.latlng.lng;
    if (loc.isJustAddress) {
        popup.setContent(`
            <div style="padding:20px; text-align:center;">
                <div style="color:#475569; font-size:0.9rem; margin-bottom:10px;">
                    📍 ${loc.city || 'Location'}
                </div>
                <div style="color:#64748b; font-size:0.85rem;">
                    Click on named places (beaches, museums, parks)
                    for detailed travel information.
                </div>
            </div>
        `);
        return;
    }
    let tabsHTML = '';
    if (loc.specific && loc.specific.trim().length > 0) {
        tabsHTML += `<button class="ai-simple-tab active"
            data-endpoint="point"
            data-query="${loc.specific}"
            data-city="${loc.city}"
            data-country="${loc.country}">
            📍 ${loc.specific}
        </button>`;
    }
    const cityLabel = (loc.city && loc.city.trim().length > 0) ? loc.city : 'City';
    const isCityActive = tabsHTML === '' ? 'active' : '';
    tabsHTML += `<button class="ai-simple-tab ${isCityActive}"
        data-endpoint="city"
        data-query="${cityLabel}"
        data-city="${cityLabel}"
        data-country="${loc.country}">
        🌍 ${cityLabel}
    </button>`;
    const uiID = 'ai-ui-' + Date.now();
    const contentHTML = `
        <div id="${uiID}" class="ai-popup-simple">
            <div class="ai-simple-tabs">
                ${tabsHTML}
            </div>
            <div id="${uiID}-content" class="ai-simple-content"></div>
            <div class="ai-simple-footer">AI Travel Assistant</div>
        </div>
    `;
    popup.setContent(contentHTML);
    requestAnimationFrame(() => {
        const container = document.getElementById(uiID);
        if (!container) return;
        const contentDiv = document.getElementById(uiID + '-content');
        const buttons = container.querySelectorAll('.ai-simple-tab');
        buttons.forEach(btn => {
            btn.onclick = (evt) => {
                buttons.forEach(b => b.classList.remove('active'));
                evt.target.classList.add('active');
                const qName = evt.target.getAttribute('data-query') || '';
                const qCity = evt.target.getAttribute('data-city') || '';
                const qCountry = evt.target.getAttribute('data-country') || '';
                const qEndpoint = evt.target.getAttribute('data-endpoint') || 'point';
                fetchSimpleAI(qEndpoint, qName, qCity, qCountry, loc.facts, contentDiv);
            };
        });
        const activeBtn = container.querySelector('.ai-simple-tab.active');
        if (activeBtn) activeBtn.click();
    });
}
async function fetchNearbyPlaces(lat, lng, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Paneli görünür yapalım ki yüklendiğini görelim
    container.style.display = 'block';
    container.innerHTML = `
        <div class="ai-nearby-title">📍 Nearby Exploration:</div>
        <div id="nearby-loading" style="color: #94a3b8; font-size: 0.75rem; padding: 10px; text-align: center;">
            Searching surroundings...
        </div>
    `;

    try {
        const response = await fetch('/llm/nearby-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lng })
        });

        const data = await response.json();
        const loadingDiv = document.getElementById('nearby-loading');
        if (loadingDiv) loadingDiv.remove();

        // Veri kontrolü
        if (data.settlement || data.nature || data.historic) {
            const grid = document.createElement('div');
            grid.className = 'ai-nearby-grid';
            grid.style.cssText = "display: flex; flex-direction: column; gap: 8px; margin-top: 8px;";

            const items = [
                { key: 'settlement', icon: '🏙️', label: 'Settlement' },
                { key: 'nature', icon: '🌳', label: 'Nature/Parks' },
                { key: 'historic', icon: '🏛️', label: 'Historic/Tourism' }
            ];

            items.forEach(item => {
                if (data[item.key]) {
                    const btn = document.createElement('button');
                    btn.className = 'ai-nearby-btn';
                    btn.style.cssText = "background: #1e293b; border: 1px solid #334155; color: white; padding: 8px; border-radius: 6px; text-align: left; cursor: pointer; font-size: 0.85rem;";
                    btn.innerHTML = `<strong>${item.icon} ${item.label}:</strong> ${data[item.key].name}`;
                    
                    // Butona tıklandığında AI'ya sorsun
                    btn.onclick = () => {
                        alert(`${data[item.key].name} hakkında detaylı bilgi hazırlanıyor...`);
                    };
                    grid.appendChild(btn);
                }
            });
            container.appendChild(grid);
        } else {
            container.innerHTML += '<div style="color: #ef4444; font-size: 0.75rem; padding: 5px;">No significant nearby places found.</div>';
        }
    } catch (err) {
        console.error("Nearby Error:", err);
        container.innerHTML = '<div style="color: #ef4444; font-size: 0.75rem;">Error loading nearby data.</div>';
    }
}
// 4. AI FETCH FUNCTION (AYNI)
const aiSimpleCache = {};

async function fetchSimpleAI(endpointType, queryName, city, country, facts, containerDiv) {
    const cacheKey = `${endpointType}__${queryName.replace(/\s+/g, '_')}__${city}__${country}`;
    
    // 1. Loading
    containerDiv.innerHTML = `<div class="ai-simple-loading">Analyzing: <b>${queryName}</b>...</div>`; 

    try {
        const url = endpointType === 'city' ? '/llm-proxy/plan-summary' : '/llm-proxy/point-ai-info';
        const body = endpointType === 'city' 
            ? { city, country } 
            : { point: queryName, city, country, facts: facts || {} };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await response.json();

        const p1 = endpointType === 'city' ? (data.summary || "No info.") : (data.p1 || "No info.");
        const p2 = endpointType === 'city' ? (data.tip || data.highlight || "") : (data.p2 || "");

        // Ana içeriği basıyoruz
        containerDiv.innerHTML = `
            <div class="ai-response-wrapper">
                <div class="ai-point-title">${endpointType === 'city' ? 'City' : 'Point'} AI Info:</div>
                <p class="ai-point-p">${p1}</p>
                ${p2 ? `<p class="ai-point-p">${p2}</p>` : ``}
                <div class="nearby-section-target"></div> 
            </div>
        `;

        // Point tabındaysak Nearby kısmını zorla başlat
                // Point tabındaysak Nearby kısmını zorla başlat
        if (endpointType === 'point') {
            // facts içinden koordinatları garantileyelim
            const latVal = facts?.__lat ??  facts?.lat;
            const lngVal = facts?.__lng ??  facts?.lng;
            
            console.log('[fetchSimpleAI] Point tab - checking coords:', { latVal, lngVal, facts });
            
            if (latVal !== undefined && lngVal !== undefined && ! isNaN(parseFloat(latVal)) && !isNaN(parseFloat(lngVal))) {
                const nearbyTarget = containerDiv.querySelector('.nearby-section-target');
                if (nearbyTarget) {
                    console.log('[fetchSimpleAI] Calling renderNearbyButtons');
                    renderNearbyButtons(parseFloat(latVal), parseFloat(lngVal), city, country, nearbyTarget);
                } else {
                    console.warn('[fetchSimpleAI] . nearby-section-target not found in containerDiv');
                }
            } else {
                console.warn('[fetchSimpleAI] Invalid coordinates for nearby search');
            }
        }

    } catch (e) {
        containerDiv.innerHTML = `<div style="color:#ef4444; padding:10px;">Connection error.</div>`;
    }
}



// YARDIMCI FONKSİYON: Alt tarafa butonları enjekte eder
function attachNearbySection(containerDiv, facts, city, country, cacheKey) {
    if (!facts || typeof facts.__lat !== 'number') return;

    const injectionPoint = containerDiv.querySelector('.nearby-injection-point');
    if (!injectionPoint) return;

    const nearbyHolderId = `nearby-area-${Math.random().toString(36).substr(2, 9)}`;
    injectionPoint.innerHTML = `
        <div id="${nearbyHolderId}" class="ai-nearby-buttons" style="margin-top:15px; border-top:1px solid #f1f5f9; padding-top:10px;">
            <div class="ai-nearby-title">📍 Nearby Exploration:</div>
            <div class="nearby-loader" style="color: #94a3b8; font-size: 0.7rem; padding: 5px;">Searching surroundings...</div>
        </div>
    `;

    fetch('/llm-proxy/nearby-ai', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: facts.__lat, lng: facts.__lng })
    })
    .then(res => res.json())
    .then(data => {
        const holder = document.getElementById(nearbyHolderId);
        if (!holder) return;

        if (data && (data.settlement || data.nature || data.historic)) {
            let btns = '';
            const cats = [
                { k: 'settlement', i: '🏙️', l: 'City' },
                { k: 'nature', i: '🌳', l: 'Nature' },
                { k: 'historic', i: '🏛️', l: 'Historic' }
            ];

            cats.forEach(c => {
                if (data[c.k]?.name) {
                    const safeName = data[c.k].name.replace(/'/g, "\\'");
                    btns += `
                        <button class="ai-nearby-btn" 
                            onclick="fetchSimpleAI('point', '${safeName}', '${city}', '${country}', {__lat:${facts.__lat}, __lng:${facts.__lng}}, this.closest('.ai-simple-content'))">
                            ${c.i} <b>${c.l}:</b> ${data[c.k].name}
                        </button>`;
                }
            });
            holder.innerHTML = `<div class="ai-nearby-title">📍 Nearby Exploration:</div>` + btns;
        } else {
            holder.remove(); // Hiçbir şey yoksa alanı temizle
        }
    })
    .catch(() => { if(document.getElementById(nearbyHolderId)) document.getElementById(nearbyHolderId).remove(); });
}

