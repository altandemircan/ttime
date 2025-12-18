// ============================================================
// photo_day_slider.js
// Gün bazlı fotoğraf kolajı (slider) ve akıllı konum bulma modülü
// ============================================================

// 1. TOKEN VE GLOBAL DEĞİŞKENLER
// ============================================================
window.__ttNewTripToken = window.__ttNewTripToken || function () {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

if (!window.__activeTripSessionToken) {
    window.__activeTripSessionToken = window.__ttNewTripToken();
}

// Global Cache Objeleri
window.__dayCollagePhotosByTrip = window.__dayCollagePhotosByTrip || {};
window.__globalCollageUsedByTrip = window.__globalCollageUsedByTrip || {};


// 2. HİYERARŞİ ANALİZİ VE İSİM ÇIKARMA
// ============================================================
function extractSmartSearchTerm(info, fallbackCity = "") {
    if (!info) return { term: fallbackCity, context: "", country: "" };

    const props = info.properties || {};
    const addr = info.address || props.address || {}; 

    const district = addr.district || addr.county || props.district || props.county || "";
    const city = addr.city || addr.town || addr.village || props.city || props.town || "";
    const state = addr.state || addr.province || props.state || "";
    const country = addr.country || props.country || "Turkey"; // Varsayılan ülke

    // 1. KURAL: İlçe
    if (district && district.toLowerCase() !== state.toLowerCase()) {
        if (!district.toLowerCase().includes("merkez")) {
            return { term: district, context: state || city, country: country }; 
        }
    }

    // 2. KURAL: Şehir/İl
    if (city) return { term: city, context: state, country: country };
    if (state) return { term: state, context: "", country: country };

    // 3. KURAL: Fallback
    return { term: fallbackCity, context: "", country: country || "Turkey" };
}

// GÜNCELLENDİ: ŞEHİR İSMİNİ DE CACHE'LİYORUZ
window.fetchSmartLocationName = async function(lat, lng, fallbackCity = "") {
    const latKey = Number(lat).toFixed(4);
    const lngKey = Number(lng).toFixed(4);
    // Cache versiyonunu değiştirdik (v3) ki eski hatalı isimler silinsin
    const storageKey = `tt_loc_name_v3_${latKey}_${lngKey}`;

    try {
        const cachedName = localStorage.getItem(storageKey);
        if (cachedName) return JSON.parse(cachedName);
    } catch(e) {}

    try {
        if (typeof window.getPlaceInfoFromLatLng === 'function') {
            const info = await window.getPlaceInfoFromLatLng(lat, lng);
            const result = extractSmartSearchTerm(info, fallbackCity);
            
            if (result && result.term && result.term !== fallbackCity) {
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


// 3. GÖRSEL ARAMA (AKILLI SORGULAMA ZİNCİRİ)
// ============================================================
window.getCityCollageImages = async function(searchObj, options = {}) {
    const baseTerm = searchObj.term; // Örn: Kale
    const context = searchObj.context || ""; // Örn: Antalya
    const country = searchObj.country || "Turkey"; // Örn: Turkey

    if (!baseTerm) return [];

    const limit = options.min || 4; 
    const page = options.page || 1; 
    
    let accumulatedImages = [];
    const seenUrls = new Set(); 

    if (options.exclude && options.exclude instanceof Set) {
        options.exclude.forEach(u => seenUrls.add(u));
    }

    // --- SORGULARI OLUŞTUR ---
    const queries = [];

    // Yardımcı: Kelimeleri birleştir
    const buildQuery = (...parts) => {
        return [...new Set(parts.map(p => (p || "").trim()).filter(Boolean))].join(" ");
    };

    // 1. EN İYİ: "Kale Antalya Turkey tourism"
    // (Ülke adı MUTLAKA ekleniyor ki Almanya gelmesin)
    queries.push(buildQuery(baseTerm, context, country, "tourism"));

    // 2. YER VE ÜLKE: "Kale Turkey" 
    // (Eğer ilçe ismi çok genel ise ülke onu kurtarır)
    queries.push(buildQuery(baseTerm, country, "landmark"));

    // 3. BAĞLAM + ÜLKE: "Antalya Turkey travel"
    // (Eğer ilçe bulunamazsa şehrin fotoları gelir)
    if (context && context !== baseTerm) {
        queries.push(buildQuery(context, country, "travel"));
    }

    // 4. SON ÇARE: "Turkey tourism"
    if (country) {
        queries.push(buildQuery(country, "tourism travel"));
    }

    // --- DÖNGÜ ---
    for (const query of queries) {
        if (accumulatedImages.length >= limit) break;

        const needed = limit - accumulatedImages.length;
        // Biraz bol isteyelim ki duplicate varsa elensin
        const fetchCount = Math.max(needed + 2, 4);

        const url = `/photoget-proxy/slider?query=${encodeURIComponent(query)}&limit=${fetchCount}&per_page=${fetchCount}&count=${fetchCount}&page=${page}&source=pixabay&image_type=photo&category=travel`;

        try {
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                const fetchedImages = data.images || data || [];

                for (const imgUrl of fetchedImages) {
                    if (accumulatedImages.length >= limit) break;
                    // Global olarak daha önce kullanıldı mı kontrol et
                    if (!seenUrls.has(imgUrl)) {
                        accumulatedImages.push(imgUrl);
                        seenUrls.add(imgUrl);
                    }
                }
            }
        } catch (e) {
            console.warn(`Collage fetch failed for query: "${query}"`, e);
        }
    }

    return accumulatedImages;
};


// 4. RENDER İŞLEMLERİ (Collage & Slider)
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

    // --- C. KONUM BELİRLEME (GÜNÜN İLK ÖĞESİ) ---
    let firstLoc = null;
    if (dayItemsArr && dayItemsArr.length > 0) {
        // Koordinatı olan ilk geçerli öğeyi bul
        firstLoc = dayItemsArr.find(i => i.location && i.location.lat && !i._starter && !i._placeholder);
    }

    let searchObj = { term: window.selectedCity || "", context: "", country: "" };
    
    // Eğer günün ilk öğesi varsa onun koordinatını kullan (Şehir değişirse algılar)
    if (firstLoc && typeof window.fetchSmartLocationName === 'function') {
        searchObj = await window.fetchSmartLocationName(firstLoc.location.lat, firstLoc.location.lng, window.selectedCity);
    }

    if (!searchObj || !searchObj.term) {
        collage.style.display = 'none';
        return;
    }

    // D. Cache Kontrolü
    if (!window.__globalCollageUsedByTrip) window.__globalCollageUsedByTrip = {};
    if (!window.__globalCollageUsedByTrip[tripTokenAtStart]) {
        window.__globalCollageUsedByTrip[tripTokenAtStart] = new Set();
    }
    const usedSet = window.__globalCollageUsedByTrip[tripTokenAtStart];

    // Cache Key: Gün + Terim (v3)
    const safeTerm = searchObj.term.replace(/\s+/g, '_');
    const cacheKey = `tt_day_collage_v3_${day}_${safeTerm}_pixabay`;
    
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
                console.log(`[Collage] Cache'den yüklendi (Gün ${day}):`, searchObj.term);
            }
        }
    } catch (e) {}

    // E. API'den Çek (Cache yoksa)
    if (!fromCache || images.length === 0) {
        if (window.__activeTripSessionToken !== tripTokenAtStart) return;

        if (typeof window.getCityCollageImages === 'function') {
            
            // --- KRİTİK DÜZELTME: SAYFALAMA (PAGINATION) ---
            // Her gün için farklı sayfa iste ki aynı resimler gelmesin.
            // Gün 1 -> Sayfa 1
            // Gün 2 -> Sayfa 2
            let pageNum = 1;
            if (typeof day === 'number') {
                pageNum = day;
            } else if (typeof day === 'string') {
                const match = day.match(/\d+/);
                if (match) pageNum = parseInt(match[0], 10);
            }
            if (!pageNum || pageNum < 1) pageNum = 1;

            console.log(`[Collage] API İsteği: ${searchObj.term} (${searchObj.country}) - Sayfa: ${pageNum}`);
            
            images = await window.getCityCollageImages(searchObj, {
                min: 4, 
                exclude: usedSet,
                page: pageNum // Sayfa numarasını gönderiyoruz
            });
        }

        if (window.__activeTripSessionToken !== tripTokenAtStart) return;

        if (images.length > 0) {
            images.forEach(img => usedSet.add(img));
            try {
                localStorage.setItem(cacheKey, JSON.stringify(images));
            } catch (e) {
                console.warn("[Collage] Storage hatası:", e);
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


// 5. SLIDER RENDERER (INFO ICON & TOOLTIP)
// ============================================================
function renderCollageSlides(collage, images, searchObj) {
    const isMobile = window.innerWidth < 600;
    const visible = isMobile ? 2 : 3;
    let index = 0;
  
    // Başlık
    let displayTerm = searchObj.term;
    if (searchObj.context && !displayTerm.includes(searchObj.context)) displayTerm += `, ${searchObj.context}`;
    if (searchObj.country && !displayTerm.includes(searchObj.country)) displayTerm += `, ${searchObj.country}`;

    const topHeaderHtml = displayTerm
      ? `<div style="font-weight: bold; font-size: 0.95rem; color: rgb(51, 51, 51); margin-bottom: 10px;">Photos related to ${displayTerm}</div>`
      : "";
  
    const badgeHtml = displayTerm
      ? `<div style="position:absolute; top:12px; left:12px; z-index:2; background:rgba(0,0,0,0.6); color:#fff; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:600; pointer-events:none;">${displayTerm}</div>`
      : "";

    // Info İkonu ve Tooltip (Sağ Alt Köşe)
    const infoIconHtml = `
    <span class="info-icon-wrapper" style="position: absolute; right: 10px; bottom: 10px; width: 32px; height: 32px; background: rgba(255,255,255,0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.2); cursor: help; z-index: 10;">
        <img src="https://www.svgrepo.com/show/474873/info.svg" alt="Info" style="width: 18px; height: 18px; opacity: 0.7;">
        
        <div class="info-tooltip" style="display: none; position: absolute; bottom: 100%; right: 0; width: 220px; background: #333; color: #fff; padding: 8px 12px; border-radius: 6px; font-size: 11px; line-height: 1.4; text-align: left; margin-bottom: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 100; pointer-events: none;">
            Photos associated with this place are matched by analyzing search results and may not reflect reality.
            <div style="position: absolute; bottom: -6px; right: 10px; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 6px solid #333;"></div>
        </div>
    </span>
    <style>
        .info-icon-wrapper:hover .info-tooltip { display: block !important; }
    </style>
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