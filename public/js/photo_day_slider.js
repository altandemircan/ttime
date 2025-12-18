// ============================================================
// photo_day_slider.js
// Gün bazlı fotoğraf kolajı (slider) ve akıllı konum bulma modülü
// ============================================================

// 1. GLOBAL DEĞİŞKENLER VE TAKİP SİSTEMİ
// ============================================================
window.__ttNewTripToken = window.__ttNewTripToken || function () {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

if (!window.__activeTripSessionToken) {
    window.__activeTripSessionToken = window.__ttNewTripToken();
}

window.__dayCollagePhotosByTrip = window.__dayCollagePhotosByTrip || {};
window.__globalCollageUsedByTrip = window.__globalCollageUsedByTrip || {};
window.__apiPageTracker = window.__apiPageTracker || {}; 
window.__apiExhaustedQueries = window.__apiExhaustedQueries || new Set();

// GEZİ BAĞLAMI HAFIZASI
window.__lastKnownContext = window.__lastKnownContext || ""; 
window.__lastKnownCountry = window.__lastKnownCountry || ""; 

// [YENİ] BAŞLANGIÇTA ÜLKEYİ ZORLA HAFIZAYA AL
try {
    if (window.selectedCity && window.selectedCity.includes(',')) {
        let parts = window.selectedCity.split(',');
        let possibleCountry = parts[parts.length - 1].trim();
        if (possibleCountry && !window.__lastKnownCountry) {
            window.__lastKnownCountry = possibleCountry;
        }
    }
} catch(e) {}


// 2. HİYERARŞİ ANALİZİ VE İSİM ÇIKARMA
// ============================================================
function extractSmartSearchTerm(info, fallbackCity = "") {
    if (!info) return { term: fallbackCity, context: "", country: window.__lastKnownCountry || "" };

    const props = info.properties || {};
    const addr = info.address || props.address || {}; 

    const district = addr.district || addr.county || props.district || props.county || "";
    const city = addr.city || addr.town || addr.village || props.city || props.town || "";
    const state = addr.state || addr.province || props.state || "";
    const country = addr.country || props.country || window.__lastKnownCountry || "";

    let term = "";     
    let context = "";  

    // İlçe Tespiti
    if (district && district.toLowerCase() !== state.toLowerCase() && district.toLowerCase() !== city.toLowerCase()) {
        if (!district.toLowerCase().includes("merkez")) {
            term = district;
        }
    }
    if (!term && city) {
        term = city;
    }

    // İl Tespiti
    if (state && state.toLowerCase() !== term.toLowerCase()) {
        context = state;
    } else if (city && city.toLowerCase() !== term.toLowerCase()) {
        context = city;
    }

    // Fallback
    if (!term) {
        if (fallbackCity.includes(',')) {
            let parts = fallbackCity.split(',');
            term = parts[0].trim();
        } else {
            term = fallbackCity;
        }
    }

    return { 
        term: term, 
        context: context, 
        country: country 
    };
}

// ŞEHİR İSMİNİ CACHE'LEME
window.fetchSmartLocationName = async function(lat, lng, fallbackCity = "") {
    const latKey = Number(lat).toFixed(4);
    const lngKey = Number(lng).toFixed(4);
    const storageKey = `tt_loc_name_v28_${latKey}_${lngKey}`; // v28

    try {
        const cachedName = localStorage.getItem(storageKey);
        if (cachedName) return JSON.parse(cachedName);
    } catch(e) {}

    try {
        if (typeof window.getPlaceInfoFromLatLng === 'function') {
            const info = await window.getPlaceInfoFromLatLng(lat, lng);
            const result = extractSmartSearchTerm(info, fallbackCity);
            
            if (result.country) window.__lastKnownCountry = result.country;
            if (result.context) window.__lastKnownContext = result.context;

            if (result && (result.term || result.context)) {
                try { localStorage.setItem(storageKey, JSON.stringify(result)); } catch(e) {}
            }
            return result;
        } else {
            return { term: fallbackCity, context: "", country: window.__lastKnownCountry };
        }
    } catch (_) {
        return { term: fallbackCity, context: "", country: window.__lastKnownCountry };
    }
};


// 3. GÖRSEL ARAMA (HAVUZU DOLDURANA KADAR DEVAM ET)
// ============================================================
window.getCityCollageImages = async function(searchObj, options = {}) {
    const term = searchObj.term;    
    const context = searchObj.context; 
    const country = searchObj.country || window.__lastKnownCountry;

    if (!term && !context && !country) return { images: [], activeLabel: "" };

    const limit = options.min || 4; 
    let accumulatedImages = [];
    const seenUrls = new Set(); 

    if (options.exclude && options.exclude instanceof Set) {
        options.exclude.forEach(u => seenUrls.add(u));
    }

    // --- ADAY LİSTESİ ---
    const candidates = [];

    // 1. Aday: İlçe + İl (Örn: "Manisa Turkey" veya "Kepez Antalya")
    // (Turkey ekleyelim ki garanti olsun, ama başlıkta göstermeyeceğiz)
    if (term && context) {
        candidates.push({ query: `${term} ${context}`, label: term });
    }

    // 2. Aday: Sadece İlçe/Yer (Örn: "Manisa" veya "Kemer")
    if (term) {
        candidates.push({ query: term, label: term });
    }

    // 3. Aday: Sadece İl (Örn: "Antalya") -> Kemer biterse
    if (context && context !== term) {
        candidates.push({ query: context, label: context });
    }

    // 4. Aday: Ülke (Örn: "Turkey") -> İl biterse
    if (country) {
        candidates.push({ query: country, label: country });
    }

    let finalLabel = "";

    // --- DÖNGÜ: HAVUZ DOLANA KADAR ADAYLARI GEZ ---
    for (const candidate of candidates) {
        // Eğer yeterince resim topladıysak DUR.
        if (accumulatedImages.length >= limit) {
            break;
        }

        const query = candidate.query;
        const trackerKey = query.replace(/\s+/g, '_').toLowerCase();

        // Eğer bu kelime daha önce tamamen tükenmişse, hiç vakit kaybetme, sonrakine geç
        if (window.__apiExhaustedQueries.has(trackerKey)) {
            continue;
        }

        // Sayfa yönetimi
        let pageToFetch = window.__apiPageTracker[trackerKey] || 1;
        // Bir sonraki çağrı için şimdiden artır (Race condition önlemi)
        window.__apiPageTracker[trackerKey] = pageToFetch + 1;

        // Eksik kalan kadar iste (Ama en az 4 iste ki çeşitlilik olsun)
        const needed = limit - accumulatedImages.length;
        const fetchCount = Math.max(needed + 2, 4);
        
        // API İsteği
        const url = `/photoget-proxy/slider?query=${encodeURIComponent(query)}&limit=${fetchCount}&per_page=${fetchCount}&count=${fetchCount}&page=${pageToFetch}&source=pixabay&image_type=photo`;

        try {
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                const fetchedImages = data.images || data || [];

                // --- BOŞ GELDİYSE ---
                if (fetchedImages.length === 0) {
                    // Bu kelime bitti. İşaretle.
                    window.__apiExhaustedQueries.add(trackerKey);
                    // DÖNGÜYE DEVAM ET (continue). Böylece hemen bir sonraki adaya (Turkey) geçer.
                    continue; 
                }

                // Gelen resimleri havuza at
                let addedFromThisCandidate = false;
                for (const imgUrl of fetchedImages) {
                    if (accumulatedImages.length >= limit) break;
                    
                    if (!seenUrls.has(imgUrl)) {
                        accumulatedImages.push(imgUrl);
                        seenUrls.add(imgUrl);
                        addedFromThisCandidate = true;
                    }
                }

                // Eğer bu adaydan havuza resim atabildiysek, o anki geçerli başlık budur.
                // (Ama havuz dolmadıysa döngü dönmeye devam eder, Turkey'den tamamlar)
                if (addedFromThisCandidate) {
                    finalLabel = candidate.label;
                }
            }
        } catch (e) {
            console.warn(`Collage fetch error: "${query}"`, e);
        }
    }

    // Eğer hiçbir şey bulunamadıysa veya son kullanılan fallback neyse onu döndür
    if (!finalLabel && candidates.length > 0) {
        finalLabel = candidates[candidates.length - 1].label;
    }

    return { 
        images: accumulatedImages, 
        activeLabel: finalLabel 
    };
};


// 4. RENDER İŞLEMLERİ
// ============================================================
window.renderDayCollage = async function renderDayCollage(day, dayContainer, dayItemsArr) {
    if (!dayContainer) return;
    const tripTokenAtStart = window.__activeTripSessionToken;

    // A. Collage Alanını Hazırla
    let collage = dayContainer.querySelector('.day-collage');
    if (!collage) {
        collage = document.createElement('div');
        collage.className = 'day-collage';
        collage.style.cssText = "margin: 30px 0 10px 0; border-radius: 10px; overflow: hidden; position: relative; display: block; min-height: 100px;";
    }

    // B. DOM'a Yerleştirme
    const list = dayContainer.querySelector('.day-list');
    if (list) {
        const addBtn = list.querySelector('.add-more-btn');
        if (addBtn) {
            if (addBtn.nextElementSibling !== collage) {
                addBtn.insertAdjacentElement('afterend', collage);
            }
        } else {
            if (list.lastElementChild !== collage) {
                list.appendChild(collage);
            }
        }
    } else {
        dayContainer.appendChild(collage);
    }

    // --- C. KONUM BELİRLEME ---
    let firstLoc = null;
    if (dayItemsArr && dayItemsArr.length > 0) {
        firstLoc = dayItemsArr.find(i => i.location && i.location.lat && !i._starter && !i._placeholder);
    }

    let searchObj = { term: "", context: "", country: "" };
    
    // DURUM 1: Gün içinde gezi noktası varsa
    if (firstLoc && typeof window.fetchSmartLocationName === 'function') {
        searchObj = await window.fetchSmartLocationName(firstLoc.location.lat, firstLoc.location.lng, window.selectedCity);
        
        // [HAFIZA]: Bulduğumuz bilgileri kaydet
        if (searchObj.context) window.__lastKnownContext = searchObj.context;
        if (searchObj.country) window.__lastKnownCountry = searchObj.country;
    } 
    // DURUM 2: Gün boşsa (Add New Day)
    else {
        let rawCity = window.selectedCity || "";
        if (rawCity.includes(',')) {
            let parts = rawCity.split(',');
            searchObj.term = parts[0].trim(); 
            // Ülkeyi çek
            let ctry = parts[parts.length - 1].trim();
            if (ctry) searchObj.country = ctry;
        } else {
            searchObj.term = rawCity;
        }

        // [HAFIZA KULLANIMI]: Eksikleri tamamla
        if (!searchObj.context && window.__lastKnownContext) searchObj.context = window.__lastKnownContext;
        if (!searchObj.country && window.__lastKnownCountry) searchObj.country = window.__lastKnownCountry;
    }

    if (!searchObj.term && !searchObj.context && !searchObj.country) {
        collage.style.display = 'none';
        return;
    }

    // D. Cache Kontrolü
    if (!window.__globalCollageUsedByTrip) window.__globalCollageUsedByTrip = {};
    if (!window.__globalCollageUsedByTrip[tripTokenAtStart]) {
        window.__globalCollageUsedByTrip[tripTokenAtStart] = new Set();
    }
    const usedSet = window.__globalCollageUsedByTrip[tripTokenAtStart];

    const safeTerm = (searchObj.term || searchObj.context).replace(/\s+/g, '_');
    const cacheKey = `tt_day_collage_v28_${day}_${safeTerm}_pixabay`;
    
    let images = [];
    let activeLabel = ""; 
    let fromCache = false;

    try {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
            const parsed = JSON.parse(cachedData);
            if (parsed && parsed.images && parsed.images.length > 0) {
                images = parsed.images;
                activeLabel = parsed.activeLabel || searchObj.term;
                fromCache = true;
                images.forEach(img => usedSet.add(img));
            }
        }
    } catch (e) {}

    // E. API'den Çek
    if (!fromCache || images.length === 0) {
        if (window.__activeTripSessionToken !== tripTokenAtStart) return;

        if (typeof window.getCityCollageImages === 'function') {
            
            console.log(`[Collage] Searching for: ${searchObj.term} (Ctx: ${searchObj.context}, Cnt: ${searchObj.country})`);
            
            const result = await window.getCityCollageImages(searchObj, {
                min: 4, 
                exclude: usedSet
            });

            images = result.images || [];
            activeLabel = result.activeLabel || searchObj.term; 
        }

        if (window.__activeTripSessionToken !== tripTokenAtStart) return;

        if (images.length > 0) {
            images.forEach(img => usedSet.add(img));
            try {
                localStorage.setItem(cacheKey, JSON.stringify({
                    images: images,
                    activeLabel: activeLabel
                }));
            } catch (e) {
                console.warn("[Collage] Storage write error:", e);
            }
        }
    }

    // F. Render
    if (images.length > 0 && typeof renderCollageSlides === 'function') {
        renderCollageSlides(collage, images, activeLabel);
        collage.style.display = 'block';
    } else {
        collage.style.display = 'none';
    }
};


// 5. SLIDER RENDERER
// ============================================================
function renderCollageSlides(collage, images, displayLabel) {
    const isMobile = window.innerWidth < 600;
    const visible = isMobile ? 2 : 3;
    let index = 0;
  
    // Başlık
    let displayTerm = displayLabel;

    const topHeaderHtml = displayTerm
      ? `<div style="font-weight: bold; font-size: 0.95rem; color: rgb(51, 51, 51); margin-bottom: 10px;">Photos related to ${displayTerm}</div>`
      : "";
  
    const badgeHtml = displayTerm
      ? `<div style="position:absolute; top:12px; left:12px; z-index:2; background:rgba(0,0,0,0.6); color:#fff; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:600; pointer-events:none;">${displayTerm}</div>`
      : "";

    // Info İkonu
    const infoIconHtml = `
    <span class="info-icon-wrapper">
        <img src="https://www.svgrepo.com/show/474873/info.svg" alt="Info">
        <div class="info-tooltip" >
            Photos associated with this place are matched by analyzing search results and may not reflect reality.
            <div style="position: absolute; bottom: -6px; right: 10px; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 6px solid #333;"></div>
        </div>
    </span>
    <style> .info-icon-wrapper:hover .info-tooltip { display: block !important; } </style>
    `;
  
    collage.innerHTML = `
      ${topHeaderHtml}
      <div class="collage-viewport" style="overflow:hidden; width:100%; position:relative; border-radius:8px;">
        ${badgeHtml}
        <div class="collage-track" style="display:flex; transition: transform 0.4s ease-out; will-change: transform;"></div>
      </div>
      <button class="collage-nav prev" style="position:absolute; left:6px; top:50%; transform:translateY(-50%); background:rgba(255,255,255,0.9); color:#000; border:none; border-radius:50%; width:32px; height:32px; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow: 0 2px 6px rgba(0,0,0,0.3); z-index:5;">❮</button>
      <button class="collage-nav next" style="position:absolute; right:6px; top:50%; transform:translateY(-50%); background:rgba(255,255,255,0.9); color:#000; border:none; border-radius:50%; width:32px; height:32px; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow: 0 2px 6px rgba(0,0,0,0.3); z-index:5;">❯</button>
      ${infoIconHtml}
    `;
  
    const track = collage.querySelector(".collage-track");
    images.forEach((src) => {
      const slide = document.createElement("div");
      slide.style.cssText = `flex: 0 0 ${100 / visible}%; max-width: ${100 / visible}%; padding: 4px; box-sizing: border-box;`;
      slide.innerHTML = `<div style="width:100%; height:160px; border-radius:8px; overflow:hidden; background:#e5e8ed;"><img src="${src}" loading="lazy" style="width:100%; height:100%; object-fit:cover; display:block;"></div>`;
      track.appendChild(slide);
    });
  
    const update = () => {
      const max = Math.max(0, images.length - visible);
      index = Math.max(0, Math.min(max, index));
      track.style.transform = `translateX(-${index * (100 / visible)}%)`;
  
      const prev = collage.querySelector(".prev");
      const next = collage.querySelector(".next");
      if (prev) {
        prev.style.opacity = index === 0 ? 0.3 : 1;
        prev.style.pointerEvents = index === 0 ? "none" : "auto";
      }
      if (next) {
        next.style.opacity = index === max ? 0.3 : 1;
        next.style.pointerEvents = index === max ? "none" : "auto";
      }
    };
  
    collage.querySelector(".prev").onclick = (e) => {
      e.stopPropagation();
      index--;
      update();
    };
    collage.querySelector(".next").onclick = (e) => {
      e.stopPropagation();
      index++;
      update();
    };
    update();
}