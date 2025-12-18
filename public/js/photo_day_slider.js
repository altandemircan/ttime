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

    // 1. KURAL: İlçe (District) var mı?
    if (district && district.toLowerCase() !== state.toLowerCase()) {
        if (!district.toLowerCase().includes("merkez")) {
            // Örn: "Miraflores" yerine "Miraflores Peru" döndür
            return { term: `${district} ${country}`, context: state }; 
        }
    }

    // 2. KURAL: Şehir/İl
    if (city) return { term: `${city} ${country}`, context: country }; // "Lima Peru"
    if (state) return { term: `${state} ${country}`, context: country };

    // 3. KURAL: Fallback
    return { term: fallbackCity, context: "" };
}

// GÜNCELLENDİ: ŞEHİR İSMİNİ DE CACHE'LİYORUZ (Sorunun Çözümü Burada)
window.fetchSmartLocationName = async function(lat, lng, fallbackCity = "") {
    // A. Önce LocalStorage Cache'ine Bak (Koordinat bazlı)
    // Koordinatları yuvarla ki ufak sapmalarda da aynı yeri hatırlasın
    const latKey = Number(lat).toFixed(4);
    const lngKey = Number(lng).toFixed(4);
    const storageKey = `tt_loc_name_${latKey}_${lngKey}`;

    try {
        const cachedName = localStorage.getItem(storageKey);
        if (cachedName) {
            // Cache varsa API'ye gitme, direkt hafızadan kullan
            // Bu sayede "Tokyo" ismi asla kaybolmaz.
            return JSON.parse(cachedName);
        }
    } catch(e) {}

    // B. Cache Yoksa API'den Çek
    try {
        if (typeof window.getPlaceInfoFromLatLng === 'function') {
            const info = await window.getPlaceInfoFromLatLng(lat, lng);
            const result = extractSmartSearchTerm(info, fallbackCity);
            
            // C. Sonucu Kaydet (Gelecek sefer için)
            if (result && result.term && result.term !== fallbackCity) {
                try {
                    localStorage.setItem(storageKey, JSON.stringify(result));
                } catch(e) {}
            }
            return result;
        } else {
            return { term: fallbackCity, context: "" };
        }
    } catch (_) {
        return { term: fallbackCity, context: "" };
    }
};


// ============================================================
// 3. GÖRSEL ARAMA (AKILLI FALLBACK MEKANİZMASI)
// ============================================================
window.getCityCollageImages = async function(searchObj, options = {}) {
    const baseTerm = searchObj.term;
    if (!baseTerm) return [];

    const limit = options.min || 4; // Hedeflenen sayı
    const page = options.page || 1; 
    
    // Toplanan resimleri ve mükerrer kontrolü için seti hazırla
    let accumulatedImages = [];
    const seenUrls = new Set(); 

    // Daha önce kullanılmış (exclude) resimleri de set'e ekle ki aynısı gelmesin
    if (options.exclude && options.exclude instanceof Set) {
        options.exclude.forEach(u => seenUrls.add(u));
    }

    // --- ARAMA STRATEJİLERİ LİSTESİ ---
    // Sırayla bunları deneyecek
    const queries = [];

    // 1. Öncelik: Şehir + Turistik Kelimeler (En kaliteli sonuç)
    // Eğer kelime çok uzun değilse ekle (Örn: "Machu Picchu..." zaten uzundur, bozmayalım)
    if (baseTerm.split(' ').length < 4) {
        queries.push(`${baseTerm} tourism travel landmark`);
    }

    // 2. Öncelik: Sadece Şehir Adı (Geniş arama)
    queries.push(baseTerm);

    // 3. Öncelik: Ülke + Turizm (Şehirde resim yoksa ülkeyi göster)
    if (searchObj.context && searchObj.context.trim() !== "") {
        // Eğer şehir ve ülke aynıysa (örn: Singapore) tekrar ekleme
        if (searchObj.context.toLowerCase() !== baseTerm.toLowerCase()) {
            queries.push(`${searchObj.context} tourism travel`);
        }
    }

    // --- DÖNGÜ: YETERLİ SAYIYA ULAŞANA KADAR ÇEK ---
    for (const query of queries) {
        // Eğer hedef sayıya (limit) ulaştıysak döngüyü bitir
        if (accumulatedImages.length >= limit) break;

        // Eksik kalan miktar kadar (veya biraz fazlasını) iste
        const needed = limit - accumulatedImages.length;
        // API'den biraz bol isteyelim ki duplikeleri elerken sayı düşmesin
        const fetchCount = Math.max(needed + 2, 4);

        const url = `/photoget-proxy/slider?query=${encodeURIComponent(query)}&limit=${fetchCount}&per_page=${fetchCount}&count=${fetchCount}&page=${page}&source=pixabay&image_type=photo&category=travel`;

        try {
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                const fetchedImages = data.images || data || [];

                // Gelen resimleri kontrol et ve listeye ekle
                for (const imgUrl of fetchedImages) {
                    if (accumulatedImages.length >= limit) break; // Kota dolduysa dur

                    // Eğer bu resim daha önce eklenmemişse ekle
                    if (!seenUrls.has(imgUrl)) {
                        accumulatedImages.push(imgUrl);
                        seenUrls.add(imgUrl);
                    }
                }
            }
        } catch (e) {
            console.warn(`Collage fetch failed for query: "${query}"`, e);
            // Hata olsa bile döngü devam eder, bir sonraki stratejiye geçer
        }
    }

    // Eğer tüm çabalara rağmen hiç resim yoksa veya eksikse, yapacak bir şey yok eldekini dön
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
        // Min-height, görsel yüklenene kadar alanın çökmesini engeller
        collage.style.cssText = "margin: 30px 0 10px 0; border-radius: 10px; overflow: hidden; position: relative; display: block; min-height: 100px;";
    }

    // B. DOM'a Yerleştirme (UL -> Mevcut Buton -> Collage)
    const list = dayContainer.querySelector('.day-list');
    if (list) {
        // Listenin içindeki mevcut "Add Category" butonunu bul
        const addBtn = list.querySelector('.add-more-btn');
        
        if (addBtn) {
            // Buton varsa, collage'ı butonun hemen sonrasına ekle
            if (addBtn.nextElementSibling !== collage) {
                addBtn.insertAdjacentElement('afterend', collage);
            }
        } else {
            // Buton yoksa listenin en sonuna ekle (Fallback)
            if (list.lastElementChild !== collage) {
                list.appendChild(collage);
            }
        }
    } else {
        // Liste hiç yoksa container'a ekle (Fallback)
        dayContainer.appendChild(collage);
    }

    // --- C. Arama Terimi ve Resim Mantığı ---

    let firstLoc = null;
    if (dayItemsArr && dayItemsArr.length > 0) {
        firstLoc = dayItemsArr.find(i => i.location && i.location.lat);
    }

    let searchObj = { term: window.selectedCity || "", context: "" };
    
    // fetchSmartLocationName artık cache'li çalışıyor, isim değişmeyecek.
    if (firstLoc && typeof window.fetchSmartLocationName === 'function') {
        searchObj = await window.fetchSmartLocationName(firstLoc.location.lat, firstLoc.location.lng, window.selectedCity);
    }

    if (!searchObj || !searchObj.term) {
        collage.style.display = 'none';
        return;
    }

    // D. Cache Kontrolü (Resim Cache'i)
    if (!window.__globalCollageUsedByTrip) window.__globalCollageUsedByTrip = {};
    if (!window.__globalCollageUsedByTrip[tripTokenAtStart]) {
        window.__globalCollageUsedByTrip[tripTokenAtStart] = new Set();
    }
    const usedSet = window.__globalCollageUsedByTrip[tripTokenAtStart];

    // İsim sabitlendiği için bu KEY de artık sabit kalacak ve eski resimleri hep bulacak.
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

    // E. API'den Çek (Cache yoksa)
    if (!fromCache || images.length === 0) {
        if (window.__activeTripSessionToken !== tripTokenAtStart) return;

        if (typeof window.getCityCollageImages === 'function') {
            let pageNum = 1;
            if (typeof day === 'number') {
                pageNum = day;
            } else if (typeof day === 'string') {
                const match = day.match(/\d+/);
                if (match) pageNum = parseInt(match[0], 10);
            }
            if (!pageNum || pageNum < 1) pageNum = 1;

            console.log(`[Collage] API Çağırılıyor -> Şehir: ${searchObj.term}, Kaynak: Pixabay`);
            
            // 4 ADET GÖRSEL
            images = await window.getCityCollageImages(searchObj, {
                min: 4, 
                exclude: usedSet,
                page: pageNum
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