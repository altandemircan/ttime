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

async function fetchSimpleAI(endpointType, queryName, city, country, facts, containerDiv) {
    const cacheKey = `${endpointType}__${queryName}__${city}__${country}`;
    
    if (aiSimpleCache[cacheKey]) {
        containerDiv.innerHTML = aiSimpleCache[cacheKey];
        return;
    }

    containerDiv.innerHTML = `
        <div class="ai-simple-loading">
            <div class="spinner" style="display:inline-block; width:10px; height:10px; border:2px solid #ccc; border-top-color:#8a4af3; border-radius:50%; animation:spin 0.8s linear infinite;"></div>
            <div style="margin-top:5px">Analyzing: <b>${queryName}</b></div>
        </div>
    `; 

    try {
const url = endpointType === 'city' ? '/llm-proxy/plan-summary' : '/llm-proxy/point-ai-info';

const body =
    endpointType === 'city'
        ? { city, country }
        : { point: queryName, city, country, facts: facts || {} };

const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
});
const data = await response.json();

const norm = (s) => (typeof s === "string" ? s.trim() : "");
const isNoInfo = (s) => /^info not available\.?$/i.test(norm(s));

let p1 = "Info not available.";
let p2 = "";

if (endpointType === 'city') {
    // plan-summary -> 2 paragraf: summary + (tip ya da highlight)
    p1 = norm(data.summary) || "Info not available.";
    p2 = norm(data.tip) || norm(data.highlight) || "";
} else {
    // point-ai-info -> p1/p2
    p1 = norm(data.p1) || "Info not available.";
    p2 = norm(data.p2) || "";
}

if (isNoInfo(p2)) p2 = "";

const html = `
    <div style="animation: fadeIn 0.3s ease;">
        <div class="ai-point-title">Point AI Info:</div>
        <p class="ai-point-p">${p1}</p>
        ${p2 ? `<p class="ai-point-p">${p2}</p>` : ``}
    </div>
`;

       aiSimpleCache[cacheKey] = html;
containerDiv.innerHTML = html;

// Nearby AI sadece "point" tabında çalışsın
if (endpointType === 'point' && facts && typeof facts === 'object') {
    // lat/lng'yi facts içine koyacağız (aşağıda ekliyoruz)
    const nlat = facts.__lat;
    const nlng = facts.__lng;

    if (typeof nlat === 'number' && typeof nlng === 'number') {
        const nearbyHolderId = `nearby-${cacheKey.replace(/[^a-zA-Z0-9_-]/g, '')}`;
        containerDiv.insertAdjacentHTML('beforeend', `
            <div id="${nearbyHolderId}" style="margin-top:10px;">
                <p class="ai-point-p" style="color:#94a3b8;">Loading nearby places...</p>
            </div>
        `);

        try {
            const nearby = await fetchNearbyAI(nlat, nlng, city, country);

            const renderBlock = (title, obj) => {
                if (!obj || !obj.item) return `<p class="ai-point-p"><b>${title}:</b> Info not available.</p>`;
                const name = obj.item.name || 'Unknown';
                const p1 = (obj.ai && obj.ai.p1) ? obj.ai.p1 : "Info not available.";
                const p2 = (obj.ai && obj.ai.p2 && !/^info not available\.?$/i.test(obj.ai.p2.trim())) ? obj.ai.p2 : "";
                return `
                    <p class="ai-point-p"><b>${title}:</b> ${name}</p>
                    <p class="ai-point-p">${p1}</p>
                    ${p2 ? `<p class="ai-point-p">${p2}</p>` : ``}
                `;
            };

            const htmlNearby = `
                <div style="margin-top:10px;">
                    ${renderBlock("Nearest settlement", nearby.settlement)}
                    ${renderBlock("Nearest nature area", nearby.nature)}
                    ${renderBlock("Nearest historic site", nearby.historic)}
                </div>
            `;

            const holder = document.getElementById(nearbyHolderId);
            if (holder) holder.innerHTML = htmlNearby;
        } catch (err) {
            const holder = document.getElementById(nearbyHolderId);
            if (holder) holder.innerHTML = `<p class="ai-point-p" style="color:#ef4444;">Nearby lookup failed.</p>`;
        }
    }
}

    } catch (e) {
        containerDiv.innerHTML = `<div style="color:#ef4444; text-align:center; padding:10px; font-size:0.85rem;">Connection error.</div>`;
    }
}
async function fetchNearbyAI(lat, lng, city, country) {
    const response = await fetch('/llm-proxy/nearby-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, city, country })
    });
    return await response.json();
}
// 4. BASİT MAP CLICK HANDLER
async function handleMapAIClick(e) {
    const map = e.target;

    // Spinner
    const popup = L.popup({ maxWidth: 320 }).setLatLng(e.latlng)
        .setContent('<div style="padding:10px; text-align:center; color:#64748b;">Acquiring location...</div>')
        .openOn(map);

    // Lokasyonu al
    const loc = await getHierarchicalLocation(e.latlng.lat, e.latlng.lng);

    // 1) Eğer null döndü - basit mesaj göster
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

    // Nearby için lat/lng'yi facts'e ekle (yoksa oluştur)
    if (!loc.facts || typeof loc.facts !== 'object') loc.facts = {};
    loc.facts.__lat = e.latlng.lat;
    loc.facts.__lng = e.latlng.lng;

    // 2) Eğer sadece adres bilgisi varsa
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

    // Tab butonlarını oluştur (SADECE 2 TAB: Nokta + Şehir)
    let tabsHTML = '';

    // TAB 1: Nokta (mekan)
    if (loc.specific && loc.specific.trim().length > 0) {
        tabsHTML += `<button class="ai-simple-tab active"
            data-endpoint="point"
            data-query="${loc.specific}"
            data-city="${loc.city}"
            data-country="${loc.country}">
            📍 ${loc.specific}
        </button>`;
    }

    // TAB 2: Şehir
    const cityLabel = (loc.city && loc.city.trim().length > 0) ? loc.city : 'City';
    const isCityActive = tabsHTML === '' ? 'active' : '';

    tabsHTML += `<button class="ai-simple-tab ${isCityActive}"
        data-endpoint="city"
        data-query="${cityLabel}"
        data-city="${cityLabel}"
        data-country="${loc.country}">
        🌍 ${cityLabel}
    </button>`;

    // UI oluştur
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

    // Tab interaksiyonu
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

        // İlk tab'ı tetikle
        const activeBtn = container.querySelector('.ai-simple-tab.active');
        if (activeBtn) activeBtn.click();
    });
}