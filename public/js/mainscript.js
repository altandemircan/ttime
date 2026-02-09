// === mainscript.js dosyasının en tepesine eklenecek global değişken ===
window.__planGenerationId = Date.now();
window.__welcomeHiddenForever = false;
window.__restaurantLayers = window.__restaurantLayers || [];
window.__hideAddCatBtnByDay = window.__hideAddCatBtnByDay || {};
window.mapPlanningDay = null;
window.mapPlanningActive = false;
window.mapPlanningMarkersByDay = {};
window.__suppressMiniUntilFirstPoint = window.__suppressMiniUntilFirstPoint || {};

window.cart = JSON.parse(localStorage.getItem('cart')) || [];
window.activeTripKey = localStorage.getItem('activeTripKey') || null;
window.selectedCity = localStorage.getItem('selectedCity') || null;

window.__locationPickedFromSuggestions = false;
window.selectedLocationLocked = false;
window.__dismissedAutoInfo = JSON.parse(localStorage.getItem('dismissedAutoInfo')) || [];

// Türkçe karakter normalizasyon fonksiyonu
function normalizeTurkish(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        // Önce noktalı i'yi düzelt (İ -> i)
        .normalize('NFD')  // Unicode decomposition: İ -> i + ̇
        .replace(/[\u0307]/g, '') // noktayı kaldır
        .normalize('NFC')  // tekrar birleştir
        // Diğer Türkçe karakterler
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/â/g, 'a')
        .replace(/û/g, 'u')
        .replace(/î/g, 'i');
}
document.addEventListener("DOMContentLoaded", function() {
    // #about yerine #about-triptime
    if (window.location.hash === "#about-triptime") {
        if (typeof changeContent === "function") {
            changeContent(2);
            const chatMain = document.getElementById('main-chat');
            if(chatMain) chatMain.style.display='none';
        }
    }
});

window.addEventListener('hashchange', function() {
    // #about yerine #about-triptime
    if (window.location.hash === "#about-triptime") {
        changeContent(2);
        document.getElementById('main-chat').style.display='none';
    } else {
        if (typeof changeContent === "function") {
            changeContent(0); 
            // Ana sayfaya dönünce chat ekranını tekrar açmak gerekebilir:
            const chatMain = document.getElementById('main-chat');
            if(chatMain) chatMain.style.display='block';
        }
    }
});

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Dünya yarıçapı metre cinsinden
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function isTripFav(item) {
    return window.favTrips && window.favTrips.some(f =>
        f.name === item.name &&
        f.category === item.category &&
        String(f.lat) === String(item.lat) &&
        String(f.lon) === String(item.lon)
    );
}
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function getDisplayName(place) {
  // Latin/İngilizce ad döndür
  if (place.name_en) return place.name_en;
  if (place.name_latin) return place.name_latin;
  if (place.address) {
    const first = place.address.split(',')[0].trim();
    if (/^[A-Za-z0-9\s\-'.]+$/.test(first) && first.length > 2) return first;
  }
  return place.name || "";
}

function getLocalName(place) {
  if (place.name_local && place.name_local !== place.name) return place.name_local;
  return "";
}

function countryFlag(iso2) {
  // ISO2 kodunu Unicode bayrağa çevirir
  if (!iso2) return "";
  return String.fromCodePoint(...[...iso2.toUpperCase()].map(c => 127397 + c.charCodeAt()));
}


function enableSendButton() {
      const btn = document.getElementById("send-button");
      if (!btn) return;
      btn.removeAttribute("disabled");
      btn.classList.remove("disabled");
    }
function disableSendButton() {
      const btn = document.getElementById("send-button");
      if (!btn) return;
      btn.setAttribute("disabled","disabled");
      btn.classList.add("disabled");
    }

function fitExpandedMapToRoute(day) {
  const cid = `route-map-day${day}`;
  const expObj = window.expandedMaps && window.expandedMaps[cid];
  if (expObj && expObj.expandedMap) {
    const points = getDayPoints(day);

    // === GÜÇLÜ NULL CHECK EKLE ===
    const validPts = points.filter(p => isFinite(p.lat) && isFinite(p.lng));
    if (validPts.length > 1) {
      expObj.expandedMap.fitBounds(validPts.map(p => [p.lat, p.lng]), { padding: [20, 20] });
    } else if (validPts.length === 1) {
      expObj.expandedMap.setView([validPts[0].lat, validPts[0].lng], 14);
    } else {
      expObj.expandedMap.setView([0, 0], 2);
    }
  }
}


let selectedCity = "";

document.addEventListener('click', function(event) {
  const arrowElement = event.target.closest('.arrow');
  if (arrowElement) {
    const cartItem = arrowElement.closest('.cart-item');
    if (cartItem) {
      const content = cartItem.querySelector('.content');
      if (content) {
        content.classList.toggle('active');
        const arrowImg = arrowElement.querySelector('img');
        if (arrowImg) {
          arrowImg.classList.toggle('rotated');
        }
      }
    }
  }
});

document.addEventListener("DOMContentLoaded", function () {
    const chatInput = document.getElementById("user-input");
    const suggestionsDiv = document.getElementById("suggestions");
    // let selectedOption = null;

function showSuggestions() {
    if (!suggestionsDiv) return;
    suggestionsDiv.innerHTML = "";

    const options = [
        { text: "2 days in Antalya",          flag: countryFlag("TR") },
        { text: "Explore Rome for 3 days",    flag: countryFlag("IT") },
        { text: "1 day in Tokyo",             flag: countryFlag("JP") },
        { text: "London 2-day guide",         flag: countryFlag("GB") },
        { text: "3-day Paris itinerary",      flag: countryFlag("FR") },
        { text: "Visit Madrid in 1 day",      flag: countryFlag("ES") },
        { text: "3 days in Bangkok",          flag: countryFlag("TH") },
        { text: "Discover Petra for 2 days",  flag: countryFlag("JO") }
    ];

    options.forEach(option => {
        const suggestion = document.createElement("div");
        suggestion.className = "category-area-option";
        suggestion.innerText = `${option.text} ${option.flag}`;

        suggestion.onclick = function() {
            Array.from(suggestionsDiv.children).forEach(d => d.classList.remove("selected-suggestion"));
            suggestion.classList.add("selected-suggestion");

            let city, days;
            switch(option.text) {
                case "2 days in Antalya":           city = "Antalya"; days = 2; break;
                case "Explore Rome for 3 days":     city = "Rome";    days = 3; break;
                case "1 day in Tokyo":              city = "Tokyo";   days = 1; break;
                case "London 2-day guide":          city = "London";  days = 2; break;
                case "3-day Paris itinerary":       city = "Paris";   days = 3; break;
                case "Visit Madrid in 1 day":       city = "Madrid";  days = 1; break;
                case "3 days in Bangkok":           city = "Bangkok"; days = 3; break;
                case "Discover Petra for 2 days":   city = "Petra";   days = 2; break;
                default:                            city = "City";    days = 2; break;
            }

            let canonicalStr = `Plan a ${days}-day tour for ${city}`;
            window.__programmaticInput = true;
            if (typeof setChatInputValue === "function") {
                setChatInputValue(canonicalStr);
            } else {
                chatInput.value = canonicalStr;
            }
            setTimeout(() => { window.__programmaticInput = false; }, 0);

            window.selectedSuggestion = { displayText: canonicalStr, city, days };
            window.selectedLocation = { city, days };
            window.selectedLocationLocked = true;
            window.__locationPickedFromSuggestions = true;
            enableSendButton?.();
            showSuggestionsDiv?.();
            if (typeof updateCanonicalPreview === "function") {
                updateCanonicalPreview();
            }
        };
        suggestionsDiv.appendChild(suggestion);
    });

    showSuggestionsDiv?.();
}

    if (!chatInput) return;


    let selectedSuggestion = null;
    let lastResults = [];


let lastAutocompleteQuery = '';
let lastAutocompleteController = null;

async function geoapifyLocationAutocomplete(query) {
    // 1. UNESCO (LOCAL) ARAMA - Mevcut listen
    let unescoResults = [];
    if (window.UNESCO_DATA) {
        const q = query.toLowerCase().trim();
        unescoResults = window.UNESCO_DATA
            .filter(item => item.name.toLowerCase().includes(q))
            .map(item => ({
                properties: {
                    name: item.name,
                    city: item.name, 
                    country_code: item.country_code ? item.country_code.toLowerCase() : "", 
                    formatted: `${item.name} (UNESCO Site)`,
                    lat: item.lat,
                    lon: item.lon,
                    result_type: 'unesco_site',
                    place_id: 'unesco_' + item.name.replace(/\s/g, '_')
                }
            })).slice(0, 3);
    }

    // 2. [YENİ] ŞEHİR (LOCAL) ARAMA - Senin yeni kurduğun yerel paket
    let localCityResults = [];
    try {
        console.log("Şehirler yerel veritabanından çekiliyor...");
        const resLocal = await fetch(`/api/cities?q=${encodeURIComponent(query)}&limit=10`);

        // mainscript.js içinde bul ve değiştir:

// mainscript.js içinde bul ve değiştir:
const localCities = await resLocal.json();

// Gelen verinin dizi olduğundan emin ol (Kritik koruma)
localCityResults = Array.isArray(localCities) ? localCities.map(item => ({
    properties: {
        name: item.name,
        city: item.name,
        country_code: (item.countryCode || "").toLowerCase(),
        formatted: `${item.name}, ${item.countryCode || 'TR'}`,
        lat: parseFloat(item.latitude),
        lon: parseFloat(item.longitude),
        result_type: item.type || 'city',
        place_id: `local-${item.latitude}-${item.longitude}`
    }
})) : [];


    } catch (e) {
        console.warn("Yerel şehir API hatası:", e);
    }

    // 3. API ARAMASI (YEDEK)
    let apiFeatures = [];
    // Eğer yerelde (UNESCO + Şehir) yeterli sonuç yoksa Geoapify'a git
    if (unescoResults.length + localCityResults.length < 5) {
        try {
            let response = await fetch(`/api/geoapify/autocomplete?q=${encodeURIComponent(query)}&limit=20`);
            let data = await response.json();
            apiFeatures = data.features || [];
        } catch (e) {
            console.warn("Geoapify API hatası:", e);
        }
    }

    // 4. BİRLEŞTİRME
    // Önce UNESCO, sonra Şehirler, en son API sonuçları
    let combined = [...unescoResults, ...localCityResults, ...apiFeatures];

    // --- Bölge/Şehir tamamlama kodların (Nearby) dokunmadan aynen kalıyor ---
    const region = combined.find(f => {
        const t = f.properties.result_type || f.properties.place_type || '';
        return ['region', 'area'].includes(t) && f.properties.lat && f.properties.lon;
    });

    if (region) {
        try {
            const resNearby = await fetch(
                `/api/geoapify/nearby-cities?lat=${region.properties.lat}&lon=${region.properties.lon}&radius=80000`
            );
            const nearbyData = await resNearby.json();
            let nearbyCities = (nearbyData.features || []).filter(f => {
                const t = f.properties.result_type || f.properties.place_type || '';
                return ['city', 'town', 'village'].includes(t);
            });
            
            const existingNames = new Set(combined.map(f =>
                (f.properties.city || f.properties.name || '').toLowerCase()
            ));
            
            nearbyCities = nearbyCities.filter(f =>
                !existingNames.has((f.properties.city || f.properties.name || '').toLowerCase())
            );
            combined = [...combined, ...nearbyCities];
        } catch (err) {}
    }

    return combined;
}

function extractLocationQuery(input) {
    if (!input) return "";
    
    // Orijinal inputu al
    let cleaned = input; 
    
    // Sadece "1 day", "3 gün" gibi zaman ifadelerini sil.
    // [FIX] Tire (-) karakterini de kapsayacak şekilde güncellendi (örn: 1-day)
    cleaned = cleaned.replace(/(\d+)\s*[-]?\s*(day|days|gün|gun|gece|night|nights)/gi, "");
    
    // Özel karakterleri temizle
    cleaned = cleaned.replace(/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g, " ");
    
    // Gereksiz kelimeleri (stop words) temizle
    const stopWords = [
        "plan", "trip", "tour", "itinerary", "route", "visit", "travel", "guide",
        "create", "make", "build", "generate", "show", "give", "please", 
        "for", "in", "to", "at", "of", "a", "the", "program", "city", "my",
        // [FIX] Zaman birimleri stop words'e eklendi
        "day", "days", "gün", "gun", "night", "nights"
    ];
    
    // Kelimeleri ayır ve stop word'leri temizle
    let words = cleaned.split(/\s+/);
    words = words.filter(w => !stopWords.includes(w.toLowerCase()) && w.length > 1);
    
    return words.join(" ").trim();
}

// ============================================================
// GÖRÜNÜM YARDIMCILARI (KESİN ÇÖZÜM)
// ============================================================

// KUTUYU ZORLA AÇAR (Hidden'ı siler, Display Block yapar)
window.showSuggestionsDiv = function() {
    const el = document.getElementById('suggestions');
    if (el) { 
        el.removeAttribute('hidden'); // HTML attribute'unu sök
    }
}

// KUTUYU KAPATIR
window.hideSuggestionsDiv = function(clear = false) {
    const el = document.getElementById('suggestions');
    if (el) { 
        el.setAttribute('hidden', ''); // HTML attribute ekle
        el.style.display = 'none';     // CSS ile gizle
        if (clear) el.innerHTML = "";
    }
}
// Global değişken (Listenin dışında tanımlı olmalı)
let currentFocus = -1; // Global focus takibi

function renderSuggestions(originalResults = [], manualQuery = "") {
    console.log("=== RENDER DEBUG ===");
    console.log("Manual query:", manualQuery);
    console.log("Results:", originalResults);


    
    currentFocus = -1;
    const suggestionsDiv = document.getElementById("suggestions");
const chatInput = document.getElementById("user-input");

if (!suggestionsDiv || !chatInput) return;

// ✅ BURAYA EKLE
suggestionsDiv.dataset.hasResults = "true";

suggestionsDiv.innerHTML = "";

    if (!originalResults || !originalResults.length) {
        console.log("No results to show");
        if(typeof hideSuggestionsDiv === "function") hideSuggestionsDiv(true);
        return;
    }

    // A. PUANLAMA - Türkçe karakter düzeltmesi ekle
    const normalizeForCompare = (text) => {
        if (!text) return '';
        return text
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // aksanları kaldır
            .replace(/ı/g, 'i');
    };
    
    const targetTerm = normalizeForCompare(manualQuery);
    console.log("Normalized target:", targetTerm);
    
    const scoredResults = originalResults.map(item => {
        const p = item.properties || {};
        const name = p.name || "";
        const normalizedName = normalizeForCompare(name);
        const formatted = p.formatted || "";
        const type = (p.result_type || p.place_type || '').toLowerCase();
        
        console.log(`Comparing: "${name}" -> "${normalizedName}" with "${targetTerm}"`);
        
        // Filtre - normalize edilmiş haliyle karşılaştır
        const containsTarget = normalizedName.includes(targetTerm);
        if (!containsTarget) {
            console.log(`  ✗ Does not contain "${targetTerm}"`);
            return { item, score: -9999 };
        }
        
        console.log(`  ✓ Contains "${targetTerm}"`);
        
        let score = 0;
        
        // Puanlama Kuralları
        if (type === 'unesco_site') score += 50000; 
        else if (type === 'amenity' || type === 'tourism') score += 500; 
        else if (type === 'city') score += 150; 
        else if (type === 'town' || type === 'village') score -= 50; 

        // Tam eşleşme (normalize edilmiş)
        if (normalizedName === targetTerm) {
            console.log(`  ★ Exact match!`);
            score += 1500;
        }
        else if (normalizedName.startsWith(targetTerm)) {
            console.log(`  ☆ Starts with`);
            score += 800;
        }

        if (p.formatted && p.formatted.length < 45) score += 100;

        return { item, score };
    });

    // Sırala
    scoredResults.sort((a, b) => b.score - a.score);

    const finalResults = scoredResults
        .filter(sr => sr.score > -5000)
        .slice(0, 8)
        .map(sr => sr.item);

    console.log("Final results to show:", finalResults.length);

    // B. LİSTELEME VE GÖRSEL
    const seenSuggestions = new Set();
    
    finalResults.forEach((result) => {
        const props = result.properties || {};
        
        // 1. TAM VERİ (INPUTA GİDECEK)
        let rawName = "";
        if (props.city && props.city.trim()) rawName = props.city;
        else if (props.name && props.name.trim()) rawName = props.name;
        if (!rawName || rawName.length < 2) rawName = props.formatted || "";

        let LONG_INPUT_NAME = rawName;
        if (props.result_type !== 'unesco_site' && rawName.includes(',')) {
             LONG_INPUT_NAME = rawName.split(',')[0].trim();
        }

        // 2. GÖRÜNECEK TAM METİN
        const regionParts = [];
        if (props.city && props.city !== LONG_INPUT_NAME) regionParts.push(props.city);
        
        const countryCode = props.country_code || "";
        const flag = (countryCode && typeof countryFlag === 'function') ? " " + countryFlag(countryCode) : "";
        
        let fullDisplayText = LONG_INPUT_NAME;
        if (regionParts.length > 0) fullDisplayText += ", " + regionParts.join(', ');
        if (countryCode) fullDisplayText += ", " + countryCode.toUpperCase() + flag;
        fullDisplayText = fullDisplayText.replace(/^,\s*/, "").trim();

        const normalizedText = normalizeForCompare(fullDisplayText);
        if (seenSuggestions.has(normalizedText)) {
            console.log(`Skipping duplicate: ${fullDisplayText}`);
            return;
        }
        seenSuggestions.add(normalizedText);

        console.log(`Adding suggestion: ${fullDisplayText}`);

        // 3. GÖRÜNECEK KISA METİN
        let shortDisplayText = fullDisplayText;
        if (props.result_type === 'unesco_site' && fullDisplayText.length > 35) {
            shortDisplayText = fullDisplayText.substring(0, 32) + "..."; 
        }

        // --- HTML OLUŞTURMA ---
        const div = document.createElement("div");
        div.className = "category-area-option";
        
        // Başlangıçta KISA halini yaz
        div.textContent = shortDisplayText; 
        
        // Verileri sakla
        div.dataset.shortText = shortDisplayText;
        div.dataset.fullText = fullDisplayText;
        div.title = fullDisplayText;

        // Görünüm Ayarları
        div.style.whiteSpace = "nowrap";       
        div.style.overflow = "hidden";         
        div.style.display = "block";

        // UNESCO Badge Ekleme
        if (props.result_type === 'unesco_site') {
            div.style.backgroundColor = "#f2fce4"; 
            div.style.position = "relative";
            div.style.paddingRight = "115px"; 

            const badge = document.createElement("span");
            badge.textContent = "World Heritage";
            badge.style.position = "absolute";
            badge.style.top = "50%";
            badge.style.transform = "translateY(-50%)";
            badge.style.right = "10px";
            badge.style.fontSize = "0.65rem";
            badge.style.fontWeight = "bold";
            badge.style.backgroundColor = "#54afd6"; 
            badge.style.color = "#fff";
            badge.style.padding = "2px 6px";
            badge.style.borderRadius = "4px";
            badge.style.boxShadow = "0 1px 2px rgba(0,0,0,0.1)";
            
            div.appendChild(badge);
        }

        // 4. TIKLAMA OLAYI
        div.onclick = () => {
            console.log("Clicked:", fullDisplayText);
            
            // GÖRSEL DÜZENLEME
            Array.from(suggestionsDiv.children).forEach(child => {
                if (child !== div) child.style.display = 'none';
            });
            div.style.display = 'block';
            div.classList.add("selected-suggestion");
            div.style.whiteSpace = "normal"; 
            div.style.overflow = "visible";
            if (div.firstChild) div.firstChild.nodeValue = fullDisplayText;

            // GÜN SAYISINI YAKALA
            const raw = chatInput.value.trim();
            const dayMatch = raw.match(/(\d+)\s*-?\s*day/i) || raw.match(/(\d+)\s*-?\s*gün/i);
            let days = dayMatch ? parseInt(dayMatch[1], 10) : 1;

            // INPUTA YAZ
            chatInput.value = `Plan a ${days}-day trip to ${LONG_INPUT_NAME}`;

            // SİSTEMİ KİLİTLE
            const finalLocation = {
                name: LONG_INPUT_NAME,
                city: props.city || LONG_INPUT_NAME,
                lat: props.lat,
                lon: props.lon,
                country_code: countryCode
            };

            window.selectedSuggestion = { 
                displayText: fullDisplayText,
                props: props,
                selectedLocation: finalLocation
            };

            window.selectedLocation = finalLocation;
            window.selectedLocationLocked = true; 
            window.__locationPickedFromSuggestions = true;
            window.__programmaticInput = true;

            // UI GÜNCELLEME
            if (typeof enableSendButton === "function") enableSendButton();
            if (typeof showSuggestionsDiv === "function") showSuggestionsDiv();

            setTimeout(() => { window.__programmaticInput = false; }, 300);
        };

        suggestionsDiv.appendChild(div);
    });
    
    if (suggestionsDiv.children.length > 0) {
        console.log(`Showing ${suggestionsDiv.children.length} suggestions`);
        if(typeof showSuggestionsDiv === "function") showSuggestionsDiv();
    } else {
        console.log("No suggestions to show after filtering");
        suggestionsDiv.innerHTML = '<div class="category-area-option" style="color: #999; text-align: center; pointer-events: none;">No matching results</div>';
        if(typeof showSuggestionsDiv === "function") showSuggestionsDiv();
    }
}
// Regex ile şehir adını direk yakala
function extractCityName(text) {
    // Türkçe şehir adı pattern'i (büyük harf, 2+ harf)
    const turkishCityPattern = /([A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,}(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,})*)/;
    
    // Küçük harf şehir adı pattern'i (tüm metin küçükse)
    const lowercaseCityPattern = /\b([a-zçğıöşü]{3,}(?:\s+[a-zçğıöşü]{3,})*)\b/;
    
    let match = text.match(turkishCityPattern);
    if (match) {
        return match[1];
    }
    
    match = text.match(lowercaseCityPattern);
    if (match) {
        // İlk harfi büyük yap
        return match[1].replace(/\b\w/g, char => char.toUpperCase());
    }
    
    return null;
}


// Sayfa yüklendiğinde listener'ı ekle
document.addEventListener("DOMContentLoaded", function() {
    const inp = document.getElementById("user-input");
    if (inp) {
        inp.addEventListener("keydown", function(e) {
            const suggestionsDiv = document.getElementById("suggestions");
            let items = suggestionsDiv ? suggestionsDiv.getElementsByClassName("category-area-option") : null;
            
            if (e.key === "ArrowDown") {
                currentFocus++;
                addActive(items);
            } else if (e.key === "ArrowUp") {
                currentFocus--;
                addActive(items);
            } else if (e.key === "Enter") {
                // DURUM 1: Klavye ile listeden bir şey seçiliyse
                if (currentFocus > -1 && items && items[currentFocus]) {
                    e.preventDefault(); // Formu gönderme
                    items[currentFocus].click(); // O öğeyi tıkla (seçimi yap)
                } 
                // DURUM 2: Daha önce seçim yapıldıysa (örn. mouse ile)
                else if (window.__locationPickedFromSuggestions) {
                    // İzin ver, normal gönderim (sendMessage) çalışsın
                } 
                // DURUM 3: Hiçbir seçim yoksa (NE KLAVYE NE MOUSE)
                else {
                    e.preventDefault(); // GÖNDERMEYİ ENGELLE!
                    // Görsel uyarı: Input kenarını kırmızı yapıp söndür
                    this.style.transition = "border-color 0.2s";
                    this.style.borderColor = "#d32f2f";
                    setTimeout(() => { this.style.borderColor = ""; }, 400);
                }
            }
        });
    }
});


// ============================================================
// 4. INPUT EVENT LISTENER
// ============================================================
// ============================================================
// 4. INPUT EVENT LISTENER (DÜZELTİLMİŞ)
// ============================================================
if (typeof chatInput !== 'undefined' && chatInput) {
    chatInput.addEventListener("input", debounce(async function () {
        console.log("=== INPUT DEBUG ===");
        
        if (window.__programmaticInput && !window.__forceSuggestions) {
    console.log("Skipping - programmatic input");
    return;
}

        const rawText = this.value.trim();
        const suggestionsDiv = document.getElementById("suggestions");
        if (!suggestionsDiv) return;

        // 1. KUTUYU AÇ
       if (rawText.length > 0) {
            if (typeof showSuggestionsDiv === "function") showSuggestionsDiv();

            if (!suggestionsDiv.dataset.hasResults) {
                suggestionsDiv.innerHTML =
                  '<div class="category-area-option" style="color:#999;text-align:center;padding:12px;">Searching...</div>';
            }
        } else {
            if (typeof showSuggestionsDiv === "function") showSuggestionsDiv();
            // showSuggestions(); // İsterseniz boşken varsayılanları gösterin
            return;
        }

        // 2. TEMİZLİK (Gereksiz kelimeleri at)
        let cleanedText = rawText
            .replace(/(\d+)\s*(?:-?\s*)?(?:day|days|gün|gun)\b/gi, '') 
            .replace(/\b(?:plan|trip|tour|itinerary|visit|travel|to|for|in|at|a|an|the)\b/gi, '')
            .replace(/[^a-zA-Z\sçğıöşüÇĞİÖŞÜ]/g, ' ') // Türkçe karakter desteği eklendi
            .replace(/\s+/g, ' ')
            .trim();

        // Eğer temizlik sonrası elimizde anlamlı bir kelime kalmadıysa
        if (cleanedText.length < 2) {
             suggestionsDiv.innerHTML = '<div class="category-area-option" style="color: #999; text-align: center; padding: 12px;">Please type a location...</div>';
             return;
        }

        // 3. MERKEZİ ARAMA FONKSİYONUNU ÇAĞIR (UNESCO + CITY + API)
        // Eski kodda burası sadece /api/cities çağırıyordu. Şimdi hepsini kapsayan fonksiyonu çağırıyoruz.
        try {
           let locationQuery = "";

if (window.__forceSuggestions) {
    // Tema seçildiyse: cümlenin son anlamlı kelimesini al
    locationQuery = rawText
        .split(/in |for |to /i)
        .pop()
        .trim();
} else {
    locationQuery = extractPureLocation(rawText);
}

console.log("Searching for:", locationQuery);

if (locationQuery.length < 2) return;

const results = await geoapifyLocationAutocomplete(locationQuery);
            
            // 4. SONUÇLARI GÖSTER
            if (results && results.length > 0) {
                console.log(`Found ${results.length} combined results`);
                if (typeof renderSuggestions === 'function') {
                    // geoapifyLocationAutocomplete zaten 'properties' formatında döndüğü için
                    // map işlemine gerek yok, direkt veriyoruz.
renderSuggestions(results, locationQuery);
                }
            } else {
                console.log("No results found");
                suggestionsDiv.innerHTML = '<div class="category-area-option" style="color: #999; text-align: center; padding: 12px;">No location found</div>';
            }

        } catch (error) {
            console.error("Search error:", error);
            suggestionsDiv.innerHTML = '<div class="category-area-option" style="color: #999; text-align: center; padding: 12px;">Error searching</div>';
        }
        
    }, 400));

    // FOCUS VE CLICK OLAYLARI
    chatInput.addEventListener("focus", function(e) {
        e.stopPropagation();
        if (!this.value.trim()) showSuggestions();
    });
    
    chatInput.addEventListener("click", function(e) {
        e.stopPropagation();
        if (!this.value.trim()) showSuggestions();
    });
}


// Global Değişkenler ve Element Seçimleri
const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");

let latestTripPlan = []; // KRİTİK: Gezi verisi burada tutulur

// Başlangıç önerilerini göster
if (typeof showSuggestions === 'function') {
    showSuggestions();
}


function parsePlanRequest(text) {
    let days = null;
    let location = null;
    let isCapped = false; // Yeni eklenen kontrol değişkeni

    // 1. Önce Context/Suggestion kontrolü
    if (window.selectedSuggestion && window.selectedSuggestion.props) {
        const props = window.selectedSuggestion.props;
        const specificName = props.name || props.city || props.county;
        location = [specificName, props.country].filter(Boolean).join(', ');
    } else if (window.selectedLocation && typeof window.selectedLocation === "object") {
        const sl = window.selectedLocation;
        const specificName = sl.name || sl.city;
        location = [specificName, sl.country].filter(Boolean).join(', ');
    }

    // 2. Gün sayısını metinden ayıkla
    let dayMatch = text.match(/(\d+)[- ]*day/i);
    if (!dayMatch) dayMatch = text.match(/(\d+)[- ]*gün/i);
    
    if (dayMatch) {
        days = parseInt(dayMatch[1]);
        
        // --- BURASI DEĞİŞTİ: LİMİT KONTROLÜ VE UYARI BAYRAĞI ---
        if (days > 5) {
            days = 5;       // Gün sayısını 5'e indir
            isCapped = true; // "Evet, müdahale ettim" diye işaretle
        }
        // -------------------------------------------------------
    }

    // Gün bulunamazsa varsayılan 2
    if (!days || isNaN(days) || days < 1) days = 2;

    // Konum bulunamadıysa metinden tahmin et
    if (!location) {
        let wordMatch = text.match(/\b([A-ZÇĞİÖŞÜ][a-zçğıöşü'’]+)\b/);
        if (wordMatch) location = wordMatch[1];
    }

    // Fonksiyon artık 3 veri döndürüyor: Konum, Gün ve Kırpılma Durumu
    return { location, days, isCapped }; 
}

function formatCanonicalPlan(rawInput) {
    if (!rawInput || typeof rawInput !== 'string')
        return { canonical: "", city: "", days: 1, changed: false };

    let raw = rawInput.replace(/\u0336/g, '').trim(); 

    // Extract days (English only)
    let dayMatch = raw.match(/(\d+)\s*(?:-?\s*(day|days))\b/i);
    let days = dayMatch ? parseInt(dayMatch[1], 10) : null;
    if (!days || isNaN(days) || days < 1) days = 1;

    // Remove filler words to isolate city tail
    let cleaned = raw
        .replace(/\b(plan|planning|travel|trip|tour|itinerary|program|create|make|build|generate|please|show|give)\b/ig, ' ')
        .replace(/\b(for|in|to|a|an|the|of|city)\b/ig, ' ')
        .replace(/\d+\s*(?:-?\s*(day|days))\b/ig, ' ')
        .replace(/[,.;:!?]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!cleaned) cleaned = raw;

    const tokens = cleaned.split(/\s+/).filter(Boolean);
    let city = "";
    for (let span = Math.min(4, tokens.length); span >= 1; span--) {
        const cand = tokens.slice(tokens.length - span).join(' ');
        if (/^[\p{L}][\p{L}\p{M}'’\-\s.]+$/u.test(cand)) { city = cand; break; }
    }
    if (!city && tokens.length) city = tokens[tokens.length - 1];

    // Capitalize each word
    city = city.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    const canonical = `Plan a ${days}-day tour for ${city}`;
    // Compare normalized versions to know if different
    const changed = canonical.trim().toLowerCase() !== raw.trim().toLowerCase();
    return { canonical, city, days, changed };
}

// Convert plain text to struck-through version using combining char U+0336
function strikeThrough(text) {
    if (!text) return "";
    return text
        .replace(/\s+/g, ' ')
        .trim()
        .split('')
        .map(ch => ch + '\u0336')
        .join('');
}
document.addEventListener('DOMContentLoaded', function() {
  const ui = document.getElementById('user-input');
  if (ui) {
    ui.addEventListener('input', debouncedUpdateCanonicalPreview);
    ui.addEventListener('focus', debouncedUpdateCanonicalPreview);
  }
});


// ÖNİZLEME GÜNCELLE
function updateCanonicalPreview() {
  const input = document.getElementById('user-input');
  const box = document.getElementById('canonical-preview');
  if (!input || !box) return;

  const raw = input.value;
  if (!raw || raw.trim().length < 2) {
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }

  const formatted = formatCanonicalPlan(raw);
  // Eğer canonical üretilemediyse veya canonical ile raw pratikte aynı ise sakla
  const normalizedRaw = raw
      .trim()
      .replace(/\s+/g,' ')
      .toLowerCase();
  const normalizedCanon = formatted.canonical
      .trim()
      .replace(/\s+/g,' ')
      .toLowerCase();

  if (!formatted.canonical || normalizedRaw === normalizedCanon) {
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }

  const struck = strikeThrough(raw);
  box.innerHTML = `
    <span class="raw">${struck}</span>
    <span class="arrow">→</span>
    <span class="canon">${formatted.canonical}</span>
  `;
  box.style.display = 'block';
}

// Bazı işlemlerde tekrar tekrar çağırmamak için hafif debounce
function debouncePreview(fn, wait=120){
  let t;
  return function(){
    clearTimeout(t);
    t = setTimeout(fn, wait);
  };
}
const debouncedUpdateCanonicalPreview = debouncePreview(updateCanonicalPreview, 140);
let isFirstQuery = true; // Flag to track the first query


function extractCityAndDays(input) {
    let city = null, days = null;

    // 1. Gün sayısını yakala (hem "2 days", "2 gün", "2-day", "for 2 days", vs.)
    let dayMatch = input.match(/(\d+)\s*(?:-?\s*)?(?:day|days|gün)/i);
    if (dayMatch) days = parseInt(dayMatch[1], 10);

    // 2. "for X", "in X", "to X", "at X" gibi kalıpları dene
    let cityMatch = input.match(/\b(?:for|in|to|at)\s+([A-Za-zÇĞİÖŞÜçğıöşü'’\-\s]{2,})\b/i);
    if (cityMatch) city = cityMatch[1].trim();

    // 3. Büyük harfle başlayan kelime(leri) bul (örn. "Rome trip 2 days")
    if (!city) {
        let cityWord = input.match(/([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)?)/);
        if (cityWord) city = cityWord[0].trim();
    }

    // 4. Tüm kelimeler içinde büyük harfle başlayan ilk/son kelimeyi bul (örn. "2 days Rome")
    if (!city) {
        let tokens = input.split(/\s+/);
        for (let i = 0; i < tokens.length; i++) {
            if (/^[A-ZÇĞİÖŞÜ][a-zçğıöşü]+$/.test(tokens[i])) {
                city = tokens[i];
                break;
            }
        }
    }
// Eğer şehir, day veya days kelimesiyse: Mantıklı bir kelimeyi seç!
if (city && /^(days?|gün)$/i.test(city.trim())) {
    // "in" ve "for" ile split ile sonuncu kelimeyi al
    let toks = input.split(/in |for |to |at |on/i);
    // Son kelime iki harften uzunsa onu şehir olarak al
    for (let i = toks.length - 1; i >= 0; i--) {
        let candidate = toks[i].replace(/[\d]+.*/, '').replace(/days?.*/, '').replace(/gün.*/, '').trim();
        if (candidate.length > 2 && !/^(days?|gün)$/i.test(candidate)) {
            city = candidate;
            break;
        }
    }
    // Hala bulamadıysan, inputtaki büyük harfle başlayan kelimeyi seç
    if (city && /^(days?|gün)$/i.test(city.trim())) {
        let word = input.match(/([A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,})/);
        if (word) city = word[1];
    }
}
// Eğer city yanlışlıkla 'Day' veya 'Days' ise, kelimeyi inputtan tekrar doğru bulmaya çalış
if (city && (city.toLowerCase() === 'days' || city.toLowerCase() === 'day')) {
    // Genellikle son kelime şehir olur, onu al
    const tokens = input.trim().split(/\s+/);
    // Sayısal, "day/days" ve "trip/tour" vb. kelimeleri filtrele
    const filterTokens = tokens.filter(w => !/^\d+$/.test(w) && !/(day|days|gün|trip|tour|itinerary)/i.test(w));
    if (filterTokens.length) city = filterTokens[filterTokens.length-1];
}
// Son kez, ilk harfi büyük yap
city = city.charAt(0).toUpperCase() + city.slice(1);

    // Gün sayısı bulunamazsa default 2
    if (!days || isNaN(days) || days < 1) days = 2;

    // Şehir adını düzelt (ilk harfi büyük)
    city = city.charAt(0).toUpperCase() + city.slice(1);

    return { city, days };
}

// Geocode doğrulama (cache ile)
const __cityCoordCache = new Map();


// === YARDIMCI FONKSİYONLAR (Dosyanın uygun bir yerine veya en üste ekleyin) ===
// === GÜNLÜK LİMİT KONTROL FONKSİYONU ===
function checkAndIncrementDailyLimit(checkOnly = false) {
    const STORAGE_KEY = 'daily_plan_usage';
    const MAX_DAILY = 10;
    const today = new Date().toDateString(); // Örn: "Sun Jan 04 2026"
    
    let usage = {};
    try {
        usage = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
        usage = {};
    }

    // Tarih farklıysa (yeni günse) veya veri bozuksa sıfırla
    if (usage.date !== today) {
        usage = { date: today, count: 0 };
    }
    
    // Sadece kontrol ediyorsak (İşlem başı)
    if (checkOnly) {
        // Eğer sayaç 10 veya daha fazlaysa FALSE döndür (İzin verme)
        return usage.count < MAX_DAILY;
    }
    
    // Arttırma işlemi (İşlem başarılı olunca)
    usage.count++;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
    console.log(`[DailyLimit] New count: ${usage.count}`);
    return true;
}

async function handleAnswer(answer) {
  // Çift tıklama önlemi
  if (window.isProcessing) return;

  // 1. GÜNLÜK LİMİT KONTROLÜ
  if (typeof checkAndIncrementDailyLimit === 'function' && !checkAndIncrementDailyLimit(true)) {
      if (typeof hideLoadingPanel === 'function') hideLoadingPanel(); 
      if (typeof hideTypingIndicator === 'function') hideTypingIndicator();
      window.isProcessing = false; 
      addMessage("You have reached your daily trip plan limit (10). Please come back tomorrow! 😊", "bot-message request-bot-message");
      return; 
  }

  const raw = (answer || "").toString().trim();

  // Suggestion kontrolü
  if (!window.__locationPickedFromSuggestions) {
    if (typeof hideLoadingPanel === 'function') hideLoadingPanel();
    if (typeof hideTypingIndicator === 'function') hideTypingIndicator();
    addMessage("Please select a city from the suggestions first.", "bot-message");
    return;
  }

  const inputEl = document.getElementById("user-input");
  if (inputEl) inputEl.value = "";

  if (!raw || raw.length < 2) {
    if (typeof hideLoadingPanel === 'function') hideLoadingPanel();
    if (typeof hideTypingIndicator === 'function') hideTypingIndicator();
    addMessage("Please enter a location request.", "bot-message");
    return;
  }

  // --- ANİMASYON BAŞLAT ---
  window.isProcessing = true;
  if (typeof showLoadingPanel === 'function') showLoadingPanel();
  showTypingIndicator(); 
  // ------------------------

  const currentGenId = Date.now();
  window.__planGenerationId = currentGenId; 

  if (!window.activeTripKey) {
    window.directionsPolylines = {};
    window.routeElevStatsByDay = {};
  }

  if (window.__suppressNextUserEcho) {
    window.__suppressNextUserEcho = false;
  } else {
    addMessage(raw, "user-message");
  }

  const { location, days, isCapped } = parsePlanRequest(raw);

  if (isCapped) {
      setTimeout(() => {
          addMessage("Note: The initial trip plan is limited to a maximum of 5 days. You can add more days later.", "bot-message request-bot-message");
      }, 600);
  }

  try {
    if (!location || !days || isNaN(days)) {
      addMessage("I could not understand that.", "bot-message");
      throw new Error("Invalid input"); 
    }
    if (location.length < 2) {
      addMessage("Location name looks too short.", "bot-message");
      throw new Error("Short location");
    }

    const coords = await getCityCoordinates(location);
    if (!coords || !coords.lat || !coords.lon) {
      addMessage("Could not find a valid location.", "bot-message");
      throw new Error("Invalid coords");
    }

    if (window.activeTripKey && window.selectedCity) {
          const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (normalize(window.selectedCity) !== normalize(location)) {
              console.log(`[handleAnswer] New city ${location}. Detaching from old trip.`);
              window.activeTripKey = null; 
              window.cart = [];
          }
    }

    window.selectedCity = location; 

    // 1. AŞAMA: Plan Oluşturma
    let planResult = await buildPlan(location, days);

    if (currentGenId !== window.__planGenerationId) {
        return; 
    }

    // 2. AŞAMA: Wiki
    planResult = await enrichPlanWithWiki(planResult);

    if (currentGenId !== window.__planGenerationId) {
        return; 
    }

    latestTripPlan = planResult;

    if (latestTripPlan && latestTripPlan.length > 0) {
      window.latestTripPlan = JSON.parse(JSON.stringify(latestTripPlan));
      window.cart = JSON.parse(JSON.stringify(latestTripPlan));
      window.lastUserQuery = `${location} trip plan`;

      if (typeof checkAndIncrementDailyLimit === 'function') {
          checkAndIncrementDailyLimit(false); 
      }
      
      // === DEĞİŞİKLİK BURADA: Sonuçları basmadan önce animasyonu kapat ===
      if (typeof hideTypingIndicator === 'function') hideTypingIndicator();
      if (typeof hideLoadingPanel === 'function') hideLoadingPanel();
      // ==================================================================
      
      showResults();
      updateTripTitle();
      
      if (typeof insertTripAiInfo === 'function') insertTripAiInfo();

      const inputWrapper = document.querySelector('.input-wrapper');
      if (inputWrapper) inputWrapper.style.display = 'none';
      isFirstQuery = false;
      if (typeof openTripSidebar === "function") openTripSidebar();
    } else {
      addMessage("Could not create a plan.", "bot-message");
      throw new Error("Plan creation failed");
    }
  } catch (error) {
    console.error("Plan error:", error);
    
    if (typeof hideLoadingPanel === 'function') hideLoadingPanel();
    if (typeof hideTypingIndicator === 'function') hideTypingIndicator();
    
    if (error.message !== "Invalid input" && error.message !== "Short location" && error.message !== "Invalid coords") {
         addMessage("An error occurred. Please try again.", "bot-message");
    }
  } finally {
    if (currentGenId === window.__planGenerationId) {
        if (!window.latestTripPlan || window.latestTripPlan.length === 0) {
             if (typeof hideLoadingPanel === 'function') hideLoadingPanel();
             if (typeof hideTypingIndicator === 'function') hideTypingIndicator();
        }
        window.isProcessing = false;
    }
  }
}
document.addEventListener('DOMContentLoaded', () => {
    const inp = document.getElementById('user-input');
    if (!inp) return;

    inp.addEventListener('input', () => {
        // Programatik set fonksiyonu kontrolü
        if (window.__programmaticInput) return;

        // [FIX] Akıllı Kontrol: Şehir ismi hala aynı mı?
        if (window.selectedSuggestion && window.selectedSuggestion.displayText) {
            const currentInput = inp.value || "";
            
            // Şehir ismini ayıkla (gün sayılarını temizle)
            const currentLocName = typeof extractLocationQuery === 'function' 
                ? extractLocationQuery(currentInput) 
                : currentInput.replace(/[0-9]/g, '').replace(/(day|days|gün)/gi, '').trim();

            // Normalizasyon (küçük harf, noktalama yok)
            const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
            const savedText = normalize(window.selectedSuggestion.displayText);
            const currentText = normalize(currentLocName);

            // === (TAM EŞİTLİK) KONTROLÜ
            // Beşiktaş == Beşiktaş -> Eşit, seçimi koru.
            // Beşiktaş != Beşi    -> Eşit değil, kilidi aç, öneri getir.
            if (savedText === currentText && currentText.length > 1) {
                const dayMatch = currentInput.match(/(\d+)\s*[-]?\s*(day|days|gün|gun)/i);
                
                // Eğer gün sayısı varsa güncelle
                if (dayMatch && window.selectedLocation) {
                    window.selectedLocation.days = parseInt(dayMatch[1], 10);
                }
                
                // Gönder butonunu aktif et ve çık (Arama yapma)
                if (typeof enableSendButton === 'function') enableSendButton();
                return; 
            }
        }

        // Buraya düşerse: Kullanıcı harf sildi veya şehri değiştirdi.
        // Seçimi iptal et ki yeni öneriler gelsin.
        window.__locationPickedFromSuggestions = false;
        window.selectedLocationLocked = false;
        window.selectedLocation = null;
        disableSendButton && disableSendButton();
    });
});
function extractPureLocation(input) {
  if (!input) return "";

  // Küçük harf + TR normalize
  let text = normalizeTurkish(input.toLowerCase());

  // Sayıları ve süreleri sil
  text = text.replace(/\d+\s*(day|days|gün|gun|night|nights)?/gi, " ");

  // Noktalama
  text = text.replace(/[^\p{L}\s]/gu, " ");

  // Kelimelere ayır
  const words = text.split(/\s+/).filter(w => w.length > 2);

  // Fiil / intent kelimeleri → regex ile TOPTAN
  const intentRegex = /^(plan|explore|discover|visit|travel|make|create|show|give|see|things|do|doing|guide|trip|tour)$/;

  const candidates = words.filter(w => !intentRegex.test(w));

  // 1) Sona en yakın anlamlı kelime genelde şehir
  if (candidates.length > 0) {
    return candidates[candidates.length - 1];
  }

  return "";
}

function sendMessage() {
    // Kilit kontrolü
    if (window.isProcessing) {
        const panel = document.getElementById('loading-panel');
        if (!panel || panel.style.display === 'none') {
             window.isProcessing = false; 
        } else {
             return; 
        }
    }

    const input = document.getElementById("user-input");
    if (!input) return;
    
    let val = input.value.trim(); 
    if (!val) return;

    // ============================================================
    // === 🧹 AKILLI INPUT TEMİZLEYİCİ (TRIPTIME EDITION) ===
    // ============================================================
    
    let text = val.toLowerCase(); 
    let days = 1; // Varsayılan

    // 1. Gün Sayısını Yakala
    const numMatch = text.match(/(\d+)\s*(?:-| )?\s*(?:day|days|gün|gun|gunde|günlük)?/i);
    if (numMatch) {
        let detectedVal = parseInt(numMatch[1], 10);
        if (detectedVal > 0 && detectedVal < 60) {
            days = detectedVal;
            text = text.replace(numMatch[0], " "); 
        }
    }

    // 2. Gereksiz Kelimeleri Sil
    const stopWords = [
        "plan", "a", "tour", "trip", "visit", "travel", "journey", "for", "to", "in", "the", "with", "and", "&",
        "gezi", "tatil", "seyahat", "tur", "yap", "gitmek", "istiyorum", "bana", "bir", "rota",
        "hakkında", "ile", "gün", "day", "days"
    ];
    stopWords.forEach(w => {
        text = text.replace(new RegExp(`\\b${w}\\b`, 'gi'), " ");
    });

    // 3. Şehir Adını Temizle ve Baş Harfini Büyüt
    let location = text.replace(/[^\w\s\u00C0-\u017F-]/g, " ").replace(/\s+/g, " ").trim();
    if (location.length > 0) {
        location = location.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
        
        // Markaya uygun: "Plan a 3-day trip to Antalya"
        val = `Plan a ${days}-day trip to ${location}`;
        
        console.log(`🧹 Triptime Formatı: "${input.value}" -> "${val}"`);
    }
    // ============================================================


    if (!window.__locationPickedFromSuggestions) {
        addMessage("Please select a city from the suggestions first.", "bot-message");
        return;
    }

    // İlk mesaj
    addWelcomeMessage();

    // --- BURADAKİ DIFF / ÜZERİNİ ÇİZME KODLARI SİLİNDİ ---
    // Artık direkt işleme geçiyoruz.

    // Lokasyon kilidi
    if (!window.selectedLocationLocked || !window.selectedLocation) {
        addMessage("Please select a city from the suggestions first.", "bot-message");
        return;
    }

    // 1. Canonical Match (REGEX)
    const m = val.match(/Plan a (\d+)-day (?:tour|trip) (?:for|to) (.+)$/i);
    
    if (m) {
        let days = parseInt(m[1], 10);
        if (!days || days < 1) days = 2;
        const city = window.selectedLocation.city || window.selectedLocation.name || m[2].trim();
        
        // Kullanıcının mesajını ekrana bas (Düzeltilmiş halini)
        addMessage(val, "user-message request-user-message");
        window.__suppressNextUserEcho = true;
        
        showLoadingPanel(); 
        handleAnswer(`${city} ${days} days`);
        input.value = "";
        return;
    }

    // 2. Standart Akış
    showLoadingPanel(); 
    handleAnswer(val); 
    input.value = ""; 
}
document.getElementById('send-button').addEventListener('click', sendMessage);

window.__triptime_addtotrip_listener_set = window.__triptime_addtotrip_listener_set || false;
window.__lastAddedItem = null;
let lastUserQuery = ""

function extractCityAndDaysFromTheme(title) {
  let days = 2;
  let dayMatch = title.match(/(\d+)[- ]*day|(\d+)[- ]*days|(\d+)[- ]*gün/i);
  if (dayMatch) {
    days = parseInt(dayMatch[1] || dayMatch[2] || dayMatch[3], 10);
  } else if (/weekend/i.test(title)) {
    days = 2;
  }

  let city = null;
  let cityMatch = title.match(/\bin ([A-Za-zÇĞİÖŞÜçğıöşü'’\-\s,]+)$/i);
  if (cityMatch) {
    city = cityMatch[1].replace(/,.*/,'').trim();
  }
  if (!city) {
    let altMatch = title.match(/in ([A-Za-zÇĞİÖŞÜçğıöşü'’\-\s]+)/i);
    if (altMatch) city = altMatch[1].trim();
  }
  if (!city) {
    let altMatch = title.match(/in ([A-Za-zÇĞİÖŞÜçğıöşü'’\-\s]+)/i);
    if (altMatch) city = altMatch[1].split('for')[0].trim();
  }
  if (!city) {
    let tokens = title.split(/in |for |in |in |at |to |on /i);
    city = tokens[tokens.length - 1].replace(/[\d]+.*/, '').replace(/days?.*/, '').trim();
    if (city.indexOf(',') > -1) city = city.split(',')[0].trim();
  }
 
  return { city, days };
}
async function updateSuggestions(queryText) {
  // Şehir adını ayıkla (örneğin "Barcelona")
  const { city } = extractCityAndDaysFromTheme(queryText);

  // API autocomplete ile şehir önerilerini çek
  const resp = await fetch(`/api/geoapify/autocomplete?q=${encodeURIComponent(city)}`);
  const data = await resp.json();
  const features = data.features || [];

  const suggestionsDiv = document.getElementById("suggestions");
  const chatInput = document.getElementById("user-input");
  if (!suggestionsDiv || !chatInput) return;
  suggestionsDiv.innerHTML = "";

  // API’dan gelen şehir önerilerini panelde göster
  features.forEach(feature => {
    const props = feature.properties || {};
    const cityText = props.city || props.name || "";
    const countryText = props.country || "";
    const flag = props.country_code ? " " + countryFlag(props.country_code) : "";
    const displayText = [cityText, countryText].filter(Boolean).join(", ") + flag;

    const div = document.createElement("div");
    div.className = "category-area-option";
    div.textContent = displayText;
    div.dataset.displayText = displayText;

    // === BURAYA TIKLAMA EVENTİNİ EKLE ===
    div.onclick = function() {
      Array.from(suggestionsDiv.children).forEach(d => d.classList.remove("selected-suggestion"));
      div.classList.add("selected-suggestion");
      window.selectedSuggestion = { displayText, props };
      window.selectedLocation = {
        name: props.name || cityText,
        city: cityText,
        country: countryText,
        lat: props.lat ?? props.latitude ?? null,
        lon: props.lon ?? props.longitude ?? null,
        country_code: props.country_code || ""
      };
      // Gün sayısı inputtan
      const raw = chatInput.value.trim();
      const dayMatch = raw.match(/(\d+)\s*-?\s*day/i) || raw.match(/(\d+)\s*-?\s*gün/i);
      let days = dayMatch ? parseInt(dayMatch[1], 10) : 2;
      if (!days || days < 1) days = 2;
      let canonicalStr = `Plan a ${days}-day tour for ${window.selectedLocation.city}`;
      if (typeof formatCanonicalPlan === "function") {
        const c = formatCanonicalPlan(`${window.selectedLocation.city} ${days} days`);
        if (c && c.canonical) canonicalStr = c.canonical;
      }
      if (typeof setChatInputValue === "function") {
        setChatInputValue(canonicalStr);
      } else {
        chatInput.value = canonicalStr;
      }
      window.selectedLocationLocked = true;
      window.__locationPickedFromSuggestions = true;
      enableSendButton && enableSendButton();
      showSuggestionsDiv && showSuggestionsDiv();
      if (typeof updateCanonicalPreview === "function") {
        updateCanonicalPreview();
      }
    };

    suggestionsDiv.appendChild(div);
  });

  showSuggestionsDiv && showSuggestionsDiv();
}
// Temaya tıklayınca sadece öneri paneli dolsun, hiçbirini otomatik seçme!
// Temaya tıklayınca sadece öneri paneli dolsun, hiçbirini otomatik seçme!
document.querySelectorAll('.gallery-item').forEach(item => {
  item.addEventListener('click', async function() {
    
    // --- 1. MEVCUT GEZİYİ KAYDET VE SIFIRLA (RESET LOGIC) ---
    // Eğer halihazırda açık bir gezi varsa, önce onu kaydet
    if (window. cart && window.cart.length > 0 && window.activeTripKey && typeof saveCurrentTripToStorage === "function") {
        await saveCurrentTripToStorage();
    }

    // Collage race condition fix - yeni token oluştur
    try {
      if (typeof window.__ttNewTripToken === 'function') {
        window.__activeTripSessionToken = window.__ttNewTripToken();
      }
      window.__dayCollagePhotosByDay = {};
      window.__globalCollageUsed = new Set();
    } catch(e) {
      console.warn('[collage] Token reset error:', e);
    }

    // Global değişkenleri sıfırla (Yeni gezi için temiz sayfa)
    window.cart = [];
    window.latestTripPlan = [];
    window.selectedCity = null;
    window.selectedLocation = null;
    window. selectedLocationLocked = false;
    window.activeTripKey = null; // KRİTİK: Eski gezi ID'sini kopar, yeni ID oluşturacak.
    window. lastUserQuery = "";
    window.directionsPolylines = {}; // Polyline'ları da sıfırla
    
    // Chat ekranını temizle
    const chatBox = document.getElementById('chat-box');
    if (chatBox) chatBox.innerHTML = '';

    // Harita ve Rota kalıntılarını temizle
    if (typeof closeAllExpandedMapsAndReset === "function") closeAllExpandedMapsAndReset();
    window.routeElevStatsByDay = {};
    window.__ttElevDayCache = {};
    window._segmentHighlight = {};
    document.querySelectorAll('.expanded-map-container, .route-scale-bar, .tt-elev-svg').forEach(el => el.remove());
    // -------------------------------------------------------

    // Chat input alanını görünür yap
    const inputWrapper = document.querySelector('.input-wrapper');
    if (inputWrapper) inputWrapper.style.display = '';

    const themeTitle = item.querySelector('.caption p').textContent.trim();
    
    // PROGRAMATIK SET BAŞLIYOR
    window.__programmaticInput = true;
    document.getElementById('user-input').value = themeTitle;
    
    if (typeof updateSuggestions === 'function') {
      await updateSuggestions(themeTitle);
    }
    document.getElementById('user-input').focus();
    
    setTimeout(() => {
      window.__programmaticInput = false; // ARTIK kullanıcı yazıyor
    }, 0);

    // Mobilde sidebar'ı kapat
    if (window.innerWidth <= 768) {
        const sidebarOverlay = document.getElementById('sidebar-overlay-gallery');
        if (sidebarOverlay) {
            sidebarOverlay.classList.remove('open');
            sidebarOverlay.classList.remove('show');
        }
    }

    // DOM güncellendikten sonra hiçbir öneriyi otomatik seçme
    setTimeout(() => {
      const suggestionsDiv = document.getElementById("suggestions");
      if (suggestionsDiv) {
        Array.from(suggestionsDiv.children).forEach(div => {
          div.classList.remove("selected-suggestion");
        });
        window.selectedSuggestion = null;
        window.selectedLocationLocked = false;
        window.selectedLocation = null;
        window.__locationPickedFromSuggestions = false;
        disableSendButton && disableSendButton();
        showSuggestionsDiv && showSuggestionsDiv();
      }
    }, 120);
  });
});

// .add_theme için aynı mantık
document.querySelectorAll('.add_theme').forEach(btn => {

  btn.addEventListener('click', async function(e) {
    e.stopPropagation();

    // --- 1. MEVCUT GEZİYİ KAYDET VE SIFIRLA (RESET LOGIC) ---
    if (window.cart && window.cart.length > 0 && typeof saveCurrentTripToStorage === "function") {
        saveCurrentTripToStorage();
    }

    // Collage race condition fix - yeni token oluştur
 try {
      if (typeof window.__ttNewTripToken === 'function') {
        window.__activeTripSessionToken = window.__ttNewTripToken();
      }
      window.__dayCollagePhotosByDay = {};
      window.__globalCollageUsed = new Set();
     } catch(e) {
      console.warn('[collage] Token reset error:', e);
    }

   window.cart = [];
    window.latestTripPlan = [];
    window.selectedCity = null;
    window.selectedLocation = null;
    window.selectedLocationLocked = false;
    window.activeTripKey = null; // Yeni gezi ID'si için null yap
    window.lastUserQuery = "";

    const chatBox = document.getElementById('chat-box');
    if (chatBox) chatBox.innerHTML = '';

    if (typeof closeAllExpandedMapsAndReset === "function") closeAllExpandedMapsAndReset();
    window.routeElevStatsByDay = {};
    window.__ttElevDayCache = {};
    document.querySelectorAll('.expanded-map-container, .route-scale-bar').forEach(el => el.remove());
    // -------------------------------------------------------

    // Chat input alanını görünür yap
    const inputWrapper = document.querySelector('.input-wrapper');
    if (inputWrapper) inputWrapper.style.display = '';

    const themeTitle = btn.parentNode.querySelector('.caption p').textContent.trim();
    document.getElementById('user-input').value = themeTitle;

    if (typeof updateSuggestions === 'function') {
      await updateSuggestions(themeTitle);
    }
    document.getElementById('user-input').focus();

    // Mobilde sidebar'ı kapat
    if (window.innerWidth <= 768) {
        const sidebarOverlay = document.getElementById('sidebar-overlay-gallery');
        if (sidebarOverlay) {
            sidebarOverlay.classList.remove('open');
            sidebarOverlay.classList.remove('show');
        }
    }

    setTimeout(() => {
      const suggestionsDiv = document.getElementById("suggestions");
      if (suggestionsDiv) {
        Array.from(suggestionsDiv.children).forEach(div => {
          div.classList.remove("selected-suggestion");
        });
        window.selectedSuggestion = null;
        window.selectedLocationLocked = false;
        window.selectedLocation = null;
        window.__locationPickedFromSuggestions = false;
        disableSendButton && disableSendButton();
        showSuggestionsDiv && showSuggestionsDiv();
      }
    }, 120);
  });
});




// 3️⃣  initializeAddToTripListener() - DROPDOWN'DAN GÜN OKU
function initializeAddToTripListener() {
    if (window.__triptime_addtotrip_listener) {
        document.removeEventListener('click', window.__triptime_addtotrip_listener);
    }
    
    const listener = function(e) {
        const btn = e.target.closest('.addtotrip');
        if (!btn) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        
        const stepsDiv = btn.closest('.steps');
        if (!stepsDiv) return;
        
        // Dropdown'dan seçili gün'ü oku
        const daySelector = stepsDiv.querySelector('.day-select-dropdown-premium');
        const selectedDay = daySelector ? Number(daySelector.value) : 1;
        
        const category = stepsDiv.getAttribute('data-category');
        const title = stepsDiv.querySelector('.title')?.textContent.trim() || '';
        const image = stepsDiv.querySelector('img.check')?.src || 'img/placeholder.png';
        const address = stepsDiv.querySelector('.address span')?.textContent.trim() || '';
        const opening_hours = stepsDiv.querySelector('.opening_hours span')?.textContent.trim() || '';
        const lat = stepsDiv.getAttribute('data-lat');
        const lon = stepsDiv.getAttribute('data-lon');
        const website = stepsDiv.getAttribute('data-website') || '';
        
        let location = null;
        if (lat !== null && lat !== undefined && lon !== null && lon !== undefined && 
            !isNaN(Number(lat)) && !isNaN(Number(lon))) {
            location = { lat: Number(lat), lng: Number(lon) };
        }
        
        addToCart(
            title,
            image,
            null,
            category,
            address,
            null,
            null,
            opening_hours,
            null,
            location,
            website,
            { forceDay: selectedDay }
        );
        
        btn.classList.add('added');
        setTimeout(() => btn.classList.remove('added'), 1000);
        
        if (typeof restoreSidebar === "function") restoreSidebar();
        if (typeof updateCart === "function") updateCart();
        
        if (window.innerWidth <= 768) {
            const sidebarTrip = document.querySelector('.sidebar-trip');
            const sidebarOverlay = document.querySelector('.sidebar-overlay.sidebar-trip');
            if (sidebarTrip) sidebarTrip.classList.add('open');
            if (sidebarOverlay) sidebarOverlay.classList.add('open');
        }
        
        if (typeof window.showToast === 'function') {
            window.showToast(`✓ Added to Day ${selectedDay}`, 'success');
        }
    };
    
    document.addEventListener('click', listener);
    window.__triptime_addtotrip_listener = listener;
}

initializeAddToTripListener();

let selectedCity = null;
let selectedDays = null;
let isProcessing = false;


function updateTripTitle() {
    const tripTitleDiv = document.getElementById("trip_title");
    const userQuery = window.lastUserQuery ? window.lastUserQuery.trim() : "";
    tripTitleDiv.textContent = userQuery.length > 0 ? userQuery : "Trip Plan";
}


let hasAutoAddedToCart = false;

async function showResults() {

    // Eski chat balonlarında kalmış route-map-day* kalıntılarını temizle (opsiyonel güvenlik)
    (function cleanupChatRouteArtifacts(){
        const chatBox = document.getElementById("chat-box");
        if (!chatBox) return;
        chatBox.querySelectorAll('[id^="route-map-day"]').forEach(el => {
            if (!el.closest('.day-container')) el.remove();
        });
        chatBox.querySelectorAll('[id^="map-bottom-controls-wrapper-day"]').forEach(el => {
            if (!el.closest('.day-container')) el.remove();
        });
        chatBox.querySelectorAll('.route-controls-bar').forEach(el => {
            if (!el.closest('.day-container')) el.remove();
        });
    })();

    if (window.latestTripPlan && Array.isArray(window.latestTripPlan) && window.latestTripPlan.length > 0) {
        window.cart = window.latestTripPlan.map(item => {
            let loc = null;
            if (item.location && typeof item.location.lat !== "undefined" && typeof item.location.lng !== "undefined") {
                loc = { lat: Number(item.location.lat), lng: Number(item.location.lng) };
            } else if (item.lat && item.lon) {
                loc = { lat: Number(item.lat), lng: Number(item.lon) };
            }
            return { ...item, location: loc };
        });
        if (typeof saveCurrentTripToStorage === "function") saveCurrentTripToStorage();
    }

    const chatBox = document.getElementById("chat-box");
    const tripTitle = (typeof lastUserQuery === "string" && lastUserQuery.trim().length > 0)
        ? lastUserQuery.trim()
        : "Trip Plan";

    let html = `
        <div class="survey-results bot-message message">
            <h3 class="trip-title" id="trip_title">${tripTitle}</h3>
            <p>Here are some suggestions for your trip:</p>
            <div class="sect">
                <ul class="accordion-list">`;

    const daysCount = Math.max(...latestTripPlan.map(item => item.day));
    for (let day = 1; day <= daysCount; day++) {
        let stepsHtml = '';
        // FARKLI KATEGORİLERDEN TEK SLIDER
        let sliderItems = [];
        for (const cat of dailyCategories) {
            let step = latestTripPlan.find(item =>
                item.day == day && (item.category === cat.en || item.category === cat.tr)
            );
            if (step) {
                sliderItems.push(generateStepHtml(step, day, cat.en));
            }
        }
        stepsHtml += `
          <div class="splide" id="splide-slider-day${day}">
            <div class="splide__track">
              <ul class="splide__list">
                ${sliderItems.map(itemHtml => `<li class="splide__slide">${itemHtml}</li>`).join('')}
              </ul>
            </div>
          </div>
        `;

        const dayId = `day-${day}`;
        html += `
            <li class="day-item">
                <div class="accordion-container">
                    <input type="checkbox" id="${dayId}" class="accordion-toggle" checked>
                    <label for="${dayId}" class="accordion-label">
                        Day ${day}
                        <img src="img/arrow_down.svg" class="accordion-arrow">
                    </label>
                    <div class="accordion-content">
                        <div class="day-steps active-view" data-day="${day}">
                            ${stepsHtml}
                        </div>
                    </div>
                </div>
            </li>`;
    }

    html += `</ul></div></div>`;
    chatBox.innerHTML += html;
    if (chatBox.scrollHeight - chatBox.clientHeight > 100) {
  chatBox.scrollTop = chatBox.scrollHeight;
}
    // === HEMEN LOADING PANELİ GİZLE ===
    window.__welcomeHiddenForever = true;
    document.querySelectorAll('.cw').forEach(cw => cw.style.display = "none");
    hideLoadingPanel();
    console.log("hideLoadingPanel çağrıldı!");

    // Splide sliderları mount et (DOM güncellemesi sonrası)
    setTimeout(() => {
        document.querySelectorAll('.splide').forEach(sliderElem => {
            if (!sliderElem._splideInstance) {
                const splideInstance = new Splide(sliderElem, {
                   type: 'slide',
                      perPage: 5, // veya perPage: 1 (her seferinde bir item gözüksün)
                      gap: '18px',
                      arrows: true,
                      pagination: false,
                    drag: true,
                    breakpoints: {
                        575: { perPage: 1 },
                        768: { perPage: 2 },
                        1000: { perPage: 1 },
                        1350: { perPage: 2 },
                        1650: { perPage: 3 },
                        2000: { perPage: 4 }
                    }
                });
                splideInstance.mount();
                sliderElem._splideInstance = splideInstance;
            }
        });
    }, 1);

    attachFavEvents();

    // Sepeti (sidebar) doldur
    if (typeof addChatResultsToCart === "function" && !window.hasAutoAddedToCart) {
        try {
            addChatResultsToCart();
            window.hasAutoAddedToCart = true;
        } catch (e) {}
    }

  

    setTimeout(() => {
        if (typeof getDayPoints === 'function') {
            const pts = getDayPoints(1);
            if (Array.isArray(pts) && pts.length >= 2) {
                renderRouteForDay(1);
            }
        }
    }, 500);

    updateCart();

    // --- YENİ EKLE ---
    const days = [...new Set(window.cart.map(i => i.day))];
    await Promise.all(days.map(day => renderRouteForDay(day)));
    await saveTripAfterRoutes();
    renderMyTripsPanel();
    fillGeoapifyTagsOnly();
    attachImLuckyEvents();

}


function toggleAccordion(accordionHeader) {
    const accordionItem = accordionHeader.parentElement;
    const accordionContent = accordionHeader.nextElementSibling;
    const accordionArrow = accordionHeader.querySelector('.accordion-arrow');

    // Açık/kapalı durumu değiştir
    const isOpen = accordionContent.style.maxHeight && accordionContent.style.maxHeight !== '0px';
    
    if (isOpen) {
        // Kapat
        accordionContent.style.maxHeight = '0';
        accordionContent.style.padding = '0';
        accordionArrow.style.transform = 'rotate(180deg)';
    } else {
        // Aç
        accordionContent.style.maxHeight = accordionContent.scrollHeight + 'px';
        accordionContent.style.padding = '15px 0';
        accordionArrow.style.transform = 'rotate(0deg)';
    }
}


window.showSuggestionsInChat = async function(category, day = 1, code = null, radiusKm = 3, limit = 5) {
    // --- YARDIMCI FONKSİYON: Objenin içinden koordinat söküp al ---
    function extractCoords(item) {
        if (!item) return null;
        let lat, lon;
        // 1. Nested location objesi
        if (item.location && typeof item.location === 'object') {
            lat = item.location.lat || item.location.latitude;
            lon = item.location.lon || item.location.lng || item.location.longitude;
        }
        // 2. Kök özellikler
        if (!lat || !lon) {
            lat = item.lat || item.latitude || item._lat;
            lon = item.lon || item.lng || item.longitude || item._lon || item._lng;
        }
        // 3. Dataset
        if ((!lat || !lon) && item.dataset) {
            lat = item.dataset.lat;
            lon = item.dataset.lon || item.dataset.lng;
        }
        // 4. Parse
        if (lat) lat = parseFloat(lat);
        if (lon) lon = parseFloat(lon);

        if (typeof lat === 'number' && !isNaN(lat) && typeof lon === 'number' && !isNaN(lon)) {
            if (lat !== 0 && lon !== 0) return `${lat},${lon}`;
        }
        return null;
    }

    // Konsol Takibi
    console.log(`%c[Smart Search] Radius: ${radiusKm}km, Limit: ${limit}`, "color: orange; font-weight: bold;");
    
    let searchLocation = null;

    // --- LOKASYON BELİRLEME (Önceki sağlam mantığımız) ---
    if (window.cart && Array.isArray(window.cart) && window.cart.length > 0) {
        const dayItems = window.cart.filter(item => item.day == day);
        const targetItem = dayItems.length > 0 ? dayItems[dayItems.length - 1] : window.cart[window.cart.length - 1];
        if (targetItem) searchLocation = extractCoords(targetItem);
    }
    if (!searchLocation && typeof window.generatedTrip !== 'undefined' && window.generatedTrip[day - 1]) {
        const dt = window.generatedTrip[day - 1];
        if (dt && dt.length > 0) searchLocation = extractCoords(dt[dt.length - 1]);
    }
    if (!searchLocation) {
        const possibleElements = document.querySelectorAll('.travel-item, .cart-item, li[data-lat]');
        if (possibleElements.length > 0) {
            const el = possibleElements[possibleElements.length - 1];
            let lat = el.getAttribute('data-lat');
            let lon = el.getAttribute('data-lon') || el.getAttribute('data-lng');
            if (lat && lon) searchLocation = `${lat},${lon}`;
        }
    }

    if (!searchLocation) {
        let city = window.selectedCity || document.getElementById("city-input")?.value;
        if (city) searchLocation = city;
        else {
            addMessage("Location not found. Please add a place to your trip first.", "bot-message");
            return;
        }
    }

    // Sidebar kapatma
    if (window.innerWidth <= 768) {
        var sidebar = document.querySelector('.sidebar-overlay.sidebar-trip');
        if (sidebar) sidebar.classList.remove('open');
    }

    showTypingIndicator();

    let realCode = code || geoapifyCategoryMap[category] || placeCategories[category];
    if (!realCode) {
        hideTypingIndicator();
        addMessage("Invalid category.", "bot-message");
        return;
    }

    try {
        const radiusMeters = Math.round(radiusKm * 1000);
        
        // Arama yap
        const places = await getPlacesForCategory(searchLocation, category, limit, radiusMeters, realCode);
        
        // Sonuç yoksa ve hala genişletme payımız varsa
        if (places.length === 0 && radiusKm < 20) {
            hideTypingIndicator();
            // Otomatik genişletme teklifi (Hemen genişletmek yerine kullanıcıya soruyoruz)
            // Ama UX akıcı olsun diye displayPlacesInChat fonksiyonuna boş array gönderip orada butonu çizeceğiz.
             displayPlacesInChat([], category, day, code, radiusKm, limit, 0, true); 
             return;
        }

        // Eğer 20km'ye geldik ve hala sonuç yoksa
        if (places.length === 0 && radiusKm >= 20) {
            hideTypingIndicator();
            addMessage(`No ${category} found even within 20km. Please try searching on the map or choose a different category.`, "bot-message");
            return;
        }

        // Resimleri getir
        let cityForImages = window.selectedCity || "Turkey";
        if (searchLocation && !searchLocation.includes(",")) cityForImages = searchLocation;
        await enrichCategoryResults(places, cityForImages);

        hideTypingIndicator();

        const startIndex = limit > 5 ? limit - 5 : 0;
        
        // Display fonksiyonuna 'hasMoreResults' mantığını gönderiyoruz
        // Eğer gelen sonuç sayısı limite eşitse 'Load More' (pagination) var demektir.
        // Eğer sonuç azsa ve radius < 20 ise 'Widen Search' (genişletme) var demektir.
        displayPlacesInChat(places, category, day, code, radiusKm, limit, startIndex, false);

    } catch (error) {
        console.error("💥 Error:", error);
        hideTypingIndicator();
        addMessage("An error occurred.", "bot-message");
    }
};

// 2. Butonla şehir seçildiğinde de güncelle
window.handleCitySelection = async function(city, days) {
    if (window.isProcessing) return;
    window.isProcessing = true;
    window.selectedCity = city; // <-- DÜZELTME BURADA
addMessage(`Your selection: ${city}`, "user-message");
    showTypingIndicator();
    latestTripPlan = await buildPlan(city, days);
    latestTripPlan = await enrichPlanWithWiki(latestTripPlan);
    hideTypingIndicator();
    if (latestTripPlan && latestTripPlan.length > 0) {
        showResults();
    } else {
addMessage("Could not create a plan.", "bot-message");
    }
    window.isProcessing = false;
};


const MAX_INITIAL_ROUTE_KM = 12;
const MAX_ROUTE_KM = 30; // En fazla bu kadar genişlet
const STEP_KM = 3;

async function buildPlan(city, days) {
  const categories = ["Coffee", "Museum", "Touristic attraction", "Restaurant", "Accommodation"];
  let plan = [];
  let categoryResults = {};
  
  // [Global Dedup] Aynı mekanı planda 2 kere göstermemek için hafıza
  const globalSelectedPlaceNames = new Set();

  // Koordinatları al ve SAKLA (Mesafe hesabı için lazım)
  const cityCoords = await getCityCoordinates(city); 

  // --- 1. ÖZEL KOD TANIMLARI ---
  const localCodes = {
      "Coffee": "catering.cafe",
      "Museum": "entertainment.museum",
      "Touristic attraction": "tourism.sights",
      "Restaurant": "catering.restaurant",
      "Accommodation": "accommodation.hotel",
      "Park": "leisure.park",
      "Viewpoint": "tourism.viewpoint",
      "Natural": "natural",
      "Heritage": "heritage",
      "Leisure": "leisure"
  };

  // Basit mesafe hesaplayıcı (Haversine) - Sıralama yapmak için
  function getDist(lat1, lon1, lat2, lon2) {
      if(!lat1 || !lon1 || !lat2 || !lon2) return 99999;
      const R = 6371; // km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
  }

  function getCode(catName) {
      if (localCodes[catName]) return localCodes[catName];
      if (window.geoapifyCategoryMap && window.geoapifyCategoryMap[catName]) return window.geoapifyCategoryMap[catName];
      if (window.placeCategories && window.placeCategories[catName]) return window.placeCategories[catName];
      return "tourism"; 
  }

  // --- 2. ARAMA MANTIĞI ---
  async function searchWithLogic(cat) {
      const MAX_RADIUS = 60000; 
      let radius = 3; 
      let catCode = getCode(cat);
      
      let places = await getPlacesForCategory(city, cat, 12, radius * 1000, catCode);
      
      let attempt = 0;
      const triedNames = new Set();
      while (places.length <= 1 && attempt < 5 && (radius * 1000) < MAX_RADIUS) {
          if (places.length === 1) triedNames.add(places[0].name);
          
          radius += 10; 
          if (radius * 1000 > MAX_RADIUS) radius = MAX_RADIUS / 1000;

          let newPlaces = await getPlacesForCategory(city, cat, 12, radius * 1000, catCode);
          newPlaces = newPlaces.filter(p => !triedNames.has(p.name));
          
          if (newPlaces.length > 0) places = places.concat(newPlaces);
          attempt++;
          if (radius * 1000 >= MAX_RADIUS) break;
      }
      return { places, finalRadius: radius };
  }

  // --- 3. KATEGORİ DÖNGÜSÜ ---
  for (const cat of categories) {
    let result = await searchWithLogic(cat);
    let places = result.places;

    // --- AKILLI FALLBACK (YEDEK PLAN) ---
    if (places.length === 0) {
        let fallbacks = [];
        
        // MÜZE YOKSA -> Tarihi Kalıntı, Manzara, Doğa, Park
        if (cat === 'Museum') {
             fallbacks = ['Heritage', 'Viewpoint', 'Natural', 'Park'];
        }
        // TURİSTİK YER YOKSA -> Doğa, Manzara, Eğlence, Park
        else if (cat === 'Touristic attraction') {
             fallbacks = ['Natural', 'Viewpoint', 'Leisure', 'Park'];
        }
        
        if (fallbacks.length > 0) {
            console.log(`[Smart Fallback] ${cat} bulunamadı. Alternatifler: ${fallbacks.join(', ')}`);
            for (const fbCat of fallbacks) {
                const fbCode = getCode(fbCat);
                // Alternatifleri 45km içinde ara
                let fbResult = await getPlacesForCategory(city, fbCat, 15, 45000, fbCode);
                
                if (fbResult.length > 0) {
                    // [DÜZELTME] Gelen sonuçları MERKEZE OLAN UZAKLIĞA göre sırala
                    if (cityCoords && cityCoords.lat) {
                        fbResult.forEach(p => {
                            p._dist = getDist(cityCoords.lat, cityCoords.lon, p.lat, p.lon);
                        });
                        fbResult.sort((a, b) => a._dist - b._dist);
                    }

                    // [KRİTİK HAMLE] Sadece en yakın 3 taneyi al (Salda gibi yakınları kaçırmamak için)
                    places = fbResult.slice(0, 3); 
                    break; 
                }
            }
        }
    }

    // --- LUCKY (Son Çare) ---
    if (places.length === 0) {
      let luckyRadius = result.finalRadius + 10;
      let foundPlace = null;
      let luckyAttempts = 0;
      const HARD_LIMIT = 80000;
      let catCode = getCode(cat);

      while (!foundPlace && luckyAttempts < 5 && (luckyRadius * 1000) < HARD_LIMIT) {
        let luckyResults = await getPlacesForCategory(city, cat, 5, luckyRadius * 1000, catCode);
        if (luckyResults.length > 0) {
          places = luckyResults;
          break;
        }
        luckyRadius += 15;
        luckyAttempts++;
      }
    }
 
    categoryResults[cat] = places;
  }

  // --- 4. GÜNLERE DAĞITIM ---
  for (let day = 1; day <= days; day++) {
    let dailyPlaces = [];
    for (const cat of categories) {
      const places = categoryResults[cat];
      if (places.length > 0) {
        let selectedPlace = null;
        let attempts = 0;
        
        while (attempts < 20) {
            let idx;
            
            // [AKILLI SEÇİM] Eğer bu kategori "Yedek" kategoriyse (Natural, Heritage, Park)
            // Rastgele seçme, listenin BAŞINDAKİNİ (en yakınını) seçmeye çalış.
            const isFallbackCategory = ["Natural", "Heritage", "Park", "Viewpoint"].includes(cat);
            
            if (isFallbackCategory) {
                 // En yakındaki (0), o doluyse bir sonraki (1)...
                 idx = attempts % places.length; 
            } else {
                 // Diğerleri için rastgele
                 idx = Math.floor(Math.random() * places.length);
            }
            
            // [FIX] 'candidate' ismi çakışma yaptığı için 'placeCandidate' yaptık
            const placeCandidate = places[idx];
            
            if (placeCandidate && !globalSelectedPlaceNames.has(placeCandidate.name)) {
                selectedPlace = placeCandidate;
                globalSelectedPlaceNames.add(placeCandidate.name);
                break;
            }
            attempts++;
        }
        
        if (!selectedPlace) {
             selectedPlace = places[Math.floor(Math.random() * places.length)];
        }

        dailyPlaces.push({ day, category: cat, ...selectedPlace });
      } else {
        dailyPlaces.push({ day, category: cat, name: null, _noPlace: true });
      }
    }
    plan = plan.concat(dailyPlaces);
  }

  // [SAFETY] Koordinatları sayıya çevir (OSRM Hatası önlemek için)
  plan.forEach(item => {
      if (item.lat) item.lat = parseFloat(item.lat);
      if (item.lon) item.lon = parseFloat(item.lon);
  });

  plan = await enrichPlanWithWiki(plan);
  plan = plan.map(normalizePlaceName);
  return plan;
}

function smartStepFilter(places, minM = 500, maxM = 2500, maxPlaces = 10) {
    if (places.length < 2) return places;
    let remaining = [...places];
    let route = [remaining.shift()];
    while (remaining.length > 0 && route.length < maxPlaces) {
        const last = route[route.length - 1];
        let inRange = remaining.map((p, i) => ({
            p, i,
            d: haversine(last.lat, last.lon, p.lat, p.lon)
        })).filter(o => o.d >= minM && o.d <= maxM);
        let next;
        if (inRange.length > 0) {
            inRange.sort((a, b) => a.d - b.d);
            next = inRange[0];
        } else {
            let all = remaining.map((p, i) => ({
                p, i,
                d: haversine(last.lat, last.lon, p.lat, p.lon)
            }));
            all.sort((a, b) => a.d - b.d);
            next = all[0];
        }
        if (!next) break;
        route.push(next.p);
        remaining.splice(next.i, 1);
    }
    return route;
}
function normalizePlaceName(place) {
  // .name alanını Latin/İngilizce yap
  place.name = getDisplayName(place);
  return place;
}
// 1️⃣  addChatResultsToCart() - İLK GÜN'Ü OTOMATIK EKLE
function addChatResultsToCart() {
    if (window.cart && window.cart.length > 0) return;
    
    const chatResults = document.querySelectorAll(".steps");
    const sorted = Array.from(chatResults).sort((a, b) => {
        const dayA = Number(a.getAttribute('data-day') || 1);
        const dayB = Number(b.getAttribute('data-day') || 1);
        if (dayA !== dayB) return dayA - dayB;
        const catA = a.getAttribute('data-category') || '';
        const catB = b.getAttribute('data-category') || '';
        const catOrder = ["Coffee", "Museum", "Touristic attraction", "Restaurant", "Accommodation"];
        return catOrder.indexOf(catA) - catOrder.indexOf(catB);
    });
    
    sorted.forEach(result => {
        const day = Number(result.getAttribute('data-day') || 1);
        const category = result.getAttribute('data-category');
        const lat = result.getAttribute('data-lat');
        const lon = result.getAttribute('data-lon');
        const image = result.querySelector('img.check')?.src || 'img/placeholder.png';
        const address = result.querySelector('.address')?.textContent.replace(/^[^:]*:\s*/, '').trim() || '';
        const opening_hours = result.querySelector('.opening_hours')?.textContent.replace(/^[^:]*:\s*/, '').trim() || '';
        
        let stepObj = null;
        if (result.dataset.step) {
            try { stepObj = JSON.parse(decodeURIComponent(result.dataset.step)); } catch (e) { stepObj = null; }
        }
        
        let name = "";
        if (stepObj && typeof getDisplayName === "function") {
            name = getDisplayName(stepObj);
        } else {
            name = result.querySelector('.title')?.textContent.trim() || '';
        }
        
        if (lat && lon && name) {
            addToCart(
                name,
                image,
                day,
                category,
                address,
                null, null,
                opening_hours,
                null,
                { lat: Number(lat), lng: Number(lon) },
                ''
            );
        }
    });
}

    // --- KLAVYE NAVİGASYONU & ENTER KORUMASI ---
function addActive(x) {
    if (!x) return false;
    removeActive(x);
    if (currentFocus >= x.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = (x.length - 1);
    x[currentFocus].classList.add("selected-suggestion");
    x[currentFocus].scrollIntoView({ block: "nearest" });
}

function removeActive(x) {
    for (let i = 0; i < x.length; i++) {
        x[i].classList.remove("selected-suggestion");
    }
}

document.addEventListener("DOMContentLoaded", function() {
    const inp = document.getElementById("user-input");
    if (inp) {
        inp.addEventListener("keydown", function(e) {
            const suggestionsDiv = document.getElementById("suggestions");
            // Eğer liste gizliyse (boşsa) tuşları dinleme
            if(!suggestionsDiv || suggestionsDiv.innerHTML.trim() === "") return;

            let items = suggestionsDiv.getElementsByClassName("category-area-option");
            
            if (e.key === "ArrowDown") {
                currentFocus++;
                addActive(items);
            } else if (e.key === "ArrowUp") {
                currentFocus--;
                addActive(items);
            } else if (e.key === "Enter") {
                // Eğer bir öğe seçiliyse (klavye ile), ona tıkla
                if (currentFocus > -1 && items && items[currentFocus]) {
                    e.preventDefault(); 
                    items[currentFocus].click();
                } 
                // Eğer daha önce mouse ile de seçilmediyse -> ENGELLE
                else if (!window.__locationPickedFromSuggestions) {
                    e.preventDefault();
                    // Uyarı efekti
                    this.style.transition = "border-color 0.2s";
                    this.style.borderColor = "#d32f2f";
                    setTimeout(() => { this.style.borderColor = ""; }, 400);
                }
            }
        });
    }
});


   
});

// Cache mekanizması eklendi
// === BU KODU MEVCUT getCityCoordinates YERİNE YAPIŞTIRIN ===
async function getCityCoordinates(city) {
    if (!city) return null;
    
    // 1. Şehir ismini standartlaştır (Küçük harf ve boşluk temizliği)
    // Böylece "Rome", "rome" ve "Rome " aynı kabul edilir.
    const normalize = (str) => str.trim().toLowerCase();
    const key = normalize(city);
    const STORAGE_KEY = 'city_coords_cache_v1';

    // 2. Önce RAM'e (Hızlı Erişim) Bak
    if (window.__cityCoordCache && window.__cityCoordCache.has(key)) {
        console.log(`[GeoCache] RAM hit for: ${city}`);
        return window.__cityCoordCache.get(key);
    }

    // 3. RAM'de yoksa, LocalStorage'a (Kalıcı Hafıza) Bak
    let storedData = {};
    try {
        storedData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch(e) {
        console.warn("[GeoCache] Storage parse error", e);
    }

    if (storedData[key]) {
        console.log(`[GeoCache] Disk hit for: ${city}`);
        // Bulduysak RAM'e de ekleyelim ki bu oturumda tekrar disk okuması yapmasın
        if (!window.__cityCoordCache) window.__cityCoordCache = new Map();
        window.__cityCoordCache.set(key, storedData[key]);
        return storedData[key];
    }

    // 4. Hiçbir yerde yoksa API'ye Git (Maliyetli İşlem)
    console.log(`[GeoCache] API call for: ${city}`);
    
    // URL yapınızın mevcut kodunuzla aynı olduğundan emin olun
    const url = `/api/geoapify/geocode?text=${encodeURIComponent(city)}&limit=1`;
    
    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`API Error: ${resp.status}`);
        
        const data = await resp.json();
        if (data.features && data.features.length > 0) {
            const f = data.features[0];
            const res = { lat: f.properties.lat, lon: f.properties.lon };

            // A) RAM'e Kaydet (Oturum süresince hızlı erişim)
            if (!window.__cityCoordCache) window.__cityCoordCache = new Map();
            window.__cityCoordCache.set(key, res);

            // B) LocalStorage'a Kaydet (Kalıcı - Sayfa yenilense bile gitmez)
            storedData[key] = res;
            // LocalStorage dolarsa diye hata yakalama (Quota Exceeded koruması)
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(storedData));
            } catch (storageErr) {
                console.warn("[GeoCache] LocalStorage full, skipping save.");
            }

            return res;
        }
    } catch (err) {
        console.error("Geocode error:", err);
    }
    return null;
}

const btn = document.getElementById('show-coords-btn');
if (btn) {
    btn.onclick = () => {
        showLatLngUnderOpeningHoursForStepsIn('.accordion-content');
    };
}


const maxItems = Infinity;
/* let itemRemoved = false; */
const dailyCategories = [
    { en: "Coffee" },
    { en: "Museum" },
    { en: "Touristic attraction" },
    { en: "Restaurant" },
    { en: "Accommodation" }
    
];
const chatCategories = ["Coffee", "Museum", "Touristic attraction", "Restaurant", "Accommodation"];


const categoryIcons = {
    "coffee": "img/coffee_icon.svg",
    "breakfast": "img/coffee_icon.svg",
    "cafes": "img/coffee_icon.svg",
    "museum": "img/museum_icon.svg",
    "touristic attraction": "img/touristic_icon.svg",
    "touristic": "img/touristic_icon.svg",
    "restaurant": "img/restaurant_icon.svg",
    "lunch": "img/restaurant_icon.svg",
    "dinner": "img/restaurant_icon.svg",
    "accommodation": "img/accommodation_icon.svg",
    "hotel": "img/accommodation_icon.svg",
    "hostel": "img/hostel_icon.svg",
    "parks": "img/park_icon.svg",
    "bar": "img/bar_icon.svg",
    "pub": "img/pub_icon.svg",
    "fast food": "img/fastfood_icon.svg",
    "supermarket": "img/supermarket_icon.svg",
    "pharmacy": "img/pharmacy_icon.svg",
    "hospital": "img/hospital_icon.svg",
    "bookstore": "img/bookstore_icon.svg",
    "post office": "img/postoffice_icon.svg",
    "library": "img/library_icon.svg",
    "cinema": "img/cinema_icon.svg",
    "jewelry shop": "img/jewelry_icon.svg",
    "university": "img/university_icon.svg",
    "religion": "img/religion_icon.svg",
    "entertainment": "img/entertainment_icon.svg"
};

function getCategoryIcon(category) {
    if (!category) return 'img/location.svg';
    const cat = category.toLowerCase().trim();
    return categoryIcons[cat] || 'img/location.svg';
}

function addToCart(
  name, image, day, category, address = null, rating = null, user_ratings_total = null,
  opening_hours = null, place_id = null, location = null, website = null, options = {}, silent = false, skipRender, icon = null
) {
  // === OVERRIDE BLOĞUNU TAMAMEN SİL! ===



  // 1) Placeholder temizliği
  if (window._removeMapPlaceholderOnce) {
    window.cart = (window.cart || []).filter(it => !it._placeholder);
    window._removeMapPlaceholderOnce = false;
  }

  // 2) Lokasyon kontrolü
  if (location && (
    typeof location.lat !== "number" ||
    typeof location.lng !== "number" ||
    isNaN(location.lat) ||
    isNaN(location.lng)
  )) {
    location = null;
  }

  // 3) Cart yapısını garanti et
  if (!Array.isArray(window.cart)) window.cart = [];

  // 4) Gün seçimi mantığı
  let forceDay = options && options.forceDay;
  let resolvedDay = Number(
    forceDay != null ? forceDay :
    (day != null ? day :
      (window.currentDay != null ? window.currentDay :
        (window.cart.length ? window.cart[window.cart.length - 1].day : 1)))
  );
  if (!Number.isFinite(resolvedDay) || resolvedDay <= 0) resolvedDay = 1;

  // 5) Lokasyon normalizasyonu
  let loc = null;
  if (location && typeof location.lat !== "undefined" && typeof location.lng !== "undefined") {
    const latNum = Number(location.lat);
    const lngNum = Number(location.lng);
    if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
      loc = { lat: latNum, lng: lngNum };
    }
  }

  // 6) İsim / kategori / image fallback
  const safeName = (name || '').toString().trim();
  const safeCategory = (category || 'Place').trim();
  const safeImage = image || 'img/placeholder.png';

  // 7) Duplicate kontrolü
  const isDuplicate = window.cart.some(item => {
    if (item.day !== resolvedDay) return false;
    if (!item.name || !safeName) return false;
    if (item.category !== safeCategory) return false;
    const sameName = item.name.trim().toLowerCase() === safeName.toLowerCase();
    if (!sameName) return false;
    if (loc && item.location) {
      return item.location.lat === loc.lat && item.location.lng === loc.lng;
    }
    if (!loc && !item.location) return true;
    return false;
  });

  if (isDuplicate) {
    if (window.showToast) window.showToast('Item already exists for this day.', 'info');
    return false;
  }

  // 8) Yeni öğe ekle
  const newItem = {
    name: safeName,
    image: safeImage,
    day: resolvedDay,
    category: safeCategory,
    address: address ? address.trim() : null,
    rating,
    user_ratings_total,
    opening_hours,
    place_id,
    location: loc,
    website,
    icon: icon || getCategoryIcon(safeCategory),  // ← BURAYA EKLE
    addedAt: new Date().toISOString()
};

  window.cart.push(newItem);

  // === skipRender fix ===
  if (typeof skipRender === "undefined") skipRender = false;

  // Sonraki kodlar aynı, silent değişkeni başta false olmalı
    if (! silent) {
    // ÖNEMLİ: Önce cart'a ekle (zaten yapıldı), sonra tek bir updateCart çağır
    // renderRouteForDay updateCart içinde zaten çağrılıyor, burada tekrar çağırmayın
    if (typeof updateCart === "function") {
      updateCart();
    }
    
    // Sidebar aç
    if (typeof openSidebar === 'function') {
      openSidebar();
      if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar-overlay. sidebar-trip');
        if (sidebar) sidebar.classList.add('open');
      }
    }
   
    if (window.expandedMaps) {
      clearRouteSegmentHighlight(resolvedDay);
      fitExpandedMapToRoute(resolvedDay);
    }
    
    // Kaydetme işlemini en sona al
    if (typeof saveTripAfterRoutes === "function") {
      setTimeout(() => saveTripAfterRoutes(), 100);
    }
  }
  return true;
}
function __dayIsEmpty(day){
  day = Number(day);
  if (!day) return false;
  return !window.cart.some(it =>
    it.day === day &&
    it.name &&
    !it._starter &&
    !it._placeholder
  );
}

/* Basit GPX parser (trkpt > rtept > wpt fallback) */
function parseGpxToLatLng(gpxText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(gpxText, 'application/xml');
  if (xml.querySelector('parsererror')) return [];
  const collect = (nodes) => Array.from(nodes).map(el => {
    const lat = parseFloat(el.getAttribute('lat'));
    const lon = parseFloat(el.getAttribute('lon'));
    if (isNaN(lat) || isNaN(lon)) return null;
    const timeEl = el.querySelector('time');
    return { lat, lng: lon, time: timeEl ? Date.parse(timeEl.textContent) : null };
  }).filter(Boolean);

  let pts = collect(xml.getElementsByTagName('trkpt'));
  if (!pts.length) pts = collect(xml.getElementsByTagName('rtept'));
  if (!pts.length) pts = collect(xml.getElementsByTagName('wpt'));
  if (!pts.length) {
    pts = Array.from(xml.querySelectorAll('[lat][lon]')).map(el => {
      const lat = parseFloat(el.getAttribute('lat'));
      const lon = parseFloat(el.getAttribute('lon'));
      return (!isNaN(lat) && !isNaN(lon)) ? { lat, lng: lon } : null;
    }).filter(Boolean);
  }
  return pts;
}

/* Basit KML parser (LineString veya coordinates blokları) */
function parseKmlToLatLng(kmlText){
  const parser = new DOMParser();
  const xml = parser.parseFromString(kmlText, 'application/xml');
  if (xml.querySelector('parsererror')) return [];
  const coordsNodes = Array.from(xml.getElementsByTagName('coordinates'));
  const pts = [];
  coordsNodes.forEach(node => {
    (node.textContent || '')
      .trim()
      .split(/\s+/)
      .forEach(line => {
        if (!line) return;
        const parts = line.split(',');
        if (parts.length >= 2) {
          const lon = parseFloat(parts[0]);
          const lat = parseFloat(parts[1]);
            if (!isNaN(lat) && !isNaN(lon)) pts.push({ lat, lng: lon });
        }
      });
  });
  return pts;
}

function removeFromCart(index) {
  if (!Array.isArray(window.cart)) return;

  const removed = window.cart[index];
  const removedDay = removed && removed.day;

  window.cart.splice(index, 1);

  // Sepet tamamen boşaldıysa cleanup
  if (window.cart.length === 0) {
    localStorage.removeItem('cart');
    if (typeof closeAllExpandedMapsAndReset === 'function') closeAllExpandedMapsAndReset();
    if (typeof clearAllRouteCaches === 'function') clearAllRouteCaches();
    updateCart();
    // EKLE:
    if (typeof saveCurrentTripToStorage === "function") saveCurrentTripToStorage();
    return;
  }

  updateCart();

  // Silinen günün noktası 2'den azsa, temizlik yap
  if (removedDay) {
    const dayPoints = getDayPoints(removedDay);
    if (dayPoints.length < 2) {
      if (typeof clearRouteCachesForDay === 'function') clearRouteCachesForDay(removedDay);
      if (typeof clearRouteVisualsForDay === 'function') clearRouteVisualsForDay(removedDay);
    }
    if (window.expandedMaps) {
      clearRouteSegmentHighlight(removedDay);
      fitExpandedMapToRoute(removedDay);
    }
  }

  // Rotayı güncelle
  if (typeof renderRouteForDay === 'function') {
    const days = [...new Set(window.cart.map(i => i.day))];
    days.forEach(d => setTimeout(() => renderRouteForDay(d), 0));
  }

  // ---- BURAYA EKLE ----
  if (typeof saveCurrentTripToStorage === "function") saveCurrentTripToStorage();
}

function safeCoords(lat, lon) {
  if (
    lat !== null && lat !== undefined && lon !== null && lon !== undefined &&
    !isNaN(Number(lat)) && !isNaN(Number(lon))
  ) {
    return { lat: Number(lat), lng: Number(lon) };
  }
  return null;
}



function displayPlacesInChat(places, category, day, code = null, radiusKm = 3, limit = 5, startIndex = 0, forceWidenOption = false) {
    const chatBox = document.getElementById("chat-box");
    const uniqueId = `suggestion-${day}-${category.replace(/\s+/g, '-').toLowerCase()}`;
    const sliderId = `splide-slider-${uniqueId}`;

    // Eski sonuçları temizle (Yeniden çizim yapıyoruz)
    chatBox.querySelectorAll(`#${sliderId}`).forEach(el => {
        el.closest('.survey-results')?.remove();
    });

    let html = `
        <div class="survey-results bot-message message">
            <div class="accordion-container">
                <input type="checkbox" id="${uniqueId}" class="accordion-toggle" checked>
                <label for="${uniqueId}" class="accordion-label">
                    ${places.length > 0 ? `Suggestions for ${category} (${radiusKm}km)` : `No results in ${radiusKm}km`}
                    <img src="img/arrow_down.svg" class="accordion-arrow">
                </label>
                <div class="accordion-content">
                    <div class="splide" id="${sliderId}">
                        <div class="splide__track">
                            <ul class="splide__list">
    `;

    // Mekanları listele
    places.forEach((place, idx) => {
        html += `
            <li class="splide__slide">
                ${generateStepHtml(place, day, category, idx)}
            </li>
        `;
    });

    // --- AKILLI BUTON MANTIĞI ---
    
    // DURUM 1: Liste doldu (limit kadar geldi) -> Sayfalama yap (Load More)
    // Sadece radius değiştirmeden daha fazla veri çek.
    if (places.length >= limit) {
         html += `
            <li class="splide__slide">
                <div class="visual step-item load-more-card" 
                     onclick="window.showSuggestionsInChat('${category}', ${day}, ${code ? "'" + code + "'" : 'null'}, ${radiusKm}, ${limit + 5})"
                     style="height: 100%; height: 489px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8f9fa; border: 2px dashed #cbd5e1; border-radius: 12px; cursor: pointer; transition: all 0.2s;">
                    <div style="font-size: 32px; color: #64748b; margin-bottom: 8px;">+</div>
                    <div style="font-size: 14px; font-weight: 600; color: #64748b;">Load More Results</div>
                    <div style="font-size: 12px; color: #94a3b8;">(Same Area)</div>
                </div>
            </li>
        `;
    }
    
    // DURUM 2: Liste az geldi (veya hiç gelmedi) VE Max Radius'a gelmedik -> Genişlet (Widen Area)
    // Eğer limit 5 istedik ama 2 geldiyse, o alanda başka yok demektir. Alanı genişletelim.
    else if (radiusKm < 20) {
        // Yeni yarıçapı belirle (Kademeli artış: 3 -> 8 -> 15 -> 20)
        let nextRadius = 20;
        if (radiusKm < 5) nextRadius = 8;
        else if (radiusKm < 10) nextRadius = 15;
        
        html += `
            <li class="splide__slide">
                <div class="visual step-item widen-area-card" 
                     onclick="window.showSuggestionsInChat('${category}', ${day}, ${code ? "'" + code + "'" : 'null'}, ${nextRadius}, ${limit})"
                     style="height: 100%; height: 489px;; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #eff6ff; border: 2px dashed #60a5fa; border-radius: 12px; cursor: pointer; transition: all 0.2s;">
                    <div style="font-size: 32px; color: #3b82f6; margin-bottom: 8px;">🔭</div>
                    <div style="font-size: 14px; font-weight: 600; color: #3b82f6;">Search Further</div>
                    <div style="font-size: 12px; color: #60a5fa;">Expand to ${nextRadius}km</div>
                    ${places.length === 0 ? '<div style="margin-top:5px; font-size:11px; color:#ef4444;">(No places found nearby)</div>' : ''}
                </div>
            </li>
        `;
    }
    
    // DURUM 3: Max Radius (20km) doldu ve hala kullanıcı tatmin olmadıysa
    else if (radiusKm >= 20 && places.length < limit) {
         html += `
            <li class="splide__slide">
                <div class="visual step-item end-search-card" 
                     style="height: 100%; height: 489px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #fff1f2; border: 2px dashed #fda4af; border-radius: 12px;">
                    <div style="font-size: 32px; color: #e11d48; margin-bottom: 8px;">📍</div>
                    <div style="font-size: 14px; font-weight: 600; color: #e11d48;">That's all!</div>
                    <div style="font-size: 12px; color: #fb7185; text-align:center; padding:0 10px;">
                        We searched up to 20km.<br>Try searching on the map manually.
                    </div>
                </div>
            </li>
        `;
    }

    // -----------------------

    html += `
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

    chatBox.innerHTML += html;
    
    // Scroll ayarı (Eğer forceWidenOption varsa yani hiç sonuç yoksa scroll yapmasın daha iyi olabilir ama genelde iyidir)
    if (chatBox.scrollHeight - chatBox.clientHeight > 100) {
        chatBox.scrollTop = chatBox.scrollHeight;
    }
    
    attachFavEvents();

    // Slider'ı başlat
    setTimeout(() => {
        document.querySelectorAll('.splide').forEach(sliderElem => {
            if (!sliderElem._splideInstance) {
                const isTargetSlider = sliderElem.id === sliderId;
                const initialIndex = isTargetSlider ? startIndex : 0;

                const splideInstance = new Splide(sliderElem, {
                    type: 'slide',
                    start: initialIndex,
                    perPage: 5,
                    gap: '18px',
                    arrows: true,
                    pagination: false,
                    drag: true,
                    breakpoints: {
                        575: { perPage: 1 },
                        768: { perPage: 2 },
                        1000: { perPage: 1 },
                        1350: { perPage: 2 },
                        1650: { perPage: 3 },
                        2000: { perPage: 4 }
                    }
                });
                splideInstance.mount();
                sliderElem._splideInstance = splideInstance;
            }
        });
    }, 1);
}

// Website açma fonksiyonu
window.openWebsite = function(element, url) {
    if (url) window.open(url, '_blank');
};


// Kategori elemanını bulup click eventini ekle (örnek)
document.querySelectorAll('.sidebar-category').forEach(el => {
    el.addEventListener('click', function () {
        // Sadece veri attributeden temiz kategori adı çek
        const category = this.dataset.category;
        showSuggestionsInChat(category, 1);
    });
});
// Şehir input'unun değişimini dinle ve selectedCity'yi ayarla
document.addEventListener("DOMContentLoaded", function() {
  const cityInput = document.getElementById("city-input");
  if (cityInput) {
    cityInput.addEventListener("change", function() {
      // ...
    });
  }
});

function categoryIcon(category) {
    // Kategori isimlerini normalize et (Büyük/küçük harf hatasını önler)
    const cat = String(category || "").trim();
    
    const icons = {
        // --- Mevcut Temel Kategoriler ---
        "Coffee": "img/coffee_icon.svg",
        "Museum": "img/museum_icon.svg",
        "Touristic attraction": "img/touristic_icon.svg",
        "Restaurant": "img/restaurant_icon.svg",
        "Accommodation": "img/accommodation_icon.svg",

        // --- Yeni Eklenen Traveler Needs Kategorileri ---
        "Bar": "img/bar_icon.svg",
        "Pub": "img/pub_icon.svg",
        "Fast Food": "img/fastfood_icon.svg",
        "Supermarket": "img/supermarket_icon.svg",
        "Pharmacy": "img/pharmacy_icon.svg",
        "Hospital": "img/hospital_icon.svg",
        "Bookstore": "img/bookstore_icon.svg",
        "Post Office": "img/postoffice_icon.svg",
        "Library": "img/library_icon.svg",
        "Hostel": "img/hostel_icon.svg", // Eğer ayrı ikon yoksa accommodation_icon.svg de verebilirsiniz
        "Cinema": "img/cinema_icon.svg",
        "Jewelry Shop": "img/jewelry_icon.svg",
        "University": "img/university_icon.svg",
        "Religion": "img/religion_icon.svg"
    };

    // Eğer listede yoksa varsayılan location ikonunu döndür
    return icons[cat] || "img/location.svg";
}



const placeCategories = {
    "Coffee": "catering.cafe",     
    "Museum": "entertainment.museum",      
    "Touristic attraction": "tourism.sights",         
    "Restaurant": "catering.restaurant",
    "Accommodation": "accommodation.hotel",
    
};

const geoapifyCategoryMap = {
  // Basic Plan
  "Coffee": "catering.cafe",
  "Museum": "entertainment.museum",
  "Touristic attraction": "tourism.sights",
  "Restaurant": "catering.restaurant",
  "Accommodation": "accommodation.hotel",
   

  // Traveler Needs (20 ana kategori) — DÜZELTİLDİ!
  "Bar": "catering.bar",
  "Pub": "catering.pub",
  "Fast Food": "catering.fast_food",
  "Supermarket": "commercial.supermarket",
  "Pharmacy": "healthcare.pharmacy",
  "Hospital": "healthcare.hospital",
  "Bookstore": "commercial.books",
  "Post Office": "service.post",
  "Library": "education.library",
  "Hostel": "accommodation.hostel",
  "Cinema": "entertainment.cinema",  
  "Jewelry Shop": "commercial.jewelry", 
  "University": "education.university",
  "Religion": "religion"
};

function showCategoryList(day) {

    // === AI Info Section Toggle ===
    const aiInfoSection = document.querySelector('.ai-info-section');
    if (aiInfoSection) {
        aiInfoSection.style.display = 'none';
    }

    window.currentDay = day;
    console.log("showCategoryList CALLED, day=", day);

    const cartDiv = document.getElementById("cart-items");
    if (!cartDiv) return;

    // Clear existing content
    cartDiv.innerHTML = "";
 
    // --- Auto Plan Container ---
    const autoPlanContainer = document.createElement("div");
    autoPlanContainer.id = "auto-plan-container";
    cartDiv.appendChild(autoPlanContainer);

    // --- Manual Add Section ---
    const manualAddSection = document.createElement("div");
    manualAddSection.className = "manual-add-section";
    manualAddSection.innerHTML = `
        <h3>Add Custom Place to Day ${day}</h3>
        <div class="search-container">
            <input type="text" id="place-input-${day}" placeholder="Enter place name" class="place-input">
            <div id="place-details-${day}" class="place-details"></div>
        </div>
    `;
    cartDiv.appendChild(manualAddSection);

    // --- Custom Note Container (initially hidden) ---
    // NOT: Bu container burada kalabilir. Butonu day listesinde göstereceğiz.
    const customNoteContainer = document.createElement("div");
    customNoteContainer.id = "customNoteContainer";
    customNoteContainer.style.display = "none";
    customNoteContainer.className = "custom-note-container";
    customNoteContainer.innerHTML = `
        <h3>Add Custom Note for Day ${day}</h3>
        <input type="text" id="noteTitle" placeholder="Note title" class="note-input">
        <textarea id="noteDetails" placeholder="Note details" class="note-textarea"></textarea>
        <div class="modal-actions">
            <button id="btn-save-note" class="save-note">Save Note</button>
            <button id="btn-cancel-note" class="cancel-note">Cancel</button>
        </div>
    `;


    // --- Categories Data ---
    const basicPlanCategories = [
        { name: "Coffee", icon: "☕" },
        { name: "Museum", icon: "🏛️" },
        { name: "Touristic attraction", icon: "🏞️" },
        { name: "Restaurant", icon: "🍽️" },
        { name: "Accommodation", icon: "🏨" }
    ];

    const travelMainCategories = [
    { name: "Hostel", code: "accommodation.hostel", icon: "🛏️" },
    { name: "Bar", code: "catering.bar", icon: "🍹" },
    { name: "Pub", code: "catering.pub", icon: "🍻" },
    { name: "Fast Food", code: "catering.fast_food", icon: "🍔" },
    { name: "ATM", code: "commercial.money.atm", icon: "🏧" },
    { name: "Park", code: "leisure.park", icon: "🌳" },
    { name: "Religion", code: "religion", icon: "⛪" },

    { name: "Supermarket", code: "commercial.supermarket", icon: "🛒" },
    { name: "Clothes", code: "commercial.clothing", icon: "👕" },
    { name: "Toy Store", code: "commercial.toys", icon: "🧸" },
    { name: "Electronics", code: "commercial.electronics", icon: "📱" },    
    { name: "Department Store", code: "commercial.department_store", icon: "🏬" },
    { name: "Florist", code: "commercial.florist", icon: "💐" },
    { name: "Ice Cream", code: "catering.ice_cream", icon: "🍦" },
    
    { name: "Jewelry Shop", code: "commercial.jewelry", icon: "💍" },
    { name: "Pharmacy", code: "healthcare.pharmacy", icon: "💊" },
    { name: "Bookstore", code: "commercial.books", icon: "📚" },

    { name: "Library", code: "education.library", icon: "📖" },
    { name: "Hospital", code: "healthcare.hospital", icon: "🏥" },
    { name: "Police", code: "service.police", icon: "👮" },   
    { name: "Post Office", code: "service.post", icon: "📮" },
    { name: "University", code: "education.university", icon: "🎓" },
    { name: "Cinema", code: "entertainment.cinema", icon: "🎬" },
    { name: "Gym", code: "sport.fitness", icon: "💪" },

    
        // Çalışan 10 kategori    
    { name: "Parking", code: "parking", icon: "🅿️" },
    { name: "Bus Station", code: "public_transport.bus", icon: "🚌" },       
    { name: "Gas Station", code: "commercial.gas", icon: "⛽" },
    { name: "Train Station", code: "public_transport.train", icon: "🚆" }

    
   
];
    // -------- BASIC PLAN BLOK --------
    const basicPlanItem = document.createElement("div");
    basicPlanItem.classList.add("category-item");
    const basicHeader = document.createElement("h4");
    basicHeader.textContent = "Trip Basics";
    basicPlanItem.appendChild(basicHeader);

    const basicList = document.createElement("ul");
    basicList.classList.add("subcategory-list");

    basicPlanCategories.forEach(cat => {
        const subCategoryItem = document.createElement("li");
        subCategoryItem.classList.add("subcategory-item");

        const iconSpan = document.createElement("span");
        iconSpan.classList.add("subcategory-icon");
        iconSpan.textContent = cat.icon;

        const nameSpan = document.createElement("span");
        nameSpan.classList.add("subcategory-name");
        nameSpan.textContent = cat.name;

        const toggleBtn = document.createElement("button");
        toggleBtn.classList.add("toggle-subcategory-btn");
        toggleBtn.textContent = "View";

        subCategoryItem.appendChild(iconSpan);
        subCategoryItem.appendChild(nameSpan);
        subCategoryItem.appendChild(toggleBtn);
        basicList.appendChild(subCategoryItem);

        subCategoryItem.addEventListener("click", (e) => {
            e.stopPropagation();
            if (typeof closeAllExpandedMapsAndReset === "function") closeAllExpandedMapsAndReset();
            showSuggestionsInChat(cat.name, day, cat.code);
        });
    });

    basicPlanItem.appendChild(basicList);
    cartDiv.appendChild(basicPlanItem);

    // -------- TRAVELER NEEDS BLOK --------
    const travelerItem = document.createElement("div");
    travelerItem.classList.add("category-item");
    const travelerHeader = document.createElement("h4");
    travelerHeader.textContent = "Traveler Needs";
    travelerItem.appendChild(travelerHeader);

    const travelerList = document.createElement("ul");
    travelerList.classList.add("subcategory-list");

    travelMainCategories.forEach(cat => {
        const subCategoryItem = document.createElement("li");
        subCategoryItem.classList.add("subcategory-item", "premium-category-bg");

        const iconSpan = document.createElement("span");
        iconSpan.classList.add("subcategory-icon");
        iconSpan.textContent = cat.icon;

        const nameSpan = document.createElement("span");
        nameSpan.classList.add("subcategory-name");
        nameSpan.textContent = cat.name;

        const toggleBtn = document.createElement("button");
        toggleBtn.classList.add("toggle-subcategory-btn");
        toggleBtn.textContent = "View";

        subCategoryItem.appendChild(iconSpan);
        subCategoryItem.appendChild(nameSpan);
        subCategoryItem.appendChild(toggleBtn);
        travelerList.appendChild(subCategoryItem);

        subCategoryItem.addEventListener("click", (e) => {
            e.stopPropagation();
            showSuggestionsInChat(cat.name, day, cat.code);
        });
    });

    travelerItem.appendChild(travelerList);
    cartDiv.appendChild(travelerItem);

    // --- Close Button ---
    const closeButton = document.createElement("button");
    closeButton.classList.add("close-btn");
    closeButton.textContent = "Close";
    if (typeof restoreSidebar === "function") {
        closeButton.addEventListener("click", restoreSidebar);
    }
    cartDiv.appendChild(closeButton);

    if (typeof initPlaceSearch === "function") {
        initPlaceSearch(day);
    }
}


async function saveCustomNote(day) {
    const titleEl = document.getElementById("noteTitle");
    const detailsEl = document.getElementById("noteDetails");
    
    if (!titleEl || !detailsEl) {
        console.error("Note inputs not found");
        return;
    }

    const title = titleEl.value ? titleEl.value.trim() : "";
    const details = detailsEl.value ? detailsEl.value.trim() : "";

    // İkisi de boşsa uyarı ver
    if (!title && !details) {
        alert("Please enter a title or detail for your note.");
        return;
    }

    // Cart dizisinin var olduğundan emin ol
    if (!window.cart) {
        window.cart = [];
    }

    // 1. Notu RAM'e (window.cart) ekle
    window.cart.push({
        name: title || "Note", // Başlık yoksa "Note" olsun
        noteDetails: (details && details.length > 0) ? details : "No description", // Detay yoksa metni ayarla
        day: Number(day),
        category: "Note",
        image: "img/custom-note.svg" // Varsayılan not ikonu
    });

    console.log("Note added to RAM for day", day);

    // 2. Kalıcı Hafızaya (LocalStorage) Kaydet
    // ÖNEMLİ: 'withThumbnail: false' diyerek harita oluşturmayı atlıyoruz, böylece kayıt anında gerçekleşir.
    if (typeof saveCurrentTripToStorage === "function") {
        try {
            await saveCurrentTripToStorage({ withThumbnail: false });
            console.log("Trip saved to localStorage successfully.");
        } catch (e) {
            console.error("Save to storage failed:", e);
            alert("Error saving note. Please try again.");
        }
    } else {
        console.warn("saveCurrentTripToStorage function is missing! Data not saved to disk.");
    }

    // 3. Arayüzü güncelle
    if (typeof updateCart === "function") {
        updateCart();
    } else {
        console.warn("updateCart function is missing!");
    }
    
    // Pencereyi kapat
    closeCustomNoteInput();
}

function closeCustomNoteInput() {
    var input = document.getElementById("custom-note-input");
    if (input) {
        input.style.display = "none";
    }
}


function escapeHtml(text) {
  if (text == null) return "";
  return text
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const apiCache = new Map();

const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

let lastRequestTime = 0;
async function geoapifyAutocomplete(query) {
  // LİMİTİ ARTIRDIK: Varsayılan (5) yerine 20 sonuç istiyoruz.
  // Böylece popüler yerler listenin sonlarında gelse bile yakalayacağız.
  const resp = await fetch(`/api/geoapify/autocomplete?q=${encodeURIComponent(query)}&limit=20`);
  if (!resp.ok) throw new Error("API error");
  const data = await resp.json();
  return data.features || [];
}


// Sadece photoget-proxy ile çalışıyor!
async function getPexelsImage(query) {
    return await getPhoto(query, "pexels");
}

async function getPixabayCategoryImage(category) {
    return await getPhoto(category, "pixabay");
}

window.getPixabayImage = async function(query) {
    return await getPhoto(query, "pixabay");
};

// mainscript.js içinde bu fonksiyonu bulun ve değiştirin:

async function getImageForPlace(placeName, category, cityName) {
    const queries = [
        [placeName, category, cityName].filter(Boolean).join(" "),
        [placeName, cityName].filter(Boolean).join(" "),
        [placeName, category].filter(Boolean).join(" "),
        placeName
    ];

    for (let q of queries) {
        if (!q || !q.trim()) continue;
        
        // ÖNCE PEXELS DENE (Chat ve Listeler için)
        const pexelsImg = await getPexelsImage(q);
        if (pexelsImg && pexelsImg !== PLACEHOLDER_IMG) {
            return pexelsImg;
        }
    }

    // Kategori bazlı fallback (Pexels)
    if (category) {
        const pexelsImg = await getPexelsImage(category);
        if (pexelsImg && pexelsImg !== PLACEHOLDER_IMG) {
            return pexelsImg;
        }
    }

    // En son çare (Pexels 'travel' araması)
    const fallbackImg = await getPexelsImage("travel");
    if (fallbackImg && fallbackImg !== PLACEHOLDER_IMG) {
        return fallbackImg;
    }
    return PLACEHOLDER_IMG;
}

async function getOptimizedImage(properties) {
    let query = properties.name || properties.city || properties.category || "travel";
    if (!query || typeof query !== "string" || query.trim() === "") query = "travel";

    // 1. ÖNCE PEXELS (Site Geneli)
    const pexelsImg = await getPexelsImage(query);
    if (pexelsImg && pexelsImg !== PLACEHOLDER_IMG) {
        return pexelsImg;
    }

    // 2. Bulamazsa Pixabay (Yedek)
    const pixabayImg = await window.getPixabayImage(query);
    if (pixabayImg && pixabayImg !== PLACEHOLDER_IMG) {
        return pixabayImg;
    }

    return PLACEHOLDER_IMG;
}

async function enrichCategoryResults(places, city) {
    await Promise.all(places.map(async (place) => {
        // PATCH: Kiril adı koru, Latin adı .name'e yaz
        if (typeof place.name_local === "undefined") {
            place.name_local = place.name;
        }
        place.name = getDisplayName(place);
        place.image = await getImageForPlace(
            place.name || place.properties?.name,
            place.category,
            city
        );
    }))
;    return places;
}

async function enrichPlanWithWiki(plan) {
    for (const step of plan) {
        // _noPlace step ise, image ve description ekleme!
        if (step._noPlace) continue;
        step.image = await getImageForPlace(step.name, step.category, step.city || selectedCity);
        step.description = "No detailed description.";
        // Orijinal ad (Kiril/yerel) kaybolmasın diye sakla:
        if (typeof step.name_local === "undefined") {
            step.name_local = step.name;
        }
        // Latin/İngilizce ad .name'e yaz!
        step.name = getDisplayName(step);
    }
    return plan;
}
// Proxy çağrısı
async function getPhoto(query, source = 'pexels') { // Varsayılan: Pexels
    const url = `/photoget-proxy?query=${encodeURIComponent(query)}&source=${source}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.imageUrl) return data.imageUrl;
    } catch (e) {
        console.warn("Fotoğraf proxy hatası:", e);
    }
    return PLACEHOLDER_IMG;
}

function initPlaceSearch(day) {
    const input = document.getElementById(`place-input-${day}`);
    const detailsDiv = document.getElementById(`place-details-${day}`);

    if (!input || !detailsDiv) return;

    // Önceki listener'ı kaldır (Memory leak önlemi)
    if (input._autocompleteHandler) {
        input.removeEventListener("input", input._autocompleteHandler);
    }

    input._autocompleteHandler = debounce(async function() {
        const query = this.value.trim().toLowerCase();
        if (query.length < 2) { // 2 karakterden azsa arama yapma
            detailsDiv.innerHTML = "";
            return;
        }
        
        detailsDiv.innerHTML = "<div class='loading'>Searching...</div>";
        
        try {
            // 1. Sonuçları çek (geoapifyAutocomplete artık 20 sonuç getiriyor)
            let suggestions = await geoapifyAutocomplete(query);
            detailsDiv.innerHTML = "";

            // === 2. AKILLI SIRALAMA (SMART SORT) BAŞLANGICI ===
            suggestions.sort((a, b) => {
                const pA = a.properties || {};
                const pB = b.properties || {};
                
                let scoreA = 0;
                let scoreB = 0;

                const nameA = (pA.name || "").toLowerCase();
                const nameB = (pB.name || "").toLowerCase();
                const typeA = (pA.result_type || pA.place_type || "").toLowerCase();
                const typeB = (pB.result_type || pB.place_type || "").toLowerCase();
                const catA = (pA.category || "").toLowerCase();
                const catB = (pB.category || "").toLowerCase();

                // Kriter 1: Tam İsim Eşleşmesi (En önemli)
                if (nameA === query) scoreA += 1000;
                if (nameB === query) scoreB += 1000;
                
                // Kriter 2: İsim ile Başlama
                if (nameA.startsWith(query)) scoreA += 500;
                if (nameB.startsWith(query)) scoreB += 500;

                // Kriter 3: Tür Önceliği (Bölge ve Turistik yerleri öne al)
                // Kapadokya 'tourism' veya 'region' döner, İtalya köyü 'village' döner.
                function getTypeScore(t, c) {
                    if (t === 'amenity' || t === 'tourism' || c.includes('tourism')) return 300;
                    if (t === 'region' || t === 'area' || t === 'state') return 200; // Kapadokya buraya girer
                    if (t === 'city') return 100;
                    if (t === 'town') return 50;
                    if (t === 'village' || t === 'hamlet') return -50; // Köyleri geriye at
                    return 0;
                }

                scoreA += getTypeScore(typeA, catA);
                scoreB += getTypeScore(typeB, catB);

                // Kriter 4: Popülarite İpucu (Adres Kısalığı)
                // Ünlü yerlerin adresi kısadır: "Cappadocia, Turkey"
                // Ünsüz yerler uzundur: "Cappadocia, Via Roma, L'Aquila, Italy"
                if (pA.formatted && pA.formatted.length < 40) scoreA += 50;
                if (pB.formatted && pB.formatted.length < 40) scoreB += 50;

                // Kriter 5: Türkiye Torpili (Opsiyonel ama etkili)
                if (pA.country_code === 'tr') scoreA += 100;
                if (pB.country_code === 'tr') scoreB += 100;

                return scoreB - scoreA; // Yüksek puandan düşüğe sırala
            });
            // === AKILLI SIRALAMA BİTİŞİ ===

            // 3. Sıralanmış listeden en iyi 5 tanesini seçip göster
            const uniqueResults = getUniqueResults(suggestions, 5);
            
            if (uniqueResults.length === 0) {
                detailsDiv.innerHTML = "<div class='no-results'>No matching places found</div>";
                return;
            }
            
            for (const result of uniqueResults) {
                await appendSuggestion(result, detailsDiv, day);
            }

        } catch (error) {
            console.error("Search error:", error);
            detailsDiv.innerHTML = "<div class='error'>Search failed. Try again later.</div>";
        }
    }, 500); // 500ms debounce

    input.addEventListener("input", input._autocompleteHandler);
}

async function appendSuggestion(suggestion, container, day) {
    const props = suggestion.properties || suggestion;
    const imgUrl = await getOptimizedImage(props);

    const div = document.createElement("div");
    div.className = "geoapify-suggestion";
    div.innerHTML = `
      <div class="suggestion-container">
        <img class="suggestion-thumb" src="${imgUrl}" 
             alt="${props.name || props.address_line1 || ''}" 
             loading="lazy" width="38" height="38"
             onerror="this.onerror=null;this.src='img/placeholder.png'">
        <div class="suggestion-text">
          <div class="suggestion-top-row">
            <span class="pin-icon">📍</span>
            <span class="suggestion-name">${props.name || props.address_line1 || ''}</span>
          </div>
          <div class="suggestion-details">
            <span class="suggestion-address">${props.address_line2 || ''}</span><br>
            <span class="suggestion-city">${formatLocationDetails(props)}</span>
          </div>
        </div>
      </div>
    `;
    div.onclick = () => handleSuggestionClick(suggestion, imgUrl, day);
    container.appendChild(div);
}


function handleSuggestionClick(suggestion, imgUrl, day) {
    const props = suggestion.properties || suggestion;
    
    // GÜVENLİ location oluştur
    let lat = Number(props.lat ?? props.latitude ?? (props.geometry && props.geometry.coordinates && props.geometry.coordinates[1]));
    let lon = Number(props.lon ?? props.longitude ?? (props.geometry && props.geometry.coordinates && props.geometry.coordinates[0]));
    let location = (Number.isFinite(lat) && Number.isFinite(lon)) ? { lat, lng: lon } : null;

    // 1. Sepete Ekle (addToCart zaten updateCart'ı çağırır)
    addToCart(
        props.name || props.address_line1 || '',
        imgUrl,
        parseInt(day),
        "Place",
        props.formatted || "",
        null, null, null, props.place_id,
        location,
        props.website || ""
    );

    // ============================================================
    // [KRİTİK DÜZELTME] "cart" verisini LocalStorage'a ELLE yaz
    // ============================================================
    // Sayfa yenilendiğinde verinin kalıcı olması için:
    localStorage.setItem('cart', JSON.stringify(window.cart));
    
    // My Trips veritabanına da hemen işle
    if (typeof saveCurrentTripToStorage === "function") {
        saveCurrentTripToStorage({ withThumbnail: false, delayMs: 0 });
    }
    // ============================================================

    // Feedback ve input temizleme
    const detailsDiv = document.getElementById(`place-details-${day}`);
    if (detailsDiv) {
        detailsDiv.innerHTML = `<div class="success">✓ Added to Day ${day}</div>`;
        const input = document.getElementById(`place-input-${day}`);
        if (input) input.value = "";
        setTimeout(() => detailsDiv.innerHTML = "", 1500);
    }
}


function formatLocationDetails(properties) {
  const parts = [];
  if (properties.state) parts.push(properties.state);
  if (properties.country) parts.push(properties.country);
  return parts.join(' / ');
}

function getUniqueResults(suggestions, max) {
  const unique = [];
  const seen = new Set();
  for (const suggestion of suggestions) {
    const key = suggestion.properties.place_id ||
                `${suggestion.properties.lat},${suggestion.properties.lon}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(suggestion);
    }
    if (unique.length >= max) break;
  }
  return unique;
}

function restoreSidebar() {
    // Sadece UI'ı güncelle, döngüye girmesin
    const cartDiv = document.getElementById("cart-items");
    if (cartDiv && cartDiv.querySelector('.category-item')) {
        // Kategori listesi açıksa updateCart çağır
        updateCart();
    }
    // Aksi halde hiçbir şey yapma
}

// Gün isimlerini saklamak için ayrı bir obje
let dayNames = {};

// Gün ismini düzenleme fonksiyonu (güncellendi)
function editDayName(day) {
    const dayHeader = document.querySelector(`#day-container-${day} .day-header`);
    const titleSpan = dayHeader.querySelector('.day-title');
    
    if (!titleSpan) return;

    const currentName = dayNames[day] || `Day ${day}`;
    const inputHTML = `
        <input type="text" class="day-name-input" value="${currentName}" 
               data-day="${day}">
    `;
    titleSpan.outerHTML = inputHTML;
    
    const inputField = dayHeader.querySelector('.day-name-input');
    inputField.focus();
    inputField.select();

    // Enter tuşu ve blur (odak kaybı) için event listener'lar ekle
    inputField.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            saveDayName(day, this.value);
        }
    });

    inputField.addEventListener('blur', function() {
        saveDayName(day, this.value);
    });
}

// Gün ismini kaydetme fonksiyonu (güncellendi)
function saveDayName(day, newName) {
    // Eğer `customDayNames` nesnesi yoksa, oluştur.
    if (typeof window.customDayNames === 'undefined') {
        window.customDayNames = {};
    }

    // Eğer kullanıcı boş bir isim girerse, bu gün için özel ismi sil.
    if (!newName.trim()) {
        delete window.customDayNames[day];
    } else {
        // Girilen yeni adı, ilgili gün numarasıyla sakla.
        window.customDayNames[day] = newName.trim();
    }

    // Arayüzü yeni isimle güncellemek için sepeti yeniden çiz.
    updateCart();
}

function getDayDisplayName(day) {
  if (window.customDayNames && window.customDayNames[day]) {
    return window.customDayNames[day];
  }
  return `Day ${day}`;
}

            function syncCartOrderWithDOM(day) {
            const items = document.querySelectorAll(`.day-container[data-day="${day}"] .travel-item`);
            if (!items.length) return;
            const newOrder = [];
            items.forEach(item => {
                const idx = item.getAttribute('data-index');
                if (window.cart[idx]) {
                    newOrder.push(window.cart[idx]);
                }
            });
            window.cart = [
                ...window.cart.filter(item => item.day != day),
                ...newOrder
            ];

                if (window.expandedMaps) {
                  clearRouteSegmentHighlight(day);
                  fitExpandedMapToRoute(day);
                }
            }

const INITIAL_EMPTY_MAP_CENTER = [0, 0];
const INITIAL_EMPTY_MAP_ZOOM   = 2;


/* ---------- Helpers: Ensure Map Container ---------- */
function ensureDayMapContainer(day) {
  const dayContainer = document.getElementById(`day-container-${day}`);
  if (!dayContainer) return null;

  // Harita div'i
  let mapDiv = document.getElementById(`route-map-day${day}`);
  if (!mapDiv) {
    mapDiv = document.createElement('div');
    mapDiv.id = `route-map-day${day}`;
    mapDiv.className = 'route-map';
    mapDiv.style.minHeight = '285px';

    // travel mode set varsa onun üstüne koy
    const travelModeSet = document.getElementById(`tt-travel-mode-set-day${day}`);
    if (travelModeSet) {
      dayContainer.insertBefore(mapDiv, travelModeSet);
    } else {
      dayContainer.appendChild(mapDiv);
    }
  }

  // Rota info div
  let infoDiv = document.getElementById(`route-info-day${day}`);
  if (!infoDiv) {
    infoDiv = document.createElement('div');
    infoDiv.id = `route-info-day${day}`;
    infoDiv.className = 'route-info';
    dayContainer.appendChild(infoDiv);
  }

  return mapDiv;
}

function initEmptyDayMap(day) {
  const containerId = `route-map-day${day}`;
  let el = document.getElementById(containerId);

  if (!el) {
    el = ensureDayMapContainer(day);
    if (!el) return;
  }

  // Leaflet kütüphanesi henüz yüklenmediyse bekle
  if (typeof L === 'undefined') {
    setTimeout(() => initEmptyDayMap(day), 60);
    return;
  }

  // Zaten harita varsa ve container içindeyse çakışmayı önlemek için TEMİZLE
  if (window.leafletMaps && window.leafletMaps[containerId]) {
    try {
      window.leafletMaps[containerId].remove();
    } catch (e) {
      console.warn("Eski harita temizlenemedi:", e);
    }
    delete window.leafletMaps[containerId];
  }

  if (!el.style.height) el.style.height = '285px';
  el.style.backgroundColor = "#eef0f5"; 

  // --- KONUM BELİRLEME MANTIĞI ---
  const points = typeof getDayPoints === 'function' ? getDayPoints(day) : [];
  const validPts = points.filter(p => isFinite(p.lat) && isFinite(p.lng));
  
  let startCenter = [39.0, 35.0]; // Varsayılan Türkiye
  let startZoom = 5;
  let startBounds = null;
  let hasFocus = false;

  if (validPts.length > 0) {
      if (validPts.length === 1) {
          startCenter = [validPts[0].lat, validPts[0].lng];
          startZoom = 14;
      } else {
          startBounds = L.latLngBounds(validPts.map(p => [p.lat, p.lng]));
          startCenter = startBounds.getCenter();
          startZoom = 10;
      }
      hasFocus = true;
  } 
  else if (day > 1 && typeof getDayPoints === 'function') {
      const prevPoints = getDayPoints(day - 1);
      const validPrevPts = prevPoints.filter(p => isFinite(p.lat) && isFinite(p.lng));
      if (validPrevPts.length > 0) {
          const lastPt = validPrevPts[validPrevPts.length - 1];
          startCenter = [lastPt.lat, lastPt.lng];
          startZoom = 12; 
          hasFocus = true;
      }
  }

  // --- HARİTA OLUŞTURMA (TAM KİLİTLİ) ---
  const map = L.map(containerId, {
    center: startCenter,
    zoom: startZoom,
    zoomControl: false,      // Butonları kaldır
    dragging: false,         // Kaydırmayı kapat
    touchZoom: false,        // Parmak zoom kapat
    scrollWheelZoom: false,  // Tekerlek zoom kapat
    doubleClickZoom: false,  // Çift tık kapat
    boxZoom: false,          // Kutu seçimini kapat
    keyboard: false,         // Klavye kontrolünü kapat
    tap: false,              // Mobil gecikmeyi önle
    attributionControl: false, 
    fadeAnimation: true,
    zoomAnimation: true,
    markerZoomAnimation: true,
    inertia: false
  });

  if (startBounds && startBounds.isValid()) {
      map.fitBounds(startBounds, { padding: [20, 20], animate: false });
  }
  
  if (!hasFocus && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(pos) {
      const currentPts = typeof getDayPoints === 'function' ? getDayPoints(day) : [];
      if (currentPts.length === 0) {
          map.whenReady(function() {
            try {
               map.setView([pos.coords.latitude, pos.coords.longitude], 13, { animate: false });
            } catch(e) {}
          });
      }
    }, function(err) {}, { timeout: 3000 });
  }

  // --- [FIX] ZEMİN HARİTASINI DA KİLİTLE (interative: false) ---
  const openFreeMapStyle = 'https://tiles.openfreemap.org/styles/bright';
  if (typeof L.maplibreGL === 'function') {
      L.maplibreGL({
          style: openFreeMapStyle,
          attribution: '', // Kilitli haritada temizlik için boş bıraktık
          interactive: false // ÖNEMLİ: Alt zemin haritasının kaymasını bu engeller
      }).addTo(map);
  } else {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);
  }
  
  if (!map._initialView) {
    map._initialView = {
      center: map.getCenter(),
      zoom: map.getZoom()
    };
  }
  
  window.leafletMaps = window.leafletMaps || {};
  window.leafletMaps[containerId] = map;
}


(function initDirectDayExpandedMapPatch(){
  if (window.__tt_directExpandedPatchApplied) return;
  window.__tt_directExpandedPatchApplied = true;

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.start-map-btn');
    if (!btn) return;
    e.preventDefault();
    const day = Number(btn.dataset.day || '1');
    if (!Number.isFinite(day) || day < 1) return;
    startDayMapPlanningAndExpand(day);
  });

  function startDayMapPlanningAndExpand(day) {
    console.log('[direct-expand] start map planning day=', day);

    // DİKKAT: Bu gün için "Start with map" butonunu gizle bayrağı
    window.__hideStartMapButtonByDay = window.__hideStartMapButtonByDay || {};
    window.__hideStartMapButtonByDay[day] = true;

    // Daha önce açık expanded map varsa kapat
    if (window.expandedMaps) {
      Object.keys(window.expandedMaps).forEach(cid => {
        const ex = window.expandedMaps[cid];
        if (ex && typeof restoreMap === 'function') {
          try { restoreMap(cid, ex.day); } catch(_){}
        }
      });
    }

    window.mapPlanningActive = true;
    window.mapPlanningDay = day;
    window.currentDay = day;

    window.__suppressMiniUntilFirstPoint = window.__suppressMiniUntilFirstPoint || {};
    window.__suppressMiniUntilFirstPoint[day] = true;

    if (!Array.isArray(window.cart)) window.cart = [];
    const hasDay = window.cart.some(it => it.day === day);
    if (!hasDay) {
      window.cart.push({ day });
    }

    if (typeof updateCart === 'function') {
      updateCart(); // yeniden çizimde buton gizlenecek
    }

    ensureDayMapContainer(day);
    initEmptyDayMap(day);

    const containerId = `route-map-day${day}`;
    setTimeout(() => {
      if (typeof expandMap === 'function') {
        expandMap(containerId, day);
      } else {
        console.warn('[direct-expand] expandMap bulunamadı.');
      }
    }, 40);

    setTimeout(() => {
      try {
        attachMapClickAddMode(day);
        console.log('[direct-expand] click-add mode attached for day', day);
      } catch (err) {
        console.warn('[direct-expand] attachMapClickAddMode error', err);
      }
    }, 140);
  }
})();

/* ================== END PATCH ================== */
// Gün 1 için kullanılan global başlatıcıda da bayrağı set edin
function startMapPlanning() {
  window.cart = [];
  window.__startedWithMapFlag = true;
  window.activeTripKey = null; // <-- En kritik satır: yeni map planlamada key sıfırlanır.

  window.__hideStartMapButtonByDay = window.__hideStartMapButtonByDay || {};
  window.__hideStartMapButtonByDay[1] = true;
  window.__hideAddCatBtnByDay[1] = true;

  window.__forceEmptyMapForDay = window.__forceEmptyMapForDay || {};
  window.__forceEmptyMapForDay[1] = true;
  window.__suppressMiniUntilFirstPoint = window.__suppressMiniUntilFirstPoint || {};
  window.__suppressMiniUntilFirstPoint[1] = true;

  window.currentDay = 1;
  window.mapPlanningDay = 1;
  window.mapPlanningActive = true;

  updateCart();
  ensureDayMapContainer(1);
  initEmptyDayMap(1);

  const mini = document.getElementById('route-map-day1');
  if (mini) mini.style.display = 'none';

  if (typeof renderTravelModeControlsForAllDays === 'function') {
    renderTravelModeControlsForAllDays();
  }

  // [KONUM PATCH] - Kullanıcı konumuna zoomla
  setTimeout(() => {
    const mapObj = window.leafletMaps && window.leafletMaps['route-map-day1'];
    if (navigator.geolocation && mapObj) {
      navigator.geolocation.getCurrentPosition(function(pos) {
        mapObj.setView([pos.coords.latitude, pos.coords.longitude], 13);
      }, function(err) {
        // Konum alınamazsa varsayılan (Avrupa) kalır
      }, {timeout:3000});
    }
  }, 300); // Harita oluştuktan 300ms sonra çalışsın

  setTimeout(() => {
    if (!window.leafletMaps['route-map-day1']) initEmptyDayMap(1);
    attachMapClickAddMode(1);
  }, 60);

  attemptExpandDay(1);
}
function removeDayMap(day) {
  // Eski yanlış çağrılar boşa gitmesin
  return removeDayMapCompletely(day);
}
function removeDayMapCompletely(day) {
  const containerId = `route-map-day${day}`;

  // Expanded map açıksa kapat
  if (window.expandedMaps && window.expandedMaps[containerId]) {
    if (typeof restoreMap === 'function') {
      try { restoreMap(containerId, day); } catch (_) {}
    }
    delete window.expandedMaps[containerId];
  }

  // Leaflet instance
  if (window.leafletMaps && window.leafletMaps[containerId]) {
    try { window.leafletMaps[containerId].remove(); } catch (_) {}
    delete window.leafletMaps[containerId];
  }

  // Küçük harita ve ilgili info / controls / bar
  const mapEl = document.getElementById(containerId);
  if (mapEl) mapEl.remove();

  const infoEl = document.getElementById(`route-info-day${day}`);
  if (infoEl) infoEl.remove();

  const tmSet = document.getElementById(`tt-travel-mode-set-day${day}`);
  if (tmSet) tmSet.remove();

  const controlsWrapper = document.getElementById(`map-bottom-controls-wrapper-day${day}`);
  if (controlsWrapper) controlsWrapper.remove();

  const controlsBar = document.getElementById(`route-controls-bar-day${day}`);
  if (controlsBar) controlsBar.remove();

  // Küçük scale bar varsa (gün için)
  const scaleBar = document.getElementById(`route-scale-bar-day${day}`);
  if (scaleBar) scaleBar.remove();
}
function attemptExpandDay(day, tries = 0) {
  const cid = `route-map-day${day}`;
  if (window.expandedMaps && window.expandedMaps[cid]) return;
ensureDayMapContainer(day);
  let btn = document.querySelector(`#tt-travel-mode-set-day${day} .expand-map-btn`);
  if (!btn && typeof renderTravelModeControlsForAllDays === 'function') {
    renderTravelModeControlsForAllDays();
    btn = document.querySelector(`#tt-travel-mode-set-day${day} .expand-map-btn`);
  }

  if (btn) {
    btn.click();
    return;
  } 
    
  if (tries < 6) {
    setTimeout(() => attemptExpandDay(day, tries + 1), 120);
  } else if (typeof expandMap === 'function') {
    expandMap(cid, day); // Fallback
  }
}
// Belirli bir gün için başlatıcıda da bayrağı set edin
function startMapPlanningForDay(day) {
  day = Number(day) || 1;

  window.__hideStartMapButtonByDay = window.__hideStartMapButtonByDay || {};
  window.__hideStartMapButtonByDay[day] = true;

  if (!Array.isArray(window.cart)) window.cart = [];

  window.__suppressMiniUntilFirstPoint = window.__suppressMiniUntilFirstPoint || {};
  window.__suppressMiniUntilFirstPoint[day] = true;

  if (!window.cart.some(it => it.day === day)) {
    window.cart.push({
      day,
      name: 'Start',
      category: 'Note',
      image: 'img/placeholder.png',
      _starter: true
    });
  } else {
    const hasReal = window.cart.some(it =>
      it.day === day &&
      it.location &&
      !it._starter &&
      !it._placeholder
    );
    if (!hasReal && !window.cart.some(it => it.day === day && it._starter)) {
      window.cart.push({
        day,
        name: 'Start',
        category: 'Note',
        image: 'img/placeholder.png',
        _starter: true
      });
    }
  }

  window.currentDay = day;
  window.mapPlanningDay = day;
  window.mapPlanningActive = true;

  updateCart();
  ensureDayMapContainer(day);
  initEmptyDayMap(day);
  const mini = document.getElementById(`route-map-day${day}`);
  if (mini) mini.classList.add('mini-suppressed');

  if (typeof renderTravelModeControlsForAllDays === 'function') {
    renderTravelModeControlsForAllDays();
  }

  setTimeout(() => {
    const cid = `route-map-day${day}`;
    if (!window.leafletMaps[cid]) initEmptyDayMap(day);
    attachMapClickAddMode(day);
  }, 60);

  attemptExpandDay(day);
}

function attachMapClickAddMode(day) {
  const containerId = `route-map-day${day}`;
  const map = window.leafletMaps[containerId];
  if (!map) return;

  map.__tt_clickAddBound = map.__tt_clickAddBound || {};
  if (map.__tt_clickAddBound[day]) return;
  map.__tt_clickAddBound[day] = true;

  let __singleClickTimer = null;
  const SINGLE_CLICK_DELAY = 250; 

  map.on('click', function(e) {
    if (__singleClickTimer) clearTimeout(__singleClickTimer);
    
    __singleClickTimer = setTimeout(async () => {
      if (!window.mapPlanningActive || window.mapPlanningDay !== day) return;

      const { lat, lng } = e.latlng;

      // Check for duplicate
      const dup = window.cart.some(it =>
        it.day === day && it.location &&
        Math.abs(it.location.lat - lat) < 1e-6 &&
        Math.abs(it.location.lng - lng) < 1e-6
      );
      if (dup) return;

      // Get address info
      let placeInfo = { name: "New Point", address: "", opening_hours: "" };
      try {
        const rInfo = await getPlaceInfoFromLatLng(lat, lng);
        if (rInfo && rInfo.name) placeInfo = rInfo;
      } catch(_) {}

      // Get image
      let imageUrl = 'img/placeholder.png';
      try {
        imageUrl = await getImageForPlace(placeInfo.name || 'New Point', 'Place', window.selectedCity || '');
      } catch(_) {}

      // Remove starter item if exists
      window.cart = window.cart.filter(it => !(it.day === day && it._starter));

      // Add new item to cart
      window.cart.push({
        name: placeInfo.name || "Point",
        image: imageUrl,
        day: day,
        category: "Place",
        address: placeInfo.address || "",
        opening_hours: placeInfo.opening_hours || "",
        location: { lat: lat, lng: lng }
      });

      // Unhide map/controls
      if (window.__suppressMiniUntilFirstPoint) window.__suppressMiniUntilFirstPoint[day] = false;
      const smallMapDiv = document.getElementById(containerId);
      if (smallMapDiv) {
          smallMapDiv.style.display = 'block';
          smallMapDiv.classList.remove('mini-suppressed');
      }
      const controlsWrapper = document.getElementById(`map-bottom-controls-wrapper-day${day}`);
      if (controlsWrapper) controlsWrapper.style.display = 'block';

      // Update UI
      if (typeof updateCart === "function") updateCart();

      // Add marker to map
      L.circleMarker([lat, lng], {
        radius: 7, color: '#8a4af3', fillColor: '#8a4af3', fillOpacity: 0.9, weight: 2
      }).addTo(map).bindPopup(`<b>${placeInfo.name || 'Point'}</b>`);

      // Render route
      if (typeof renderRouteForDay === 'function') {
        setTimeout(() => renderRouteForDay(day), 100);
      }

    }, SINGLE_CLICK_DELAY);
  });

  map.on('dblclick', function() { if (__singleClickTimer) clearTimeout(__singleClickTimer); });
  map.on('zoomstart', function() { if (__singleClickTimer) clearTimeout(__singleClickTimer); });
}



function createLeafletMapForItem(mapId, lat, lon, name, number, day) {
    // 1. ÖNCE CSS FIX'İ ENJEKTE ET (Sayfada yoksa ekler)
    if (!document.getElementById('tt-marker-fix-style')) {
        const style = document.createElement('style');
        style.id = 'tt-marker-fix-style';
        style.textContent = `
            /* Wrapper'ı (Kapsayıcı) Flex Yapıp İçeriği Ortalıyoruz */
            .leaflet-marker-icon.tt-static-marker-icon {
                background: transparent !important;
                border: none !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
            }

            /* Kırmızı Topun Tüm Dış Etkenlerden Arındırılması */
            .leaflet-marker-icon.tt-static-marker-icon .custom-marker-outer {
                width: 32px !important;
                height: 32px !important;
                /* Styles.css'den gelen absolute pozisyonu iptal et: */
                position: static !important; 
                transform: none !important;
                margin: 0 !important;
                left: auto !important;
                top: auto !important;
                
                /* Görünüm Ayarları */
                box-sizing: border-box !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                border-radius: 50%;
                font-size: 14px !important;
                line-height: 1 !important;
                background: #d32f2f; /* Renk garantisi */
                color: #fff;
                border: 2px solid #fff;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            }
        `;
        document.head.appendChild(style);
    }

    // 2. TEMİZLİK
    window._leafletMaps = window._leafletMaps || {};
    if (window._leafletMaps[mapId]) {
        try { 
            if (window._leafletMaps[mapId].getContainer()) {
                window._leafletMaps[mapId].remove(); 
            }
        } catch(e) {}
        delete window._leafletMaps[mapId];
    }

    const el = document.getElementById(mapId);
    if (!el) return;

    // 3. KAP AYARLARI
    el.innerHTML = '';
    el.style.width = '100%';
    el.style.height = '250px';
    el.style.backgroundColor = '#eef0f5';
    el.style.borderRadius = '8px';
    el.style.overflow = 'hidden';

    if (typeof L === 'undefined') {
        el.innerHTML = '<div style="padding:20px;text-align:center;color:#999;">Loading map...</div>';
        setTimeout(() => createLeafletMapForItem(mapId, lat, lon, name, number, day), 100);
        return;
    }

    // 4. HARİTA OLUŞTURMA
    var map = L.map(mapId, {
        center: [lat, lon],
        zoom: 16,
        scrollWheelZoom: false,
        dragging: false,
        touchZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        zoomControl: false,
        attributionControl: false,
        fadeAnimation: false,
        zoomAnimation: false,
        markerZoomAnimation: false,
        inertia: false
    });

    const openFreeMapStyle = 'https://tiles.openfreemap.org/styles/bright';
    if (typeof L.maplibreGL === 'function') {
        L.maplibreGL({
            style: openFreeMapStyle,
            attribution: '&copy; <a href="https://openfreemap.org" target="_blank">OpenFreeMap</a>',
            interactive: false
        }).addTo(map);
    } else {
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 16,
            attribution: '© OpenStreetMap contributors',
            interactive: false
        }).addTo(map);
    }

    // 5. MARKER OLUŞTURMA (Artık CSS Class'a güveniyoruz)
    // HTML içinde stil yazmıyoruz, yukarıdaki CSS halledecek.
    const cleanHtml = `<div class="custom-marker-outer red">${number}</div>`;
    
    const icon = L.divIcon({ 
        html: cleanHtml, 
        className: "tt-static-marker-icon", // Yukarıda tanımladığımız özel sınıf
        iconSize: [32, 32],
        iconAnchor: [16, 16] // Tam merkez
    });
    
    const marker = L.marker([lat, lon], { 
        icon: icon,
        interactive: true 
    }).addTo(map);
    
    // Popup Ayarı (Tam ortada ve markerın hemen üstünde)
    marker.bindPopup(`<b>${name || 'Point'}</b>`, {
        closeButton: false,
        offset: [0, -18] 
    }).openPopup();

    // 6. FİNAL GÜNCELLEME
    setTimeout(function() { 
        if (map && map.getContainer() && document.getElementById(mapId)) {
            try {
                map.invalidateSize();
                map.setView([lat, lon], 16, { animate: false });
                marker.openPopup();
                if (marker._popup) {
                    marker._popup._updateLayout();
                    marker._popup._adjustPan();
                }
            } catch (err) {}
        }
    }, 150);
    
    marker.on('popupclose', function() {
        setTimeout(() => {
            if (map && map.getContainer()) marker.openPopup();
        }, 100);
    });
    
    window._leafletMaps[mapId] = map;
    
    const mapContainer = map.getContainer();
    mapContainer.style.pointerEvents = 'none';
    mapContainer.style.cursor = 'default';
    
    if (marker._icon) {
        marker._icon.style.pointerEvents = 'auto';
        marker._icon.style.cursor = 'pointer';
    }
}

function toggleContent(arrowIcon) {
    const cartItem = arrowIcon.closest('.cart-item');
    if (!cartItem) return;
    const contentDiv = cartItem.querySelector('.content');
    if (!contentDiv) return;
    
    // Aç/Kapa işlemi
    contentDiv.classList.toggle('open');
    
    // Ok ikonunu bul (Tıklanan elementin kendisi mi yoksa içindeki mi kontrol et)
    const arrowImg = arrowIcon.tagName === 'IMG' ? arrowIcon : arrowIcon.querySelector('.arrow-icon');

    if (contentDiv.classList.contains('open')) {
        contentDiv.style.display = 'block';
        
        // JS İLE CSS MÜDAHALESİ
        if (arrowImg) {
            arrowImg.style.transition = "transform 0.3s ease";
            arrowImg.style.transform = "rotate(90deg)";
        }
        
        // --- LEAFLET HARİTA YÖNETİMİ ---
        const item = cartItem.closest('.travel-item');
        if (!item) return;
        
        const mapDiv = item.querySelector('.leaflet-map');
        if (mapDiv && contentDiv.style.display !== 'none') {
            const mapId = mapDiv.id;
            const latStr = item.getAttribute('data-lat');
            const lonStr = item.getAttribute('data-lon');
            
            if (!latStr || !lonStr || isNaN(parseFloat(latStr)) || isNaN(parseFloat(lonStr))) {
                 mapDiv.innerHTML = '<div class="map-error" style="padding:20px;text-align:center;color:#999;">Location data not available</div>';
                 return;
            }

            const lat = parseFloat(latStr);
            const lon = parseFloat(lonStr);
            const name = item.querySelector('.toggle-title') ? item.querySelector('.toggle-title').textContent : "Place";
            
            // DEĞİŞİKLİK: Önce günlük indexi (data-daily-index) kontrol et, yoksa eskiye dön
            const number = item.getAttribute('data-daily-index') || (item.dataset.index ? (parseInt(item.dataset.index, 10) + 1) : 1);

            createLeafletMapForItem(mapId, lat, lon, name, number);
        }
    } else {
        contentDiv.style.display = 'none';
        
        // JS İLE CSS MÜDAHALESİ (Geri döndür)
        if (arrowImg) {
            arrowImg.style.transform = "rotate(0deg)";
        }
    }
}
(function forceLeafletCssFix() {
    const styleId = 'tt-leaflet-fix-v5'; // Versiyonu güncelledik
    if (document.getElementById(styleId)) return;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
         /* 1. Zoom/Pan animasyonlarını sadece route-map VE expanded-map dışındaki haritalarda kapat */
        .leaflet-container:not(.expanded-map):not(.route-map) .leaflet-pane, 
        .leaflet-container:not(.expanded-map):not(.route-map) .leaflet-tile, 
        .leaflet-container:not(.expanded-map):not(.route-map) .leaflet-marker-icon, 
        .leaflet-container:not(.expanded-map):not(.route-map) .leaflet-marker-shadow, 
        .leaflet-container:not(.expanded-map):not(.route-map) .leaflet-tile-container, 
        .leaflet-container:not(.expanded-map):not(.route-map) .leaflet-zoom-animated {
            transition: none !important;
            transform-origin: 0 0 !important; /* KRİTİK DÜZELTME: Sol üst referans alınmalı */
        }
        
        /* 2. Resimlerin animasyonunu sadece route-map VE expanded-map dışındaki haritalarda engelle */
        .leaflet-container:not(.expanded-map):not(.route-map) img.leaflet-tile {
            max-width: none !important;
            width: 256px !important;
            height: 256px !important;
            transition: none !important; 
        }
        /* 3. İmleç Ayarları */
        .expanded-map.leaflet-container,
        .expanded-map .leaflet-grab,
        .expanded-map .leaflet-interactive {
            cursor: grab !important;
        }
        .expanded-map.leaflet-container:active,
        .expanded-map .leaflet-grab:active {
            cursor: grabbing !important;
        }
        
        /* Markerlar için pointer */
        .expanded-map .leaflet-marker-icon,
        .expanded-map .leaflet-popup-close-button,
        .expanded-map a {
            cursor: pointer !important;
        }

        /* 4. Tıklama/Etkileşim Sorunları */
        .leaflet-pane { 
            pointer-events: auto; 
        }
        .leaflet-tile-pane {
            z-index: 200; 
        }
        
        /* 5. Custom Marker Animasyonu */
        .custom-marker-outer {
    transition: transform 0.1s ease !important;
    will-change: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
}

        /* 6. Mobil Performans İyileştirmesi */
        .leaflet-container {
            touch-action: none; /* Tarayıcının varsayılan zoom'unu engelle */
        }
    `;
    document.head.appendChild(style);
})();



async function getPlacesForCategory(city, category, limit = 5, radius = 3000, code = null) {
  const geoCategory = code || geoapifyCategoryMap[category] || placeCategories[category];
  if (!geoCategory) {
    return [];
  }
  const coords = await getCityCoordinates(city);
  if (!coords || !coords.lat || !coords.lon || isNaN(coords.lat) || isNaN(coords.lon)) {
    return [];
  }
  const url = `/api/geoapify/places?categories=${geoCategory}&lon=${coords.lon}&lat=${coords.lat}&radius=${radius}&limit=${limit}`;
  let resp, data;
  try {
    resp = await fetch(url);
    data = await resp.json();
  } catch (e) {
    return [];
  }
 if (data.features && data.features.length > 0) {
    const filtered = data.features.filter(f =>
      !!f.properties.name && f.properties.name.trim().length > 2
    );
    const result = filtered.map(f => {
      const props = f.properties || {};
      let lat = Number(
        props.lat ??
        props.latitude ??
        (f.geometry && f.geometry.coordinates && f.geometry.coordinates[1])
      );
      let lon = Number(
        props.lon ??
        props.longitude ??
        (f.geometry && f.geometry.coordinates && f.geometry.coordinates[0])
      );
      if (!Number.isFinite(lat)) lat = null;
      if (!Number.isFinite(lon)) lon = null;
      return {
        name: props.name,
        name_en: props.name_en,
        name_latin: props.name_latin,
        address: props.formatted || "",
        lat,
        lon,
        location: (lat !== null && lon !== null) ? { lat, lng: lon } : null,
        website: props.website || '',
        opening_hours: props.opening_hours || '',
        categories: props.categories || [],
        city: city,
        properties: props
      };
    });

       console.log('getPlacesForCategory:', {
      city,
      category,
      radius,
      limit,
      places: result.map(p => ({
        name: p.name,
        lat: p.lat,
        lon: p.lon,
        address: p.address,
        categories: p.categories
      }))
    });

    // ---- BURAYA EKLE ----
    // Sıralamayı şehir merkezine en yakın olanı öne alacak şekilde yap!
    const sorted = result.sort((a, b) => {
      const da = haversine(a.lat, a.lon, coords.lat, coords.lon);
      const db = haversine(b.lat, b.lon, coords.lat, coords.lon);
      return da - db;
    });
    return sorted;

  }
  return [];
}
async function updateCart() {

    // [PERFORMANS] Eski item haritalarını temizle
    if (window._leafletMaps) {
        Object.keys(window._leafletMaps).forEach(k => {
            if (window._leafletMaps[k]) {
                try { window._leafletMaps[k].remove(); } catch(e){}
                delete window._leafletMaps[k];
            }
        });
    }

    // AI Bölümünü Göster
   const aiInfoSection = document.querySelector('.ai-info-section');
if (aiInfoSection) {
    aiInfoSection.style.display = ''; 
    // PAYLAŞILAN LİNKTEKİ AI VERİSİNİ YAZDIR:
    const aiTextContent = document.getElementById('ai-summary-text'); // Senin AI metin alanın hangisiyse
    const sharedAI = localStorage.getItem('ai_information');
    if (aiTextContent && sharedAI) {
        aiTextContent.innerText = sharedAI;
    }
}
    
    window.pairwiseRouteSummaries = window.pairwiseRouteSummaries || {};

    const days = [...new Set(window.cart.map(i => i.day))].sort((a, b) => a - b);

    // ÖNCE route'ları HAZIRLA!
    for (const d of days) {
        await renderRouteForDay(d);
        // console.log('pairwise summary', d, window.pairwiseRouteSummaries[`route-map-day${d}`]);
    }
    console.log("updateCart başlatıldı");
    document.querySelectorAll('.route-scale-bar[id^="route-scale-bar-day"]').forEach(el => el.remove());


    if (window.expandedMaps) {
        days.forEach(day => {
            clearRouteSegmentHighlight(day);
        });
        window._lastSegmentDay = undefined;
        window._lastSegmentStartKm = undefined;
        window._lastSegmentEndKm = undefined;
    }

    days.forEach(day => {
        const hasRealItem = window.cart.some(i =>
            Number(i.day) === Number(day) &&
            !i._starter &&
            !i._placeholder &&
            (i.name || i.category === "Note")
        );
        if (hasRealItem && window.__hideAddCatBtnByDay && window.__hideAddCatBtnByDay[day]) {
            window.__hideAddCatBtnByDay[day] = false;
        }
    });

    const oldStartDate = window.cart.startDate;
    const oldEndDates = window.cart.endDates;
    window.cart = window.cart.filter(it =>
        it && typeof it === "object" &&
        (
            (typeof it.day !== "undefined" && Object.keys(it).length === 1) ||
            (it.name || it.location || it.category)
        )
    );
    if (oldStartDate) window.cart.startDate = oldStartDate;
    if (oldEndDates) window.cart.endDates = oldEndDates;

    const cartDiv = document.getElementById("cart-items");

    const menuCount = document.getElementById("menu-count");
    if (!cartDiv) { console.warn("[updateCart] cartDiv yok!"); return; }

    if (!window.cart || window.cart.length === 0) {
        cartDiv.innerHTML = `
    <div class="day-container" id="day-container-1" data-day="1">
      <h4 class="day-header">
        <div class="title-container"><span class="day-title">Day 1</span></div>
      </h4>
      <div class="confirmation-container" id="confirmation-container-1" style="display:none"></div>
      <ul class="day-list" data-day="1">
        <div class="empty-day-block">
          <p class="empty-day-message">
            No item has been added for this day yet.<br>
            Select a point on the map to start the trip!
          </p>
        <div>
<button id="start-map-btn" type="button">Start with map</button>
</div>
          <div style="text-align:center; padding:10px 0 4px; font-weight:500;">or</div>
          <div class="empty-day-actions" style="display:block;text-align:center;">
            <button type="button" class="import-btn gps-import" data-import-type="multi" data-global="1" title="Supports GPX, TCX, FIT, KML">
              Import GPS File
            </button>
          </div>
        </div>
      </ul>
    </div>
    <hr class="add-new-day-separator">
  `;


        if (menuCount) {
            menuCount.textContent = 0;
            menuCount.style.display = "none";
        }
        // buton eventleri
        const addNewDayButton = document.getElementById("add-new-day-button");
        if (addNewDayButton) addNewDayButton.onclick = function () { addNewDay(this); };
        const gpsBtn = document.querySelector(".gps-import");
        if (gpsBtn) gpsBtn.onclick = function () { /* GPS import fonksiyonun */ };

        return;
    }

    const totalDays = Math.max(1, ...window.cart.map(i => i.day || 1));
    cartDiv.innerHTML = ""; // Her zaman temizle ve yeniden oluştur

    for (let day = 1; day <= totalDays; day++) {
        const dayItemsArr = window.cart.filter(i =>
            Number(i.day) === Number(day) &&
            !i._starter &&
            !i._placeholder &&
            (i.name || i.category === "Note")
        );
        const isEmptyDay = dayItemsArr.length === 0;

        const existingContainer = document.getElementById(`day-container-${day}`);
        if (existingContainer) {
            existingContainer.remove();
        }

        const dayContainer = document.createElement("div");
        dayContainer.className = "day-container";
        dayContainer.id = `day-container-${day}`;
        dayContainer.dataset.day = day;

        const dayHeader = document.createElement("h4");
        dayHeader.className = "day-header";
        const titleContainer = document.createElement("div");
        titleContainer.className = "title-container";
        const titleSpan = document.createElement("span");
        titleSpan.className = "day-title";
        if (!window.customDayNames) window.customDayNames = {};
        titleSpan.textContent = window.customDayNames[day] || `Day ${day}`;
        titleContainer.appendChild(titleSpan);
        dayHeader.appendChild(titleContainer);
        
        if (typeof createDayActionMenu === 'function') {
            dayHeader.appendChild(createDayActionMenu(day));
        }
        dayContainer.appendChild(dayHeader);

        const confirmationContainer = document.createElement("div");
        confirmationContainer.className = "confirmation-container";
        confirmationContainer.id = `confirmation-container-${day}`;
        confirmationContainer.style.display = "none";
        dayContainer.appendChild(confirmationContainer);

        const dayList = document.createElement("ul");
        dayList.className = "day-list";
        dayList.dataset.day = day;


                    // Global değişken kontrolü (dosya başında tanımlı olmalı: window.__dismissedAutoInfo = window.__dismissedAutoInfo || [];)
                    // Check for auto-copied item info
                    const dayItems = window.cart.filter(item => item.day === day);

                    if (dayItems.length >= 2 && !window.__dismissedAutoInfo.includes(day)) {
                        window.__dismissedAutoInfo.push(day);
                    }

                    if (dayItems.length === 1 && !window.__dismissedAutoInfo.includes(day)) {
                        const infoDiv = document.createElement('div');
                        infoDiv.className = 'auto-copy-info';
                        infoDiv.style = `
                            background: rgb(254, 251, 239);
                            color: rgb(133, 100, 4);
                            padding: 6px 10px;
                            border-radius: 6px;
                            border: 1px dashed rgb(255, 224, 130);
                            display: block;
                            font-size: 0.85rem;
                            font-weight: 500;
                            margin-bottom: 20px;
                        `;
                        infoDiv.innerHTML = `⚡ Last item of Day ${day - 1} added`;
                        dayList.appendChild(infoDiv);
                    }

        const containerId = `route-map-day${day}`;
        const travelMode = typeof getTravelModeForDay === "function" ? getTravelModeForDay(day) : "driving";
        const pairwiseSummaries = window.pairwiseRouteSummaries?.[containerId] || [];
        const points = dayItemsArr.map(it => it.location ? it.location : null).filter(Boolean);

        let placeCounter = 1;

        for (let idx = 0; idx < dayItemsArr.length; idx++) {
            const item = dayItemsArr[idx];
            const currIdx = window.cart.indexOf(item);

            const li = document.createElement("li");
            li.className = "travel-item";

            if (item.category === "Note") {
                li.classList.add("note-item");
            }

            // --- DEĞİŞİKLİK: HESAPLAMAYI EN ÜSTE ALDIK ---
            let markerLabel = "";
            let markerBgColor = ""; 

            if (item.category === "Note") {
                markerLabel = "N";
                markerBgColor = "#f57f17"; 
            } else {
                markerLabel = placeCounter;
                markerBgColor = "#d32f2f"; 
                placeCounter++; 
            }
            // ---------------------------------------------

            li.dataset.index = currIdx;
            
            // YENİ EKLENEN SATIR:
            li.setAttribute("data-daily-index", markerLabel); 

            if (item.location && typeof item.location.lat === "number" && typeof item.location.lng === "number") {
                li.setAttribute("data-lat", item.location.lat);
                li.setAttribute("data-lon", item.location.lng);
            }

            const listMarkerHtml = `
                <div class="custom-marker-outer">${markerLabel}</span>
                </div>
            `;

            if (item.category === "Note") {
                li.innerHTML = `
          <div class="cart-item">
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%">
              <div style="display: flex; align-items: center; gap: 10px;">
                
                <img src="img/drag_move.svg" alt="Drag" class="drag-icon">
                
                <div class="item-position">
                    ${listMarkerHtml} 
                    <img src="${item.image || 'img/added-note.png'}" alt="${item.name}" class="cart-image">
                </div>

                <div class="item-info">
                  <p class="toggle-title">${item.name}</p>
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:5px;">
                <button class="remove-btn" onclick="removeFromCart(${currIdx})">
                  <img src="img/remove-icon.svg" alt="Close">
                </button>
                <span class="arrow">
                  <img src="img/right-arrow.svg" class="arrow-icon" onclick="toggleContent(this)">
                </span>
              </div>
            </div>
            <div class="confirmation-container" id="confirmation-container-${li.dataset.index}" style="display:none;"></div>
            
            <div class="content" style="display:none;">
              <div class="info-section">
                <div class="note-details">
                  <p>${item.noteDetails ? escapeHtml(item.noteDetails) : ""}</p>
                </div>
              </div>
            </div>
          </div>
        `;
            } else {
                let openingHoursDisplay = "No working hours info";
                if (item.opening_hours) {
                    if (Array.isArray(item.opening_hours)) {
                        const cleaned = item.opening_hours.map(h => (h || '').trim()).filter(Boolean);
                        if (cleaned.length) openingHoursDisplay = cleaned.join(" | ");
                    } else if (typeof item.opening_hours === "string" && item.opening_hours.trim()) {
                        openingHoursDisplay = item.opening_hours.trim();
                    }
                }
                const leafletMapId = "leaflet-map-" + currIdx;
               const mapHtml = (item.location && typeof item.location.lat === "number" && typeof item.location.lng === "number")
                    ? `<div class="map-container"><div class="leaflet-map" id="${leafletMapId}" style="width:100%;height:250px;"></div></div>`
                    : '<div class="map-error">Location not available</div>';

               // DÜZELTME: Artık yeni eklenen ikonları da içeren ana fonksiyonu çağırıyoruz
               const catIcon = categoryIcon(item.category);

            // --- PAYLAŞIM GÖRSELİ FİX (Priority Logic) ---
            let finalImg = item.image;
            // Eğer resim '0', 'default' veya boş ise (Linkten boş geldiyse)
            if (!finalImg || finalImg === 'default' || finalImg === '0') {
                // 1. Önce Pexels listesine bak (Localdeysen burası çalışır)
                if (window.cityImages && window.cityImages.length > 0) {
                    finalImg = window.cityImages[idx % window.cityImages.length];
                } else {
                    // 2. O da yoksa (Paylaşım açıldı ve Pexels henüz yüklenmediyse)
                    finalImg = 'img/default_place.jpg'; 
                }
            }
            // ----------------------------------------------

            li.innerHTML = `
          <div class="cart-item">
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%">
              <div style="display: flex; align-items: center; gap: 10px;">
                <img src="img/drag_move.svg" alt="Drag" class="drag-icon">

                <div class="item-position">${listMarkerHtml}                
                  <img src="${finalImg}" 
                       onerror="this.src='img/default_place.jpg'" 
                       alt="${item.name}" 
                       class="cart-image">
                </div>

                <img src="${catIcon}" alt="${item.category}" class="category-icon">
                <div class="item-info">
                  <p class="toggle-title">${item.name}</p>
                </div>
              </div>
              <span class="arrow">
                <img src="img/right-arrow.svg" class="arrow-icon" onclick="toggleContent(this)">
              </span>
            </div>
            <div class="content">
              <div class="info-section">
                <div class="place-rating">${mapHtml}</div>
                <div class="contact">
                  <p>📌 Address: ${item.address || 'Address not available'}</p>
                </div>
                <p class="working-hours-title">
                  🕔 Working hours: <span class="working-hours-value">${openingHoursDisplay}</span>
                </p>
                ${
                  item.location ? `
                    <div class="coords-info" style="margin-top:8px;">
                      📍 Coords: Lat: ${Number(item.location.lat).toFixed(7).replace('.', ',')},
                      Lng: ${Number(item.location.lng).toFixed(7).replace('.', ',')}
                    </div>
                    ${item.website ? `
                      <div class="website-info" style="margin-top:8px;">
                        🔗 <a href="${item.website}" target="_blank" rel="noopener">
                          ${item.website.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    ` : ''}
                    <div class="google-search-info" style="margin-top:8px;">
                      <a href="https://www.google.com/search?tbm=isch&q=${encodeURIComponent(item.name + ' ' + (window.selectedCity || ''))}" target="_blank" rel="noopener">
                        🇬 Search images on Google
                      </a>
                    </div>
                  ` : ''
                }
              </div>
         <button class="add-favorite-btn"
                onclick="toggleFavFromCart(this)"
                data-name="${item.name}"
                data-category="${item.category}"
                data-lat="${item.location?.lat ?? item.lat ?? ""}"
                data-lon="${item.location?.lng ?? item.lon ?? ""}"
                data-image="${item.image || ""}">
                
                <span class="fav-heart"
                  data-name="${item.name}"
                  data-category="${item.category}"
                  data-lat="${item.location?.lat ?? item.lat ?? ""}"
                  data-lon="${item.location?.lng ?? item.lon ?? ""}"
                  data-image="${item.image || ""}">
                  <img class="fav-icon" src="${isTripFav(item) ? 'img/like_on.svg' : 'img/like_off.svg'}" alt="Favorite" style="width:18px;height:18px;">
                </span>
                <span class="fav-btn-text">${isTripFav(item) ? "Remove from My Places" : "Add to My Places"}</span>
              </button>

              <button class="remove-btn" onclick="showRemoveItemConfirmation(${li.dataset.index}, this)">
                Remove place
              </button>
              <div class="confirmation-container" id="confirmation-item-${li.dataset.index}" style="display:none;">
                <p>Are you sure you want to remove <strong>${item.name}</strong> from your trip?</p>
                <div class="modal-actions">
                  <button class="confirm-remove-btn" onclick="confirmRemoveItem(${li.dataset.index})">OK</button>
                  <button class="cancel-action-btn" onclick="hideItemConfirmation('confirmation-item-${li.dataset.index}')">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        `;
            }

            dayList.appendChild(li);

            const nextItem = dayItemsArr[idx + 1];
            const hasNextLoc =
                item.location &&
                typeof item.location.lat === "number" &&
                typeof item.location.lng === "number" &&
                nextItem &&
                nextItem.location &&
                typeof nextItem.location.lat === "number" &&
                typeof nextItem.location.lng === "number";

            const currentMode =
                typeof getTravelModeForDay === "function"
                    ? String(getTravelModeForDay(day)).trim().toLowerCase()
                    : "car"; 

            if (hasNextLoc) {
                let distanceStr = '';
                let durationStr = '';
                let prefix = '';

                const isInTurkey = (typeof areAllPointsInTurkey === 'function') 
                                    ? areAllPointsInTurkey([item.location, nextItem.location])
                                    : false;

                if (!isInTurkey) {
                    const ptA = item.location;
                    const ptB = nextItem.location;
                    const distM = haversine(ptA.lat, ptA.lng, ptB.lat, ptB.lng);
                    const durSec = Math.round((distM / 1000) / 4 * 3600); 
                    distanceStr = distM >= 1000 ? (distM / 1000).toFixed(2) + " km" : Math.round(distM) + " m";
                    durationStr = durSec >= 60 ? Math.round(durSec / 60) + " min" : Math.round(durSec) + " sec";
                    prefix = `<span class="auto-generated-label" style="font-size:12px;margin-right:5px;">Auto generated</span>`;
                } else {
                    const summary = pairwiseSummaries[idx];
                    if (summary && typeof summary.distance === "number" && typeof summary.duration === "number") {
                        distanceStr = summary.distance >= 1000
                            ? (summary.distance / 1000).toFixed(2) + " km"
                            : Math.round(summary.distance) + " m";
                        durationStr = summary.duration >= 60
                            ? Math.round(summary.duration / 60) + " min"
                            : Math.round(summary.duration) + " sec";
                    } else {
                        const ptA = item.location;
                        const ptB = nextItem.location;
                        const distM = haversine(ptA.lat, ptA.lng, ptB.lat, ptB.lng);
                        const durSec = Math.round((distM / 1000) / 4 * 3600);
                        distanceStr = distM >= 1000 ? (distM / 1000).toFixed(2) + " km" : Math.round(distM) + " m";
                        durationStr = durSec >= 60 ? Math.round(durSec / 60) + " min" : Math.round(durSec) + " sec";
                    }

                    if (currentMode === "driving" || currentMode === "car") {
                        prefix = `<img src="/img/way_car.svg" alt="Car">`;
                    } else if (currentMode === "bike" || currentMode === "cycling") {
                        prefix = `<img src="/img/way_bike.svg" alt="Bike">`;
                    } else if (currentMode === "walk" || currentMode === "walking") {
                        prefix = `<img src="/img/way_walk.svg" alt="Walk">`;
                    } else {
                        prefix = ''; 
                    }
                }

                const distanceSeparator = document.createElement('div');
                distanceSeparator.className = 'distance-separator';
                distanceSeparator.innerHTML = `
            <div class="separator-line"></div>
            <div class="distance-label">
              ${prefix}<span class="distance-value">${distanceStr}</span> · <span class="duration-value">${durationStr}</span>
            </div>
            <div class="separator-line"></div>
          `;
                dayList.appendChild(distanceSeparator);
            }
        }

        dayContainer.appendChild(dayList);
        
        if (typeof ensureDayMapContainer === 'function') ensureDayMapContainer(day);
        if (typeof initEmptyDayMap === 'function') initEmptyDayMap(day);

        if (typeof window.renderDayCollage === 'function') {
            window.renderDayCollage(day, dayContainer, dayItemsArr);
        }

        if (typeof wrapRouteControls === 'function') {
            wrapRouteControls(day);
            setTimeout(() => wrapRouteControls(day), 0);
        }

 
const anyDayHasRealItem = window.cart.some(i =>
    !i._starter && !i._placeholder && i.category !== "Note" && i.name
);
const hideAddCat = window.__hideAddCatBtnByDay && window.__hideAddCatBtnByDay[day];

if (anyDayHasRealItem && !hideAddCat) {
    // Aynı gün için ikinci kez eklenmesin
    let existingGroup = dayList.querySelector('.tt-day-actions');
    if (!existingGroup) {
        const group = document.createElement('div');
        group.className = 'tt-day-actions';

        // 1) Add Category
        const addCategoryBtn = document.createElement("button");
        addCategoryBtn.className = "add-more-btn";
        addCategoryBtn.innerHTML = `
          <img src="img/add_item.svg" alt="" style="width:18px;height:18px;">
          <span>Add Item</span>
        `;
        addCategoryBtn.style.display = 'flex';
        addCategoryBtn.style.alignItems = 'center';
        addCategoryBtn.style.justifyContent = 'center';
        addCategoryBtn.style.gap = '6px';
        addCategoryBtn.dataset.day = day;
        addCategoryBtn.onclick = function () {
            if (typeof showCategoryList === 'function') showCategoryList(this.dataset.day);
        };

        // 2) Add Custom Note
        // 2) Add Custom Note
        // 2) Add Custom Note
        const addCustomNoteBtn = document.createElement("button");
        addCustomNoteBtn.className = "add-custom-note-btn";
        addCustomNoteBtn.innerHTML = `
          <img src="img/add_note.svg" alt="" style="width:18px;height:18px;">
          <span>Add Note</span>
        `;
        addCustomNoteBtn.style.cssText = "display: flex; align-items: center; justify-content: center; gap: 6px;";

        // Not Kutusu (Container)
        const noteBox = document.createElement("div");
        noteBox.className = "custom-note-container";
        
        // --- KRİTİK NOKTA: KESİN GİZLE ---
        // Oluşturulur oluşturulmaz inline style olarak gizliyoruz. 
        // Bu, CSS dosyalarından etkilenmez.
        noteBox.style.display = "none"; 
        noteBox.style.width = "100%";
        noteBox.style.flexBasis = "100%";
        
        noteBox.innerHTML = `
            <h3>Add Custom Note for Day ${day}</h3>
            <input type="text" placeholder="Note title" class="note-input">
            <textarea placeholder="Note details" class="note-textarea"></textarea>
            <div class="modal-actions">
                <button type="button" class="save-note">Save Note</button>
                <button type="button" class="cancel-note">Cancel</button>
            </div>
        `;

        // Element Referansları
        const saveBtn = noteBox.querySelector(".save-note");
        const cancelBtn = noteBox.querySelector(".cancel-note");
        const titleInput = noteBox.querySelector(".note-input");
        const detailsInput = noteBox.querySelector(".note-textarea");

        // --- AÇMA / KAPAMA (Add Note Butonu) ---
        addCustomNoteBtn.onclick = function () {
            // Eğer display none ise, flex yap (aç). Değilse none yap (kapat).
            if (noteBox.style.display === "none") {
                noteBox.style.display = "flex";
                noteBox.style.flexDirection = "column"; // Flex yönünü de JS ile veriyoruz
                noteBox.style.gap = "6px";
                noteBox.style.margin = "20px 0";
                titleInput.focus();
            } else {
                noteBox.style.display = "none";
            }
        };

        // --- İPTAL (Cancel) ---
        cancelBtn.onclick = function () {
            noteBox.style.display = "none"; // Kesin kapat
            titleInput.value = "";
            detailsInput.value = "";
        };

        // --- KAYDET (Save) ---
        saveBtn.onclick = async function () {
            if (typeof saveCustomNote === "function") {
                // ID Atama Hilesi
                titleInput.id = "noteTitle";
                detailsInput.id = "noteDetails";

                await saveCustomNote(day);

                titleInput.removeAttribute("id");
                detailsInput.removeAttribute("id");
            }
            // Kapat ve temizle
            noteBox.style.display = "none";
            titleInput.value = "";
            detailsInput.value = "";
        };

        // --- CANCEL BUTONU ---
        cancelBtn.onclick = function () {
            noteBox.style.display = "none";
            titleInput.value = "";
            detailsInput.value = "";
        };

        // --- AÇMA/KAPAMA BUTONU ---
        addCustomNoteBtn.onclick = function () {
            // Açık mı kapalı mı kontrol et
            const isHidden = noteBox.style.display === "none";
            
            // Toggle işlemi
            noteBox.style.display = isHidden ? "block" : "none";

            // Açılıyorsa başlığa odaklan
            if (isHidden) {
                setTimeout(() => {
                    titleInput.focus();
                }, 0);
            }
        };
        // --- YENİ DÜZENLEME BİTİŞİ ---

        // 3) Add from My Places
        const addFromMyPlacesBtn = document.createElement("button");
        addFromMyPlacesBtn.className = "add-favorite-place-btn";
        addFromMyPlacesBtn.innerHTML = `
          <img src="img/add_my_places.svg" alt="" style="width:18px;height:18px;">
          <span>My Places</span>
        `;
        addFromMyPlacesBtn.style.display = 'flex';
        addFromMyPlacesBtn.style.alignItems = 'center';
        addFromMyPlacesBtn.style.justifyContent = 'center';
        addFromMyPlacesBtn.style.gap = '6px';
        addFromMyPlacesBtn.onclick = function () {
            if (window.toggleSidebarFavoritePlaces) {
                window.toggleSidebarFavoritePlaces();
            }
        };

        // sırayla ekle
        // Butonlar yan yana (row)
const actionsRow = document.createElement('div');
actionsRow.className = 'tt-day-actions-row';
actionsRow.style.display = 'flex';
actionsRow.style.flexDirection = 'row';
actionsRow.style.gap = '8px';
actionsRow.style.flexWrap = 'nowrap';      // küçük ekranda taşarsa alta insin
actionsRow.style.alignItems = 'center';

actionsRow.appendChild(addCategoryBtn);
actionsRow.appendChild(addFromMyPlacesBtn);
actionsRow.appendChild(addCustomNoteBtn);

// group içine önce row'u koy
group.appendChild(actionsRow);

// note kutusu her zaman altta, tam genişlik
noteBox.style.width = '100%';
noteBox.style.flexBasis = '100%';
group.appendChild(noteBox);

        dayList.appendChild(group);
    }
}
       

        cartDiv.appendChild(dayContainer);
    } 


    // Tüm günler eklendikten sonra, EN ALTA ekle:
    const addNewDayHr = document.createElement('hr');
    addNewDayHr.className = 'add-new-day-separator';
    cartDiv.appendChild(addNewDayHr);

    const addNewDayButton = document.createElement("button");
    addNewDayButton.className = "add-new-day-btn";
    addNewDayButton.id = "add-new-day-button";
    
    // === YENİ 10 GÜN LİMİT KONTROLÜ (UI) ===
    // En yüksek gün sayısını bul
    const currentMaxDay = window.cart && window.cart.length > 0 
        ? Math.max(...window.cart.map(i => i.day || 1)) 
        : 1;

    if (currentMaxDay >= 10) {
        // PASİF DURUM (Limit Doldu)
        addNewDayButton.textContent = "Max 10 Days Reached 🛑";
        addNewDayButton.disabled = true;
        addNewDayButton.style.opacity = "0.5";
        addNewDayButton.style.cursor = "not-allowed";
        addNewDayButton.style.backgroundColor = "#ccc"; // Görsel olarak grileştir
    } else {
        // AKTİF DURUM (Limit Dolmadı)
        // İkonlu içerik
                addNewDayButton.innerHTML = '<img src="img/add_new_day_icon.svg" style="width: 18px; height: 18px;">Add New Day';
                // Flex stilini butonun kendisine (veya CSS'e) ekleyebilirsiniz, burada JS ile zorluyoruz:
               
                addNewDayButton.style.gap = '6px';
        addNewDayButton.disabled = false;
        addNewDayButton.onclick = function () { 
             if(typeof addNewDay === 'function') addNewDay(this); 
        };
    }
    // =======================================

    cartDiv.appendChild(addNewDayButton);



    // --- Diğer kalan işlemler ---
    const itemCount = window.cart.filter(i => 
        i.name && 
        !i._starter && 
        !i._placeholder && 
        i.category !== 'Note'
    ).length;

    if (menuCount) {
        menuCount.textContent = itemCount;
        menuCount.style.display = itemCount > 0 ? "inline-block" : "none";
    }

    days.forEach(d => { if(typeof initPlaceSearch === 'function') initPlaceSearch(d); });
    if(typeof addCoordinatesToContent === 'function') addCoordinatesToContent();
    
    days.forEach(d => {
        const suppressing = window.__suppressMiniUntilFirstPoint &&
            window.__suppressMiniUntilFirstPoint[d];
        const realPoints = (typeof getDayPoints === 'function') ? getDayPoints(d) : [];
        if (suppressing && realPoints.length === 0) {
            return;
        }
        if(typeof renderRouteForDay === 'function') renderRouteForDay(d);
    });
    
    if(typeof wrapRouteControlsForAllDays === 'function') setTimeout(wrapRouteControlsForAllDays, 0);


    if (window.expandedMaps) {
        Object.values(window.expandedMaps).forEach(({ expandedMap, day }) => {
            if (expandedMap && typeof updateExpandedMap === 'function') updateExpandedMap(expandedMap, day);
        });
    }

    // initDragDropSystem();
    if (typeof interact !== 'undefined' && typeof setupMobileDragDrop === 'function') setupMobileDragDrop();
    if (typeof setupSidebarAccordion === 'function') setupSidebarAccordion();

    if (typeof renderTravelModeControlsForAllDays === 'function') renderTravelModeControlsForAllDays();

    (function ensureNewChatInsideCart() {
        const oldOutside = document.querySelector('#newchat');
        if (oldOutside && !oldOutside.closest('#cart')) oldOutside.remove();
        const cartRoot = document.getElementById('cart');
        if (!cartRoot) return;
        let newChat = cartRoot.querySelector('#newchat');
        if (!newChat) {
            newChat = document.createElement('div');
            newChat.id = 'newchat';
        // İkonlu içerik ve Flex stil güncellemesi
        newChat.innerHTML = '<img src="img/new_trip_plan_icon.svg" style="width: 18px; height: 18px;"> New Trip Plan';
     ;

        newChat.onclick = function () {
        const chatBox = document.getElementById('chat-box');
        if (chatBox) chatBox.innerHTML = ''; 

        // Önemli: Botun ilk mesajı tekrar atabilmesi için flagleri sıfırla
        window.__welcomeShown = false; 
        window.__welcomeHiddenForever = false;
        window.__locationPickedFromSuggestions = false;

        // Diğer temizlik işlemleri...
        window.selectedCity = null;
        window.cart = [];
        
        // Typing indicator'ı temizle ve gizli olarak ekle
        if (chatBox) {
            let indicator = document.getElementById('typing-indicator');
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'typing-indicator';
                indicator.className = 'typing-indicator';
                indicator.innerHTML = '<span></span><span></span><span></span>';
            }
            chatBox.appendChild(indicator);
            indicator.style.display = 'none';
        }

        try {
            if (typeof window.__ttNewTripToken === 'function') {
                window.__activeTripSessionToken = window.__ttNewTripToken();
            }
            window.__dayCollagePhotosByDay = {};
            window.__globalCollageUsed = new Set();
        } catch (e) {
            console.warn('[collage] Token reset error:', e);
        }
        
        if (typeof closeAllExpandedMapsAndReset === "function") closeAllExpandedMapsAndReset();
        
        window.routeElevStatsByDay = {};
        window.__ttElevDayCache = {};
        window._segmentHighlight = {};
        window._lastSegmentDay = undefined;
        window._lastSegmentStartKm = undefined;
        window._lastSegmentEndKm = undefined;

        document.querySelectorAll('.expanded-map-container, .route-scale-bar, .tt-elev-svg, .elev-segment-toolbar, .custom-nearby-popup').forEach(el => el.remove());

        if (typeof updateCart === "function") updateCart();
        
        document.querySelectorAll('.sidebar-overlay').forEach(el => el.classList.remove('open'));
        const sidebar = document.querySelector('.sidebar-overlay.sidebar-gallery');
        if (sidebar) sidebar.classList.add('open');

        // --- Let's get started mesajını tekrar ekle ---
        window.__welcomeShown = false; 
        window.__welcomeHiddenForever = false;

        if (chatBox) {
            chatBox.innerHTML = ''; // İçeriği tamamen boşalt
            
            // Typing indicator'ı (gizli olarak) tekrar oluştur/ekle
            let indicator = document.getElementById('typing-indicator');
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'typing-indicator';
                indicator.className = 'typing-indicator';
                indicator.innerHTML = '<span></span><span></span><span></span>';
                chatBox.appendChild(indicator);
            }
            indicator.style.display = 'none';
        }

        var iw = document.querySelector('.input-wrapper');
        if (iw) iw.style.display = '';

        // Önerileri sıfırla
        if (typeof showSuggestions === "function") showSuggestions(); 

        document.querySelectorAll('.category-area-option.selected-suggestion').forEach(function (el) {
            el.classList.remove('selected-suggestion');
        });

        const tripDetailsSection = document.getElementById("tt-trip-details");
        if (tripDetailsSection) tripDetailsSection.remove();

        const chatScreen = document.getElementById("chat-screen");
        if (chatScreen) chatScreen.innerHTML = "";
    };
        }
        const datesBtn = cartRoot.querySelector('.add-to-calendar-btn[data-role="trip-dates"]');
        if (datesBtn && datesBtn.nextSibling !== newChat) {
            datesBtn.insertAdjacentElement('afterend', newChat);
        } else if (!datesBtn && newChat.parentNode !== cartRoot) {
            cartRoot.appendChild(newChat);
        }
        const itemCount = window.cart.filter(i => i.name && !i._starter && !i._placeholder).length;
        newChat.style.display = itemCount > 0 ? '' : 'none';
    })();



(function ensurePdfButtonAndOrder() {
    // Hem cart hem cart-items kontrolü yapalım
    const cartRoot = document.getElementById('cart') || document.getElementById('cart-items');
    if (!cartRoot) return;

    // 1. PDF Butonunu Oluştur veya Bul
    let pdfBtn = document.getElementById('tt-pdf-dl-btn');
    if (!pdfBtn) {
        pdfBtn = document.createElement('button');
        pdfBtn.id = 'tt-pdf-dl-btn';
        pdfBtn.className = 'add-to-calendar-btn'; 
        
     
        
        // textContent kullanma, doğrudan innerHTML ile ikon ve metni birlikte ver
        pdfBtn.innerHTML = '<img src="img/pdf_download_icon.svg" style="width: 18px; height: 18px;"> Download Trip Plan';

        pdfBtn.onclick = function () {
            if (typeof saveCurrentTripToStorage === "function") saveCurrentTripToStorage();
            if (typeof downloadTripPlanPDF === "function") {
                const key = window.activeTripKey || 'current_draft';
                downloadTripPlanPDF(key);
            } else {
                alert("PDF module not ready.");
            }
        };
    }

    // 2. Görünürlük
    const hasRealItem = window.cart && window.cart.some(i => i.name && !i._starter && !i._placeholder);
pdfBtn.style.display = hasRealItem ? '' : 'none';
    // 3. PDF Butonunu "Add New Day"'in altına koy
    const addNewDayBtn = document.getElementById('add-new-day-button');
    if (addNewDayBtn) {
        addNewDayBtn.insertAdjacentElement('afterend', pdfBtn);
    }

})();

(function ensureTripDetailsButtonAlways() {
    const cartDiv = document.getElementById("cart-items");
    if (!cartDiv) return;

    let dateRangeDiv = cartDiv.querySelector('.date-range');
    if (!dateRangeDiv) {
        dateRangeDiv = document.createElement('div');
        dateRangeDiv.className = 'date-range';
    }
    
    // Butonun HTML'i (İkonlu)
    const btnHtml = `
        <button type="button" class="see-details-btn" data-role="trip-details-btn" style="display: flex; align-items: center; justify-content: center; gap: 6px;">
            <img src="/img/trip_details.svg" alt="" style="width: 18px; height: 18px;">
            Share Your Plan
        </button>
    `;
    
    if (window.cart.startDate) {
        // DURUM 1: Tarih VAR
        const endDate = (window.cart.endDates && window.cart.endDates.length)
            ? window.cart.endDates[window.cart.endDates.length - 1]
            : window.cart.startDate;
        
        dateRangeDiv.innerHTML = `
          <span class="date-info">📅 Dates: ${window.cart.startDate} - ${endDate}</span>
          ${btnHtml}
        `;
    } else {
        // DURUM 2: Tarih YOK
        dateRangeDiv.innerHTML = btnHtml;
    }
    
    // Tıklama Olayını Bağla
    const detailsBtn = dateRangeDiv.querySelector('[data-role="trip-details-btn"]');
    if (detailsBtn) {
        detailsBtn.onclick = () => {
            if (typeof showTripDetails === 'function') {
                showTripDetails(window.cart.startDate || null);
            }
        };
    }
    
    // UI Güncelle
    const existing = cartDiv.querySelector('.date-range');
    if (existing) {
        existing.replaceWith(dateRangeDiv);
    } else {
        cartDiv.appendChild(dateRangeDiv);
    }
})();

    (function ensurePostDateSections() {
        if (!window.cart.startDate) return;
        let share = document.getElementById('trip-share-section');
        if (!share) {
            share = document.createElement('div');
            share.id = 'trip-share-section';
            share.className = 'trip-share-section';
            cartDiv.appendChild(share);
        }
        if (typeof buildShareSection === 'function') buildShareSection();
        const oldAI = document.getElementById('ai-info-section');
        if (oldAI) oldAI.remove();
    })();

   


    // === OTOMATİK AI INFO GENERATION (Start With Map İçin) ===
    (function autoGenerateAiInfo() {
        // 1. Eğer ekranda zaten AI kutusu varsa (veya yükleniyorsa) tekrar çalışma
        if (document.querySelector('.ai-info-section')) return;

        // 2. Sepet boşsa çalışma
        if (!window.cart || window.cart.length === 0) return;

        // 3. İlk "gerçek" (start/placeholder olmayan) mekanı bul
        const first = window.cart.find(it =>
            it.location &&
            typeof it.location.lat === "number" &&
            typeof it.location.lng === "number" &&
            !it._starter && !it._placeholder
        );

        if (!first) return;

        // 4. Şehir bilgisini bul (Globalden veya adresten)
        let city = window.selectedCity;

        // Global seçili şehir yoksa, ilk markerın adresinden çekmeye çalış
        if (!city && first.address) {
            const parts = first.address.split(",");
            if (parts.length >= 2) {
                // Sondan 2. parça genellikle "PostaKodu Şehir" formatındadır (örn: "8003 Barcelona")
                const rawCity = parts[parts.length - 2].trim();
                // Baştaki sayıları (posta kodunu) temizle
                city = rawCity.replace(/^\d+\s*-?\s*/, '');
            } else {
                city = parts[0].trim();
            }
        }

        // 5. Şehir bulunduysa -> OTOMATİK BAŞLAT
        if (city) {
            // Eğer başlık "Trip Plan" olarak kaldıysa, "Trip to [City]" olarak güncelle
            if (!window.selectedCity || window.lastUserQuery === "Trip Plan") {
                window.selectedCity = city;
                window.lastUserQuery = "Trip to " + city;
                const tEl = document.getElementById("trip_title");
                if (tEl) tEl.textContent = window.lastUserQuery;
            }

            console.log("📍 Start with Map: Otomatik AI tetikleniyor ->", city);

            // Buton beklemeden direkt fonksiyonu çağırıyoruz
            if (typeof insertTripAiInfo === "function") {
                insertTripAiInfo(false, null, city);
            }
        }
    })();

    // EN SON: (Keep your existing trailing code)
    if (window.latestAiInfoHtml && !document.querySelector('.ai-trip-info-box')) {
        const div = document.createElement("div");
        div.innerHTML = window.latestAiInfoHtml;
        cartDiv.appendChild(div.firstElementChild);
    }

     if (window._maplibre3DInstance) {
        if (window._maplibre3DInstance.getLayer && window._maplibre3DInstance.getLayer('segment-highlight-layer')) {
            window._maplibre3DInstance.removeLayer('segment-highlight-layer');
        }
        if (window._maplibre3DInstance.getSource && window._maplibre3DInstance.getSource('segment-highlight-source')) {
            window._maplibre3DInstance.removeSource('segment-highlight-source');
        }
        if (window._segment3DMarkers && Array.isArray(window._segment3DMarkers)) {
            window._segment3DMarkers.forEach(m => m.remove && m.remove());
            window._segment3DMarkers = [];
        }
        window._lastSegmentDay = undefined;
        window._lastSegmentStartKm = undefined;
        window._lastSegmentEndKm = undefined;
    }
// EN SONA EKLEYİN:
    if (typeof updateAllChatButtons === 'function') {
        updateAllChatButtons();
    }
}

function showRemoveItemConfirmation(index, btn) {
  const id = `confirmation-item-${index}`;
  const container = document.getElementById(id);
  if (!container) {
    console.error('Confirmation container not found:', id);
    return;
  }
  container.style.display = "block";
  btn.style.display = "none";
}

function confirmRemoveItem(index) {
  // Silme işlemi (window.cart'tan çıkar vs.)
  removeFromCart(index); // Senin silme fonksiyonun!
  hideItemConfirmation(`confirmation-item-${index}`);
}

function hideItemConfirmation(id) {
  const container = document.getElementById(id);
  if (container) {
    container.style.display = "none";
    // Silme butonunu geri göster
    const parentItem = container.closest('.travel-item');
    if (parentItem) {
      const removeBtn = parentItem.querySelector('.remove-btn');
      if (removeBtn) removeBtn.style.display = "";
    }
  }
  // container yoksa hiçbir şey yapma!
}

window.addEventListener('load', function() {
  updateCart();
});

document.querySelectorAll('.accordion-label').forEach(label => {
    label.addEventListener('click', function() {
    });
setTimeout(bindAddNewDayButton, 10);
});


function searchPlaceOnGoogle(place, city) {
  // Boşlukları + ile değiştir, çift tırnak ve özel karakterlerden koru
  const query = [place, city].filter(Boolean).join(' ').replace(/"/g, '').trim();
  const url = 'https://www.google.com/search?q=' + encodeURIComponent(query);
  window.open(url, '_blank');
}


(function ensureDayActionMenuStyles() {
  if (document.getElementById('tt-day-action-menu-styles')) return;
  const s = document.createElement('style');
  s.id = 'tt-day-action-menu-styles';
  document.head.appendChild(s);
})();

// Dışarı tıklayınca menüyü kapat (tek sefer bağla)
(function attachGlobalMenuCloser() {
  if (window.__ttDayActionMenuClosed) return;
  document.addEventListener('click', (e) => {
    document.querySelectorAll('.action-menu.open').forEach(menu => {
      if (!menu.contains(e.target)) {
        menu.classList.remove('open');
        const trigger = menu.querySelector('.action-menu-trigger');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      }
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.action-menu.open').forEach(menu => {
        menu.classList.remove('open');
        const trigger = menu.querySelector('.action-menu-trigger');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      });
    }
  });
  window.__ttDayActionMenuClosed = true;
})();

(function ensureDayHeaderFlexStyles(){
  if (document.getElementById('tt-day-header-flex')) return;
  const s = document.createElement('style');
  s.id = 'tt-day-header-flex';
 
  document.head.appendChild(s);
})();


function createDayActionMenu(day) {
  const container = document.createElement('div');
  container.className = 'action-menu';
  container.innerHTML = `
    <button type="button" class="action-menu-trigger" aria-haspopup="true" aria-expanded="false" title="Actions">⋯</button>
    <div class="action-menu-list" role="menu">
      <button type="button" class="action-menu-item rename" data-action="rename" role="menuitem">
        <span class="icon">✏️</span> <span>Rename</span>
      </button>
      <button type="button" class="action-menu-item empty" data-action="empty" role="menuitem">
        <span class="icon">😴</span> <span>No Plan</span>
      </button>
      <button type="button" class="action-menu-item remove" data-action="remove" role="menuitem">
        <span class="icon">⛔</span> <span>Remove</span>
      </button>
    </div>
  `;

  const trigger = container.querySelector('.action-menu-trigger');
  const list = container.querySelector('.action-menu-list');

  trigger.addEventListener('mousedown', e => e.stopPropagation(), { passive: true });
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = container.classList.toggle('open');
    trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.action-menu-item');
    if (!btn) return;
    e.stopPropagation();

    const action = btn.dataset.action;
    const dayContainerId = `day-container-${day}`;
    const confirmationContainerId = `confirmation-container-${day}`;

    try {
      if (action === 'rename') {
        if (typeof editDayName === 'function') editDayName(day);
      } else if (action === 'empty') {
        if (typeof showResetConfirmation === 'function') {
          showResetConfirmation(day, confirmationContainerId); // “No Plan”
        }
      } else if (action === 'remove') {
        if (typeof showRemoveConfirmation === 'function') {
          showRemoveConfirmation(day, dayContainerId, confirmationContainerId);
        }
      }
    } finally {
      container.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
    }
  });

  return container;
}
function areAllPointsInTurkey(pts) {
  // Geofabrik Türkiye bounding box (2024 için)
  return pts.every(p =>
    p.lat >= 35.81 && p.lat <= 42.11 &&
    p.lng >= 25.87 && p.lng <= 44.57
  );
}

function toOSRMMode(mode) {
  // Normalize all possible synonyms
  if (!mode) return 'car'; // fallback
  mode = mode.toLowerCase();
  if (mode === 'walking') return 'foot';
  if (mode === 'cycling') return 'bike';

  return mode;
}

function isSupportedTravelMode(mode) {
  // Sadece car, bike, foot rota çizebilir
  mode = toOSRMMode(mode);
  return ['car', 'bike', 'foot'].includes(mode);
}





function forceCleanExpandedMap(day) {
  const containerId = `route-map-day${day}`;
  // 1. Expanded map instance ve DOM temizliği
  // -- Expanded JS instance varsa sil
  if (window.expandedMaps && window.expandedMaps[containerId]) {
    try {
      window.expandedMaps[containerId].expandedMap.remove();
    } catch(e){}
    delete window.expandedMaps[containerId];
  }
  // -- Expanded harita DOM'unu sil
  const expDiv = document.getElementById(`${containerId}-expanded`);
  if (expDiv && expDiv.parentNode) expDiv.parentNode.removeChild(expDiv);

  // -- Eski collapsed harita instance'ı ve DOM'u da sil (leaflet)
  if (window.leafletMaps && window.leafletMaps[containerId]) {
    try { window.leafletMaps[containerId].remove(); } catch(e){}
    delete window.leafletMaps[containerId];
  }
  // -- Eski Leaflet container varsa DOM'dan kaldır
  const mapDiv = document.getElementById(containerId);
  if (mapDiv) {
    mapDiv.querySelectorAll('.leaflet-container').forEach(el => el.remove());
  }
}

/* === ROUTE CLEANUP HELPERS (EKLENDİ) === */
function clearRouteCachesForDay(day){
  if(!day) return;
  const key = `route-map-day${day}`;
  if (window.lastRouteGeojsons) delete window.lastRouteGeojsons[key];
  if (window.lastRouteSummaries) delete window.lastRouteSummaries[key];
  if (window.pairwiseRouteSummaries) delete window.pairwiseRouteSummaries[key];
  if (window.routeElevStatsByDay) delete window.routeElevStatsByDay[day];
  if (window.__ttElevDayCache && window.__ttElevDayCache[day]) delete window.__ttElevDayCache[day];
}

function clearRouteVisualsForDay(day){
  const key = `route-map-day${day}`;
  const map = window.leafletMaps && window.leafletMaps[key];
  if (map){
    map.eachLayer(l=>{
      if(!(l instanceof L.TileLayer)){
        try{ map.removeLayer(l);}catch(_){}
      }
    });
  }
  // Küçük özet / scale bar
  const rs = document.querySelector(`#map-bottom-controls-day${day} .route-summary-control`);
  if (rs) rs.innerHTML = '';
  const scaleSmall = document.getElementById(`route-scale-bar-day${day}`);
  if (scaleSmall){ scaleSmall.innerHTML=''; delete scaleSmall.dataset?.elevLoadedKey; }
  // Expanded açık ise
  const expObj = window.expandedMaps && window.expandedMaps[key];
  if (expObj && expObj.expandedMap){
    const eMap = expObj.expandedMap;
                eMap.eachLayer(l=>{
              if (
                l instanceof L.Marker ||
                l instanceof L.Polyline ||
                l instanceof L.Circle ||
                l instanceof L.CircleMarker
              ) {
                try { eMap.removeLayer(l); } catch(_){}
              }
            });
    const expScale = document.getElementById(`expanded-route-scale-bar-day${day}`);
    if (expScale){ expScale.innerHTML=''; delete expScale.dataset?.elevLoadedKey; }
    const statsDiv = document.querySelector(`#expanded-map-${day} .route-stats`);
    if (statsDiv) statsDiv.innerHTML = '';
  }
}

function clearAllRouteCaches(){
  window.lastRouteGeojsons = {};
  window.lastRouteSummaries = {};
  window.pairwiseRouteSummaries = {};
  window.routeElevStatsByDay = {};
  if (window.__ttElevDayCache) window.__ttElevDayCache = {};
  // Tüm scale bar içlerini temizle
  document.querySelectorAll('.route-scale-bar').forEach(sb=>{
    sb.innerHTML='';
    delete sb.dataset?.elevLoadedKey;
  });
  // Haritalardan polyline / marker sil
  if (window.leafletMaps){
    Object.values(window.leafletMaps).forEach(m=>{
      try{
        m.eachLayer(l=>{
          if(!(l instanceof L.TileLayer)) m.removeLayer(l);
        });
      }catch(_){}
    });
  }
}

/* === EXPANDED MAP FULL CLEANUP (Eklenen) === */
function closeAllExpandedMapsAndReset() {
  if (window.expandedMaps) {
    Object.keys(window.expandedMaps).forEach(id => {
      const obj = window.expandedMaps[id];
      if (!obj) return;
      // Expanded Leaflet map temizle & kapat
      if (obj.expandedMap) {
        try {
          obj.expandedMap.eachLayer(l => {
            // SADECE marker, polyline, circle, circleMarker silinsin; tileLayer VEKTÖR zemin KALSIN!
            if (
              l instanceof L.Marker ||
              l instanceof L.Polyline ||
              l instanceof L.Circle ||
              l instanceof L.CircleMarker
            ) {
              try { obj.expandedMap.removeLayer(l); } catch(_){}
            }
          });
          try { obj.expandedMap.remove(); } catch(_){}
        } catch(_) {}
      }
      // Expanded container DOM’unu kaldır
      const cont = document.getElementById(`expanded-map-${obj.day}`);
      if (cont) cont.remove();
      // Orijinal küçük haritayı geri göster
      if (obj.originalContainer) {
        obj.originalContainer.style.display = '';
      }
      // Scale bar vs.
      const expScale = document.getElementById(`expanded-route-scale-bar-day${obj.day}`);
      if (expScale) expScale.remove();
    });
  }
  window.expandedMaps = {};
  // Her ihtimale karşı artakalan expanded container kalmadığından emin ol
  document.querySelectorAll('.expanded-map-container').forEach(el => el.remove());
}
/* === ROUTE CLEANUP HELPERS SONU === */
function createMapIframe(lat, lng, zoom = 16) {
    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
return '<div class="map-error">Invalid location information</div>';
    }

    const bboxPadding = 0.001;

    const baseUrl = `https://www.openstreetmap.org/export/embed.html`;
    const params = new URLSearchParams({
        bbox: `${lng - bboxPadding},${lat - bboxPadding},${lng + bboxPadding},${lat + bboxPadding}`,
        layer: 'mapnik',
        marker: `${lat},${lng}`,
        zoom: zoom,
        _: Date.now()
    });

    return `
     <div class="map-container">
    <div class="leaflet-map" id="${leafletMapId}" style="width:100%;height:250px;"></div>
  </div>`;
}


// 1) Reverse geocode: önce amenity (POI) dene, sonra building, sonra genel adres
async function getPlaceInfoFromLatLng(lat, lng) {
  const resp = await fetch(`/api/geoapify/reverse?lat=${lat}&lon=${lng}`);
  const data = await resp.json();
  const props = data?.features?.[0]?.properties || {};
  return {
    name: props.name || props.address_line1 || "Unnamed Place",
    address: props.formatted || "",
    opening_hours: props.opening_hours || "",
  };
}




function showRemoveConfirmation(day, dayContainerId, confirmationContainerId) {
    const dayItems = window.cart.filter(item => item.day == day && item.name !== undefined);
    const itemCount = dayItems.length;

    const confirmationContainer = document.getElementById(confirmationContainerId);
    confirmationContainer.innerHTML = `
        <p>Day ${day} contains ${itemCount} items. Are you sure you want to remove the day?</p>
        <div class="modal-actions">
            <button class="confirm-remove-btn" onclick="removeDayAction(${day}, '${dayContainerId}', '${confirmationContainerId}')">OK</button>
            <button class="cancel-action-btn" onclick="hideConfirmation('${confirmationContainerId}')">Cancel</button>
        </div>
    `;
    confirmationContainer.style.display = "block";
}

function showResetConfirmation(day, confirmationContainerId) {
    const dayItems = window.cart.filter(item => item.day == day && item.name !== undefined);
    const itemCount = dayItems.length;
    const confirmationContainer = document.getElementById(confirmationContainerId);
    confirmationContainer.innerHTML = `
        <p>Day ${day} contains ${itemCount} items. Are you sure you want to reset all items?</p>
        <div class="modal-actions">
            <button class="confirm-reset-btn" onclick="resetDayAction(${day}, '${confirmationContainerId}')">OK</button>
            <button class="cancel-action-btn" onclick="hideConfirmation('${confirmationContainerId}')">Cancel</button>
        </div>
    `;
    confirmationContainer.style.display = "block";
}

function removeDayAction(day, dayContainerId, confirmationContainerId) {
    const dayContainer = document.getElementById(dayContainerId);
    const confirmationContainer = document.getElementById(confirmationContainerId);
    dayContainer.remove();

    window.cart = window.cart.filter(item => item.day != day);

window.cart.forEach(item => {
    if (item.day > day) {
        item.day = item.day - 1;
    }
});

    reInitMaps();
    updateCart();
    hideConfirmation(confirmationContainerId);
}

function hideConfirmation(confirmationContainerId) {
    const confirmationContainer = document.getElementById(confirmationContainerId);
    if (confirmationContainer) {
        confirmationContainer.style.display = "none";
    }
}

// Kullanıcı yeni gün oluşturduğunda, oluşturulan günü currentDay olarak ata.
function addNewDay(button) {
    // 1. Mevcut en yüksek gün sayısını bul
    let maxDay = 1;
    if (Array.isArray(window.cart) && window.cart.length > 0) {
        window.cart.forEach(item => {
            if (typeof item.day === "number" && item.day > maxDay) {
                maxDay = item.day;
            }
        });
    }

    // === 10 GÜN LİMİT KONTROLÜ (YENİ EKLENEN KISIM) ===
    if (maxDay >= 10) {
        // Eğer fonksiyona buton öğesi gönderildiyse görselini değiştir
        if (button) {
            button.innerHTML = "Max 10 Days Reached 😮";
            button.disabled = true;
            button.style.opacity = "0.6";
            button.style.cursor = "not-allowed";
            button.style.color = "#e66a6a";
        }
        console.log("Max day limit (10) reached. Cannot add more.");
        return; // Fonksiyondan çık, 11. günü ekleme
    }
    // ==================================================

    const newDay = maxDay + 1;

    // 2. Önceki günün son geçerli lokasyonunu bul
    let lastMarkerOfPrevDay = null;
    for (let i = window.cart.length - 1; i >= 0; i--) {
        const item = window.cart[i];
        if (item.day === maxDay && item.location && 
            typeof item.location.lat === 'number' && 
            !isNaN(item.location.lat)) {
            lastMarkerOfPrevDay = item;
            break; 
        }
    }

    // 3. Kopyalama ve Ekleme
    if (lastMarkerOfPrevDay) {
        const newItem = JSON.parse(JSON.stringify(lastMarkerOfPrevDay));
        newItem.day = newDay;
        newItem.addedAt = new Date().toISOString();
        delete newItem._starter; // Starter flag'ini temizle
        window.cart.push(newItem);
    } else {
        window.cart.push({ day: newDay });
    }

    window.currentDay = newDay;
    
    // Arayüzü güncelle
    if (typeof updateCart === "function") updateCart();

    // 4. HARİTA ODAKLAMA DÜZELTMESİ
    if (lastMarkerOfPrevDay) {
        setTimeout(() => {
            const mapId = `route-map-day${newDay}`;
            const mapDiv = document.getElementById(mapId);
            
            // A) Haritayı görünür yap
            if (mapDiv) {
                mapDiv.style.display = 'block';
                mapDiv.style.height = '285px';
            }

            // B) Kontrolleri aç
            const controlsWrapper = document.getElementById(`map-bottom-controls-wrapper-day${newDay}`);
            if (controlsWrapper) controlsWrapper.style.display = 'block';

            // C) Haritayı çizdir
            if (typeof renderRouteForDay === 'function') {
                renderRouteForDay(newDay);
            }

            // D) GARANTİ ODAKLAMA
            setTimeout(() => {
                const mapInstance = window.leafletMaps && window.leafletMaps[mapId];
                if (mapInstance && lastMarkerOfPrevDay.location) {
                    mapInstance.invalidateSize(); 
                    
                    mapInstance.setView(
                        [lastMarkerOfPrevDay.location.lat, lastMarkerOfPrevDay.location.lng], 
                        14, 
                        { animate: false }
                    );
                }
            }, 150); 

        }, 250); 
    }
}

function addCoordinatesToContent() {
    document.querySelectorAll('.travel-item').forEach(item => {
        const contentDiv = item.querySelector('.content');
        const index = item.getAttribute('data-index');
        const cartItem = window.cart[index];
       
    });
}


function addNumberedMarkers(map, points) {
    if (!map || !points || !Array.isArray(points)) return;

    // Hatalı koordinatları filtrele
    points = points.filter(item => item && isFinite(item.lat) && isFinite(item.lng));

    points.forEach((item, idx) => {
        const label = `${idx + 1}. ${item.name || "Point"}`;

        const markerHtml = `
            <div style="
                background:#d32f2f;
                color:#fff;
                border-radius:50%;
                width:24px;height:24px;
                display:flex;align-items:center;justify-content:center;
                font-weight:bold;font-size:16px;
                border:2px solid #fff;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                cursor: pointer;
            ">${idx + 1}</div>`;
        
        const icon = L.divIcon({
            html: markerHtml,
            className: "", // Leaflet default stilini ezer
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        // Marker'ı oluştur
        const marker = L.marker([item.lat, item.lng], { icon }).addTo(map);
        
        // --- DÜZELTME BURADA YAPILDI (offset eklendi) ---
        marker.bindPopup(`<b>${label}</b>`, {
            offset: [0, -20]  // Baloncuğu 20px yukarı taşır
        });
        // ------------------------------------------------

        // Tıklama olayları
        marker.on('click', function() {
            // Haritayı bu noktaya ortala (Zoom seviyesini koru)
            map.flyTo([item.lat, item.lng], map.getZoom(), {
                animate: true,
                duration: 0.5
            });
            // Popup'ı açmayı garantile
            marker.openPopup();
        });
    });
}

async function renderLeafletRoute(containerId, geojson, points = [], summary = null, day = 1, missingPoints = []) {
    // Eğer bu container'da zaten aktif bir harita varsa, önce onu temizle
    if (window.leafletMaps && window.leafletMaps[containerId]) {
        try {
            window.leafletMaps[containerId].remove();
            delete window.leafletMaps[containerId];
        } catch (e) { console.warn("Harita temizlenemedi:", e); }
    }
    // 1. KÜTÜPHANE KONTROLÜ
    if (typeof L === 'undefined') {
        setTimeout(() => renderLeafletRoute(containerId, geojson, points, summary, day, missingPoints), 100);
        return;
    }

    const sidebarContainer = document.getElementById(containerId);
    if (!sidebarContainer) return;

    // 2. TEMİZLİK
    if (sidebarContainer._resizeObserver) {
        sidebarContainer._resizeObserver.disconnect();
        delete sidebarContainer._resizeObserver;
    }

    if (window.leafletMaps && window.leafletMaps[containerId]) {
        const oldMap = window.leafletMaps[containerId];
        if (oldMap._fallbackTimer) clearTimeout(oldMap._fallbackTimer);
        
        if (oldMap._maplibreLayer) {
            try { oldMap.removeLayer(oldMap._maplibreLayer); } catch (e) {}
        }
        try {
            oldMap.off();
            oldMap.remove();
        } catch (e) {}
        delete window.leafletMaps[containerId];
    }

    // 3. DOM HAZIRLIĞI
    sidebarContainer.innerHTML = "";
    sidebarContainer.style.height = "285px";
    sidebarContainer.classList.remove("big-map", "full-screen-map");
    sidebarContainer.style.backgroundColor = "#eef0f5";

    // 4. ALT KONTROLLER
    const controlsWrapperId = `map-bottom-controls-wrapper-day${day}`;
    document.getElementById(controlsWrapperId)?.remove();

    const controlsWrapper = document.createElement("div");
    controlsWrapper.id = controlsWrapperId;

    const controlRow = document.createElement("div");
    controlRow.id = `map-bottom-controls-day${day}`;
    controlRow.className = "map-bottom-controls";

    const infoDiv = document.createElement("span");
    infoDiv.className = "route-summary-control";
    if (summary) {
        infoDiv.innerHTML =
            `<span class="stat stat-distance">
                <img class="icon" src="/img/way_distance.svg" alt="Distance" loading="lazy" decoding="async">
                <span class="badge">${(summary.distance / 1000).toFixed(1)} km</span>
            </span>
            <span class="stat stat-duration">
                <img class="icon" src="/img/way_time.svg" alt="Duration" loading="lazy" decoding="async">
                <span class="badge">${Math.round(summary.duration / 60)} min</span>
            </span>`;
    }
    controlRow.appendChild(infoDiv);
    controlsWrapper.appendChild(controlRow);
    sidebarContainer.parentNode.insertBefore(controlsWrapper, sidebarContainer.nextSibling);

    ensureDayTravelModeSet(day, sidebarContainer, controlsWrapper);

    // 5. HARİTA BAŞLATMA
    const map = L.map(containerId, {
        scrollWheelZoom: false, // Kapalı
        dragging: false,        // Kapalı
        touchZoom: false,       // Kapalı
        doubleClickZoom: false, // Kapalı
        boxZoom: false,         // Kapalı
        zoomControl: false,     // Butonları kaldır
        fadeAnimation: true,
        zoomAnimation: true,
        markerZoomAnimation: true,
        inertia: false,
        zoomSnap: 0,                
        zoomDelta: 0.1,
        attributionControl: false // Alt logoyu gizle
    });

    // Mobilde harita üzerinden sayfanın kaymasını sağlar
    map.dragging.disable();
    if (map.tap) map.tap.disable(); // iOS ve bazı Android cihazlar için kritik

    // Harita katmanlarının dokunmatik olayları yakalamasını engelle
    const mapElement = document.getElementById(containerId);
    mapElement.addEventListener('touchstart', (e) => {
        // Eğer tıklanan şey bir marker değilse, olayı yukarı (sayfaya) sal
        if (!e.target.closest('.leaflet-marker-icon')) {
            return true; 
        }
    }, { passive: true });

    try {
        map.createPane('customRoutePane');
        map.getPane('customRoutePane').style.zIndex = 450;
    } catch (e) {}

    // --- TILE LAYER YÖNETİMİ ---
    let layerSuccess = false;

    // Fallback Fonksiyonu: OpenFreeMap'i öldürür, CartoDB'yi açar
    const loadCartoDB = () => {
        // Eğer başarılı işaretlendiyse asla Carto'ya geçme
        if (layerSuccess) return;

        // Varsa MapLibre katmanını temizle
        if (map._maplibreLayer) {
            try { map.removeLayer(map._maplibreLayer); } catch(e){}
            map._maplibreLayer = null;
        }

        // CartoDB Ekle (Resim tabanlı)
        try {
            // Zaten ekliyse tekrar ekleme
            let hasCarto = false;
            map.eachLayer(l => { if (l._url && l._url.includes('cartocdn')) hasCarto = true; });
            
            if (!hasCarto) {
                L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; CARTO',
                    subdomains: 'abcd',
                    maxZoom: 20
                }).addTo(map);
            }
        } catch (err) {}
    };

    // OpenFreeMap Başlatma
    if (typeof L.maplibreGL === 'function') {
        try {
            const glLayer = L.maplibreGL({
                style: 'https://tiles.openfreemap.org/styles/bright',
                attribution: '&copy; OpenFreeMap',
                // [KRİTİK DÜZELTME] Alt zeminin kaymasını engelleyen satır:
                interactive: false 
            });

            glLayer.addTo(map);
            map._maplibreLayer = glLayer;

            // Başarı fonksiyonu: Çağrıldığı an CartoDB ihtimalini yok eder
            const markAlive = () => {
                if (layerSuccess) return;
                layerSuccess = true;
                if (map._fallbackTimer) {
                    clearTimeout(map._fallbackTimer);
                    map._fallbackTimer = null;
                }
            };

            // Layer hazır olduğunda map instance'ını al ve dinle
            glLayer.on('ready', () => {
                const glMap = glLayer.getMaplibreMap();
                if (glMap) {
                    // Harita zaten yüklüyse (cache vb.) direkt işaretle
                    if (glMap.loaded()) markAlive();

                    // Veri akışını dinle
                    glMap.on('load', markAlive);
                    glMap.on('data', markAlive);      // Herhangi bir veri geldiğinde
                    glMap.on('tileload', markAlive);  // Tile yüklendiğinde
                    glMap.on('styledata', markAlive); // Stil yüklendiğinde
                }
            });

            // --- ZAMAN AŞIMI KONTROLÜ (4 Saniye) ---
            map._fallbackTimer = setTimeout(() => {
                // Süre doldu. Ama harita gerçekten başarısız mı?
                const glMap = glLayer.getMaplibreMap();
                
                // KONTROL: MapLibre objesi var mı ve 'loaded' durumda mı?
                // VEYA: Canvas dolu mu (pixel var mı)?
                const canvas = map.getContainer().querySelector('canvas');
                const visuallyLoaded = canvas && canvas.width > 0 && canvas.height > 0;
                const internalLoaded = glMap && glMap.loaded();

                if (internalLoaded || visuallyLoaded) {
                    // Harita aslında çalışıyor, kod sinyali kaçırmış.
                    // CartoDB'ye geçme, OpenFreeMap'te kal.
                    markAlive();
                } else {
                    // Gerçekten yüklenmemiş.
                    console.warn(`[SmallMap] OpenFreeMap failed to load (4s). Fallback to CartoDB.`);
                    loadCartoDB();
                }
            }, 4000);

        } catch (e) {
            console.error("MapLibre error:", e);
            loadCartoDB();
        }
    } else {
        // Kütüphane yoksa direkt CartoDB
        loadCartoDB();
    }
    let bounds = L.latLngBounds();
    points = points.filter(p => isFinite(Number(p.lat)) && isFinite(Number(p.lng)));

    let routeCoords = [];
    let hasValidGeo = (geojson && geojson.features && geojson.features[0]?.geometry?.coordinates?.length > 1);
    if (hasValidGeo) {
        routeCoords = geojson.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
    }

    if (points.length === 1) {
        // --- SENARYO 1: TEK NOKTA VARSA ---
        const marker = L.marker([points[0].lat, points[0].lng], {
            icon: L.divIcon({
                html: `<div style="cursor:pointer;background:#d32f2f;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;border:2px solid #fff;box-shadow: 0 2px 8px rgba(0,0,0,0.2);">1</div>`,
                className: "",
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            })
        }).addTo(map);
        
        marker.bindPopup(points[0].name || "Point", {
            autoPan: false,           // Haritanın kaymasını engeller
            closeButton: false,       // Daha temiz görünüm için opsiyonel
            offset: L.point(0, -10)   // Popup'ı marker'ın biraz üzerine taşır
        });

        // +++ [FIX] TEK NOKTA TIKLAMA OLAYI +++
        marker.on('click', function() {
            map.flyTo([points[0].lat, points[0].lng], 14, {
                animate: true,
                duration: 0.5
            });
            marker.openPopup();
        });
        
    } else if (points.length >= 1) {
        // --- SENARYO 2: BİRDEN FAZLA NOKTA VARSA ---
        const isFlyMode = !areAllPointsInTurkey(points);

        if (isFlyMode) {
            window._curvedArcPointsByDay = window._curvedArcPointsByDay || {};
            let arcPoints = [];
            for (let i = 0; i < points.length - 1; i++) {
                const start = [points[i].lng, points[i].lat];
                const end = [points[i + 1].lng, points[i + 1].lat];
                const curve = getCurvedArcCoords(start, end);
                arcPoints = arcPoints.concat(curve);
                drawCurvedLine(map, points[i], points[i + 1], {
                    color: "#1976d2",
                    weight: 5,
                    opacity: 0.85,
                    dashArray: "6,8",
                    pane: 'customRoutePane'
                });
            }
            points.forEach(p => bounds.extend([p.lat, p.lng]));
            window._curvedArcPointsByDay[day] = arcPoints;
        } else if (hasValidGeo && routeCoords.length > 1) {
            // Ana Rota
            const routePoly = L.polyline(routeCoords, {
                color: '#1976d2',
                weight: 8,
                opacity: 0.92,
                interactive: true,
                pane: 'customRoutePane'
            }).addTo(map);
            bounds.extend(routePoly.getBounds());

            // --- MISSING POINTS (Kırmızı/Gri Kesik Çizgi) ---
            if (missingPoints && missingPoints.length > 0 && routeCoords.length > 1) {
                missingPoints.forEach((mp) => {
                    let minDist = Infinity;
                    let closestPoint = null;
                    
                    // 1. Önce rota noktaları arasında en yakını bul
                    for (const rc of routeCoords) {
                        const [lat, lng] = rc;
                        const d = haversine(lat, lng, mp.lat, mp.lng);
                        if (d < minDist) {
                            minDist = d;
                            closestPoint = { lat, lng };
                        }
                    }
                    
                    // 2. Segmentler üzerinde daha iyi bir nokta ara (opsiyonel ama daha doğru)
                    let betterPoint = null;
                    for (let i = 0; i < routeCoords.length - 1; i++) {
                        const [lat1, lng1] = routeCoords[i];
                        const [lat2, lng2] = routeCoords[i + 1];
                        
                        const closestOnSegment = findClosestPointOnSegment(
                            mp.lat, mp.lng,
                            lat1, lng1,
                            lat2, lng2
                        );
                        
                        const d = haversine(mp.lat, mp.lng, closestOnSegment.lat, closestOnSegment.lng);
                        if (d < minDist) {
                            minDist = d;
                            betterPoint = closestOnSegment;
                        }
                    }
                    
                    // Daha iyi bir nokta bulunduysa onu kullan
                    if (betterPoint) {
                        closestPoint = betterPoint;
                    }
                    
                    if (closestPoint) {
                        L.polyline(
                            [
                                [mp.lat, mp.lng],
                                [closestPoint.lat, closestPoint.lng]
                            ],
                            {
                                color: '#d32f2f',
                                weight: 3,
                                opacity: 0.7,
                                dashArray: '5, 8',
                                pane: 'customRoutePane'
                            }
                        ).addTo(map).bindTooltip(
                            `${mp.name || 'Missing point'}: ${Math.round(minDist)}m from route`,
                            { permanent: false, direction: 'top' }
                        );
                        
                        // Eksik noktayı da işaretleyelim (kırmızı daire)
                        L.circleMarker([mp.lat, mp.lng], {
                            radius: 6,
                            color: '#d32f2f',
                            fillColor: '#d32f2f',
                            fillOpacity: 0.7,
                            weight: 2
                        }).addTo(map).bindPopup(`<b>${mp.name || 'Missing point'}</b><br>Not included in route`, {
                            autoPan: false
                        });
                    }
                });
            }

        } else {
            const fallbackCoords = points.map(p => [p.lat, p.lng]);
            const fallbackPoly = L.polyline(fallbackCoords, {
                color: '#1976d2',
                weight: 6,
                opacity: 0.7,
                dashArray: "5, 10",
                pane: 'customRoutePane'
            }).addTo(map);
            bounds.extend(fallbackPoly.getBounds());
        }

        // Markerları ekle
        // (Eğer addNumberedMarkers fonksiyonun da güncelse, buradaki markerlar da tıklayınca ortalanır)
        addNumberedMarkers(map, points);

        if (!bounds.isValid() && points.length > 0) {
            points.forEach(p => bounds.extend([p.lat, p.lng]));
        }
    } else {
        map.setView([0, 0], 2, { animate: false });
    }

    wrapRouteControls(day);
    map._originalBounds = (bounds && bounds.isValid()) ? bounds : null;

    window.leafletMaps[containerId] = map;

  // --- GÜVENLİ ODAKLAMA ---
   const refitMap = () => {
        // 1. Harita ve Container var mı?
        if (!map || !sidebarContainer) return;
        
        // 2. Container gerçekten sayfaya bağlı mı? (isConnected kontrolü)
        const container = map.getContainer();
        if (!container || !container.isConnected) return;

        // 3. Görünürlük kontrolü
        if (sidebarContainer.offsetParent === null) return;

        try {
            // [FIX] Sadece harita 'hazırsa' boyut yenile
            if (map._mapPane) { 
                map.invalidateSize(); 
            }

            if (points.length === 1) {
                map.setView([points[0].lat, points[0].lng], 14, { animate: false });
            } else if (bounds && bounds.isValid()) {
                // [FIX] Mobilde markerların köşeye yapışmaması için padding'i artırdık
                const isMobile = window.innerWidth <= 768;
                map.fitBounds(bounds, { padding: isMobile ? [40, 40] : [20, 20], animate: false });
            }
        } catch (err) {
            // Sessizce geç, konsolu kirletme
        }
    };

    requestAnimationFrame(refitMap);
    setTimeout(refitMap, 250);

    const ro = new ResizeObserver(() => { requestAnimationFrame(refitMap); });
    ro.observe(sidebarContainer);
    sidebarContainer._resizeObserver = ro;
    
    // Popup kapandığında haritayı ilk haline (rota odaklı) geri döndür
    map.on('popupclose', function() {
        if (map._originalBounds) {
            map.fitBounds(map._originalBounds, { 
                padding: window.innerWidth <= 768 ? [40, 40] : [20, 20], 
                animate: true 
            });
        }
    });

    const is3DActive = document.getElementById('maplibre-3d-view') &&
        document.getElementById('maplibre-3d-view').style.display !== 'none';

    if (is3DActive && window._maplibre3DInstance) {
        if (window.currentDay === day) {
            refresh3DMapData(day);
            setTimeout(() => { refresh3DMapData(day); }, 150);
        }
    }
}
// Harita durumlarını yönetmek için global değişken
window.mapStates = {};

// Harita durumlarını yönetmek için global değişken
window.expandedMaps = {};
// Güncellenmiş expandMap fonksiyonu: YÜKSEKLİK/ELEVATION ile ilgili her şey kaldırıldı!

function findClosestPointOnSegment(px, py, x1, y1, x2, y2) {
    // Noktanın segment üzerindeki izdüşümünü bul
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) {
        param = dot / lenSq;
    }
    
    let xx, yy;
    
    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }
    
    return { lat: xx, lng: yy };
}
function getFallbackRouteSummary(points) {
  if (!points || points.length < 2) return { distance: 0, duration: 0 };
  let totalKm = 0;
  for (let i = 1; i < points.length; i++) {
    totalKm += haversine(points[i-1].lat, points[i-1].lng, points[i].lat, points[i].lng) / 1000;
  }
  // Sabit yürüyüş hızı (örnek: 4 km/h)
  const duration = Math.round(totalKm / 4 * 3600); // saniye
  return {
    distance: Math.round(totalKm * 1000),
    duration: duration
  };
}

function updateRouteStatsUI(day) {
  const key = `route-map-day${day}`;
  let summary = window.lastRouteSummaries?.[key] || null;

  // YENI PATCH: FLY MODE'da veya summary eksikse/hatalıysa fallback ile doldur
  // (bu satır: profile veya travel mode mantığından bağımsız)
  if (!summary ||
      typeof summary.distance !== "number" ||
      typeof summary.duration !== "number" ||
      isNaN(summary.distance) ||
      isNaN(summary.duration) ||
      !areAllPointsInTurkey(getDayPoints(day))
     ) {
    // Sadece haversine ile km/dk ver, profil değişmiyor!
    const points = getDayPoints(day);
    summary = getFallbackRouteSummary(points);
    window.lastRouteSummaries[key] = summary;
  }

  const distanceKm = (summary.distance / 1000).toFixed(2);
  const durationMin = Math.round(summary.duration / 60);

  const routeSummarySpan = document.querySelector(`#map-bottom-controls-day${day} .route-summary-control`);
  if (routeSummarySpan) {
  routeSummarySpan.querySelector('.stat-distance .badge').textContent = distanceKm + " km";
  routeSummarySpan.querySelector('.stat-duration .badge').textContent = durationMin + " min";
  // Ascent/descent badge ekle
  const elev = window.routeElevStatsByDay?.[day] || {};
  if (routeSummarySpan.querySelector('.stat-ascent .badge'))
    routeSummarySpan.querySelector('.stat-ascent .badge').textContent = (typeof elev.ascent === "number" ? elev.ascent + " m" : "— m");
  if (routeSummarySpan.querySelector('.stat-descent .badge'))
    routeSummarySpan.querySelector('.stat-descent .badge').textContent = (typeof elev.descent === "number" ? elev.descent + " m" : "— m");
}
}

 function getTotalKmFromMarkers(markers) {
  let totalKm = 0;
  for (let i = 1; i < markers.length; i++) {
    if (markers[i-1].lat && markers[i-1].lng && markers[i].lat && markers[i].lng) {
      totalKm += haversine(markers[i-1].lat, markers[i-1].lng, markers[i].lat, markers[i].lng) / 1000;
    }
  }
  return totalKm;
}


// [lng, lat] formatında girdi alır, [lng, lat] dizisi döndürür
function getCurvedArcCoords(start, end) {
    const lon1 = start[0];
    const lat1 = start[1];
    const lon2 = end[0];
    const lat2 = end[1];

    const offsetX = lon2 - lon1;
    const offsetY = lat2 - lat1;
    
    // İki nokta arası mesafe ve açı
    const r = Math.sqrt(Math.pow(offsetX, 2) + Math.pow(offsetY, 2));
    const theta = Math.atan2(offsetY, offsetX);
    
    // --- SABİT ORAN: KÜÇÜK HARİTA İLE BİREBİR AYNI ---
    // (Math.PI / 10) değeri küçük haritadaki drawCurvedLine ile aynıdır.
    const thetaOffset = (Math.PI / 10); 
    // -------------------------------------------------
    
    const r2 = (r / 2.0) / Math.cos(thetaOffset);
    const theta2 = theta + thetaOffset;
    
    const controlX = (r2 * Math.cos(theta2)) + lon1;
    const controlY = (r2 * Math.sin(theta2)) + lat1;
    
    const coords = [];
    // 20 adımda çizim (0.05 artış)
    for (let t = 0; t < 1.01; t += 0.05) {
        const x = (1 - t) * (1 - t) * lon1 + 2 * (1 - t) * t * controlX + t * t * lon2;
        const y = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * controlY + t * t * lat2;
        coords.push([x, y]); 
    }
    return coords;
}

// Yay noktalarını kaydetmek için yardımcı fonksiyon
function saveArcPointsForDay(day, points) {
    if (!window._curvedArcPointsByDay) {
        window._curvedArcPointsByDay = {};
    }
    window._curvedArcPointsByDay[day] = points;
}
function refresh3DMapData(day) {
    const map = window._maplibre3DInstance;
    if (!map || !map.getStyle()) return;

    // --- 0. CSS DÜZELTMELERİ (KESİN ÇÖZÜM) ---
    // Bu stil bloğu, animasyon sırasında markerın kaymasını engeller.
    if (!document.getElementById('tt-3d-perfect-style')) {
        const s = document.createElement('style');
        s.id = 'tt-3d-perfect-style';
        s.innerHTML = `
            /* Hem ORTALA hem DÖNDÜR (Kaymayı önleyen kilit nokta burası) */
            @keyframes spin-centered {
                0% { transform: translate(-50%, -50%) rotate(0deg); }
                100% { transform: translate(-50%, -50%) rotate(360deg); }
            }

            /* Markerın kendisi (2D'deki boyutları koruması için inline width vermiyoruz) */
            .tt-3d-marker-visual {
                position: absolute;
                left: 50%; 
                top: 50%;
                /* Başlangıçta sadece ortala */
                transform: translate(-50%, -50%); 
                cursor: pointer;
                z-index: 10;
            }

            /* Popup stilleri (Senin istediğin 2D görünüm) */
            .tt-3d-custom-popup {
                position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%);
                background: #fff; border-radius: 12px; padding: 10px 14px; min-width: 130px;
                text-align: center; pointer-events: auto; z-index: 100;
                display: flex; flex-direction: column; gap: 6px;
                box-shadow: 0 3px 14px rgba(0,0,0,0.4);
            }
            .tt-3d-custom-popup::after {
                content: ''; position: absolute; bottom: -6px; left: 50%; margin-left: -6px;
                border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 6px solid #fff;
            }
            .tt-3d-popup-close {
                position: absolute; top: 4px; right: 6px; color: #ccc; font-size: 16px; 
                font-weight: bold; cursor: pointer; background: none; border: none; padding: 0; line-height: 1;
            }
            
            /* Siyah İpucu */
            .tt-3d-drag-hint-box {
                position: absolute; bottom: 110px; left: 50%; transform: translateX(-50%);
                background: #111; color: #fff; padding: 6px 12px; border-radius: 8px;
                font-size: 12px; font-weight: 700; white-space: nowrap; z-index: 101; pointer-events: none;
                box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            }
            .tt-3d-drag-hint-box::after {
                content: ''; position: absolute; bottom: -5px; left: 50%; margin-left: -5px;
                border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 5px solid #111;
            }
        `;
        document.head.appendChild(s);
    }

    // --- 1. VERİ HAZIRLIĞI ---
    const points = (typeof getDayPoints === 'function' ? getDayPoints(day) : []);
    const containerId = `route-map-day${day}`;
    let routeCoords = [];
    const geojson = window.lastRouteGeojsons && window.lastRouteGeojsons[containerId];
    if (geojson && geojson.features && geojson.features[0]?.geometry?.coordinates) {
        routeCoords = geojson.features[0].geometry.coordinates;
    }
    const validPoints = points.filter(p => isFinite(p.lat) && isFinite(p.lng));
    const isFlyMode = !areAllPointsInTurkey(validPoints);

    console.log(`[3D FORCE] Refreshing Day ${day}. Points: ${validPoints.length}`);

    // --- 2. TEMİZLİK ---
    if (window._maplibreRouteMarkers) window._maplibreRouteMarkers.forEach(m => m.remove());
    window._maplibreRouteMarkers = [];

    // Clean up location markers from 3D map
if (window.userLocationMarkersByDay && window.userLocationMarkersByDay[day]) {
    window.userLocationMarkersByDay[day].forEach(m => {
        try { m.remove(); } catch(e) {}
    });
    window.userLocationMarkersByDay[day] = [];
}

    ['route-line', 'missing-connectors-layer'].forEach(l => { if(map.getLayer(l)) map.removeLayer(l); });
    ['route-source-dynamic', 'missing-connectors-source'].forEach(s => { if(map.getSource(s)) map.removeSource(s); });

    const style = map.getStyle();
    if (style && style.layers) {
        style.layers.forEach(l => { if (l.id.startsWith('flyroute-line-')) map.removeLayer(l.id); });
        Object.keys(style.sources).forEach(k => { if (k.startsWith('flyroute-')) map.removeSource(k); });
    }

    // --- 3. ROTA ---
    const scaleBar = document.getElementById(`expanded-route-scale-bar-day${day}`);
    if (scaleBar) scaleBar._routeCache = null;

    if (!isFlyMode) {
        if (window._curvedArcPointsByDay) window._curvedArcPointsByDay[day] = null;
        let finalGeoJSON = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeCoords } };
        if (routeCoords.length < 2 && validPoints.length > 1) finalGeoJSON.geometry.coordinates = validPoints.map(p => [p.lng, p.lat]);
        if (finalGeoJSON.geometry.coordinates.length > 1) {
            map.addSource('route-source-dynamic', { type: 'geojson', data: finalGeoJSON });
            map.addLayer({
                id: 'route-line', type: 'line', source: 'route-source-dynamic',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': '#1976d2', 'line-width': 8, 'line-opacity': 0.9 }
            });
            const connectorLines = [];
            validPoints.forEach(p => {
                let minDist = Infinity, closestPoint = null;
                for (const rc of finalGeoJSON.geometry.coordinates) {
                    const dSq = (rc[1] - p.lat)**2 + (rc[0] - p.lng)**2;
                    if (dSq < minDist) { minDist = dSq; closestPoint = rc; }
                }
                if (closestPoint && minDist > 0.0000005) connectorLines.push([[p.lng, p.lat], closestPoint]);
            });
            if (connectorLines.length > 0) {
                map.addSource('missing-connectors-source', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: connectorLines } } });
                map.addLayer({ id: 'missing-connectors-layer', type: 'line', source: 'missing-connectors-source', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#d32f2f', 'line-width': 3, 'line-dasharray': [2, 2], 'line-opacity': 0.7 } });
            }
        }
    } else {
        let allCurvePoints = [];
        if (validPoints.length > 1) {
            for (let i = 0; i < validPoints.length - 1; i++) {
                const start = [validPoints[i].lng, validPoints[i].lat], end = [validPoints[i+1].lng, validPoints[i+1].lat];
                const curveCoords = (typeof getCurvedArcCoords === 'function') ? getCurvedArcCoords(start, end) : [start, end];
                allCurvePoints = allCurvePoints.concat(curveCoords);
                const sId = `flyroute-${i}`, lId = `flyroute-line-${i}`;
                map.addSource(sId, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: curveCoords } } });
                map.addLayer({ id: lId, type: 'line', source: sId, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#1976d2', 'line-width': 6, 'line-opacity': 0.8, 'line-dasharray': [1, 2] } });
            }
            if (!window._curvedArcPointsByDay) window._curvedArcPointsByDay[day] = {};
            window._curvedArcPointsByDay[day] = allCurvePoints;
        }
    }

    // ============================================================
    // --- 4. MARKER OLUŞTURMA (DOĞRU YÖNTEM) ---
    // ============================================================

    function resetAll3DMarkersState() {
        window._maplibreRouteMarkers.forEach(m => {
            m.setDraggable(false); 
            const root = m.getElement();
            const outer = root.querySelector('.custom-marker-outer'); // Görsel
            const popup = root.querySelector('.tt-3d-custom-popup');
            const hint = root.querySelector('.tt-3d-drag-hint-box');
            
            if (outer) {
                // Görseli resetle: Animasyonu durdur, rengi kırmızı yap
                outer.classList.remove('green', 'spin', 'show-drag-hint'); 
                outer.classList.add('red');
                outer.style.animation = 'none'; // Animasyonu sil
                outer.style.backgroundColor = ''; // Rengi sil (class'a dön)
            }
            if (popup) {
                popup.style.opacity = '0';
                popup.style.visibility = 'hidden';
            }
            if (hint) hint.style.display = 'none';
            root.style.zIndex = '10';
        });
    }

    validPoints.forEach((p, idx) => {
        // --- 1. ROOT ELEMENT ---
        // MapLibre bunu konumlandırır. 0x0 boyutunda.
        const rootEl = document.createElement('div');
        rootEl.className = 'maplibre-marker-root';
        rootEl.style.width = '0px'; rootEl.style.height = '0px';
        rootEl.style.cursor = 'pointer'; rootEl.style.zIndex = '10';

        // --- 2. HTML YAPISI ---
        // 'tt-3d-marker-visual' class'ı önemlidir. Hem 'absolute center' yapar hem de animasyonda bunu korur.
        rootEl.innerHTML = `
            <div class="custom-marker-outer red tt-3d-marker-visual" data-idx="${idx}">
                <span class="custom-marker-label">${idx + 1}</span>
                <div class="drag-hint">
                    <span class="arrow up"></span><span class="arrow right"></span><span class="arrow down"></span><span class="arrow left"></span>
                </div>
            </div>

            <div class="tt-3d-drag-hint-box" style="display:none;">Drag to reposition</div>

            <div class="tt-3d-custom-popup" style="opacity:0; visibility:hidden;">
                <button class="tt-3d-popup-close">×</button>
                <div style="font-weight:700; color:#333; font-size:14px; margin-top:4px;">${p.name || "Point"}</div>
                <button class="tt-3d-remove-btn" data-marker-idx="${idx}" style="
                    background:#f8f9fa; color:#ff4444; border:none; border-radius:6px; 
                    padding:6px; font-weight:600; cursor:pointer; width:100%; margin-top:4px;">
                    Remove place
                </button>
            </div>
        `;

        const outerEl = rootEl.querySelector('.custom-marker-outer');
        const popupEl = rootEl.querySelector('.tt-3d-custom-popup');
        const hintEl = rootEl.querySelector('.tt-3d-drag-hint-box');
        const removeBtn = rootEl.querySelector('.tt-3d-remove-btn');
        const closeBtn = rootEl.querySelector('.tt-3d-popup-close');

        // Remove
        removeBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const cartIdx = findCartIndexByDayPosition(day, idx);
            if (cartIdx > -1) {
                window.cart.splice(cartIdx, 1);
                // if (typeof renderRouteForDay === "function") await renderRouteForDay(day);
                if (typeof updateCart === "function") await updateCart();
                if (typeof saveCurrentTripToStorage === "function") saveCurrentTripToStorage();
                refresh3DMapData(day);
            }
        });

        // Close X
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            resetAll3DMarkersState();
        });

        // MapLibre Marker
        const marker = new maplibregl.Marker({ element: rootEl, anchor: 'center', draggable: false })
            .setLngLat([p.lng, p.lat])
            .addTo(map);

        // --- TIKLAMA OLAYI ---
        // Doğrudan görsele tıklama
        outerEl.addEventListener('click', (e) => {
            e.stopPropagation();
            
            if (outerEl.classList.contains('green') && popupEl.style.opacity === '1') return;

            resetAll3DMarkersState();

            // 1. Görseli Aktifleştir (Renk)
            outerEl.classList.remove('red');
            outerEl.classList.add('green', 'show-drag-hint');
            
            // 2. Animasyon (KAYMAYI ÖNLEYEN KOD)
            // 'spin-centered' animasyonu içinde translate(-50%,-50%) var.
            outerEl.style.animation = 'spin-centered 1s linear infinite';

            // 3. Popup Göster
            popupEl.style.visibility = 'visible';
            popupEl.style.opacity = '1';

            // 4. Sürüklemeyi Aç
            marker.setDraggable(true);
            rootEl.style.zIndex = '999';
            rootEl.style.cursor = 'grab';

            // 5. İpucu
            hintEl.style.display = 'block';
            if (rootEl._hintTimer) clearTimeout(rootEl._hintTimer);
            rootEl._hintTimer = setTimeout(() => { hintEl.style.display = 'none'; }, 1500);

            if ('vibrate' in navigator) navigator.vibrate(15);
        });

        // --- DRAG EVENTS ---
        marker.on('dragstart', () => {
            popupEl.style.opacity = '0';
            popupEl.style.visibility = 'hidden';
            hintEl.style.display = 'none';
            rootEl.style.cursor = 'grabbing';
        });

        marker.on('dragend', async () => {
            rootEl.style.cursor = 'grab';
            popupEl.style.visibility = 'visible';
            popupEl.style.opacity = '1';
            
            const lngLat = marker.getLngLat();
            let finalLat = lngLat.lat, finalLng = lngLat.lng;

            try {
                if (typeof snapPointToRoad === 'function') {
                    const snapped = await snapPointToRoad(lngLat.lat, lngLat.lng);
                    finalLat = snapped.lat; finalLng = snapped.lng;
                }
            } catch(_) {}

            let newName = p.name, newAddress = "", newOpening = "";
            try {
                if (typeof getPlaceInfoFromLatLng === 'function') {
                    const info = await getPlaceInfoFromLatLng(lngLat.lat, lngLat.lng);
                    if (info.name) newName = info.name;
                    newAddress = info.address; newOpening = info.opening_hours;
                }
            } catch(_) {}

            const cartIdx = findCartIndexByDayPosition(day, idx);
            if (cartIdx > -1) {
                const item = window.cart[cartIdx];
                item.location.lat = lngLat.lat; item.location.lng = lngLat.lng;
                item.name = newName; item.address = newAddress || item.address;
                item.opening_hours = newOpening || item.opening_hours;
                if (window.selectedCity) {
                    try {
                        const img = await getImageForPlace(item.name, "Place", window.selectedCity);
                        if (img) item.image = img;
                    } catch(_){}
                }
            }

            window._lastSegmentDay = undefined;
            // if (typeof renderRouteForDay === "function") await renderRouteForDay(day);
            if (typeof updateCart === "function") updateCart();
            if (typeof saveCurrentTripToStorage === "function") saveCurrentTripToStorage();

            refresh3DMapData(day);
            
            const sbContainer = document.getElementById(`expanded-route-scale-bar-day${day}`);
            const summary = window.lastRouteSummaries?.[containerId];
            if (sbContainer && summary && summary.distance > 0) {
                const newMarkers = getRouteMarkerPositionsOrdered(day);
                const track = sbContainer.querySelector('.scale-bar-track');
                if (track) {
                    const w = Math.max(200, Math.round(track.getBoundingClientRect().width));
                    renderRouteScaleBar(sbContainer, summary.distance/1000, newMarkers);
                    createScaleElements(track, w, summary.distance/1000, 0, newMarkers);
                }
            }
        });
        
        window._maplibreRouteMarkers.push(marker);
    });

    map.once('click', () => { resetAll3DMarkersState(); });
}
function openMapLibre3D(expandedMap) {
  // DOM Elementlerini Bul
  let mapDiv = expandedMap.getContainer();
  let container = mapDiv.parentNode; 
  let panelDiv = container.querySelector('.expanded-map-panel'); 

  const leafletAttr = container.querySelector('.leaflet-control-attribution');
  if (leafletAttr) leafletAttr.style.display = 'none';

  let maplibre3d = document.getElementById('maplibre-3d-view');
  
  if (!maplibre3d) {
    maplibre3d = document.createElement('div');
    maplibre3d.id = 'maplibre-3d-view';
    maplibre3d.style.cssText = 'width:100%; height:480px; display:block; position:relative; z-index:1; background:#eef0f5;';
    if (panelDiv) { container.insertBefore(maplibre3d, panelDiv); } 
    else { container.appendChild(maplibre3d); }
  } else {
      maplibre3d.style.display = 'block';
      maplibre3d.style.height = '480px';
      maplibre3d.style.zIndex = '1'; 
  }
  maplibre3d.innerHTML = '';

  const day = window.currentDay || 1;
  const containerId = `route-map-day${day}`;
  
  const bounds = new maplibregl.LngLatBounds();
  let hasBounds = false;
  const points = typeof getDayPoints === 'function' ? getDayPoints(day) : [];
  points.forEach(p => {
      if (isFinite(p.lat) && isFinite(p.lng)) {
          bounds.extend([p.lng, p.lat]);
          hasBounds = true;
      }
  });

  const geojson = window.lastRouteGeojsons && window.lastRouteGeojsons[containerId];
  if (geojson && geojson.features && geojson.features[0]?.geometry?.coordinates) {
      const coords = geojson.features[0].geometry.coordinates;
      coords.forEach(coord => { bounds.extend(coord); hasBounds = true; });
  }

  const mapOptions = {
    container: 'maplibre-3d-view',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    pitch: 60, bearing: -20, interactive: true, attributionControl: false
  };

  if (hasBounds) {
      mapOptions.bounds = bounds;
      mapOptions.fitBoundsOptions = { padding: { top: 40, bottom: 40, left: 40, right: 40 } };
  } else {
      mapOptions.center = expandedMap.getCenter();
      mapOptions.zoom = expandedMap.getZoom();
  }

  window._maplibre3DInstance = new maplibregl.Map(mapOptions);

  window._maplibre3DInstance.on('rotate', () => {
      const bearing = window._maplibre3DInstance.getBearing();
      const compassDisc = document.querySelector(`#custom-compass-btn-${day} .custom-compass-disc`);
      if (compassDisc) compassDisc.style.transform = `rotate(${-bearing}deg)`;
  });
  
  window._maplibre3DInstance.on('load', function () {
    // Verileri Çiz (Refresh fonksiyonunu kullanıyoruz)
    if (typeof refresh3DMapData === 'function') {
        refresh3DMapData(day);
    }

    // --- SEGMENT KONTROLÜ: EĞER SEÇİLİ BİR YER VARSA 3D'DE DE GÖSTER ---
    if (
        window._lastSegmentDay === day && 
        typeof window._lastSegmentStartKm === 'number' && 
        typeof window._lastSegmentEndKm === 'number'
    ) {
        // Harita tam otursun diye ufak bir gecikme ile çizdiriyoruz
        setTimeout(() => {
            highlightSegmentOnMap(day, window._lastSegmentStartKm, window._lastSegmentEndKm);
        }, 200);
    }
    // --------------------------------------------------------------------

    // Tıklama Eventi (Nearby Search)

    // Tıklama Eventi (Nearby Search)
    window._maplibre3DInstance.on('click', (e) => {
        const { lng, lat } = e.lngLat;
        if (typeof closeNearbyPopup === 'function') closeNearbyPopup();
        if (typeof showNearbyPlacesPopup === 'function') {
            showNearbyPlacesPopup(lat, lng, window._maplibre3DInstance, day, 500);
        }
    });
  }); 
}


async function expandMap(containerId, day) {
    // ✅ Spinner CSS'i garantile (JS-only)
    if (!document.getElementById('tt-spinner-style')) {
        const style = document.createElement('style');
        style.id = 'tt-spinner-style';
        style.textContent = `
          .spinner {
            width: 16px;
            height: 16px;
            border: 2px solid rgba(25,118,210,0.25);
            border-top-color: #1976d2;
            border-radius: 50%;
            animation: ttSpin 0.8s linear infinite;
            display: inline-block;
          }
          @keyframes ttSpin { to { transform: rotate(360deg); } }
        `;
        document.head.appendChild(style);
    }

    forceCleanExpandedMap(day);

    day = parseInt(day, 10);
    window.currentDay = day;

    console.log('[expandMap] start →', containerId, 'day=', day);

    // 1. STİL EKLEME
    if (!document.getElementById('tt-custom-map-controls-css')) {
        const style = document.createElement('style');
        style.id = 'tt-custom-map-controls-css';
        style.innerHTML = `
       .map-custom-controls {
        position: absolute;
    bottom: 180px;
    display: flex;
    flex-direction: row;
    gap: 10px;
    z-index: 10001;
    /* box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05); */
    /* padding: 6px; */
    border-radius: 12px;
    /* backdrop-filter: blur(4px); */
    /* border: 1px solid rgba(0, 0, 0, 0.05); */
    right: 0px;
}
        .map-ctrl-btn {
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); display: flex; align-items: center; justify-content: center;
            transition: all 0.2s ease; backdrop-filter: blur(4px); padding: 4px 10px;
            background: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; cursor: pointer;
        }
        .map-ctrl-btn:hover { background: #f8f9fa; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        .map-ctrl-btn:active { transform: translateY(0); box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
        .map-ctrl-btn img { width: 22px; height: 22px; opacity: 0.85; }
        .map-ctrl-btn.zoom-text { font-size: 22px; font-weight: 300; line-height: 1; color: #666; padding-bottom: 2px; }
        .custom-compass-disc { width: 24px; height: 24px; transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94); transform-origin: center center; }
        .expanded-map-header { position: absolute;
    bottom: 180px;
    z-index: 10001;
    display: flex;
    align-items: center;
    gap: 15px;
    left: 0px }
        @media (max-width:768px) { .expanded-map-header { left: 10px; } .map-custom-controls { right: 20px; } }
        .map-layers-row { position: relative;
    display: flex;
    gap: 8px;
    /* padding: 6px; */
    border-radius: 12px;
    /* backdrop-filter: blur(4px); */
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    flex-direction: column;
    width: auto;
    cursor: pointer;
    transition: all 0.2s ease;}
        .map-layers-row.closed .map-type-option:not(.selected) { display: none !important; }
        .map-type-option { display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; font-size: 12px; font-weight: 500; color: #444; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .map-type-option.selected { background: #eef7ff; border-color: #297fd4; color: #1976d2; box-shadow: 0 2px 5px rgba(41, 127, 212, 0.15); }
        .map-type-option:hover { background: #f9f9f9; }
        .map-type-option img { width: 16px; height: 16px; border-radius: 4px; object-fit: cover; }
        .maplibregl-ctrl-bottom-left { bottom: 30px !important; left: 20px !important; z-index: 20000 !important; pointer-events: none; }
        .maplibregl-ctrl-scale { background-color: rgba(255, 255, 255, 0.9) !important; border: 1px solid #e0e0e0 !important; border-radius: 6px !important; padding: 2px 8px !important; color: #555 !important; font-size: 11px !important; font-weight: 600 !important; box-shadow: 0 2px 6px rgba(0,0,0,0.15) !important; border-top: 1px solid #e0e0e0 !important; height: auto !important; line-height: 1.4 !important; pointer-events: auto; }
      `;
        document.head.appendChild(style);
    }

    if (!window.__ttMapLayerCloserBound) {
        document.addEventListener('click', (e) => {
            const row = document.querySelector('.map-layers-row');
            if (row && !row.contains(e.target)) {
                row.classList.add('closed');
            }
        });
        window.__ttMapLayerCloserBound = true;
    }

    if (window.expandedMaps && window.expandedMaps[containerId]) return;



    if (window.expandedMaps) {
        Object.keys(window.expandedMaps).forEach(otherId => {
            if (otherId !== containerId) {
                const ex = window.expandedMaps[otherId];
                if (ex) restoreMap(otherId, ex.day);
            }
        });
    }

    const originalContainer = document.getElementById(containerId);
    const baseMap = window.leafletMaps ? window.leafletMaps[containerId] : null;

    const controlsBar = document.getElementById(`route-controls-bar-day${day}`);
    const tmSet = document.getElementById(`tt-travel-mode-set-day${day}`);
    const expandBtns = [];
    if (controlsBar) expandBtns.push(controlsBar.querySelector('.expand-map-btn'));
    if (tmSet) expandBtns.push(tmSet.querySelector('.expand-map-btn'));

    expandBtns.forEach(btn => {
        if (btn) {
            btn.disabled = true;
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.6';
            btn.style.filter = 'grayscale(100%)';
            const label = btn.querySelector('.tm-label');
            if (label) label.textContent = 'Map Expanded';
        }
    });

    if (!originalContainer) ensureDayMapContainer(day);
    if (originalContainer) originalContainer.style.display = 'none';

    // === LOADING ANIMATION (SPINNER) - Harita yüklenirken göster ===
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = `expanded-map-loading-${day}`;
    loadingOverlay.className = 'tt-scale-loader';
    loadingOverlay.style.cssText = `
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
        z-index: 10002; display: flex; align-items: center; gap: 10px;
        background: #f8f8f8; border-radius: 10px; padding: 10px 13px;
        font-size: 12px; color: #8a4af3; font-weight: 700;
    `;
    loadingOverlay.innerHTML = '<div class="spinner"></div> Loading map...';
    // === HEADER & LAYERS ===
    const headerDiv = document.createElement('div');
    headerDiv.className = 'expanded-map-header';

    const layersBar = document.createElement('div');
    layersBar.className = 'map-layers-row closed';

    const layerOptions = [
        { value: 'bright', img: '/img/preview_bright.png', label: 'Bright' },
        { value: 'positron', img: '/img/preview_positron.png', label: 'Positron' },
        { value: 'liberty', img: '/img/preview_3d.png', label: '3D' }
    ];

    let currentLayer = 'bright';
    localStorage.setItem(`expanded-map-layer-day${day}`, 'bright');

    const expandedMapId = `expanded-map-${day}`;
    const expandedContainer = document.createElement('div');
    expandedContainer.id = expandedMapId;
    expandedContainer.className = 'expanded-map-container';

    layersBar.onclick = function(e) {
        if (this.classList.contains('closed')) {
            this.classList.remove('closed');
            e.stopPropagation();
        }
    };

    // --- HANDLE LAYER SELECT ---
    const handleLayerSelect = (e, forceSelect = false) => {
        e.stopPropagation();

        if (!forceSelect && layersBar.classList.contains('closed')) {
            layersBar.classList.remove('closed');
            return;
        }

        layersBar.querySelectorAll('.map-type-option').forEach(o => o.classList.remove('selected'));
        const targetDiv = e.target.closest('.map-type-option');
        if (targetDiv) targetDiv.classList.add('selected');

        const prevLayer = currentLayer;
        const newLayer = targetDiv ? targetDiv.getAttribute('data-value') : 'bright';
        currentLayer = newLayer;
        localStorage.setItem(`expanded-map-layer-day${day}`, currentLayer);

        const map3d = document.getElementById('maplibre-3d-view');
        const compassBtn = document.querySelector(`#custom-compass-btn-${day}`);

        const refreshLocationIfActive = () => {
            if (window.isLocationActiveByDay[day] && navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(pos => {
                    window.updateUserLocationMarker(expandedMapInstance, day, pos.coords.latitude, pos.coords.longitude, currentLayer);
                });
            }
        };

        // --- 3D Moduna Geçiş ---
        if (currentLayer === 'liberty') {
            expandedMapInstance.getContainer().style.display = "none";
            if (map3d) map3d.style.display = 'block';
            if (compassBtn) compassBtn.style.display = 'flex';
            openMapLibre3D(expandedMapInstance);
            setTimeout(refreshLocationIfActive, 300);
        }
        // --- 2D Moduna Geçiş (Positron veya Bright) ---
        else {
            if (map3d) map3d.style.display = "none";
            if (compassBtn) compassBtn.style.display = 'none';

            const container = expandedMapInstance.getContainer();
            container.style.display = "block";
            expandedMapInstance.invalidateSize(false);

            const pts = (typeof getDayPoints === 'function') ? getDayPoints(day) : [];
            const validPts = pts.filter(p => isFinite(p.lat) && isFinite(p.lng));

            let targetCenter = [39.0, 35.0];
            let targetZoom = 6;

            if (validPts.length > 0) {
                const latSum = validPts.reduce((sum, p) => sum + p.lat, 0);
                const lngSum = validPts.reduce((sum, p) => sum + p.lng, 0);
                targetCenter = [latSum / validPts.length, lngSum / validPts.length];
                targetZoom = (validPts.length === 1) ? 14 : 10;
            }

            expandedMapInstance.setView(targetCenter, targetZoom, { animate: false });

            // [FIX] Eski katmanları silme işini setExpandedMapTile'a bıraktık.
            // Burada tekrar manuel silmeye gerek yok, setExpandedMapTile bunu daha sağlam yapıyor.
            setExpandedMapTile(currentLayer);

            setTimeout(() => {
            try {
                updateExpandedMap(expandedMapInstance, day);
            } catch (err) {
                console.error(err);
            }
            // [FIX] Agresif boyut yenileme
            expandedMapInstance.invalidateSize();
            setTimeout(() => expandedMapInstance.invalidateSize(true), 150);
            refreshLocationIfActive();

                if (window._lastSegmentDay === day && typeof window._lastSegmentStartKm === 'number' && typeof window._lastSegmentEndKm === 'number') {
                    highlightSegmentOnMap(day, window._lastSegmentStartKm, window._lastSegmentEndKm);
                    const scaleBarDiv = document.getElementById(`expanded-route-scale-bar-day${day}`);
                    if (scaleBarDiv && typeof fetchAndRenderSegmentElevation === 'function') {
                        fetchAndRenderSegmentElevation(scaleBarDiv, day, window._lastSegmentStartKm, window._lastSegmentEndKm);
                    }
                }
            }, 100);
        }

        layersBar.classList.add('closed');

        if (prevLayer === 'liberty' && currentLayer !== 'liberty' && targetDiv && !targetDiv.__autoDouble) {
            targetDiv.__autoDouble = true;
            setTimeout(() => { layersBar.classList.remove('closed'); targetDiv.click(); targetDiv.__autoDouble = false; }, 50);
        }
    };

    // --- Butonları Ekleme ---
    layerOptions.forEach(opt => {
        const div = document.createElement('div');
        div.className = 'map-type-option';
        div.setAttribute('data-value', opt.value);
        div.innerHTML = `<img src="${opt.img}" alt="${opt.label}"><span>${opt.label}</span>`;
        if (opt.value === currentLayer) div.classList.add('selected');
        div.onclick = (e) => handleLayerSelect(e, false);
        div.ondblclick = (e) => handleLayerSelect(e, true);
        layersBar.appendChild(div);
    });

    headerDiv.appendChild(layersBar);

    const statsDiv = document.createElement('div');
    statsDiv.className = 'route-stats';

    // === 2. CUSTOM CONTROLS ===
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'map-custom-controls';

    const zoomInBtn = document.createElement('button');
    zoomInBtn.className = 'map-ctrl-btn zoom-text';
    zoomInBtn.innerText = '+';
    zoomInBtn.onclick = function() {
        if (currentLayer === 'liberty' && window._maplibre3DInstance) {
            window._maplibre3DInstance.zoomIn();
        } else {
            expandedMapInstance.zoomIn();
        }
    };

    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.className = 'map-ctrl-btn zoom-text';
    zoomOutBtn.innerText = '−';
    zoomOutBtn.onclick = function() {
        if (currentLayer === 'liberty' && window._maplibre3DInstance) {
            window._maplibre3DInstance.zoomOut();
        } else {
            expandedMapInstance.zoomOut();
        }
    };

    const compassBtn = document.createElement('button');
    compassBtn.id = `custom-compass-btn-${day}`;
    compassBtn.className = 'map-ctrl-btn ctrl-compass';
    compassBtn.style.display = 'none';
    compassBtn.innerHTML = `<div class="custom-compass-disc"><img src="img/compass-big.svg" style="width:100%;height:100%;" alt="N"></div>`;
    compassBtn.onclick = function() {
        if (currentLayer === 'liberty' && window._maplibre3DInstance) {
            window._maplibre3DInstance.easeTo({ bearing: 0, pitch: 60, duration: 1000 });
        }
    };


    const locBtn = document.createElement('button');
    locBtn.className = 'map-ctrl-btn';
    locBtn.id = `use-my-location-btn-day${day}`;
    locBtn.innerHTML = '<img src="img/location.svg" alt="Locate" style="width: 16px;">';
    window.isLocationActiveByDay = window.isLocationActiveByDay || {};

    // Başlangıç durumu
    if (window.isLocationActiveByDay[day]) {
        locBtn.classList.add('active');
        locBtn.innerHTML = '<img src="img/location.svg" alt="On" style="filter: invert(36%) sepia(88%) saturate(1074%) hue-rotate(195deg) brightness(97%) contrast(101%);">';
    }

    locBtn.onclick = function() {
    const isCurrentlyActive = window.isLocationActiveByDay[day];
    
    if (!isCurrentlyActive) {
        requestLocationPermission().then(async (granted) => {
            if (granted) {
                window.isLocationActiveByDay[day] = true;
                locBtn.classList.add('active');
                locBtn.innerHTML = '<img src="img/location.svg" alt="On" style="filter: invert(36%) sepia(88%) saturate(1074%) hue-rotate(195deg) brightness(97%) contrast(101%);">';
                
                if (!document.getElementById('tt-unified-loc-style')) {
                    const s = document.createElement('style');
                    s.id = 'tt-unified-loc-style';
                    s.innerHTML = `@keyframes ttPulse { 0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; } 100% { transform: translate(-50%, -50%) scale(4.5); opacity: 0; } } @keyframes ttColorCycle { 0% { background-color: #4285F4; } 50% { background-color: #34A853; } 100% { background-color: #4285F4; } } .user-loc-wrapper { position: relative; width: 20px; height: 20px; } .user-loc-dot { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 14px; height: 14px; background-color: #4285F4; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.3); z-index: 2; animation: ttColorCycle 2s infinite ease-in-out; } .user-loc-ring-1, .user-loc-ring-2 { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 14px; height: 14px; background-color: rgba(66, 133, 244, 0.6); border-radius: 50%; z-index: 1; animation: ttPulse 2.5s infinite linear; } .user-loc-ring-2 { animation-delay: 1.25s; }`;
                    document.head.appendChild(s);
                }

                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        function(position) {
                            let targetMap = expandedMapInstance;
                            const is3DMapActive = document.getElementById('maplibre-3d-view') && 
                                                  document.getElementById('maplibre-3d-view').style.display !== 'none';
                            
                            if (is3DMapActive && window._maplibre3DInstance) {
                                targetMap = window._maplibre3DInstance;
                            }
                            
                            window.updateUserLocationMarker(position, day, targetMap);
                        },
                        function(error) {
                            console.warn("Geolocation error:", error);
                            window.isLocationActiveByDay[day] = false;
                            locBtn.classList.remove('active');
                            locBtn.innerHTML = '<img src="img/location.svg" alt="Locate">';
                            
                            if (error.code === 1) {
                                alert("Location permission denied. Enable it in browser settings.");
                            }
                        }
                    );
                }
            } else {
                locBtn.classList.remove('active');
                locBtn.innerHTML = '<img src="img/location.svg" alt="Locate">';
            }
        });
    } else {
        window.isLocationActiveByDay[day] = false;
        locBtn.classList.remove('active');
        locBtn.innerHTML = '<img src="img/location.svg" alt="Locate">';
        
        if (window.userLocationMarkersByDay && window.userLocationMarkersByDay[day]) {
            let targetMap = expandedMapInstance;
            const is3DMapActive = document.getElementById('maplibre-3d-view') && 
                                  document.getElementById('maplibre-3d-view').style.display !== 'none';
            
            if (is3DMapActive && window._maplibre3DInstance) {
                targetMap = window._maplibre3DInstance;
            }

            window.userLocationMarkersByDay[day].forEach(marker => {
                try {
                    if (targetMap && targetMap.hasLayer && targetMap.hasLayer(marker)) {
                        targetMap.removeLayer(marker);
                    }
                    if (marker.remove) marker.remove();
                } catch(e) {}
            });
            window.userLocationMarkersByDay[day] = [];
        }
    }
    };

    controlsDiv.appendChild(locBtn);

    controlsDiv.appendChild(zoomInBtn);
    controlsDiv.appendChild(zoomOutBtn);
    controlsDiv.appendChild(compassBtn);

    const oldBar = document.getElementById(`expanded-route-scale-bar-day${day}`);
    if (oldBar) oldBar.remove();
    const scaleBarDiv = document.createElement('div');
    scaleBarDiv.className = 'route-scale-bar';
    scaleBarDiv.id = `expanded-route-scale-bar-day${day}`;
    scaleBarDiv.style.display = "block";

    const panelDiv = document.createElement('div');
    panelDiv.className = 'expanded-map-panel';
    panelDiv.appendChild(headerDiv);
    panelDiv.appendChild(statsDiv);
    panelDiv.appendChild(controlsDiv);
    panelDiv.appendChild(scaleBarDiv);

    expandedContainer.appendChild(panelDiv);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-expanded-map';
    closeBtn.textContent = '✕ Close';
    closeBtn.onclick = () => restoreMap(containerId, day);
    expandedContainer.appendChild(closeBtn);

    const mapDivId = `${containerId}-expanded`;
    const mapDiv = document.createElement('div');
    mapDiv.id = mapDivId;
    mapDiv.className = 'expanded-map';
    mapDiv.style.width = "100%";
    mapDiv.style.height = "480px";
    expandedContainer.appendChild(mapDiv);
    document.body.appendChild(expandedContainer);

    if (window.innerWidth <= 768) {
        const mainHeader = document.querySelector('.fixed-header'); 
        if (mainHeader) mainHeader.style.display = 'none';
    }

    showRouteInfoBanner(day);

    const ptsInit = typeof getDayPoints === 'function' ? getDayPoints(day) : [];
    const validPtsInit = ptsInit.filter(p => isFinite(p.lat) && isFinite(p.lng));
    let startCenter = validPtsInit.length === 1 ? [validPtsInit[0].lat, validPtsInit[0].lng] : [39.0, 35.0];
    let startZoom = validPtsInit.length === 1 ? 14 : 5;
    if (validPtsInit.length > 1) {
        const b = L.latLngBounds(validPtsInit.map(p => [p.lat, p.lng]));
        startCenter = b.getCenter();
        startZoom = 10;
    }

    // Desktop-only smooth zoom/fade settings (no custom CSS, no inertia bounce)
  const isDesktop = window.innerWidth > 1024 && !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  const expandedMapInstance = L.map(mapDivId, {
        center: startCenter,
        zoom: startZoom,
        maxZoom: 19,
        zoomControl: false,
        scrollWheelZoom: true,
        fadeAnimation: isDesktop,       // smooth tiles
        zoomAnimation: isDesktop,       // smooth zoom in/out
        markerZoomAnimation: isDesktop, // smooth marker scaling
        inertia: false,                 // avoid snap-back/bounce
        preferCanvas: true,
        renderer: L.canvas({ padding: 0.5 }),
        dragging: true
    });

     // === LOADING SPINNER'I KALDIR (2D Leaflet) ===
    expandedMapInstance.whenReady(function() {
        const loadingEl = document.getElementById(`expanded-map-loading-${day}`);
        if (loadingEl) loadingEl.remove();
    });

    // === [CRITICAL FIX] TILE LAYER AYARLAMA VE AGRESİF TEMİZLİK ===
    function setExpandedMapTile(styleKey) {
        // 1. ZORLU TEMİZLİK: Haritadaki tüm Tile/Vektör katmanlarını tarayıp sil.
        // Bu, Positron'a geçildiğinde altta Bright'ın (vektörün) kalmasını engeller.
        expandedMapInstance.eachLayer(layer => {
            // L.TileLayer (Raster) veya getMaplibreMap fonksiyonu olan (Vektör) katmanları bul
            if (layer instanceof L.TileLayer || (layer.getMaplibreMap && typeof layer.getMaplibreMap === 'function')) {
                try { expandedMapInstance.removeLayer(layer); } catch(e){}
            }
        });

        // Referansları sıfırla
        expandedMapInstance._maplibreLayer = null;
        expandedMapInstance._osmTileLayer = null;
        
        // Timeout varsa temizle
        if (expandedMapInstance._tileTimeout) {
            clearTimeout(expandedMapInstance._tileTimeout);
            expandedMapInstance._tileTimeout = null;
        }

      

        // --- 1. FALLBACK (CARTO) VE 3D GİZLEME ---
        const loadCartoFallback = () => {
            console.warn("[ExpandedMap] OpenFreeMap yanıt vermedi -> CartoDB açılıyor.");
            // Bir kez daha temizle ki üst üste binmesin
            if (expandedMapInstance._maplibreLayer) {
                try { expandedMapInstance.removeLayer(expandedMapInstance._maplibreLayer); } catch(e){}
                expandedMapInstance._maplibreLayer = null;
            }
            
            expandedMapInstance._osmTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; CARTO',
                subdomains: 'abcd',
                maxZoom: 20
            }).addTo(expandedMapInstance);

            const btn3d = layersBar.querySelector('.map-type-option[data-value="liberty"]');
            if (btn3d) btn3d.style.display = 'none';
        };

        // --- 2. POSITRON ---
        if (styleKey === 'positron') {
            expandedMapInstance._osmTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; CARTO',
                subdomains: 'abcd',
                maxZoom: 20
            }).addTo(expandedMapInstance);
            return;
        }

        // --- 3. LIBERTY (3D) ---
        if (styleKey === 'liberty') {
            try {
                if (typeof L.maplibreGL === 'function') {
                    expandedMapInstance._maplibreLayer = L.maplibreGL({
                        style: 'https://tiles.openfreemap.org/styles/bright',
                        attribution: '',
                        interactive: true
                    }).addTo(expandedMapInstance);
                }
            } catch(e) {}
            return;
        }

        // --- 4. BRIGHT (OpenFreeMap) + HIZLI TIMEOUT ---
        try {
            if (typeof L.maplibreGL === 'function') {
                const glLayer = L.maplibreGL({
                    style: 'https://tiles.openfreemap.org/styles/bright',
                    attribution: '&copy; <a href="https://openfreemap.org" target="_blank">OpenFreeMap</a>',
                    interactive: true
                });

                glLayer.addTo(expandedMapInstance);
                expandedMapInstance._maplibreLayer = glLayer;

                const glMap = glLayer.getMaplibreMap();
                let isAlive = false;

                const markAlive = () => {
                    if (isAlive) return;
                    isAlive = true;
                    // Sinyal geldiyse zamanlayıcıyı iptal et
                    if (expandedMapInstance._tileTimeout) {
                        clearTimeout(expandedMapInstance._tileTimeout);
                        expandedMapInstance._tileTimeout = null;
                    }
                };

                // --- DAHA HASSAS DİNLEME ---
                if (glMap) {
                    // 'on' kullanarak sürekli dinle, ilk veride yakala
                    glMap.on('styledata', markAlive);
                    glMap.on('sourcedata', markAlive);
                    glMap.on('tileload', markAlive); 
                    glMap.on('data', markAlive); // Herhangi bir veri akışı
                    glMap.once('load', markAlive);
                } else {
                    glLayer.on('ready', markAlive);
                    glLayer.on('load', markAlive);
                }

                // --- 4 SANİYE KURALI ---
                // 4 saniye içinde veri akışı başlamazsa acımadan CartoDB'ye geç.
                expandedMapInstance._tileTimeout = setTimeout(() => {
                    // Ekstra kontrol: Canvas var mı ve boyutu var mı?
                    const canvas = expandedMapInstance.getContainer().querySelector('canvas');
                    const hasVisuals = canvas && canvas.width > 0 && canvas.height > 0;

                    if (!isAlive && !hasVisuals) {
                        console.warn("[ExpandedMap] OpenFreeMap çok yavaş (4s). CartoDB'ye geçiliyor.");
                        loadCartoFallback();
                    } else {
                        // Geç de olsa bir şeyler çizilmiş, elleme.
                        markAlive();
                    }
                }, 4000);

            } else {
                throw new Error("MapLibre missing");
            }
        } catch (e) {
            loadCartoFallback();
        }
    }

    setExpandedMapTile(currentLayer);
    updateExpandedMap(expandedMapInstance, day);

    // --- GÜVENLİ ODAKLAMA ---
    const refitExpandedMap = () => {
        if (!expandedMapInstance || !document.getElementById(mapDivId)) return;
        try {
            expandedMapInstance.invalidateSize();
            const container = expandedMapInstance.getContainer();
            if (container) {
                container.style.cursor = 'grab';
                container.classList.remove('leaflet-interactive');
            }
        } catch(e) {}
    };

    requestAnimationFrame(refitExpandedMap);
    setTimeout(refitExpandedMap, 350);

    if (typeof attachClickNearbySearch === 'function') {
        if (expandedMapInstance.__ttNearbyClickBound) {
            expandedMapInstance.off('click', expandedMapInstance.__ttNearbyClickHandler);
            expandedMapInstance.__ttNearbyClickBound = false;
        }
        attachClickNearbySearch(expandedMapInstance, day);
    }

    window.expandedMaps = window.expandedMaps || {};
    window.expandedMaps[containerId] = {
        originalContainer,
        day,
        originalMap: baseMap,
        expandedMap: expandedMapInstance
    };

    const summary = window.lastRouteSummaries?.[containerId];
    const totalKm = summary ? summary.distance / 1000 : 0;
    const markerPositions = getRouteMarkerPositionsOrdered ? getRouteMarkerPositionsOrdered(day) : [];

    if (typeof renderRouteScaleBar === 'function') {
        renderRouteScaleBar(scaleBarDiv, totalKm, markerPositions);

const track = scaleBarDiv.querySelector('.scale-bar-track');

if (track) {
    // 🔥 FIX: ilk çizimde de loading aç
    track.classList.add('loading');

    const width = Math.max(200, Math.round(track.getBoundingClientRect().width));
    createScaleElements(track, width, totalKm, 0, markerPositions);
}
    }

    if (typeof addDraggableMarkersToExpandedMap === 'function') addDraggableMarkersToExpandedMap(expandedMapInstance, day);
    if (typeof setupScaleBarInteraction === 'function') setupScaleBarInteraction(day, expandedMapInstance);
    if (typeof adjustExpandedHeader === 'function') adjustExpandedHeader(day);

    if (window.importedTrackByDay && window.importedTrackByDay[day] && window.importedTrackByDay[day].drawRaw) {
        ensureExpandedScaleBar(day, window.importedTrackByDay[day].rawPoints);
    }
}

function updateExpandedMap(expandedMap, day) {
    console.log("[updateExpandedMap] Safe Render Started. Day:", day);

    const containerId = `route-map-day${day}`;

    // === 3D KONTROLÜ ===
    const is3DActive = document.getElementById('maplibre-3d-view') && 
                       document.getElementById('maplibre-3d-view').style.display !== 'none';

    if (is3DActive) {
        if (typeof refresh3DMapData === 'function') {
            refresh3DMapData(day);
        }
        // 3D modunda Scale Bar güncellemesi
        const scaleBarDiv = document.getElementById(`expanded-route-scale-bar-day${day}`);
        const summary = window.lastRouteSummaries?.[containerId];
        if (scaleBarDiv && summary && summary.distance > 0) {
            const totalKm = summary.distance / 1000;
            const markerPositions = (typeof getRouteMarkerPositionsOrdered === 'function') 
                ? getRouteMarkerPositionsOrdered(day) 
                : [];
            scaleBarDiv.innerHTML = ""; 
            if (typeof renderRouteScaleBar === 'function') {
                renderRouteScaleBar(scaleBarDiv, totalKm, markerPositions);
               const track = scaleBarDiv.querySelector('.scale-bar-track');
                if (track) {
                    const renderScale = () => {
                        const rect = track.getBoundingClientRect();
                        if (rect.width === 0) {
                            setTimeout(renderScale, 200);
                            return;
                        }
                        const width = Math.max(200, Math.round(rect.width));
                        if (typeof createScaleElements === 'function') {
                            createScaleElements(track, width, totalKm, 0, markerPositions);
                        }
                    };
                    renderScale();
                }
            }
        }
        return; 
    }
    // ====================

    // --- 2D (LEAFLET) RENDER ---
    const geojson = window.lastRouteGeojsons?.[containerId];

    // 1. KATMAN TEMİZLİĞİ (Tile Layer Hariç)
    const layersToRemove = [];
    expandedMap.eachLayer(layer => {
        if (
            layer instanceof L.TileLayer || 
            (layer.options && (layer.options.pane === 'tilePane' || layer._maplibreLayer))
        ) {
            return;
        }
        layersToRemove.push(layer);
    });
    layersToRemove.forEach(layer => { try { expandedMap.removeLayer(layer); } catch (e) {} });

    if (!window._curvedArcPointsByDay) window._curvedArcPointsByDay = {};
    window._curvedArcPointsByDay[day] = []; 

    // 2. NOKTA HAZIRLIĞI
    const rawPoints = (typeof getDayPoints === 'function') ? getDayPoints(day) : [];
    const pts = rawPoints.filter(p => isFinite(Number(p.lat)) && isFinite(Number(p.lng)));

    let bounds = L.latLngBounds(); 
    const isInTurkey = (typeof areAllPointsInTurkey === 'function') ? areAllPointsInTurkey(pts) : true;
    
    let hasValidRoute = (
      isInTurkey && geojson && geojson.features && geojson.features[0] &&
      geojson.features[0].geometry &&
      geojson.features[0].geometry.coordinates.length > 1
    );

    // --- ROTA ÇİZİMİ ---
    if (hasValidRoute) {
        const rawCoords = geojson.features[0].geometry.coordinates;
        const routeCoords = rawCoords.map(c => [c[1], c[0]]); // [Lat, Lng]

        const poly = L.polyline(routeCoords, {
            color: "#1976d2", weight: 6, opacity: 1, renderer: ensureCanvasRenderer(expandedMap) 
        }).addTo(expandedMap);
        bounds.extend(poly.getBounds());
        // [FIX] Segment seçimi için koordinatları tekrar [Lon, Lat] formatına çevir
        window._curvedArcPointsByDay[day] = routeCoords.map(coord => [coord[1], coord[0]]);

        // Eksik nokta bağlayıcıları
        pts.forEach(p => {
            let minDist = Infinity;
            let closestPoint = null;
            for (const rc of routeCoords) {
                const dSq = (rc[0] - p.lat) ** 2 + (rc[1] - p.lng) ** 2;
                if (dSq < minDist) { minDist = dSq; closestPoint = rc; }
            }
            if (closestPoint && minDist > 0.0000005) {
                L.polyline([[p.lat, p.lng], closestPoint], {
                    color: '#d32f2f', weight: 3, opacity: 0.6, dashArray: '5, 8', interactive: false 
                }).addTo(expandedMap);
            }
        });
    } else if (pts.length > 1 && !isInTurkey) {
        // Fly Mode
        let allArcPoints = [];
        for (let i = 0; i < pts.length - 1; i++) {
            const start = [pts[i].lng, pts[i].lat];
            const end = [pts[i + 1].lng, pts[i + 1].lat];
            if (typeof getCurvedArcCoords === 'function') {
                const arcPoints = getCurvedArcCoords(start, end);
                const latLngs = arcPoints.map(pt => [pt[1], pt[0]]);
                L.polyline(latLngs, {
                    color: "#1976d2", weight: 6, opacity: 0.93, dashArray: "6,8"
                }).addTo(expandedMap);
                latLngs.forEach(ll => bounds.extend(ll));
                if (i === 0) allArcPoints.push([start[0], start[1]]);
                allArcPoints = allArcPoints.concat(arcPoints.slice(1));
            }
        }
        window._curvedArcPointsByDay[day] = allArcPoints;
    }

    // --- MARKER ÇİZİMİ VE TIKLAMA OLAYI (KRİTİK KISIM) ---
    pts.forEach((item, idx) => {
        const markerHtml = `
            <div class="custom-marker-outer red" data-idx="${idx}" style="position:relative; cursor: pointer;">
                <span class="custom-marker-label">${idx + 1}</span>
            </div>`;
        const icon = L.divIcon({ html: markerHtml, className: "", iconSize: [32, 32], iconAnchor: [16, 16] });
        
        const marker = L.marker([item.lat, item.lng], { icon }).addTo(expandedMap);
        
        // [DÜZELTME 1] autoPan: false yaparak Leaflet'in varsayılan kaydırmasını kapatıyoruz
        marker.bindPopup(`<b>${item.name || "Point"}</b>`, { autoPan: false });
        
        // [DÜZELTME 2] Tıklayınca tam ortaya gelmesi için flyTo ekliyoruz
        marker.on('click', function() {
            expandedMap.flyTo([item.lat, item.lng], expandedMap.getZoom(), {
                animate: true,
                duration: 0.5 
            });
            marker.openPopup();
        });

        bounds.extend(marker.getLatLng());
    });

    // --- İLK AÇILIŞ ODAKLANMASI ---
    try {
        if (pts.length === 1) {
             expandedMap.setView([pts[0].lat, pts[0].lng], 14, { animate: true });
        } else if (bounds.isValid()) {
            expandedMap.fitBounds(bounds, { padding: [50, 50] });
        } else {
            expandedMap.setView([39.0, 35.0], 6, { animate: false });
        }
    } catch(e) { console.warn("FitBounds error:", e); }

    expandedMap.invalidateSize(); 

    setTimeout(() => { 
        try { 
            expandedMap.invalidateSize(); 
            if (bounds.isValid() && pts.length > 1) {
                expandedMap.fitBounds(bounds, { padding: [50, 50], animate: false });
            }
        } catch(e){} 
    }, 350);
    
    if (typeof addDraggableMarkersToExpandedMap === 'function') addDraggableMarkersToExpandedMap(expandedMap, day);

    // --- SCALE BAR ---
    const summary = window.lastRouteSummaries?.[containerId];
    if (summary && typeof updateDistanceDurationUI === 'function') {
        updateDistanceDurationUI(summary.distance, summary.duration);
    }
    const scaleBarDiv = document.getElementById(`expanded-route-scale-bar-day${day}`);
    if (scaleBarDiv && typeof renderRouteScaleBar === 'function') {
        if (summary && summary.distance > 0) {
            const totalKm = summary.distance / 1000;
            const markerPositions = (typeof getRouteMarkerPositionsOrdered === 'function') ? getRouteMarkerPositionsOrdered(day) : [];
            scaleBarDiv.innerHTML = ""; 
            renderRouteScaleBar(scaleBarDiv, totalKm, markerPositions);
            const track = scaleBarDiv.querySelector('.scale-bar-track');
            if (track) {
                // [FIX] Elementin genişliği oluşana kadar bekle (Recursive)
                const renderScale = () => {
                    const rect = track.getBoundingClientRect();
                    if (rect.width === 0) {
                        setTimeout(renderScale, 200);
                        return;
                    }
                    const width = Math.max(200, Math.round(rect.width));
                    if (typeof createScaleElements === 'function') {
                        createScaleElements(track, width, totalKm, 0, markerPositions);
                    }
                };
                renderScale();
            }
        } else {
            scaleBarDiv.innerHTML = "";
        }
    }
}
 


 function restoreMap(containerId, day) {

    // --- YENİ EKLENEN: Harita kapanınca Header'ı geri getir (Temizlik) ---
    const mainHeader = document.querySelector('.fixed-header'); 
    if (mainHeader) {
        mainHeader.style.display = ''; // Inline stili siler, CSS'e geri döner
    }
    // --------------------------------------------------------------------

    // containerId'den expandedData'yı bulmaya çalış, yoksa day üzerinden manuel temizlik yap
    const expandedData = window.expandedMaps?.[containerId];
    
    // --- 1. BUTONLARI ESKİ HALİNE GETİR (AKTİF ET) ---
    const controlsBar = document.getElementById(`route-controls-bar-day${day}`);
    const tmSet = document.getElementById(`tt-travel-mode-set-day${day}`);
    const expandBtns = [];

    if (controlsBar) {
        const btn = controlsBar.querySelector('.expand-map-btn');
        if (btn) expandBtns.push(btn);
    }
    if (tmSet) {
        const btn = tmSet.querySelector('.expand-map-btn');
        if (btn) expandBtns.push(btn);
    }

    expandBtns.forEach(btn => {
        btn.disabled = false;
        btn.style.pointerEvents = 'auto';
     

        const img = btn.querySelector('img');
        if (img) img.style.filter = 'none';

        const label = btn.querySelector('.tm-label');
        if (label) {
            label.textContent = 'Expand map';
            
        }
        
        // Hover efektlerini tekrar aktif hissettirmek için
        btn.onmouseover = function() { this.style.background = "#fafafa"; };
        btn.onmouseout = function() { this.style.background = "#ffffff"; };
    });
    // ------------------------------------------------

    try {
        // Expanded Map Instance Temizliği
        if (expandedData && expandedData.expandedMap) {
            try { expandedData.expandedMap.remove(); } catch(e) {}
        } else {
            // Expanded data kaybolduysa bile DOM'dan instance'ı bulup silmeye çalış
            const domMap = document.getElementById(`expanded-map-${day}`);
            if (domMap) {
                // Leaflet instance'ı DOM elementine bağlı olabilir, temizleme şansımız yoksa DOM silmek yeterli
            }
        }

        // Expanded Container DOM Temizliği
        const expandedContainer = document.getElementById(`expanded-map-${day}`);
        if (expandedContainer) {
            expandedContainer.remove();
        }

        // Expanded Scale Bar Temizliği
        const expandedScaleBar = document.getElementById(`expanded-route-scale-bar-day${day}`);
        if (expandedScaleBar && expandedScaleBar.parentNode) {
            expandedScaleBar.parentNode.removeChild(expandedScaleBar);
        }

        // Küçük Harita Scale Bar'ı Geri Getir (Varsa)
        const originalScaleBar = document.getElementById(`route-scale-bar-day${day}`);
        if (originalScaleBar) {
            originalScaleBar.style.display = "block"; // none ise block yap
        }

        // Küçük Haritayı Geri Göster
        if (expandedData && expandedData.originalContainer) {
            expandedData.originalContainer.style.display = '';
        } else {
            // Fallback: ID ile bulup göster
            const smallMap = document.getElementById(containerId);
            if (smallMap) smallMap.style.display = '';
        }

        // Diğer günlerin haritalarını ve kontrollerini geri göster (eğer gizlendiyse)
        document.querySelectorAll('.day-container').forEach(dc => {
            const smallMap = dc.querySelector('.route-map');
            const otherDay = parseInt(dc.dataset.day, 10);
            const controls = document.getElementById(`map-bottom-controls-wrapper-day${otherDay}`);
            
            // Eğer collapsed (akordiyon kapalı) değilse görünür yap
            if (smallMap && !smallMap.classList.contains('collapsed')) {
                 smallMap.style.display = '';
            }
            if (controls && !controls.classList.contains('collapsed')) {
                controls.style.display = '';
            }
        });

        // --- KÜÇÜK HARİTAYI RESETLE / ODAKLA ---
        const originalMap = expandedData ? expandedData.originalMap : window.leafletMaps[containerId];
        if (originalMap && typeof getDayPoints === "function") {
            try {
                const pts = getDayPoints(day).filter(p => isFinite(p.lat) && isFinite(p.lng));
                setTimeout(() => {
                    originalMap.invalidateSize({ pan: false });
                    if (pts.length > 1) {
                        originalMap.fitBounds(pts.map(p => [p.lat, p.lng]), { padding: [20, 20] });
                    } else if (pts.length === 1) {
                        originalMap.setView([pts[0].lat, pts[0].lng], 14, { animate: true });
                    }
                }, 120);
            } catch (e) {
                console.warn("restoreMap: fitBounds after restore failed", e);
            }
        }
        
        // Rotayı tekrar render et (Görsel tutarlılık için)
        if (typeof renderRouteForDay === "function") {
            setTimeout(() => { renderRouteForDay(day); }, 160);
        }

    } catch (e) {
        console.error('Error while closing the map:', e);
    } finally {
        if (window.expandedMaps && window.expandedMaps[containerId]) {
            delete window.expandedMaps[containerId];
        }
    }

    // Segment seçim & event cleanup:
    window._lastSegmentDay = undefined;
    window._lastSegmentStartKm = undefined;
    window._lastSegmentEndKm = undefined;
    window.__scaleBarDrag = null;
    window.__scaleBarDragTrack = null;
    window.__scaleBarDragSelDiv = null;
    
    // Event listenerları temizle
    if (typeof window.__sb_onMouseMove === 'function') {
        window.removeEventListener('mousemove', window.__sb_onMouseMove);
        window.removeEventListener('touchmove', window.__sb_onMouseMove);
    }
    if (typeof window.__sb_onMouseUp === 'function') {
        window.removeEventListener('mouseup', window.__sb_onMouseUp);
        window.removeEventListener('touchend', window.__sb_onMouseUp);
    }
}

// =================================================================
// 🛑 GÜVENLİK VE LİMİT FONKSİYONLARI (mainscript.js içine)
// =================================================================

// Limit Ayarı (Değiştirmek isterseniz buradan değiştirin)
const CURRENT_ROUTE_KM_LIMIT = 600; 

/**
 * Yardımcı: Koordinat objesini güvenli bir şekilde {lat, lng} sayısına çevirir.
 * Veri formatı farklı gelse bile (string, eksik field vb.) patlamayı önler.
 */
function getSafeCoord(item) {
    let lat = 0, lng = 0;
    
    // 1. item.location.lat kontrolü
    if (item.location && (typeof item.location.lat !== 'undefined')) {
        lat = item.location.lat;
        lng = item.location.lng;
    } 
    // 2. item.lat kontrolü (bazı durumlarda direkt root'ta olabilir)
    else if (typeof item.lat !== 'undefined') {
        lat = item.lat;
        lng = item.lng;
    }

    // String gelme ihtimaline karşı Float'a çevir
    return { lat: parseFloat(lat), lng: parseFloat(lng) };
}

/**
 * Bu fonksiyon, harita çizilmeden ÖNCE kuş uçuşu mesafeyi kontrol eder.
 * Eğer bariz bir limit aşımı varsa (örn: 500km), API'yi yormadan item'ı siler.
 */
async function enforceDailyRouteLimit(day, maxKm) {
    // 1. O güne ait itemları al
    if (!window.cart) return false;

    // --- DÜZELTME BAŞLANGICI ---
    // Sadece günü eşleşen DEĞİL, aynı zamanda kategorisi 'Note' OLMAYANLARI alıyoruz.
    let dayItems = window.cart.filter(item => 
        item.day == day && 
        item.category !== 'Note' // <--- Notlar mesafe hesabından muaf tutuldu
    );
    // --- DÜZELTME BİTİŞİ ---
    
    // Eğer 0 veya 1 nokta varsa mesafe oluşmaz, işlem yapma.
    if (dayItems.length <= 1) return false;

    let totalKm = 0;
    let splitIdx = -1;
    let limitExceededName = "";

    // 2. Mesafeyi Kümülatif Hesapla
    for (let i = 1; i < dayItems.length; i++) {
        const p1 = getSafeCoord(dayItems[i-1]);
        const p2 = getSafeCoord(dayItems[i]);

        // Koordinat hatası varsa (NaN), bu item'ı atla ve log düş
        if (isNaN(p1.lat) || isNaN(p1.lng) || isNaN(p2.lat) || isNaN(p2.lng)) {
            // Notları filtrelediğimiz için buraya düşme ihtimali azaldı ama yine de güvenlik.
            continue;
        }

        // Kuş uçuşu mesafe (Haversine)
        const km = haversine(p1.lat, p1.lng, p2.lat, p2.lng) / 1000;
        totalKm += km;

        // Limit aşıldı mı?
        if (totalKm > maxKm) {
            splitIdx = i; 
            limitExceededName = dayItems[i].name || 'Added Location';
            console.warn(`[LimitCheck] 🛑 LIMIT EXCEEDED at item #${i} ("${limitExceededName}") - Total: ${totalKm.toFixed(1)}km`);
            break; // İlk taştığı yerde döngüyü kır
        }
    }

    // 3. Limit Aşıldıysa: SİL VE UYAR
    if (splitIdx > 0) {
        // Limiti aşan noktadan itibaren hepsini al (genelde sondaki 1 tanedir)
        const itemsToDelete = dayItems.slice(splitIdx); 
        
        console.log(`[LimitCheck] Automatically removing ${itemsToDelete.length} items to fix route.`);

        // A. Sepetten (window.cart) Sil
        itemsToDelete.forEach(itemToDelete => {
            const idx = window.cart.indexOf(itemToDelete);
            if (idx > -1) {
                window.cart.splice(idx, 1);
            }
        });

        // B. Kullanıcıya Bilgi Ver
        if (typeof showToast === "function") {
            showToast(`⚠️ Limit exceeded (${maxKm}km)! "${limitExceededName}" removed.`, "error");
        } else {
            alert(`⚠️ LIMIT EXCEEDED: The route cannot exceed ${maxKm}km.\n"${limitExceededName}" was removed.`);
        }

        // C. Arayüzü Güncelle
        if (typeof updateCart === "function") {
            setTimeout(() => {
                console.log("[LimitCheck] Refreshing cart UI...");
                updateCart(); 
            }, 50);
        }

        // true döndürerek çağıran fonksiyona "işlemi durdur, ben müdahale ettim" diyoruz.
        return true; 
    }

    // Limit aşılmadı, her şey yolunda
    return false;
}
async function renderRouteForDay(day) {
    // --- 1. LIMIT KONTROLÜ ---
    // Eğer limit aşıldıysa ve kullanıcı "Evet taşı" dediyse, 
    // fonksiyon true döner ve biz bu render'ı iptal ederiz (çünkü updateCart yeni render yapacak).
    // Kullanıcı "Hayır" dediyse false döner ve harita çizilmeye devam eder.
    const limitHandled = await enforceDailyRouteLimit(day, CURRENT_ROUTE_KM_LIMIT);
    if (limitHandled) return;

    // --- STANDART RENDER BAŞLANGICI ---
    // console.log(`=== RENDER START for day ${day} ===`);
   
    // console.log(`Cart items for day ${day}:`, 
    //     window.cart.filter(item => item.day === day).map((item, i) => 
    //         `${i}: ${item.name || 'unnamed'} (${item.location?.lat},${item.location?.lng})`
    //     )
    // );

    const limitExceeded = await enforceDailyRouteLimit(day, CURRENT_ROUTE_KM_LIMIT);
    if (limitExceeded) return; // Eğer bölündüyse bu fonksiyon zaten updateCart üzerinden tekrar tetiklenecek

    // 1. ADIM: TEMİZLİK (RESET)
    // 3D Haritanın kafasını karıştıracak her şeyi siliyoruz.
    // Artık "seçili bir segment" yok. Her güncellemede "Genel Görünüm"e zorluyoruz.
    window.selectedSegmentIndex = -1;
    window.selectedSegment = null;
    
    // Eski "hafızada kalan" segment bilgilerini de siliyoruz.
    window._lastSegmentDay = null;
    window._lastSegmentStartKm = null;
    window._lastSegmentEndKm = null;

    // ---------------------------------------------------------
    // BURADAN AŞAĞISI STANDART ROTA HESAPLAMA (DOKUNMA)
    // ---------------------------------------------------------

    const pts = getDayPoints(day).filter(
        p => typeof p.lat === "number" && typeof p.lng === "number" && !isNaN(p.lat) && !isNaN(p.lng)
    );

    // --- SENARYO A: GPS DOSYASINDAN GELEN ROTA (KİLİTLİ) ---
    if (window.importedTrackByDay && window.importedTrackByDay[day] && window.routeLockByDay && window.routeLockByDay[day]) {
        const gpsRaw = window.importedTrackByDay[day].rawPoints || [];
        const points = getDayPoints(day);
        const containerId = `route-map-day${day}`;
        ensureDayMapContainer(day);
        initEmptyDayMap(day);

        if (gpsRaw.length < 2 || points.length < 2) return;

        let gpsCoords = gpsRaw.map(pt => [pt.lng, pt.lat]);
        let trackDistance = 0;
        for (let i = 1; i < gpsRaw.length; i++) {
            trackDistance += haversine(gpsRaw[i - 1].lat, gpsRaw[i - 1].lng, gpsRaw[i].lat, gpsRaw[i].lng);
        }
        let fullGeojsonCoords = [...gpsCoords];
        let pairwiseSummaries = [{ distance: trackDistance, duration: trackDistance / 1.3 }];
        let durations = [trackDistance / 1.3];

        let prev = points[1];
        for (let i = 2; i < points.length; i++) {
            const next = points[i];
            const url = buildDirectionsUrl(`${prev.lng},${prev.lat};${next.lng},${next.lat}`, day);
            try {
                const resp = await fetch(url);
                const data = await resp.json();
                if (data.routes && data.routes[0]) {
                    const seg = data.routes[0].geometry.coordinates;
                    fullGeojsonCoords.push(...seg.slice(1));
                    pairwiseSummaries.push({
                        distance: data.routes[0].distance,
                        duration: data.routes[0].duration
                    });
                    durations.push(data.routes[0].duration);
                }
            } catch (e) {
                const prevPt = points[i - 1];
                const thisPt = points[i];
                const d = haversine(prevPt.lat, prevPt.lng, thisPt.lat, thisPt.lng);
                const dur = Math.round(d / 1000 / 4 * 3600);
                pairwiseSummaries.push({ distance: Math.round(d), duration: dur });
                durations.push(dur);
            }
            prev = next;
        }

        const totalDistance = pairwiseSummaries.reduce((a, b) => a + (b.distance || 0), 0);
        const totalDuration = durations.reduce((a, b) => a + (b || 0), 0);

        const finalGeojson = {
            type: "FeatureCollection",
            features: [{
                type: "Feature",
                geometry: { type: "LineString", coordinates: fullGeojsonCoords },
                properties: {}
            }]
        };

        window.lastRouteGeojsons = window.lastRouteGeojsons || {};
        window.lastRouteGeojsons[containerId] = finalGeojson;
        window.pairwiseRouteSummaries = window.pairwiseRouteSummaries || {};
        window.pairwiseRouteSummaries[containerId] = pairwiseSummaries;

        window.lastRouteSummaries = window.lastRouteSummaries || {};
        window.lastRouteSummaries[containerId] = { distance: totalDistance, duration: totalDuration };

        renderLeafletRoute(containerId, finalGeojson, points, { distance: totalDistance, duration: totalDuration }, day);

        // 2. ADIM: Data hazır, şimdi 3D haritaya "Çiz" diyoruz.
        // selectedSegmentIndex = -1 olduğu için DÜZ (Genel) çizecek.
        document.dispatchEvent(new CustomEvent('tripUpdated', { detail: { day: day } }));

        const infoPanel = document.getElementById(`route-info-day${day}`);
        if (infoPanel) {
            infoPanel.innerHTML = `<span style="color:#1976d2;">The route from the GPS file is <b>LOCKED</b>. The start-finish interval is fixed, subsequent parts were added.</span>`;
        }
        if (typeof updateRouteStatsUI === 'function') updateRouteStatsUI(day);
        if (typeof adjustExpandedHeader === 'function') adjustExpandedHeader(day);

        let expandedMapObj = window.expandedMaps?.[containerId];
        let eMap = expandedMapObj?.expandedMap;
        if (!eMap && typeof expandMap === "function") {
            await expandMap(containerId, day);
            expandedMapObj = window.expandedMaps?.[containerId];
            eMap = expandedMapObj?.expandedMap;
        }
        if (eMap) {
            eMap.eachLayer(l => { if (!(l instanceof L.TileLayer)) eMap.removeLayer(l); });
            const polyEx = L.polyline(fullGeojsonCoords.map(c => [c[1], c[0]]), { color: '#1565c0', weight: 7, opacity: 0.9 }).addTo(eMap);
            try { eMap.fitBounds(polyEx.getBounds()); } catch (_) { }
            L.circleMarker([fullGeojsonCoords[0][1], fullGeojsonCoords[0][0]], { radius: 9, color: '#2e7d32', fillColor: '#2e7d32', fillOpacity: 0.95, weight: 2 }).addTo(eMap);
            L.circleMarker([fullGeojsonCoords[fullGeojsonCoords.length - 1][1], fullGeojsonCoords[fullGeojsonCoords.length - 1][0]], { radius: 9, color: '#c62828', fillColor: '#c62828', fillOpacity: 0.95, weight: 2 }).addTo(eMap);
        }

        let expandedMapDiv =
            document.getElementById(`expanded-map-${day}`) ||
            document.getElementById(`expanded-route-map-day${day}`);
       // --- SCALE BAR VE ELEVATION GÜNCELLEMESİ ---
if (expandedMapDiv) {
    let expandedScaleBar = document.getElementById(`expanded-route-scale-bar-day${day}`);
    if (!expandedScaleBar) {
        expandedScaleBar = document.createElement('div');
        expandedScaleBar.id = `expanded-route-scale-bar-day${day}`;
        expandedScaleBar.className = 'route-scale-bar expanded';
        expandedMapDiv.parentNode.insertBefore(expandedScaleBar, expandedMapDiv.nextSibling);
    }
    
    // 1. Temizlik ve Loading Başlangıcı
    expandedScaleBar.style.display = "block";
    
    // [YENİ] CSS'teki spinner'ı tetiklemek için geçici loading div'i ekle
    // renderRouteScaleBar çalışıp içeriği ezene kadar bu görünecek.
    expandedScaleBar.innerHTML = '<div class="scale-bar-track loading" style="height: 60px; width: 100%;"></div>';

    // OSRM'den gelen koordinatları al
    const routeCoords = routeData.coords.map(c => ({ lat: c[1], lng: c[0] }));
    const totalKm = routeData.summary.distance / 1000;

    // ASYNC Çizim Fonksiyonu
    const drawElevationGraph = async () => {
        try {
            // 2. Yükseklik verisini al ve Çiz (Mutlaka bekle!)
            if (typeof window.renderRouteScaleBar === 'function') { // Fonksiyon adını düzelttim/kontrol ettim
                // Bu fonksiyon çalıştığında, expandedScaleBar'ın içini (innerHTML) temizleyip
                // kendi grafiğini çizeceği için loading div'i otomatik olarak kaybolur.
                await window.renderRouteScaleBar(expandedScaleBar, totalKm, snappedPoints, routeCoords);
                console.log(`[ScaleBar] Grafik başarıyla çizildi: Day ${day}`);
            }
        } catch (err) {
            console.error("[ScaleBar] Çizim hatası:", err);
            
            // Hata durumunda loading div'ini sil
            expandedScaleBar.innerHTML = "";
            
            // Fallback: Grafik çizilemezse bile barı oluştur (Verisiz)
            if (typeof renderRouteScaleBar === 'function') {
                renderRouteScaleBar(expandedScaleBar, totalKm, snappedPoints);
            }
        }
    };

    drawElevationGraph();
}
        return;
    }

    // --- SENARYO B: NORMAL ROTA HESAPLAMA (OSRM) ---

    if (window.__suppressMiniUntilFirstPoint && window.__suppressMiniUntilFirstPoint[day]) {
        const pts0 = getDayPoints(day);
        if (!pts0 || pts0.length === 0) return;
    }

    const containerId = `route-map-day${day}`;
    const points = getDayPoints(day);

    if (
        window.importedTrackByDay &&
        window.importedTrackByDay[day] &&
        window.importedTrackByDay[day].drawRaw &&
        points.length > 2
    ) {
        window.importedTrackByDay[day].drawRaw = false;
    }

    if (!points || points.length === 0) {
        ensureDayMapContainer(day);
        initEmptyDayMap(day);
        if (typeof clearRouteCachesForDay === 'function') clearRouteCachesForDay(day);
        if (typeof clearRouteVisualsForDay === 'function') clearRouteVisualsForDay(day);
        if (typeof clearDistanceLabels === 'function') clearDistanceLabels(day);
        if (typeof updateRouteStatsUI === 'function') updateRouteStatsUI(day);
        
        // Data boş, 3D harita da boşalsın
        document.dispatchEvent(new CustomEvent('tripUpdated', { detail: { day: day } }));
        return;
    }

    if (points.length === 1) {
        // Tek nokta senaryosu
        if (typeof clearRouteCachesForDay === 'function') clearRouteCachesForDay(day);
        if (typeof clearRouteVisualsForDay === 'function') clearRouteVisualsForDay(day);
        ensureDayMapContainer(day);
        initEmptyDayMap(day);
        const map = window.leafletMaps?.[containerId];
        if (typeof updateRouteStatsUI === 'function') updateRouteStatsUI(day);
        if (typeof clearDistanceLabels === 'function') clearDistanceLabels(day);
        if (map) {
            map.eachLayer(l => {
                if (
                    l instanceof L.Marker ||
                    l instanceof L.Polyline ||
                    l instanceof L.Circle ||
                    l instanceof L.CircleMarker
                ) {
                    map.removeLayer(l);
                }
            });

            const p = points[0];
            L.marker([p.lat, p.lng], {
                icon: L.divIcon({
                    html: `<div style="background:#d32f2f;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;border:2px solid #fff;box-shadow: 0 2px 8px rgba(0,0,0,0.2);">1</div>`,
                    className: "",
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                })
            }).addTo(map).bindPopup(`<b>${p.name || 'Point'}</b>`);
            map.setView([p.lat, p.lng], 14, { animate: true });
            setTimeout(() => map.invalidateSize(), 120);
        }
        const expandedMapObj = window.expandedMaps?.[containerId];
        if (expandedMapObj?.expandedMap) {
            const eMap = expandedMapObj.expandedMap;
            eMap.eachLayer(l => { if (l instanceof L.Marker || l instanceof L.Polyline) eMap.removeLayer(l); });

            const p = points[0];
            L.marker([p.lat, p.lng], {
                icon: L.divIcon({
                    html: `<div style="background:#d32f2f;color:#fff;border-radius:50%;width:27px;height:27px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:18px;border:2px solid #fff;box-shadow: 0 2px 8px rgba(0,0,0,0.2);">1</div>`,
                    className: "",
                    iconSize: [34, 34],
                    iconAnchor: [17, 17]
                })
            }).addTo(eMap).bindPopup(`<b>${p.name || 'Point'}</b>`).openPopup();

            eMap.setView([p.lat, p.lng], 15, { animate: true });
            setTimeout(() => eMap.invalidateSize(), 120);
        }
        // Tek nokta da olsa "güncelle" sinyali gönder
        document.dispatchEvent(new CustomEvent('tripUpdated', { detail: { day: day } }));
        return;
    }

    if (points.length === 2 &&
        window.importedTrackByDay &&
        window.importedTrackByDay[day] &&
        window.importedTrackByDay[day].drawRaw) {

        const trackObj = window.importedTrackByDay[day];
        const raw = trackObj.rawPoints || [];
        if (raw.length > 1) {
            ensureDayMapContainer(day);
            initEmptyDayMap(day);
            const map = window.leafletMaps?.[containerId];
            if (map) {
                map.eachLayer(l => {
                    if (
                        l instanceof L.Marker ||
                        l instanceof L.Polyline ||
                        l instanceof L.Circle ||
                        l instanceof L.CircleMarker
                    ) {
                        map.removeLayer(l);
                    }
                });
                const latlngs = raw.map(pt => [pt.lat, pt.lng]);
                const poly = addPolylineSafe(map, latlngs, { color: '#1565c0', weight: 5, opacity: 0.9 });
                addCircleMarkerSafe(map, latlngs[0], { radius: 8, color: '#2e7d32', fillColor: '#2e7d32', fillOpacity: 0.95, weight: 2 }).bindPopup('Start');
                addCircleMarkerSafe(map, latlngs[latlngs.length - 1], { radius: 8, color: '#c62828', fillColor: '#c62828', fillOpacity: 0.95, weight: 2 }).bindPopup('Finish');
                try { map.fitBounds(poly.getBounds(), { padding: [20, 20] }); } catch (_) { }
            }

            let expandedMapDiv =
                document.getElementById(`expanded-map-${day}`) ||
                document.getElementById(`expanded-route-map-day${day}`);

            if (expandedMapDiv) {
                let expandedScaleBar = document.getElementById(`expanded-route-scale-bar-day${day}`);
                if (!expandedScaleBar) {
                    expandedScaleBar = document.createElement('div');
                    expandedScaleBar.id = `expanded-route-scale-bar-day${day}`;
                    expandedScaleBar.className = 'route-scale-bar expanded';
                    expandedMapDiv.parentNode.insertBefore(expandedScaleBar, expandedMapDiv.nextSibling);
                }
                if (typeof renderRouteScaleBar === 'function' && expandedScaleBar) {
                    let samples = raw;
                    if (samples.length > 600) {
                        const step = Math.ceil(samples.length / 600);
                        samples = samples.filter((_, i) => i % step === 0);
                    }
                    let dist = 0, dists = [0];
                    for (let i = 1; i < samples.length; i++) {
                        dist += haversine(
                            samples[i - 1].lat, samples[i - 1].lng,
                            samples[i].lat, samples[i].lng
                        );
                        dists.push(dist);
                    }
                    expandedScaleBar.innerHTML = "";
                    renderRouteScaleBar(
                        expandedScaleBar,
                        dist / 1000,
                        samples.map((p, i) => ({
                            name: (i === 0 ? "Start" : (i === samples.length - 1 ? "Finish" : "")),
                            distance: dists[i] / 1000,
                            snapped: true
                        }))
                    );
                }
            }

            let distM = 0;
            for (let i = 1; i < raw.length; i++) {
                const a = raw[i - 1], b = raw[i];
                distM += haversine(a.lat, a.lng, b.lat, b.lng);
            }
            let durationSec;
            const firstTimed = raw.find(p => p.time);
            const lastTimed = [...raw].reverse().find(p => p.time);
            if (firstTimed && lastTimed && lastTimed.time > firstTimed.time) {
                durationSec = (lastTimed.time - firstTimed.time) / 1000;
            } else {
                const travelMode = (typeof getTravelModeForDay === 'function') ? getTravelModeForDay(day) : 'walking';
                const speedMps =
                    travelMode === 'cycling' ? 5.5 :
                        travelMode === 'driving' ? 13 :
                            1.3;
                durationSec = distM / speedMps;
            }
            window.lastRouteSummaries = window.lastRouteSummaries || {};
            window.lastRouteSummaries[containerId] = { distance: distM, duration: durationSec };
            window.pairwiseRouteSummaries = window.pairwiseRouteSummaries || {};
            window.pairwiseRouteSummaries[containerId] = [{ distance: distM, duration: durationSec }];
            window.lastRouteGeojsons = window.lastRouteGeojsons || {};
            window.lastRouteGeojsons[containerId] = {
                type: "FeatureCollection",
                features: [{
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: raw.map(p => [p.lng, p.lat])
                    },
                    properties: {}
                }]
            };

            if (typeof updateRouteStatsUI === 'function') updateRouteStatsUI(day);
            if (typeof adjustExpandedHeader === 'function') adjustExpandedHeader(day);

            let expandedMapObj = window.expandedMaps?.[containerId];
            let eMap = expandedMapObj?.expandedMap;
            if (!eMap && typeof expandMap === "function") {
                await expandMap(containerId, day);
                expandedMapObj = window.expandedMaps?.[containerId];
                eMap = expandedMapObj?.expandedMap;
            }
            if (eMap) {
                eMap.eachLayer(l => { if (!(l instanceof L.TileLayer)) eMap.removeLayer(l); });
                const latlngs = raw.map(pt => [pt.lat, pt.lng]);
                const polyEx = L.polyline(latlngs, { color: '#1565c0', weight: 7, opacity: 0.9 }).addTo(eMap);
                try { eMap.fitBounds(polyEx.getBounds()); } catch (_) { }
                L.circleMarker(latlngs[0], { radius: 9, color: '#2e7d32', fillColor: '#2e7d32', fillOpacity: 0.95, weight: 2 }).addTo(eMap);
                L.circleMarker(latlngs[latlngs.length - 1], { radius: 9, color: '#c62828', fillColor: '#c62828', fillOpacity: 0.95, weight: 2 }).addTo(eMap);
            }
            
            // Raw data durumu için 3D haritayı güncelle
            document.dispatchEvent(new CustomEvent('tripUpdated', { detail: { day: day } }));
            return;
        }
    }
    ensureDayMapContainer(day);
    initEmptyDayMap(day);

    const snappedPoints = [];
    for (const pt of points) {
        const snapped = await snapPointToRoad(pt.lat, pt.lng);
        snappedPoints.push({ ...snapped, name: pt.name });
    }
    const coordinates = snappedPoints.map(pt => [pt.lng, pt.lat]);

    const geojson = window.lastRouteGeojsons?.[containerId];
    const isInTurkey = areAllPointsInTurkey(points);
    const hasRealRoute = isInTurkey && geojson && geojson.features && geojson.features[0]?.geometry?.coordinates?.length > 1;


    if (!hasRealRoute) {
        if (isInTurkey) {
            window.lastRouteSummaries = window.lastRouteSummaries || {};
            window.lastRouteSummaries[containerId] = {};
            window.lastRouteGeojsons = window.lastRouteGeojsons || {};
            window.lastRouteGeojsons[containerId] = {
                type: "FeatureCollection",
                features: [{
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: points.map(p => [p.lng, p.lat])
                    },
                    properties: {}
                }]
            };
            renderLeafletRoute(containerId, window.lastRouteGeojsons[containerId], points, {}, day);
            if (typeof updateRouteStatsUI === 'function') updateRouteStatsUI(day);

            let expandedMapDiv =
                document.getElementById(`expanded-map-${day}`) ||
                document.getElementById(`expanded-route-map-day${day}`);
            if (expandedMapDiv) {
                let expandedScaleBar = document.getElementById(`expanded-route-scale-bar-day${day}`);
                if (!expandedScaleBar) {
                    expandedScaleBar = document.createElement('div');
                    expandedScaleBar.id = `expanded-route-scale-bar-day${day}`;
                    expandedScaleBar.className = 'route-scale-bar expanded';
                    expandedMapDiv.parentNode.insertBefore(expandedScaleBar, expandedMapDiv.nextSibling);
                }
                expandedScaleBar.style.display = "block";
                expandedScaleBar.innerHTML = "";
                renderRouteScaleBar(expandedScaleBar, 0, []);
            }
            // Hata durumu, 3D haritayı güncelle
            document.dispatchEvent(new CustomEvent('tripUpdated', { detail: { day: day } }));
            return;
        } else {
            let totalKm = 0;
            let markerPositions = [];
            for (let i = 0; i < points.length; i++) {
                if (i > 0) {
                    const d = haversine(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng) / 1000;
                    totalKm += d;
                }
                markerPositions.push({
                    name: points[i].name || "",
                    distance: Math.round(totalKm * 1000) / 1000,
                    lat: points[i].lat,
                    lng: points[i].lng
                });
            }
            let SABIT_HIZ_KMH = 4;
            let durationSec = Math.round(totalKm / SABIT_HIZ_KMH * 3600);
            const summary = {
                distance: Math.round(totalKm * 1000),
                duration: durationSec
            };
            let ascent = 0, descent = 0;
            try {
                const N = Math.max(12, Math.min(24, points.length));
                let samples = [];
                for (let i = 0; i < N; i++) {
                    const t = i / (N - 1);
                    const idx = Math.floor(t * (points.length - 1));
                    samples.push(points[idx]);
                }
                if (window.getElevationsForRoute) {
                    const elevations = await window.getElevationsForRoute(samples);
                    if (elevations && elevations.length === samples.length) {
                        for (let i = 1; i < elevations.length; i++) {
                            const diff = elevations[i] - elevations[i - 1];
                            if (diff > 0) ascent += diff;
                            else descent -= diff;
                        }
                    }
                }
            } catch (err) { }
            summary.ascent = Math.round(ascent);
            summary.descent = Math.round(descent);

            window.lastRouteSummaries = window.lastRouteSummaries || {};
            window.lastRouteSummaries[containerId] = summary;
            window.lastRouteGeojsons = window.lastRouteGeojsons || {};
            window.lastRouteGeojsons[containerId] = {
                type: "FeatureCollection",
                features: [{
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: points.map(p => [p.lng, p.lat])
                    },
                    properties: {}
                }]
            };
            renderLeafletRoute(containerId, window.lastRouteGeojsons[containerId], points, summary, day);
            if (typeof updateRouteStatsUI === 'function') updateRouteStatsUI(day);

            let expandedMapDiv =
                document.getElementById(`expanded-map-${day}`) ||
                document.getElementById(`expanded-route-map-day${day}`);
            if (expandedMapDiv) {
    let expandedScaleBar = document.getElementById(`expanded-route-scale-bar-day${day}`);
    if (!expandedScaleBar) {
        expandedScaleBar = document.createElement('div');
        expandedScaleBar.id = `expanded-route-scale-bar-day${day}`;
        expandedScaleBar.className = 'route-scale-bar expanded';
        expandedMapDiv.parentNode.insertBefore(expandedScaleBar, expandedMapDiv.nextSibling);
    }

    // --- ÖNEMLİ: GECİKMELİ VE KONTROLLÜ RENDER ---
    const ensureScaleBarRender = (retryCount = 0) => {
        // Elementin gerçekten DOM'da genişliğe sahip olup olmadığını kontrol et
        const width = expandedScaleBar.offsetWidth;
        
        if (width === 0 && retryCount < 10) {
            // Eğer genişlik hala 0 ise (accordion açılıyor olabilir), 200ms sonra tekrar dene
            setTimeout(() => ensureScaleBarRender(retryCount + 1), 200);
            return;
        }

        expandedScaleBar.style.display = "block";
        expandedScaleBar.innerHTML = "";
        
        if (typeof renderRouteScaleBar === 'function') {
            renderRouteScaleBar(expandedScaleBar, totalKm, markerPositions);
            
            // elevation-works.js içindeki createScaleElements'i tetikle
            const track = expandedScaleBar.querySelector('.scale-bar-track');
            if (track) {
        track.classList.add('loading'); // CSS'teki spinner'ı tetikler
    }
            if (track && typeof createScaleElements === 'function') {
                createScaleElements(track, track.offsetWidth, totalKm, 0, markerPositions);
            }
        }
    };

    ensureScaleBarRender(); // İlk denemeyi başlat
}
            // Yurtdışı modunda güncelleme
            document.dispatchEvent(new CustomEvent('tripUpdated', { detail: { day: day } }));
            return;
        }
    }

    // coords: [[lon,lat], ...]
async function fetchRoutePartial(coords, day) {
    for (let n = coords.length; n >= 2; n--) {
        const subset = coords.slice(0, n);
        const coordParam = subset.map(c => `${c[0]},${c[1]}`).join(';');
        const url = buildDirectionsUrl(coordParam, day);
        try {
            const response = await fetch(url);
            if (!response.ok) continue;
            const data = await response.json();
            if (!data.routes || !data.routes[0] || !data.routes[0].geometry) continue;
            return {
                routeData: {
                    geojson: {
                        type: 'FeatureCollection',
                        features: [{
                            type: 'Feature',
                            geometry: data.routes[0].geometry,
                            properties: {
                                summary: {
                                    distance: data.routes[0].distance,
                                    duration: data.routes[0].duration,
                                    source: 'OSRM'
                                }
                            }
                        }]
                    },
                    coords: data.routes[0].geometry.coordinates,
                    summary: {
                        distance: data.routes[0].distance,
                        duration: data.routes[0].duration
                    },
                    legs: data.routes[0].legs
                },
                usedCount: n,                  // kaç noktaya kadar çizildi
                missingCoords: coords.slice(n-1) // kalanlar (kesik çizgi için)
            };
        } catch (_) { /* sonraki kısaltılmış denemeye geç */ }
    }
    return null;
}
async function fetchRoute() {
        const coordParam = coordinates.map(c => `${c[0]},${c[1]}`).join(';');
        const url = buildDirectionsUrl(coordParam, day);
        const response = await fetch(url);
        if (!response.ok) {
    throw new Error(`Route HTTP ${response.status}`);
}
        const data = await response.json();
        if (!data.routes || !data.routes[0] || !data.routes[0].geometry) throw new Error('No route found');

        return {
            geojson: {
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    geometry: data.routes[0].geometry,
                    properties: {
                        summary: {
                            distance: data.routes[0].distance,
                            duration: data.routes[0].duration,
                            source: 'OSRM'
                        }
                    }
                }]
            },
            coords: data.routes[0].geometry.coordinates,
            summary: {
                distance: data.routes[0].distance,
                duration: data.routes[0].duration
            },
            legs: data.routes[0].legs
        };
    }

let routeData;
let missingPoints = [];
try {
    const partial = await fetchRoutePartial(coordinates, day);
    if (!partial) throw new Error('Route not reachable');

    routeData = partial.routeData;

    // Başarılı çizilen noktalar dışındaki (kalan) noktaları missing olarak işaretle
    const usedCount = partial.usedCount;
    missingPoints = snappedPoints.slice(usedCount - 1); // son kullanılan + sonrası

} catch (e) {
    console.warn('Parçalı rota da çizilemedi, fallback devre dışı (isteğinize göre). Hata:', e);
    const infoPanel = document.getElementById(`route-info-day${day}`);
    if (infoPanel) infoPanel.textContent = ""; // Uyarı göstermeyin
    return;
}

    const infoPanel = document.getElementById(`route-info-day${day}`);
    if (missingPoints.length > 0) {
        if (infoPanel) {
            infoPanel.innerHTML = `<span style="color:#d32f2f;font-size:0.85rem;font-weight:500;margin-bottom:20px;">
            <strong>Note:</strong> Some points could not be included in the route!<br>
            <strong>Missing:</strong> ${missingPoints.map(p => p.name).join(', ')}
            </span>`;
        }
    } else if (infoPanel) {
        infoPanel.textContent = "";
    }

    window.lastRouteGeojsons = window.lastRouteGeojsons || {};
    window.lastRouteGeojsons[containerId] = routeData.geojson;
    window.lastRouteSummaries = window.lastRouteSummaries || {};
    window.lastRouteSummaries[containerId] = routeData.summary;

    window.directionsPolylines = window.directionsPolylines || {};
    if (routeData && Array.isArray(routeData.coords) && routeData.coords.length > 1) {
        window.directionsPolylines[day] = routeData.coords.map(c => ({ lat: c[1], lng: c[0] }));
    } else {
        if (!window.directionsPolylines[day]) {
            const pts = getDayPoints(day);
            if (pts.length >= 2) {
                window.directionsPolylines[day] = pts;
            }
        }
    }

   // ============================================================
    // 🛑 KESİN 200 KM DUVARI (OSRM VERİSİ İLE KONTROL)
    // ============================================================

    if (routeData && routeData.summary && routeData.summary.distance > 600000) {
        
        // --- ÇİFTE UYARI KİLİDİ ---
        const now = Date.now();
        if (window._lastLimitAlertTime && (now - window._lastLimitAlertTime < 2000)) {
            return; // 2 saniye içinde ikinci uyarıyı verme, sessizce çık.
        }
        window._lastLimitAlertTime = now;

        console.error(`⛔ ROUTE BLOCKED: Actual Road Distance ${routeData.summary.distance}m > 600000m`);

        // 1. O günün son eklenen item'ını bul ve sil
        const currentDayItems = window.cart.filter(item => item.day == day);
        if (currentDayItems.length > 1) { 
            const itemToRemove = currentDayItems[currentDayItems.length - 1]; 
            const removeIndex = window.cart.indexOf(itemToRemove);
            
            if (removeIndex > -1) {
                window.cart.splice(removeIndex, 1);
                console.warn("Item removed:", itemToRemove.name);
            }
        }

        // 2. Kullanıcıya Uyarı
        if (typeof showToast === "function") {
            showToast("⛔ Route limit (600km) exceeded! Last location removed.", "error");
        } else {
            alert("⛔ Route limit (600km) exceeded! Last location removed.");
        }

        // 3. KRİTİK TEMİZLİK: Önbelleği temizle ki Scale Bar bozulmasın
        if (typeof clearRouteCachesForDay === 'function') {
            clearRouteCachesForDay(day); // O günün rota hesaplarını sıfırla
        }
        if (typeof clearRouteVisualsForDay === 'function') {
            clearRouteVisualsForDay(day); // Haritadaki çizgileri temizle
        }

        // Global rota verilerini de manuel sıfırla (Garanti olsun)
        if (window.lastRouteGeojsons) window.lastRouteGeojsons[containerId] = null;
        if (window.lastRouteSummaries) window.lastRouteSummaries[containerId] = null;

        // 4. Arayüzü Yenile (updateCart temizlenmiş veriyle sıfırdan çizecek)
        if (typeof updateCart === "function") {
            // Süreyi 50ms'den 100ms'ye çıkardık, DOM iyice temizlensin.
            setTimeout(() => {
                console.log("♻️ Refreshing cart after limit clean-up...");
                updateCart(); 
            }, 100);
        }
        
        return; // 🛑 ÇİZİMİ DURDUR
    }
    // ============================================================
    
    // 2D Haritayı Çiz (Buradaki 'points' parametresi doğru, değiştirmeyin)
    renderLeafletRoute(containerId, routeData.geojson, points, routeData.summary, day, missingPoints);
    const expandedMapObj = window.expandedMaps?.[containerId];
    if (expandedMapObj?.expandedMap) {
        updateExpandedMap(expandedMapObj.expandedMap, day);
    }

    const pairwiseSummaries = [];
    if (
        typeof routeData !== "undefined" &&
        Array.isArray(routeData.legs)
    ) {
        for (let i = 0; i < routeData.legs.length; i++) {
            pairwiseSummaries.push({
                distance: routeData.legs[i].distance,
                duration: routeData.legs[i].duration
            });
        }
    }
    window.pairwiseRouteSummaries = window.pairwiseRouteSummaries || {};
    window.pairwiseRouteSummaries[containerId] = pairwiseSummaries;

    if (routeData.summary && typeof updateDistanceDurationUI === 'function') {
        updateDistanceDurationUI(routeData.summary.distance, routeData.summary.duration);
    }

    const hint = document.querySelector(`#route-map-day${day} .empty-map-hint`);
    if (hint) hint.remove();

    setTimeout(() => typeof updateRouteStatsUI === 'function' && updateRouteStatsUI(day), 200);
    if (typeof adjustExpandedHeader === 'function') adjustExpandedHeader(day);

    // <--- ÇÖZÜM BURADA --->
    // 2. ADIM (OSRM KISMI İÇİN):
    // Veri (routeData) geldi, global değişkene yazıldı ve 2D harita çizildi.
    // ŞİMDİ 3D haritaya "Bak veri hazır, index'i de -1 yaptım, git GENEL GÖRÜNÜMÜ çiz" diyoruz.
    document.dispatchEvent(new CustomEvent('tripUpdated', { detail: { day: day } }));
    

    // console.log(`=== RENDER END for day ${day} ===`);

}


function disableAllMarkerDragging(expandedMap) {
    expandedMap.eachLayer(layer => {
        if (layer instanceof L.Marker && layer.dragging && layer.dragging.enabled && layer.dragging.enabled()) {
            layer.dragging.disable();
        }
    });
}

// Show name bubble once with animation, then hide (no X)
function showNameBubbleOnce(marker) {
  const box = marker.getElement()?.querySelector('.custom-marker-place-name');
  if (!box) return;

  // Hide X for this ephemeral view
  const xBtn = box.querySelector('.marker-remove-x-btn');
  if (xBtn) xBtn.style.display = 'none';

  // Restart animation cleanly
  box.classList.remove('name-bubble-animate');
  // Force reflow to restart animation
  void box.offsetWidth;
  box.classList.add('name-bubble-animate');

  // Ensure it's visible during the animation
  box.style.opacity = 1;

  // Clear previous timer
  if (marker._nameBubbleTimer) clearTimeout(marker._nameBubbleTimer);
  marker._nameBubbleTimer = setTimeout(() => {
    box.style.opacity = 0;
    box.classList.remove('name-bubble-animate');
    marker._nameBubbleTimer = null;
  }, 1000);
}

// Top hint (1s) — independent of normal popups
function showTransientDragHint(marker, map, text = 'Drag to reposition') {
  // Clear previous hint if any
  if (marker._hintTempPopup && map.hasLayer(marker._hintTempPopup)) {
    map.removeLayer(marker._hintTempPopup);
    marker._hintTempPopup = null;
  }
  if (marker._hintTimer) {
    clearTimeout(marker._hintTimer);
    marker._hintTimer = null;
  }

  const popup = L.popup({
    className: 'drag-hint-popup',
    closeButton: false,
    autoClose: false,
    closeOnClick: false,
    autoPan: false,
    offset: [0, -28]
  })
    .setLatLng(marker.getLatLng())
    .setContent(text)
    .addTo(map); // IMPORTANT: do NOT use openOn(map) to avoid closing other popups

  marker._hintTempPopup = popup;

  marker._hintTimer = setTimeout(() => {
    if (marker._hintTempPopup && map.hasLayer(marker._hintTempPopup)) {
      map.removeLayer(marker._hintTempPopup);
    }
    marker._hintTempPopup = null;
    marker._hintTimer = null;
  }, 1000);
}

function addDraggableMarkersToExpandedMap(expandedMap, day) {
  function disableAllMarkerDragging(map) {
    map.eachLayer(l => {
      if (l instanceof L.Marker && l.dragging && l.dragging.enabled && l.dragging.enabled()) {
        l.dragging.disable();
      }
    });
  }

  function clearAllMarkersUI() {
    document.querySelectorAll('.custom-marker-outer').forEach(outer => {
      outer.classList.remove('green', 'spin', 'show-name', 'show-drag-hint');
      outer.classList.add('red');
    });
    document.querySelectorAll('.custom-marker-place-name').forEach(el => {
      el.style.opacity = 0;
      const btn = el.querySelector('.marker-remove-x-btn');
      if (btn) btn.style.display = 'none';
      el.classList.remove('name-bubble-animate');
    });
  }

  function activateMarkerUI(marker) {
    clearAllMarkersUI();
    const outer = marker.getElement()?.querySelector('.custom-marker-outer');
    if (outer) {
      outer.classList.remove('red');
      outer.classList.add('green', 'spin');
    }
  }

  function showDragArrows(marker) {
    const outer = marker.getElement()?.querySelector('.custom-marker-outer');
    if (!outer) return;
    let hint = outer.querySelector('.drag-hint');
    if (!hint) {
      hint = document.createElement('div');
      hint.className = 'drag-hint';
      hint.innerHTML = `
        <span class="arrow up"></span>
        <span class="arrow right"></span>
        <span class="arrow down"></span>
        <span class="arrow left"></span>
      `;
      outer.appendChild(hint);
    }
    outer.classList.add('show-drag-hint');
  }

  function hideDragArrows(marker) {
    const outer = marker.getElement()?.querySelector('.custom-marker-outer');
    if (outer) outer.classList.remove('show-drag-hint');
  }

  function updatePlaceNameOnMarker(marker, newName) {
    const nameBox = marker.getElement()?.querySelector('.custom-marker-place-name');
    if (nameBox) {
      if (nameBox.childNodes && nameBox.childNodes.length) nameBox.childNodes[0].nodeValue = newName;
      else nameBox.prepend(document.createTextNode(newName));
    }
  }

  function findCartIndexByDayPosition(dayNum, positionIdx) {
    let n = 0;
    for (let i = 0; i < window.cart.length; i++) {
      const it = window.cart[i];
      if (it.day == dayNum && it.location && !isNaN(it.location.lat) && !isNaN(it.location.lng)) {
        if (n === positionIdx) return i;
        n++;
      }
    }
    return -1;
  }

  expandedMap.eachLayer(l => {
    if (l instanceof L.Marker) expandedMap.removeLayer(l);
  });

  const points = getDayPoints(day);

  points.forEach((p, idx) => {
    let currentName = p.name || '';

    const markerHtml = `
      <div class="custom-marker-outer red" data-idx="${idx}" style="position:relative; cursor: pointer;">
        <span class="custom-marker-label">${idx + 1}</span>
      </div>
      <div class="custom-marker-place-name" id="marker-name-${idx}" style="opacity:0;position:relative;">
        ${currentName}
        <button class="marker-remove-x-btn" data-marker-idx="${idx}" style="display:none;">&times;</button>
      </div>
    `;
    const icon = L.divIcon({
      html: markerHtml,
      className: "",
      iconSize: [32, 48],
      iconAnchor: [16, 16]
    });
    
    const marker = L.marker([p.lat, p.lng], {
      draggable: false,
      icon
    }).addTo(expandedMap);

    // [DÜZELTME 1] autoPan: false
    marker.bindPopup(`
      <div style="min-width:120px;">
        <b>${p.name || "Point"}</b><br>
        <button class="remove-marker-btn" data-day="${day}" data-idx="${idx}" style="font-size: 0.8rem !important">Remove place</button>
      </div>
    `, {
        offset: [0, -20], //
      autoClose: false,
      closeButton: true,
      autoPan: false // Popup açılınca harita kaymasın
    });

    // --- POPUP İÇİNDEKİ SİLME BUTONU ---
    marker.on('popupopen', function(e) {
      setTimeout(() => {
        const btn = document.querySelector('.remove-marker-btn[data-day="' + day + '"][data-idx="' + idx + '"]');
        if (btn) {
          btn.onclick = async function() { 
            let n = 0;
            for (let i = 0; i < window.cart.length; i++) {
              const it = window.cart[i];
              if (it.day == day && it.location && !isNaN(it.location.lat) && !isNaN(it.location.lng)) {
                if (n === idx) {
                  window.cart.splice(i, 1);
                  if (typeof updateCart === "function") await updateCart();
                  if (typeof saveCurrentTripToStorage === "function") saveCurrentTripToStorage();
                  marker.closePopup();
                  break;
                }
                n++;
              }
            }
          }
        }
      }, 10);
    });

    // --- MARKER ÜZERİNDEKİ "X" BUTONU ---
    marker.once('add', () => {
      const nameBox = marker.getElement()?.querySelector('.custom-marker-place-name');
      const xBtn = nameBox?.querySelector('.marker-remove-x-btn');
      if (xBtn) {
        xBtn.onclick = async (e) => { 
          e.stopPropagation();
          const cartIdx = findCartIndexByDayPosition(day, idx);
          if (cartIdx > -1) {
            window.cart.splice(cartIdx, 1);
            if (typeof updateCart === "function") await updateCart();
            if (typeof saveCurrentTripToStorage === "function") saveCurrentTripToStorage();
          }
        };
      }
    });

    // --- [KRİTİK DÜZELTME 2] TIKLAMA OLAYI VE ORTALAMA (FLYTO) ---
    marker.on('click', (e) => {
        // Olayın haritaya yayılmasını engelle (yoksa harita tıklaması algılanıp seçim kalkabilir)
        if (e.originalEvent) e.originalEvent.stopPropagation();

        // 1. Haritayı marker'a ortala (flyTo)
        expandedMap.flyTo([p.lat, p.lng], expandedMap.getZoom(), {
            animate: true,
            duration: 0.5
        });

        // 2. Marker UI ve Drag işlemleri
        const outer = marker.getElement()?.querySelector('.custom-marker-outer');
        const wasActive = outer && outer.classList.contains('green');
        
        disableAllMarkerDragging(expandedMap);
        clearAllMarkersUI();

        if (!wasActive) {
            if (marker.dragging && marker.dragging.enable) marker.dragging.enable();
            activateMarkerUI(marker);
            showDragArrows(marker);
            showTransientDragHint(marker, expandedMap, 'Drag to reposition'); // İsteğe bağlı
            marker.openPopup();
            
            const box = marker.getElement()?.querySelector('.custom-marker-place-name');
            if (box) {
                box.style.opacity = 0;
                box.classList.remove('name-bubble-animate');
                const xBtn = box.querySelector('.marker-remove-x-btn');
                if (xBtn) xBtn.style.display = 'none';
            }
            if ('vibrate' in navigator) navigator.vibrate(15);
        } else {
            marker.closePopup();
        }
    });

    marker.on('dragstart', () => {
      window.__tt_markerDragActive = true;
      hideDragArrows(marker);
      const box = marker.getElement()?.querySelector('.custom-marker-place-name');
      if (box) {
        box.style.opacity = 0;
        box.classList.remove('name-bubble-animate');
      }
    });

    marker.on('dragend', async (e) => {
      const dropped = e.target.getLatLng();
      let finalLatLng = dropped;
      
      try {
        const snapped = await snapPointToRoad(dropped.lat, dropped.lng);
        finalLatLng = L.latLng(snapped.lat, snapped.lng);
      } catch (_) {}

      let info = { name: currentName, address: "", opening_hours: "" };
      try {
        info = await getPlaceInfoFromLatLng(dropped.lat, dropped.lng);
      } catch (_) {}

      currentName = info.name || currentName;
      updatePlaceNameOnMarker(marker, currentName);

      const cartIdx = findCartIndexByDayPosition(day, idx);
      if (cartIdx > -1) {
        const it = window.cart[cartIdx];
        it.location.lat = dropped.lat;
        it.location.lng = dropped.lng;
        it.name = currentName || it.name;
        it.address = info.address || it.address;
        it.opening_hours = info.opening_hours || it.opening_hours;

        let guessedCategory = '';
        if (/park/i.test(it.name)) guessedCategory = "park";
        else if (/otel|hotel/i.test(it.name)) guessedCategory = "hotel";
        else if (/restoran|restaurant/i.test(it.name)) guessedCategory = "restaurant";
        else if (/müze|museum/i.test(it.name)) guessedCategory = "museum";
        const city = window.selectedCity || "";
        try {
          const newImg = await getImageForPlace(it.name, guessedCategory, city);
          if (newImg) it.image = newImg;
        } catch (_) {}
      }

      if (typeof updateCart === "function") updateCart();
      
      if (marker.dragging && marker.dragging.disable) marker.dragging.disable();
      window.__tt_markerDragActive = false;
      if (typeof saveCurrentTripToStorage === "function") saveCurrentTripToStorage();

      L.popup().setLatLng(finalLatLng).setContent('Location updated').addTo(expandedMap);

      const containerId = `expanded-route-scale-bar-day${day}`;
      const scaleBarDiv = document.getElementById(containerId);
      const routeContainerId = `route-map-day${day}`;
      
      const updatedSummary = window.lastRouteSummaries?.[routeContainerId];
      const totalKm = (updatedSummary?.distance || 0) / 1000;
      const markerPositions = getRouteMarkerPositionsOrdered(day);

      if (scaleBarDiv && totalKm > 0 && markerPositions.length > 0) {
        try { delete scaleBarDiv.dataset.elevLoadedKey; } catch (_) {}
        scaleBarDiv.innerHTML = `
          <div class="scale-bar-track">
            <div class="elevation-placeholder" style="
              width: 100%;
              height: 130px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              color: #6c757d;
              font-size: 14px;
              position: absolute;
              top: 0;
              left: 0;
              background: rgba(255, 255, 255, 0.95);
              z-index: 1000;
            ">
              <div class="tt-scale-loader" style="display: flex; align-items: center; gap: 10px;">
                <div class="spinner"></div>
                <div class="txt">Loading elevation</div>
              </div>
            </div>
          </div>
        `;
        renderRouteScaleBar(scaleBarDiv, totalKm, markerPositions);
        
        const track = scaleBarDiv.querySelector('.scale-bar-track');
        if (track) {
          const width = Math.max(200, Math.round(track.getBoundingClientRect().width));
          createScaleElements(track, width, totalKm, 0, markerPositions);
        }
      } else if (scaleBarDiv) {
        scaleBarDiv.innerHTML = `
          <div class="scale-bar-track">
            <div class="elevation-placeholder" style="
              width: 100%;
              height: 130px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              color: #6c757d;
              font-size: 14px;
              position: absolute;
              top: 0;
              left: 0;
              background: rgba(255, 255, 255, 0.95);
              z-index: 1000;
            ">
              <div class="tt-scale-loader" style="display: flex; align-items: center; gap: 10px;">
                <div class="spinner"></div>
                <div class="txt">Loading elevation</div>
              </div>
            </div>
          </div>
        `;
      }
    });
  });

  expandedMap.on('click', () => {
    disableAllMarkerDragging(expandedMap);
    clearAllMarkersUI();
  });

  const scaleBarDiv = document.getElementById(`expanded-route-scale-bar-day${day}`);
  if (scaleBarDiv) {
    try { delete scaleBarDiv.dataset.elevLoadedKey; } catch (_) {}
  }
}



function getDayPoints(day) {
  return window.cart
    .filter(item =>
      item.day == day &&
      item.location &&
      isFinite(Number(item.location.lat)) &&
      isFinite(Number(item.location.lng))
    )
    .map(item => ({
      lat: Number(item.location.lat),
      lng: Number(item.location.lng),
      name: item.name
    }));
}

function isPointReallyMissing(point, polylineCoords, maxDistanceMeters = 100) {
    // Polyline'ın başı ve sonu
    const start = polylineCoords[0];
    const end = polylineCoords[polylineCoords.length - 1];

  

    // Polyline üzerindeki en yakın noktayı ve mesafesini bul
    let minDist = Infinity, minIdx = -1;
    for (let i = 0; i < polylineCoords.length; i++) {
        const [lng, lat] = polylineCoords[i];
        const dist = haversine(lat, lng, point.lat, point.lng);
        if (dist < minDist) {
            minDist = dist;
            minIdx = i;
        }
    }

    if (
        (minIdx === 0 || minIdx === polylineCoords.length - 1) &&
        minDist < maxDistanceMeters + 80 // 100 + 80m buffer: gerçek otel, köşe, kavşak gibi
    ) {
        return false;
    }
    return minDist > maxDistanceMeters;
}
function adjustExpandedHeader(day){
  const header = document.querySelector(`#expanded-map-${day} .expanded-map-header`);
  if(!header) return;
  const pts = (typeof getDayPoints==="function") ? getDayPoints(day) : [];
  if (pts.length < 2) {
    header.style.position = 'absolute';
    header.style.top = 'auto';
    header.style.bottom = '0';
  } else {
    header.style.position = '';
    header.style.top = '';
    header.style.bottom = '';
  }
}
function addPolylineSafe(map, latlngs, options) {
  if (!map) return null;
  if (!map._loaded) {
    map.whenReady(() => addPolylineSafe(map, latlngs, options));
    return null;
  }
  try {
    return L.polyline(latlngs, options).addTo(map);
  } catch (e) {
    console.warn('[polyline-safe] canvas failed, fallback to SVG', e);
    // Son çare: map.removeLayer(renderer) vs. gerek yok, Leaflet fallback edecektir.
    return L.polyline(latlngs, options).addTo(map);
  }
}

function addCircleMarkerSafe(map, latlng, options) {
  if (!map) return null;
  if (!map._loaded) {
    map.whenReady(() => addCircleMarkerSafe(map, latlng, options));
    return null;
  }
  try {
    return L.circleMarker(latlng, options).addTo(map);
  } catch (e) {
    console.warn('[circlemarker-safe] fallback', e);
    return L.circleMarker(latlng, options).addTo(map);
  }
}


// Helper: fallback route when routing fails (straight line between points)
function buildFallbackRouteGeojson(points, mode = 'driving') {
    if (!points || points.length < 2) return null;
    const speed = mode === 'walking' ? 1.4 : mode === 'cycling' ? 4.5 : 11;
    const coords = points.map(p => [p.lng, p.lat]);
    const pairwise = [];
    let totalDist = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const d = haversine(points[i].lat, points[i].lng, points[i + 1].lat, points[i + 1].lng);
        pairwise.push({ distance: d, duration: d / speed });
        totalDist += d;
    }
    const duration = totalDist / speed;
    return {
        geojson: {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: coords },
                properties: { summary: { distance: totalDist, duration, source: 'fallback-straight-line' } }
            }]
        },
        summary: { distance: totalDist, duration },
        pairwise
    };
}

function clearDistanceLabels(day) {
    document.querySelectorAll(`#route-map-day${day} .distance-label, #route-info-day${day} .distance-label`).forEach(label => {
        label.innerHTML = "";
    });
}


function addGeziPlanMarkers(map, poiList, currentDay) {
  poiList.forEach((poi) => {
    const marker = L.marker([poi.lat, poi.lng]).addTo(map);

    const popupDiv = document.createElement('div');
    popupDiv.style.display = 'flex';
    popupDiv.style.flexDirection = 'column';
    popupDiv.style.alignItems = 'flex-start';

    const nameEl = document.createElement('div');
    nameEl.textContent = poi.name;
    nameEl.style.fontWeight = 'bold';
    nameEl.style.marginBottom = '8px';
    popupDiv.appendChild(nameEl);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = 'Add to Trip';
    addBtn.style.padding = '8px 12px';
    addBtn.style.background = '#1976d2';
    addBtn.style.color = '#fff';
    addBtn.style.border = 'none';
    addBtn.style.borderRadius = '6px';
    addBtn.style.cursor = 'pointer';

    addBtn.onclick = function () {
      const exists = window.cart.some(item =>
        item.day == currentDay &&
        item.name === poi.name &&
        item.location &&
        item.location.lat === poi.lat &&
        item.location.lng === poi.lng
      );
      if (!exists) {
        addToCart(
          poi.name,
          poi.image || "img/placeholder.png",
          currentDay,
          "Place",
          poi.address || "",
          null,
          null,
          poi.opening_hours || "",
          null,
          { lat: poi.lat, lng: poi.lng },
          poi.website || ""
        );
        marker.closePopup();
        marker.setOpacity(0.5);
      }
    };

    popupDiv.appendChild(addBtn);

  marker.bindPopup(`<b>${poi.name || "Point"}</b>`, { autoClose: false, closeButton: true });

  });
}

window.leafletMaps = {};


function getActiveDay(containerId) {

    const dayMatch = containerId.match(/day(\d+)/);
    return dayMatch ? parseInt(dayMatch[1], 10) : 1;
}




  function toggleMenu() {
        document.getElementById("menuDropdown").classList.toggle("show");
    }
    document.addEventListener("click", function(event) {
        if (!event.target.closest(".menuBox")) {
            document.getElementById("menuDropdown").classList.remove("show");
        }
    });


                       function switchToLogin() {
    document.getElementById("login-form").classList.remove("hidden");
    document.getElementById("signup-form").classList.add("hidden");
}

function switchToSignup() {
    document.getElementById("signup-form").classList.remove("hidden");
    document.getElementById("login-form").classList.add("hidden");
}


    // Butonlara click eventi ekle
    document.querySelectorAll('.suggest-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            showLoadingPanel();
            // Sorgu bitince paneli kapat örnek: 2sn sonra gizle
            setTimeout(hideLoadingPanel, 2000);
        });
    });


window.leafletMaps = window.leafletMaps || {};


const PLACEHOLDER_IMG = "img/placeholder.png";

function setupSidebarAccordion() {
  document.querySelectorAll('.day-header').forEach(header => {
    header.onclick = function(e) {
      if (
        e.target.classList.contains('edit-day-btn') ||
        e.target.classList.contains('remove-action-button') ||
        e.target.classList.contains('reset-action-button') ||
        e.target.closest('.action-buttons-container')
      ) return;

      const dayContainer = header.closest('.day-container');
      if (!dayContainer) return;

      const day = dayContainer.dataset.day || dayContainer.id.replace('day-container-', '');

      // Yardımcı: hem class toggle et, hem inline display yönet
      const toggleHide = (el) => {
        if (!el) return;
        el.classList.toggle('collapsed');
        el.style.display = el.classList.contains('collapsed') ? 'none' : '';
      };

      ['.day-list', '.route-map', '.route-info'].forEach(sel => {
        const el = dayContainer.querySelector(sel);
        if (el) el.classList.toggle('collapsed'); // bunlarda mevcut CSS zaten çalışıyorsa kalsın
      });

      // Route controls bar kesin gizlensin/gösterilsin (inline ile)
      const bar = document.getElementById(`route-controls-bar-day${day}`);
      if (bar) {
        toggleHide(bar);
      } else {
        // Bar yoksa fallback: alt özet wrapper + travel mode set’i ayrı ayrı kontrol et
        toggleHide(document.getElementById(`map-bottom-controls-wrapper-day${day}`));
        toggleHide(document.getElementById(`tt-travel-mode-set-day${day}`));
      }

      const next = dayContainer.nextElementSibling;
      if (next && next.classList.contains('add-more-btn')) {
        next.classList.toggle('collapsed');
      }
    };
  });
}   

// DÜZELTİLMİŞ FONKSİYON 1
function getRouteMarkerPositionsOrdered(day) {
    const containerId = `route-map-day${day}`;
    const geojson = window.lastRouteGeojsons?.[containerId];

    if (!geojson ||
        !geojson.features ||
        !geojson.features[0] ||
        !geojson.features[0].geometry ||
        !Array.isArray(geojson.features[0].geometry.coordinates)
    ) return [];

    const routeCoords = geojson.features[0].geometry.coordinates;
    const points = getDayPoints(day);


    let polylineDistances = [0];
    for (let i = 1; i < routeCoords.length; i++) {
        const [lon1, lat1] = routeCoords[i - 1];
        const [lon2, lat2] = routeCoords[i];
        const segDist = haversine(lat1, lon1, lat2, lon2);
        polylineDistances[i] = polylineDistances[i - 1] + segDist;
    }

    const geomTotal = polylineDistances[polylineDistances.length - 1] || 1;
    const summary = window.lastRouteSummaries?.[containerId];
    const apiTotal = (summary && summary.distance) ? summary.distance : geomTotal;
    const globalRatio = geomTotal > 0 ? (apiTotal / geomTotal) : 1;

    return points.map((marker, index) => {
        // --- KRİTİK EKLEME: GLOBAL SIRA NUMARASI ---
        const globalIndex = index + 1;
        // -------------------------------------------

        if (index === 0) {
            return { name: marker.name, distance: 0, snapped: true, snappedDistance: 0, originalIndex: globalIndex };
        }
        if (index === points.length - 1) {
            return { name: marker.name, distance: apiTotal / 1000, snapped: true, snappedDistance: 0, originalIndex: globalIndex };
        }
        
        let bestIdx = 0, bestDist = Infinity;
        for (let i = 0; i < routeCoords.length; i++) {
            const [lon, lat] = routeCoords[i];
            const d = haversine(lat, lon, marker.lat, marker.lng);
            if (d < bestDist) {
                bestDist = d;
                bestIdx = i;
            }
        }
        let geomDistAtMarker = polylineDistances[bestIdx];
        let finalDist = geomDistAtMarker * globalRatio;

        return {
            name: marker.name,
            distance: finalDist / 1000, 
            snapped: bestDist <= 200,   
            snappedDistance: bestDist,
            originalIndex: globalIndex // <-- Bunu Scale Bar okuyacak
        };
    });
}

function getPlacePriority(props) {
    const type = props.result_type || props.place_type || '';
    if (['city', 'municipality', 'town', 'county'].includes(type)) return 1; // şehirler en üstte!
    if (['country', 'state', 'region'].includes(type)) return 2;
    if (['district', 'suburb', 'borough'].includes(type)) return 3;
    if (['village', 'hamlet', 'settlement'].includes(type)) return 4;
    if (['neighbourhood', 'quarter', 'locality'].includes(type)) return 5;
    if (['street', 'place', 'address', 'postcode'].includes(type)) return 6;
    return 99;
}

function sortLocations(locations) {
    return locations.sort((a, b) => {
        const ap = getPlacePriority(a.properties);
        const bp = getPlacePriority(b.properties);
        if (ap !== bp) return ap - bp;
        const aname = (a.properties.city || a.properties.name || '').toLowerCase();
        const bname = (b.properties.city || b.properties.name || '').toLowerCase();
        return aname.localeCompare(bname);
    });
}

function setAllDayListBorders(active) {
    document.querySelectorAll('.day-list').forEach(dayList => {
        if (active) {
            dayList.classList.add('day-list-active');
        } else {
            dayList.classList.remove('day-list-active');
        }
    });
}


const TT_TRAVEL_MODE_BY_DAY_KEY = 'tt_travel_mode_by_day';

// Load per-day mapping once
window.travelModeByDay = (() => {
  try { return JSON.parse(localStorage.getItem(TT_TRAVEL_MODE_BY_DAY_KEY)) || {}; }
  catch { return {}; }
})();

// Legacy default (used only as fallback if a day has no stored mode)
const LEGACY_DEFAULT_MODE = localStorage.getItem('tt_travel_mode') || 'driving';

// Get the travel mode for a given day
function getTravelModeForDay(day) {
  const d = parseInt(day || 1, 10);
  const m = window.travelModeByDay[d] || LEGACY_DEFAULT_MODE || 'driving';
  return (['driving', 'cycling', 'walking'].includes(m) ? m : 'driving');
}

// Save a day's travel mode
function saveTravelModeForDay(day, mode) {
  const d = parseInt(day || 1, 10);
  window.travelModeByDay[d] = mode;
  localStorage.setItem(TT_TRAVEL_MODE_BY_DAY_KEY, JSON.stringify(window.travelModeByDay));
}


// Day-aware profile getter
function getProfileForDay(day) {
  return getTravelModeForDay(day);
}


// Set mode only for the given day and re-render that day
window.setTravelMode = async function(mode, day) {
  const m = (mode || '').toLowerCase();
  if (!['driving','cycling','walking'].includes(m)) return;

  const d = parseInt(day || window.currentDay || 1, 10);
  saveTravelModeForDay(d, m);

  window.travelMode = m;
  localStorage.setItem('tt_travel_mode', m);

  // KRİTİK: Artık async, await!
  if (typeof renderRouteForDay === 'function') 
   await renderRouteForDay(d);


  try {
    const containerId = `route-map-day${d}`;
    const expandedObj = window.expandedMaps?.[containerId];
    if (expandedObj && expandedObj.expandedMap && typeof updateExpandedMap === 'function') {
      await updateExpandedMap(expandedObj.expandedMap, d);
    }
  } catch(_) {}

  markActiveTravelModeButtons();

  

  // Burada artık veriler kesin güncel!
  // updateCart async olmalı ki, aradaki separatorlar da yeni moda göre gelsin.
  if (typeof updateCart === "function") await updateCart();

  setTimeout(() => {
  const scaleBarDiv = document.getElementById(`expanded-route-scale-bar-day${d}`);
  // SAF ROUTE KONTROLÜ: Geojson ve summary var mı?
  const geojson = window.lastRouteGeojsons?.[`route-map-day${d}`];
  const summary = window.lastRouteSummaries?.[`route-map-day${d}`];
  if (scaleBarDiv && geojson && summary && summary.distance > 0) {
    const totalKm = summary.distance / 1000;
    const markers = typeof getRouteMarkerPositionsOrdered === 'function'
      ? getRouteMarkerPositionsOrdered(d)
      : [];
    scaleBarDiv.innerHTML = `
      <div class="scale-bar-track">
        <div class="elevation-placeholder" style="
          width: 100%;
          height: 130px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #6c757d;
          font-size: 14px;
          position: absolute;
          top: 0;
          left: 0;
          background: rgba(255, 255, 255, 0.95);
          z-index: 1000;
        ">
          <div class="tt-scale-loader" style="display: flex; align-items: center; gap: 10px;">
            <div class="spinner"></div>
            <div class="txt">Loading elevation</div>
          </div>
        </div>
      </div>
    `;

    renderRouteScaleBar(scaleBarDiv, totalKm, markers);
  }
  // Havresine fallback veya başka bir şey YOK!
}, 300);


};



window.buildDirectionsUrl = function(coordsStr, day) {
  const d = day || window.currentDay || 1;
  const profile = getProfileForDay(d); // 'driving' | 'cycling' | 'walking'
  const url = `/route/v1/${profile}/${coordsStr}?geometries=geojson&overview=full&steps=true`;

  // FLY MODE patch: Sadece Türkiye ve gerçek route varsa log at
  const realPoints = typeof getDayPoints === "function" ? getDayPoints(d) : [];
  const containerId = `route-map-day${d}`;
  const geojson = window.lastRouteGeojsons?.[containerId];
  const isInTurkey = areAllPointsInTurkey(realPoints);
  const hasRealRoute = isInTurkey && geojson && geojson.features && geojson.features[0]?.geometry?.coordinates?.length > 1;

  if (hasRealRoute) {
    if (!window.__TT_ROUTING_LOG_ONCE) {
      // console.log('[Triptime][Directions] Using self-hosted OSRM via /route/v1/*');
      window.__TT_ROUTING_LOG_ONCE = true;
    }
    // console.log('[Triptime][Directions] day=%s, profile=%s, url=%s', d, profile, url);
  }
  // FLY MODE’da log atma!

  return url;
};



// Minimal snap; keep single definition
if (!window.snapPointToRoad) {
  window.snapPointToRoad = function(lat, lng) {
    return Promise.resolve({ lat, lng });
  };
}

// Remove legacy single-box UI and disable its initializers
function cleanupLegacyTravelMode() {
  try {
    document.querySelectorAll('#tt-travel-mode').forEach(el => el.remove());
    const oldStyle = document.getElementById('tt-travel-mode-style');
    if (oldStyle) oldStyle.remove();
    // No-ops in case any old IIFEs try to re-add
    window.ensureTravelModeElement = () => null;
    window.placeTravelModeInDayHeader = () => false;
    window.markActiveTravelModeButton = () => {};
    window.initTravelModeControl = () => {};
  } catch (_) {}
}
// Helper: ensure travel mode set is placed between the map and stats (visible above Mesafe/Süre)
// Helper: ensure travel mode set is placed between the map and stats (visible above Mesafe/Süre)
function ensureDayTravelModeSet(day, routeMapEl, controlsWrapperEl) {

  const setId = `tt-travel-mode-set-day${day}`;
  
  // Önce her durumda eskiyi kaldır
  document.getElementById(setId)?.remove();

  const realPoints = typeof getDayPoints === "function" ? getDayPoints(day) : [];

  // --- 1. SIFIR NOKTA VARSA HİÇBİR ŞEY GÖSTERME ---
  if (!Array.isArray(realPoints) || realPoints.length < 1) {
    return; 
  }

  // --- 2. KONUM KONTROLÜ ---
  const isInTurkey = areAllPointsInTurkey(realPoints);

  // --- 3. MOD SEÇİM MANTIĞI ---
  // Rota oluşup oluşmadığına (hasRealRoute) bakmaksızın, 
  // eğer nokta Türkiye dışındaysa "FLY MODE", içindeyse standart butonları göster.
  
  if (!isInTurkey) {
    // --- TURKEY DIŞI: FLY MODE ---
    const set = document.createElement('div');
    set.id = setId;
    set.className = 'tt-travel-mode-set';
    set.dataset.day = String(day);
    set.innerHTML = `
      <div class="travel-modes">
        <button type="button" data-mode="fly" aria-label="Fly" class="active" style="pointer-events:none;opacity:0.97;">
          <img class="tm-icon" src="img/fly_mode.svg" alt="FLY" loading="lazy" decoding="async" style="width:20px;height:20px;">
          <span class="tm-label">FLY MODE</span>
        </button>
        <div class="fly-info-msg" style="font-size: 13px; color: #607d8b; margin-top: 3px; margin-left: 4px; font-weight: 400;">
            *Route options inactive for this area
        </div>
      </div>
    `;
    insertSetToDOM(set, routeMapEl, controlsWrapperEl);
    return;
  }

  // --- TURKEY İÇİ: CAR / BIKE / WALK (Standart) ---
  const set = document.createElement('div');
  set.id = setId;
  set.className = 'tt-travel-mode-set';
  set.dataset.day = String(day);
  set.innerHTML = `
    <div class="travel-modes">
      <button type="button" data-mode="driving" aria-label="Driving">
        <img class="tm-icon" src="/img/way_car.svg" alt="CAR" loading="lazy" decoding="async">
        <span class="tm-label">CAR</span>
      </button>
      <button type="button" data-mode="cycling" aria-label="Cycling">
        <img class="tm-icon" src="/img/way_bike.svg" alt="BIKE" loading="lazy" decoding="async">
        <span class="tm-label">BIKE</span>
      </button>
      <button type="button" data-mode="walking" aria-label="Walking">
        <img class="tm-icon" src="/img/way_walk.svg" alt="WALK" loading="lazy" decoding="async">
        <span class="tm-label">WALK</span>
      </button>
    </div>
  `;
  
  insertSetToDOM(set, routeMapEl, controlsWrapperEl);

  // Buton Eventleri
  set.addEventListener('mousedown', e => e.stopPropagation(), { passive: true });
  set.addEventListener('click', (e) => {
    e.stopPropagation();
    const btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    window.setTravelMode(btn.getAttribute('data-mode'), day);
  });

  // Aktif butonu işaretle
  if (typeof markActiveTravelModeButtons === 'function') {
    markActiveTravelModeButtons();
  }
}

// Yardımcı: DOM'a ekleme işini yapan ufak fonksiyon
function insertSetToDOM(set, routeMapEl, controlsWrapperEl) {
    if (controlsWrapperEl && controlsWrapperEl.parentNode) {
      controlsWrapperEl.parentNode.insertBefore(set, controlsWrapperEl);
    } else if (routeMapEl && routeMapEl.parentNode) {
      routeMapEl.parentNode.insertBefore(set, routeMapEl.nextSibling);
    }
}

// Update: only clean header sets, we place the visible set near the map
function renderTravelModeControlsForAllDays() {
  // Remove any sets inside headers (we don't want them there)
  document.querySelectorAll('.day-header .tt-travel-mode-set').forEach(el => el.remove());

  // After maps/stats exist, ensure the set sits above stats
  document.querySelectorAll('.day-container').forEach(dc => {
    const day = parseInt(dc.dataset.day || '1', 10);
    const routeMapEl = dc.querySelector(`#route-map-day${day}`);
    const controlsWrapperEl = dc.querySelector(`#map-bottom-controls-wrapper-day${day}`);
    if (routeMapEl) {
      ensureDayTravelModeSet(day, routeMapEl, controlsWrapperEl || null);
    }
  });

  markActiveTravelModeButtons();
}

// Replace this function in son9.js
function markActiveTravelModeButtons() {
  document.querySelectorAll('.tt-travel-mode-set').forEach(set => {
    const day = parseInt(set.dataset.day || '1', 10);
    const active = (typeof getTravelModeForDay === 'function' ? getTravelModeForDay(day) : (window.travelMode || 'driving')).toLowerCase();
    set.querySelectorAll('button[data-mode]').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-mode') === active);
    });
  });
}


// Init once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  cleanupLegacyTravelMode();
  try { renderTravelModeControlsForAllDays(); } catch(_) {}
});



// KÜÇÜK HARİTA İŞLEVLERİ SIRALAMA
function wrapRouteControls(day) {
  const tm = document.getElementById(`tt-travel-mode-set-day${day}`); // travel mode barı
  const controls = document.getElementById(`map-bottom-controls-wrapper-day${day}`);
  const mapDiv = document.getElementById(`route-map-day${day}`);

  // controls yoksa sorun etme, barı yine de ekle, sadece mapDiv olmalı
  if (!mapDiv) return;

  let controlsEl = controls;
  if (!controlsEl) {
    controlsEl = document.createElement('div');
    controlsEl.id = `map-bottom-controls-wrapper-day${day}`;
    controlsEl.style.display = 'none'; 
    // Doğru parent'a ekle!
    const dayContainer = document.getElementById(`day-container-${day}`);
    const parentEl = dayContainer || mapDiv.parentNode;
    parentEl.appendChild(controlsEl);
  }

  const dayContainer = document.getElementById(`day-container-${day}`);
  const parent = dayContainer || controlsEl.parentNode;

  // Eski barı kaldır
  const existing = document.getElementById(`route-controls-bar-day${day}`);
  if (existing) existing.remove();

  // Route controls bar oluştur
  const bar = document.createElement('div');
  bar.className = 'route-controls-bar';
  bar.id = `route-controls-bar-day${day}`;
  
  // Bar header
  const mapBarHeader = document.createElement('div');
  mapBarHeader.className = 'map-bar-header';
  mapBarHeader.style.display = 'flex';
  mapBarHeader.style.alignItems = 'center';
  mapBarHeader.style.gap = '12px';
  mapBarHeader.style.justifyContent = 'space-between';
  mapBarHeader.style.cursor = 'pointer';

  const mapFunctionsDiv = document.createElement('div');
  mapFunctionsDiv.className = 'map-functions';
  mapFunctionsDiv.style.display = 'flex';
  mapFunctionsDiv.style.alignItems = 'center';
  mapFunctionsDiv.style.gap = '2x';  

  const mapTitleDiv = document.createElement('div');
  mapTitleDiv.textContent = "Route Information";
  mapTitleDiv.style.fontWeight = 'bold';
  mapTitleDiv.style.fontSize = '0.95rem';
  mapTitleDiv.style.color = '#333333';

  const arrowSpan = document.createElement('span');
  arrowSpan.className = 'arrow';
  arrowSpan.style.position = 'initial';
  arrowSpan.style.cursor = 'pointer';
  arrowSpan.style.padding = '0px';
  arrowSpan.style.marginTop = '6px';
  arrowSpan.innerHTML = `<img class="arrow-icon" src="img/right-arrow.svg" style="transform: rotate(0deg); transition: transform 0.18s;">`;

  mapFunctionsDiv.appendChild(mapTitleDiv);
  mapFunctionsDiv.appendChild(arrowSpan);

  // --- DEĞİŞİKLİK BURADA: Expanded durumunu kontrol et ---
  const isExpanded = window.expandedMaps && window.expandedMaps[`route-map-day${day}`];

  // Expand Map butonu
  const expandBtn = document.createElement('button');
  expandBtn.type = 'button';
  expandBtn.className = 'expand-map-btn';
  expandBtn.setAttribute('aria-label', 'Expand Map');
  
 
  if (isExpanded) {
      // --- DURUM 1: ZATEN AÇIK (PASİF) ---
      expandBtn.disabled = true;
      expandBtn.style.pointerEvents = 'none';
      expandBtn.style.opacity = '0.6';
      expandBtn.style.cursor = 'default';
      expandBtn.style.borderColor = '#ccc';
      expandBtn.style.background = '#f9f9f9';
      
      expandBtn.innerHTML = `
        <img class="tm-icon" src="/img/expand_map.svg" alt="MAP" loading="lazy" decoding="async" style="filter: grayscale(100%);">
        <span class="tm-label" style="color: #888">Map Expanded</span>
      `;
  } else {
  
      // Hover efektleri sadece aktifken
      expandBtn.onmouseover = function() { expandBtn.style.background = "#fafafa"; };
      expandBtn.onmouseout = function() { expandBtn.style.background = "#ffffff"; };

      expandBtn.innerHTML = `
        <img class="tm-icon" src="/img/expand_map.svg" alt="MAP" loading="lazy" decoding="async">
        <span class="tm-label" style="color: #1976d2">Expand map</span>
      `;
      
      expandBtn.onclick = function(e) {
        e.stopPropagation();
        const containerId = `route-map-day${day}`;
        if (typeof expandMap === "function") expandMap(containerId, day);
      };
  }
  // -----------------------------------------------------------

  mapBarHeader.appendChild(mapFunctionsDiv);
  mapBarHeader.appendChild(expandBtn);

  // İçerik wrapper
  const mapContentWrap = document.createElement('div');
  mapContentWrap.className = 'map-content-wrap';
  mapContentWrap.style.transition = 'max-height 0.3s, opacity 0.3s';
  mapContentWrap.style.overflow = 'hidden';
  mapContentWrap.style.maxHeight = '700px';
  mapContentWrap.style.opacity = '1';

  mapContentWrap.appendChild(mapDiv);
  if (tm) mapContentWrap.appendChild(tm);
  mapContentWrap.appendChild(controlsEl);

  // Aç/Kapa logic
  let open = true;
  setTimeout(() => {
    if (arrowSpan.querySelector('.arrow-icon')) {
      arrowSpan.querySelector('.arrow-icon').style.transform = open ? 'rotate(90deg)' : 'rotate(0deg)';
    }
  }, 0);

  mapBarHeader.onclick = function(e) {
    if (e.target.closest('.expand-map-btn')) return;
    open = !open;
    if (open) {
        mapContentWrap.style.maxHeight = '700px';
        mapContentWrap.style.opacity = '1';
        arrowSpan.querySelector('.arrow-icon').style.transform = 'rotate(90deg)';
        bar.style.gap = '10px';
        
        // [FIX] Küçük harita açıldığında markerları ortala
        const containerId = `route-map-day${day}`;
        const mapInstance = window.leafletMaps && window.leafletMaps[containerId];
        if (mapInstance) {
            setTimeout(() => {
                mapInstance.invalidateSize();
                if (typeof fitExpandedMapToRoute === 'function') fitExpandedMapToRoute(day);
            }, 300);
        }
    } else {
      mapContentWrap.style.maxHeight = '0px';
      mapContentWrap.style.opacity = '0.2';
      arrowSpan.querySelector('.arrow-icon').style.transform = 'rotate(0deg)';
      bar.style.gap = '0px';
    }
  };

  bar.appendChild(mapBarHeader);
  bar.appendChild(mapContentWrap);

  // DOM'a yerleştir
  if (controlsEl && controlsEl.parentNode === parent) {
    parent.insertBefore(bar, controlsEl);
  } else {
    parent.appendChild(bar);
  }

  // Küçük scale barı sil
  const smallScaleBar = parent.querySelector(`#route-scale-bar-day${day}`);
  if (smallScaleBar) smallScaleBar.remove();

  setTimeout(() => {
    if (mapDiv) mapDiv.style.display = 'block';
    if (controlsEl) controlsEl.style.display = 'block';
    if (bar) bar.style.display = 'flex';
    if (tm) tm.style.display = 'block';
  }, 1);
}

function wrapRouteControlsForAllDays() {
  document.querySelectorAll('.day-container').forEach(dc => {
    const day = parseInt(dc.dataset.day || '0', 10);
    if (day) wrapRouteControls(day);
  });
}

/* Patch: renderLeafletRoute içinde controls eklendikten sonra bar'a sar */
(function patchRenderLeafletRouteToWrapBar(){
  if (!window.__tt_wrapBarPatched && typeof renderLeafletRoute === 'function') {
    const original = renderLeafletRoute;  
    window.renderLeafletRoute = async function(containerId, geojson, points = [], summary = null, day = 1, missingPoints = []) {
      const result = await original.apply(this, arguments);
      try { 
        // Map controls ve travel mode set eklendikten hemen sonra bar'a sar
        wrapRouteControls(day);
      } catch(_) {}
      return result;
    };
    window.__tt_wrapBarPatched = true;
  }
})();



window.TT_SVG_ICONS = {
  // Travel modes
  driving: '/img/way_car.svg',
  walking: '/img/way_walk.svg',
  cycling: '/img/way_bike.svg',

  // Route summary
  distance: 'https://www.svgrepo.com/show/533308/route.svg',
  duration: 'https://www.svgrepo.com/show/532984/clock-outline.svg',
};



function resetDayAction(day, confirmationContainerId) {
  const d = parseInt(day, 10);
  const cid = `route-map-day${d}`;

  // 0) Expanded’ı ve detay overlay’lerini anında sök + kayıtları temizle
  try {
    // window.expandedMaps kaydı varsa önce restoreMap ile kapat, sonra kaydı sil
    if (window.expandedMaps && window.expandedMaps[cid]) {
      try { restoreMap(cid, d); } catch(_) {}
      delete window.expandedMaps[cid];
    }

    document.getElementById(`expanded-map-${d}`)?.remove();
    document.getElementById(`expanded-route-scale-bar-day${d}`)?.remove();

    document.querySelectorAll(`.expanded-map-container[id="expanded-map-${d}"]`).forEach(el => el.remove());
    document.querySelectorAll(`#expanded-route-scale-bar-day${d}`).forEach(el => el.remove());

    const expWrap = document.getElementById(`expanded-map-${d}`);
    if (expWrap) {
      expWrap.querySelectorAll('svg.tt-elev-svg, .scale-bar-selection, .scale-bar-vertical-line, .elev-segment-toolbar').forEach(el => el.remove());
    } else {
      const sb = document.getElementById(`expanded-route-scale-bar-day${d}`);
      sb?.querySelectorAll('svg.tt-elev-svg, .scale-bar-selection, .scale-bar-vertical-line, .elev-segment-toolbar').forEach(el => el.remove());
    }

    // Güvenlik: expanded-open sınıfını kaldır
    if (document?.body?.classList?.contains('expanded-open')) {
      document.body.classList.remove('expanded-open');
    }
  } catch(_) {}

  // 1) Bu güne ait içe aktarılan ham iz varsa sil
  if (window.importedTrackByDay && window.importedTrackByDay[d]) {
    delete window.importedTrackByDay[d];
  }

  // 2) Genişletilmiş haritayı mevcut fonksiyonla kapat (varsa) — ek güvenlik
  if (typeof closeExpandedForDay === 'function') {
    try { closeExpandedForDay(d); } catch (_) {}
  } else {
    try {
      document.getElementById(`expanded-map-${d}`)?.remove();
      document.getElementById(`expanded-route-scale-bar-day${d}`)?.remove();
    } catch (_) {}
  }

  try {
    const exp = document.getElementById(`expanded-route-scale-bar-day${d}`);
    if (exp) exp.innerHTML = '';
    const small = document.getElementById(`route-scale-bar-day${d}`);
    if (small) small.innerHTML = '';
  } catch (_) {}

  // 4) Rota görselleri ve önbellekleri temizle
  if (typeof clearRouteVisualsForDay === 'function') { try { clearRouteVisualsForDay(d); } catch (_) {} }
  if (typeof clearRouteCachesForDay === 'function')  { try { clearRouteCachesForDay(d); } catch (_) {} }
  if (window.__ttElevDayCache && window.__ttElevDayCache[d]) delete window.__ttElevDayCache[d];
  if (window.routeElevStatsByDay && window.routeElevStatsByDay[d]) delete window.routeElevStatsByDay[d];

  // 5) Mini harita kapları ve kontrolleri kaldır
  if (typeof removeDayMapCompletely === 'function') {
    try { removeDayMapCompletely(d); } catch (_) {}
  } else if (typeof removeDayMap === 'function') {
    try { removeDayMap(d); } catch (_) {}
  } else {
    document.getElementById(`route-map-day${d}`)?.remove();
    document.getElementById(`route-info-day${d}`)?.remove();
    document.getElementById(`map-bottom-controls-wrapper-day${d}`)?.remove();
    document.getElementById(`route-controls-bar-day${d}`)?.remove();
    document.getElementById(`route-scale-bar-day${d}`)?.remove();
  }

  // 6) Günün item’larını sıfırla (günü görünür bırak ama boş)
  if (Array.isArray(window.cart)) {
    window.cart.forEach(item => {
      if (item.day == d) {
        item.name = undefined;
        item.location = null;
        item.opening_hours = null;
        item.address = item.address || null;
      }
    });
  }
  // 7) Mesafe etiketleri ve rota istatistikleri
  if (typeof clearDistanceLabels === 'function') { try { clearDistanceLabels(d); } catch (_) {} }
  if (typeof updateRouteStatsUI === 'function')  { try { updateRouteStatsUI(d); } catch (_) {} }

  // 8) İlk gerçek nokta eklenene kadar mini harita otomatik doğmasın
  window.__suppressMiniUntilFirstPoint = window.__suppressMiniUntilFirstPoint || {};
  window.__suppressMiniUntilFirstPoint[d] = true;

  // 9) UI’ı yenile
  if (typeof updateCart === 'function') { try { updateCart(); } catch (_) {} }

  // 10) Onay penceresini kapat
  if (typeof hideConfirmation === 'function') { try { hideConfirmation(confirmationContainerId); } catch (_) {} }

  // 11) Re-render ısrarını kırmak için: updateCart sonrası 2 kez daha kökten temizle
  try {
    const purgeOnce = () => {
      if (window.expandedMaps && window.expandedMaps[cid]) {
        try { restoreMap(cid, d); } catch(_) {}
        delete window.expandedMaps[cid];
      }
      document.getElementById(`expanded-map-${d}`)?.remove();
      document.getElementById(`expanded-route-scale-bar-day${d}`)?.remove();
      const expWrap2 = document.getElementById(`expanded-map-${d}`);
      expWrap2?.querySelectorAll('svg.tt-elev-svg, .scale-bar-selection, .scale-bar-vertical-line, .elev-segment-toolbar').forEach(el => el.remove());
      if (document?.body?.classList?.contains('expanded-open')) {
        document.body.classList.remove('expanded-open');
      }
    };
    setTimeout(purgeOnce, 0);
    setTimeout(purgeOnce, 200);
  } catch(_) {}
  setTimeout(function(){ highlightSegmentOnMap(day); }, 120);
}


// Sadece Geoapify tags güncellensin:
function fillGeoapifyTagsOnly() {
  document.querySelectorAll('.steps').forEach(stepsDiv => {
    const infoView = stepsDiv.querySelector('.item-info-view, .info.day_cats');
    if (!infoView) return;
    const name = infoView.querySelector('.title')?.textContent?.trim() || '';
    const category = stepsDiv.getAttribute('data-category') || '';
    const geoTagsDiv = infoView.querySelector('.geoapify-tags');
    const step = window.cart.find(i => i.name === name && i.category === category);
    if (geoTagsDiv && step && step.properties && Array.isArray(step.properties.categories)) {
const uniqueTags = getUniqueSpecificTags(step.properties.categories);
geoTagsDiv.innerHTML = uniqueTags.map(t => `<span class="geo-tag" title="${t.tag}">${t.label}</span>`).join(' ');
    } else if (geoTagsDiv) {
      geoTagsDiv.textContent = "No tags found.";
    }
  });
}
function getUniqueSpecificTags(tags) {
    if (!Array.isArray(tags)) return [];
    // Sadece en uzun tag'ı ve label'ı eşle
    const labelToTag = {};
    tags.forEach(t => {
        const label = t.split('.').pop().replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        if (!labelToTag[label] || t.length > labelToTag[label].length) {
            labelToTag[label] = t;
        }
    });
    // Sonuç: [{tag, label}]
    return Object.entries(labelToTag).map(([label, tag]) => ({ tag, label }));
}
function attachImLuckyEvents() {
  document.querySelectorAll('.im-lucky-btn').forEach(btn => {
    btn.onclick = null;
    btn.addEventListener('click', async function() {
      const stepsDiv = btn.closest('.steps');
      const day = String(stepsDiv.getAttribute('data-day'));
      const category = stepsDiv.getAttribute('data-category');
      const city = window.selectedCity;

      // --- SADECE O GÜN/KATEGORİ LUCKY HISTORY ---
      window.luckyHistory = window.luckyHistory || {};
      window.luckyHistory[day] = window.luckyHistory[day] || {};
      window.luckyHistory[day][category] = window.luckyHistory[day][category] || [];

      const usedKeys = new Set(window.luckyHistory[day][category]);
      let radius = 3;
      let attempt = 0;
      const maxAttempts = 8;
      let foundPlace = null;
      while (!foundPlace && attempt < maxAttempts) {
        const results = await getPlacesForCategory(city, category, 10, radius * 1000);
        for (const p of results) {
          const key = `${p.name}__${p.lat}__${p.lon}`;
          if (!usedKeys.has(key)) {
            foundPlace = p;
            window.luckyHistory[day][category].push(key);
            break;
          }
        }
        radius += 5;
        attempt++;
      }

      if (foundPlace) {
        // FOTOĞRAF GETİRME PATCH
        if (!foundPlace.image) {
          try {
            foundPlace.image = await getImageForPlace(
              foundPlace.name,
              foundPlace.category || category,
              city
            );
          } catch (e) {
            foundPlace.image = "img/placeholder.png";
          }
        }
        foundPlace.day = day;
        foundPlace.category = category;

        // === SEPETE EKLEME ===
        addToCart(
          foundPlace.name,
          foundPlace.image,
          day,
          category,
          foundPlace.address,
          null, null,
          foundPlace.opening_hours,
          null,
          foundPlace.location,
          foundPlace.website
        );

        const newStepHtml = generateStepHtml(foundPlace, day, category, 0);

        const parent = stepsDiv.parentNode;
        if (parent) {
          const tmp = document.createElement('div');
          tmp.innerHTML = newStepHtml;
          const newStepEl = tmp.firstElementChild;
          parent.replaceChild(newStepEl, stepsDiv);
          attachFavEvents();
          attachImLuckyEvents();
        }
      } else {
        btn.textContent = "No place found!";
        btn.disabled = true;
      }
    });

    setTimeout(() => {
      if (btn && typeof btn.click === "function") {
        btn.click();
      }
    }, 100);
  });
}


// Markdown'dan HTML'e çevirici fonksiyon
function markdownToHtml(text) {
  // Kalın yazı
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // İtalik yazı
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Madde işaretiyle liste
  text = text.replace(/(?:^|\n)[*-] (.*?)(?=\n|$)/g, function(match, p1) {
    return `<li>${p1}</li>`;
  });
  // Listeyi <ul> ile sarmala
  if (text.includes('<li>')) {
    text = text.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
  }
  // Paragraflar ve satır başı
  text = text.replace(/\n{2,}/g, '<br><br>');
  text = text.replace(/\n/g, '<br>');
  return text;
}


// iki nokta arasında yay çizen fonksiyon
function drawCurvedLine(map, pointA, pointB, options = {}) {
    const latlngA = L.latLng(pointA.lat, pointA.lng);
    const latlngB = L.latLng(pointB.lat, pointB.lng);

    const offsetX = latlngB.lng - latlngA.lng;
    const offsetY = latlngB.lat - latlngA.lat;
    const r = Math.sqrt(offsetX ** 2 + offsetY ** 2);
    const theta = Math.atan2(offsetY, offsetX);
    const thetaOffset = (Math.PI / 10);

    const r2 = (r / 2.0) / Math.cos(thetaOffset);
    const theta2 = theta + thetaOffset;

    const controlX = (r2 * Math.cos(theta2)) + latlngA.lng;
    const controlY = (r2 * Math.sin(theta2)) + latlngA.lat;

    const latlngs = [];
    for (let t = 0; t < 1.01; t += 0.025) {
        const x = (1 - t) * (1 - t) * latlngA.lng + 2 * (1 - t) * t * controlX + t * t * latlngB.lng;
        const y = (1 - t) * (1 - t) * latlngA.lat + 2 * (1 - t) * t * controlY + t * t * latlngB.lat;
        latlngs.push([y, x]);
    }

    return L.polyline(latlngs, options).addTo(map);
}



document.addEventListener("DOMContentLoaded", function() {
    const inputEl = document.getElementById("user-input");
    if (inputEl) {
        inputEl.setAttribute("maxlength", "50"); // 61. karakteri yazmayı engeller
        inputEl.setAttribute("placeholder", "Enter destination & duration (Max 50 chars)"); // İsterseniz placeholder'ı da güncelleyin
    }
});



    function toggleCustomAccordion(element) {
    let parent = element.closest('.custom-accordion');
    if (!parent) return;

    let content = parent.querySelector('.custom-accordion-content');
    let icon = element.querySelector('.custom-icon');
    if (!content || !icon) return;

    if (parent.classList.contains('active')) {
        content.style.maxHeight = content.scrollHeight + 'px';
        void content.offsetHeight;
        content.style.maxHeight = '0';
        parent.classList.remove('active');
        icon.textContent = '+';
    } else {
        let tripbox = parent.closest('.tripbox');
        if (!tripbox) tripbox = document;
        tripbox.querySelectorAll('.custom-accordion').forEach(acc => {
            let accContent = acc.querySelector('.custom-accordion-content');
            let accIcon = acc.querySelector('.custom-icon');
            if (accContent && accIcon) {
                acc.classList.remove('active');
                accContent.style.maxHeight = '0';
                accIcon.textContent = '+';
            }
        });

        parent.classList.add('active');
        content.style.maxHeight = '0';
        icon.textContent = '−';
        setTimeout(() => {
            content.style.maxHeight = content.scrollHeight + 'px';
        }, 10);
    }
}