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

// Sayfa Takip Sistemi
window.__apiPageTracker = window.__apiPageTracker || {}; 

// Tükenmiş Sorgu Takibi
window.__apiExhaustedQueries = window.__apiExhaustedQueries || new Set();

// GEZİ BAĞLAMI HAFIZASI
window.__lastKnownContext = window.__lastKnownContext || ""; 
window.__lastKnownCountry = window.__lastKnownCountry || ""; 

// Başlangıçta Ülkeyi Hafızaya Al
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
    if (!info) return { term: fallbackCity, context: "", country: "" };
    const props = info.properties || {};
    const addr = info.address || {};
    // En yaygın şehir alanları
    let term =
        props.city ||
        props.town ||
        props.village ||
        props.county ||
        addr.city ||
        addr.town ||
        addr.village ||
        addr.county ||
        "";

    if (
        !term &&
        props.state &&
        typeof props.state === "string"
    ) {
        // World-wide: state türü bir alan "region", "province", "area", "zone" gibi jenerikse kullanma
        const country = (props.country || "").toLowerCase();
        const s = props.state.toLowerCase();

        // region/province/area/state vurgusu dil-bazlı değil, evrensel altlık
        if (
            !/region|bölge|province|area|zone|district|departamento|departement|state|provincia|il|ile|county|depar/i.test(s) &&
            s !== country // ülkenin kendisi değil
        ) {
            term = props.state;
        }
    }

    if (!term && fallbackCity) term = fallbackCity;

    let country = props.country || addr.country || "";

    return { term: (term || "").trim(), context: "", country: country.trim() };
}
// ŞEHİR İSMİNİ CACHE'LEME
window.fetchSmartLocationName = async function(lat, lng, fallbackCity = "") {
    const latKey = Number(lat).toFixed(4);
    const lngKey = Number(lng).toFixed(4);
    const storageKey = `tt_loc_name_v36_${latKey}_${lngKey}`; // v36

    try {
        const cachedName = localStorage.getItem(storageKey);
        if (cachedName) return JSON.parse(cachedName);
    } catch(e) {}

    try {
        if (typeof window.getPlaceInfoFromLatLng === 'function') {
            const info = await window.getPlaceInfoFromLatLng(lat, lng);
            const result = extractSmartSearchTerm(info, fallbackCity);
            
            // Veriyi kaydetmeden önce hafızayı güncellemiyoruz, render içinde yapacağız.
            if (result && (result.term || result.context)) {
                try { localStorage.setItem(storageKey, JSON.stringify(result)); } catch(e) {}
            }
            return result;
        } else {
            return { term: fallbackCity, context: "", country: "" };
        }
    } catch (_) {
        return { term: fallbackCity, context: "", country: "" };
    }
};


// 3. GÖRSEL ARAMA
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

    // 1. Aday: İlçe + İl
    if (term && context) candidates.push({ query: `${term} ${context}`, label: term });
    // 2. Aday: Sadece İlçe
    if (term) candidates.push({ query: term, label: term });
    // 3. Aday: Sadece İl
    if (context && context !== term) candidates.push({ query: context, label: context });
    // 4. Aday: Ülke
    if (country) candidates.push({ query: country, label: country });

    let finalLabel = "";

    // --- DÖNGÜ ---
    for (const candidate of candidates) {
        if (accumulatedImages.length >= limit) break;

        const query = candidate.query;
        // Kaynakları (Pixabay ve Pexels) sırayla dene
        const sources = ['pixabay', 'pexels'];

        for (const source of sources) {
            if (accumulatedImages.length >= limit) break;

            const trackerKey = `${query.replace(/\s+/g, '_').toLowerCase()}_${source}`;

            if (window.__apiExhaustedQueries.has(trackerKey)) {
                continue;
            }

            let pageToFetch = window.__apiPageTracker[trackerKey] || 1;
            window.__apiPageTracker[trackerKey] = pageToFetch + 1; 

            const needed = limit - accumulatedImages.length;
            const fetchCount = Math.max(needed + 2, 4); 

            const url = `/photoget-proxy/slider?query=${encodeURIComponent(query)}&limit=${fetchCount}&per_page=${fetchCount}&count=${fetchCount}&page=${pageToFetch}&source=${source}&image_type=photo`;

            try {
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    const fetchedImages = data.images || data || [];

                    if (fetchedImages.length === 0) {
                        window.__apiExhaustedQueries.add(trackerKey);
                        continue; 
                    }

                    let addedFromThisBatch = false;
                    for (const imgUrl of fetchedImages) {
                        if (accumulatedImages.length >= limit) break;
                        
                        if (!seenUrls.has(imgUrl)) {
                            accumulatedImages.push(imgUrl);
                            seenUrls.add(imgUrl);
                            addedFromThisBatch = true;
                        }
                    }

                    if (addedFromThisBatch && !finalLabel) {
                        finalLabel = candidate.label;
                    }
                }
            } catch (e) {
                console.warn(`Collage fetch error (${source}): "${query}"`, e);
            }
        } 
    } 

    if (!finalLabel && candidates.length > 0) {
        finalLabel = candidates[candidates.length - 1].label;
    }

    return { 
        images: accumulatedImages, 
        activeLabel: finalLabel 
    };
};


// 4. RENDER İŞLEMLERİ (DÜZELTİLMİŞ HAFIZA MANTIĞI)
// ============================================================
window.renderDayCollage = async function renderDayCollage(day, dayContainer, dayItemsArr) {
    if (!dayContainer) return;
    const tripTokenAtStart = window.__activeTripSessionToken;

    let collage = dayContainer.querySelector('.day-collage');
    if (!collage) {
        collage = document.createElement('div');
        collage.className = 'day-collage';
        collage.style.cssText = "margin: 30px 0 10px 0; border-radius: 10px; overflow: hidden; position: relative; display: block; min-height: 100px;";
    }

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

    // --- 1. O günün ilk gerçek lokasyonunu bul ---
    let firstLoc = null;
    if (dayItemsArr && dayItemsArr.length > 0) {
        firstLoc = dayItemsArr.find(i => i.location && i.location.lat && !i._starter && !i._placeholder);
    }

    // --- 2. Arama objesini sadece o günün güncel item'ına göre hazırla (Hafıza YOK!) ---
let searchObj = extractSmartSearchTerm(apiObj, fallbackCity);
    if (firstLoc && typeof window.fetchSmartLocationName === 'function') {
    searchObj = await window.fetchSmartLocationName(firstLoc.location.lat, firstLoc.location.lng, "");
    // Console log ile bak:
    console.log("fetchSmartLocationName result", searchObj, firstLoc.location);
    // Halen eski city geliyorsa burada warning ver!
    if (searchObj.term?.toLowerCase() === "antalya" && firstLoc.location.lat > 37.7) {
        collage.innerHTML = "<div style='padding:16px;color:#c00'>⚠️ Fotoğraf konumu belirlenemedi</div>";
        collage.style.display = 'block';
        return;
    }
}else {
        // Tamamen boş bir gün; sadece burada hafıza kullanılır
        let rawCity = window.selectedCity || "";
        if (rawCity.includes(',')) {
            let parts = rawCity.split(',');
            searchObj.term = parts[0].trim();
            let ctry = parts[parts.length - 1].trim();
            if (ctry) {
                searchObj.country = ctry;
                window.__lastKnownCountry = ctry;
            }
        } else {
            searchObj.term = rawCity;
        }
        // Sadece burada context/country'yi hafızadan doldur!
        if (!searchObj.context && window.__lastKnownContext) searchObj.context = window.__lastKnownContext;
        if (!searchObj.country && window.__lastKnownCountry) searchObj.country = window.__lastKnownCountry;
    }

    if (!searchObj.term && !searchObj.context && !searchObj.country) {
        collage.style.display = 'none';
        return;
    }

    // --- 3. Benzersiz kimlik (sadece ANLIK değerler!) ---
    const currentIdentifier = `${searchObj.term}_${searchObj.context}_${searchObj.country}`.replace(/\s+/g, '_');
    const previousIdentifier = collage.getAttribute('data-collage-id');

    // --- 4. Kullanılmış set & cache key yönetimi ---
    if (!window.__globalCollageUsedByTrip) window.__globalCollageUsedByTrip = {};
    if (!window.__globalCollageUsedByTrip[tripTokenAtStart]) {
        window.__globalCollageUsedByTrip[tripTokenAtStart] = new Set();
    }
    const usedSet = window.__globalCollageUsedByTrip[tripTokenAtStart];
    const cacheKey = `tt_day_collage_v37_${day}_${currentIdentifier}_combined`;

    let images = [];
    let fromCache = false;

    // --- 5. Eğer konum değiştiyse eski sliderı/tüm içeriği tamamen sıfırla !!!
    if (currentIdentifier !== previousIdentifier) {
        collage.setAttribute('data-collage-id', currentIdentifier);
        collage.innerHTML = "";
        fromCache = false;
    }

    // --- 6. Cache ancak kimlikler EŞİTSE ve cache'ten doluyorsa kullanılır ---
    if (currentIdentifier === collage.getAttribute('data-collage-id')) {
        try {
            const cachedData = localStorage.getItem(cacheKey);
            if (cachedData) {
                const parsed = JSON.parse(cachedData);
                if (parsed && parsed.images && parsed.images.length > 0) {
                    images = parsed.images;
                    fromCache = true;
                    images.forEach(img => usedSet.add(img));
                }
            }
        } catch (e) {}
    }

    // --- 7. Cache yoksa, doğrudan arama yap ---
    if (!fromCache || images.length === 0) {
        if (window.__activeTripSessionToken !== tripTokenAtStart) return;
        if (typeof window.getCityCollageImages === 'function') {
            const result = await window.getCityCollageImages(searchObj, {
                min: 4,
                exclude: usedSet
            });
            images = result.images || [];
        }
        if (window.__activeTripSessionToken !== tripTokenAtStart) return;
        if (images.length > 0) {
            images.forEach(img => usedSet.add(img));
            try {
                localStorage.setItem(cacheKey, JSON.stringify({ images: images }));
            } catch (e) {
                console.warn("[Collage] Storage write error:", e);
            }
        }
    }

    // --- 8. Render ---
    if (images.length > 0 && typeof renderCollageSlides === 'function') {
        collage.setAttribute('data-collage-id', currentIdentifier);
        renderCollageSlides(collage, images, searchObj);
        collage.style.display = 'block';
    } else {
        collage.style.display = 'none';
    }
};


// 5. SLIDER RENDERER (BAŞLIK & ALT YAZI & DEDUPLICATION)
// ============================================================
function renderCollageSlides(collage, images, searchObj) {
    const isMobile = window.innerWidth < 600;
    const visible = isMobile ? 2 : 3;
    let index = 0;
  
    // --- BAŞLIK OLUŞTURMA ---
    let rawParts = [searchObj.term, searchObj.context, searchObj.country];
    
    if (!searchObj.country && window.__lastKnownCountry) {
        rawParts.push(window.__lastKnownCountry);
    }

    let allParts = rawParts
        .join(",")
        .split(",")
        .map(s => s.trim())
        .filter(s => s.length > 0 && isNaN(s)); 
    
    let uniqueParts = [...new Set(allParts)];
    let displayTerm = uniqueParts.join(", ");

    const topHeaderHtml = displayTerm
      ? `<div style="font-weight: bold; font-size: 0.95rem; color: rgb(51, 51, 51); margin-bottom: 10px;">Photos related to ${displayTerm}</div>`
      : "";
  
    const badgeHtml = displayTerm
      ? `<div style="position:absolute; top:12px; left:12px; z-index:2; background:rgba(0,0,0,0.6); color:#fff; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:600; pointer-events:none;">${displayTerm}</div>`
      : "";

    // Alt Yazı
    const footerHtml = `
      <div style="font-size: 0.8rem; color: #666; margin-top: 8px; text-align: left; font-style: italic;">
        Inspiring visuals for your trip
      </div>
    `;

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
      ${footerHtml}
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