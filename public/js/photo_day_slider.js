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


// 2. HİYERARŞİ ANALİZİ VE İSİM ÇIKARMA
// ============================================================
function extractSmartSearchTerm(info, fallbackCity = "") {
    if (!info) return { term: fallbackCity, context: "", country: "" };

    const props = info.properties || {};
    const addr = info.address || props.address || {}; 

    const district = addr.district || addr.county || props.district || props.county || "";
    const city = addr.city || addr.town || addr.village || props.city || props.town || "";
    const state = addr.state || addr.province || props.state || "";
    const country = addr.country || props.country || "Turkey";

    // 1. ADIM: İLÇE TESPİTİ
    let term = "";
    if (district && district.toLowerCase() !== state.toLowerCase() && district.toLowerCase() !== city.toLowerCase()) {
        if (!district.toLowerCase().includes("merkez")) {
            term = district;
        }
    }

    // 2. ADIM: ŞEHİR TESPİTİ
    let context = city;
    if (!context && state) context = state;
    
    // Fallback
    if (!term && !context) {
        term = fallbackCity;
    } else if (!term) {
        term = context;
    }

    return { 
        term: term || context || fallbackCity, 
        context: context || term || "", 
        country: country 
    };
}

// ŞEHİR İSMİNİ CACHE'LEME
window.fetchSmartLocationName = async function(lat, lng, fallbackCity = "") {
    const latKey = Number(lat).toFixed(4);
    const lngKey = Number(lng).toFixed(4);
    const storageKey = `tt_loc_name_v17_${latKey}_${lngKey}`; // v17

    try {
        const cachedName = localStorage.getItem(storageKey);
        if (cachedName) return JSON.parse(cachedName);
    } catch(e) {}

    try {
        if (typeof window.getPlaceInfoFromLatLng === 'function') {
            const info = await window.getPlaceInfoFromLatLng(lat, lng);
            const result = extractSmartSearchTerm(info, fallbackCity);
            
            if (result && result.term) {
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


// 3. GÖRSEL ARAMA (HINDI FOTOĞRAFLARINI ENGELLEYEN MOD)
// ============================================================
window.getCityCollageImages = async function(searchObj, options = {}) {
    const term = searchObj.term;    // İlçe
    const context = searchObj.context; // İl

    if (!term && !context) return [];

    const limit = options.min || 4; 
    let accumulatedImages = [];
    const seenUrls = new Set(); 

    if (options.exclude && options.exclude instanceof Set) {
        options.exclude.forEach(u => seenUrls.add(u));
    }

    // --- SORGULARI OLUŞTUR ---
    const queries = [];
    const buildQuery = (...parts) => {
        return [...new Set(parts.map(p => (p || "").trim()).filter(Boolean))].join(" ");
    };

    // 1. ÖNCELİK: İlçe + İl (Örn: "Bodrum Mugla")
    if (term && context && term !== context) {
        queries.push(buildQuery(term, context));
    }

    // 2. ÖNCELİK: Sadece İl (Örn: "Mugla")
    if (context) {
        queries.push(context);
    }

    // 3. YEDEK: Sadece İlçe (Örn: "Bodrum")
    if (term && term !== context) {
        queries.push(term);
    }

    // --- ARAMA DÖNGÜSÜ ---
    for (const query of queries) {
        if (accumulatedImages.length >= limit) break;

        // Sayfa Takip
        const trackerKey = query.replace(/\s+/g, '_').toLowerCase();
        let pageToFetch = window.__apiPageTracker[trackerKey] || 1;

        const needed = limit - accumulatedImages.length;
        const fetchCount = Math.max(needed + 2, 4);

        // --- GÜVENLİK DUVARI ---
        // Sorgunun içinden "Turkey" kelimesini SİLİYORUZ.
        // Böylece "Bodrum, Turkey" gelse bile API'ye "Bodrum" gider.
        let cleanQuery = encodeURIComponent(query.replace(/Turkey/gi, "").replace(/Türkiye/gi, "").trim());
        
        // Eğer query boşaldıysa (sadece Turkey yazıyorsa) devam etme
        if(!cleanQuery || cleanQuery.length < 2) continue;

        const url = `/photoget-proxy/slider?query=${cleanQuery}&limit=${fetchCount}&per_page=${fetchCount}&count=${fetchCount}&page=${pageToFetch}&source=pixabay&image_type=photo`;

        try {
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                const fetchedImages = data.images || data || [];

                let foundNewForThisPage = false;
                for (const imgUrl of fetchedImages) {
                    if (accumulatedImages.length >= limit) break;
                    
                    if (!seenUrls.has(imgUrl)) {
                        accumulatedImages.push(imgUrl);
                        seenUrls.add(imgUrl);
                        foundNewForThisPage = true;
                    }
                }

                if (fetchedImages.length > 0) {
                    window.__apiPageTracker[trackerKey] = pageToFetch + 1;
                }
            }
        } catch (e) {
            console.warn(`Collage fetch error: "${query}"`, e);
        }
    }

    return accumulatedImages;
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

    // Varsayılan değerler
    let searchObj = { term: "", context: "", country: "" };
    
    // Durum 1: Gün içinde gezi noktası varsa
    if (firstLoc && typeof window.fetchSmartLocationName === 'function') {
        searchObj = await window.fetchSmartLocationName(firstLoc.location.lat, firstLoc.location.lng, window.selectedCity);
    } 
    // Durum 2: Gün boşsa (Add New Day) -> selectedCity'den çek
    else {
        let rawCity = window.selectedCity || "";
        // "Bodrum, Turkey" gelirse virgülden sonrasını atıp sadece "Bodrum" alıyoruz.
        // Bu sayede arama terimine Turkey bulaşmıyor.
        let safeCity = rawCity.split(',')[0].trim(); 
        
        searchObj.term = safeCity;
        // searchObj.country boş kalıyor.
    }

    if (!searchObj.term && !searchObj.context) {
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
    const cacheKey = `tt_day_collage_v17_${day}_${safeTerm}_pixabay`;
    
    let images = [];
    let fromCache = false;

    try {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
            const parsed = JSON.parse(cachedData);
            if (Array.isArray(parsed) && parsed.length > 0) {
                images = parsed;
                fromCache = true;
                images.forEach(img => usedSet.add(img));
            }
        }
    } catch (e) {}

    // E. API'den Çek
    if (!fromCache || images.length === 0) {
        if (window.__activeTripSessionToken !== tripTokenAtStart) return;

        if (typeof window.getCityCollageImages === 'function') {
            
            console.log(`[Collage] API Req: ${searchObj.term} ${searchObj.context}`);
            
            images = await window.getCityCollageImages(searchObj, {
                min: 4, 
                exclude: usedSet
            });
        }

        if (window.__activeTripSessionToken !== tripTokenAtStart) return;

        if (images.length > 0) {
            images.forEach(img => usedSet.add(img));
            try {
                localStorage.setItem(cacheKey, JSON.stringify(images));
            } catch (e) {
                console.warn("[Collage] Storage write error:", e);
            }
        }
    }

    // F. Render
    if (images.length > 0 && typeof renderCollageSlides === 'function') {
        renderCollageSlides(collage, images, searchObj);
        collage.style.display = 'block';
    } else {
        collage.style.display = 'none';
    }
};


// 5. SLIDER RENDERER (Turkey Yazısını Gizlemek İçin)
// ============================================================
function renderCollageSlides(collage, images, searchObj) {
    const isMobile = window.innerWidth < 600;
    const visible = isMobile ? 2 : 3;
    let index = 0;
  
    // --- BAŞLIK KISMI ---
    let displayParts = [];
    if (searchObj.term) displayParts.push(searchObj.term);
    if (searchObj.context && searchObj.context !== searchObj.term) displayParts.push(searchObj.context);
    
    // Country'i başlığa eklerken de kontrol edelim, eğer istiyorsan ekleyebilirsin
    // Ama "Turkey" tekrarını istemiyorsan ve sade olsun diyorsan eklemeyebiliriz.
    // Şimdilik ekliyorum ama yukarıdaki mantıkla "Bodrum, Turkey" gelir, "Turkey, Turkey" gelmez.
    if (searchObj.country) displayParts.push(searchObj.country);

    let uniqueParts = [...new Set(displayParts)];
    let displayTerm = uniqueParts.join(", ");

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