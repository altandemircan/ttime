(function addAIStyles() {
    const styleId = 'tt-ai-simple-styles-en';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
        .ai-popup-simple { font-family: 'Satoshi', sans-serif; min-width: 280px; max-width: 320px; }
        .ai-simple-tabs { display: flex; border-bottom: 2px solid #f1f5f9; margin-bottom: 10px; gap: 4px; }
        .ai-simple-tab { 
            flex: 1; border: none; background: none; padding: 8px 2px; 
            font-size: 0.75rem; font-weight: 600; color: #94a3b8; 
            cursor: pointer; transition: all 0.2s; border-bottom: 2px solid transparent; margin-bottom: -2px;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ai-simple-tab.active { color: #8a4af3; border-bottom-color: #8a4af3; }
        .ai-simple-content { min-height: 120px; font-size: 0.85rem; color: #334155; line-height: 1.6; }
        .ai-nearby-btn { 
            display: block; width: 100%; background: #f8fafc; border: 1px solid #e2e8f0;
            padding: 10px; border-radius: 8px; margin-bottom: 8px;
            font-size: 0.8rem; color: #475569; cursor: pointer; text-align: left;
            transition: all 0.2s;
        }
        .ai-nearby-btn:hover { background: #f1f5f9; border-color: #cbd5e1; }
        .ai-simple-loading { padding: 30px; text-align: center; color: #94a3b8; }
        .ai-simple-footer { margin-top: 10px; font-size: 0.65rem; color: #cbd5e1; text-align: right; border-top: 1px solid #f8fafc; padding-top: 5px; }
        @keyframes spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
})();

async function getHierarchicalLocation(lat, lng) {
    try {
        const resp = await fetch(`/api/geoapify/reverse?lat=${lat}&lon=${lng}&limit=1`);
        const data = await resp.json();
        if (!data.features?.length) return null;
        const props = data.features[0].properties;
        return {
            specific: props.name || null,
            city: props.county || props.city || props.state || "Unknown",
            country: props.country || "",
            isJustAddress: !props.name && (!!props.street || !!props.housenumber),
            lat, lng
        };
    } catch (e) { return null; }
}

async function fetchSimpleAI(type, name, city, country, locData, container) {
    container.innerHTML = `<div class="ai-simple-loading"><div style="width:15px; height:15px; border:2px solid #ccc; border-top-color:#8a4af3; border-radius:50%; animation:spin 0.8s linear infinite; display:inline-block;"></div><br>Analyzing...</div>`;
    
    try {
        if (type === 'nearby') {
            const resp = await fetch('/llm-proxy/nearby-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lat: locData.lat, lng: locData.lng })
            });
            const data = await resp.json();
            
            if (!data.settlement && !data.nature && !data.historic) {
                container.innerHTML = `<div style="padding:20px; text-align:center; color:#94a3b8;">No significant landmarks found nearby.</div>`;
                return;
            }

            let html = `<div style="margin-top:5px;">`;
            const cats = [
                { k: 'settlement', i: '🏙️', l: 'Nearby City' },
                { k: 'nature', i: '🌳', l: 'Nature/Park' },
                { k: 'historic', i: '🏛️', l: 'Historic Site' }
            ];
            cats.forEach(c => {
                if (data[c.k]) {
                    html += `<button class="ai-nearby-btn" onclick="fetchSimpleAI('point', '${data[c.k].name.replace(/'/g, "\\'")}', '${city}', '${country}', {}, this.parentElement)">
                        ${c.i} <b>${c.l}:</b> ${data[c.k].name}
                    </button>`;
                }
            });
            container.innerHTML = html + `</div>`;
        } else {
            const url = type === 'city' ? '/llm-proxy/plan-summary' : '/llm-proxy/point-ai-info';
            const body = type === 'city' ? { city, country } : { point: name, city, country };
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const d = await resp.json();
            const p1 = d.p1 || d.summary || "No info.";
            const p2 = d.p2 || d.tip || d.highlight || "";
            container.innerHTML = `<div><strong style="display:block;margin-bottom:5px;color:#0f172a;">${name}</strong><p>${p1}</p>${p2 ? `<p style="margin-top:8px; padding-top:8px; border-top:1px dashed #eee;">${p2}</p>`:'' }</div>`;
        }
    } catch (e) {
        container.innerHTML = `<div style="color:#ef4444; padding:10px;">Connection failed.</div>`;
    }
}

async function handleMapAIClick(e) {
    const map = e.target;
    const popup = L.popup({ maxWidth: 320 }).setLatLng(e.latlng).setContent('<div style="padding:15px;">Locating...</div>').openOn(map);
    const loc = await getHierarchicalLocation(e.latlng.lat, e.latlng.lng);

    if (!loc || loc.isJustAddress) {
        popup.setContent('<div style="padding:20px; text-align:center; color:#64748b;">📍 <b>Residential/Unknown Area</b><br><small>Click on a landmark for AI insights.</small></div>');
        return;
    }

    const uiID = 'ai-ui-' + Date.now();
    let tabs = [];
    if (loc.specific) tabs.push({ id: 'point', label: `📍 ${loc.specific}`, name: loc.specific });
    tabs.push({ id: 'city', label: `🌍 ${loc.city}`, name: loc.city });
    tabs.push({ id: 'nearby', label: `🔍 Discovery`, name: 'Nearby' });

    const tabsHTML = tabs.map((t, i) => `<button class="ai-simple-tab ${i===0?'active':''}" data-id="${t.id}" data-name="${t.name}">${t.label}</button>`).join('');

    popup.setContent(`
        <div id="${uiID}" class="ai-popup-simple">
            <div class="ai-simple-tabs">${tabsHTML}</div>
            <div id="${uiID}-content" class="ai-simple-content"></div>
            <div class="ai-simple-footer">AI Travel Assistant</div>
        </div>
    `);

    setTimeout(() => {
        const container = document.getElementById(uiID);
        const content = document.getElementById(uiID + '-content');
        const btns = container.querySelectorAll('.ai-simple-tab');

        btns.forEach(btn => {
            btn.onclick = () => {
                btns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                fetchSimpleAI(btn.dataset.id, btn.dataset.name, loc.city, loc.country, loc, content);
            };
        });
        btns[0].click();
    }, 50);
}