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
        
        /* CONTENT */
        .ai-simple-content { min-height: 100px;
    font-size: 0.9rem;
    color: #334155;
    line-height: 1.8;
    font-weight: 400;
    text-align: left }
        .ai-simple-loading { padding: 20px; text-align: center; color: #94a3b8; font-size: 0.85rem; }
    .ai-point-title { font-weight: 700; color: #0f172a; margin: 0 0 8px 0; font-size: 0.85rem; }
        .ai-point-p { margin: 0 0 10px 0; }
        .ai-point-p:last-child { margin-bottom: 0; }
        .ai-simple-footer { margin-top: 8px; font-size: 0.7rem; color: #cbd5e1; text-align: right; border-top: 1px solid #f8fafc; padding-top: 5px;}
    `;
    document.head.appendChild(style);
})();

// 2. BASİT LOCATION PARSER - SADECE TEMEL BİLGİLER
async function getHierarchicalLocation(lat, lng) {
    try {
        const resp = await fetch(`/api/geoapify/reverse?lat=${lat}&lon=${lng}&limit=1`);
        if (!resp.ok) return null;

        const data = await resp.json();
        if (!data.features || data.features.length === 0) return null;

        const props = data.features[0].properties || {};

console.log("[GEOAPIFY] reverse result:", {
    lat, lng,
    formatted: props.formatted,
    name: props.name,
    city: props.city,
    county: props.county,
    district: props.district,
    city_district: props.city_district,
    suburb: props.suburb,
    municipality: props.municipality,
    state: props.state,
    state_district: props.state_district,
    province: props.province,
    region: props.region,
    postcode: props.postcode,
    street: props.street,
    housenumber: props.housenumber,
    country: props.country,
    country_code: props.country_code,
    lon: props.lon,
    lat: props.lat,
    // tamamen görmek için:
    _all: props
});

        const norm = (v) => (typeof v === "string" ? v.trim() : "");
        const looksLikeRegion = (v) => /region|bölgesi|bolgesi/i.test(norm(v));

        // 1) Nokta / mekan
        let specific = norm(props.name) || null;

        const street = norm(props.street);
        if (specific && (specific === street || /^\d/.test(specific))) specific = null;

       // 2) Şehir/il: TR'de çoğu zaman county = il (Antalya), city = ilçe (Kepez)
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

// 3. AI FETCH FUNCTION (Aynı)
const aiSimpleCache = {};


// 4. BASİT MAP CLICK HANDLER
// ... (Stiller ve getHierarchicalLocation aynı kalacak)

async function handleMapAIClick(e) {
    const map = e.target;
    const popup = L.popup({ maxWidth: 320 }).setLatLng(e.latlng).setContent('<div style="padding:10px; text-align:center;">Locating...</div>').openOn(map);
    const loc = await getHierarchicalLocation(e.latlng.lat, e.latlng.lng);
    if (!loc) { popup.setContent('<div style="padding:10px;">Location not found.</div>'); return; }

    const uiID = 'ai-' + Date.now();
    popup.setContent(`<div id="${uiID}" class="ai-popup-simple"><div class="ai-simple-tabs" id="${uiID}-tabs"></div><div id="${uiID}-content" class="ai-simple-content"></div><div class="ai-simple-footer">AI Travel Assistant</div></div>`);

    const tabsContainer = document.getElementById(uiID + '-tabs');
    const contentDiv = document.getElementById(uiID + '-content');

    // 1. Ana Sekmeleri Ekle (Point ve City)
    const addTabBtn = (name, endpoint, qCity, qCountry, qFacts, isActive = false) => {
        const btn = document.createElement('button');
        btn.className = `ai-simple-tab ${isActive ? 'active' : ''}`;
        btn.innerHTML = name;
        btn.onclick = (ev) => {
            tabsContainer.querySelectorAll('.ai-simple-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            fetchSimpleAI(endpoint, name.replace(/^[^\s]+\s/, ''), qCity, qCountry, qFacts, contentDiv);
        };
        tabsContainer.appendChild(btn);
        if (isActive) btn.click();
    };

    if (loc.specific) {
        addTabBtn(`📍 ${loc.specific}`, 'point', loc.city, loc.country, loc.facts, true);
    }
    addTabBtn(`🌍 ${loc.city || 'City'}`, 'city', loc.city, loc.country, loc.facts, !loc.specific);

    // 2. Yakın Yerleri Çek ve Sekme Olarak Ekle
    try {
        const resp = await fetch('/llm-proxy/nearby-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: e.latlng.lat, lng: e.latlng.lng })
        });
        const nearby = await resp.json();

        if (nearby.settlement) addTabBtn(`🏘️ ${nearby.settlement.name}`, 'point', nearby.settlement.city, nearby.settlement.country, nearby.settlement.facts);
        if (nearby.nature) addTabBtn(`🌿 ${nearby.nature.name}`, 'point', nearby.nature.city, nearby.nature.country, nearby.nature.facts);
        if (nearby.historic) addTabBtn(`🏛️ ${nearby.historic.name}`, 'point', nearby.historic.city, nearby.historic.country, nearby.historic.facts);
    } catch (err) { console.error("Nearby tabs failed", err); }
}

// fetchSimpleAI artık çok daha sade, nearby tetiklemiyor çünkü her şey bir sekme!
async function fetchSimpleAI(endpointType, queryName, city, country, facts, containerDiv) {
    const cacheKey = `${endpointType}__${queryName}`;
    if (aiSimpleCache[cacheKey]) { containerDiv.innerHTML = aiSimpleCache[cacheKey]; return; }

    containerDiv.innerHTML = `<div class="ai-simple-loading">Analyzing <b>${queryName}</b>...</div>`;

    try {
        const url = endpointType === 'city' ? '/llm-proxy/plan-summary' : '/llm-proxy/point-ai-info';
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ point: queryName, city, country, facts })
        });
        const data = await response.json();
        
        const p1 = data.p1 || data.summary || "Info not available.";
        const p2 = data.p2 || data.tip || "";

        const html = `<div style="animation:fadeIn 0.3s ease;"><div class="ai-point-title">AI Info:</div><p class="ai-point-p">${p1}</p>${p2 && p2 !== "Info not available." ? `<p class="ai-point-p">${p2}</p>` : ''}</div>`;
        
        aiSimpleCache[cacheKey] = html;
        containerDiv.innerHTML = html;
    } catch (e) {
        containerDiv.innerHTML = `<div style="color:#ef4444; padding:10px;">Connection Error.</div>`;
    }
}