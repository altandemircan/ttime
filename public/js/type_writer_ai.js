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
// === AI MAP INTERACTION MODULE (WORLDWIDE & TABBED) ===
// =========================================================================

// 1. CSS STYLES (Dinamik olarak eklenir)
(function addAIStyles() {
    const styleId = 'tt-ai-popup-styles';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
        .ai-popup-container { font-family: 'Satoshi', sans-serif; min-width: 260px; max-width: 320px; }
        .ai-header-title { font-size: 1rem; font-weight: 700; color: #1e293b; margin: 0 0 10px 0; display: flex; align-items: center; gap: 6px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
        
        /* TABS */
        .ai-tabs { display: flex; gap: 4px; margin-bottom: 10px; background: #f8fafc; padding: 3px; border-radius: 8px; }
        .ai-tab-btn { 
            flex: 1; border: none; background: transparent; padding: 6px 4px; 
            font-size: 0.75rem; font-weight: 600; color: #64748b; 
            cursor: pointer; transition: all 0.2s; border-radius: 6px;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ai-tab-btn:hover { color: #8a4af3; background: rgba(138, 74, 243, 0.05); }
        .ai-tab-btn.active { background: #fff; color: #8a4af3; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
        
        /* CONTENT */
        .ai-content-box { min-height: 120px; font-size: 0.9rem; color: #334155; line-height: 1.5; }
        .ai-loading { text-align: center; padding: 20px; color: #94a3b8; font-size: 0.8rem; }
        .ai-error { color: #ef4444; font-size: 0.85rem; text-align: center; margin-top: 10px; background: #fef2f2; padding: 8px; border-radius: 6px; }
        
        /* INFO ITEMS */
        .ai-info-item { margin-bottom: 8px; }
        .ai-info-label { font-weight: 700; color: #475569; margin-right: 4px; }
        .ai-footer { margin-top: 10px; font-size: 0.7rem; color: #cbd5e1; text-align: right; border-top: 1px solid #f1f5f9; padding-top: 6px; }
    `;
    document.head.appendChild(style);
})();

// 2. DETAYLI KONUM ÇÖZÜCÜ (Global)
async function getDetailedLocation(lat, lng) {
    try {
        // Geoapify reverse geocoding
        const resp = await fetch(`/api/geoapify/reverse?lat=${lat}&lon=${lng}&limit=1`);
        if (!resp.ok) return null;
        
        const data = await resp.json();
        if (data.features && data.features.length > 0) {
            const props = data.features[0].properties;
            
            // --- Akıllı Ayrıştırma (Global Standard) ---
            
            // 1. Ülke (API'den ne gelirse)
            const country = props.country || "";

            // 2. Şehir / Eyalet / Bölge
            // Bazı ülkelerde state, bazılarında city, bazılarında province asıl bölgedir.
            let city = props.state || props.province || props.city || "";
            
            // 3. İlçe / Semt / Kasaba
            let district = props.county || props.district || props.suburb || props.town || "";
            
            // Çakışma Kontrolü: İlçe ile Şehir aynıysa ilçeyi genel yap
            if (district === city) district = "Center/Downtown";

            // 4. Özel Yer İsmi (Specific Place)
            let specificName = props.name || "";
            
            // Filtreleme: Sokak isimlerini veya anlamsız adresleri "Gezilecek Yer" gibi görme
            // Eğer isim sokak adıyla aynıysa veya sadece numara içeriyorsa özel isim olarak alma.
            if (!specificName || 
                specificName === props.street || 
                /^[\d\s\-\.]+$/.test(specificName) || // Sadece sayı
                (props.address_line1 && specificName === props.address_line1)
            ) {
                specificName = null;
            }

            return {
                specific: specificName, // Örn: "Eiffel Tower" (Yoksa null)
                district: district,     // Örn: "7th Arrondissement"
                city: city,             // Örn: "Paris"
                country: country        // Örn: "France"
            };
        }
    } catch (e) {
        console.error("Location fetch error:", e);
    }
    return null;
}

// 3. AI İSTEK YÖNETİCİSİ (Cache Mekanizmalı)
const aiResponseCache = {}; 

async function fetchAIForTab(locationName, fullContext, containerDiv) {
    // Cache Key: Sorgu + Ülke (Benzersiz olması için)
    const cacheKey = fullContext; 

    if (aiResponseCache[cacheKey]) {
        containerDiv.innerHTML = aiResponseCache[cacheKey];
        return;
    }

    // Loading State
    containerDiv.innerHTML = `
        <div class="ai-loading">
            <div class="spinner" style="display:inline-block; width:12px; height:12px; border:2px solid #e2e8f0; border-top-color:#8a4af3; border-radius:50%; animation:spin 0.8s linear infinite; margin-bottom:8px;"></div>
            <div>Consulting AI about<br><strong style="color:#64748b">${locationName}</strong>...</div>
        </div>
    `;

    try {
        // AI Endpoint'e İstek
        // Context string'i (ör: "Eiffel Tower, Paris, France") city parametresine gönderiyoruz.
        // Backend bu string'i kullanarak detaylı bilgi üretecek.
        const response = await fetch('/llm-proxy/plan-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                city: fullContext, // "Specific Name, City, Country" formatında gider
                country: ""        // Ülkeyi zaten fullContext içine gömdük, burayı boş bırakabiliriz veya tekrar gönderebiliriz.
            })
        });

        if (!response.ok) throw new Error("AI Service Busy");
        const aiData = await response.json();

        // Sonuç HTML'i
        const htmlContent = `
            <div style="animation: fadeIn 0.4s ease;">
                <div class="ai-info-item">
                    <span class="ai-info-label">📝 Summary:</span>
                    <span>${aiData.summary || 'No summary available.'}</span>
                </div>
                ${aiData.tip ? `
                <div class="ai-info-item">
                    <span class="ai-info-label">💡 Tip:</span>
                    <span>${aiData.tip}</span>
                </div>` : ''}
                ${aiData.highlight ? `
                <div class="ai-info-item">
                    <span class="ai-info-label">✨ Highlight:</span>
                    <span>${aiData.highlight}</span>
                </div>` : ''}
            </div>
        `;
        
        // Cache'e kaydet ve göster
        aiResponseCache[cacheKey] = htmlContent;
        containerDiv.innerHTML = htmlContent;

    } catch (err) {
        containerDiv.innerHTML = `
            <div class="ai-error">
                Could not retrieve info.<br>
                <button onclick="this.parentElement.parentElement.innerHTML=''; fetchAIForTab('${locationName}', '${fullContext}', document.getElementById('${containerDiv.id}'))" style="background:none; border:none; color:#ef4444; text-decoration:underline; cursor:pointer; margin-top:4px;">Try Again</button>
            </div>
        `;
    }
}

// 4. HARİTA TIKLAMA OLAYI (ANA FONKSİYON)
async function handleMapAIClick(e) {
    const map = e.target;
    const { lat, lng } = e.latlng;

    // A) İlk Popup (Spinner)
    const popup = L.popup({
        maxWidth: 320,
        className: 'ai-initial-popup'
    })
    .setLatLng([lat, lng])
    .setContent(`
        <div style="padding:12px; text-align:center; color:#64748b; font-family:'Satoshi', sans-serif;">
            <div class="spinner" style="display:inline-block; width:10px; height:10px; border:2px solid #ccc; border-top-color:#8a4af3; border-radius:50%; animation:spin 1s linear infinite;"></div>
            <span style="margin-left:8px; font-weight:600; font-size:0.85rem;">Identifying Location...</span>
        </div>
    `)
    .openOn(map);

    // B) Koordinat Çözümleme
    const loc = await getDetailedLocation(lat, lng);

    if (!loc) {
        popup.setContent('<div style="padding:10px; color:#ef4444; font-family:sans-serif;">Location not found in database.</div>');
        return;
    }

    // C) Tab Verilerini Hazırla
    // Eğer özel bir yer ismi yoksa (Specific), ilk tab gösterilmeyecek.
    const hasSpecific = !!loc.specific;
    const countryStr = loc.country ? `, ${loc.country}` : '';
    const cityStr = loc.city ? `, ${loc.city}` : '';

    // D) HTML İskeleti Oluştur
    const uniqueId = 'ai-ui-' + Date.now();
    const contentBoxId = uniqueId + '-content';
    
    // Tab Butonları HTML
    let tabsHtml = '';
    
    // Tab 1: Specific (Varsa)
    if (hasSpecific) {
        tabsHtml += `<button class="ai-tab-btn active" data-context="${loc.specific}${cityStr}${countryStr}" data-label="${loc.specific}">📍 Spot</button>`;
    }
    
    // Tab 2: District (Varsa)
    if (loc.district) {
        // Eğer Specific yoksa, District active olsun
        const activeClass = !hasSpecific ? 'active' : '';
        tabsHtml += `<button class="ai-tab-btn ${activeClass}" data-context="${loc.district}${cityStr}${countryStr}" data-label="${loc.district}">🏙️ District</button>`;
    }

    // Tab 3: City (Her zaman)
    const cityActive = (!hasSpecific && !loc.district) ? 'active' : '';
    const displayCity = loc.city || loc.country || "Region";
    tabsHtml += `<button class="ai-tab-btn ${cityActive}" data-context="${loc.city}${countryStr}" data-label="${displayCity}">🌍 City</button>`;

    // Ana Popup İçeriği
    const popupHTML = `
        <div id="${uniqueId}" class="ai-popup-container">
            <h3 class="ai-header-title" id="${uniqueId}-title">
                ${hasSpecific ? '📍 ' + loc.specific : (loc.district ? '🏙️ ' + loc.district : '🌍 ' + loc.city)}
            </h3>
            
            <div class="ai-tabs">
                ${tabsHtml}
            </div>
            
            <div id="${contentBoxId}" class="ai-content-box">
                </div>
            
            <div class="ai-footer">AI Travel Assistant • ${loc.country || 'Global'}</div>
        </div>
    `;

    popup.setContent(popupHTML);

    // E) Etkileşim ve İlk Yükleme
    // Popup render edildikten sonra çalışır
    requestAnimationFrame(() => {
        const container = document.getElementById(uniqueId);
        if (!container) return;

        const contentDiv = document.getElementById(contentBoxId);
        const titleDiv = document.getElementById(uniqueId + '-title');
        const buttons = container.querySelectorAll('.ai-tab-btn');

        // Tab Tıklama Mantığı
        buttons.forEach(btn => {
            btn.onclick = (evt) => {
                // Görsel güncelleme
                buttons.forEach(b => b.classList.remove('active'));
                const target = evt.target;
                target.classList.add('active');

                // Başlığı güncelle
                const label = target.getAttribute('data-label');
                const icon = target.innerText.split(' ')[0]; // Emojiyi al
                titleDiv.innerHTML = `${icon} ${label}`;

                // İçeriği Çek
                const context = target.getAttribute('data-context');
                fetchAIForTab(label, context, contentDiv);
            };
        });

        // Açılışta Aktif Olan Tab'ı Tetikle
        const initialBtn = container.querySelector('.ai-tab-btn.active');
        if (initialBtn) {
            initialBtn.click();
        }
    });
}