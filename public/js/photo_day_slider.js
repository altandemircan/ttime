// ============================================================
// photo_day_slider.js
// Gün bazlı fotoğraf kolajı (slider) ve akıllı konum bulma modülü
// ============================================================

// 1. TOKEN VE GLOBAL DEĞİŞKENLER (Race Condition Fix)
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
    if (!info) return fallbackCity || "";

    const props = info.properties || {};
    const addr = info.address || props.address || {}; 

    const suburb = addr.suburb || addr.neighbourhood || props.suburb || "";
    const district = addr.district || addr.county || props.district || props.county || "";
    const city = addr.city || addr.town || addr.village || props.city || props.town || "";
    const state = addr.state || addr.province || props.state || "";
    const country = addr.country || props.country || "Turkey";

    // 1. KURAL: İlçe (District) var mı? (Örn: Kaş, Alanya)
    if (district && district.toLowerCase() !== state.toLowerCase()) {
        if (!district.toLowerCase().includes("merkez")) {
            return { term: district, context: state }; 
        }
    }

    // 2. KURAL: Şehir/İl
    if (city) return { term: city, context: country };
    if (state) return { term: state, context: country };

    // 3. KURAL: Fallback
    return { term: fallbackCity, context: "" };
}

window.fetchSmartLocationName = async function(lat, lng, fallbackCity = "") {
    try {
        // mainscript.js içindeki fonksiyonu kullanır
        if (typeof window.getPlaceInfoFromLatLng === 'function') {
            const info = await window.getPlaceInfoFromLatLng(lat, lng);
            return extractSmartSearchTerm(info, fallbackCity);
        } else {
            return { term: fallbackCity, context: "" };
        }
    } catch (_) {
        return { term: fallbackCity, context: "" };
    }
};


// ============================================================
// 3. GÖRSEL ARAMA (API İSTEĞİ - PIXABAY)
// ============================================================
window.getCityCollageImages = async function(searchObj, options = {}) {
    const term = searchObj.term;
    if (!term) return [];

    // İstenen görsel sayısı (Varsayılan 6)
    const limit = options.min || 4; 
    const page = options.page || 1; 

    // URL Parametreleri:
    // limit: Bizim proxy'nin beklediği olası parametre
    // per_page: Pexels/Pixabay'ın orijinal parametresi (Proxy paslıyorsa diye)
    // count: Bazı proxy yapılarında kullanılan miktar parametresi
    const url = `/photoget-proxy/slider?query=${encodeURIComponent(term)}&limit=${limit}&per_page=${limit}&count=${limit}&page=${page}&source=pixabay`;

    try {
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        // Dönen veriyi normalize et (images dizisi veya direkt dizi)
        return data.images || data || [];
    } catch (e) {
        console.warn("Collage fetch error:", e);
        return [];
    }
};


// 4. RENDER İŞLEMLERİ (Collage & Slider)
// ============================================================
// ============================================================
// 4. RENDER İŞLEMLERİ (Collage & Slider)
// ============================================================
window.renderDayCollage = async function renderDayCollage(day, dayContainer, dayItemsArr) {
    if (!dayContainer) return;
    
    // Token kontrolü: Eski gezinin resimleri yeni geziye karışmasın
    const tripTokenAtStart = window.__activeTripSessionToken;

    // A. Collage Alanını DOM'a Ekle (Yoksa oluştur)
    let collage = dayContainer.querySelector('.day-collage');
    if (!collage) {
        collage = document.createElement('div');
        collage.className = 'day-collage';
        // Min-height, görsel yüklenene kadar alanın çökmesini engeller
        collage.style.cssText = "margin: 12px 0px 6px; border-radius: 10px; overflow: hidden; position: relative; display: block; min-height: 100px;";
        
        const list = dayContainer.querySelector('.day-list');
        if (list) {
            list.insertAdjacentElement('afterend', collage);
        } else {
            dayContainer.appendChild(collage);
        }
    }

    // B. Arama Terimini Belirle (Akıllı Konum)
    let firstLoc = null;
    if (dayItemsArr && dayItemsArr.length > 0) {
        firstLoc = dayItemsArr.find(i => i.location && i.location.lat);
    }

    let searchObj = { term: window.selectedCity || "", context: "" };
    
    // fetchSmartLocationName fonksiyonu photo_day_slider.js içinde tanımlı olmalı
    if (firstLoc && typeof window.fetchSmartLocationName === 'function') {
        searchObj = await window.fetchSmartLocationName(firstLoc.location.lat, firstLoc.location.lng, window.selectedCity);
    }

    // Terim yoksa gizle
    if (!searchObj || !searchObj.term) {
        collage.style.display = 'none';
        return;
    }

    // C. Cache Kontrolü (Aynı resimleri tekrar çekmemek için)
    if (!window.__globalCollageUsedByTrip) window.__globalCollageUsedByTrip = {};
    if (!window.__globalCollageUsedByTrip[tripTokenAtStart]) {
        window.__globalCollageUsedByTrip[tripTokenAtStart] = new Set();
    }
    const usedSet = window.__globalCollageUsedByTrip[tripTokenAtStart];

    // Cache Key: Pixabay'a özel key kullanıyoruz
    const safeTerm = searchObj.term.replace(/\s+/g, '_');
    const cacheKey = `tt_day_collage_${day}_${safeTerm}_pixabay_v1`;
    
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
                console.log(`[Collage] Loaded from localStorage (Pixabay) for Day ${day}:`, searchObj.term);
            }
        }
    } catch (e) {
        console.warn("[Collage] Storage read error:", e);
    }

    // D. API'den Çek (Eğer cache boşsa)
    if (!fromCache || images.length === 0) {
        // Kullanıcı bu sırada geziyi değiştirdiyse işlemi durdur
        if (window.__activeTripSessionToken !== tripTokenAtStart) return;

        if (typeof window.getCityCollageImages === 'function') {
            let pageNum = 1;
            // Sayfa numarasını günden türet (Day 1 -> Page 1, Day 2 -> Page 2)
            if (typeof day === 'number') {
                pageNum = day;
            } else if (typeof day === 'string') {
                const match = day.match(/\d+/);
                if (match) pageNum = parseInt(match[0], 10);
            }
            if (!pageNum || pageNum < 1) pageNum = 1;

            console.log(`[Collage] API Çağırılıyor -> Şehir: ${searchObj.term}, Kaynak: Pixabay`);
            
            // 6 Adet görsel istiyoruz
            images = await window.getCityCollageImages(searchObj, {
                min: 6,
                exclude: usedSet,
                page: pageNum
            });
        }

        // Tekrar token kontrolü (API cevabı gelene kadar gezi değişmiş olabilir)
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

    // E. Render (Ekrana Çiz)
    if (images.length > 0 && typeof renderCollageSlides === 'function') {
        renderCollageSlides(collage, images, searchObj);
        collage.style.display = 'block';
    } else {
        collage.style.display = 'none';
    }
};


// 5. SLIDER RENDERER (Yardımcı Fonksiyon)
// ============================================================
function renderCollageSlides(collage, images, searchObj) {
    const isMobile = window.innerWidth < 600;
    const visible = isMobile ? 2 : 3;
    let index = 0;
  
    const term = searchObj?.term || "";
  
    // Başlık
    const topHeaderHtml = term
      ? `<div style="font-weight: bold; font-size: 0.95rem; color: rgb(51, 51, 51); margin-bottom: 10px;">Photos related to ${term}</div>`
      : "";
  
    // Resim üstü etiket
    const badgeHtml = term
      ? `<div style="position:absolute; top:12px; left:12px; z-index:2; background:rgba(0,0,0,0.6); color:#fff; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:600; pointer-events:none;">${term}</div>`
      : "";
  
    collage.innerHTML = `
      ${topHeaderHtml}
      <div class="collage-viewport" style="overflow:hidden; width:100%; position:relative; border-radius:8px;">
        ${badgeHtml}
        <div class="collage-track" style="display:flex; transition: transform 0.4s ease-out; will-change: transform;"></div>
      </div>
      <button class="collage-nav prev" style="position:absolute; left:6px; top:50%; transform:translateY(-50%); background:rgba(255,255,255,0.9); color:#000; border:none; border-radius:50%; width:32px; height:32px; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow: 0 2px 6px rgba(0,0,0,0.3); z-index:5;">❮</button>
      <button class="collage-nav next" style="position:absolute; right:6px; top:50%; transform:translateY(-50%); background:rgba(255,255,255,0.9); color:#000; border:none; border-radius:50%; width:32px; height:32px; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow: 0 2px 6px rgba(0,0,0,0.3); z-index:5;">❯</button>
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