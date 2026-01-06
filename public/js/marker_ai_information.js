// =========================================================================
// === AI MAP INTERACTION (ENGLISH - 3 TABS) ===
// =========================================================================

// 1. CSS STYLES (Değişmedi)
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

// 2. GELİŞMİŞ LOCATION PARSER (Turistik yerleri tespit eden)
async function getHierarchicalLocation(lat, lng) {
    try {
        const resp = await fetch(`/api/geoapify/reverse?lat=${lat}&lon=${lng}&limit=1`);
        if (!resp.ok) return null;

        const data = await resp.json();
        if (data.features && data.features.length > 0) {
            const props = data.features[0].properties;
            
            // 1) YER TÜRÜNÜ TESPİT ET (işletme vs turistik yer)
            const isTouristicPlace = detectTouristicPlace(props);
            const placeType = getPlaceType(props); // "beach", "museum", "park" vb.
            
            // İŞLETME İSE NULL DÖN (eczane, market, klinik vs.)
            if (!isTouristicPlace) {
                return { 
                    isTouristic: false,
                    type: 'business',
                    businessName: props.name || null,
                    businessCategory: props.categories ? props.categories.split(',')[0] : null
                };
            }
            
            // 2) TURİSTİK YER İSE DEVAM ET
            
            // A) ÖZEL YER ADI (turistik yer)
            let specific = props.name || null;
            
            // Sokak veya numara ise null yap
            if (specific && (specific === props.street || /^\d/.test(specific))) {
                specific = null;
            }
            
            // Önemli: Turistik yer adı kategori içeriyorsa (örn: "Çınaraltı Cafe") 
            // sadece cafe kısmını çıkar, turistik yer adını koru
            if (specific && isTouristicPlace) {
                // Kafe, restaurant gibi kelimeleri temizle (turistik yerler için)
                const businessTerms = ['cafe', 'restaurant', 'otel', 'hotel', 'lokanta', 'kebap', 'döner', 'pastane'];
                const lowerName = specific.toLowerCase();
                
                // Eğer tamamen işletme adı gibi görünüyorsa (sadece kategori) specific'i null yap
                if (businessTerms.some(term => lowerName.includes(term)) && 
                    !isDefinitelyTouristic(specific, props)) {
                    specific = null;
                }
            }
            
            // B) İLÇE (District)
            let district = props.county || props.town || props.suburb || "";
            
            // C) İL (Province/City)
            let province = props.city || props.state_district || props.province || "";
            
            // Eğer province hala yoksa ve state bölge değilse state'i kullan
            if (!province && props.state && !isRegionName(props.state)) {
                province = props.state;
            }
            
            // province yanlışlıkla bölge adı olduysa düzelt
            if (isRegionName(province)) {
                province = props.city || props.county || "";
            }
            
            // D) İLÇE VE İL AYNI İSE DÜZENLE
            if (district && province && district === province) {
                // Büyükşehirlerde "City Center" olarak ayır
                if (province === 'İstanbul' || province === 'Ankara' || province === 'İzmir') {
                    district = 'City Center';
                } else {
                    // Diğer şehirlerde ilçeyi boş bırak
                    district = "";
                }
            }
            
            const country = props.country || "";
            
            return { 
                isTouristic: true,
                type: placeType,
                specific, 
                district, 
                province, 
                country,
                categories: props.categories,
                formatted: formatLocationText(loc)
            };
        }
    } catch (e) {
        console.error("Location parse error:", e);
    }
    return null;
}

// 3. YARDIMCI FONKSİYONLAR

// Turistik yer mi değil mi tespit et
function detectTouristicPlace(props) {
    const categories = props.categories ? props.categories.toLowerCase() : '';
    const name = (props.name || '').toLowerCase();
    
    // İŞLETME KATEGORİLERİ (filtrele)
    const businessCategories = [
        'commercial', 'shop', 'store', 'market', 'supermarket', 'mall',
        'pharmacy', 'drugstore', 'chemist',
        'clinic', 'hospital', 'medical', 'healthcare', 'doctor',
        'bank', 'atm', 'finance',
        'office', 'company', 'business',
        'car', 'automotive', 'repair',
        'cafe', 'restaurant', 'food', 'bar', 'pub', // Bunlar özel durum - turistik olabilir
        'hotel', 'accommodation' // Bunlar da özel durum
    ];
    
    // TURİSTİK YER KATEGORİLERİ (izin ver)
    const touristicCategories = [
        'tourism', 'attraction', 'historic', 'museum', 'cultural',
        'beach', 'coast', 'sea', 'lake', 'river', 'water',
        'mountain', 'hill', 'valley', 'volcano',
        'park', 'garden', 'forest', 'nature',
        'archaeology', 'castle', 'fort', 'ruin',
        'religious', 'church', 'mosque', 'temple',
        'viewpoint', 'lookout', 'panorama',
        'monument', 'memorial', 'statue',
        'bridge', 'dam', 'reservoir',
        'island', 'bay', 'cape', 'peninsula',
        'cave', 'spring', 'waterfall',
        'zoo', 'aquarium', 'botanical'
    ];
    
    // ÖNEMLİ: Bazı kategoriler hem işletme hem turistik olabilir
    // Örnek: "cafe" eğer turistik bir yerdeyse (plaj, manzara noktası) kabul edilebilir
    
    // 1) Önce kesin işletmeleri eledik
    const isDefinitelyBusiness = businessCategories.some(cat => 
        categories.includes(cat) && 
        !['cafe', 'restaurant', 'hotel'].includes(cat) // Bunları sonra kontrol edeceğiz
    );
    
    if (isDefinitelyBusiness) return false;
    
    // 2) Kesin turistik yerler
    const isDefinitelyTouristic = touristicCategories.some(cat => 
        categories.includes(cat)
    );
    
    if (isDefinitelyTouristic) return true;
    
    // 3) ÖZEL DURUMLAR: Cafe, Restaurant, Hotel
    // Eğer turistik bir bölgedeyse veya kendisi turistik bir yer adıysa kabul et
    if (categories.includes('cafe') || categories.includes('restaurant') || 
        categories.includes('hotel') || name.includes('cafe') || name.includes('restaurant')) {
        
        // İsimde turistik yer belirten kelimeler var mı?
        const touristicNameTerms = ['view', 'panorama', 'beach', 'coast', 'castle', 
                                  'museum', 'park', 'garden', 'lake', 'river', 'hill'];
        const hasTouristicName = touristicNameTerms.some(term => name.includes(term));
        
        // Veya adres turistik bir bölgede mi?
        const address = (props.formatted || '').toLowerCase();
        const isInTouristicArea = touristicNameTerms.some(term => address.includes(term));
        
        return hasTouristicName || isInTouristicArea;
    }
    
    // 4) İsimle tespit (kategori yoksa)
    if (!categories && props.name) {
        const touristicTerms = ['plaj', 'beach', 'koy', 'bay', 'turizm', 'tourism',
                              'müze', 'museum', 'kalə', 'castle', 'fort',
                              'park', 'bahçe', 'garden', 'göl', 'lake',
                              'şelale', 'waterfall', 'manzara', 'viewpoint',
                              'tarihi', 'historic', 'antik', 'ancient'];
        
        return touristicTerms.some(term => name.toLowerCase().includes(term));
    }
    
    // Diğer durumlarda varsayılan olarak turistik kabul et (daha sonra tab seçimi ile)
    return true;
}

// Yer türünü belirle
function getPlaceType(props) {
    const categories = (props.categories || '').toLowerCase();
    const name = (props.name || '').toLowerCase();
    
    if (categories.includes('beach') || name.includes('plaj') || name.includes('beach')) return 'beach';
    if (categories.includes('museum') || name.includes('müze')) return 'museum';
    if (categories.includes('park') || name.includes('park')) return 'park';
    if (categories.includes('historic') || categories.includes('archaeology')) return 'historic';
    if (categories.includes('mountain') || name.includes('dağ')) return 'mountain';
    if (categories.includes('lake') || name.includes('göl')) return 'lake';
    if (categories.includes('river') || name.includes('nehir')) return 'river';
    if (categories.includes('viewpoint') || name.includes('manzara')) return 'viewpoint';
    if (categories.includes('castle') || name.includes('kale')) return 'castle';
    if (categories.includes('religious') || name.includes('cami') || name.includes('mosque')) return 'religious';
    
    return 'attraction';
}

// Bölge adı mı kontrol et
function isRegionName(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return lower.includes('region') || 
           lower.includes('bölgesi') || 
           lower.includes('bolgesi') ||
           lower.includes('coast') ||
           lower.includes('aegean') ||
           lower.includes('mediterranean') ||
           lower.includes('black sea');
}

// Kesin turistik yer mi kontrol et
function isDefinitelyTouristic(name, props) {
    const lowerName = name.toLowerCase();
    const categories = (props.categories || '').toLowerCase();
    
    const touristicTerms = ['castle', 'fort', 'museum', 'beach', 'park', 'garden',
                          'lake', 'river', 'waterfall', 'mountain', 'hill',
                          'viewpoint', 'panorama', 'historic', 'ancient',
                          'archaeology', 'ruins', 'monument'];
    
    return touristicTerms.some(term => 
        lowerName.includes(term) || categories.includes(term)
    );
}

// Lokasyon metnini formatla
function formatLocationText(loc) {
    const parts = [];
    if (loc.specific) parts.push(loc.specific);
    if (loc.district) parts.push(loc.district);
    if (loc.province) parts.push(loc.province);
    if (loc.country) parts.push(loc.country);
    return parts.join(', ');
}

// 4. AI FETCH FUNCTION (Değişmedi)
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

// 5. GÜNCELLENMİŞ MAP CLICK HANDLER
async function handleMapAIClick(e) {
    const map = e.target;
    
    // A) Initial Spinner
    const popup = L.popup({ maxWidth: 320 }).setLatLng(e.latlng)
        .setContent('<div style="padding:10px; text-align:center; color:#64748b;">Analyzing location...</div>')
        .openOn(map);

    // B) Fetch ve Analiz
    const loc = await getHierarchicalLocation(e.latlng.lat, e.latlng.lng);
    
    if (!loc) {
        popup.setContent('<div style="padding:10px; color:#ef4444;">Location not found.</div>');
        return;
    }
    
    // C) İŞLETME İSE FARKLI MESAJ GÖSTER
    if (!loc.isTouristic) {
        const businessMessage = `
            <div style="padding:15px; text-align:center;">
                <div style="font-size:1.2rem; margin-bottom:10px; color:#475569;">🏪 ${loc.businessName || 'Business'}</div>
                <div style="color:#64748b; margin-bottom:15px;">
                    This is a ${loc.businessCategory || 'local business'}.<br>
                    For travel information, click on tourist spots.
                </div>
                <div style="font-size:0.8rem; color:#94a3b8;">
                    Tip: Try clicking on beaches, museums, parks, or historical sites.
                </div>
            </div>
        `;
        popup.setContent(businessMessage);
        return;
    }
    
    // D) TURİSTİK YER İSE DEVAM ET
    
    // Tab seçeneklerini akıllıca oluştur
    let tabsHTML = '';
    const tabs = [];
    
    // 1) ÖZEL YER TAB'ı (eğer varsa ve turistikse)
    if (loc.specific && loc.specific.length > 0) {
        tabs.push({
            type: 'specific',
            query: loc.specific,
            context: `${loc.specific}, ${loc.district}, ${loc.province}, ${loc.country}`,
            label: `📍 ${loc.specific}`,
            icon: getIconForType(loc.type)
        });
    }
    
    // 2) İLÇE TAB'ı (eğer varsa ve il'den farklıysa)
    if (loc.district && loc.district.length > 0 && loc.district !== loc.province) {
        tabs.push({
            type: 'district',
            query: loc.district,
            context: `${loc.district}, ${loc.province}, ${loc.country}`,
            label: `🏙️ ${loc.district}`,
            icon: '🏙️'
        });
    }
    
    // 3) İL TAB'ı (her zaman)
    tabs.push({
        type: 'province',
        query: loc.province,
        context: `${loc.province}, ${loc.country}`,
        label: `🌍 ${loc.province}`,
        icon: '🌍'
    });
    
    // Tab HTML'ini oluştur
    tabs.forEach((tab, index) => {
        const isActive = index === 0 ? 'active' : '';
        tabsHTML += `
            <button class="ai-simple-tab ${isActive}" 
                data-query="${tab.query}" 
                data-context="${tab.context}"
                title="${tab.query}">
                ${tab.label}
            </button>
        `;
    });
    
    // E) Popup İçeriğini Oluştur
    const uiID = 'ai-ui-' + Date.now();
    const typeEmoji = getIconForType(loc.type);
    
    const contentHTML = `
        <div id="${uiID}" class="ai-popup-simple">
            <div style="margin-bottom:5px; font-size:0.8rem; color:#8a4af3; font-weight:600;">
                ${typeEmoji} ${loc.type.toUpperCase()} AREA
            </div>
            <div class="ai-simple-tabs">
                ${tabsHTML}
            </div>
            <div id="${uiID}-content" class="ai-simple-content"></div>
            <div class="ai-simple-footer">AI Travel Assistant • ${loc.formatted || ''}</div>
        </div>
    `;
    
    popup.setContent(contentHTML);
    
    // F) Tab Etkileşimini Başlat
    requestAnimationFrame(() => {
        const container = document.getElementById(uiID);
        if (!container) return;
        
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

// Yer türüne göre icon ver
function getIconForType(type) {
    const icons = {
        'beach': '🏖️',
        'museum': '🏛️',
        'park': '🌳',
        'historic': '🏺',
        'mountain': '⛰️',
        'lake': '🌊',
        'river': '🌊',
        'viewpoint': '👁️',
        'castle': '🏰',
        'religious': '🕌',
        'attraction': '📍'
    };
    return icons[type] || '📍';
}

// Geoapify kategori hatalarını düzeltmek için alternatif fonksiyon
function cleanGeoapifyData(props) {
    // Geoapify bazen state'i bölge olarak veriyor, düzelt
    const cleaned = { ...props };
    
    // State alanı bölge ise temizle
    if (isRegionName(cleaned.state)) {
        cleaned.state = '';
    }
    
    // City yoksa ve state_district varsa, onu city yap
    if (!cleaned.city && cleaned.state_district && !isRegionName(cleaned.state_district)) {
        cleaned.city = cleaned.state_district;
    }
    
    // Province bölge ise temizle
    if (isRegionName(cleaned.province)) {
        cleaned.province = '';
    }
    
    return cleaned;
}