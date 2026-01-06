(function addEnglishAIStyles() {
    const styleId = 'tt-ai-simple-styles-en';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
        .ai-popup-simple { font-family: 'Satoshi', sans-serif; min-width: 280px; max-width: 320px; }
        .ai-simple-tabs { display: flex; border-bottom: 2px solid #f1f5f9; margin-bottom: 10px; }
        .ai-simple-tab { flex: 1; border: none; background: none; padding: 8px 4px; font-size: 0.8rem; font-weight: 600; color: #94a3b8; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; }
        .ai-simple-tab.active { color: #8a4af3; border-bottom-color: #8a4af3; }
        .ai-simple-content { min-height: 100px; font-size: 0.9rem; color: #334155; line-height: 1.8; text-align: left }
        .ai-point-title { font-weight: 700; color: #0f172a; margin: 0 0 8px 0; font-size: 0.85rem; }
        .nearby-btn { font-size: 0.7rem; padding: 4px 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; cursor: pointer; color: #64748b; font-weight: 600; }
        .nearby-btn:hover { border-color: #8a4af3; color: #8a4af3; }
    `;
    document.head.appendChild(style);
})();

async function getHierarchicalLocation(lat, lng) {
    try {
        const resp = await fetch(`/api/geoapify/reverse?lat=${lat}&lon=${lng}&limit=1`);
        const data = await resp.json();
        const props = data.features[0].properties || {};
        const norm = (v) => (typeof v === "string" ? v.trim() : "");
        let spec = norm(props.name);
        if (spec && (spec === norm(props.street) || /^\d/.test(spec))) spec = null;
        return { specific: spec, city: norm(props.county) || norm(props.city) || "Antalya", country: norm(props.country), facts: props };
    } catch (e) { return null; }
}

const aiSimpleCache = {};

async function fetchSimpleAI(endpointType, queryName, city, country, facts, containerDiv) {
    containerDiv.innerHTML = `<div style="padding:20px; text-align:center; color:#94a3b8;">Analyzing <b>${queryName}</b>...</div>`;
    try {
        const response = await fetch(endpointType === 'city' ? '/llm-proxy/plan-summary' : '/llm-proxy/point-ai-info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ point: queryName, city, country, facts })
        });
        const data = await response.json();
        const p1 = data.p1 || data.summary || "Info not available.";
        const p2 = data.p2 || data.tip || "";

        containerDiv.innerHTML = `
            <div style="animation: fadeIn 0.3s ease;">
                <div class="ai-point-title">AI Insight: ${queryName}</div>
                <p style="margin:0 0 10px 0;">${p1}</p>
                ${p2 ? `<p style="margin:0 0 10px 0; font-style:italic;">${p2}</p>` : ''}
            </div>
            <div id="nearby-container" style="margin-top:15px; border-top:1px dashed #e2e8f0; padding-top:10px;"></div>
        `;

        if (facts?.__lat) triggerNearbyTabs(facts, city, country, containerDiv);
    } catch (e) { containerDiv.innerHTML = "Timeout. Try again."; }
}

async function triggerNearbyTabs(facts, city, country, containerDiv) {
    const holder = document.getElementById('nearby-container');
    if (!holder) return;
    try {
        const resp = await fetch('/llm-proxy/nearby-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: facts.__lat, lng: facts.__lng })
        });
        const nearby = await resp.json();
        let html = '<div style="font-size:0.7rem; color:#94a3b8; margin-bottom:5px; font-weight:700;">NEARBY EXPLORE:</div><div style="display:flex; gap:4px; flex-wrap:wrap;">';
        
        const btn = (d) => d ? `<button class="nearby-btn" onclick="window.loadNearby('${d.name.replace(/'/g,"\\'")}', ${JSON.stringify(d.facts).replace(/"/g,'&quot;')})">${d.name}</button>` : '';
        
        html += btn(nearby.settlement) + btn(nearby.nature) + btn(nearby.historic) + '</div>';
        holder.innerHTML = html;

        window.loadNearby = (name, nFacts) => {
            const f = { ...nFacts, __lat: facts.__lat, __lng: facts.__lng };
            fetchSimpleAI('point', name, city, country, f, containerDiv);
        };
    } catch (e) { holder.remove(); }
}

async function handleMapAIClick(e) {
    const map = e.target;
    const popup = L.popup({ maxWidth: 320 }).setLatLng(e.latlng).setContent('Loading...').openOn(map);
    const loc = await getHierarchicalLocation(e.latlng.lat, e.latlng.lng);
    if (!loc) return;
    loc.facts.__lat = e.latlng.lat; loc.facts.__lng = e.latlng.lng;

    const uiID = 'ai-' + Date.now();
    popup.setContent(`<div id="${uiID}" class="ai-popup-simple"><div class="ai-simple-tabs" id="${uiID}-t"></div><div id="${uiID}-c" class="ai-simple-content"></div></div>`);

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