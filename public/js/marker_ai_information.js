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
        .ai-simple-content { min-height: 100px; font-size: 0.9rem; color: #334155; line-height: 1.5; }
        .ai-simple-loading { padding: 20px; text-align: center; color: #94a3b8; font-size: 0.85rem; }
        .ai-info-row { margin-bottom: 6px; }
        .ai-label { font-weight: 700; color: #475569; margin-right: 5px; }
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
        if (data.features && data.features.length > 0) {
            const props = data.features[0].properties;
            
            // ÇOK BASİT İŞLETME KONTROLÜ: Sadece açık işletme kategorilerini filtrele
            const categories = (props.categories || '').toLowerCase();
            if (categories.includes('commercial.supermarket') ||
                categories.includes('commercial.convenience') ||
                categories.includes('healthcare.pharmacy') ||
                categories.includes('healthcare.doctor') ||
                categories.includes('healthcare.clinic') ||
                categories.includes('catering.fast_food') ||
                categories.includes('service.financial.bank') ||
                categories.includes('service.vehicle.car_repair')) {
                return null; // İşletme ise AI gösterme
            }
            
            // Sokak adı mı kontrol et (çok basit)
            const name = props.name || '';
            if (name && (name === props.street || /^\d+\s*\/?\s*\d*/.test(name))) {
                // Sokak adı ise specific'i boş bırak
                props.name = null;
            }
            
            // Normal pars işlemi
            let specific = props.name || null;
            let district = props.county || props.town || props.suburb || "";
            let province = props.city || props.state_district || props.province || "";
            const country = props.country || "";
            
            // Province bölge ise temizle
            if (/region|bölgesi|aegean|mediterranean/i.test(province)) {
                province = props.city || props.county || "";
            }
            
            // District ve province aynı ise
            if (district && province && district === province) {
                district = "City Center";
            }
            
            // Eğer sadece sokak adı varsa ve başka hiçbir şey yoksa, turistik değil
            if (!specific && !district && province) {
                return { specific: null, district: null, province, country, isJustAddress: true };
            }
            
            return { specific, district, province, country };
        }
    } catch (e) {
        console.error(e);
    }
    return null;
}

// 3. AI FETCH FUNCTION (Aynı)
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

// 4. BASİT MAP CLICK HANDLER
async function handleMapAIClick(e) {
    const map = e.target;
    
    // Spinner
    const popup = L.popup({ maxWidth: 320 }).setLatLng(e.latlng)
        .setContent('<div style="padding:10px; text-align:center; color:#64748b;">Acquiring location...</div>')
        .openOn(map);

    // Lokasyonu al
    const loc = await getHierarchicalLocation(e.latlng.lat, e.latlng.lng);
    
    // 1) Eğer null döndü (işletme ise) - basit mesaj göster
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
    
    // 2) Eğer sadece adres bilgisi varsa (sokak vs.)
    if (loc.isJustAddress) {
        popup.setContent(`
            <div style="padding:20px; text-align:center;">
                <div style="color:#475569; font-size:0.9rem; margin-bottom:10px;">
                    📍 ${loc.province || 'Location'}
                </div>
                <div style="color:#64748b; font-size:0.85rem;">
                    Click on named places (beaches, museums, parks) 
                    for detailed travel information.
                </div>
            </div>
        `);
        return;
    }
    
    // 3) NORMAL TURİSTİK YER İSE DEVAM
    
    // Tab butonlarını oluştur
    let tabsHTML = '';
    
    // TAB 1: Specific place (eğer varsa ve boş değilse)
    if (loc.specific && loc.specific.trim().length > 0) {
        tabsHTML += `<button class="ai-simple-tab active" 
            data-query="${loc.specific}" 
            data-context="${loc.specific}, ${loc.district}, ${loc.province}, ${loc.country}">
            📍 ${loc.specific}
        </button>`;
    }
    
    // TAB 2: District (eğer varsa ve province'den farklıysa)
    if (loc.district && loc.district.trim().length > 0 && loc.district !== loc.province) {
        const isActive = tabsHTML === '' ? 'active' : '';
        tabsHTML += `<button class="ai-simple-tab ${isActive}" 
            data-query="${loc.district}" 
            data-context="${loc.district}, ${loc.province}, ${loc.country}">
            🏙️ ${loc.district}
        </button>`;
    }
    
    // TAB 3: Province (her zaman)
    const isCityActive = tabsHTML === '' ? 'active' : '';
    tabsHTML += `<button class="ai-simple-tab ${isCityActive}" 
        data-query="${loc.province}" 
        data-context="${loc.province}, ${loc.country}">
        🌍 ${loc.province}
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
        if(!container) return;

        const contentDiv = document.getElementById(uiID + '-content');
        const buttons = container.querySelectorAll('.ai-simple-tab');

        buttons.forEach(btn => {
            btn.onclick = (evt) => {
                buttons.forEach(b => b.classList.remove('active'));
                evt.target.classList.add('active');
                
                const qName = evt.target.getAttribute('data-query');
                const qContext = evt.target.getAttribute('data-context');
                fetchSimpleAI(qName, qContext, contentDiv);
            };
        });

        // İlk tab'ı tetikle
        const activeBtn = container.querySelector('.ai-simple-tab.active');
        if (activeBtn) activeBtn.click();
    });
}