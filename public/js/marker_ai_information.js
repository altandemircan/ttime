




// =========================================================================
// === AI MAP INTERACTION (ENGLISH - 3 TABS) ===
// =========================================================================

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
        .ai-simple-content { min-height: 100px; font-size: 0.9rem; color: #334155; line-height: 1.5; }
        .ai-simple-loading { padding: 20px; text-align: center; color: #94a3b8; font-size: 0.85rem; }
        .ai-info-row { margin-bottom: 6px; }
        .ai-label { font-weight: 700; color: #475569; margin-right: 5px; }
        .ai-simple-footer { margin-top: 8px; font-size: 0.7rem; color: #cbd5e1; text-align: right; border-top: 1px solid #f8fafc; padding-top: 5px;}
    `;
    document.head.appendChild(style);
})();

// 2. LOCATION PARSER (Place > District > Province)
async function getHierarchicalLocation(lat, lng) {
    try {
        const resp = await fetch(`/api/geoapify/reverse?lat=${lat}&lon=${lng}&limit=1`);
        if (!resp.ok) return null;

        const data = await resp.json();
        if (data.features && data.features.length > 0) {
            const props = data.features[0].properties;

            // 1) SPECIFIC PLACE (e.g. Bodrum Castle)
            let specific = props.name || null;
            if (specific && (specific === props.street || /^\d/.test(specific))) specific = null;

            // 2) DISTRICT (e.g. Muratpaşa)
            let district = props.county || props.town || props.suburb || "";

            // Helper: Geoapify bazen state alanına "Mediterranean Region" gibi bölge basıyor
            const looksLikeRegion = (v) => !!v && /region|bölgesi|bolgesi/i.test(v);

            // 3) PROVINCE / CITY (e.g. Antalya)
            // Öncelik: city/state_district -> province -> (en son) state (ama region değilse)
            let province =
                props.city ||
                props.state_district ||
                props.province ||
                "";

            // province hala yoksa: state'i sadece region değilse kullan
            if (!province && props.state && !looksLikeRegion(props.state)) {
                province = props.state;
            }

            // guard: province yanlışlıkla region olduysa city/county ile düzelt
            if (looksLikeRegion(province)) {
                province = props.city || props.county || "";
            }

            // Fix overlap: District name equals Province name
            if (district && province && district === province) district = "City Center";

            const country = props.country || "";

            return { specific, district, province, country };
        }
    } catch (e) {
        console.error(e);
    }
    return null;
}
// 3. AI FETCH FUNCTION
const aiSimpleCache = {};

async function fetchSimpleAI(queryName, fullContext, containerDiv) {
    const cacheKey = fullContext;
    
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
        // We send the full context string to the backend
        const response = await fetch('/llm-proxy/plan-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ city: fullContext, country: "" }) 
        });

        const data = await response.json();
        
        const html = `
            <div style="animation: fadeIn 0.3s ease;">
                <div class="ai-info-row"><span class="ai-label">📝 Summary:</span>${data.summary || 'No info available.'}</div>
                ${data.tip ? `<div class="ai-info-row"><span class="ai-label">💡 Tip:</span>${data.tip}</div>` : ''}
                ${data.highlight ? `<div class="ai-info-row"><span class="ai-label">✨ Highlight:</span>${data.highlight}</div>` : ''}
            </div>
        `;

        aiSimpleCache[cacheKey] = html;
        containerDiv.innerHTML = html;

    } catch (e) {
        containerDiv.innerHTML = `<div style="color:#ef4444; text-align:center; padding:10px; font-size:0.85rem;">Connection error.</div>`;
    }
}

// 4. MAP CLICK HANDLER
async function handleMapAIClick(e) {
    const map = e.target;
    
    // A) Initial Spinner
    const popup = L.popup({ maxWidth: 320 }).setLatLng(e.latlng)
        .setContent('<div style="padding:10px; text-align:center; color:#64748b;">Acquiring location...</div>')
        .openOn(map);

    // B) Fetch Location Data
    const loc = await getHierarchicalLocation(e.latlng.lat, e.latlng.lng);
    
    if (!loc) {
        popup.setContent('<div style="padding:10px; color:#ef4444;">Location not found.</div>');
        return;
    }

    // C) Prepare Tab Buttons
    // Context: "Place, District, Province, Country"
    
    let tabsHTML = '';
    let firstActiveTab = '';
    
    // TAB 1: SPECIFIC PLACE (If exists)
    if (loc.specific) {
        tabsHTML += `<button class="ai-simple-tab active" 
            data-query="${loc.specific}" 
            data-context="${loc.specific}, ${loc.district}, ${loc.province}, ${loc.country}">
            📍 ${loc.specific}
        </button>`;
        firstActiveTab = 'specific';
    }

    // TAB 2: DISTRICT (If exists)
    if (loc.district) {
        const isActive = !firstActiveTab ? 'active' : ''; 
        if (!firstActiveTab) firstActiveTab = 'district';
        
        tabsHTML += `<button class="ai-simple-tab ${isActive}" 
            data-query="${loc.district}" 
            data-context="${loc.district}, ${loc.province}, ${loc.country}">
            🏙️ ${loc.district}
        </button>`;
    }

    // TAB 3: PROVINCE (Always)
    const isCityActive = !firstActiveTab ? 'active' : '';
    tabsHTML += `<button class="ai-simple-tab ${isCityActive}" 
        data-query="${loc.province}" 
        data-context="${loc.province}, ${loc.country}">
        🌍 ${loc.province}
    </button>`;

    // D) Create Popup Content
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

    // E) Start Interaction
    requestAnimationFrame(() => {
        const container = document.getElementById(uiID);
        if(!container) return;

        const contentDiv = document.getElementById(uiID + '-content');
        const buttons = container.querySelectorAll('.ai-simple-tab');

        buttons.forEach(btn => {
            btn.onclick = (evt) => {
                // Switch Tab
                buttons.forEach(b => b.classList.remove('active'));
                evt.target.classList.add('active');
                
                // Fetch Data
                const qName = evt.target.getAttribute('data-query');
                const qContext = evt.target.getAttribute('data-context');
                fetchSimpleAI(qName, qContext, contentDiv);
            };
        });

        // Trigger First Tab
        const activeBtn = container.querySelector('.ai-simple-tab.active');
        if (activeBtn) activeBtn.click();
    });
}