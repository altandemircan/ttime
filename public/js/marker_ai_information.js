(function addAIStyles() {
    const styleId = 'tt-ai-simple-styles-en';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
        .ai-popup-simple { font-family: 'Satoshi', sans-serif; min-width: 280px; max-width: 320px; }
        .ai-simple-tabs { display: flex; border-bottom: 2px solid #f1f5f9; margin-bottom: 10px; }
        .ai-simple-tab { 
            flex: 1; border: none; background: none; padding: 8px 4px; 
            font-size: 0.8rem; font-weight: 600; color: #94a3b8; cursor: pointer; border-bottom: 2px solid transparent; 
            margin-bottom: -2px; transition: all 0.2s;
        }
        .ai-simple-tab.active { color: #8a4af3; border-bottom-color: #8a4af3; }
        .ai-simple-content { min-height: 100px; font-size: 0.9rem; color: #334155; line-height: 1.6; text-align: left }
        .ai-simple-loading { padding: 20px; text-align: center; color: #94a3b8; font-size: 0.85rem; }
        .ai-point-title { font-weight: 700; color: #0f172a; margin: 0 0 8px 0; font-size: 0.85rem; }
        .ai-point-p { margin: 0 0 10px 0; }
        .ai-simple-footer { margin-top: 8px; font-size: 0.7rem; color: #cbd5e1; text-align: right; border-top: 1px solid #f8fafc; padding-top: 5px;}
        .nearby-btn { 
            font-size: 0.7rem; padding: 4px 8px; background: #f8fafc; border: 1px solid #e2e8f0; 
            border-radius: 4px; cursor: pointer; color: #64748b; font-weight: 600;
        }
        .nearby-btn:hover { background: #f1f5f9; color: #8a4af3; }
    `;
    document.head.appendChild(style);
})();

async function getHierarchicalLocation(lat, lng) {
    try {
        const resp = await fetch(`/api/geoapify/reverse?lat=${lat}&lon=${lng}&limit=1`);
        if (!resp.ok) return null;
        const data = await resp.json();
        const props = data.features?.[0]?.properties || {};
        return { 
            specific: props.name || null, 
            city: props.county || props.state || props.city || "", 
            country: props.country || "", 
            facts: props 
        };
    } catch (e) { return null; }
}

const aiSimpleCache = {};

async function fetchSimpleAI(endpoint, name, city, country, facts, containerDiv) {
    const cacheKey = `${endpoint}__${name}`;
    if (aiSimpleCache[cacheKey]) {
        containerDiv.innerHTML = aiSimpleCache[cacheKey];
        if (endpoint === 'point') triggerNearbyTabs(facts, city, country, containerDiv);
        return;
    }

    containerDiv.innerHTML = `<div class="ai-simple-loading">Analyzing <b>${name}</b>...</div>`;

    try {
        const resp = await fetch(endpoint === 'city' ? '/llm-proxy/plan-summary' : '/llm-proxy/point-ai-info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ point: name, city, country, facts })
        });
        const data = await resp.json();

        const html = `
            <div style="animation:fadeIn 0.3s ease;">
                <div class="ai-point-title">AI Insight: ${name}</div>
                <p class="ai-point-p">${data.p1 || data.summary || "No info."}</p>
                ${(data.p2 || data.tip) ? `<p class="ai-point-p">${data.p2 || data.tip}</p>` : ''}
            </div>
            <div id="nearby-tabs-container" style="margin-top:15px; border-top:1px dashed #eee; padding-top:10px;"></div>
        `;
        containerDiv.innerHTML = html;
        aiSimpleCache[cacheKey] = html;

        if (endpoint === 'point') triggerNearbyTabs(facts, city, country, containerDiv);
    } catch (e) { containerDiv.innerHTML = "Timeout error."; }
}

async function triggerNearbyTabs(facts, city, country, containerDiv) {
    const holder = document.getElementById('nearby-tabs-container');
    if (!holder) return;

    try {
        const lat = facts.__lat || facts.lat;
        const lng = facts.__lng || facts.lon;
        const resp = await fetch('/llm-proxy/nearby-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lng })
        });
        const nearby = await resp.json();

        let btns = '<div style="font-size:0.7rem; color:#94a3b8; margin-bottom:5px;">EXPLORE NEARBY:</div><div style="display:flex; gap:5px; flex-wrap:wrap;">';
        
        const addBtn = (obj) => {
            if (!obj) return '';
            const fAttr = JSON.stringify(obj.facts).replace(/"/g, '&quot;');
            return `<button class="nearby-btn" onclick="window.loadNearby('${obj.name.replace(/'/g, "\\'")}', ${fAttr})">${obj.name}</button>`;
        };

        btns += addBtn(nearby.settlement) + addBtn(nearby.nature) + addBtn(nearby.historic) + '</div>';
        holder.innerHTML = btns;

        window.loadNearby = (name, nFacts) => {
            fetchSimpleAI('point', name, city, country, { ...nFacts, __lat: lat, __lng: lng }, containerDiv);
        };
    } catch (e) { holder.remove(); }
}

async function handleMapAIClick(e) {
    const map = e.target;
    const popup = L.popup({ maxWidth: 320 }).setLatLng(e.latlng).setContent('<div style="padding:10px;">Loading...</div>').openOn(map);
    const loc = await getHierarchicalLocation(e.latlng.lat, e.latlng.lng);
    if (!loc) return;
    loc.facts.__lat = e.latlng.lat; loc.facts.__lng = e.latlng.lng;

    const uiID = 'ai-' + Date.now();
    popup.setContent(`<div id="${uiID}" class="ai-popup-simple"><div class="ai-simple-tabs" id="${uiID}-t"></div><div id="${uiID}-c" class="ai-simple-content"></div><div class="ai-simple-footer">AI Travel Assistant</div></div>`);

    const tDiv = document.getElementById(uiID + '-t');
    const cDiv = document.getElementById(uiID + '-c');

    const makeTab = (label, endp, active = false) => {
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

    if (loc.specific) makeTab(`📍 ${loc.specific}`, 'point', true);
    makeTab(`🌍 ${loc.city || 'City'}`, 'city', !loc.specific);
}