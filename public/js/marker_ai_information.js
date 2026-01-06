// =========================================================================
// === AI MAP INTERACTION (ENGLISH - POINT ONLY) ===
// =========================================================================

// 1. CSS STYLES (same)
(function addEnglishAIStyles() {
    const styleId = 'tt-ai-simple-styles-en';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
        .ai-popup-simple { font-family: 'Satoshi', sans-serif; min-width: 280px; max-width: 320px; }

        /* TABS (kept but will be single-tab) */
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
        .ai-simple-content {
            min-height: 100px;
            font-size: 0.9rem;
            color: #334155;
            line-height: 1.8;
            font-weight: 400;
            text-align: left;
        }
        .ai-simple-loading { padding: 20px; text-align: center; color: #94a3b8; font-size: 0.85rem; }
        .ai-point-title { font-weight: 700; color: #0f172a; margin: 0 0 8px 0; font-size: 0.85rem; }
        .ai-point-p { margin: 0 0 10px 0; }
        .ai-point-p:last-child { margin-bottom: 0; }
        .ai-simple-footer { margin-top: 8px; font-size: 0.7rem; color: #cbd5e1; text-align: right; border-top: 1px solid #f8fafc; padding-top: 5px;}
    `;
    document.head.appendChild(style);
})();

// 2. BASIC LOCATION PARSER
async function getHierarchicalLocation(lat, lng) {
    try {
        const resp = await fetch(`/api/geoapify/reverse?lat=${lat}&lon=${lng}&limit=1`);
        if (!resp.ok) return null;

        const data = await resp.json();
        if (!data.features || data.features.length === 0) return null;

        const props = data.features[0].properties || {};
        const norm = (v) => (typeof v === "string" ? v.trim() : "");
        const looksLikeRegion = (v) => /region|bölgesi|bolgesi/i.test(norm(v));

        let specific = norm(props.name) || null;

        const street = norm(props.street);
        if (specific && (specific === street || /^\d/.test(specific))) specific = null;

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

// 3. AI FETCH (POINT ONLY)
const aiSimpleCache = {};

async function fetchSimpleAI(queryName, city, country, facts, containerDiv) {
    const cacheKey = `point__${queryName}__${city}__${country}`;

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
        const url = '/llm-proxy/point-ai-info';
        const body = { point: queryName, city, country, facts: facts || {} };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        const norm = (s) => (typeof s === "string" ? s.trim() : "");
        const isNoInfo = (s) => /^info not available\.?$/i.test(norm(s));

        let p1 = norm(data.p1) || "Info not available.";
        let p2 = norm(data.p2) || "";
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

        // Nearby AI
        if (facts && typeof facts === 'object') {
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
                        const pp1 = (obj.ai && obj.ai.p1) ? obj.ai.p1 : "Info not available.";
                        const pp2 = (obj.ai && obj.ai.p2 && !/^info not available\.?$/i.test((obj.ai.p2 || '').trim())) ? obj.ai.p2 : "";
                        return `
                            <p class="ai-point-p"><b>${title}:</b> ${name}</p>
                            <p class="ai-point-p">${pp1}</p>
                            ${pp2 ? `<p class="ai-point-p">${pp2}</p>` : ``}
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

    if (!response.ok) {
        const text = await response.text();
        throw new Error(text);
    }

    return await response.json();
}

// 4. MAP CLICK HANDLER (POINT ONLY)
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

    if (loc.isJustAddress || !loc.specific) {
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

    // Single-tab UI
    const uiID = 'ai-ui-' + Date.now();
    const contentHTML = `
        <div id="${uiID}" class="ai-popup-simple">
            <div class="ai-simple-tabs">
                <button class="ai-simple-tab active"
                    data-query="${loc.specific}"
                    data-city="${loc.city}"
                    data-country="${loc.country}">
                    📍 ${loc.specific}
                </button>
            </div>
            <div id="${uiID}-content" class="ai-simple-content"></div>
            <div class="ai-simple-footer">AI Travel Assistant</div>
        </div>
    `;

    popup.setContent(contentHTML);

    requestAnimationFrame(() => {
        const contentDiv = document.getElementById(uiID + '-content');
        if (!contentDiv) return;
        fetchSimpleAI(loc.specific, loc.city, loc.country, loc.facts, contentDiv);
    });
}