// =========================================================================
// === AI MAP INTERACTION (ENGLISH - 3 TABS) ===
// =========================================================================

// 1. CSS STYLES (Aynı kalacak)

// 1. CSS STYLES
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
        .ai-simple-content { min-height: 100px; font-size: 0.9rem; color: #334155; line-height: 1.8; font-weight: 400; text-align: left }
        .ai-simple-loading { padding: 20px; text-align: center; color: #94a3b8; font-size: 0.85rem; }
        .ai-point-title { font-weight: 700; color: #0f172a; margin: 0 0 8px 0; font-size: 0.85rem; }
        .ai-point-p { margin: 0 0 10px 0; }
        .ai-point-p:last-child { margin-bottom: 0; }
        .ai-simple-footer { margin-top: 8px; font-size: 0.7rem; color: #cbd5e1; text-align: right; border-top: 1px solid #f8fafc; padding-top: 5px;}
        
        /* NEARBY BUTTONS */
        .nearby-btn { 
            font-size: 0.7rem; padding: 5px 10px; background: #f8fafc; border: 1px solid #e2e8f0; 
            border-radius: 6px; cursor: pointer; color: #64748b; font-weight: 600; transition: all 0.2s;
            margin-right: 5px; margin-bottom: 5px;
        }
        .nearby-btn:hover { background: #f1f5f9; color: #8a4af3; border-color: #8a4af3; }
    `;
    document.head.appendChild(style);
})();

async function getHierarchicalLocation(lat, lng) {
    try {
        const resp = await fetch(`/api/geoapify/reverse?lat=${lat}&lon=${lng}&limit=1`);
        if (!resp.ok) return null;
        const data = await resp.json();
        if (!data.features || data.features.length === 0) return null;
        const props = data.features[0].properties || {};
        const norm = (v) => (typeof v === "string" ? v.trim() : "");
        let specific = norm(props.name) || null;
        if (specific && (specific === norm(props.street) || /^\d/.test(specific))) specific = null;
        let city = norm(props.county) || norm(props.state) || norm(props.city) || "";
        return { specific, city, country: norm(props.country), isJustAddress: !specific, facts: props };
    } catch (e) { return null; }
}

const aiSimpleCache = {};

// 3. AI FETCH FUNCTION
async function fetchSimpleAI(endpointType, queryName, city, country, facts, containerDiv) {
    const cacheKey = `${endpointType}__${queryName}__${city}`;
    if (aiSimpleCache[cacheKey]) {
        containerDiv.innerHTML = aiSimpleCache[cacheKey];
        if (endpointType === 'point' && facts?.__lat) triggerNearbyTabs(facts, city, country, containerDiv);
        return;
    }

    containerDiv.innerHTML = `<div class="ai-simple-loading">Analyzing <b>${queryName}</b>...</div>`;

    try {
        const url = endpointType === 'city' ? '/llm-proxy/plan-summary' : '/llm-proxy/point-ai-info';
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ point: queryName, city, country, facts })
        });
        const data = await response.json();

        // [object Object] hatasını önlemek için string kontrolü
        const ensureStr = (v) => {
            if (!v) return "";
            if (typeof v === 'object') return JSON.stringify(v).replace(/[{}"]/g, ' ');
            return String(v).trim();
        };
        
        const p1 = ensureStr(data.p1 || data.summary || "Info not available.");
        const p2 = ensureStr(data.p2 || data.tip || data.highlight || "");

        const contentHTML = `
            <div style="animation: fadeIn 0.3s ease;">
                <div class="ai-point-title">AI Insight: ${queryName}</div>
                <p class="ai-point-p">${p1}</p>
                ${p2 && !p2.toLowerCase().includes("not available") ? `<p class="ai-point-p">${p2}</p>` : ``}
            </div>
            <div id="nearby-tabs-container" style="margin-top:15px; border-top:1px dashed #e2e8f0; padding-top:10px;"></div>
        `;

        containerDiv.innerHTML = contentHTML;
        aiSimpleCache[cacheKey] = contentHTML;

        // Sadece Point tabında ve koordinat varsa alt tabları tetikle
        if (endpointType === 'point' && facts?.__lat) {
            triggerNearbyTabs(facts, city, country, containerDiv);
        }
    } catch (e) {
        containerDiv.innerHTML = `<div style="color:#ef4444; padding:10px;">Timeout. Please try again.</div>`;
    }
}

async function triggerNearbyTabs(facts, city, country, containerDiv) {
    const holder = document.getElementById('nearby-tabs-container');
    if (!holder) return;

    try {
        const lat = facts.__lat;
        const lng = facts.__lng;
        const resp = await fetch('/llm-proxy/nearby-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lng })
        });
        const nearby = await resp.json();

        let buttonsHTML = '<div style="font-size:0.75rem; color:#94a3b8; margin-bottom:8px; font-weight:700;">NEARBY EXPLORE:</div><div style="display:flex; gap:2px; flex-wrap:wrap;">';
        
        const createBtn = (data) => {
            if (!data || !data.name) return '';
            const escapedName = data.name.replace(/'/g, "\\'");
            const factsAttr = JSON.stringify(data.facts).replace(/"/g, '&quot;');
            return `<button class="nearby-btn" onclick="window.loadNearbyIntoAI('${escapedName}', ${factsAttr})">${data.name}</button>`;
        };

        const b1 = createBtn(nearby.settlement);
        const b2 = createBtn(nearby.nature);
        const b3 = createBtn(nearby.historic);

        if (!b1 && !b2 && !b3) { holder.remove(); return; }

        buttonsHTML += b1 + b2 + b3 + '</div>';
        holder.innerHTML = buttonsHTML;

        window.loadNearbyIntoAI = (name, nearbyFacts) => {
            const newFacts = { ...nearbyFacts, __lat: facts.__lat, __lng: facts.__lng };
            fetchSimpleAI('point', name, city, country, newFacts, containerDiv);
        };
    } catch (e) { holder.remove(); }
}

// 4. BASİT MAP CLICK HANDLER
async function handleMapAIClick(e) {
    const map = e.target;
    const popup = L.popup({ maxWidth: 320 }).setLatLng(e.latlng).setContent('Loading...').openOn(map);
    const loc = await getHierarchicalLocation(e.latlng.lat, e.latlng.lng);
    if (!loc) return;
    loc.facts.__lat = e.latlng.lat; loc.facts.__lng = e.latlng.lng;

    const uiID = 'ai-' + Date.now();
    popup.setContent(`<div id="${uiID}" class="ai-popup-simple"><div class="ai-simple-tabs" id="${uiID}-t"></div><div id="${uiID}-c" class="ai-simple-content"></div><div class="ai-simple-footer">AI Travel Assistant</div></div>`);

    const tDiv = document.getElementById(uiID + '-t');
    const cDiv = document.getElementById(uiID + '-c');

    const addTab = (label, endp, active = false) => {
        const b = document.createElement('button');
        b.className = `ai-simple-tab ${active ? 'active' : ''}`;
        b.innerHTML = label;
        b.onclick = () => {
            tDiv.querySelectorAll('.ai-simple-tab').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            fetchSimpleAI(endp, label.replace(/^[^\s]+\s/, ''), loc.city, loc.country, loc.facts, cDiv);
        };
        tDiv.appendChild(b);
        if (active) b.click();
    };

    if (loc.specific) addTab(`📍 ${loc.specific}`, 'point', true);
    addTab(`🌍 ${loc.city}`, 'city', !loc.specific);
}