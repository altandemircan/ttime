// Typewriter efekti, her harf için delay uygular
function typeWriterEffect(element, text, speed = 18, callback) {
    let i = 0;
    element.innerHTML = "🤖 "; // Emoji sabit başta!
    function type() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, speed);
        } else if (callback) {
            callback();
        }
    }
    type();
}
// Şehir seçince çağrılır: AI başlasın, ilk karakter gelince plan aktifleşsin
function onCitySelected(city) {
    let planAktif = false;
        window.lastTripAIInfo = null;

    insertTripAiInfo(() => {
        if (!planAktif) {
            insertTripPlan(city);
            planAktif = true;
        }
    });
} 

// JSON stringten sadece ilk {...} bloğunu çek, kapanış } yoksa sona kadar al
function extractFirstJson(str) {
    const start = str.indexOf('{');
    const end = str.lastIndexOf('}');
    if (start !== -1) {
        // Kapanış } yoksa sona kadar al
        return str.substring(start, (end !== -1 && end > start) ? end + 1 : undefined);
    }
    return "";
}
// insertTripAiInfo başına ek: global token
window.__aiInfoRequestToken = window.__aiInfoRequestToken || null;

window.insertTripAiInfo = async function(onFirstToken, aiStaticInfo = null, cityOverride = null) {
    document.querySelectorAll('.ai-info-section').forEach(el => el.remove());

    const tripTitleDiv = document.getElementById('trip_title');
    if (!tripTitleDiv) return;

    const currentTripKey = window.activeTripKey;           // aktif gezi
    const currentCity    = window.selectedCity;

    let city = cityOverride || (window.selectedCity || '').replace(/ trip plan.*$/i, '').trim();
    let country = (window.selectedLocation && window.selectedLocation.country) || "";
    if (!city && !aiStaticInfo) return;

    // Yeni istek için token üret
    const token = `${Date.now()}_${Math.random()}`;
    window.__aiInfoRequestToken = token;

    const aiDiv = document.createElement('div');
    aiDiv.className = 'ai-info-section';
    aiDiv.innerHTML = `
      <h3 id="ai-toggle-header" style="display:flex;align-items:center;justify-content:space-between;">
        <span>AI Information</span>
        <span id="ai-spinner" style="margin-left:10px;display:inline-block;">
          <svg width="22" height="22" viewBox="0 0 40 40" style="vertical-align:middle;">
            <circle cx="20" cy="20" r="16" fill="none" stroke="#888" stroke-width="4" stroke-linecap="round" stroke-dasharray="80" stroke-dashoffset="60">
              <animateTransform attributeName="transform" type="rotate" repeatCount="indefinite" dur="1s" keyTimes="0;1" values="0 20 20;360 20 20"/>
            </circle>
          </svg>
        </span>
      </h3>
      <div class="ai-info-content" style="max-height:0;opacity:0;overflow:hidden;transition:max-height 0.2s,opacity 0.2s;">
        <p><b>🧳 Summary:</b> <span id="ai-summary"></span></p>
        <p><b>👉 Tip:</b> <span id="ai-tip"></span></p>
        <p><b>🔆 Highlight:</b> <span id="ai-highlight"></span></p>
      </div>
      <div class="ai-info-time" style="opacity:.6;font-size:13px;"></div>
    `;
    tripTitleDiv.insertAdjacentElement('afterend', aiDiv);

    const aiSummary  = aiDiv.querySelector('#ai-summary');
    const aiTip      = aiDiv.querySelector('#ai-tip');
    const aiHighlight= aiDiv.querySelector('#ai-highlight');
    const aiTime     = aiDiv.querySelector('.ai-info-time');
    const aiSpinner  = aiDiv.querySelector('#ai-spinner');
    const aiContent  = aiDiv.querySelector('.ai-info-content');

    function cleanText(text) { return (text || "").replace(/🤖/g, '').replace(/AI:/g, '').trim(); }

    function populateAndShow(data, timeElapsed = null) {
        // Yanıt geldiğinde hâlâ aynı trip ve aynı token mı?
        if (token !== window.__aiInfoRequestToken) return;
        if (currentTripKey && window.activeTripKey !== currentTripKey) return;

        if (aiSpinner) aiSpinner.style.display = "none";

        // toggle butonu ekle (mevcut kod aynen)
        if (!aiDiv.querySelector('#ai-toggle-btn')) {
            const btn = document.createElement('button');
            btn.id = "ai-toggle-btn";
            btn.className = "arrow-btn";
            btn.style = "border:none;background:transparent;font-size:18px;cursor:pointer;padding:0 10px;";
            btn.innerHTML = `<img src="https://www.svgrepo.com/show/520912/right-arrow.svg" class="arrow-icon open" style="width:18px;vertical-align:middle;transition:transform 0.2s;">`;
            aiDiv.querySelector('#ai-toggle-header').appendChild(btn);
            const aiIcon = btn.querySelector('.arrow-icon');
            let expanded = true;
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                expanded = !expanded;
                if (expanded) {
                    aiContent.style.maxHeight = "1200px";
                    aiContent.style.opacity = "1";
                    aiIcon.classList.add('open');
                } else {
                    aiContent.style.maxHeight = "0";
                    aiContent.style.opacity = "0";
                    aiIcon.classList.remove('open');
                }
            });
            if (aiIcon) aiIcon.classList.add('open');
        }

        aiContent.style.maxHeight = "1200px";
        aiContent.style.opacity   = "1";

        const txtSummary   = cleanText(data.summary)   || "Info not available.";
        const txtTip       = cleanText(data.tip)       || "Info not available.";
        const txtHighlight = cleanText(data.highlight) || "Info not available.";

        aiSummary.textContent   = txtSummary;
        aiTip.textContent       = txtTip;
        aiHighlight.textContent = txtHighlight;
        aiTime.textContent      = timeElapsed ? `⏱️ Generated in ${timeElapsed} ms` : "";

        // Sonuçları sadece doğru trip için kaydet
        if (currentTripKey && window.activeTripKey === currentTripKey) {
            window.cart = window.cart || [];
            window.cart.aiData = data;
            window.lastTripAIInfo = data;
            if (typeof saveCurrentTripToStorage === "function") saveCurrentTripToStorage({ withThumbnail: false, delayMs: 0 });
        }
    }

    // Statik veri varsa doğrudan bas
    if (aiStaticInfo) {
        populateAndShow(aiStaticInfo, null);
        return;
    }

    // API çağrısı
    const t0 = performance.now();
    try {
        const resp = await fetch('/llm-proxy/plan-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ city, country })
        });
        const ollamaData = await resp.json();
        const elapsed = Math.round(performance.now() - t0);

        const aiData = {
            city,
            summary: ollamaData.summary,
            tip: ollamaData.tip,
            highlight: ollamaData.highlight,
            time: elapsed
        };

        populateAndShow(aiData, elapsed);
    } catch (e) {
        // Hata olursa, token kontrolü yine de gerekli
        if (token === window.__aiInfoRequestToken && aiTime) {
            aiTime.innerHTML = "<span style='color:red'>AI info could not be retrieved.</span>";
            if (aiSpinner) aiSpinner.style.display = "none";
        }
        console.error("AI Error:", e);
    }
};













// =========================================================================
// === NET VE BASİT: YER - İLÇE - İL (3 TABLI YAPI) ===
// =========================================================================

// 1. CSS (Sade ve anlaşılır)
(function addSimpleAIStyles() {
    const styleId = 'tt-ai-simple-styles';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
        .ai-popup-simple { font-family: 'Satoshi', sans-serif; min-width: 280px; max-width: 320px; }
        
        /* TAB YAPISI */
        .ai-simple-tabs { display: flex; border-bottom: 2px solid #f1f5f9; margin-bottom: 10px; }
        .ai-simple-tab { 
            flex: 1; border: none; background: none; padding: 8px 4px; 
            font-size: 0.8rem; font-weight: 600; color: #94a3b8; 
            cursor: pointer; transition: all 0.2s; border-bottom: 2px solid transparent; margin-bottom: -2px;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ai-simple-tab:hover { color: #64748b; }
        .ai-simple-tab.active { color: #8a4af3; border-bottom-color: #8a4af3; }
        
        /* İÇERİK */
        .ai-simple-content { min-height: 100px; font-size: 0.9rem; color: #334155; line-height: 1.5; }
        .ai-simple-loading { padding: 20px; text-align: center; color: #94a3b8; font-size: 0.85rem; }
        .ai-info-row { margin-bottom: 6px; }
        .ai-label { font-weight: 700; color: #475569; margin-right: 5px; }
        .ai-simple-footer { margin-top: 8px; font-size: 0.7rem; color: #cbd5e1; text-align: right; }
    `;
    document.head.appendChild(style);
})();

// 2. KONUMU 3 PARÇAYA BÖL (Yer > İlçe > İl)
async function getHierarchicalLocation(lat, lng) {
    try {
        const resp = await fetch(`/api/geoapify/reverse?lat=${lat}&lon=${lng}&limit=1`);
        if (!resp.ok) return null;
        
        const data = await resp.json();
        if (data.features && data.features.length > 0) {
            const props = data.features[0].properties;
            
            // --- HİYERARŞİ MANTIĞI ---
            
            // 1. ÖZEL YER (Bodrum Kalesi)
            // Eğer name yoksa null döner, tab hiç oluşmaz.
            let specific = props.name || null;
            // Gereksiz sokak isimlerini filtrele (İsteğe bağlı, şimdilik net kalsın)
            if (specific && (specific === props.street || /^\d/.test(specific))) specific = null;

            // 2. İLÇE (Bodrum)
            // Türkiye'de 'county', yurtdışında 'city' veya 'town' olabilir.
            let district = props.county || props.town || props.suburb || "";
            
            // 3. İL (Muğla)
            // Türkiye'de 'state', yurtdışında 'province' veya 'state'.
            let province = props.state || props.province || props.city || ""; // City bazen il olur

            // Çakışma düzeltme: İlçe ve İl aynıysa (Muğla Merkez gibi), ilçe boş kalsın veya 'Merkez' olsun.
            if (district === province) district = "Merkez";

            // Ülke (AI context için gerekli)
            const country = props.country || "";

            return { specific, district, province, country };
        }
    } catch (e) { console.error(e); }
    return null;
}

// 3. AI İSTEK FONKSİYONU
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
            <div style="margin-top:5px">Araştırılıyor: <b>${queryName}</b></div>
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
                <div class="ai-info-row"><span class="ai-label">📝 Özet:</span>${data.summary || 'Bilgi yok.'}</div>
                ${data.tip ? `<div class="ai-info-row"><span class="ai-label">💡 İpucu:</span>${data.tip}</div>` : ''}
                ${data.highlight ? `<div class="ai-info-row"><span class="ai-label">✨ Popüler:</span>${data.highlight}</div>` : ''}
            </div>
        `;

        aiSimpleCache[cacheKey] = html;
        containerDiv.innerHTML = html;

    } catch (e) {
        containerDiv.innerHTML = `<div style="color:red; text-align:center; padding:10px;">Bağlantı hatası.</div>`;
    }
}

// 4. TIKLAMA VE POPUP YÖNETİMİ
async function handleMapAIClick(e) {
    const map = e.target;
    
    // A) Spinner Aç
    const popup = L.popup({ maxWidth: 320 }).setLatLng(e.latlng)
        .setContent('<div style="padding:10px; text-align:center;">Konum alınıyor...</div>')
        .openOn(map);

    // B) Veriyi Çek
    const loc = await getHierarchicalLocation(e.latlng.lat, e.latlng.lng);
    
    if (!loc) {
        popup.setContent('<div style="padding:10px; color:red;">Konum bulunamadı.</div>');
        return;
    }

    // C) Tab Butonlarını Hazırla
    // Context Mantığı: AI'ya "Bodrum Kalesi, Bodrum, Muğla" şeklinde tam adres gönderiyoruz.
    
    let tabsHTML = '';
    let firstActiveTab = '';
    
    // 1. Tab: ÖZEL YER (Varsa)
    if (loc.specific) {
        tabsHTML += `<button class="ai-simple-tab active" 
            data-query="${loc.specific}" 
            data-context="${loc.specific}, ${loc.district}, ${loc.province}, ${loc.country}">
            📍 ${loc.specific}
        </button>`;
        firstActiveTab = 'specific';
    }

    // 2. Tab: İLÇE (Varsa)
    if (loc.district) {
        const isActive = !firstActiveTab ? 'active' : ''; 
        if (!firstActiveTab) firstActiveTab = 'district';
        
        tabsHTML += `<button class="ai-simple-tab ${isActive}" 
            data-query="${loc.district}" 
            data-context="${loc.district}, ${loc.province}, ${loc.country}">
            🏙️ ${loc.district}
        </button>`;
    }

    // 3. Tab: İL (Her zaman)
    const isCityActive = !firstActiveTab ? 'active' : '';
    tabsHTML += `<button class="ai-simple-tab ${isCityActive}" 
        data-query="${loc.province}" 
        data-context="${loc.province}, ${loc.country}">
        🌍 ${loc.province}
    </button>`;

    // D) Popup İçeriğini Oluştur
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

    // E) Etkileşimi Başlat
    requestAnimationFrame(() => {
        const container = document.getElementById(uiID);
        if(!container) return;

        const contentDiv = document.getElementById(uiID + '-content');
        const buttons = container.querySelectorAll('.ai-simple-tab');

        buttons.forEach(btn => {
            btn.onclick = (evt) => {
                // Tab değiştir
                buttons.forEach(b => b.classList.remove('active'));
                evt.target.classList.add('active');
                
                // Veri çek
                const qName = evt.target.getAttribute('data-query');
                const qContext = evt.target.getAttribute('data-context');
                fetchSimpleAI(qName, qContext, contentDiv);
            };
        });

        // Açılışta ilk tabı tetikle
        const activeBtn = container.querySelector('.ai-simple-tab.active');
        if (activeBtn) activeBtn.click();
    });
}