function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000, toRad = x => x * Math.PI / 180;
    const dLat = toRad(lat2-lat1), dLon = toRad(lon2-lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
    return 2 * R * Math.asin(Math.sqrt(a));
}
function isTripFav(item) {
    return window.favTrips && window.favTrips.some(f =>
        f.name === item.name &&
        f.category === item.category &&
        String(f.lat) === String(item.lat) &&
        String(f.lon) === String(item.lon)
    );
}

// Sonuçlar her güncellendiğinde ve slider yeniden kurulduğunda çağır:

window.__welcomeHiddenForever = false;
window.__restaurantLayers = window.__restaurantLayers || [];

window.__hideAddCatBtnByDay = window.__hideAddCatBtnByDay || {};
// === SCALE BAR DRAG GLOBAL HANDLERLARI ===
window.__scaleBarDrag = null;
window.__scaleBarDragTrack = null;
window.__scaleBarDragSelDiv = null;
// local_storage.js'in en üstüne ekle:

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

function hideSuggestionsDiv(clear = false) {
    const el = document.getElementById('suggestions');
    if (!el) return;
    el.hidden = true;
    el.style.removeProperty('display');
    if (!el.getAttribute('style')) el.removeAttribute('style');
    if (clear) el.innerHTML = "";
}

function showSuggestionsDiv() {
    const el = document.getElementById('suggestions');
    if (!el) return;
    el.hidden = false;
    el.style.removeProperty('display');
    if (!el.getAttribute('style')) el.removeAttribute('style');
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

function renderSuggestions(results = []) {
    const suggestionsDiv = document.getElementById("suggestions");
    const chatInput = document.getElementById("user-input");
    if (!suggestionsDiv || !chatInput) return;
    suggestionsDiv.innerHTML = "";

    if (!results.length) {
        hideSuggestionsDiv?.(true);
        return;
    }

    results.forEach(result => {
        const props = result.properties || {};
        const city = props.city || props.name || "";
        const country = props.country || "";
        const flag = props.country_code ? " " + countryFlag(props.country_code) : "";
        const displayText = [city, country].filter(Boolean).join(", ") + flag;

        const div = document.createElement("div");
        div.className = "category-area-option";
        div.textContent = displayText;
        div.dataset.displayText = displayText;

        div.onclick = () => {
            // TIKLAMADA PROGRAMATIK SET
            window.__programmaticInput = true;
            Array.from(suggestionsDiv.children).forEach(d => d.classList.remove("selected-suggestion"));
            div.classList.add("selected-suggestion");
            window.selectedSuggestion = { displayText, props };
            window.selectedLocation = {
                name: props.name || city,
                city: city,
                country: country,
                lat: props.lat ?? props.latitude ?? null,
                lon: props.lon ?? props.longitude ?? null,
                country_code: props.country_code || ""
            };
            // Gün sayısı inputtan (veya 2 default)
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
            enableSendButton?.();
            showSuggestionsDiv?.();
            if (typeof updateCanonicalPreview === "function") {
                updateCanonicalPreview();
            }
            setTimeout(() => { window.__programmaticInput = false; }, 0); // ARTIK kullanıcı yazıyor
        };

        suggestionsDiv.appendChild(div);
    });

    if (suggestionsDiv.children.length > 0) {
        showSuggestionsDiv?.();
    } else {
        hideSuggestionsDiv?.(true);
    }
}


function clearRouteSegmentHighlight(day) {
  if (window._segmentHighlight && window._segmentHighlight[day]) {
    Object.values(window._segmentHighlight[day]).forEach(poly => {
      try { poly.remove(); } catch(_) {}
    });
    delete window._segmentHighlight[day];
  }
  // MUTLAKA global state’i temizle:
  window._lastSegmentDay = undefined;
  window._lastSegmentStartKm = undefined;
  window._lastSegmentEndKm = undefined;

  // Segment overlay DOM’u da temizle (isteğe bağlı)
  const bar = document.getElementById(`expanded-route-scale-bar-day${day}`);
  if (bar) {
    bar.querySelectorAll('svg[data-role="elev-segment"]').forEach(el => el.remove());
bar.querySelectorAll('.elev-segment-toolbar').forEach(el => el.remove());
    const sel = bar.querySelector('.scale-bar-selection');
    if (sel) sel.style.display = 'none';
  }
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
        // Nice tick helpers
function niceStep(total, target) {
  const raw = total / Math.max(1, target);
  const p10 = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p10;
  const f = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return f * p10;
}


function createScaleElements(track, widthPx, spanKm, startKmDom, markers = [], customElevData = null) {
  // Güvenlik: Loading varsa çizme
  if (track && track.classList.contains('loading')) {
      track.querySelectorAll('.marker-badge').forEach(el => el.remove());
      return; 
  }

  const container = track?.parentElement;
  if ((!spanKm || spanKm < 0.01) && !customElevData) {
      // Fallback logic...
      if (Array.isArray(markers) && markers.length > 1) {
         spanKm = getTotalKmFromMarkers(markers);
      }
  }
  
  if (!spanKm || spanKm < 0.01) {
    track.querySelectorAll('.marker-badge').forEach(el => el.remove());
    return;
  }
  if (!track) return;

  track.querySelectorAll('.scale-bar-tick, .scale-bar-label, .marker-badge, .elevation-labels-container').forEach(el => el.remove());

  // --- Ticks & Labels ---
  const targetCount = Math.max(6, Math.min(14, Math.round(widthPx / 100)));
  let stepKm = niceStep(spanKm, targetCount);
  let majors = Math.max(1, Math.round(spanKm / Math.max(stepKm, 1e-6)));
  if (majors < 6) { stepKm = niceStep(spanKm, 6); majors = Math.round(spanKm / stepKm); }
  if (majors > 14) { stepKm = niceStep(spanKm, 14); majors = Math.round(spanKm / stepKm); }

  for (let i = 0; i <= majors; i++) {
    const curKm = Math.min(spanKm, i * stepKm);
    const leftPct = (curKm / spanKm) * 100;

    const tick = document.createElement('div');
    tick.className = 'scale-bar-tick';
    tick.style.left = `${leftPct}%`;
    tick.style.position = 'absolute';
    tick.style.top = '10px';
    tick.style.width = '1px';
    tick.style.height = '16px';
    tick.style.background = '#cfd8dc';
    track.appendChild(tick);

    const label = document.createElement('div');
    label.className = 'scale-bar-label';
    label.style.left = `${leftPct}%`;
    label.style.position = 'absolute';
    label.style.top = '30px';
    label.style.transform = 'translateX(-50%)';
    label.style.fontSize = '11px';
    label.style.color = '#607d8b';
    label.textContent = `${(startKmDom + curKm).toFixed(spanKm > 20 ? 0 : 1)} km`;
    track.appendChild(label);
  }

  // --- MARKER POSITIONING ---
  
  // Veri kaynağını belirle: Ya parametre olarak gelen segment verisi ya da container üzerindeki global veri
  let activeData = null;
  
  if (customElevData) {
      // Segment modundaysak, drawSegmentProfile'dan gelen hazır veriyi kullan
      // Bu veri zaten vizMin/vizMax içeriyor, tekrar hesaplamaya gerek yok
      activeData = customElevData; 
  } else if (container && container._elevationData) {
      // Global moddaysak container verisini kullan ve vizMin/vizMax hesapla
      const { smooth, min, max } = container._elevationData;
      let vizMin = min, vizMax = max;
      const eSpan = max - min;
      if (eSpan > 0) { vizMin = min - eSpan * 0.50; vizMax = max + eSpan * 1.0; }
      else { vizMin = min - 1; vizMax = max + 1; }
      
      activeData = { smooth, vizMin, vizMax };
  }

  if (Array.isArray(markers)) {
    markers.forEach((m, idx) => {
      let dist = typeof m.distance === "number" ? m.distance : 0;
      
      // 1. Filtreleme: Eğer marker bu segmentin dışındaysa ÇİZME
      // (Ufak bir tolerans payı +/- 0.05 km eklenebilir)
      if (dist < startKmDom - 0.05 || dist > startKmDom + spanKm + 0.05) {
          return;
      }

      const relKm = dist - startKmDom;
      let left = spanKm > 0 ? (relKm / spanKm) * 100 : 0;
      
      // Sınırları aşmaması için clamp (yine de yukarıdaki if ile eledik ama güvenlik)
      left = Math.max(0, Math.min(100, left));

      let bottomStyle = "2px"; 

      if (activeData && activeData.smooth && activeData.smooth.length > 0) {
          const { smooth, vizMin, vizMax } = activeData;
          
          // Markerın, grafiğin veri dizisi (smooth array) içindeki denk geldiği index
          const pct = Math.max(0, Math.min(1, left / 100));
          const sampleIdx = Math.floor(pct * (smooth.length - 1));
          const val = smooth[sampleIdx];
          
          if (typeof val === 'number') {
              // Yükseklik Yüzdesi Hesabı
              // (Değer - GörselAltSınır) / (GörselÜstSınır - GörselAltSınır)
              const heightPct = ((val - vizMin) / (vizMax - vizMin)) * 100;
              
              // Marker boyutu ve padding ayarı
              bottomStyle = `calc(${heightPct}% - 7px)`;
          }
      }

      const wrap = document.createElement('div');
      wrap.className = 'marker-badge';
      // Transition'ı kaldırdım çünkü zoom yaparken markerların kayarak gelmesi kafa karıştırabilir
      wrap.style.cssText = `position:absolute;left:${left}%;bottom:${bottomStyle};width:18px;height:18px;transform:translateX(-50%);z-index:5;`;
      wrap.title = m.name || '';
      wrap.innerHTML = `<div style="width:18px;height:18px;border-radius:50%;background:#d32f2f;border:1px solid #fff;box-shadow:0 2px 6px #888;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;font-weight:700;">${idx + 1}</div>`;
      track.appendChild(wrap);
    });
  }

  // --- Grid Labels (Dikey Eksen Yazıları) ---
  // Eğer özel veri varsa (segment), etiketleri de o aralığa göre çiz
  // Değilse eski SVG içinden çekmeye çalışır (Global mod)
  
  let gridLabels = [];
  if (customElevData) {
      // Segment modunda label'ları manuel oluşturmamız lazım çünkü SVG henüz DOM'da tam oluşmamış olabilir
      // veya SVG içinden okumak yerine veriden üretmek daha sağlıklıdır.
      // drawSegmentProfile'da kullanılan 4 seviyeli grid mantığının aynısı:
      const { vizMin, vizMax } = customElevData;
      // SVG yüksekliği genelde 220px veya mobil ayarı. Oranlayarak Y bulacağız.
      // Ancak createScaleElements sadece HTML basıyor, SVG koordinatını bilmiyor.
      // Basit çözüm: Yüzde olarak yerleştirmek.
      
      for(let i=0; i<=4; i++) {
          const val = vizMin + (i/4)*(vizMax - vizMin);
          // Yüzde hesabı:
          const pct = (i/4) * 100; 
          // SVG'de Y ekseni ters (yukarı 0) ama HTML bottom (aşağı 0). 
          // Profile çiziminde bottom = 0 -> vizMin değil, vizMin biraz aşağıda kalıyor.
          // drawSegmentProfile mantığına sadık kalmak için:
          // Oradaki Y fonksiyonu: ((height-1) - ((e-vizMin)/(vizMax-vizMin))*(height-2))
          // Yani lineer bir mapping.
          
          gridLabels.push({
              value: Math.round(val) + ' m',
              pct: pct // Bu height yüzdesi
          });
      }
  } else {
      // Global mod: SVG'den oku (Eski yöntem)
      const svg = track.querySelector('svg.tt-elev-svg');
      if (svg) {
        gridLabels = Array.from(svg.querySelectorAll('text'))
          .map(t => ({
            value: t.textContent.trim(),
            y: Number(t.getAttribute('y')), // SVG pixel coordinates
            svgHeight: Number(svg.getAttribute('height')) || 180
          }))
          .filter(obj => /-?\d+\s*m$/.test(obj.value));
      }
  }

  const elevationLabels = document.createElement('div');
  elevationLabels.className = 'elevation-labels-container';

  gridLabels.forEach((obj, index) => { 
    // Segment modunda (pct var) veya Global modda (y var)
    let topStyle = '';
    
    if (typeof obj.pct !== 'undefined') {
        // Segment modu: CSS bottom ile konumlandır
        // drawSegmentProfile Y fonksiyonunun tersi mantığı:
        // Y = H - (val_norm * H). Yani val_norm 0 ise Y=H (en alt).
        // HTML'de bottom: 0% -> val_norm 0.
        // Ancak paddingler var (min - span*0.5).
        // createScaleElements içindeki marker mantığı ile aynı yüzdeyi kullanalım:
        // heightPct = ((val - vizMin) / (vizMax - vizMin)) * 100;
        // obj.pct zaten (i/4)*100 yani tam grid çizgilerine denk gelir.
        
        // CSS top kullanmak daha güvenli çünkü parent relative.
        // %100 yükseklik = vizMax. %0 = vizMin.
        // Grid çizgisi i=4 (en üst) -> %100 elevation -> top: 0%.
        // Grid çizgisi i=0 (en alt) -> %0 elevation -> top: 100%.
        topStyle = `top: ${100 - obj.pct}%; transform: translateY(-50%);`;
        
    } else {
        // Global mod: SVG pikselinden hesapla
        const trackHeight = track.clientHeight || 180;
        const correctedY = (obj.y / obj.svgHeight) * trackHeight;
        topStyle = `top: ${correctedY}px;`;
    }

    const wrapper = document.createElement('div');
    // En alttakini veya en üsttekini gizleme ihtiyacı varsa burada yapılabilir
    let visibilityStyle = ''; 
    
    wrapper.style.cssText = `position: absolute; right: 0; ${topStyle} ${visibilityStyle}`;

     const tick = document.createElement('div');
    tick.style.cssText = `
        width: 35px;
        border-bottom: 1px dashed #cfd8dc;
        opacity: 0.7;
        display: block;
        margin-left: 0px;
        margin-top: 0px;
    `;

    const label = document.createElement('div');
    label.className = 'elevation-label';
    label.style.cssText = `
        font-size: 10px;
        color: #607d8b;
        background: none;
        line-height: 1.5;
        text-align: right;
        padding-right: 0px;
        white-space: nowrap;
    `;
    label.textContent = obj.value;

    wrapper.appendChild(tick);
    wrapper.appendChild(label);
    
    elevationLabels.appendChild(wrapper);
  });

  track.style.position = 'relative';
  track.appendChild(elevationLabels);
}

        // Aktif harita planlama modu için
window.mapPlanningDay = null;
window.mapPlanningActive = false;
window.mapPlanningMarkersByDay = {};
window.__suppressMiniUntilFirstPoint = window.__suppressMiniUntilFirstPoint || {};

function movingAverage(arr, win = 5) {
  return arr.map((v, i, a) => {
    const start = Math.max(0, i - Math.floor(win/2));
    const end = Math.min(a.length, i + Math.ceil(win/2));
    const slice = a.slice(start, end);
    return slice.reduce((sum, val) => sum + val, 0) / slice.length;
  });
}

window.cart = JSON.parse(localStorage.getItem('cart')) || [];

// Haversine mesafe (metre)
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

function getSlopeColor(slope) {
  // Dengeli (orta doygunluk) tonlar
  if (slope < 2)  return "#9CCC65"; // medium-soft green
  if (slope < 6)  return "#E6C15A"; // mellow mustard
  if (slope < 10) return "#F2994A"; // balanced orange
  if (slope < 15) return "#EF5350"; // medium soft red
  return "#9575CD";                 // soft purple
}


// --- PLAN SEÇİM ZORUNLULUĞU FLAGS ---
window.__locationPickedFromSuggestions = false;
window.selectedLocationLocked = false;

let selectedCity = "";

// (REMOVED) showCitySuggestions + countryPopularCities usage

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
    let selectedOption = null;

function showSuggestions() {
    if (!suggestionsDiv) return;
    suggestionsDiv.innerHTML = "";

    const options = [
        { text: "Plan a 1-day tour for Rome", flag: countryFlag("IT") },
        { text: "Do a 1 day city tour in Antalya", flag: countryFlag("TR") },
        { text: "1-day city tour in Giresun", flag: countryFlag("TR") }
    ];

    options.forEach(option => {
        const suggestion = document.createElement("div");
        suggestion.className = "category-area-option";
        suggestion.innerText = `${option.text} ${option.flag}`;

        // --- BURAYA EKLE ---
        suggestion.onclick = function() {
            Array.from(suggestionsDiv.children).forEach(d => d.classList.remove("selected-suggestion"));
            suggestion.classList.add("selected-suggestion");

            const { city, days } = extractCityAndDaysFromTheme(option.text);

            let canonicalStr = `Plan a ${days}-day tour for ${city}`;
            if (typeof formatCanonicalPlan === "function") {
                const c = formatCanonicalPlan(`${city} ${days} days`);
                if (c && c.canonical) canonicalStr = c.canonical;
            }

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
    // 1. İlk autocomplete isteği
    let response = await fetch(`/api/geoapify/autocomplete?q=${encodeURIComponent(query)}`);
    let data = await response.json();
    let features = data.features || [];

    // 2. Eğer hiç sonuç yoksa, sadece ülke parametresiyle tekrar dene (bu genel bir UX fallback, manuel değil)
    if (!features.length) {
        response = await fetch(`/api/geoapify/autocomplete?q=${encodeURIComponent(query)}`);
        data = await response.json();
        features = data.features || [];
    }

    // 3. Region/area suggestion varsa, onun koordinatına yakın şehirleri de ekle
    const region = features.find(f => {
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
            // Aynı isimdeki şehirleri çıkar
            const regionNames = new Set(features.map(f =>
                (f.properties.city || f.properties.name || '').toLowerCase()
            ));
            nearbyCities = nearbyCities.filter(f =>
                !regionNames.has((f.properties.city || f.properties.name || '').toLowerCase())
            );
            features = [...features, ...nearbyCities];
        } catch (err) {
            // Hata olursa sessizce atla
        }
    }

    return sortLocations(features);
}
 

function extractLocationQuery(input) {
    // 1. Sık kullanılan gezi kelimelerini sil (tamamen otomatik, manuel isim yok!)
    let cleaned = input.replace(/\b(plan|trip|tour|itinerary|days?|day|for|in|to|city|please|show|give|a|the|of|program|generate|make|build|do|visit|program|route)\b/gi, " ");
    cleaned = cleaned.replace(/\d+/g, " "); // gün sayısını da sil
    cleaned = cleaned.replace(/[,.;:!?]+/g, " ");
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    // 2. Çift kelime varsa, sondan iki kelimeyi birleştir (örn. "New York", "Los Angeles")
    const tokens = cleaned.split(" ").filter(Boolean);
    if (tokens.length >= 2) {
        // Sondan iki kelimeyi birleştir ve API ile test et
        return tokens.slice(-2).join(" ");
    }
    // 3. Tek kelime varsa, onu döndür
    if (tokens.length === 1) return tokens[0];

    // 4. Son çare: inputun tamamı
    return input.trim();
}
 
    let __autoAbort = null;

    if (typeof showSuggestionsDiv !== "function") {
      function showSuggestionsDiv() {
        const el = document.getElementById('suggestions');
        if (!el) return;
        el.hidden = false;
        el.style.removeProperty('display');
        if (!el.getAttribute('style')) el.removeAttribute('style');
      }
    }
    if (typeof hideSuggestionsDiv !== "function") {
      function hideSuggestionsDiv(clear = false) {
        const el = document.getElementById('suggestions');
        if (!el) return;
        el.hidden = true;
        el.style.removeProperty('display');
        if (!el.getAttribute('style')) el.removeAttribute('style');
        if (clear) el.innerHTML = "";
      }
    }


chatInput.addEventListener("input", debounce(async function () {
    const queryText = this.value.trim();
    console.log("Kullanıcı input:", queryText);  // EKLE

    if (queryText.length < 2) {
        showSuggestions(); // <-- hazır suggestions her zaman göster!
        return;
    }
    const locationQuery = extractLocationQuery(queryText);
    console.log("LocationQuery:", locationQuery); // EKLE

    let suggestions = [];
    try {
        suggestions = await geoapifyLocationAutocomplete(locationQuery);
        console.log("API'dan gelen suggestions:", suggestions); // EKLE
    } catch (err) {
        if (err.name === "AbortError") return;
        suggestions = [];
        console.error("Autocomplete API hatası:", err); // EKLE
    }
    window.lastResults = suggestions;
    renderSuggestions(suggestions);
}, 400));

    chatInput.addEventListener("focus", function () {
        if (lastResults.length) renderSuggestions(lastResults);
    });

    window.buildPlanFromSelection = function (days) {
        if (!window.selectedLocation) {
            alert("Please select a city!");
            return;
        }
        const loc = window.selectedLocation;
        console.log("Plan:", loc.city || loc.name, days, loc.lat, loc.lon, loc.country);
    };

    const surveyData = [
        {
            question: "Let's get started.",
            options: [
                { name: "Plan a 1-day tour for Rome" },
                { name: "Do a 1-day city tour in Antalya" },
                { name: "Do a 2-day city tour in Giresun" },
            ]
        },
    ];

    showSuggestions();

    let currentQuestionIndex = 0;

    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");

    let latestTripPlan = [];
    let apiCallTimeout;

    function displayQuestion() {
        if (currentQuestionIndex < surveyData.length) {
            addMessage(surveyData[currentQuestionIndex].question, "bot-message");
            showSuggestions();
        } else {
            addMessage("I’ve created a fantastic trip plan for you...", "bot-message");
        }
    }
async function limitDayRouteToMaxDistance(places, day, maxKm = 10) {
  if (places.length < 2) return places;
  let limitedPlaces = [...places];
  while (limitedPlaces.length > 1) {
    const coords = limitedPlaces.map(p => [p.lon, p.lat]);
    try {
      const coordParam = coords.map(c => `${c[0]},${c[1]}`).join(';');
      const url = buildDirectionsUrl(coordParam, day); // <-- day eklendi
      const response = await fetch(url);
      if (!response.ok) break;
      const data = await response.json();
      if (!data.routes || !data.routes[0]) break;
      const km = data.routes[0].distance / 1000;
      if (km <= maxKm) {
        return limitedPlaces;
      } else {
        limitedPlaces.pop();
      }
    } catch (e) {
      break;
    }
  }
  return limitedPlaces;
}


function parsePlanRequest(text) {
    let days = null;
    let location = null;

    // 1. Eğer seçili öneri varsa, doğrudan onu kullan
    if (window.selectedSuggestion && window.selectedSuggestion.props) {
        const props = window.selectedSuggestion.props;
        // city + country varsa birleştir, yoksa name kullan
        location = [props.city || props.name, props.country].filter(Boolean).join(', ');
    } else if (window.selectedLocation && typeof window.selectedLocation === "object") {
        location = [window.selectedLocation.city || window.selectedLocation.name, window.selectedLocation.country].filter(Boolean).join(', ');
    }

    // 2. Gün sayısını yine inputtan çek
    let dayMatch = text.match(/(\d+)[- ]*day/);
    if (dayMatch) {
        days = parseInt(dayMatch[1]);
    }
    // Türkçe "2 gün" vs.
    if (!days) {
        let trMatch = text.match(/(\d+)[, ]*gün/i);
        if (trMatch) {
            days = parseInt(trMatch[1]);
        }
    }
    if (!days || isNaN(days) || days < 1) days = 2;

    // Eğer hala location yoksa, eski regexlerle dene (fallback)
    if (!location) {
        let wordMatch = text.match(/\b([A-Z][a-z'’]+)\b/);
        if (wordMatch) location = wordMatch[1];
    }

    // Default gün sayısı (sıfır veya geçersizse 2 yap)
    if (!days || isNaN(days) || days < 1) days = 2;
    if (!location) throw new Error("Invalid city name");

    // Debug için log
    console.log("parsePlanRequest result:", { location, days });

    return { location, days };
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

function handleKeyPress(event) {
  if (event.key !== "Enter") return;
  if (window.isProcessing) {
    event.preventDefault();
    return;
  }
  sendMessage();
  event.preventDefault();
}


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

    // 5. fallback: cümledeki harfli uzun kelimelerden en sonuncusu
    if (!city) {
        let fallback = input.match(/([A-Za-zÇĞİÖŞÜçğıöşü'’\-\s]{2,})/g);
        if (fallback && fallback.length) city = fallback[fallback.length-1].trim();
    }

    // 6. Son çare: ilk kelime
    if (!city) city = input.split(" ")[0].trim();

    // Gün sayısı bulunamazsa default 2
    if (!days || isNaN(days) || days < 1) days = 2;

    // Şehir adını düzelt (ilk harfi büyük)
    city = city.charAt(0).toUpperCase() + city.slice(1);

    return { city, days };
}

// Geocode doğrulama (cache ile)
const __cityCoordCache = new Map();

chatInput.addEventListener("input", function() {
    if (window.__programmaticInput) return;
    window.__locationPickedFromSuggestions = false;
    window.selectedLocationLocked = false;
    window.selectedLocation = null;
    disableSendButton && disableSendButton();
});

async function handleAnswer(answer) {

  // Concurrency guard: aynı anda ikinci isteği engelle
  if (window.isProcessing) return;
  window.isProcessing = true;

  const inputEl = document.getElementById("user-input");
  const raw = (answer || "").toString().trim();

  // ZORUNLU: Öneriden şehir seçilmediyse planlama yapma
  if (!window.__locationPickedFromSuggestions) {
    addMessage("Please select a city from the suggestions first.", "bot-message");
    window.isProcessing = false;
    return;
  }

  // Input'u temizle (kullanıcı hemen yeni şey yazabilsin)
  if (inputEl) inputEl.value = "";

  // Çok kısa veya tamamen boş ise
  if (!raw || raw.length < 2) {
    addMessage("Please enter a location request (e.g. 'Rome 2 days trip plan').", "bot-message");
    window.isProcessing = false;
    return;
  }

  if (window.__suppressNextUserEcho) {
    window.__suppressNextUserEcho = false;
  } else {
    addMessage(raw, "user-message");
  }
  showTypingIndicator();
  window.lastUserQuery = raw;

  // ŞEHİR VE GÜN SAYISINI PARSE ET
  const { location, days } = parsePlanRequest(raw);

  // Burada lastUserQuery'yi şehir ve trip plan formatında değiştir
  window.lastUserQuery = `${location} trip plan`;

  try {
    // parsePlanRequest beklenen alanları çıkaramadıysa
    if (!location || !days || isNaN(days)) {
      addMessage("I could not understand that. Try for example: 'Paris 3 days trip' or 'Plan a 2-day tour for Rome'.", "bot-message");
      return;
    }

    // Ekstra gürültü filtresi
    if (location.length < 2) {
      addMessage("Location name looks too short. Please clarify (e.g. 'Tokyo 1 day trip plan').", "bot-message");
      return;
    }

    // EKLENDİ: Şehir koordinatı kontrolü
    const coords = await getCityCoordinates(location);
    if (!coords || !coords.lat || !coords.lon || isNaN(coords.lat) || isNaN(coords.lon)) {
      addMessage("Could not find a valid location for your selection. Please select a valid city from the suggestions.", "bot-message");
      window.isProcessing = false;
      return;
    }

    window.selectedCity = location; // Diğer kodların beklentisini bozmuyoruz  

    // OTOMATİK PLAN ÜRETİMİ (mevcut davranışı koru)
    latestTripPlan = await buildPlan(location, days);
    latestTripPlan = await enrichPlanWithWiki(latestTripPlan);

    if (latestTripPlan && latestTripPlan.length > 0) {
      window.latestTripPlan = JSON.parse(JSON.stringify(latestTripPlan));
      window.cart = JSON.parse(JSON.stringify(latestTripPlan));
   
      showResults();
      updateTripTitle();
      insertTripAiInfo();

      const inputWrapper = document.querySelector('.input-wrapper');
      if (inputWrapper) inputWrapper.style.display = 'none';

      isFirstQuery = false;

      if (typeof openTripSidebar === "function") {
        openTripSidebar();
      }
    } else {
      addMessage("Could not create a plan for the specified location.", "bot-message");
    }
  } catch (error) {
    console.error("Plan creation error:", error);
    addMessage("Please specify a valid location and number of days (e.g. 'Rome 2 days', 'Paris 3 days').", "bot-message");
  } finally {
    hideTypingIndicator();
    window.isProcessing = false;
  }
}
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('user-input');
  if (!inp) return;
  inp.addEventListener('input', () => {
    // Programatik set fonksiyonun varsa ve flag kullanıyorsan:
    if (window.__programmaticInput) return;
    // Kullanıcı elle değiştirdi → seçim iptal
    window.__locationPickedFromSuggestions = false;
    window.selectedLocationLocked = false;
    window.selectedLocation = null;
    disableSendButton && disableSendButton();
  });
});

function addCanonicalMessage(canonicalStr) {
  const chatBox = document.getElementById("chat-box");
  if (!chatBox) return;
  const msg = document.createElement("div");
  msg.className = "message canonical-message";
  msg.innerHTML = `<img src="https://dev.triptime.ai/img/profile-icon.svg" alt="Profile" class="profile-img">
  <span>${canonicalStr}</span>`;
  // Typing-indicator varsa hemen sonrasına ekle, yoksa direk ekle
  const typingIndicator = chatBox.querySelector('#typing-indicator');
  if (typingIndicator && typingIndicator.nextSibling) {
    chatBox.insertBefore(msg, typingIndicator.nextSibling);
  } else {
    chatBox.appendChild(msg);
  }
}


function sendMessage() {
      console.log("showLoadingPanel çağrıldı!");

    showLoadingPanel()
  if (window.isProcessing) return;
  const input = document.getElementById("user-input");
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;

  // Öneriler yükleniyorken/gelmeden Enter basmayı engellemek istersen (opsiyonel flag):
  if (!window.__locationPickedFromSuggestions) {
    addMessage("Please select a city from the suggestions first.", "bot-message");
    return;
  }

  const formatted = formatCanonicalPlan(val);

  // --- CANONICAL MESAJI GÖSTER ---
  if (formatted.canonical) {
    addCanonicalMessage(formatted.canonical);
  }

  // Diff sadece seçim yapılmışsa
  if (window.__locationPickedFromSuggestions && formatted.canonical && formatted.changed) {
    const diffHtml = `
      <div class="canonical-diff">
        <span class="raw-strike">${strikeThrough(val)}</span>
        <span class="canon-arrow">→</span>
        <span class="canon-text">${formatted.canonical}</span>
      </div>
    `;
    addMessage(diffHtml, "user-message");
    window.__suppressNextUserEcho = true;
    handleAnswer(`${formatted.city} ${formatted.days} days`);
    input.value = "";
    return;
  }

  // Lokasyon kilidi yine güvenlik
  if (!window.selectedLocationLocked || !window.selectedLocation) {
    addMessage("Please select a city from the suggestions first.", "bot-message");
    return;
  }

  // Canonical formatta ise doğrudan parse
  const m = val.match(/Plan a (\d+)-day tour for (.+)$/i);
  if (m) {
    let days = parseInt(m[1], 10);
    if (!days || days < 1) days = 2;
    const city = window.selectedLocation.city || window.selectedLocation.name || m[2].trim();
    window.__suppressNextUserEcho = true;
    handleAnswer(`${city} ${days} days`);
    input.value = "";
    return;
  }

   // LOADING PANELİ GÖSTER
  showLoadingPanel();
  handleAnswer(val);
}

document.getElementById('send-button').addEventListener('click', sendMessage);


function addMessage(text, className) {
    const chatBox = document.getElementById("chat-box");
    const messageElement = document.createElement("div");
    messageElement.classList.add("message", className);

    const profileImg = document.createElement("img");
    profileImg.src = className === "user-message" ? "img/avatar_user.png" : "img/avatar_aiio.png";
    profileImg.alt = className === "user-message" ? "User" : "AI";
    profileImg.classList.add("profile-img");

    // Eğer bot-message ve text içinde <button> veya HTML fragmenti varsa innerHTML ile ekle
    if (className === "bot-message" && /<button|<div|<br/i.test(text)) {
        messageElement.appendChild(profileImg);
        const htmlDiv = document.createElement("span");
        htmlDiv.innerHTML = text;
        messageElement.appendChild(htmlDiv);
    } else {
        messageElement.appendChild(profileImg);
        const textElement = document.createElement("div");
        if (/<div|<span|canonical-diff|→/.test(text)) {
            textElement.innerHTML = text; // allow our diff HTML
        } else {
            textElement.textContent = text;
        }
        messageElement.appendChild(textElement);
    }

    chatBox.appendChild(messageElement);
    if (chatBox.scrollHeight - chatBox.clientHeight > 100) {
  chatBox.scrollTop = chatBox.scrollHeight;
}
}

function showTypingIndicator() {
  const chatBox = document.getElementById("chat-box");
  let indicator = document.getElementById("typing-indicator");
  if (!indicator) {
    indicator = document.createElement("div");
    indicator.id = "typing-indicator";
    indicator.className = "typing-indicator";
    indicator.innerHTML = '<span></span><span></span><span></span>';
    chatBox.appendChild(indicator);
  } else {
    indicator.style.display = "block";
    indicator.innerHTML = '<span></span><span></span><span></span>'; // DAİMA animasyonlu format!
  }
  if (chatBox.scrollHeight - chatBox.clientHeight > 100) {
  chatBox.scrollTop = chatBox.scrollHeight;
}
}

function hideTypingIndicator() {
  const typingIndicator = document.getElementById("typing-indicator");
  if (typingIndicator) typingIndicator.style.display = "none";
}


document.addEventListener("DOMContentLoaded", function() {
    const sendBtn = document.getElementById("send-button");
    if (sendBtn) sendBtn.addEventListener("click", sendMessage);

    const userInput = document.getElementById("user-input");
    if (userInput) userInput.addEventListener("keypress", handleKeyPress);
});


window.__triptime_addtotrip_listener_set = window.__triptime_addtotrip_listener_set || false;
window.__lastAddedItem = null;
let lastUserQuery = ""







// Tema başlığından şehir ve gün ayıklama fonksiyonu (kalsın)
// Tema başlığından şehir ve gün ayıklama fonksiyonu (kalsın)
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
document.querySelectorAll('.gallery-item').forEach(item => {
  item.addEventListener('click', async function() {
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
    const themeTitle = btn.parentNode.querySelector('.caption p').textContent.trim();
    document.getElementById('user-input').value = themeTitle;

    if (typeof updateSuggestions === 'function') {
      await updateSuggestions(themeTitle);
    }
    document.getElementById('user-input').focus();

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














// .addtotrip butonuna basıldığında day bilgisini stepsDiv'den veya window.currentDay'den al.
// 1) Kategori/slider'dan sepete ekleme (.addtotrip handler)
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

        const day = stepsDiv.getAttribute('data-day') || window.currentDay || 1;
        const category = stepsDiv.getAttribute('data-category');
        const title = stepsDiv.querySelector('.title')?.textContent.trim() || '';
        const image = stepsDiv.querySelector('img.check')?.src || 'img/placeholder.png';
        const address = stepsDiv.querySelector('.address')?.textContent.replace(/^[^:]*:\s*/, '').trim() || '';
        const opening_hours = stepsDiv.querySelector('.opening_hours')?.textContent.replace(/^[^:]*:\s*/, '').trim() || '';
        const lat = stepsDiv.getAttribute('data-lat');
        const lon = stepsDiv.getAttribute('data-lon');
        const website = (stepsDiv.querySelector('[onclick*="openWebsite"]')?.getAttribute('onclick')?.match(/'([^']+)'/) || [])[1] || '';

        // GÜVENLİ LOCATION PARAMETRESİ
        let location = null;
        if (lat !== null && lat !== undefined && lon !== null && lon !== undefined && !isNaN(Number(lat)) && !isNaN(Number(lon))) {
            location = { lat: Number(lat), lng: Number(lon) };
        }

        addToCart(
            title,
            image,
            day,
            category,
            address,
            null, // rating
            null, // user_ratings_total
            opening_hours,
            null, // place_id
            location,
            website
        );

        btn.classList.add('added');
        setTimeout(() => btn.classList.remove('added'), 1000);

        if (typeof restoreSidebar === "function") restoreSidebar();
        if (typeof updateCart === "function") updateCart();

    };

    document.addEventListener('click', listener);
    window.__triptime_addtotrip_listener = listener;
}

// Listener'ı başlat
initializeAddToTripListener();

let selectedCity = null;
let selectedDays = null;
let isProcessing = false;


function updateTripTitle() {
    const tripTitleDiv = document.getElementById("trip_title");
    const userQuery = window.lastUserQuery ? window.lastUserQuery.trim() : "";
    tripTitleDiv.textContent = userQuery.length > 0 ? userQuery : "Trip Plan";
}

async function clarifyLocation(query) {
    if (!query || query.trim().length < 2) {
        return { city: "", country: "" };
    }
    
    try {
        const response = await fetch('/llm-proxy/clarify-location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        
        // Basit veri doğrulama
        if (!data.city || typeof data.city !== 'string') {
            return { city: query, country: "" };
        }
        
        return data;
    } catch (error) {
        console.error("Location clarification failed:", error);
        return { city: query, country: "" };
    }
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


    function categoryIcon(category) {
        switch (category) {
            case "Coffee": return "img/coffee_icon.svg";
            case "Museum": return "img/museum_icon.svg";
            case "Touristic attraction": return "img/touristic_icon.svg";
            case "Restaurant": return "img/restaurant_icon.svg";
            case "Accommodation": return "img/accommodation_icon.svg";
            default: return "https://www.svgrepo.com/show/522166/location.svg";
        }
    }



const placeCategories = {
    "Coffee": "catering.cafe",     
    "Museum": "entertainment.museum",      
    "Touristic attraction": "tourism.sights",         
    "Restaurant": "catering.restaurant",
    "Accommodation": "accommodation.hotel",
    
};

// 1) Kategori sonuçlarını gösteren fonksiyon (slider entegre!)
window.showSuggestionsInChat = async function(category, day = 1, code = null, radiusKm = 3) {
    const city = window.selectedCity || document.getElementById("city-input")?.value;
    if (!city) {
        addMessage("Please select a city first.", "bot-message");
        return;
    }
    // Kategori kodunu belirle
    let realCode = code || geoapifyCategoryMap[category] || placeCategories[category];
    if (!realCode) {
        addMessage("Invalid category.", "bot-message");
        return;
    }
    // Yarıçapı metre cinsine çevir
    const radius = Math.round(radiusKm * 1000);

    // Arama yap
    //Kategori sonuç limiti
    const places = await getPlacesForCategory(city, category, 5, radius, realCode);

    if (!places.length) {
        // Sonuç yoksa slider barı göster
        addMessage(`
            <div class="radius-slider-bar">
                <p>No places found for this category in "${city}".</p>
                <label for="radius-slider">
                  🔎 Widen search area: <span id="radius-value">${radiusKm}</span> km
                </label>
                <input type="range" min="1" max="20" value="${radiusKm}" id="radius-slider" style="width:180px;">
            </div>
        `, "bot-message");

        // Slider event'ini bekle
        setTimeout(() => {
            const slider = document.getElementById("radius-slider");
            const valueLabel = document.getElementById("radius-value");
            if (slider && valueLabel) {
                slider.addEventListener("input", () => {
                    valueLabel.textContent = slider.value;
                });
                slider.addEventListener("change", async () => {
                    // Yeniden arama yap!
                    const newRadius = Number(slider.value);
                    await window.showSuggestionsInChat(category, day, code, newRadius);
                });
            }
        }, 200);

        return;
    }

    await enrichCategoryResults(places, city);
    displayPlacesInChat(places, category, day);
    if (window.innerWidth <= 768) {
        var sidebar = document.querySelector('.sidebar-overlay.sidebar-trip');
        if (sidebar) sidebar.classList.remove('open');
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
  const cityCoords = await getCityCoordinates(city);

  for (const cat of categories) {
    let radius = 3;
    let places = await getPlacesForCategory(city, cat, 12, radius * 1000);
    let attempt = 0;
    const maxAttempts = 5;
    const triedNames = new Set();
    while (places.length <= 1 && attempt < maxAttempts) {
      if (places.length === 1) triedNames.add(places[0].name);
      radius += 5;
      let newPlaces = await getPlacesForCategory(city, cat, 12, radius * 1000);
      newPlaces = newPlaces.filter(p => !triedNames.has(p.name));
      if (newPlaces.length > 0) {
        places = places.concat(newPlaces);
      }
      attempt++;
    }
    // Lucky algoritmasını SADECE mekan yoksa devreye sok!
    if (places.length === 0) {
      // Lucky: radius'u büyüterek en yakındaki mekanı bul
      let luckyRadius = radius + 5;
      let foundPlace = null;
      let luckyAttempts = 0;
      while (!foundPlace && luckyAttempts < 8) {
        const luckyResults = await getPlacesForCategory(city, cat, 10, luckyRadius * 1000);
        if (luckyResults.length > 0) {
          // Sadece daha önce eklenmemiş mekan gelsin
          const usedKeys = new Set(places.map(p => `${p.name}__${p.lat}__${p.lon}`));
          const newLucky = luckyResults.find(p => !usedKeys.has(`${p.name}__${p.lat}__${p.lon}`));
          if (newLucky) {
            foundPlace = newLucky;
            places.push(foundPlace);
          }
        }
        luckyRadius += 7;
        luckyAttempts++;
      }
    }
  console.log(`buildPlan - category: ${cat}, radius: ${radius}, found places:`);
    console.log(places.map(p => ({
      name: p.name,
      lat: p.lat,
      lon: p.lon,
      address: p.address,
      categories: p.categories
    })));
    categoryResults[cat] = places;
  }

  for (let day = 1; day <= days; day++) {
    let dailyPlaces = [];
    for (const cat of categories) {
      const places = categoryResults[cat];
      if (places.length > 0) {
        // Her gün için farklı mekan gelsin!
        const idx = (day - 1) % places.length;
         console.log(`buildPlan - Day ${day}, Category: ${cat}, Selected place:`, places[idx]);
      // --- LOG SONU ---
        dailyPlaces.push({ day, category: cat, ...places[idx] });
      } else {
        dailyPlaces.push({ day, category: cat, name: null, _noPlace: true });
      }
    }
    plan = plan.concat(dailyPlaces);
  }

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

        // Orijinal step objesini çek
        let stepObj = null;
        if (result.dataset.step) {
            try { stepObj = JSON.parse(result.dataset.step); } catch (e) { stepObj = null; }
        }

        // Latin adı al
        let name = "";
        // PATCH: Latin/İngilizce ad yoksa TITLE'dan al!
        if (stepObj && typeof getDisplayName === "function") {
            name = getDisplayName(stepObj);
            // Eğer name_en ve name_latin yoksa başlıktan al
            if ((!stepObj.name_en && !stepObj.name_latin) && result.querySelector('.title')) {
                name = result.querySelector('.title').textContent;
            }
        } else {
            name = result.querySelector('.title').textContent;
        }

        if (lat && lon) {
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


window.showMap = function(element) {
    const stepsElement = element.closest('.steps');
    const visualDiv = stepsElement.querySelector('.visual');
    const image = visualDiv.querySelector('img.check');
    stepsElement.querySelectorAll('.geoapify-tags-section').forEach(el => { el.style.display = 'none'; });
    stepsElement.querySelectorAll('.fav-heart').forEach(el => { el.style.display = 'none'; });
    stepsElement.querySelectorAll('.cats').forEach(el => { el.style.display = 'none'; });
    stepsElement.querySelectorAll('.visual.img').forEach(el => { el.style.display = 'none'; });  
    const lat = parseFloat(stepsElement.getAttribute('data-lat'));
    const lon = parseFloat(stepsElement.getAttribute('data-lon'));
    if (!isNaN(lat) && !isNaN(lon)) {
        // Eski iframe'i kaldır (DÜZELTME: class ismi aynı olmalı!)
        const oldIframe = visualDiv.querySelector('iframe.leaflet-mini-map');
        if (oldIframe) oldIframe.remove();
        if (image) image.style.display = "none";
        // Yeni iframe oluştur
        const iframe = document.createElement('iframe');
        iframe.className = 'leaflet-mini-map';
        iframe.src = `/mini-map.html?lat=${lat}&lon=${lon}`;
        iframe.width = "100%";
        iframe.height = "235";
        iframe.frameBorder = "0";
        iframe.style.border = "0";
        iframe.sandbox = "allow-scripts allow-same-origin";
        visualDiv.appendChild(iframe);
    } else {
        alert("Location not found.");
    }
};

window.showImage = function(element) {
    const stepsElement = element.closest('.steps');
    const visualDiv = stepsElement.querySelector('.visual');
    const image = visualDiv.querySelector('img.check');
    // DÜZELTME: Doğru class ile iframe'i kaldır!
    const iframe = visualDiv.querySelector('iframe.leaflet-mini-map');
    if (iframe) iframe.remove();
    if (image) image.style.display = '';

    // TAG, FAV ve CATS bölümlerini GERİ GETİR
    stepsElement.querySelectorAll('.geoapify-tags-section').forEach(el => {
        el.style.display = '';
    });
    stepsElement.querySelectorAll('.fav-heart').forEach(el => {
        el.style.display = '';
    });
    stepsElement.querySelectorAll('.cats').forEach(el => {
        el.style.display = '';
    });
};
    document.getElementById("send-button").addEventListener("click", sendMessage);
    userInput.addEventListener("keypress", handleKeyPress);

    displayQuestion();
});


// 2) Yerleri Geoapify'dan çeken fonksiyon
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


// Şehir koordinatı bulma fonksiyonu
async function getCityCoordinates(city) {
const url = `/api/geoapify/geocode?text=${encodeURIComponent(city)}&limit=1`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.features && data.features.length > 0) {
        const f = data.features[0];
        return { lat: f.properties.lat, lon: f.properties.lon };
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
    "Coffee": "img/coffee_icon.svg",
    "Museum": "img/museum_icon.svg",
    "Touristic attraction": "img/touristic_icon.svg",
    "Restaurant": "img/restaurant_icon.svg",
    "Accommodation": "img/accommodation_icon.svg" 
};

function addToCart(
  name, image, day, category, address = null, rating = null, user_ratings_total = null,
  opening_hours = null, place_id = null, location = null, website = null, options = {}, silent = false, skipRender
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
    addedAt: new Date().toISOString()
  };

  window.cart.push(newItem);

  // === skipRender fix ===
  if (typeof skipRender === "undefined") skipRender = false;

  // Sonraki kodlar aynı, silent değişkeni başta false olmalı
  if (!silent) {
    if (typeof updateCart === "function") updateCart();
    if (!skipRender && typeof renderRouteForDay === "function") {
      setTimeout(() => renderRouteForDay(resolvedDay), 0);
    }
    if (typeof openSidebar === 'function') {
      openSidebar();
      if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar-overlay.sidebar-trip');
        if (sidebar) sidebar.classList.add('open');
      }
    }
    if (typeof attachChatDropListeners === 'function') {
      attachChatDropListeners();
    }
    if (window.expandedMaps) {
      clearRouteSegmentHighlight(resolvedDay);
      fitExpandedMapToRoute(resolvedDay);
    }
    if (typeof saveTripAfterRoutes === "function") {
      saveTripAfterRoutes();
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


function displayPlacesInChat(places, category, day) {
    const chatBox = document.getElementById("chat-box");
    const uniqueId = `suggestion-${day}-${category.replace(/\s+/g, '-').toLowerCase()}`;
    const sliderId = `splide-slider-${uniqueId}`;

    chatBox.querySelectorAll(`#${sliderId}`).forEach(el => {
        el.closest('.survey-results')?.remove();
    });

    let html = `
        <div class="survey-results bot-message message">
            <div class="accordion-container">
                <input type="checkbox" id="${uniqueId}" class="accordion-toggle" checked>
                <label for="${uniqueId}" class="accordion-label">
                    Suggestions for ${category}
                    <img src="img/arrow_down.svg" class="accordion-arrow">
                </label>
                <div class="accordion-content">
                    <div class="splide" id="${sliderId}">
                        <div class="splide__track">
                            <ul class="splide__list">
    `;

    places.forEach((place, idx) => {
        html += `
            <li class="splide__slide">
                ${generateStepHtml(place, day, category, idx)}
            </li>
        `;
    });

    html += `
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

    chatBox.innerHTML += html;
    if (chatBox.scrollHeight - chatBox.clientHeight > 100) {
  chatBox.scrollTop = chatBox.scrollHeight;
}
    attachFavEvents();

    setTimeout(() => {
        // Tüm .splide sliderları için instance mount et
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
    window.currentDay = day;
    console.log("showCategoryList ÇAĞRILDI, day=", day);

    const cartDiv = document.getElementById("cart-items");
   
    // --- Üstteki otomatik plan ve custom note bölümleri aynı ---
    const autoPlanContainer = document.createElement("div");
    autoPlanContainer.id = "auto-plan-container";
    cartDiv.appendChild(autoPlanContainer);


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

    const customNoteContainer = document.createElement("div");
    customNoteContainer.id = "customNoteContainer";
    customNoteContainer.style.display = "none";
    customNoteContainer.innerHTML = `
        <h3>Add Custom Note for Day ${day}</h3>
        <input type="text" id="noteTitle" placeholder="Note title">
        <textarea id="noteDetails" placeholder="Note details"></textarea>
        <div class="modal-actions">
            <button class="save-note" onclick="saveCustomNote(${day})">Save Note</button>
            <button class="cancel-note" onclick="closeCustomNoteInput()">Cancel</button>
        </div>
    `;
    cartDiv.appendChild(customNoteContainer);

    const addCustomNoteButton = document.createElement("button");
    addCustomNoteButton.classList.add("add-custom-note-btn");
    addCustomNoteButton.textContent = "✍️ Add Custom Note";
    addCustomNoteButton.onclick = function() {
        document.getElementById("customNoteContainer").style.display = "block";
        addCustomNoteButton.style.display = "none";
    };
    cartDiv.appendChild(addCustomNoteButton);

    const addFavBtn = document.createElement("button");
addFavBtn.className = "add-favorite-place-btn";
addFavBtn.textContent = "❤️ Add from My Places";

addFavBtn.onclick = function() {
    window.toggleSidebarFavoritePlaces();
};
cartDiv.appendChild(addFavBtn);

 const basicPlanCategories = [
        { name: "Coffee", icon: "☕" },
        { name: "Museum", icon: "🏛️" },
        { name: "Touristic attraction", icon: "🏞️" },
        { name: "Restaurant", icon: "🍽️" },
        { name: "Accommodation", icon: "🏨" }
    ];

    const travelMainCategories = [
      { name: "Bar", code: "catering.bar", icon: "🍹" },
      { name: "Pub", code: "catering.pub", icon: "🍻" },
      { name: "Fast Food", code: "catering.fast_food", icon: "🍔" },
      { name: "Supermarket", code: "commercial.supermarket", icon: "🛒" },
      { name: "Pharmacy", code: "healthcare.pharmacy", icon: "💊" },
      { name: "Hospital", code: "healthcare.hospital", icon: "🏥" },
      { name: "Bookstore", code: "commercial.books", icon: "📚" },
      { name: "Post Office", code: "service.post", icon: "📮" },
      { name: "Library", code: "education.library", icon: "📖" },
      { name: "Hostel", code: "accommodation.hostel", icon: "🛏️" },
      { name: "Cinema", code: "entertainment.cinema", icon: "🎬" },
      { name: "Jewelry Shop", code: "commercial.jewelry", icon: "💍" }, 
      { name: "University", code: "education.university", icon: "🎓" },
      { name: "Religion", code: "religion", icon: "⛪" }
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

    // Buton class'ı toggle-subcategory-btn, yazısı List, event yok!
    const toggleBtn = document.createElement("button");
    toggleBtn.classList.add("toggle-subcategory-btn");
    toggleBtn.textContent = "View";
    subCategoryItem.appendChild(iconSpan);
    subCategoryItem.appendChild(nameSpan);
    subCategoryItem.appendChild(toggleBtn);
    basicList.appendChild(subCategoryItem);

    // Sadece kategoriye tıklama eventini bırak
    subCategoryItem.addEventListener("click", (e) => {
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

    // Buton class'ı toggle-subcategory-btn, yazısı List, event yok!
    const toggleBtn = document.createElement("button");
    toggleBtn.classList.add("toggle-subcategory-btn");
    toggleBtn.textContent = "View";
    subCategoryItem.appendChild(iconSpan);
    subCategoryItem.appendChild(nameSpan);
    subCategoryItem.appendChild(toggleBtn);
    travelerList.appendChild(subCategoryItem);

    // Sadece kategoriye tıklama eventini bırak
    subCategoryItem.addEventListener("click", async (e) => {
        showSuggestionsInChat(cat.name, day, cat.code);
    });
});

    travelerItem.appendChild(travelerList);
    cartDiv.appendChild(travelerItem);

    // Kapatma butonu aynı:
    const closeButton = document.createElement("button");
    closeButton.classList.add("close-btn");
    closeButton.textContent = "Close";
    closeButton.addEventListener("click", restoreSidebar);

    cartDiv.appendChild(closeButton);

    initPlaceSearch(day);

}

function closeCustomNoteInput() {
    var input = document.getElementById("custom-note-input");
    if (input) {
        input.style.display = "none";
    }
}
function saveCustomNote(day) {
    const title = document.getElementById("noteTitle").value;
    const details = document.getElementById("noteDetails").value;
    window.cart.push({
        name: title,
        noteDetails: details,
        day: Number(day), // sayı olarak!
        category: "Note",
        image: "img/added-note.png"
    });
    if (typeof updateCart === "function") updateCart();
}
const apiCache = new Map();

const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

let lastRequestTime = 0;
async function geoapifyAutocomplete(query) {
  const resp = await fetch(`/api/geoapify/autocomplete?q=${encodeURIComponent(query)}`);
  if (!resp.ok) throw new Error("API error");
  const data = await resp.json();
  // Eğer sıralama fonksiyonun varsa burada uygula
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

async function getImageForPlace(placeName, category, cityName) {
    const queries = [
        [placeName, category, cityName].filter(Boolean).join(" "),
        [placeName, cityName].filter(Boolean).join(" "),
        [placeName, category].filter(Boolean).join(" "),
        placeName
    ];
    for (let q of queries) {
        if (!q || !q.trim()) continue;
        const pexelsImg = await getPexelsImage(q);
        if (pexelsImg && pexelsImg !== PLACEHOLDER_IMG) {
            return pexelsImg;
        }
    }
    if (category) {
        const pixabayImg = await getPixabayCategoryImage(category);
        if (pixabayImg && pixabayImg !== PLACEHOLDER_IMG) {
            return pixabayImg;
        }
    }
    const fallbackPixabayImg = await getPixabayCategoryImage("travel");
    if (fallbackPixabayImg && fallbackPixabayImg !== PLACEHOLDER_IMG) {
        return fallbackPixabayImg;
    }
    return PLACEHOLDER_IMG;
}

async function getOptimizedImage(properties) {
    let query = properties.name || properties.city || properties.category || "travel";
    if (!query || typeof query !== "string" || query.trim() === "") query = "travel";
    const pexelsImg = await getPexelsImage(query);
    if (pexelsImg && pexelsImg !== PLACEHOLDER_IMG) {
        return pexelsImg;
    }
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
    }));
    return places;
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
async function getPhoto(query, source = 'pexels') {
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

    // Önceki listener'ı kaldır
    if (input._autocompleteHandler) {
        input.removeEventListener("input", input._autocompleteHandler);
    }

    input._autocompleteHandler = debounce(async function() {
        const query = this.value.trim();
        if (query.length < 3) {
            detailsDiv.innerHTML = "";
            return;
        }
        detailsDiv.innerHTML = "<div class='loading'>Searching...</div>";
        try {
            const suggestions = await geoapifyAutocomplete(query);
            detailsDiv.innerHTML = "";
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
    }, 500);

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
    const newItem = {
        name: props.name || props.address_line1 || '',
        image: imgUrl,
        day: parseInt(day),
        category: "Place",
        address: props.formatted || "",
        place_id: props.place_id,
        location: {
            lat: props.lat,
            lng: props.lon
        }
    };
    // Çift ekleme engeli
    if (!window.cart.some(item => item.place_id === newItem.place_id && item.day === newItem.day)) {
        
        updateCart();
    }
    // Feedback ve input temizleme
const detailsDiv = document.getElementById(`place-details-${day}`);
    if (detailsDiv) {
        detailsDiv.innerHTML = `<div class="success">✓ Added to Day ${day}</div>`;
        const input = document.getElementById(`place-input-${day}`);
        if (input) input.value = "";
        setTimeout(() => detailsDiv.innerHTML = "", 1500);
    }
}


function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
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
    updateCart();
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

  // Zaten harita varsa ve container içindeyse çık
  const existingMap = window.leafletMaps && window.leafletMaps[containerId];
  const hasInner = el.querySelector('.leaflet-container');
  if (existingMap && hasInner) return;
  
  // Harita var ama container uçmuşsa temizle
  if (existingMap && !hasInner) {
    try { existingMap.remove(); } catch(_) {}
    delete window.leafletMaps[containerId];
  }

  if (!el.style.height) el.style.height = '285px';
  
  // --- KONUM BELİRLEME MANTIĞI ---
  
  // 1. Önce bu güne ait noktaları al
  const points = typeof getDayPoints === 'function' ? getDayPoints(day) : [];
  const validPts = points.filter(p => isFinite(p.lat) && isFinite(p.lng));
  
  let startCenter = [0, 0];
  let startZoom = 2;
  let startBounds = null;
  let hasFocus = false; // Bir odak noktası bulduk mu?

  // DURUM A: Bu günün zaten noktaları var (Düzenleme modu vb.)
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
  // DURUM B: Bu gün boş ama ÖNCEKİ GÜN var (Yeni gün ekleme senaryosu)
  else if (day > 1 && typeof getDayPoints === 'function') {
      const prevPoints = getDayPoints(day - 1);
      const validPrevPts = prevPoints.filter(p => isFinite(p.lat) && isFinite(p.lng));
      
      if (validPrevPts.length > 0) {
          // Önceki günün EN SON noktasını al
          const lastPt = validPrevPts[validPrevPts.length - 1];
          startCenter = [lastPt.lat, lastPt.lng];
          startZoom = 12; // Yeni gün için ideal başlangıç zoom seviyesi
          hasFocus = true;
          console.log(`[Map Init] Day ${day} starts at Day ${day-1}'s last point:`, lastPt.name);
      }
  }

  // 3. Haritayı belirlenen konumda başlat
  const map = L.map(containerId, {
    center: startCenter,
    zoom: startZoom,
    scrollWheelZoom: true,
    fadeAnimation: false,
    zoomAnimation: true,
    zoomAnimationThreshold: 8,
    zoomSnap: 0.25,
    zoomDelta: 0.25,
    wheelDebounceTime: 35,
    wheelPxPerZoomLevel: 120,
    inertia: true,
    easeLinearity: 0.2
  });

  // 4. Eğer sınır kutusu (bounds) varsa ona sığdır
  if (startBounds && startBounds.isValid()) {
      map.fitBounds(startBounds, { 
          padding: [20, 20], 
          animate: false 
      });
  }
  
  // 5. GPS Kullanımı (Sadece hiçbir odak noktası bulunamadıysa - örn: Day 1 ve boş)
  if (!hasFocus && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(pos) {
      // Async kontrol: Kullanıcı bu arada nokta eklemiş olabilir mi?
      const currentPts = typeof getDayPoints === 'function' ? getDayPoints(day) : [];
      if (currentPts.length === 0) {
          map.whenReady(function() {
            try {
               map.setView([pos.coords.latitude, pos.coords.longitude], 13, { animate: true });
            } catch(e) {}
          });
      }
    }, function(err) {}, { timeout: 3000 });
  }

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
  
  if (!map._initialView) {
    map._initialView = {
      center: map.getCenter(),
      zoom: map.getZoom()
    };
  }
  
  window.leafletMaps = window.leafletMaps || {};
  window.leafletMaps[containerId] = map;
}
function restoreLostDayMaps() {
  if (!window.leafletMaps) return;
  Object.keys(window.leafletMaps).forEach(id => {
    if (!/^route-map-day\d+$/.test(id)) return;
    const container = document.getElementById(id);
    if (!container) return; // Gün tamamen silinmiş olabilir
    if (!container.querySelector('.leaflet-container')) {
      const old = window.leafletMaps[id];
      let center = null, zoom = null;
      try {
        center = old.getCenter();
        zoom = old.getZoom();
        old.remove();
      } catch(_){}
      delete window.leafletMaps[id];

      const day = parseInt(id.replace('route-map-day',''), 10);
      initEmptyDayMap(day);
      if (center && window.leafletMaps[id]) {
        try { window.leafletMaps[id].setView(center, zoom || window.leafletMaps[id].getZoom()); } catch(_){}
      }
      if (typeof renderRouteForDay === 'function') {
        setTimeout(()=>renderRouteForDay(day), 0);
      }
    }
  });
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

  // Aynı gün için bir kere bağla
  map.__tt_clickAddBound = map.__tt_clickAddBound || {};
  if (map.__tt_clickAddBound[day]) return;
  map.__tt_clickAddBound[day] = true;

  // YALNIZCA TEK TIK eklesin: tek-tık zamanlayıcısı
  let __singleClickTimer = null;
  const SINGLE_CLICK_DELAY = 250; // ms

  // Tek tık: zamanlayıcı ile çalış; bu süre içinde dblclick/zoom başlarsa iptal edilir
  map.on('click', function(e) {
    if (__singleClickTimer) clearTimeout(__singleClickTimer);
    __singleClickTimer = setTimeout(async () => {
      // Planlama modu açık değilse veya başka günse görmezden gel
      if (!window.mapPlanningActive || window.mapPlanningDay !== day) return;

      const { lat, lng } = e.latlng;

      // Reverse geocode (hızlı) – hata olursa default isim
      let placeInfo = { name: "New Point", address: "", opening_hours: "" };
      try {
        const rInfo = await getPlaceInfoFromLatLng(lat, lng);
        if (rInfo && rInfo.name) placeInfo = rInfo;
      } catch(_) {}

      // Aynı koordinatta (± çok küçük delta) duplicate engelle
      const dup = window.cart.some(it =>
        it.day === day &&
        it.location &&
        Math.abs(it.location.lat - lat) < 1e-6 &&
        Math.abs(it.location.lng - lng) < 1e-6
      );
      if (dup) return;

      // Görsel fallback
      let imageUrl = 'img/placeholder.png';
      try {
        imageUrl = await getImageForPlace(placeInfo.name || 'New Point', 'Place', window.selectedCity || '');
      } catch(_) {}

      // 1. Önce starter'ı sil
      window.cart = window.cart.filter(it => !(it.day === day && it._starter));

      // 2. Marker item'ı window.cart'a EKSİKSİZ ekle:
      const markerItem = {
        name: placeInfo.name || "Point",
        image: imageUrl,
        day: day,
        category: "Place",
        address: placeInfo.address || "",
        opening_hours: placeInfo.opening_hours || "",
        location: { lat: lat, lng: lng }
      };
      window.cart.push(markerItem);

      // Add Category butonunu aç
      window.__hideAddCatBtnByDay[day] = false;

      // Sonra updateCart çağır (travel-item DOM garanti!)
      if (typeof updateCart === "function") updateCart();

      // Marker çiz
      const marker = L.circleMarker([lat, lng], {
        radius: 7,
        color: '#8a4af3',
        fillColor: '#8a4af3',
        fillOpacity: 0.9,
        weight: 2
      }).addTo(map).bindPopup(`<b>${placeInfo.name || 'Point'}</b>`);

      window.mapPlanningMarkersByDay[day] = window.mapPlanningMarkersByDay[day] || [];
      window.mapPlanningMarkersByDay[day].push(marker);

      // 2+ nokta olunca rota
      if (typeof renderRouteForDay === 'function') {
        setTimeout(() => renderRouteForDay(day), 100);
      }
    }, SINGLE_CLICK_DELAY);
  });

  // Çift tık (yakınlaşma) gelirse tek-tık zamanlayıcısını iptal et
  map.on('dblclick', function() {
    if (__singleClickTimer) {
      clearTimeout(__singleClickTimer);
      __singleClickTimer = null;
    }
  });

  // Yakınlaşma/pan gibi zoomstart sırasında da iptal et (mobil çift-tap zoom vs.)
  map.on('zoomstart', function() {
    if (__singleClickTimer) {
      clearTimeout(__singleClickTimer);
      __singleClickTimer = null;
    }
  });
}



async function updateCart() {
    window.pairwiseRouteSummaries = window.pairwiseRouteSummaries || {};

  const days = [...new Set(window.cart.map(i => i.day))].sort((a, b) => a - b);

  // ÖNCE route'ları HAZIRLA!
  for (const d of days) {
    await renderRouteForDay(d);
    console.log('pairwise summary', d, window.pairwiseRouteSummaries[`route-map-day${d}`]);
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
  const oldEndDates  = window.cart.endDates;
  window.cart = window.cart.filter(it =>
    it && typeof it === "object" &&
    (
      (typeof it.day !== "undefined" && Object.keys(it).length === 1) ||
      (it.name || it.location || it.category)
    )
  );
  if (oldStartDate) window.cart.startDate = oldStartDate;
  if (oldEndDates)  window.cart.endDates  = oldEndDates;

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
cartDiv.innerHTML = "";
for (let day = 1; day <= totalDays; day++) {
    const dayItemsArr = window.cart.filter(i =>
      Number(i.day) === Number(day) &&
      !i._starter &&
      !i._placeholder &&
      (i.name || i.category === "Note")
    );
    const isEmptyDay = dayItemsArr.length === 0;

    let dayContainer = document.getElementById(`day-container-${day}`);

    if (!dayContainer) {
      dayContainer = document.createElement("div");
      dayContainer.className = "day-container";
      dayContainer.id = `day-container-${day}`;
      dayContainer.dataset.day = day;
    } else {
      const savedRouteMap = dayContainer.querySelector(`#route-map-day${day}`);
      const savedRouteInfo = dayContainer.querySelector(`#route-info-day${day}`);
      dayContainer.innerHTML = "";
      if (!isEmptyDay) {
        if (savedRouteMap) dayContainer.appendChild(savedRouteMap);
        if (savedRouteInfo) dayContainer.appendChild(savedRouteInfo);
      }
    }

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
    dayHeader.appendChild(createDayActionMenu(day));
    dayContainer.appendChild(dayHeader);

    const confirmationContainer = document.createElement("div");
    confirmationContainer.className = "confirmation-container";
    confirmationContainer.id = `confirmation-container-${day}`;
    confirmationContainer.style.display = "none";
    dayContainer.appendChild(confirmationContainer);

    const dayList = document.createElement("ul");
    dayList.className = "day-list";
    dayList.dataset.day = day;

  // PATCH: Eğer gün hiçbir travel-item göstermiyorsa ama en az bir gerçek marker (nokta) varsa, travel-item'ı zorla ekle!
console.log("[PATCH ÖNÜ] isEmptyDay:", isEmptyDay, "day:", day, "window.cart:", window.cart);
console.log("[PATCH] dayList typeof:", typeof dayList, "nodeName:", dayList?.nodeName, "childCount:", dayList?.childElementCount);


    
const containerId = `route-map-day${day}`;
const travelMode = typeof getTravelModeForDay === "function" ? getTravelModeForDay(day) : "driving";
const pairwiseSummaries = window.pairwiseRouteSummaries?.[containerId] || [];
const points = dayItemsArr.map(it => it.location ? it.location : null).filter(Boolean);

// ... updateCart fonksiyonunun içi ...

    for (let idx = 0; idx < dayItemsArr.length; idx++) {
      const item = dayItemsArr[idx];
      const currIdx = window.cart.indexOf(item);

      const li = document.createElement("li");
      li.className = "travel-item";
      li.draggable = true;
      li.dataset.index = currIdx;
      if (item.location && typeof item.location.lat === "number" && typeof item.location.lng === "number") {
        li.setAttribute("data-lat", item.location.lat);
        li.setAttribute("data-lon", item.location.lng);
      }
      li.addEventListener("dragstart", dragStart);

      // --- MARKER HTML YAPISI (Senin İstediğin) ---
      // Ölçeklendirme (scale) ve margin ile listeye tam oturttuk
      const listMarkerHtml = `
        <div class="custom-marker-outer red" style="flex-shrink: 0;
    transform: scale(0.70);
    position: absolute;
    left: 30px;
    top: 0px;">
            <span class="custom-marker-label" style="font-size: 14px;">${idx + 1}</span>
        </div>
      `;
      // -------------------------------------------

      if (item.category === "Note") {
        li.innerHTML = `
          <div class="cart-item">
             <div style="display: flex; align-items: center; justify-content: space-between; width: 100%">
              <div style="display: flex; align-items: center; gap: 10px;">
                ${listMarkerHtml} 
                <img src="${item.image || 'img/added-note.png'}" alt="${item.name}" class="cart-image">
                <div class="item-info">
                  <p class="toggle-title">${item.name}</p>
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:5px;">
                <button class="remove-btn" onclick="removeFromCart(${currIdx})">
                  <img src="img/remove-icon.svg" alt="Close">
                </button>
                <span class="arrow">
                  <img src="https://www.svgrepo.com/show/520912/right-arrow.svg" class="arrow-icon" onclick="toggleContent(this)">
                </span>
              </div>
            </div>
            <div class="confirmation-container" id="confirmation-container-${li.dataset.index}" style="display:none;"></div>
            <div class="content">
              <div class="info-section">
                <div class="note-details">
                  <p>${item.noteDetails ? escapeHtml(item.noteDetails) : ""}</p>
                </div>
              </div>
            </div>
          </div>
        `;
      } else {
        // --- NORMAL YERLER (Places) ---
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

        li.innerHTML = `
          <div class="cart-item">
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%">
              <div style="display: flex; align-items: center; gap: 10px;">
                                <img src="https://www.svgrepo.com/show/458813/move-1.svg" alt="Drag" class="drag-icon">

                <div class="item-position">${listMarkerHtml}                
                  <img src="${item.image}" alt="${item.name}" class="cart-image">
                </div>
                
                <img src="${categoryIcons[item.category] || 'https://www.svgrepo.com/show/522166/location.svg'}" alt="${item.category}" class="category-icon">
                <div class="item-info">
                  <p class="toggle-title">${item.name}</p>
                </div>
              </div>
              <span class="arrow">
                <img src="https://www.svgrepo.com/show/520912/right-arrow.svg" class="arrow-icon" onclick="toggleContent(this)">
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
                data-name="${item.name}"
                data-category="${item.category}"
                data-lat="${item.location?.lat ?? item.lat ?? ""}"
                data-lon="${item.location?.lng ?? item.lon ?? ""}">
                <span class="fav-heart"
                  data-name="${item.name}"
                  data-category="${item.category}"
                  data-lat="${item.location?.lat ?? item.lat ?? ""}"
                  data-lon="${item.location?.lng ?? item.lon ?? ""}">
                  <img class="fav-icon" src="${isTripFav(item) ? '/img/like_on.svg' : '/img/like_off.svg'}" alt="Favorite" style="width:18px;height:18px;">
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
      
      // ... (Mesafe/Süre separator kodları devam eder) ...

  // travelMode'yi doğru al:
// Separator (mesafe/süre) ayraçlarını doğru ekle!
const nextItem = dayItemsArr[idx + 1];
const hasNextLoc =
  item.location &&
  typeof item.location.lat === "number" &&
  typeof item.location.lng === "number" &&
  nextItem &&
  nextItem.location &&
  typeof nextItem.location.lat === "number" &&
  typeof nextItem.location.lng === "number";

// Travel mode kesin al
const travelMode =
  typeof getTravelModeForDay === "function"
    ? String(getTravelModeForDay(day)).trim().toLowerCase()
    : "car"; // fallback

if (hasNextLoc) {
  let distanceStr = '';
  let durationStr = '';
  let prefix = '';

  // Noktaları al
  // Sadece şu iki noktanın Türkiye'de olup olmadığını kontrol etmek ideal
  const isInTurkey = areAllPointsInTurkey([item.location, nextItem.location]);

  if (!isInTurkey) {
    // --- TÜRKİYE DIŞI: Auto generated ---
    const ptA = item.location;
    const ptB = nextItem.location;
    const distM = haversine(ptA.lat, ptA.lng, ptB.lat, ptB.lng);
    const durSec = Math.round((distM / 1000) / 4 * 3600);
    distanceStr = distM >= 1000 ? (distM / 1000).toFixed(2) + " km" : Math.round(distM) + " m";
    durationStr = durSec >= 60 ? Math.round(durSec / 60) + " min" : Math.round(durSec) + " sec";
    prefix = `<span class="auto-generated-label" style="font-size:12px;margin-right:5px;">Auto generated</span>`;
  } else {
    // --- TÜRKİYE İÇİ: Icon modları ---
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

    // --- İKONLAR ---
    if (travelMode === "driving") {
      prefix = `<img src="https://dev.triptime.ai/img/way_car.svg" alt="Car">`;
    } else if (travelMode === "bike" || travelMode === "cycling") {
      prefix = `<img src="https://dev.triptime.ai/img/way_bike.svg" alt="Bike">`;
    } else if (travelMode === "walk" || travelMode === "walking") {
      prefix = `<img src="https://dev.triptime.ai/img/way_walk.svg" alt="Walk">`;
    } else {
      prefix = ''; // Diğer tiplerde ikon gösterme
    }
  }

  // DOM separator ekle
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
// PATCH: Travel-item ekledikten hemen sonra harita+rota kontrolleri koy
ensureDayMapContainer(day);
initEmptyDayMap(day);
wrapRouteControls(day);
setTimeout(() => wrapRouteControls(day), 0);



// --- Herhangi bir günde gerçek item varsa, tüm günlerde Add Category çıkar ---
const anyDayHasRealItem = window.cart.some(i =>
  !i._starter && !i._placeholder && i.category !== "Note" && i.name
);
const hideAddCat = window.__hideAddCatBtnByDay && window.__hideAddCatBtnByDay[day];


if (anyDayHasRealItem && !hideAddCat) {
  // 2. ADD CATEGORY BUTONU
  const addMoreButton = document.createElement("button");
  addMoreButton.className = "add-more-btn";
  addMoreButton.textContent = "+ Add Category";
  addMoreButton.dataset.day = day;
  addMoreButton.onclick = function () {
    // Önce eski içeriği temizle!
    const cartDiv = document.getElementById("cart-items");
    if (cartDiv) cartDiv.innerHTML = "";
    showCategoryList(this.dataset.day);
  };
  dayList.appendChild(addMoreButton);
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
addNewDayButton.textContent = "+ Add New Day";
addNewDayButton.onclick = function () { addNewDay(this); };
cartDiv.appendChild(addNewDayButton);



  // --- Diğer kalan işlemler ---
  const itemCount = window.cart.filter(i => i.name && !i._starter && !i._placeholder).length;
  if (menuCount) {
    menuCount.textContent = itemCount;
    menuCount.style.display = itemCount > 0 ? "inline-block" : "none";
  }

  attachDragListeners();
  days.forEach(d => initPlaceSearch(d));
  addCoordinatesToContent();
  days.forEach(d => {
    const suppressing = window.__suppressMiniUntilFirstPoint &&
                        window.__suppressMiniUntilFirstPoint[d];
    const realPoints = getDayPoints ? getDayPoints(d) : [];
    if (suppressing && realPoints.length === 0) {
      return;
    }
    renderRouteForDay(d);
  });
  setTimeout(wrapRouteControlsForAllDays, 0);
  attachChatDropListeners();

  if (window.expandedMaps) {
    Object.values(window.expandedMaps).forEach(({ expandedMap, day }) => {
      if (expandedMap) updateExpandedMap(expandedMap, day);
    });
  }

  initDragDropSystem();
  if (typeof interact !== 'undefined') setupMobileDragDrop();
  setupSidebarAccordion();

  renderTravelModeControlsForAllDays();

  (function ensureSelectDatesButton() {
    const hasRealItem = Array.isArray(window.cart) && window.cart.some(i =>
      !i._starter && !i._placeholder && i.name && i.name.trim() !== ''
    );
    if (!hasRealItem) {
      let btn = cartDiv.querySelector('.add-to-calendar-btn[data-role="trip-dates"]');
      if (btn) btn.remove();
      return;
    }
    let btn = cartDiv.querySelector('.add-to-calendar-btn[data-role="trip-dates"]');
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'add-to-calendar-btn';
      btn.setAttribute('data-role', 'trip-dates');
      cartDiv.appendChild(btn);
    }
    btn.textContent = window.cart?.startDate ? 'Change Dates' : 'Select Dates';
    btn.onclick = () => {
      if (typeof openCalendar === 'function') {
        const maxDay = [...new Set(window.cart.map(i => i.day))].sort((a, b) => a - b).pop() || 1;
        openCalendar(maxDay);
      }
    };
  })();

(function ensureNewChatInsideCart(){
  const oldOutside = document.querySelector('#newchat');
  if (oldOutside && !oldOutside.closest('#cart')) oldOutside.remove();
  const cartRoot = document.getElementById('cart');
  if (!cartRoot) return;
  let newChat = cartRoot.querySelector('#newchat');
  if (!newChat){
    newChat = document.createElement('div');
    newChat.id = 'newchat';
    newChat.textContent = 'New Trip Plan';
    newChat.style.cursor = 'pointer';

    newChat.onclick = function() {
      const chatBox = document.getElementById('chat-box');
      if (chatBox) chatBox.innerHTML = '';
      const userInput = document.getElementById('user-input');
      if (userInput) userInput.value = '';

      // Temizlik - global değişkenler
      window.selectedCity = null;
      window.selectedLocation = null;
      window.selectedLocationLocked = false;
      window.__locationPickedFromSuggestions = false;
      window.lastUserQuery = '';
      window.latestTripPlan = [];
      window.cart = [];

      // Tüm harita ve overlay temizliği
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

      // Welcome mesajı ekle
     if (chatBox) {
        let indicator = document.getElementById('typing-indicator');
        if (!indicator) {
          indicator = document.createElement('div');
          indicator.id = 'typing-indicator';
          indicator.className = 'typing-indicator';
          indicator.innerHTML = '<span></span><span></span><span></span>';
          chatBox.appendChild(indicator);
        } else {
          indicator.style.display = 'block';
          indicator.innerHTML = '<span></span><span></span><span></span>';
        }

        const welcome = document.createElement('div');
        welcome.className = 'message bot-message';
        welcome.innerHTML = "<img src='img/avatar_aiio.png' alt='Bot Profile' class='profile-img'>Let's get started.";
        chatBox.appendChild(welcome);

        if (chatBox.scrollHeight - chatBox.clientHeight > 100) {
  chatBox.scrollTop = chatBox.scrollHeight;
}      }

      // input-wrapper tekrar görünür olsun
      var iw = document.querySelector('.input-wrapper');
      if (iw) iw.style.display = '';

      // Tüm seçili suggestionları temizle
      document.querySelectorAll('.category-area-option.selected-suggestion').forEach(function(el) {
        el.classList.remove('selected-suggestion');
      });

      // Trip Details ekranını tamamen kaldır (mobil ve desktop için)
  const tripDetailsSection = document.getElementById("tt-trip-details");
  if (tripDetailsSection) tripDetailsSection.remove();

  // Eğer chat-screen içinde de bir şey varsa (mobilde), onu da temizle:
  const chatScreen = document.getElementById("chat-screen");
  if (chatScreen) chatScreen.innerHTML = "";

    };
  }
  const datesBtn = cartRoot.querySelector('.add-to-calendar-btn[data-role="trip-dates"]');
  if (datesBtn && datesBtn.nextSibling !== newChat){
    datesBtn.insertAdjacentElement('afterend', newChat);
  } else if (!datesBtn && newChat.parentNode !== cartRoot){
    cartRoot.appendChild(newChat);
  }
  const itemCount = window.cart.filter(i => i.name && !i._starter && !i._placeholder).length;
  newChat.style.display = itemCount > 0 ? 'block' : 'none';
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

  (function ensureTripDetailsBlock() {
    if (!window.cart.startDate) {
      const existing = cartDiv.querySelector('.date-range');
      if (existing) existing.remove();
      return;
    }
    let dateRangeDiv = cartDiv.querySelector('.date-range');
    if (!dateRangeDiv) {
      dateRangeDiv = document.createElement('div');
      dateRangeDiv.className = 'date-range';
      cartDiv.appendChild(dateRangeDiv);
    }
    const endDate = (window.cart.endDates && window.cart.endDates.length)
      ? window.cart.endDates[window.cart.endDates.length - 1]
      : window.cart.startDate;
    dateRangeDiv.innerHTML = `
      <span class="date-info">📅 Dates: ${window.cart.startDate} - ${endDate}</span>
      <button type="button" class="see-details-btn" data-role="trip-details-btn">🧐 Trip Details</button>
    `;
    const detailsBtn = dateRangeDiv.querySelector('[data-role="trip-details-btn"]');
    if (detailsBtn) {
      detailsBtn.onclick = () => {
        if (typeof showTripDetails === 'function') {
          showTripDetails(window.cart.startDate);
        }
      };
    }
  })();

  // === AI Info yerine Generate AI Info butonu ekle ===
(function(){
  // AI kutusu veya buton zaten varsa tekrar ekleme
  if (document.querySelector('.ai-info-section') || document.getElementById('generate-ai-info-btn')) return;
  // Sepette en az 1 gerçek item olmalı
  if (!window.cart || window.cart.length === 0) return;
  // İlk gerçek noktanın şehir bilgisini çek
  let city = null;
  const first = window.cart.find(it =>
    it.location &&
    typeof it.location.lat === "number" &&
    typeof it.location.lng === "number"
  );
  if (first && first.address) {
    const parts = first.address.split(",");
    if (parts.length >= 2) {
      city = parts[parts.length - 2].trim();
    }
  }
  if (!city) return;

  // AI bilgi kutusunun geleceği yere (trip_title'dan sonra) butonu koy
  const tripTitleDiv = document.getElementById('trip_title');
  if (!tripTitleDiv) return;

  // AI kutusu yerine buton
  const btnDiv = document.createElement('div');
  btnDiv.className = 'ai-info-section';
  btnDiv.style = "text-align:center;margin:18px 0 18px 0;";
  const btn = document.createElement('button');
  btn.id = 'generate-ai-info-btn';
  btn.textContent = 'Generate AI Info';
  btn.style = "padding:10px 24px;font-size:17px;font-weight:600;border-radius:8px;border:1px solid #8a4af3;background:#fff;color:#8a4af3;cursor:pointer;box-shadow:0 1px 8px #e9e1fa;";
  btn.onclick = async function() {
    btn.disabled = true;
    btn.textContent = 'Yükleniyor...';
    // Butonun yerine AI info kutusunu ekle!
    await insertTripAiInfo(null, null, city);
    btnDiv.remove();
  };
  btnDiv.appendChild(btn);
  tripTitleDiv.insertAdjacentElement('afterend', btnDiv);
})();

  setTimeout(() => {
    document.querySelectorAll('.day-list').forEach(dayList => {
      if (!dayList._sortableSetup) {
        Sortable.create(dayList, {
          animation: 150,
          handle: '.drag-icon',
          onEnd: function (evt) {
            const day = dayList.dataset.day;
            const newOrder = Array.from(dayList.querySelectorAll('.travel-item')).map(li => Number(li.dataset.index));
            const items = window.cart.filter(i => Number(i.day) === Number(day) && !i._starter && !i._placeholder && (i.name || i.category === "Note"));
            newOrder.forEach((cartIdx, newPos) => {
              const moved = window.cart.findIndex(it => window.cart.indexOf(it) === cartIdx);
              if (moved > -1) window.cart.splice(moved, 1, items[newPos]);
            });
            updateCart();
          }
        });
        dayList._sortableSetup = true;
      }
    });
  }, 0);

 // EN SON:
    if (window.latestAiInfoHtml && !document.querySelector('.ai-trip-info-box')) {
        const div = document.createElement("div");
        div.innerHTML = window.latestAiInfoHtml;
        cartDiv.appendChild(div.firstElementChild);
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
  s.textContent = `
    .action-buttons-container { position: relative; display: flex; align-items: center; }
    .action-menu-trigger {
      appearance: none; border: 1px solid #ddd; background: #fff; color: #333;
      border-radius: 8px; padding: 4px 8px; cursor: pointer; font-size: 16px; line-height: 1;
    }
    .action-menu { position: relative; }
    .action-menu-list {
      position: absolute; right: 0; top: calc(100% + 6px);
      background: #fff; border: 1px solid #e0e0e0; border-radius: 10px;
      box-shadow: 0 6px 18px rgba(0,0,0,0.12);
      padding: 6px 0; min-width: 160px; z-index: 10005; display: none;
    }
    .action-menu.open .action-menu-list { display: block; }
    .action-menu-item {
      width: 100%; display: flex; align-items: center; gap: 8px;
      padding: 8px 12px; background: transparent; border: none; text-align: left;
      cursor: pointer; font-size: 14px; color: #333;
    }
    .action-menu-item:hover { background: #f5f7ff; }
    .action-menu-item .icon { width: 18px; display: inline-block; }
    /* Remove maddesi vurgulu (isteğe bağlı) */
    .action-menu-item.remove { color: #c62828; }
    .action-menu-item.remove:hover { background: #ffecec; }
  `;
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
  s.textContent = `
    .day-header {
      display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-block-start: 0em;
    margin-block-end: 1em;
    }
    .day-header .title-container {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `;
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

// 1. updateExpandedMap Fonksiyonunu Güncelle (Haversine hesabını engelle)
function updateExpandedMap(expandedMap, day) {
    console.log("[ROUTE DEBUG] --- updateExpandedMap ---");
    console.log("GÜN:", day);

    const containerId = `route-map-day${day}`;
    const geojson = window.lastRouteGeojsons?.[containerId];

    const rawPoints = getDayPoints(day);
    const pts = rawPoints.filter(
        p => typeof p.lat === "number" && isFinite(p.lat) &&
             typeof p.lng === "number" && isFinite(p.lng)
    );

    if (!window._curvedArcPointsByDay) window._curvedArcPointsByDay = {};
    window._curvedArcPointsByDay[day] = []; 

    // Türkiye kontrolü
    const isInTurkey = areAllPointsInTurkey(pts);

    // Overlay layerları temizle
    expandedMap.eachLayer(layer => {
        if (
            layer instanceof L.Marker ||
            layer instanceof L.Polyline ||
            layer instanceof L.Circle ||
            layer instanceof L.CircleMarker
        ) {
            expandedMap.removeLayer(layer);
        }
    });

    // --- YENİ MANTIK: Boş bir sınır kutusu oluştur ---
    let bounds = L.latLngBounds(); 

    let hasValidRoute = (
      isInTurkey &&
      geojson &&
      geojson.features &&
      geojson.features[0] &&
      geojson.features[0].geometry &&
      Array.isArray(geojson.features[0].geometry.coordinates) &&
      geojson.features[0].geometry.coordinates.length > 1
    );

    if (hasValidRoute) {
        // [lng, lat] -> [lat, lng] dönüşümü
        const routeCoords = geojson.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
        
        // Rotayı çiz
        const poly = L.polyline(routeCoords, {
            color: "#1976d2",
            weight: 6,
            opacity: 1,
            dashArray: null
        }).addTo(expandedMap);
        
        // --- KRİTİK: Rota çizgisinin sınırlarını kutuya ekle ---
        bounds.extend(poly.getBounds());

        window._curvedArcPointsByDay[day] = routeCoords.map(coord => [coord[1], coord[0]]);

        // Snap Lines (Eksik noktalar için kesikli çizgiler)
        const rawGeojsonCoords = geojson.features[0].geometry.coordinates; 
        const routePtsForSnap = routeCoords; 
        
        pts.forEach((mp) => { 
            if (isPointReallyMissing(mp, rawGeojsonCoords, 50)) {
                let minIdx = 0, minDist = Infinity;
                for (let i = 0; i < routePtsForSnap.length; i++) {
                    const [lat, lng] = routePtsForSnap[i];
                    const d = haversine(lat, lng, mp.lat, mp.lng);
                    if (d < minDist) {
                        minDist = d;
                        minIdx = i;
                    }
                }
                const start = [mp.lat, mp.lng]; 
                const end = routePtsForSnap[minIdx]; 
                L.polyline([start, end], {
                    dashArray: '8, 12',
                    color: '#d32f2f',
                    weight: 4,
                    opacity: 0.8,
                    interactive: false,
                    renderer: ensureCanvasRenderer(expandedMap)
                }).addTo(expandedMap);
            }
        });

   } else if (pts.length > 1 && !isInTurkey) {
        // FLY MODE (Büyük Harita)
        let allArcPoints = [];
        for (let i = 0; i < pts.length - 1; i++) {
            const start = [pts[i].lng, pts[i].lat];
            const end = [pts[i + 1].lng, pts[i + 1].lat];
            
            // Yeni ortak fonksiyonu kullan
            const arcPoints = getCurvedArcCoords(start, end);
            
            // Leaflet [lat, lng] ister, dönüştür:
            const latLngs = arcPoints.map(pt => [pt[1], pt[0]]);
            
            const poly = L.polyline(latLngs, {
                color: "#1976d2",
                weight: 6,
                opacity: 0.93,
                dashArray: "6,8"
            }).addTo(expandedMap);
            
            bounds.extend(poly.getBounds());

            if (i === 0) allArcPoints.push([start[0], start[1]]);
            allArcPoints = allArcPoints.concat(arcPoints.slice(1));
        }
        if (pts.length > 0) {
            const lastPoint = [pts[pts.length - 1].lng, pts[pts.length - 1].lat];
            allArcPoints.push(lastPoint);
        }
        window._curvedArcPointsByDay[day] = allArcPoints;
    }

    // Markerları çiz ve sınır kutusuna dahil et (Garanti olsun diye)
    pts.forEach((item, idx) => {
        const markerHtml = `
            <div style="background:#d32f2f;color:#fff;border-radius:50%;
            width:24px;height:24px;display:flex;align-items:center;justify-content:center;
            font-weight:bold;font-size:15px;border:2px solid #fff;box-shadow:0 2px 8px #888;">
            ${idx + 1}
            </div>`;
        const icon = L.divIcon({
            html: markerHtml,
            className: "",
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });
        const marker = L.marker([item.lat, item.lng], { icon }).addTo(expandedMap)
            .bindPopup(`<b>${item.name || "Point"}</b>`);
            
        bounds.extend(marker.getLatLng());
    });

    if (Array.isArray(window.lastMissingPoints) && window.lastMissingPoints.length > 1) {
        const missingPoly = L.polyline(window.lastMissingPoints.map(p => [p.lat, p.lng]), {
            dashArray: '8, 12',
            color: '#d32f2f',
            weight: 4,
            opacity: 0.8,
            interactive: false,
            renderer: ensureCanvasRenderer(expandedMap)
        }).addTo(expandedMap);
        bounds.extend(missingPoly.getBounds());
    }

    // --- SON NOKTA: OLUŞTURULAN SINIR KUTUSUNA ODAKLA ---
    if (bounds.isValid()) {
        // Padding değeri (örneğin 50px) rotanın kenarlara yapışmasını engeller
        expandedMap.fitBounds(bounds, { padding: [50, 50] });
    } else {
        // Eğer bounds oluşmadıysa (tek nokta veya boş)
        if (pts.length === 1) {
            expandedMap.setView([pts[0].lat, pts[0].lng], 14, { animate: true });
        } else {
            expandedMap.setView([41.0, 12.0], 5, { animate: true });
        }
    }

    setTimeout(() => { try { expandedMap.invalidateSize(); } catch(e){} }, 200);

    addDraggableMarkersToExpandedMap(expandedMap, day);

    // Scale Bar & UI Güncellemeleri
    const sumKey = `route-map-day${day}`;
    let sum = window.lastRouteSummaries?.[sumKey];

    if (!sum && pts.length > 1 && !isInTurkey) {
        let totalKmSum = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            totalKmSum += haversine(pts[i].lat, pts[i].lng, pts[i+1].lat, pts[i+1].lng) / 1000;
        }
        sum = {
            distance: Math.round(totalKmSum * 1000),
            duration: Math.round(totalKmSum/4*60),
            ascent: 0,
            descent: 0
        };
    }
    
    if (sum && typeof updateDistanceDurationUI === 'function') {
        updateDistanceDurationUI(sum.distance, sum.duration);
    }

    const scaleBarDiv = document.getElementById(`expanded-route-scale-bar-day${day}`);
    if (scaleBarDiv) {
        const totalKm = sum ? sum.distance / 1000 : 0;
        let markerPositions = [];
        
        const hasRealRouteData = (sum && sum.distance > 0 && typeof getRouteMarkerPositionsOrdered === 'function');

        if (hasRealRouteData) {
            markerPositions = getRouteMarkerPositionsOrdered(day);
            if (!markerPositions || markerPositions.length === 0) markerPositions = [];
        } 
        else if (pts.length > 1 && !isInTurkey) {
            let currentDist = 0;
            for (let i = 0; i < pts.length; i++) {
                if (i > 0) {
                    currentDist += haversine(pts[i-1].lat, pts[i-1].lng, pts[i].lat, pts[i].lng) / 1000;
                }
                markerPositions.push({
                    name: pts[i].name || "",
                    distance: currentDist, 
                    lat: pts[i].lat,
                    lng: pts[i].lng
                });
            }
        } 

        scaleBarDiv.style.display = "block";
        scaleBarDiv.innerHTML = "";

        if (isInTurkey && totalKm <= 0.01) {
             scaleBarDiv.innerHTML = '<div class="spinner"></div>';
        } else {
             renderRouteScaleBar(scaleBarDiv, totalKm, markerPositions || []);
             const track = scaleBarDiv.querySelector('.scale-bar-track');
             if (track) {
                 const width = Math.max(200, Math.round(track.getBoundingClientRect().width));
                 // Loading sınıfı varsa bu çalışsa bile çizmez, güvenli.
                 createScaleElements(track, width, totalKm, 0, markerPositions || []);
             }
        }
    }

    setTimeout(() => {
        setupScaleBarInteraction(day, expandedMap);
    }, 500);

    adjustExpandedHeader(day);
}

// 2. renderRouteForDay Fonksiyonunu Güncelle (Türkiye içi fallback'i temizle)
async function renderRouteForDay(day) {
    console.log("[ROUTE DEBUG] --- renderRouteForDay ---");
    console.log("GÜN:", day);
    const pts = getDayPoints(day).filter(
        p => typeof p.lat === "number" && typeof p.lng === "number" && !isNaN(p.lat) && !isNaN(p.lng)
    );
    console.log("getDayPoints ile çekilen markerlar:", JSON.stringify(pts, null, 2));

    // ... (GPS Import logic buradaki gibi kalabilir, değiştirmiyoruz) ...
    if (window.importedTrackByDay && window.importedTrackByDay[day] && window.routeLockByDay && window.routeLockByDay[day]) {
        // ... (GPS Import kodu aynı kalıyor) ...
        // GPS bloğu bitişi
        return;
    }

    if (window.__suppressMiniUntilFirstPoint && window.__suppressMiniUntilFirstPoint[day]) {
        const pts0 = getDayPoints(day);
        if (!pts0 || pts0.length === 0) return;
    }

    const containerId = `route-map-day${day}`;
    const points = getDayPoints(day);

    if (window.importedTrackByDay && window.importedTrackByDay[day] && window.importedTrackByDay[day].drawRaw && points.length > 2) {
        window.importedTrackByDay[day].drawRaw = false;
    }

    if (!points || points.length === 0) {
        ensureDayMapContainer(day);
        initEmptyDayMap(day);
        if (typeof clearRouteCachesForDay === 'function') clearRouteCachesForDay(day);
        if (typeof clearRouteVisualsForDay === 'function') clearRouteVisualsForDay(day);
        if (typeof clearDistanceLabels === 'function') clearDistanceLabels(day);
        if (typeof updateRouteStatsUI === 'function') updateRouteStatsUI(day);
        return;
    }

    if (points.length === 1) {
        // Tek nokta işlemleri (değişiklik yok)
        if (typeof clearRouteCachesForDay === 'function') clearRouteCachesForDay(day);
        if (typeof clearRouteVisualsForDay === 'function') clearRouteVisualsForDay(day);
        ensureDayMapContainer(day);
        initEmptyDayMap(day);
        const map = window.leafletMaps?.[containerId];
        if (typeof updateRouteStatsUI === 'function') updateRouteStatsUI(day);
        if (typeof clearDistanceLabels === 'function') clearDistanceLabels(day);
        if (map) {
             map.eachLayer(l => {
                if (l instanceof L.Marker || l instanceof L.Polyline || l instanceof L.Circle || l instanceof L.CircleMarker) {
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
        return;
    }

    // ... (GPS Import Track Raw logic aynı kalıyor) ...

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
            // TÜRKİYE'DE: HAVERSINE İPTAL!
            // Rota verisi yoksa scale bar'ı ve özetleri temizle, uydurma çizgi çekme.
            window.lastRouteSummaries = window.lastRouteSummaries || {};
            window.lastRouteSummaries[containerId] = {}; // Boş bırak!
            
            // Geojson'u temizle veya sadece noktaları koy
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

            // renderLeafletRoute'a boş summary gönder, böylece düz çizgi yerine nokta gösterir
            renderLeafletRoute(containerId, window.lastRouteGeojsons[containerId], points, {}, day);
            if (typeof updateRouteStatsUI === 'function') updateRouteStatsUI(day);

            let expandedMapDiv = document.getElementById(`expanded-map-${day}`) || document.getElementById(`expanded-route-map-day${day}`);
            if (expandedMapDiv) {
                let expandedScaleBar = document.getElementById(`expanded-route-scale-bar-day${day}`);
                if (expandedScaleBar) {
                    expandedScaleBar.style.display = "block";
                    expandedScaleBar.innerHTML = '<div class="spinner"></div>'; // Loading veya boş
                    // renderRouteScaleBar'a 0 km ve BOŞ marker dizisi gönderiyoruz ki Haversine hesaplamasın
                    renderRouteScaleBar(expandedScaleBar, 0, []); 
                }
            }
            // Rota çekme işlemine devam et...
        } else {
            // YURTDIŞI/Fly Mode: Haversine kullanmaya devam et (değişiklik yok)
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
                duration: durationSec,
                ascent: 0, 
                descent: 0
            };
            
            // ... (Fly mode elevation estimation logic) ...
            
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

            let expandedMapDiv = document.getElementById(`expanded-map-${day}`) || document.getElementById(`expanded-route-map-day${day}`);
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
                renderRouteScaleBar(expandedScaleBar, totalKm, markerPositions);
            }
            return;
        }
    }

    // FETCH ROUTE (Değişiklik yok, sadece hata yakalama aynı)
    async function fetchRoute() {
        const coordParam = coordinates.map(c => `${c[0]},${c[1]}`).join(';');
        const url = buildDirectionsUrl(coordParam, day);
        const response = await fetch(url);
        if (!response.ok) {
            return null;
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
        routeData = await fetchRoute();
        if (!routeData) return;
        missingPoints = snappedPoints.filter(p => isPointReallyMissing(p, routeData.coords, 100));
    } catch (e) {
        const infoPanel = document.getElementById(`route-info-day${day}`);
        if (infoPanel) infoPanel.textContent = "Could not draw the route!";
        return;
    }
    
    // ... (Kalan standart render işlemleri) ...
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
    }

    renderLeafletRoute(containerId, routeData.geojson, snappedPoints, routeData.summary, day, missingPoints);

    const expandedMapObj = window.expandedMaps?.[containerId];
    if (expandedMapObj?.expandedMap) {
        updateExpandedMap(expandedMapObj.expandedMap, day);
    }

    // ... (Pairwise ve diğer stat güncellemeleri) ...
    const pairwiseSummaries = [];
    if (typeof routeData !== "undefined" && Array.isArray(routeData.legs)) {
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

    setTimeout(() => typeof updateRouteStatsUI === 'function' && updateRouteStatsUI(day), 200);
    if (typeof adjustExpandedHeader === 'function') adjustExpandedHeader(day);

    if (
        typeof window._lastSegmentDay === "number" &&
        typeof window._lastSegmentStartKm === "number" &&
        typeof window._lastSegmentEndKm === "number"
    ) {
        setTimeout(function () {
            highlightSegmentOnMap(
                window._lastSegmentDay,
                window._lastSegmentStartKm,
                window._lastSegmentEndKm
            );
        }, 150);
    }
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
// Yardımcı fonksiyon - Yay koordinatlarını al
// [lng, lat] formatında girdi alır, [lng, lat] dizisi döndürür
function getCurvedArcCoords(start, end) {
    const lon1 = start[0];
    const lat1 = start[1];
    const lon2 = end[0];
    const lat2 = end[1];

    const offsetX = lon2 - lon1;
    const offsetY = lat2 - lat1;
    
    const r = Math.sqrt(Math.pow(offsetX, 2) + Math.pow(offsetY, 2));
    const theta = Math.atan2(offsetY, offsetX);
    
    // --- DEĞİŞİKLİK BURADA: YAY EĞİMİNİ AZALT ---
    // Math.PI / 10 (18°) yerine Math.PI / 22 (~8°) yapıyoruz.
    // Sayı büyüdükçe (bölünen) yay düzleşir.
    const thetaOffset = (Math.PI / 22); 
    // --------------------------------------------
    
    const r2 = (r / 2.0) / Math.cos(thetaOffset);
    const theta2 = theta + thetaOffset;
    
    const controlX = (r2 * Math.cos(theta2)) + lon1;
    const controlY = (r2 * Math.sin(theta2)) + lat1;
    
    const coords = [];
    // Adım sayısını biraz azalttık (daha düz olduğu için çok noktaya gerek yok)
    for (let t = 0; t < 1.01; t += 0.05) {
        const x = (1 - t) * (1 - t) * lon1 + 2 * (1 - t) * t * controlX + t * t * lon2;
        const y = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * controlY + t * t * lat2;
        coords.push([x, y]); 
    }
    return coords;
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

function createLeafletMapForItem(mapId, lat, lon, name, number, day) {
    window._leafletMaps = window._leafletMaps || {};
    if (window._leafletMaps[mapId]) {
        try { window._leafletMaps[mapId].remove(); } catch(e){}
        delete window._leafletMaps[mapId];
    }
    const el = document.getElementById(mapId);
    if (!el) return;
    var map = L.map(mapId, {
        center: [lat, lon],
        zoom: 16,
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: false
    });

    // --- OpenFreeMap/MaplibreGL kodları YORUMDA ---
    /*
    // OPENFREEMAP Vektör Layer Ekle (MapLibreGL Leaflet binding kullanılır)
    fetch('https://tiles.openfreemap.org/styles/bright')
      .then(res => res.json())
      .then(style => {
        Object.keys(style.sources).forEach(src => {
          if (style.sources[src].url)
            style.sources[src].url = window.location.origin + '/api/tile/{z}/{x}/{y}.pbf'; // DİKKAT: aynen bırak, encode etme!
        });
        L.maplibreGL({ style }).addTo(map);
        console.log('[PROXY PATCH] Style sources tile URL proxyye yönlendi:', style.sources);
      });
    */

    // --- SADECE OSM TILE ---
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // ARTIK day VAR!
    if (typeof getDayPoints === "function" && typeof day !== "undefined") {
        const pts = getDayPoints(day).filter(
  p => typeof p.lat === "number" && typeof p.lng === "number" && !isNaN(p.lat) && !isNaN(p.lng)
);
        if (pts.length === 1) {
            map.setView([pts[0].lat, pts[0].lng], 14);
        }
    }

    // Marker
    const icon = L.divIcon({
        html: getPurpleRestaurantMarkerHtml(),
        className: "",
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });
    L.marker([lat, lon], { icon }).addTo(map).bindPopup(name || '').openPopup();

    map.zoomControl.setPosition('topright');
    window._leafletMaps[mapId] = map;
    setTimeout(function() { map.invalidateSize(); }, 120);
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

function toggleContent(arrowIcon) {
    const cartItem = arrowIcon.closest('.cart-item');
    if (!cartItem) return;
    const contentDiv = cartItem.querySelector('.content');
    if (!contentDiv) return;
    contentDiv.classList.toggle('open');
    if (contentDiv.classList.contains('open')) {
        contentDiv.style.display = 'block';
    } else {
        contentDiv.style.display = 'none';
    }

    // EK: Leaflet haritayı başlat
    const item = cartItem.closest('.travel-item');
    if (!item) return;
    const mapDiv = item.querySelector('.leaflet-map');
    if (mapDiv && mapDiv.offsetParent !== null) {
        const mapId = mapDiv.id;
        const lat = parseFloat(item.getAttribute('data-lat'));
        const lon = parseFloat(item.getAttribute('data-lon'));
        const name = item.querySelector('.toggle-title').textContent;
        const number = item.dataset.index ? (parseInt(item.dataset.index, 10) + 1) : 1;
        createLeafletMapForItem(mapId, lat, lon, name, number);
    }
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
    // Tüm mevcut günleri bul:
    let maxDay = 1;
    if (Array.isArray(window.cart) && window.cart.length > 0) {
        window.cart.forEach(item => {
            if (typeof item.day === "number" && item.day > maxDay) {
                maxDay = item.day;
            }
        });
    }
    // Her zaman yeni gün objesi ekle:
    const newDay = maxDay + 1;
window.cart = [...window.cart, { day: newDay }];
    window.currentDay = newDay;
    updateCart();
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

    // Bu satırı EKLE!
    points = points.filter(item => isFinite(item.lat) && isFinite(item.lng));

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
            ">${idx + 1}</div>`;
        const icon = L.divIcon({
            html: markerHtml,
            className: "",
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });
        L.marker([item.lat, item.lng], { icon }).addTo(map)
            .bindPopup(`<b>${label}</b>`);
    });
}


async function renderLeafletRoute(containerId, geojson, points = [], summary = null, day = 1, missingPoints = []) {
    const sidebarContainer = document.getElementById(containerId);
    if (!sidebarContainer) return;

    if (window.leafletMaps && window.leafletMaps[containerId]) {
        window.leafletMaps[containerId].remove();
        delete window.leafletMaps[containerId];
    }

    sidebarContainer.innerHTML = "";
    sidebarContainer.style.height = "285px";
    sidebarContainer.classList.remove("big-map", "full-screen-map");

    // Route summary and controls
    const controlsWrapperId = `map-bottom-controls-wrapper-day${day}`;
    document.getElementById(controlsWrapperId)?.remove();

    const controlsWrapper = document.createElement("div");
    controlsWrapper.id = controlsWrapperId;

    const controlRowId = `map-bottom-controls-day${day}`;
    const controlRow = document.createElement("div");
    controlRow.id = controlRowId;
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

    // Travel mode set
    ensureDayTravelModeSet(day, sidebarContainer, controlsWrapper);

    let routeCoords = [];
    let hasValidGeo = (
        geojson && geojson.features && geojson.features[0] &&
        geojson.features[0].geometry &&
        Array.isArray(geojson.features[0].geometry.coordinates) &&
        geojson.features[0].geometry.coordinates.length > 1
    );
    if (hasValidGeo) {
        routeCoords = geojson.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
    }

    // Haritayı oluştur
    const map = L.map(containerId, { 
        scrollWheelZoom: true,
        fadeAnimation: false,
        zoomAnimation: false,
        preferCanvas: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // --- DEĞİŞİKLİK BAŞLANGICI: Sınır Kutusu Oluştur ---
    let bounds = L.latLngBounds();
    // --------------------------------------------------

    // Tek marker durumu
    points = points.filter(p => isFinite(p.lat) && isFinite(p.lng));
    if (points.length === 1) {
        L.marker([points[0].lat, points[0].lng], {
            icon: L.divIcon({
                html: `<div style="background:#d32f2f;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;border:2px solid #fff;box-shadow: 0 2px 8px rgba(0,0,0,0.2);">1</div>`,
                className: "",
                iconSize: [32,32],
                iconAnchor: [16,16]
            })
        }).addTo(map).bindPopup(points[0].name || points[0].category || "Point");
        map.setView([points[0].lat, points[0].lng], 14, { animate: true });
    } 
    else if (points.length >= 1) {
        const isFlyMode = !areAllPointsInTurkey(points);

        // FLY MODE ise yaylı çizgi
       if (isFlyMode) {
            window._curvedArcPointsByDay = window._curvedArcPointsByDay || {};
            let arcPoints = [];
            for (let i = 0; i < points.length - 1; i++) {
                const start = [points[i].lng, points[i].lat];
                const end = [points[i + 1].lng, points[i + 1].lat];
                
                // Aynı matematik fonksiyonu çağır
                const curveCoords = getCurvedArcCoords(start, end);
                arcPoints = arcPoints.concat(curveCoords);

                // Leaflet için [lat, lng] çevirip çiz
                const latLngs = curveCoords.map(c => [c[1], c[0]]);
                
                const curvePoly = L.polyline(latLngs, {
                    color: "#1976d2",
                    weight: 5,
                    opacity: 0.85,
                    dashArray: "6,8"
                }).addTo(map);
                
                bounds.extend(curvePoly.getBounds());
            }
            window._curvedArcPointsByDay[day] = arcPoints;
        }
        else if (hasValidGeo && routeCoords.length > 1) {
            // GERÇEK ROTA
            const routePoly = L.polyline(routeCoords, {
                color: '#1976d2',
                weight: 8,
                opacity: 0.92,
                interactive: true,
                dashArray: null
            }).addTo(map);
            
            // --- KRİTİK: Rota sınırlarını ekle ---
            bounds.extend(routePoly.getBounds());
        }

        // Eksik noktalar/sapmış markerlar için kırmızı kesikli snap çizgileri
        if (hasValidGeo) {
            const rawGeojsonCoords = geojson.features[0].geometry.coordinates; 
            const routePtsForSnap = routeCoords; 
            
            points.forEach((mp) => { 
                if (typeof isPointReallyMissing === 'function' && typeof haversine === 'function' && isPointReallyMissing(mp, rawGeojsonCoords, 50)) {
                    let minIdx = 0, minDist = Infinity;
                    for (let i = 0; i < routePtsForSnap.length; i++) {
                        const [lat, lng] = routePtsForSnap[i];
                        const d = haversine(lat, lng, mp.lat, mp.lng);
                        if (d < minDist) {
                            minDist = d;
                            minIdx = i;
                        }
                    }
                    const start = [mp.lat, mp.lng]; 
                    const end = routePtsForSnap[minIdx]; 
                    
                    const snapPoly = L.polyline([start, end], {
                        dashArray: '8, 12',
                        color: '#d32f2f', 
                        weight: 2, 
                        opacity: 0.8,
                        interactive: false,
                        renderer: ensureCanvasRenderer(map)
                    }).addTo(map); 
                    
                    // Snap çizgilerini de kapsasın
                    bounds.extend(snapPoly.getBounds());
                }
            });
        }

        addNumberedMarkers(map, points);

        // Markerları da sınırlara ekle (Garanti olsun)
        points.forEach(p => bounds.extend([p.lat, p.lng]));

        if (geojson && geojson.features[0]?.properties?.names) {
            addGeziPlanMarkers(map, geojson.features[0].properties.names, day);
        }

        // --- SONUÇ: Rota ve markerları kapsayan alana odakla ---
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [20, 20] });
        } else {
            // Eğer bounds oluşmadıysa sadece markerlara
            map.fitBounds(points.map(p => [p.lat, p.lng]), { padding: [20, 20] });
        }

    } else {
        // Hiç marker yoksa
        map.setView([0, 0], 2, { animate: true });
    }

    map.zoomControl.setPosition('topright');
    window.leafletMaps[containerId] = map;
}

// Harita durumlarını yönetmek için global değişken
window.mapStates = {};

// Harita durumlarını yönetmek için global değişken
window.expandedMaps = {};
// Güncellenmiş expandMap fonksiyonu: YÜKSEKLİK/ELEVATION ile ilgili her şey kaldırıldı!


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

// Yardımcı fonksiyon - Yay koordinatlarını al
function getCurvedArcCoords(start, end, strength = 0.33, segments = 22) {
    // start & end: [lng, lat] formatında
    const sx = start[0], sy = start[1];
    const ex = end[0], ey = end[1];
    
    const mx = (sx + ex) / 2 + strength * (ey - sy);
    const my = (sy + ey) / 2 - strength * (ex - sx);
    
    const coords = [];
    for (let t = 0; t <= 1; t += 1/segments) {
        const x = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * mx + t * t * ex;
        const y = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * my + t * t * ey;
        coords.push([x, y]);
    }
    return coords;
}

function setupScaleBarInteraction(day, map) {
    const scaleBar = document.getElementById(`expanded-route-scale-bar-day${day}`);
    if (!scaleBar || !map) return;

    // --- TEMİZLİK ---
    if (scaleBar._onMoveHandler) {
        scaleBar.removeEventListener("mousemove", scaleBar._onMoveHandler);
        scaleBar.removeEventListener("touchmove", scaleBar._onMoveHandler);
    }
    if (scaleBar._onLeaveHandler) {
        scaleBar.removeEventListener("mouseleave", scaleBar._onLeaveHandler);
        scaleBar.removeEventListener("touchend", scaleBar._onLeaveHandler);
    }

    window._hoverMarkersByDay = window._hoverMarkersByDay || {};
    if (window._hoverMarkersByDay[day]) {
        map.removeLayer(window._hoverMarkersByDay[day]);
        window._hoverMarkersByDay[day] = null;
    }

    // --- CACHE ---
    let cachedDay = null;
    let cachedCumDist = []; 
    let cachedTotalDist = 0;

    function haversine(lat1, lon1, lat2, lon2) {
        const R = 6371000; 
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2)**2;
        return 2 * R * Math.asin(Math.sqrt(a));
    }

    function prepareDistanceCache() {
        if (cachedDay === day && cachedCumDist.length > 0) return;

        const arcPts = window._curvedArcPointsByDay ? window._curvedArcPointsByDay[day] : [];
        if (!Array.isArray(arcPts) || arcPts.length < 2) return;

        cachedCumDist = [0];
        cachedTotalDist = 0;

        for (let i = 1; i < arcPts.length; i++) {
            const [lon1, lat1] = arcPts[i-1];
            const [lon2, lat2] = arcPts[i];
            const d = haversine(lat1, lon1, lat2, lon2);
            cachedTotalDist += d;
            cachedCumDist.push(cachedTotalDist);
        }
        cachedDay = day;
    }

    const onMove = function(e) {
        const arcPts = window._curvedArcPointsByDay ? window._curvedArcPointsByDay[day] : [];
        if (!Array.isArray(arcPts) || arcPts.length === 0) return;

        prepareDistanceCache();
        if (cachedTotalDist === 0) return;

        const rect = scaleBar.getBoundingClientRect();
        let clientX = (e.touches && e.touches.length) ? e.touches[0].clientX : e.clientX;
        let x = clientX - rect.left;
        
        // Mouse'un bar üzerindeki yüzdesi (0.0 - 1.0)
        let percent = Math.max(0, Math.min(x / rect.width, 1));
        
        let targetMeters = 0;

        // --- KRİTİK DÜZELTME: SEGMENT HESABI ---
        // Eğer şu an bir segment seçiliyse (Zoom yapılmışsa)
        if (
            typeof window._lastSegmentStartKm === 'number' && 
            typeof window._lastSegmentEndKm === 'number' &&
            window._lastSegmentDay === day // Sadece o gün için
        ) {
            // Segmentin başlangıcı (Metre)
            const startM = window._lastSegmentStartKm * 1000;
            // Segmentin uzunluğu (Metre)
            const spanM = (window._lastSegmentEndKm - window._lastSegmentStartKm) * 1000;
            
            // Hedef = Başlangıç + (Yüzde * Uzunluk)
            targetMeters = startM + (percent * spanM);
        } else {
            // Segment yoksa tüm yol
            targetMeters = percent * cachedTotalDist;
        }
        // ---------------------------------------

        // Güvenlik: Hedef mesafe toplamı aşamaz
        targetMeters = Math.max(0, Math.min(targetMeters, cachedTotalDist));

        // Bu mesafeye denk gelen koordinatı bul
        let foundIndex = 0;
        // Basit lineer arama (Array küçük olduğu için hızlıdır)
        for (let i = 0; i < cachedCumDist.length; i++) {
            if (cachedCumDist[i] >= targetMeters) {
                foundIndex = i;
                break;
            }
        }

        let lat, lng;
        if (foundIndex === 0) {
            [lng, lat] = arcPts[0];
        } else {
            const idx1 = foundIndex - 1;
            const idx2 = foundIndex;
            const dist1 = cachedCumDist[idx1];
            const dist2 = cachedCumDist[idx2];
            const segmentLen = dist2 - dist1;
            
            let ratio = 0;
            if (segmentLen > 0) {
                ratio = (targetMeters - dist1) / segmentLen;
            }
            const [lon1, lat1] = arcPts[idx1];
            const [lon2, lat2] = arcPts[idx2];
            
            lat = lat1 + (lat2 - lat1) * ratio;
            lng = lon1 + (lon2 - lon1) * ratio;
        }

        let marker = window._hoverMarkersByDay[day];
        if (marker) {
            marker.setLatLng([lat, lng]);
            marker.bringToFront();
        } else {
            marker = L.circleMarker([lat, lng], {
                radius: 8,
                color: "#fff",
                fillColor: "#8a4af3",
                fillOpacity: 1,
                weight: 2,
                zIndexOffset: 10000,
                interactive: false
            }).addTo(map);
            window._hoverMarkersByDay[day] = marker; 
        }
    };
    
    const onLeave = function() {
        let marker = window._hoverMarkersByDay[day];
        if (marker) {
            map.removeLayer(marker);
            window._hoverMarkersByDay[day] = null;
        }
    };

    scaleBar._onMoveHandler = onMove;
    scaleBar._onLeaveHandler = onLeave;

    scaleBar.addEventListener("mousemove", onMove);
    scaleBar.addEventListener("mouseleave", onLeave);
    scaleBar.addEventListener("touchmove", onMove);
    scaleBar.addEventListener("touchend", onLeave);
}

function getCurvedArcCoords(start, end, strength = 0.5, segments = 30) {
    // start & end: [lng, lat] formatında olmalı
    const sx = start[0], sy = start[1];
    const ex = end[0], ey = end[1];
    
    // Orta nokta ve kontrol noktası
    const midX = (sx + ex) / 2;
    const midY = (sy + ey) / 2;
    
    // Kontrol noktası - yönü değiştirmek için işaretleri ayarlayın
    const controlX = midX + strength * (ey - sy);
    const controlY = midY - strength * (ex - sx);
    
    const coords = [];
    for (let t = 0; t <= 1; t += 1/segments) {
        // Quadratic Bezier formülü
        const x = Math.pow(1 - t, 2) * sx + 2 * (1 - t) * t * controlX + Math.pow(t, 2) * ex;
        const y = Math.pow(1 - t, 2) * sy + 2 * (1 - t) * t * controlY + Math.pow(t, 2) * ey;
        coords.push([x, y]);
    }
    
    // Son noktayı ekle
    coords.push([ex, ey]);
    
    return coords;
}
// Yay noktalarını kaydetmek için yardımcı fonksiyon
function saveArcPointsForDay(day, points) {
    if (!window._curvedArcPointsByDay) {
        window._curvedArcPointsByDay = {};
    }
    window._curvedArcPointsByDay[day] = points;
}


function openMapLibre3D(expandedMap) {
  // Kesinlikle maplibre-3d-view id'li div varlığını garanti et
  let mapDiv = expandedMap.getContainer();
  let maplibre3d = document.getElementById('maplibre-3d-view');
  if (!maplibre3d) {
    maplibre3d = document.createElement('div');
    maplibre3d.id = 'maplibre-3d-view';
    maplibre3d.style.cssText = 'width:100%;height:480px;position:absolute;left:0;top:0;z-index:10000;';
    mapDiv.parentNode.appendChild(maplibre3d);
  }
  maplibre3d.style.display = 'block'; // 3D harita görünür!
  maplibre3d.innerHTML = '';

  // MapLibreGL başlat
  window._maplibre3DInstance = new maplibregl.Map({
    container: 'maplibre-3d-view',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: expandedMap.getCenter(),
    zoom: expandedMap.getZoom(),
    pitch: 60,
    bearing: 30,
    interactive: true // zaten vardır
  });

  window._maplibre3DInstance.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-left');
  // Sağa döndür
  window._maplibre3DInstance.rotateTo(window._maplibre3DInstance.getBearing() + 20, { animate: true });
  // Sola döndür
  window._maplibre3DInstance.rotateTo(window._maplibre3DInstance.getBearing() - 20, { animate: true });

  // ROTAYI GERÇEK YOL (OSRM POLYLINE) veya FLY MODE'da marker arası YAY ile çiz!
  window._maplibre3DInstance.on('load', function () {
    const day = window.currentDay || 1;
    const containerId = `route-map-day${day}`;
    // Yol geometri verisi alınır (Leaflet'te olduğu gibi!)
    const geojson = window.lastRouteGeojsons && window.lastRouteGeojsons[containerId];
    const routeCoords = geojson?.features?.[0]?.geometry?.coordinates;
    const points = typeof getDayPoints === 'function' ? getDayPoints(day) : [];
    const isFlyMode = !areAllPointsInTurkey(points); // Türkiye dışında mı?

    if (!isFlyMode && routeCoords && routeCoords.length >= 2) {
      window._maplibre3DInstance.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: routeCoords // OSRM rotası (Türkiye içi)
          }
        }
      });
      window._maplibre3DInstance.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#1976d2',    // BİREBİR MAVİ
          'line-width': 8,            // Leaflet polyline ile aynı
          'line-opacity': 0.92        // Aynı şeffaflık!
        }
      });
    } 

    else

     if (isFlyMode && points.length > 1) {
  for (let i = 0; i < points.length - 1; i++) {
    const start = [points[i].lng, points[i].lat];
    const end = [points[i + 1].lng, points[i + 1].lat];
    // Kavis güç ve segment ayarıyla pürüzsüz (0.33/22 önerilir)
    const curveCoords = getCurvedArcCoords(start, end, 0.33, 22);

    // GeoJSON source ekle
    window._maplibre3DInstance.addSource(`flyroute-${i}`, {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: curveCoords }
      }
    });

    // LineLayer ile çiz - dash, renk, opacity ile görsel efekt!
    window._maplibre3DInstance.addLayer({
      id: `flyroute-line-${i}`,
      type: 'line',
      source: `flyroute-${i}`,
      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      },
      paint: {
        'line-color': '#1976d2',         // Mavi
        'line-width': 13,                // Kalınlık
        'line-opacity': 0.96,            // Opaklık
        'line-dasharray': [1, 2]         // Kesikli çizgi efekti
      }
    });
  }
}


    // Markerları ekle (sıra numaralı)
    points.forEach((p, idx) => {
      const marker = new maplibregl.Marker({ color: '#d32f2f' })
        .setLngLat([p.lng, p.lat])
        .setPopup(new maplibregl.Popup().setText(`${idx + 1}. ${p.name || "Place"}`));
      marker.addTo(window._maplibre3DInstance);
    });
  });
}

async function expandMap(containerId, day) {
  // En başa ekle!
  forceCleanExpandedMap(day);

  window.currentDay = day; 

  console.log('[expandMap] start →', containerId, 'day=', day);

  if (window.expandedMaps && window.expandedMaps[containerId]) {
    console.log('[expandMap] already expanded, returning');
    return;
  }

  // Diğer günlerin expanded'ını kapat
  if (window.expandedMaps) {
    Object.keys(window.expandedMaps).forEach(otherId => {
      if (otherId !== containerId) {
        const ex = window.expandedMaps[otherId];
        if (ex) restoreMap(otherId, ex.day);
      }
    });
  }

  const originalContainer = document.getElementById(containerId);
  const map = window.leafletMaps ? window.leafletMaps[containerId] : null;

  // --- DEĞİŞİKLİK BURADA: Butonu bul ve PASİF yap ---
  const controlsBar = document.getElementById(`route-controls-bar-day${day}`);
  // Hem bar içindeki hem de travel-mode set içindeki butonu yakalamaya çalışalım
  const expandBtns = [];
  if (controlsBar) {
      const btn = controlsBar.querySelector('.expand-map-btn');
      if (btn) expandBtns.push(btn);
  }
  const tmSet = document.getElementById(`tt-travel-mode-set-day${day}`);
  if (tmSet) {
      const btn = tmSet.querySelector('.expand-map-btn');
      if (btn) expandBtns.push(btn);
  }

  expandBtns.forEach(btn => {
      // Butonu pasifleştir
      btn.disabled = true;
      btn.style.pointerEvents = 'none'; // Tıklamayı engelle
      btn.style.opacity = '0.6';
      btn.style.cursor = 'default';
      btn.style.borderColor = '#ccc';
      btn.style.background = '#f9f9f9';
      
      // İkonu gri yap
      const img = btn.querySelector('img');
      if (img) img.style.filter = 'grayscale(100%)';

      // Metni değiştir
      const label = btn.querySelector('.tm-label');
      if (label) {
          label.textContent = 'Map Expanded';
          label.style.color = '#888';
      }
  });
  // ------------------------------------------------

  if (!originalContainer) {
    console.error('[expandMap] original small map container yok. İptal.');
    return;
  }
  if (!map) {
    console.warn('[expandMap] Leaflet instance yok. Yeniden initEmptyDayMap çağrılıyor…');
    initEmptyDayMap(day);
  }

  originalContainer.style.display = 'none';

  // === HEADER DIV OLUŞTUR ===
  const headerDiv = document.createElement('div');
  headerDiv.className = 'expanded-map-header';

  const layersBar = document.createElement('div');
  layersBar.className = 'map-layers-row'; 

  const layerOptions = [
    { value: 'bright', img: '/img/preview_bright.png', label: 'Bright' },
    { value: 'positron', img: '/img/preview_positron.png', label: 'Positron' },
    { value: '3d', img: '/img/preview_3d.png', label: '3D' }
  ];

  let currentLayer = 'bright';

  layerOptions.forEach(opt => {
    const div = document.createElement('div');
    div.className = 'map-type-option';
    div.setAttribute('data-value', opt.value);
    div.innerHTML = `<img src="${opt.img}" alt="${opt.label}"><span>${opt.label}</span>`;
    if (opt.value === currentLayer) div.classList.add('selected');

    div.onclick = function() {
      layersBar.querySelectorAll('.map-type-option').forEach(o => o.classList.remove('selected'));
      div.classList.add('selected');
      if (opt.value === '3d') {
        expandedMap.getContainer().style.display = "none";
        let map3d = document.getElementById('maplibre-3d-view');
        if (map3d) {
          map3d.style.display = "block";
        } else {
          openMapLibre3D(expandedMap); 
        }
      } else {
        expandedMap.getContainer().style.display = "";
        let map3d = document.getElementById('maplibre-3d-view');
        if (map3d) {
          map3d.style.display = "none";
        }
        setExpandedMapTile(opt.value);
      }
    };
    layersBar.appendChild(div);
  });

  headerDiv.appendChild(layersBar);

  const statsDiv = document.createElement('div');
  statsDiv.className = 'route-stats';
  headerDiv.appendChild(statsDiv);

  // --- EXPANDED MAP CONTAINER ---
  const expandedMapId = `expanded-map-${day}`;
  const expandedContainer = document.createElement('div');
  expandedContainer.id = expandedMapId;
  expandedContainer.className = 'expanded-map-container';

  expandedContainer.appendChild(headerDiv);

  const oldBar = document.getElementById(`expanded-route-scale-bar-day${day}`);
  if (oldBar) oldBar.remove();
  const scaleBarDiv = document.createElement('div');
  scaleBarDiv.className = 'route-scale-bar';
  scaleBarDiv.id = `expanded-route-scale-bar-day${day}`;
  scaleBarDiv.style.display = "block";

  const panelDiv = document.createElement('div');
  panelDiv.className = 'expanded-map-panel';
  panelDiv.appendChild(scaleBarDiv);
  expandedContainer.appendChild(panelDiv);

  const locBtn = document.createElement('button');
  locBtn.type = 'button';
  locBtn.id = `use-my-location-btn-day${day}`;
  locBtn.classList.add('use-my-location-btn');
  locBtn.innerHTML = '<img src="https://www.svgrepo.com/show/522166/location.svg" alt="Locate" class="category-icon">';
  expandedContainer.appendChild(locBtn);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-expanded-map';
  closeBtn.textContent = '✕ Close';
  closeBtn.style.cssText = `
    position:absolute;top:16px;right:16px;z-index:10001;
    background:#ff4444;color:#fff;border:none;padding:8px 12px;
    border-radius:4px;font-weight:500;cursor:pointer;
  `;
  closeBtn.onclick = () => restoreMap(containerId, day);
  expandedContainer.appendChild(closeBtn);

  const mapDivId = `${containerId}-expanded`;
  const mapDiv = document.createElement('div');
  mapDiv.id = mapDivId;
  mapDiv.className = 'expanded-map';
  expandedContainer.appendChild(mapDiv);
  document.body.appendChild(expandedContainer);
 
  mapDiv.style.width = "100%";
  mapDiv.style.height = "480px"; 

  showRouteInfoBanner(day);

  const baseMap = window.leafletMaps ? window.leafletMaps[containerId] : null;

  const expandedMapInstance = L.map(mapDivId, {
    center: [0, 0],
    zoom: 2,         
    scrollWheelZoom: true,
    fadeAnimation: true,
    zoomAnimation: true,
    zoomAnimationThreshold: 8,
    zoomSnap: 0.25,
    zoomDelta: 0.25,
    wheelDebounceTime: 35,
    wheelPxPerZoomLevel: 120,
    inertia: true,
    easeLinearity: 0.2
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(expandedMapInstance);

  const pts = typeof getDayPoints === 'function' ? getDayPoints(day) : [];
  if (!pts || pts.length === 0) {
      expandedMapInstance.setView([41.0, 12.0], 5); 
  }

  updateExpandedMap(expandedMapInstance, day);

  try {
    expandedMapInstance.dragging.enable?.();
    expandedMapInstance.scrollWheelZoom.enable?.();
    expandedMapInstance.options.minZoom = 1;
    expandedMapInstance.options.maxZoom = 19;
  } catch(e){}

  function setExpandedMapTile(styleKey) {
      if (expandedMapInstance._osmTileLayer) {
          expandedMapInstance.removeLayer(expandedMapInstance._osmTileLayer);
          expandedMapInstance._osmTileLayer = null;
      }
      expandedMapInstance._osmTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors'
      }).addTo(expandedMapInstance);
  }

  setExpandedMapTile(currentLayer);

  expandedMapInstance.on('styleimagemissing', function(e) {
    try { expandedMapInstance.addImage(e.id, new window.Image()); } catch (_) {}
  });

  if (!expandedMapInstance._initialView) {
    expandedMapInstance._initialView = {
      center: expandedMapInstance.getCenter(),
      zoom: expandedMapInstance.getZoom()
    };
  }

  const geojson = window.lastRouteGeojsons?.[containerId];

  if (baseMap) {
    Object.values(baseMap._layers).forEach(layer => {
      if (layer instanceof L.Marker) {
        const mk = L.marker(layer.getLatLng(), { icon: layer.options.icon }).addTo(expandedMapInstance);
        if (layer._popup) mk.bindPopup(layer._popup._content);
      }
    });
  }

  setTimeout(() => expandedMapInstance.invalidateSize({ pan: false }), 400);

  const summary = window.lastRouteSummaries?.[containerId];
  statsDiv.innerHTML = '';

  window.expandedMaps = window.expandedMaps || {};
  window.expandedMaps[containerId] = {
    originalContainer,
    day,
    originalMap: baseMap,
    expandedMap: expandedMapInstance
  };

  const totalKm = summary ? summary.distance / 1000 : 0;
  const markerPositions = getRouteMarkerPositionsOrdered
    ? getRouteMarkerPositionsOrdered(day)
    : [];

  if (typeof renderRouteScaleBar === 'function') {
      scaleBarDiv.style.display = "block";
      scaleBarDiv.innerHTML = "";
      renderRouteScaleBar(scaleBarDiv, totalKm, markerPositions);
      const track = scaleBarDiv.querySelector('.scale-bar-track');
      const svg = track && track.querySelector('svg.tt-elev-svg');
      if (track && svg) {
          const width = Math.max(200, Math.round(track.getBoundingClientRect().width));
          createScaleElements(track, width, totalKm, 0, markerPositions);
      }
  }

  if (typeof addDraggableMarkersToExpandedMap === 'function') {
    addDraggableMarkersToExpandedMap(expandedMapInstance, day);
  }
  if (typeof setupScaleBarInteraction === 'function') {
    setupScaleBarInteraction(day, expandedMapInstance);
  }
  if (typeof attachClickNearbySearch === 'function') {
    attachClickNearbySearch(expandedMapInstance, day);
  }
  if (typeof adjustExpandedHeader === 'function') {
    adjustExpandedHeader(day);
  }

  window.isLocationActiveByDay = window.isLocationActiveByDay || {};
  window.userLocationMarkersByDay = window.userLocationMarkersByDay || {};

  locBtn.addEventListener('click', () => {
    if (!window.isLocationActiveByDay[day]) {
      window.isLocationActiveByDay[day] = true;
      locBtn.innerHTML = '<img src="https://www.svgrepo.com/show/522167/location.svg" alt="On" class="category-icon">';
      if (typeof getMyLocation === 'function') {
        getMyLocation(day, expandedMapInstance);
      }
      setTimeout(() => {
        const arr = window.userLocationMarkersByDay?.[day];
        if (arr && arr.length) {
          const last = arr[arr.length - 1];
          if (last?.getLatLng) expandedMapInstance.flyTo(last.getLatLng(), Math.max(expandedMapInstance.getZoom(), 15), { duration: 0.5, easeLinearity: 0.2 });
        }
      }, 300);
    } else {
      const arr = window.userLocationMarkersByDay?.[day] || [];
      arr.forEach(m => { try { expandedMapInstance.removeLayer(m); } catch (_){ }});
      window.userLocationMarkersByDay[day] = [];
      window.isLocationActiveByDay[day] = false;
      locBtn.innerHTML = '<img src="https://www.svgrepo.com/show/522166/location.svg" alt="Locate" class="category-icon">';
    }
  });

  if (
    window.importedTrackByDay &&
    window.importedTrackByDay[day] &&
    window.importedTrackByDay[day].drawRaw &&
    window.importedTrackByDay[day].rawPoints &&
    window.importedTrackByDay[day].rawPoints.length > 1
  ) {
    ensureExpandedScaleBar(day, window.importedTrackByDay[day].rawPoints);
  }
}

function restoreMap(containerId, day) {
    const expandedData = window.expandedMaps?.[containerId];
    if (!expandedData) return;

    const { originalContainer, originalMap, expandedMap, expandButton } = expandedData;

    try {
        if (expandedMap && expandedMap.remove) {
            expandedMap.remove();
        }

        const expandedContainer = document.getElementById(`expanded-map-${day}`);
        if (expandedContainer) {
            expandedContainer.remove();
        }

        const expandedScaleBar = document.getElementById(`expanded-route-scale-bar-day${day}`);
        if (expandedScaleBar && expandedScaleBar.parentNode) {
            expandedScaleBar.parentNode.removeChild(expandedScaleBar);
        }

        const originalScaleBar = document.getElementById(`route-scale-bar-day${day}`);
        if (originalScaleBar) {
            originalScaleBar.style.display = "none";
        }

        if (originalContainer) {
            originalContainer.style.display = '';
        }

        // Restore expand button in travel mode set
        const travelModeSet = document.getElementById(`tt-travel-mode-set-day${day}`);
        const expandBtn = travelModeSet?.querySelector('.expand-map-btn');
        if (expandBtn) {
            expandBtn.style.visibility = 'visible';
        }

        document.querySelectorAll('.day-container').forEach(dc => {
            const smallMap = dc.querySelector('.route-map');
            const otherDay = parseInt(dc.dataset.day, 10);
            const controls = document.getElementById(`map-bottom-controls-wrapper-day${otherDay}`);
            if (smallMap && !smallMap.classList.contains('collapsed')) {
                 smallMap.style.display = '';
            }
            if (controls && !controls.classList.contains('collapsed')) {
                controls.style.display = '';
            }
        });

        // --- EKLENDİ: Küçük haritadaki markerlar/focus düzelt ---
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


        // --- YENİ EKLE ---
        if (typeof renderRouteForDay === "function") {
            setTimeout(() => { renderRouteForDay(day); }, 160);
        }


        }

    } catch (e) {
        console.error('Error while closing the map:', e);
    } finally {
        delete window.expandedMaps[containerId];
    }
    // Segment seçim & event cleanup:
    window._lastSegmentDay = undefined;
    window._lastSegmentStartKm = undefined;
    window._lastSegmentEndKm = undefined;
    window.__scaleBarDrag = null;
    window.__scaleBarDragTrack = null;
    window.__scaleBarDragSelDiv = null;
    window.removeEventListener('mousemove', window.__sb_onMouseMove);
    window.removeEventListener('mouseup', window.__sb_onMouseUp);
}
/* ==== NEW: Click-based nearby search (replaces long-press) ==== */
function attachClickNearbySearch(map, day, options = {}) {
  const radius = options.radius || 500; // metres

  if (map.__ttLongPressCleanup) {
    try { map.__ttLongPressCleanup(); } catch(_){}
    map.__ttLongPressCleanup = null;
  }

  if (map.__ttNearbyClickBound) return;
  map.__ttNearbyClickBound = true;

  let __nearbySingleTimer = null;
  const __nearbySingleDelay = (options && options.singleDelay) || 300; // ms

  map.on('click', function(e) {
    if (__nearbySingleTimer) clearTimeout(__nearbySingleTimer);
    __nearbySingleTimer = setTimeout(async () => {
      // YENİDEN: Polyline veya marker tıklamasında nearby açma!
      if (
        e.originalEvent &&
        e.originalEvent.target &&
        e.originalEvent.target.classList.contains('leaflet-interactive')
      ) {
        return;
      }
      closeNearbyPopup();
      showNearbyPlacesPopup(e.latlng.lat, e.latlng.lng, map, day, radius);
    }, __nearbySingleDelay);
  });

  map.on('dblclick', function() {
    if (__nearbySingleTimer) {
      clearTimeout(__nearbySingleTimer);
      __nearbySingleTimer = null;
    }
  });

  map.on('zoomstart', function() {
    if (__nearbySingleTimer) {
      clearTimeout(__nearbySingleTimer);
      __nearbySingleTimer = null;
    }
  });
}
async function showNearbyPlacesPopup(lat, lng, map, day, radius = 500) {
  const apiKey = window.GEOAPIFY_API_KEY || "d9a0dce87b1b4ef6b49054ce24aeb462";
  const categories = [
    "accommodation.hotel",
    "catering.restaurant",
    "catering.cafe",
    "leisure.park",
    "entertainment.cinema"
  ].join(",");

  const url = `https://api.geoapify.com/v2/places?categories=${categories}&filter=circle:${lng},${lat},${radius}&limit=20&apiKey=${apiKey}`;

  // Önceki popup + marker/pulse temizle
  closeNearbyPopup();

  // Loading popup
  const loadingContent = `
    <div class="nearby-loading-message">
      <div class="nearby-loading-spinner"></div>
      <small class="nearby-loading-text">Searching for nearby places...</small>
    </div>
  `;
  showCustomPopup(lat, lng, map, loadingContent, false);

  // --- Pulsing marker ekleme (ilk anda göster) ---
  try {
    if (window._nearbyMarker && window._nearbyMarker._map) {
      window._nearbyMarker._map.removeLayer(window._nearbyMarker);
    }
    window._nearbyMarker = null;

    if (window._nearbyPulseMarker && window._nearbyPulseMarker._map) {
      window._nearbyPulseMarker._map.removeLayer(window._nearbyPulseMarker);
    }
    window._nearbyPulseMarker = null;
  } catch (_) {}

  const pulseHtml = `
    <div class="nearby-pulse-root">
      <div class="nearby-pulse-core"></div>
      <div class="nearby-pulse-ring"></div>
      <div class="nearby-pulse-ring2"></div>
    </div>
  `;
  const pulseIcon = L.divIcon({
    className: 'nearby-pulse-icon-wrapper',
    html: pulseHtml,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });

  window._nearbyPulseMarker = L.marker([lat, lng], {
    icon: pulseIcon,
    interactive: false,
    keyboard: false
  }).addTo(map);

  // Hafif odak
  try {
    const currentZoom = map.getZoom();
if (currentZoom < 14) {
  map.flyTo([lat, lng], 15, { duration: 0.5, easeLinearity: 0.2 });
} else {
  map.panTo([lat, lng], { animate: true, duration: 0.4, easeLinearity: 0.2 });
}
  } catch (_) {}
  // --- Pulsing marker ekleme bitiş ---

  try {
    // Nokta bilgisi
    let pointInfo = { name: "Selected Point", address: "", opening_hours: "" };
    try {
      pointInfo = await getPlaceInfoFromLatLng(lat, lng);
    } catch (e) {
      console.warn('Location info could not be retrieved:', e);
    }

    const resp = await fetch(url);
    const data = await resp.json();

    let results = [];
    let photos = [];
    let placesHtml = "";

    if (data.features && data.features.length > 0) {
      results = data.features
        .filter(f => !!f.properties.name && f.properties.name.trim().length > 2)
        .map(f => {
          const d = haversine(lat, lng, f.properties.lat, f.properties.lon);
          return { ...f, distance: d };
        })
        .filter(f => f.distance <= radius)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 10);

      if (results.length > 0) {
        try {
          photos = await Promise.all(results.map(async (f) => {
            const name = f.properties.name || "";
            const cityQuery = name + " " + (window.selectedCity || "");
            try {
              let imageUrl = null;
              if (typeof getPexelsImage === "function") {
                imageUrl = await getPexelsImage(cityQuery);
              }
              if (imageUrl && imageUrl !== PLACEHOLDER_IMG && await isImageValid(imageUrl)) {
                return imageUrl;
              }
              if (typeof getPixabayImage === "function") {
                imageUrl = await getPixabayImage(name);
                if (imageUrl && imageUrl !== PLACEHOLDER_IMG && await isImageValid(imageUrl)) {
                  return imageUrl;
                }
              }
              return PLACEHOLDER_IMG;
            } catch (error) {
              console.warn(`Photo loading error: ${name}`, error);
              return PLACEHOLDER_IMG;
            }
          }));
        } catch (photoError) {
          console.warn('Photo loading failed, using placeholders:', photoError);
          photos = results.map(() => PLACEHOLDER_IMG);
        }

        placesHtml = results.map((f, idx) => {
          const name = f.properties.name || "(İsim yok)";
          const adr = f.properties.formatted || "";
          const photo = photos[idx] || PLACEHOLDER_IMG;
          const distStr = f.distance < 1000
            ? `${Math.round(f.distance)} m`
            : `${(f.distance / 1000).toFixed(2)} km`;

          const placeLat = f.properties.lat || f.geometry.coordinates[1];
          const placeLng = f.properties.lon || f.geometry.coordinates[0];
          const imgId = `nearby-img-${day}-${idx}`;

            return `
              <li class="nearby-place-item">
                <div class="nearby-place-image">
                  <img id="${imgId}"
                       src="${photo}"
                       alt="${name}"
                       class="nearby-place-img"
                       onload="this.style.opacity='1'"
                       onerror="handleImageError(this, '${name}', ${idx})"
                       data-original-src="${photo}"
                       data-place-name="${name}"
                       data-index="${idx}">
                  <div style="position:absolute;top:0;left:0;width:42px;height:42px;background:#f5f5f5;border-radius:8px;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.3s;" class="img-loading">
                    <div class="nearby-loading-spinner" style="width:16px;height:16px;"></div>
                  </div>
                </div>
                <div class="nearby-place-info">
                  <div class="nearby-place-name">${name}</div>
                  <div class="nearby-place-address">${adr}</div>
                </div>
                <div class="nearby-place-actions">
                  <div class="nearby-place-distance">${distStr}</div>
                  <button class="nearby-place-add-btn"
                          onclick="window.addNearbyPlaceToTripFromPopup(${idx}, ${day}, '${placeLat}', '${placeLng}')">+</button>
                </div>
              </li>`;
        }).join('');
      } else {
        placesHtml = "<li class='nearby-no-results'>No places found within 500 meters in this area.</li>";
      }
    } else {
      placesHtml = "<li class='nearby-no-results'>No places found within 500 meters in this area.</li>";
    }

    const addPointSection = `
      <div class="add-point-section" style="margin-bottom: 12px; border-bottom: 1px solid #e0e0e0; padding-bottom: 12px;">
        <div class="point-item" style="display: flex; align-items: center; gap: 12px; padding: 8px; background: #f8f9fa; border-radius: 8px; margin-bottom: 8px;">
          <div class="point-image" style="width: 42px; height: 42px; position: relative;">
            <img id="clicked-point-img"
                 src="img/placeholder.png"
                 alt="Seçilen Nokta"
                 style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px; opacity: 0.8;">
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 16px;">📍</div>
          </div>
          <div class="point-info" style="flex: 1; min-width: 0;">
            <div class="point-name-editor" style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
              <span id="point-name-display"
                    style="font-weight: 500; font-size: 14px; cursor: pointer; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                    onclick="window.editPointName()">${pointInfo.name}</span>
              <button onclick="window.editPointName()"
                      style="background: none; border: none; font-size: 12px; cursor: pointer; color: #666; padding: 2px;">✏️</button>
              <input type="text" id="point-name-input" value="${pointInfo.name}"
                     style="display: none; flex: 1; padding: 4px 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;">
            </div>
            <div class="point-address" style="font-size: 12px; color: #666; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${pointInfo.address || 'Selected location'}
            </div>
          </div>
          <div class="point-actions" style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <div style="font-size: 11px; color: #999; text-align: center;">Clicked</div>
            <button class="add-point-to-cart-btn"
                    onclick="window.addClickedPointToCart(${lat}, ${lng}, ${day})"
                    style="width: 32px; height: 32px; background: #1976d2; color: white; border: none; border-radius: 50%; font-size: 16px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center;">+</button>
          </div>
        </div>
      </div>
    `;



// YER: YENİ restaurantBtnHtml EK:
  const restaurantBtnHtml = `
    <div style="text-align:center; margin: 20px 0 4px 0;">
      <button id="show-restaurants-btn" style="padding:10px 18px;border-radius:9px;background:#8a4af3;color:#fff;font-size:15px;font-weight:bold;cursor:pointer;">
        🍽️ Show Restaurants
      </button>
    </div>
  `;



    const html = `
      <div class="nearby-popup-title">
        📍 Nearby Places
      </div>
      ${addPointSection}
      <ul class="nearby-places-list">${placesHtml}</ul>
            ${restaurantBtnHtml}
    `;

    showCustomPopup(lat, lng, map, html, true);
// --- ŞU SETTIMEOUT kodunu DA aynen ekle ---
  setTimeout(() => {
    const btn = document.getElementById("show-restaurants-btn");
    if (btn) {
      btn.onclick = async function() {
        btn.disabled = true;
        btn.textContent = "Loading restaurants...";
        await showNearbyRestaurants(lat, lng, map, day);
        btn.disabled = false;
        btn.textContent = "🍽️ Show Restaurants";
      };
    }
  }, 250);
    window._lastNearbyPlaces = results;
    window._lastNearbyPhotos = photos;
    window._lastNearbyDay = day;
    window._currentPointInfo = pointInfo;
    loadClickedPointImage(pointInfo.name);
  } catch (error) {
    console.error('Nearby places fetch error:', error);
    const errorContent = '<div class="nearby-error-message">An error occurred while loading nearby places.</div>';
    showCustomPopup(lat, lng, map, errorContent, true);
  }
}


async function showNearbyRestaurants(lat, lng, map, day) {
    map.__restaurantLayers = map.__restaurantLayers || [];
    map.__restaurantLayers.forEach(l => { if (l && l.remove) try { l.remove(); } catch{} });
    map.__restaurantLayers = [];
    const apiKey = window.GEOAPIFY_API_KEY || "d9a0dce87b1b4ef6b49054ce24aeb462";
    const url = `https://api.geoapify.com/v2/places?categories=catering.restaurant,catering.cafe,catering.bar,catering.fast_food,catering.pub&filter=circle:${lng},${lat},1000&limit=20&apiKey=${apiKey}`;
    try {
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.features || data.features.length === 0) {
            alert("Bu bölgede restoran/kafe/bar bulunamadı!");
            return;
        }
        data.features.forEach((f, idx) => {
            const guideLine = L.polyline(
              [[lat, lng], [f.properties.lat, f.properties.lon]],
              { color: "#22bb33", weight: 4, opacity: 0.95, dashArray: "8,8", interactive: true }
            ).addTo(map);
            map.__restaurantLayers.push(guideLine);

            const marker = L.marker([f.properties.lat, f.properties.lon], {
                icon: L.divIcon({
                    html: getPurpleRestaurantMarkerHtml(), className: "", iconSize: [32,32], iconAnchor: [16, 16]
                })
            }).addTo(map);
            map.__restaurantLayers.push(marker);

            const imgId = `rest-img-${f.properties.place_id || idx}`;
            marker.bindPopup(getFastRestaurantPopupHTML(f, imgId, day), { maxWidth: 340 });
            marker.on("popupopen", function() { handlePopupImageLoading(f, imgId); });
        });
        alert(`Bu alanda ${data.features.length} restoran/kafe/bar gösterildi.`);
    } catch (err) {
        alert("Restoranları çekerken hata oluştu. Lütfen tekrar deneyin.");
    }
}


// Seçilen nokta için fotoğraf yükleme fonksiyonu
async function loadClickedPointImage(pointName) {
    const img = document.getElementById('clicked-point-img');
    if (!img) return;

    try {
        let imageUrl = null;
        
        // Önce Pexels'tan dene
        if (typeof getPexelsImage === "function") {
            try {
                imageUrl = await getPexelsImage(pointName + " " + (window.selectedCity || ""));
                if (imageUrl && imageUrl !== PLACEHOLDER_IMG && await isImageValid(imageUrl)) {
                    img.src = imageUrl;
                    img.style.opacity = "1";
                    return;
                }
            } catch (e) {
                console.warn('Pexels image failed:', e);
            }
        }
        
        // Sonra Pixabay'dan dene
        if (typeof getPixabayImage === "function") {
            try {
                imageUrl = await getPixabayImage(pointName);
                if (imageUrl && imageUrl !== PLACEHOLDER_IMG && await isImageValid(imageUrl)) {
                    img.src = imageUrl;
                    img.style.opacity = "1";
                    return;
                }
            } catch (e) {
                console.warn('Pixabay image failed:', e);
            }
        }
        
        // Hiçbiri çalışmazsa placeholder kalsın ama opacity'yi düzelt
        img.style.opacity = "0.6";
        
    } catch (error) {
        console.warn('Image loading error:', error);
        img.style.opacity = "0.6";
    }
}
// Nokta adını düzenleme fonksiyonu
window.editPointName = function() {
    const displaySpan = document.getElementById('point-name-display');
    const inputField = document.getElementById('point-name-input');
    
    if (!displaySpan || !inputField) return;
    
    // Display'i gizle, input'u göster
    displaySpan.style.display = 'none';
    inputField.style.display = 'flex';
    inputField.focus();
    inputField.select();
    
    // Enter veya blur ile kaydet
    const saveEdit = function() {
        const newName = inputField.value.trim();
        if (newName) {
            displaySpan.textContent = newName;
            if (window._currentPointInfo) {
                window._currentPointInfo.name = newName;
            }
        }
        // Input'u gizle, display'i göster
        inputField.style.display = 'none';
        displaySpan.style.display = 'block';
    };
    
    inputField.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            saveEdit();
        } else if (e.key === 'Escape') {
            // İptal et - orijinal değeri koru
            inputField.value = displaySpan.textContent;
            inputField.style.display = 'none';
            displaySpan.style.display = 'block';
        }
    });
    
    inputField.addEventListener('blur', saveEdit);
};

// Güncellenen tıklanan noktayı sepete ekleme fonksiyonu
window.addClickedPointToCart = async function(lat, lng, day) {
    try {
        // Düzenlenmiş nokta bilgisini al
        const pointInfo = window._currentPointInfo || { name: "Seçilen Nokta", address: "", opening_hours: "" };
        const placeName = pointInfo.name;
        
        // Görsel al
        let imageUrl = "img/placeholder.png";
        if (typeof getPexelsImage === "function") {
            try {
                imageUrl = await getPexelsImage(placeName + " " + (window.selectedCity || ""));
                if (!imageUrl || imageUrl === PLACEHOLDER_IMG) {
                    throw new Error("Pexels image not found");
                }
            } catch (e) {
                if (typeof getPixabayImage === "function") {
                    try {
                        imageUrl = await getPixabayImage(placeName);
                    } catch (e2) {
                        imageUrl = "img/placeholder.png";
                    }
                }
            }
        }
        
        // Sepete ekle
        addToCart(
            placeName,
            imageUrl,
            day,
            "Place",
            pointInfo.address || "",
            null, null,
            pointInfo.opening_hours || "",
            null,
            { lat: lat, lng: lng },
            ""
        );

        
        // Popup'ı kapat
        closeNearbyPopup();
        
        // Başarı mesajı
console.log(`"${placeName}" added to cart!`);
        
    } catch (error) {
    console.error('An error occurred while adding the point to the cart:', error);
alert('An error occurred while adding the point to the cart.');
    }
};
if (typeof updateCart === "function") updateCart();

// FIX: addToCart fonksiyonunu da güncelleyelim
window.addNearbyPlaceToTripFromPopup = async function(idx, day, placeLat, placeLng) {
    if (!window._lastNearbyPlaces || !window._lastNearbyPlaces[idx]) return;
    
    const f = window._lastNearbyPlaces[idx];
    const photo = (window._lastNearbyPhotos && window._lastNearbyPhotos[idx]) ? window._lastNearbyPhotos[idx] : "img/placeholder.png";
    
    // FIX: Mekanın gerçek koordinatlarını kullan
    const actualLat = parseFloat(placeLat);
    const actualLng = parseFloat(placeLng);
    
    console.log(`Adding place: ${f.properties.name} at ${actualLat}, ${actualLng}`); // Debug log
    
    addToCart(
        f.properties.name || "Unnamed",
        photo,
        day,
        "Place",
        f.properties.formatted || "",
        null, null,
        f.properties.opening_hours || "",
        null,
        { lat: actualLat, lng: actualLng }, // FIX: Doğru koordinatlar
        f.properties.website || ""
    );
    
    // Popup'ı kapat ve başarı mesajı göster
    closeNearbyPopup();
    if (typeof updateCart === "function") updateCart();

    
    // Expanded map varsa ona da marker ekle
    const expandedMapData = Object.values(window.expandedMaps || {}).find(m => m.day === day);
    if (expandedMapData && expandedMapData.expandedMap) {
        const map = expandedMapData.expandedMap;
        
        // Başarı popup'ı göster
        L.popup()
            .setLatLng([actualLat, actualLng])
            .setContent(`<div style="text-align:center;"><b>${f.properties.name}</b><br><small style="color:#4caf50;">✓ Added!</small></div>`)
            .openOn(map);
        
        setTimeout(() => map.closePopup(), 2000);
        
        // Haritayı yeni eklenen yere odakla (isteğe bağlı)
        map.setView([actualLat, actualLng], map.getZoom(), { animate: true });
    }
};
if (typeof updateCart === "function") updateCart();

// Custom popup sistemi - harita katmanının üzerinde
function showCustomPopup(lat, lng, map, content, showCloseButton = true) {
    // Önceki popup'ı kapat
    closeNearbyPopup();
    
    // Popup container oluştur
    const popupContainer = document.createElement('div');
    popupContainer.id = 'custom-nearby-popup';
    
    // Close button HTML
    const closeButtonHtml = showCloseButton ? `
        <button onclick="closeNearbyPopup()" 
                class="nearby-popup-close-btn"
               title="Close">×</button>
    ` : '';
    
    popupContainer.innerHTML = `
        ${closeButtonHtml}
        <div class="nearby-popup-content">
            ${content}
        </div>
    `;
    
    // Body'ye ekle
    document.body.appendChild(popupContainer);
    
    // Global referansı sakla
    window._currentNearbyPopupElement = popupContainer;
    
    // Marker ekle
   // --- Pulsing marker ekle --- //
if (window._nearbyMarker) {
  try { map.removeLayer(window._nearbyMarker); } catch(_){}
  window._nearbyMarker = null;
}
if (window._nearbyPulseMarker) {
  try { map.removeLayer(window._nearbyPulseMarker); } catch(_){}
  window._nearbyPulseMarker = null;
}

// DivIcon HTML
const pulseHtml = `
  <div class="nearby-pulse-marker">
    <div class="nearby-pulse-core"></div>
    <div class="nearby-pulse-ring"></div>
    <div class="nearby-pulse-ring2"></div>
  </div>
`;

const pulseIcon = L.divIcon({
  html: pulseHtml,
  className: 'nearby-pulse-icon-wrapper', // boş class (Leaflet default stil katmasın)
  iconSize: [18,18],
  iconAnchor: [9,9]
});

window._nearbyPulseMarker = L.marker([lat, lng], { icon: pulseIcon, interactive:false }).addTo(map);


}

// Popup kapatma fonksiyonu
window.closeNearbyPopup = function() {
  const popupElement = document.getElementById('custom-nearby-popup');
  if (popupElement) {
    popupElement.style.animation = 'slideOut 0.2s ease-in';
    setTimeout(() => {
      if (popupElement.parentNode) {
        try { popupElement.parentNode.removeChild(popupElement); } catch(_){}
      }
    }, 200);
  }
  ['_nearbyMarker', '_nearbyPulseMarker'].forEach(ref => {
    const layer = window[ref];
    if (layer && layer._map) {
      try { layer._map.removeLayer(layer); } catch(_){}
    }
    window[ref] = null;
  });
  window._currentNearbyPopupElement = null;
};


// Görsel doğrulama fonksiyonu
async function isImageValid(url, timeout = 3000) {
    if (!url || url === PLACEHOLDER_IMG) return false;
    
    return new Promise((resolve) => {
        const img = new Image();
        const timer = setTimeout(() => {
            img.onload = img.onerror = null;
            resolve(false);
        }, timeout);
        
        img.onload = function() {
            clearTimeout(timer);
            resolve(this.width >= 50 && this.height >= 50);
        };
        
        img.onerror = function() {
            clearTimeout(timer);
            resolve(false);
        };
        
        img.src = url;
    });
}

// Görsel hata yönetimi
window.handleImageError = async function(imgElement, placeName, index) {
    if (imgElement.dataset.errorHandled === 'true') {
        imgElement.src = PLACEHOLDER_IMG;
        return;
    }
    
    imgElement.dataset.errorHandled = 'true';
    
    const loadingDiv = imgElement.parentNode?.querySelector('.img-loading');
    if (loadingDiv) {
        loadingDiv.style.opacity = '1';
    }
    
    try {
        const backupSources = [
            () => getPixabayImage && getPixabayImage(placeName),
            () => getPexelsImage && getPexelsImage(placeName.split(' ')[0])
        ];
        
        for (const getBackup of backupSources) {
            try {
                const backupUrl = await getBackup();
                if (backupUrl && backupUrl !== PLACEHOLDER_IMG && await isImageValid(backupUrl)) {
                    imgElement.src = backupUrl;
                    if (loadingDiv) loadingDiv.style.opacity = '0';
                    return;
                }
            } catch (e) {
                console.warn('Backup image source failed:', e);
            }
        }
    } catch (error) {
        console.warn('Error handling image fallback:', error);
    }
    
    imgElement.src = PLACEHOLDER_IMG;
    if (loadingDiv) loadingDiv.style.opacity = '0';
};

window.addNearbyPlaceToTrip = function(idx) {
    if (!window._lastNearbyPlaces || !window._lastNearbyPlaces[idx]) return;
    const f = window._lastNearbyPlaces[idx];
    const day = window._lastNearbyDay; // Artık doğru gün!
    const photo = (window._lastNearbyPhotos && window._lastNearbyPhotos[idx]) ? window._lastNearbyPhotos[idx] : "img/placeholder.png";
    addToCart(
        f.properties.name || "Unnamed",
        photo,
        day,
        "Place",
        f.properties.formatted || "",
        null, null,
        f.properties.opening_hours || "",
        null,
        { lat: f.properties.lat, lng: f.properties.lon },
        f.properties.website || ""
    );
    // Popup'ı kapat
    const containerId = Object.keys(window.expandedMaps).find(cid => window.expandedMaps[cid].day == day);
    const expandedMap = window.expandedMaps && window.expandedMaps[containerId]?.expandedMap;
    if (expandedMap) expandedMap.closePopup();
};    

function getDayDisplayName(day) {
  if (window.customDayNames && window.customDayNames[day]) {
    return window.customDayNames[day];
  }
  return `Day ${day}`;
}


function attachLongPressDrag(marker, map, { delay = 400, moveThreshold = 12 } = {}) {
    const el = marker.getElement();
    if (!el) {
        marker.once('add', () => attachLongPressDrag(marker, map, { delay, moveThreshold }));
        return;
    }

    if (marker.dragging && marker.dragging.enabled()) {
        marker.dragging.disable();
    }

    let timer = null;
    let pressed = false;
    let armed = false;             // long press süresi doldu
    let handedToLeaflet = false;   // kontrol Leaflet drag’e devredildi
    let startX = 0, startY = 0;

    const clearAll = () => {
        if (timer) clearTimeout(timer);
        timer = null;
        pressed = false;
        armed = false;
        if (!pressed) return;

        const isTouch = e.type.startsWith('touch');
        const pt = isTouch ? (e.touches[0] || e.changedTouches?.[0]) : e;
        if (!pt) return;

        const dx = Math.abs(pt.clientX - startX);
        const dy = Math.abs(pt.clientY - startY);

        if (!armed) {
            if (dx > moveThreshold || dy > moveThreshold) {
                if (timer) clearTimeout(timer);
                timer = null;
                pressed = false;
                armed = false;
                handedToLeaflet = false;
            }
            return;
        }

        if (armed && !handedToLeaflet) {
            handedToLeaflet = true;
            // Marker drag aktif: harita long-press’i bu süre boyunca devreye girmesin
            window.__tt_markerDragActive = true;
            try {
                if (marker.dragging) marker.dragging.enable();
                if (marker.dragging && marker.dragging._draggable && typeof marker.dragging._draggable._onDown === 'function') {
                    marker.dragging._draggable._onDown(e);
                }
            } catch (err) {}
            e.preventDefault();
            e.stopPropagation();
        }
    };

    const onUp = () => {
        clearAll();
    };

    el.addEventListener('touchstart', onDown, { passive: true });
    el.addEventListener('mousedown', onDown);

    el.addEventListener('touchmove', maybeStartDrag, { passive: false });
    el.addEventListener('mousemove', maybeStartDrag);

    el.addEventListener('touchend', onUp);
    el.addEventListener('mouseup', onUp);
    el.addEventListener('mouseleave', onUp);
    el.addEventListener('touchcancel', onUp);

    marker.on('dragend', () => {
        if (marker.dragging) marker.dragging.disable();
        clearAll();
    });
}


function disableAllMarkerDragging(expandedMap) {
    expandedMap.eachLayer(layer => {
        if (layer instanceof L.Marker && layer.dragging && layer.dragging.enabled && layer.dragging.enabled()) {
            layer.dragging.disable();
        }
    });
}

// Hint tooltip (top) – English text, no close button, auto-hide in 1s
function showTransientDragHint(marker, map, text = 'Drag to reposition') {
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
    .openOn(map);

  marker._hintTempPopup = popup;
  marker._hintTimer = setTimeout(() => {
    if (marker._hintTempPopup && map.hasLayer(marker._hintTempPopup)) {
      map.removeLayer(marker._hintTempPopup);
    }
    marker._hintTempPopup = null;
    marker._hintTimer = null;
  }, 1000);
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

  expandedMap.eachLayer(l => { if (l instanceof L.Marker) expandedMap.removeLayer(l); });

  const points = getDayPoints(day);

  points.forEach((p, idx) => {
    let currentName = p.name || '';

    const markerHtml = `
      <div class="custom-marker-outer red" data-idx="${idx}" style="position:relative;">
        <span class="custom-marker-label">${idx + 1}</span>
      </div>
      <div class="custom-marker-place-name" id="marker-name-${idx}" style="opacity:0;position:relative;">
        ${currentName}
        <button class="marker-remove-x-btn" data-marker-idx="${idx}" style="...">&times;</button>
      </div>
    `;
    const icon = L.divIcon({ html: markerHtml, className: "", iconSize: [32, 48], iconAnchor: [16, 16] });
    const marker = L.marker([p.lat, p.lng], { draggable: false, icon }).addTo(expandedMap);

    // PATCH: bindPopup ile Remove place butonu ekle
    marker.bindPopup(`
      <div style="min-width:120px;">
        <b>${p.name || "Point"}</b><br>
        <button class="remove-marker-btn" data-day="${day}" data-idx="${idx}" style="font-size: 0.8rem !important">Remove place</button>
      </div>
    `, {
      autoClose: false,
      closeButton: true
    });

    // PATCH: popup açıldığında butonun click eventini ekle
    marker.on('popupopen', function(e) {
      setTimeout(() => {
        const btn = document.querySelector('.remove-marker-btn[data-day="' + day + '"][data-idx="' + idx + '"]');
        if (btn) {
          btn.onclick = function() {
            // window.cart'tan day ve idx ile itemı bulup sil
            let n = 0;
            for (let i = 0; i < window.cart.length; i++) {
              const it = window.cart[i];
              if (it.day == day && it.location && !isNaN(it.location.lat) && !isNaN(it.location.lng)) {
                if (n === idx) {
                  window.cart.splice(i, 1);
                  if (typeof updateCart === "function") updateCart();
                  if (typeof renderRouteForDay === "function") renderRouteForDay(day);
                  marker.closePopup();
                  break;
                }
                n++;
              }
            }
          }
        }
      }, 10); // DOM renderı için küçük delay
    });
    marker.once('add', () => {
      const nameBox = marker.getElement()?.querySelector('.custom-marker-place-name');
      const xBtn = nameBox?.querySelector('.marker-remove-x-btn');
      if (xBtn) {
        xBtn.onclick = (e) => {
          e.stopPropagation();
          const cartIdx = findCartIndexByDayPosition(day, idx);
          if (cartIdx > -1) {
            window.cart.splice(cartIdx, 1);
            if (typeof updateCart === "function") updateCart();
            if (typeof renderRouteForDay === "function") renderRouteForDay(day);
          }
        };
      }
    });

    marker.on('click', (e) => {
      if (e.originalEvent) e.originalEvent.stopPropagation();
      disableAllMarkerDragging(expandedMap);
      if (marker.dragging && marker.dragging.enable) marker.dragging.enable();

      activateMarkerUI(marker);
      showDragArrows(marker);
      showTransientDragHint(marker, expandedMap, 'Drag to reposition');
      marker.openPopup();

      const box = marker.getElement()?.querySelector('.custom-marker-place-name');
      if (box) {
        box.style.opacity = 0;
        box.classList.remove('name-bubble-animate');
        const xBtn = box.querySelector('.marker-remove-x-btn');
        if (xBtn) xBtn.style.display = 'none';
      }

      if ('vibrate' in navigator) navigator.vibrate(15);
    });

    marker.on('dragstart', () => {
      window.__tt_markerDragActive = true;
      hideDragArrows(marker);
      if (marker._hintTimer) { clearTimeout(marker._hintTimer); marker._hintTimer = null; }
      if (marker._hintTempPopup && expandedMap.hasLayer(marker._hintTempPopup)) {
        expandedMap.removeLayer(marker._hintTempPopup);
        marker._hintTempPopup = null;
      }
      const box = marker.getElement()?.querySelector('.custom-marker-place-name');
      if (box) { box.style.opacity = 0; box.classList.remove('name-bubble-animate'); }
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
        } catch(_) {}
      }

      if (typeof renderRouteForDay === "function") renderRouteForDay(day);
      if (typeof updateCart === "function") updateCart();
      if (marker.dragging && marker.dragging.disable) marker.dragging.disable();
      window.__tt_markerDragActive = false;

        if (typeof saveCurrentTripToStorage === "function") saveCurrentTripToStorage();


      L.popup().setLatLng(finalLatLng).setContent('Location updated').addTo(expandedMap);

      const containerId = `expanded-route-scale-bar-day${day}`;
const scaleBarDiv = document.getElementById(containerId);
const routeContainerId = `route-map-day${day}`;
const totalKm = (window.lastRouteSummaries?.[routeContainerId]?.distance || 0) / 1000;
                                            const markerPositions = getRouteMarkerPositionsOrdered(day);

console.log('scaleBarDiv:', scaleBarDiv);
console.log('totalKm:', totalKm);
console.log('markerPositions:', markerPositions);

if (scaleBarDiv && totalKm > 0 && markerPositions.length > 0) {
  try { delete scaleBarDiv.dataset.elevLoadedKey; } catch(_) {}
  window.showScaleBarLoading?.(scaleBarDiv, 'Loading elevation…');
  renderRouteScaleBar(scaleBarDiv, totalKm, markerPositions);
  // Scale bar render edildikten hemen sonra sol baremi tekrar ekle!
const track = scaleBarDiv.querySelector('.scale-bar-track');
const svg = track && track.querySelector('svg.tt-elev-svg');
if (track && svg) {
  const width = Math.max(200, Math.round(track.getBoundingClientRect().width));
  createScaleElements(track, width, totalKm, 0, markerPositions);
}
} else if (scaleBarDiv) {
scaleBarDiv.innerHTML = '<div class="spinner"></div>';
}
    });
  });

  expandedMap.on('click', () => {
    disableAllMarkerDragging(expandedMap);
    clearAllMarkersUI();
  });

  const scaleBarDiv = document.getElementById(`expanded-route-scale-bar-day${day}`);
  if (scaleBarDiv) {
    try { delete scaleBarDiv.dataset.elevLoadedKey; } catch(_) {}
    window.showScaleBarLoading?.(scaleBarDiv, 'Loading elevation…');
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

    function haversine(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const toRad = x => x * Math.PI / 180;
        const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
        return 2 * R * Math.asin(Math.sqrt(a));
    }

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
function ensureExpandedScaleBar(day, raw) {
  let expandedMapDiv =
    document.getElementById(`expanded-map-${day}`) ||
    document.getElementById(`expanded-route-map-day${day}`);
  if (!expandedMapDiv) return; // DOM yoksa ekleme!

  let expandedScaleBar = document.getElementById(`expanded-route-scale-bar-day${day}`);
  if (!expandedScaleBar) {
    expandedScaleBar = document.createElement('div');
    expandedScaleBar.id = `expanded-route-scale-bar-day${day}`;
    expandedScaleBar.className = 'route-scale-bar expanded';
    expandedMapDiv.parentNode.insertBefore(expandedScaleBar, expandedMapDiv.nextSibling);
  }
  if (typeof renderRouteScaleBar === 'function') {
    let samples = raw;
    if (samples.length > 600) {
      const step = Math.ceil(samples.length / 600);
      samples = samples.filter((_,i)=>i%step===0);
    }
    let dist = 0, dists = [0];
    for (let i=1; i<samples.length; i++) {
      dist += haversine(
        samples[i-1].lat, samples[i-1].lng,
        samples[i].lat, samples[i].lng
      );
      dists.push(dist);
    }
    expandedScaleBar.innerHTML = "";
    // GPS import track varsa, tüm noktaları marker gibi ver
const imported = window.importedTrackByDay && window.importedTrackByDay[day] && window.importedTrackByDay[day].drawRaw;
if (imported) {
  renderRouteScaleBar(
    expandedScaleBar,
    dist/1000,
    samples.map((p, i) => ({
  name: (i === 0 ? "Start" : (i === samples.length - 1 ? "Finish" : "")),
  distance: dists[i]/1000,
  snapped: true
}))
  );
} else {
  // Eski haliyle devam et
  renderRouteScaleBar(
    expandedScaleBar,
    dist/1000,
    samples.map((p,i)=>({
      name: '',
      distance: dists[i]/1000,
      snapped: true
    }))
  );
}
  }
}

async function renderRouteForDay(day) {

    console.log("[ROUTE DEBUG] --- renderRouteForDay ---");
    console.log("GÜN:", day);
   const pts = getDayPoints(day).filter(
  p => typeof p.lat === "number" && typeof p.lng === "number" && !isNaN(p.lat) && !isNaN(p.lng)
);
    console.log("getDayPoints ile çekilen markerlar:", JSON.stringify(pts, null, 2));

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
                const prevPt = points[i-1];
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
        console.log(
  "[PAIRWISE SUMMARY]",
  "GÜN:", day,
  "TravelMode:", typeof getTravelModeForDay === "function" ? getTravelModeForDay(day) : "bilinmiyor",
  "pairwiseRouteSummaries:",
  window.pairwiseRouteSummaries?.[containerId]
);
          console.log("pairwise summary", pairwiseSummaries.length, pairwiseSummaries);

        window.lastRouteSummaries = window.lastRouteSummaries || {};
        window.lastRouteSummaries[containerId] = { distance: totalDistance, duration: totalDuration };

        renderLeafletRoute(containerId, finalGeojson, points, { distance: totalDistance, duration: totalDuration }, day);

        const infoPanel = document.getElementById(`route-info-day${day}`);
        if (infoPanel) {
            infoPanel.innerHTML = `<span style="color:#1976d2;">GPS dosyasından gelen rota <b>KİLİTLİ</b>. Başlangıç-bitiş arası sabit, sonrası eklendi.</span>`;
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
        if (expandedMapDiv) {
            let expandedScaleBar = document.getElementById(`expanded-route-scale-bar-day${day}`);
            if (!expandedScaleBar) {
                expandedScaleBar = document.createElement('div');
                expandedScaleBar.id = `expanded-route-scale-bar-day${day}`;
                expandedScaleBar.className = 'route-scale-bar expanded';
                expandedMapDiv.parentNode.insertBefore(expandedScaleBar, expandedMapDiv.nextSibling);
            }
            if (typeof renderRouteScaleBar === 'function' && expandedScaleBar) {
                let samples = gpsRaw;
                if (samples.length > 600) {
                    const step = Math.ceil(samples.length / 600);
                    samples = samples.filter((_, i) => i % step === 0);
                }
                let dist = 0, dists = [0];
                for (let i = 1; i < samples.length; i++) {
                    dist += haversine(samples[i - 1].lat, samples[i - 1].lng, samples[i].lat, samples[i].lng);
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
        return;
    }

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
    // Harita DOM'u silmek yerine, hep gösterilecek şekilde:
    ensureDayMapContainer(day);
    initEmptyDayMap(day);
    // Tüm route/stat/cache/state temizliği gene olsun
    if (typeof clearRouteCachesForDay === 'function') clearRouteCachesForDay(day);
    if (typeof clearRouteVisualsForDay === 'function') clearRouteVisualsForDay(day);
    if (typeof clearDistanceLabels === 'function') clearDistanceLabels(day);
    if (typeof updateRouteStatsUI === 'function') updateRouteStatsUI(day);
    return;
}

    if (points.length === 1) {
    if (typeof clearRouteCachesForDay === 'function') clearRouteCachesForDay(day);
    if (typeof clearRouteVisualsForDay === 'function') clearRouteVisualsForDay(day);
    ensureDayMapContainer(day);
    initEmptyDayMap(day);
    const map = window.leafletMaps?.[containerId];
    if (typeof updateRouteStatsUI === 'function') updateRouteStatsUI(day);
    if (typeof clearDistanceLabels === 'function') clearDistanceLabels(day);
    if (map) {



                            map.eachLayer(l => {
                                // Sadece marker, polyline, circle ve circleMarker layerlarını sil
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
        // DAİMA leaflet marker/divIcon kullanarak ekle (SVG/path yerine)
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
        // Burada da, sadece marker ve polyline'ları sil
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
    // TÜRKİYE'DE: HAVERSINE İLE Fallback summary/bar YOK, DOM'a badge/bar BOŞ!
    window.lastRouteSummaries = window.lastRouteSummaries || {};
    window.lastRouteSummaries[containerId] = {}; // Boş bırak!
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
      renderRouteScaleBar(expandedScaleBar, 0, []); // Mesafe yok, scale bar boş
    }
    return;
  } else {
    // YURTDIŞI/Fly Mode: HAVERSINE ile mesafe ve süre dolsun!
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
    } catch (err) {}
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
      expandedScaleBar.style.display = "block";
      expandedScaleBar.innerHTML = "";
      renderRouteScaleBar(expandedScaleBar, totalKm, markerPositions);
    }
    return;
  }
}

        async function fetchRoute() {
    const coordParam = coordinates.map(c => `${c[0]},${c[1]}`).join(';');
    const url = buildDirectionsUrl(coordParam, day);
    const response = await fetch(url);
    if (!response.ok) {
        alert("Rota oluşturulamıyor...");
        return null;
    }
    const data = await response.json();
    if (!data.routes || !data.routes[0] || !data.routes[0].geometry) throw new Error('No route found');
    // --- DÜZELTMELİ ---
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
        legs: data.routes[0].legs    // <---- BURAYI EKLE!
    };
}

    let routeData;
    let missingPoints = [];
    try {
        routeData = await fetchRoute();
        if (!routeData) return;
        missingPoints = snappedPoints.filter(p => isPointReallyMissing(p, routeData.coords, 100));
    } catch (e) {
        const infoPanel = document.getElementById(`route-info-day${day}`);
        if (infoPanel) infoPanel.textContent = "Could not draw the route!";
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

    renderLeafletRoute(containerId, routeData.geojson, snappedPoints, routeData.summary, day, missingPoints);

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

    console.log(
      "[PAIRWISE SUMMARY]",
      "GÜN:", day,
      "TravelMode:", typeof getTravelModeForDay === "function" ? getTravelModeForDay(day) : "bilinmiyor",
      "pairwiseRouteSummaries:",
      window.pairwiseRouteSummaries?.[containerId]
    );
    console.log("pairwise summary", pairwiseSummaries.length, pairwiseSummaries);



    if (routeData.summary && typeof updateDistanceDurationUI === 'function') {
        updateDistanceDurationUI(routeData.summary.distance, routeData.summary.duration);
    }

    const hint = document.querySelector(`#route-map-day${day} .empty-map-hint`);
    if (hint) hint.remove();

    setTimeout(() => typeof updateRouteStatsUI === 'function' && updateRouteStatsUI(day), 200);
    if (typeof adjustExpandedHeader === 'function') adjustExpandedHeader(day);

    if (
        typeof window._lastSegmentDay === "number" &&
        typeof window._lastSegmentStartKm === "number" &&
        typeof window._lastSegmentEndKm === "number"
    ) {
        setTimeout(function () {
            highlightSegmentOnMap(
                window._lastSegmentDay,
                window._lastSegmentStartKm,
                window._lastSegmentEndKm
            );
        }, 150);
    }
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

function changeContent(option) {
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => section.classList.remove('active'));

    const images = document.querySelectorAll('.theme-menu img');
    images.forEach(img => img.classList.remove('active'));

    const chatBox = document.getElementById('chat-box');
    const welcomeSection = document.getElementById('tt-welcome');
    const aboutUsSection = document.getElementById('tt-about-us');

    if (chatBox) chatBox.style.display = 'none';
    if (welcomeSection) welcomeSection.style.display = 'none';
    if (aboutUsSection) aboutUsSection.style.display = 'none';

    if (option === 1) {
        if (welcomeSection) {
            welcomeSection.style.display = 'block';
            welcomeSection.classList.add('active');
        }
     
    } else if (option === 2) {
        if (aboutUsSection) {
            aboutUsSection.style.display = 'block';
            aboutUsSection.classList.add('active');
        }
        const ttIcon = document.getElementById("about-icon");
        if (ttIcon) ttIcon.classList.add('active');
    }
}

document.addEventListener('click', function(event) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;


   // homeIcon ile ilgili satırları tamamen kaldır
const ttIcon = document.querySelector('img[src="img/about-icon.svg"]');
const welcomeSection = document.getElementById('tt-welcome');
const aboutUsSection = document.getElementById('tt-about-us');
const userMessageDiv = document.querySelector('.message.user-message');

let clickedOnTtIcon = ttIcon && ttIcon.contains(event.target);
let clickedInsideWelcome = welcomeSection && welcomeSection.contains(event.target);
let clickedInsideAboutUs = aboutUsSection && aboutUsSection.contains(event.target);

if (!clickedOnTtIcon && !clickedInsideWelcome && !clickedInsideAboutUs) {
    if (userMessageDiv && userMessageDiv.textContent.trim() !== "") {
        // Hide content sections only if user message exists
        if (welcomeSection) welcomeSection.style.display = 'none';
        if (aboutUsSection) aboutUsSection.style.display = 'none';
    }
    chatBox.style.display = 'block';
}
});

// Show tt-welcome on page load
document.addEventListener('DOMContentLoaded', function() {
    changeContent(1);
});

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



// DÜZELTİLMİŞ: Her bir marker için polyline (rota) boyunca EN YAKIN noktayı bulur ve scale bar km’si ile tam hizalar.
// Sıralı değil, her marker için en yakın noktayı tam bulur!
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

    // Haversine Formülü
    function haversine(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const toRad = x => x * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(a));
    }

    // Polyline kümülatif mesafesi: her noktaya kadar
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

    // DÜZELTME: Her bir marker için polyline’da en yakın noktayı bul, sıralı arama YOK.
    return points.map((marker, index) => {
        // Başlangıç -> ilk polyline noktası
        if (index === 0) {
            return { name: marker.name, distance: 0, snapped: true, snappedDistance: 0 };
        }
        // Bitiş -> son polyline noktası
        if (index === points.length - 1) {
            return { name: marker.name, distance: apiTotal / 1000, snapped: true, snappedDistance: 0 };
        }
        // Ara markerlar için: Tüm polyline üzerindeki en yakın noktayı bul!
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
            distance: finalDist / 1000, // KM
            snapped: bestDist <= 200,   // 200m içinde snap kabul
            snappedDistance: bestDist
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
scaleBarDiv.innerHTML = '<div class="spinner"></div>';
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
      console.log('[Triptime][Directions] Using self-hosted OSRM via /route/v1/*');
      window.__TT_ROUTING_LOG_ONCE = true;
    }
    console.log('[Triptime][Directions] day=%s, profile=%s, url=%s', d, profile, url);
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
function ensureDayTravelModeSet(day, routeMapEl, controlsWrapperEl) {

  const setId = `tt-travel-mode-set-day${day}`;
  document.getElementById(setId)?.remove();

  const realPoints = typeof getDayPoints === "function" ? getDayPoints(day) : [];

  // Önce her durumda eskiyi kaldır
  const oldSet = document.getElementById(setId);
  if (oldSet) oldSet.remove();

  // --- PATCH: Artık 1 veya daha fazla point varsa MAP/EXPAND MAP barı görünmeli! ---
  if (!Array.isArray(realPoints) || realPoints.length < 1) {
    return; // SIFIR point için bar/expand map tuşu yok! (Ama 1 varsa var)
  }

  // 1 veya daha fazla point varsa:
  // FLY MODE aktifleştirme sadece markerlar yay ile bağlanıyorsa:
  const containerId = `route-map-day${day}`;
  const geojson = window.lastRouteGeojsons?.[containerId];
  const isInTurkey = areAllPointsInTurkey(realPoints);
  const hasRealRoute = isInTurkey && geojson && geojson.features && geojson.features[0]?.geometry?.coordinates?.length > 1;

  // Eğer Türkiye dışıysa veya route yoksa, sadece FLY MODE kutusu göster
  if (!hasRealRoute) {
    const set = document.createElement('div');
    set.id = setId;
    set.className = 'tt-travel-mode-set';
    set.dataset.day = String(day);
    set.innerHTML = `
      <div class="travel-modes">
        <button type="button" data-mode="fly" aria-label="Fly" class="active" style="pointer-events:none;opacity:0.97;">
          <img class="tm-icon" src="https://www.svgrepo.com/show/262270/kite.svg" alt="FLY" loading="lazy" decoding="async" style="width:20px;height:20px;">
          <span class="tm-label">FLY MODE</span>
        </button>
        <div class="fly-info-msg" style="font-size: 13px;
    color: #607d8b;
    margin-top: 3px;
    margin-left: 4px;
    font-weight: 400;">
        *Route options inactive for this area
      </div>
      </div>
    `;
    // Insert
    if (controlsWrapperEl && controlsWrapperEl.parentNode) {
      controlsWrapperEl.parentNode.insertBefore(set, controlsWrapperEl);
    } else if (routeMapEl && routeMapEl.parentNode) {
      routeMapEl.parentNode.insertBefore(set, routeMapEl.nextSibling);
    }
    return;
  }

  // --- Aşağıdaki kodun aynen kaldı ve Türkiye'de CAR/BIKE/WALK, aktif/renk-change logic aynen çalışıyor ---
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
  if (controlsWrapperEl && controlsWrapperEl.parentNode) {
    controlsWrapperEl.parentNode.insertBefore(set, controlsWrapperEl);
  } else if (routeMapEl && routeMapEl.parentNode) {
    routeMapEl.parentNode.insertBefore(set, routeMapEl.nextSibling);
  }

  set.addEventListener('mousedown', e => e.stopPropagation(), { passive: true });
  set.addEventListener('click', (e) => {
    e.stopPropagation();
    const btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    window.setTravelMode(btn.getAttribute('data-mode'), day);
  });

  if (typeof markActiveTravelModeButtons === 'function') {
    markActiveTravelModeButtons();
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


function ensureCanvasRenderer(map) {
  if (!map._ttCanvasRenderer) {
    map._ttCanvasRenderer = L.canvas(); // you can pass padding if needed
  }
  return map._ttCanvasRenderer;
}


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
  bar.style.display = 'flex';
  bar.style.flexDirection = 'column';
  bar.style.margin = '10px 0 20px 0';
  bar.style.padding = '10px';
  bar.style.borderRadius = '6px';
  bar.style.background = '#fafafa';
  bar.style.border = '1px solid #ddd';
  bar.style.gap = '10px';

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
  arrowSpan.innerHTML = `<img class="arrow-icon" src="https://www.svgrepo.com/show/520912/right-arrow.svg" style="transform: rotate(0deg); transition: transform 0.18s;">`;

  mapFunctionsDiv.appendChild(mapTitleDiv);
  mapFunctionsDiv.appendChild(arrowSpan);

  // --- DEĞİŞİKLİK BURADA: Expanded durumunu kontrol et ---
  const isExpanded = window.expandedMaps && window.expandedMaps[`route-map-day${day}`];

  // Expand Map butonu
  const expandBtn = document.createElement('button');
  expandBtn.type = 'button';
  expandBtn.className = 'expand-map-btn';
  expandBtn.setAttribute('aria-label', 'Expand Map');
  
  // Ortak stiller
  expandBtn.style.display = 'flex';
  expandBtn.style.flexDirection = 'row';
  expandBtn.style.alignItems = 'center';
  expandBtn.style.gap = '4px';
  expandBtn.style.padding = '4px 6px';
  expandBtn.style.fontWeight = 'bold';
  expandBtn.style.borderRadius = '10px';
  expandBtn.style.border = '1px solid'; // Renk duruma göre aşağıda atanacak

  if (isExpanded) {
      // --- DURUM 1: ZATEN AÇIK (PASİF) ---
      expandBtn.disabled = true;
      expandBtn.style.pointerEvents = 'none';
      expandBtn.style.opacity = '0.6';
      expandBtn.style.cursor = 'default';
      expandBtn.style.borderColor = '#ccc';
      expandBtn.style.background = '#f9f9f9';
      
      expandBtn.innerHTML = `
        <img class="tm-icon" src="https://cdn-icons-gif.flaticon.com/11201/11201877.gif" alt="MAP" loading="lazy" decoding="async" style="filter: grayscale(100%);">
        <span class="tm-label" style="color: #888">Map Expanded</span>
      `;
  } else {
      // --- DURUM 2: KAPALI (AKTİF) ---
      expandBtn.style.background = '#ffffff';
      expandBtn.style.borderColor = 'rgb(43 129 213)';
      expandBtn.style.color = '#297fd4';
      expandBtn.style.cursor = 'pointer';
      
      // Hover efektleri sadece aktifken
      expandBtn.onmouseover = function() { expandBtn.style.background = "#fafafa"; };
      expandBtn.onmouseout = function() { expandBtn.style.background = "#ffffff"; };

      expandBtn.innerHTML = `
        <img class="tm-icon" src="https://cdn-icons-gif.flaticon.com/11201/11201877.gif" alt="MAP" loading="lazy" decoding="async">
        <span class="tm-label" style="color: #297fd4">Expand map</span>
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


(function initRouteSummaryIconizer(){
  // Basit metin ayrıştırıcı: "Mesafe: 3.58 km  Süre: 13 min" gibi metinden değeri çeker
  function parseStats(text) {
    if (!text) return { dist: '', dura: '' };
    const t = text.replace(/\s+/g, ' ').trim();
    const distMatch = t.match(/([\d.,]+)\s*(km|m)\b/i);
    const duraMatch = t.match(/([\d.,]+)\s*(dk|sn|saat|sa)\b/i);
    return {
      dist: distMatch ? `${distMatch[1]} ${distMatch[2]}` : '',
      dura: duraMatch ? `${duraMatch[1]} ${duraMatch[2]}` : ''
    };
  }

  // İkonlu içerik üret (yol + saat)
  function renderIcons(dist, dura) {
    const roadSVG = `
      <img class="icon" src="/img/way_distance.svg" alt="Distance" loading="lazy" decoding="async">`;
    const clockSVG = `
      <img class="icon" src="/img/way_time.svg" alt="Distance" loading="lazy" decoding="async">`;
    const distHTML = dist ? `<span class="stat"><span class="icon">${roadSVG}</span><span>${dist}</span></span>` : '';
    const duraHTML = dura ? `<span class="stat"><span class="icon">${clockSVG}</span><span>${dura}</span></span>` : '';
    return `${distHTML}${dist && dura ? ' ' : ''}${duraHTML}`;
  }

  // Bir span üzerinde uygula
  function applyIcons(span) {
    if (!span) return;
    // Eğer zaten ikonluysa ve içinde 'stat' sınıfı varsa, bir şey yapma
    if (span.querySelector('.stat')) return;

    const { dist, dura } = parseStats(span.textContent || '');
    if (!dist && !dura) return; // tanınabilir metin yoksa dokunma

    // Re-entrancy koruması
    if (span.__ttIconizing) return;
    span.__ttIconizing = true;
    try {
      span.innerHTML = renderIcons(dist, dura);
    } finally {
      span.__ttIconizing = false;
    }
  }

  function applyAll() {
    document.querySelectorAll('.route-summary-control').forEach(applyIcons);
  }

  const mo = new MutationObserver((mutList) => {
    for (const mut of mutList) {
      // Yeni eklenen .route-summary-control
      mut.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.matches?.('.route-summary-control')) applyIcons(node);
        node.querySelectorAll?.('.route-summary-control').forEach(applyIcons);
      });

      // Mevcut özet span'ının metni değiştiyse
      if (mut.type === 'characterData') {
        const el = mut.target.parentElement;
        if (el && el.classList?.contains('route-summary-control')) {
          applyIcons(el);
        }
      } else if (mut.type === 'childList') {
        const t = mut.target;
        if (t && t.nodeType === 1 && t.classList?.contains('route-summary-control')) {
          applyIcons(t);
        }
      }
    }
  });

  function startObserver() {
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { applyAll(); startObserver(); });
  } else {
    applyAll(); startObserver();
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

/* 4) Convert route summary text ("Mesafe: ...  Süre: ...") to SVG + badge values */
(function initRouteSummaryIconizer(){
  function parseStats(text) {
    if (!text) return { dist: '', dura: '' };
    const t = text.replace(/\s+/g, ' ').trim();
    const distMatch = t.match(/([\d.,]+)\s*(km|m)\b/i);
    const duraMatch = t.match(/([\d.,]+)\s*(min|sec|hour|h)\b/i);
    return {
      dist: distMatch ? `${distMatch[1]} ${distMatch[2]}` : '',
      dura: duraMatch ? `${duraMatch[1]} ${duraMatch[2]}` : ''
    };
  }

  function renderSummary(dist, dura) {
    const parts = [];
    if (dist) {
      parts.push(`
        <span class="stat stat-distance">
          <img class="icon" src="${window.TT_SVG_ICONS.distance}" alt="Distance" loading="lazy" decoding="async">
          <span class="badge">${dist}</span>
        </span>
      `);
    }
    if (dura) {
      parts.push(`
        <span class="stat stat-duration">
          <img class="icon" src="${window.TT_SVG_ICONS.duration}" alt="Duration" loading="lazy" decoding="async">
          <span class="badge">${dura}</span>
        </span>
      `);
    }
    return parts.join('');
  }

  function applyToSpan(span) {
    if (!span) return;
    // If already iconized, skip
    if (span.querySelector('.stat')) return;

    const { dist, dura } = parseStats(span.textContent || '');
    if (!dist && !dura) return;
    // Avoid recursive MO loops
    if (span.__ttIconizing) return;
    span.__ttIconizing = true;
    try {
      span.innerHTML = renderSummary(dist, dura);
    } finally {
      span.__ttIconizing = false;
    }
  }

  function applyAll() {
    document.querySelectorAll('.route-summary-control').forEach(applyToSpan);
  }

  const mo = new MutationObserver((mutList) => {
    for (const mut of mutList) {
      mut.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.matches?.('.route-summary-control')) applyToSpan(node);
        node.querySelectorAll?.('.route-summary-control').forEach(applyToSpan);
      });
      if (mut.type === 'childList' && mut.target?.classList?.contains('route-summary-control')) {
        applyToSpan(mut.target);
      }
      if (mut.type === 'characterData') {
        const el = mut.target.parentElement;
        if (el && el.classList?.contains('route-summary-control')) applyToSpan(el);
      }
    }
  });

  function startObserver() {
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { applyAll(); startObserver(); });
  } else {
    applyAll(); startObserver();
  }
})();

(function routeSummaryAscentDescentPatch(){
  // 1) Configure icons
  window.TT_SVG_ICONS = Object.assign(window.TT_SVG_ICONS || {}, {
    // distance/time switched to local svgs (you said you'll place them)
    distance: '/img/way_distance.svg',
    duration: '/img/way_time.svg',
    // new ascent/descent icons
    ascent: '/img/way_ascent.svg',
    descent: '/img/way_descent.svg'
  });

  // 2) Keep per-day elevation stats here when ready
  window.routeElevStatsByDay = window.routeElevStatsByDay || {};

  function fmt(distanceMeters, durationSeconds, ascentM, descentM) {
    const distStr = (typeof distanceMeters === 'number')
      ? (distanceMeters / 1000).toFixed(2) + ' km' : '';
    const duraStr = (typeof durationSeconds === 'number')
      ? Math.round(durationSeconds / 60) + ' min' : '';
    const ascStr = (typeof ascentM === 'number')
      ? Math.round(ascentM) + ' m' : '';
    const descStr = (typeof descentM === 'number')
      ? Math.round(descentM) + ' m' : '';
    return { distStr, duraStr, ascStr, descStr };
  }

  function buildBadgesHTML(strings) {
    const parts = [];
    if (strings.distStr) {
      parts.push(`
        <span class="stat stat-distance">
          <img class="icon" src="${window.TT_SVG_ICONS.distance}" alt="Distance" loading="lazy" decoding="async">
          <span class="badge">${strings.distStr}</span>
        </span>
      `);
    }
    if (strings.duraStr) {
      parts.push(`
        <span class="stat stat-duration">
          <img class="icon" src="${window.TT_SVG_ICONS.duration}" alt="Duration" loading="lazy" decoding="async">
          <span class="badge">${strings.duraStr}</span>
        </span>
      `);
    }
    if (strings.ascStr) {
      parts.push(`
        <span class="stat stat-ascent">
          <img class="icon" src="${window.TT_SVG_ICONS.ascent}" alt="Ascent" loading="lazy" decoding="async">
          <span class="badge">${strings.ascStr}</span>
        </span>
      `);
    }
    if (strings.descStr) {
      parts.push(`
        <span class="stat stat-descent">
          <img class="icon" src="${window.TT_SVG_ICONS.descent}" alt="Descent" loading="lazy" decoding="async">
          <span class="badge">${strings.descStr}</span>
        </span>
      `);
    }
    return parts.join(' ');
  }

  function setSummaryForDay(day, distanceM, durationS) {
    const elev = window.routeElevStatsByDay?.[day] || {};
    const strings = fmt(distanceM, durationS, elev.ascent, elev.descent);

    // Small map control bar
    const smallSpan = document.querySelector(`#map-bottom-controls-day${day} .route-summary-control`);
    if (smallSpan) {
      smallSpan.innerHTML = buildBadgesHTML(strings);
    }

    // Expanded map header
    const expandedContainer = document.getElementById(`expanded-map-${day}`);
    const headerStats = expandedContainer?.querySelector('.route-stats');
    if (headerStats) {
      headerStats.innerHTML = buildBadgesHTML(strings);
    }
  }

  // 3) Override updateRouteStatsUI to also include ascent/descent and new icons
  window.updateRouteStatsUI = function(day) {
    const key = `route-map-day${day}`;
    const summary = window.lastRouteSummaries?.[key] || null;

    if (!summary) {
      const span = document.querySelector(`#map-bottom-controls-day${day} .route-summary-control`);
      if (span) span.innerHTML = '';
      const statsDiv = document.querySelector(`#expanded-map-${day} .route-stats`);
      if (statsDiv) statsDiv.innerHTML = '';
      return;
    }
    setSummaryForDay(day, summary.distance, summary.duration);
  };

  // 4) Compute ascent/descent from elevation profile (when available) and refresh UI
  function computeAscDesc(profile) {
    if (!profile || !Array.isArray(profile.points) || profile.points.length < 2) return { ascent: 0, descent: 0 };
    let up = 0, down = 0;
    for (let i = 1; i < profile.points.length; i++) {
      const d = profile.points[i].elev - profile.points[i - 1].elev;
      if (d > 0) up += d;
      else down += -d;
    }
    return { ascent: Math.round(up), descent: Math.round(down) };
  }

  function refreshAscentDescentForDay(day) {
    const cache = window.__ttElevDayCache?.[day];
    const profile = cache?.profile;
    if (!profile) return false;
    window.routeElevStatsByDay[day] = computeAscDesc(profile);

    // Also refresh distance/time with new elevation info
    const key = `route-map-day${day}`;
    const summary = window.lastRouteSummaries?.[key] || null;
    if (summary) setSummaryForDay(day, summary.distance, summary.duration);
    return true;
  }
  window.refreshAscentDescentForDay = refreshAscentDescentForDay;

  // 5) After scale bar render (where elevation is fetched), try to update ascent/descent
  const origRenderRouteScaleBar = window.renderRouteScaleBar;
  if (typeof origRenderRouteScaleBar === 'function') {
    window.renderRouteScaleBar = function(container, totalKm, markers) {
      const res = origRenderRouteScaleBar.apply(this, arguments);
      try {
        const id = container?.id || '';
        const m = id.match(/day(\d+)/);
        const day = m ? parseInt(m[1], 10) : null;
        if (day) {
          // Try now, then retry shortly if the elevation fetch is still in-flight
          setTimeout(() => {
            if (!refreshAscentDescentForDay(day)) {
              setTimeout(() => refreshAscentDescentForDay(day), 1200);
            }
          }, 200);
        }
      } catch (_) {}
      return res;
    };
  }
})();

function hideMarkerVerticalLineOnMap(map) {
  const cont = map?.getContainer?.();
  if (!cont) return;
  const line = cont.querySelector('.tt-map-vert-line');
  if (line) line.style.display = 'none';
}


function ensureRouteStatsUI(day) {
  const holder = document.getElementById(`map-bottom-controls-day${day}`);
  if (!holder) return null;
  const control = holder.querySelector('.route-summary-control');
  if (!control) return null;

  // Distance & Duration icons -> switch to svgrepo URLs
  const distIcon = control.querySelector('.stat-distance .icon');
  if (distIcon && !/svgrepo\.com/.test(distIcon.src)) {
    distIcon.src = 'https://www.svgrepo.com/show/532583/distance.svg';
    distIcon.alt = 'Distance';
    distIcon.loading = 'lazy';
    distIcon.decoding = 'async';
  }
  const timeIcon = control.querySelector('.stat-duration .icon');
  if (timeIcon && !/svgrepo\.com/.test(timeIcon.src)) {
    timeIcon.src = 'https://www.svgrepo.com/show/530514/time.svg';
    timeIcon.alt = 'Duration';
    timeIcon.loading = 'lazy';
    timeIcon.decoding = 'async';
  }

  // Ensure Ascent stat
  if (!control.querySelector('.stat-ascent')) {
    const asc = document.createElement('span');
    asc.className = 'stat stat-ascent';
    asc.innerHTML = `
      <img class="icon" src="https://www.svgrepo.com/show/530913/arrow-up.svg" alt="Ascent" loading="lazy" decoding="async">
      <span class="badge">— m</span>
    `;
    control.appendChild(asc);
  }

  // Ensure Descent stat
  if (!control.querySelector('.stat-descent')) {
    const dsc = document.createElement('span');
    dsc.className = 'stat stat-descent';
    dsc.innerHTML = `
      <img class="icon" src="https://www.svgrepo.com/show/530912/arrow-down.svg" alt="Descent" loading="lazy" decoding="async">
      <span class="badge">— m</span>
    `;
    control.appendChild(dsc);
  }

  return control;
}

function updateRouteAscentDescentUI(day, ascentM, descentM) {
  const control = ensureRouteStatsUI(day);
  if (!control) return;

  const ascBadge = control.querySelector('.stat-ascent .badge');
  if (ascBadge) {
    ascBadge.textContent = `${Math.round(ascentM)} m`;
ascBadge.title = `${Math.round(ascentM)} m ascent`;
  }
  const dscBadge = control.querySelector('.stat-descent .badge');
  if (dscBadge) {
    dscBadge.textContent = `${Math.round(descentM)} m`;
dscBadge.title = `${Math.round(descentM)} m descent`;
  }
}

function renderRouteScaleBar(container, totalKm, markers) {
  // 1. ADIM: CSS GÜVENLİK KİLİDİ
  if (!document.getElementById('tt-marker-loading-style')) {
    const style = document.createElement('style');
    style.id = 'tt-marker-loading-style';
    style.innerHTML = `
        .scale-bar-track.loading .marker-badge,
        .scale-bar-track.loading .scale-bar-tick,
        .scale-bar-track.loading .scale-bar-label,
        .scale-bar-track.loading .scale-bar-vertical-line, 
        .scale-bar-track.loading .tt-elev-tooltip { 
            display: none !important; 
        }
        .scale-bar-track.loading {
            min-height: 200px; 
        }
    `;
    document.head.appendChild(style);
  }

  const spinner = container.querySelector('.spinner');
  if (spinner) spinner.remove();
  
  const dayMatch = container.id && container.id.match(/day(\d+)/);
  const day = dayMatch ? parseInt(dayMatch[1], 10) : null;
  const gjKey = day ? `route-map-day${day}` : null;
  const gj = gjKey ? (window.lastRouteGeojsons?.[gjKey]) : null;
  const coords = gj?.features?.[0]?.geometry?.coordinates;

  if (!container || isNaN(totalKm)) {
    if (container) { container.innerHTML = ""; container.style.display = 'block'; }
    return;
  }

  delete container._elevationData;
  delete container._elevationDataFull;

  if (/^route-scale-bar-day\d+$/.test(container.id || '')) {
    container.innerHTML = '<div class="spinner"></div>';
    return;
  }

  if (!Array.isArray(coords) || coords.length < 2) {
    container.innerHTML = `<div class="scale-bar-track"><div style="text-align:center;padding:12px;font-size:13px;color:#c62828;">Rota noktaları bulunamadı</div></div>`;
    container.style.display = 'block';
    return;
  }
  const mid = coords[Math.floor(coords.length / 2)];

  const routeKey = `${coords.length}|${coords[0]?.join(',')}|${mid?.join(',')}|${coords[coords.length - 1]?.join(',')}`;
  
  if (Date.now() < (window.__elevCooldownUntil || 0)) {
    window.showScaleBarLoading?.(container, 'Loading elevation…');
    if (!container.__elevRetryTimer && typeof planElevationRetry === 'function') {
      const waitMs = Math.max(5000, (window.__elevCooldownUntil || 0) - Date.now());
      planElevationRetry(container, routeKey, waitMs, () => renderRouteScaleBar(container, totalKm, markers));
    }
    return;
  }

  let track = container.querySelector('.scale-bar-track');
  if (!track) {
    container.innerHTML = '<div class="spinner"></div>';
    track = document.createElement('div');
    track.className = 'scale-bar-track';
    container.appendChild(track);
  } else {
    track.innerHTML = '';
  }

  track.classList.add('loading');

  container.dataset.totalKm = String(totalKm);

  const selDiv = document.createElement('div');
  selDiv.className = 'scale-bar-selection';
  selDiv.style.cssText = `position:absolute; top:0; bottom:0; background: rgba(138,74,243,0.16); border: 1px solid rgba(138,74,243,0.45); display:none; z-index: 6;`;
  track.appendChild(selDiv);
  window.__scaleBarDragTrack = track;
  window.__scaleBarDragSelDiv = selDiv;

  window.removeEventListener('mousemove', window.__sb_onMouseMove);
  window.removeEventListener('mouseup', window.__sb_onMouseUp);
  window.removeEventListener('touchmove', window.__sb_onMouseMove); 
  window.removeEventListener('touchend', window.__sb_onMouseUp);   

  window.addEventListener('mousemove', window.__sb_onMouseMove);
  window.addEventListener('mouseup', window.__sb_onMouseUp);
  window.addEventListener('touchmove', window.__sb_onMouseMove, { passive: false }); 
  window.addEventListener('touchend', window.__sb_onMouseUp);     

  // Mouse Down (Masaüstü - Hemen başlar)
  track.addEventListener('mousedown', function(e) {
    const rect = track.getBoundingClientRect();
    window.__scaleBarDrag = { startX: e.clientX - rect.left, lastX: e.clientX - rect.left };
    window.__scaleBarDragTrack = track;
    window.__scaleBarDragSelDiv = selDiv;
    selDiv.style.left = `${window.__scaleBarDrag.startX}px`;
    selDiv.style.width = `0px`;
    selDiv.style.display = 'block';
  });

  // --- MOBİL İÇİN LONG PRESS (UZUN BASMA) MANTIĞI ---
  let longPressTimer = null;

  // 1. Dokunma Başladı: Sayacı başlat
  track.addEventListener('touchstart', function(e) {
    // Scroll'u engelleme (passive: true), kullanıcı scroll yapabilsin
    const rect = track.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;

    longPressTimer = setTimeout(() => {
        // Süre doldu, seçim modunu aktif et
        window.__scaleBarDrag = { startX: x, lastX: x };
        window.__scaleBarDragTrack = track;
        window.__scaleBarDragSelDiv = selDiv;
        selDiv.style.left = `${x}px`;
        selDiv.style.width = `0px`;
        selDiv.style.display = 'block';
        
        // Kullanıcıya hissettir (Titreşim)
        if (navigator.vibrate) navigator.vibrate(40);
        
    }, 600); // 600ms basılı tutarsa devreye girer

  }, { passive: true });

  // 2. Parmağı Oynattı: Eğer seçim daha başlamadıysa (timer bitmediyse) iptal et
  track.addEventListener('touchmove', function(e) {
      if (longPressTimer && !window.__scaleBarDrag) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
          // Kullanıcı kaydırıyor (scroll yapıyor), seçimi iptal et
      }
  }, { passive: true });

  // 3. Parmağı Çekti: Sayacı temizle
  track.addEventListener('touchend', function() {
      if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
      }
  });
  // --------------------------------------------------

  track.style.position = 'relative';
  track.style.overflow = 'visible';

  let width = Math.max(200, Math.round(track.getBoundingClientRect().width));
  if (isNaN(width)) width = 400;

  const svgNS = 'http://www.w3.org/2000/svg';
  const SVG_TOP = 48;
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  let SVG_H = isMobile
    ? Math.max(180, Math.min(240, Math.round(track.getBoundingClientRect().height - SVG_TOP - 12)))
    : Math.max(180, Math.min(320, Math.round(track.getBoundingClientRect().height - SVG_TOP - 16)));
  if (isNaN(SVG_H)) SVG_H = isMobile ? 160 : 220;

  const svgElem = document.createElementNS(svgNS, 'svg');
  svgElem.setAttribute('class', 'tt-elev-svg');
  svgElem.setAttribute('data-role', 'elev-base');
  svgElem.setAttribute('viewBox', `0 0 ${width} ${SVG_H}`);
  svgElem.setAttribute('preserveAspectRatio', 'none');
  svgElem.setAttribute('width', '100%');
  svgElem.setAttribute('height', SVG_H);
  track.appendChild(svgElem);

  const gridG = document.createElementNS(svgNS, 'g');
  gridG.setAttribute('class', 'tt-elev-grid');
  svgElem.appendChild(gridG);

  const areaPath = document.createElementNS(svgNS, 'path');
  areaPath.setAttribute('class', 'tt-elev-area');
  svgElem.appendChild(areaPath);

  const segG = document.createElementNS(svgNS, 'g');
  segG.setAttribute('class', 'tt-elev-segments');
  svgElem.appendChild(segG);

  const verticalLine = document.createElement('div');
  verticalLine.className = 'scale-bar-vertical-line';
  verticalLine.style.cssText = `position:absolute;top:0;bottom:0;width:2px;background:#111;opacity:0.5;pointer-events:none;z-index:100;display:block;`;
  verticalLine.style.left = '0px'; 
  track.appendChild(verticalLine);

  const tooltip = document.createElement('div');
  tooltip.className = 'tt-elev-tooltip';
  tooltip.style.left = '0px';
  tooltip.style.display = 'none';
  track.appendChild(tooltip);

  track.addEventListener('mousemove', function(e) {
    const rect = track.getBoundingClientRect();
    const x = e.clientX - rect.left;
    verticalLine.style.left = `${x}px`;
  });
  track.addEventListener('touchmove', function(e) {
    const rect = track.getBoundingClientRect();
    const x = (e.touches && e.touches.length) ? (e.touches[0].clientX - rect.left) : (width / 2);
    verticalLine.style.left = `${x}px`;
  });

  function hv(lat1, lon1, lat2, lon2) {
    const R = 6371000, toRad = x => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }
  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1];
    const [lon2, lat2] = coords[i];
    cum[i] = cum[i - 1] + hv(lat1, lon1, lat2, lon2);
  }
  const totalM = cum[cum.length - 1] || 1;

  const N = Math.max(40, Math.round(totalKm * 2));
  const samples = [];
  for (let i = 0; i < N; i++) {
    const target = (i / (N - 1)) * totalM;
    let idx = 0;
    while (idx < cum.length && cum[idx] < target) idx++;
    if (idx === 0) {
      const [lon, lat] = coords[0];
      samples.push({ lat, lng: lon, distM: 0 });
    } else if (idx >= cum.length) {
      const [lon, lat] = coords[cum.length - 1];
      samples.push({ lat, lng: lon, distM: totalM });
    } else {
      const p = idx - 1, segLen = (cum[idx] - cum[p]) || 1, t = (target - cum[p]) / segLen;
      const [lon1, lat1] = coords[p], [lon2, lat2] = coords[idx];
      samples.push({ lat: lat1 + (lat2 - lat1) * t, lng: lon1 + (lon2 - lon1) * t, distM: target });
    }
  }

  container._elevFullSamples = samples.slice();
  container._elevSamples = samples.slice();
  container._elevStartKm = 0;
  container._elevKmSpan = totalKm;

  function redrawElevation(elevationData) {
    if (!elevationData) return;
    const { smooth, min, max } = elevationData;
    const s = container._elevSamples || [];
    const startKmDom = Number(container._elevStartKm || 0);
    const spanKm = Number(container._elevKmSpan || totalKm) || 1;

    let vizMin = min, vizMax = max;
    const eSpan = max - min;
    if (eSpan > 0) { vizMin = min - eSpan * 0.50; vizMax = max + eSpan * 1.0; }
    else { vizMin = min - 1; vizMax = max + 1; }

    const X = kmRel => (kmRel / spanKm) * width;
    const Y = e => (isNaN(e) || vizMin === vizMax) ? (SVG_H / 2) : ((SVG_H - 1) - ((e - vizMin) / (vizMax - vizMin)) * (SVG_H - 2));

    while (gridG.firstChild) gridG.removeChild(gridG.firstChild);
    while (segG.firstChild) segG.removeChild(segG.firstChild);

    const levels = 4;
    for (let i = 0; i <= levels; i++) {
      const ev = vizMin + (i / levels) * (vizMax - vizMin);
      const y = Y(ev);
      if (isNaN(y)) continue;
      const ln = document.createElementNS(svgNS, 'line');
      ln.setAttribute('x1', '0'); ln.setAttribute('x2', String(width));
      ln.setAttribute('y1', String(y)); ln.setAttribute('y2', String(y));
      ln.setAttribute('stroke', '#d7dde2'); ln.setAttribute('stroke-dasharray', '4 4'); ln.setAttribute('opacity', '.8');
      gridG.appendChild(ln);

      const tx = document.createElementNS(svgNS, 'text');
      tx.setAttribute('x', '6'); tx.setAttribute('y', String(y - 4));
      tx.setAttribute('fill', '#90a4ae'); tx.setAttribute('font-size', '11');
      tx.textContent = `${Math.round(ev)} m`;
      gridG.appendChild(tx);
    }

    let topD = '';
    const n = Math.min(smooth.length, s.length);
    for (let i = 0; i < n; i++) {
      const kmAbs = s[i].distM / 1000;
      const x = Math.max(0, Math.min(width, X(kmAbs - startKmDom)));
      const y = Y(smooth[i]);
      if (isNaN(x) || isNaN(y)) continue;
      topD += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
    }
    if (topD) {
      let lastX = null;
      let points = topD.match(/[\d\.]+/g);
      if (points && points.length >= 2) {
        lastX = Number(points[points.length - 2]);
      }
      const areaD = `${topD} L ${width} ${SVG_H} L 0 ${SVG_H} Z`;
      areaPath.setAttribute('d', areaD);
      areaPath.setAttribute('fill', '#263445');
    }

    for (let i = 1; i < n; i++) {
      const kmAbs1 = s[i - 1].distM / 1000;
      const kmAbs2 = s[i].distM / 1000;
      const x1 = Math.max(0, Math.min(width, X(kmAbs1 - startKmDom)));
      const y1 = Y(smooth[i - 1]);
      const x2 = Math.max(0, Math.min(width, X(kmAbs2 - startKmDom)));
      const y2 = Y(smooth[i]);

      const dx = s[i].distM - s[i - 1].distM;
      const dy = smooth[i] - smooth[i - 1];
      let slope = 0, color = '#72c100';
      if (i > 1 && dx > 50) {
        slope = (dy / dx) * 100;
        color = (slope < 0) ? '#72c100' : getSlopeColor(slope);
      }

      const seg = document.createElementNS(svgNS, 'line');
      seg.setAttribute('x1', String(x1));
      seg.setAttribute('y1', String(y1));
      seg.setAttribute('x2', String(x2));
      seg.setAttribute('y2', String(y2));
      seg.setAttribute('stroke', color);
      seg.setAttribute('stroke-width', '3');
      seg.setAttribute('stroke-linecap', 'round');
      seg.setAttribute('fill', 'none');
      segG.appendChild(seg);
    }
    
    createScaleElements(track, width, totalKm, 0, markers);
  }
  container._redrawElevation = redrawElevation;

  if (track.__onMove) track.removeEventListener('mousemove', track.__onMove);
  track.__onMove = function(e) {
    const ed = container._elevationData;
    if (!ed || !Array.isArray(ed.smooth)) return;
    tooltip.style.display = 'block';
    const s = container._elevSamples || [];
    const startKmDom = Number(container._elevStartKm || 0);
    const spanKm = Number(container._elevKmSpan || totalKm) || 1;
    const rect = track.getBoundingClientRect();
    const ptX = (e.touches && e.touches[0]) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    let x = ptX;
    let percent = Math.max(0, Math.min(1, ptX / rect.width));
    let foundKmAbs, foundSlope = 0, foundElev = null;
    if (typeof track._segmentStartPx === "number" && typeof track._segmentWidthPx === "number" && track._segmentWidthPx > 0) {
      let segPercent = percent;
      const segStartKm = startKmDom;
      const segEndKm = startKmDom + spanKm;
      foundKmAbs = segStartKm + segPercent * (segEndKm - segStartKm);
    } else {
      foundKmAbs = startKmDom + percent * spanKm;
    }
    let minDist = Infinity;
    for (let i = 1; i < s.length; i++) {
      const kmAbs1 = s[i - 1].distM / 1000;
      const kmAbs2 = s[i].distM / 1000;
      const midKm = (kmAbs1 + kmAbs2) / 2;
      const dist = Math.abs(foundKmAbs - midKm);
      if (dist < minDist) {
        minDist = dist;
        const dx = s[i].distM - s[i - 1].distM;
        const dy = ed.smooth[i] - ed.smooth[i - 1];
        foundSlope = dx > 0 ? (dy / dx) * 100 : 0;
        foundElev = Math.round(ed.smooth[i]);
      }
    }
    tooltip.style.opacity = '1';
    tooltip.textContent = `${foundKmAbs.toFixed(2)} km • ${foundElev ?? ''} m • %${foundSlope.toFixed(1)} slope`;
    const tooltipWidth = tooltip.offsetWidth || 140;
    const scaleBarRight = rect.right;
    const mouseScreenX = (e.touches && e.touches.length) ? e.touches[0].clientX : e.clientX;
    let tooltipLeft;
    if ((mouseScreenX + tooltipWidth + 8) > scaleBarRight) {
      tooltipLeft = Math.max(0, x - tooltipWidth - 12);
      tooltip.style.left = `${tooltipLeft}px`;
    } else {
      tooltipLeft = x + 14;
      tooltip.style.left = `${tooltipLeft}px`;
    }
    verticalLine.style.left = `${x}px`;
    verticalLine.style.display = 'block';
  };
  track.addEventListener('mousemove', track.__onMove);
  track.addEventListener('touchmove', track.__onMove);

  window.showScaleBarLoading?.(container, 'Loading elevation…');

  (async () => {
    try {
      const elevations = await window.getElevationsForRoute(samples, container, routeKey);
      if (!elevations || elevations.length !== samples.length || elevations.some(Number.isNaN)) {
        container.innerHTML = `<div class="scale-bar-track"><div style="text-align:center;padding:12px;font-size:13px;color:#c62828;">Elevation profile unavailable</div></div>`;
        return;
      }

      const smooth = movingAverage(elevations, 3);
      const min = Math.min(...smooth);
      const max = Math.max(...smooth, min + 1);

      container._elevationData = { smooth, min, max };
      container._elevationDataFull = { smooth: smooth.slice(), min, max };
      container.dataset.elevLoadedKey = routeKey;

      redrawElevation(container._elevationData);
      
      requestAnimationFrame(() => {
          setTimeout(() => {
              window.hideScaleBarLoading?.(container);
              track.classList.remove('loading');
          }, 60);
      });

      if (typeof day !== "undefined") {
        let ascent = 0, descent = 0;
        for (let i = 1; i < elevations.length; i++) {
          const d = elevations[i] - elevations[i - 1];
          if (d > 0) ascent += d;
          else descent -= d;
        }
        window.routeElevStatsByDay = window.routeElevStatsByDay || {};
        window.routeElevStatsByDay[day] = { ascent: Math.round(ascent), descent: Math.round(descent) };
        if (typeof updateRouteStatsUI === "function") updateRouteStatsUI(day);
      }
    } catch {
      window.updateScaleBarLoadingText?.(container, 'Elevation temporarily unavailable');
      try { delete container.dataset.elevLoadedKey; } catch(_) {}
      
      track.classList.remove('loading');
      createScaleElements(track, width, totalKm, 0, markers);
    }
  })();

  function handleResize() {
    if (!container._elevationData) return;

    const newW = Math.max(200, Math.round(track.getBoundingClientRect().width));
    const spanKm = container._elevKmSpan || 1;
    const startKmDom = container._elevStartKm || 0;
    const markers = (typeof getRouteMarkerPositionsOrdered === 'function') ? getRouteMarkerPositionsOrdered(day) : [];
    createScaleElements(track, newW, spanKm, startKmDom, markers);
  }

  if (container._elevResizeObserver) {
    try { container._elevResizeObserver.disconnect(); } catch(_) {}
    container._elevResizeObserver = null;
  }
  const ro = new ResizeObserver(() => { handleResize(); });
  ro.observe(track);
  container._elevResizeObserver = ro;
}

// Kartları ekledikten sonra çağır: attachFavEvents();

window.__sb_onMouseMove = function(e) {
  if (!window.__scaleBarDrag || !window.__scaleBarDragTrack || !window.__scaleBarDragSelDiv) return;
  
  // Mobilde sayfa kaymasını engelle (Scroll Lock)
  if (e.type === 'touchmove' && e.cancelable) {
      e.preventDefault(); 
  }

  const rect = window.__scaleBarDragTrack.getBoundingClientRect();
  const clientX = (e.touches && e.touches.length) ? e.touches[0].clientX : e.clientX;
  
  window.__scaleBarDrag.lastX = Math.max(0, Math.min(rect.width, clientX - rect.left));
  
  const left = Math.min(window.__scaleBarDrag.startX, window.__scaleBarDrag.lastX);
  const right = Math.max(window.__scaleBarDrag.startX, window.__scaleBarDrag.lastX);
  
  window.__scaleBarDragSelDiv.style.left = `${left}px`;
  window.__scaleBarDragSelDiv.style.width = `${right - left}px`;
};

window.__sb_onMouseUp = function() {
  if (!window.__scaleBarDrag || !window.__scaleBarDragTrack || !window.__scaleBarDragSelDiv) return;
  const rect = window.__scaleBarDragTrack.getBoundingClientRect();
  const leftPx = Math.min(window.__scaleBarDrag.startX, window.__scaleBarDrag.lastX);
  const rightPx = Math.max(window.__scaleBarDrag.startX, window.__scaleBarDrag.lastX);
  
  // Seçim bitti, div'i gizleyelim ki ekranda asılı kalmasın
  window.__scaleBarDragSelDiv.style.display = 'none';

  if (rightPx - leftPx < 8) { 
      window.__scaleBarDrag = null; 
      return; 
  }

  const container = window.__scaleBarDragTrack.closest('.route-scale-bar');
  if (!container) { window.__scaleBarDrag = null; return; }
  
  const dayMatch = container.id && container.id.match(/day(\d+)/);
  const day = dayMatch ? parseInt(dayMatch[1], 10) : null;

  window.__scaleBarDrag = null;

  if (day != null) {
    // --- NESTED SEGMENT MANTIĞI ---
    
    // Varsayılan: Ana grafik (0'dan Toplam KM'ye)
    let baseStartKm = 0;
    let visibleSpanKm = Number(container.dataset.totalKm) || 0;

    // Eğer zaten bir segmentin içindeysek (Zoomlu görünüm)
    if (
        typeof window._lastSegmentDay === 'number' &&
        window._lastSegmentDay === day &&
        typeof window._lastSegmentStartKm === 'number' &&
        typeof window._lastSegmentEndKm === 'number'
    ) {
        // Hesaplamayı mevcut segmentin üzerine kur
        baseStartKm = window._lastSegmentStartKm;
        visibleSpanKm = window._lastSegmentEndKm - window._lastSegmentStartKm;
    }

    // Mouse'un bar üzerindeki oranını hesapla (0.0 - 1.0)
    const ratioStart = leftPx / rect.width;
    const ratioEnd   = rightPx / rect.width;

    // Yeni başlangıç ve bitiş km'lerini hesapla
    // Formül: (Mevcut Başlangıç) + (Oran * Mevcut Genişlik)
    const newStartKm = baseStartKm + (ratioStart * visibleSpanKm);
    const newEndKm   = baseStartKm + (ratioEnd * visibleSpanKm);

    // Yeni segmenti çiz
    fetchAndRenderSegmentElevation(container, day, newStartKm, newEndKm);
    
    // Haritadaki çizgiyi de hemen güncelle (Gecikmeyi önlemek için buraya da ekledim)
    if (typeof highlightSegmentOnMap === 'function') {
        highlightSegmentOnMap(day, newStartKm, newEndKm);
    }
  }
};


async function fetchAndRenderSegmentElevation(container, day, startKm, endKm) {
  const containerId = container.id;
  document.querySelectorAll(`#${CSS.escape(containerId)}`).forEach((el, idx) => {
    if (idx > 0) el.remove();
  });

  const key = `route-map-day${day}`;
  const gj = window.lastRouteGeojsons?.[key];
  const coords = gj?.features?.[0]?.geometry?.coordinates;
  if (!coords || coords.length < 2) return;

  const existingTrack = container.querySelector('.scale-bar-track');
  if (existingTrack) {
    existingTrack.querySelectorAll('svg[data-role="elev-segment"]').forEach(el => el.remove());
    existingTrack.querySelectorAll('.elev-segment-toolbar').forEach(el => el.remove());
  }

  function hv(lat1, lon1, lat2, lon2) {
    const R = 6371000, toRad = x => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1];
    const [lon2, lat2] = coords[i];
    cum[i] = cum[i - 1] + hv(lat1, lon1, lat2, lon2);
  }
  const totalM = cum[cum.length - 1] || 1;

  const segStartM = Math.max(0, Math.min(totalM, startKm * 1000));
  const segEndM   = Math.max(0, Math.min(totalM, endKm * 1000));
  if (segEndM - segStartM < 100) return;

  const segKm = (segEndM - segStartM) / 1000;
  const N = Math.min(200, Math.max(60, Math.round(segKm * 14)));

  const samples = [];
  for (let i = 0; i < N; i++) {
    const target = segStartM + (i / (N - 1)) * (segEndM - segStartM);
    let idx = 0; while (idx < cum.length && cum[idx] < target) idx++;
    if (idx === 0) {
      const [lon, lat] = coords[0];
      samples.push({ lat, lng: lon, distM: 0 });
    } else if (idx >= cum.length) {
      const [lon, lat] = coords[cum.length - 1];
      samples.push({ lat, lng: lon, distM: totalM });
    } else {
      const p = idx - 1, segLen = (cum[idx] - cum[p]) || 1, t = (target - cum[p]) / segLen;
      const [lon1, lat1] = coords[p], [lon2, lat2] = coords[idx];
      samples.push({ lat: lat1 + (lat2 - lat1) * t, lng: lon1 + (lon2 - lon1) * t, distM: target });
    }
  }

  // --- ÖZEL METİN ---
  // ensureElevationMux içinden müdahaleyi kaldırdığımız için bu yazı kalıcı olacak.
  window.showScaleBarLoading?.(container, 'Loading segment elevation...');
  // ------------------

  const routeKey = `seg:${coords.length}|${samples[0].lat.toFixed(4)},${samples[0].lng.toFixed(4)}|${samples[samples.length - 1].lat.toFixed(4)},${samples[samples.length - 1].lng.toFixed(4)}|${N}`;
   try {
    const elev = await window.getElevationsForRoute(samples, container, routeKey);
    if (!elev || elev.length !== N || elev.some(Number.isNaN)) return;

    const smooth = movingAverage(elev, 3);
    drawSegmentProfile(container, day, startKm, endKm, samples, smooth);
  } finally {
    requestAnimationFrame(() => {
        setTimeout(() => {
            window.hideScaleBarLoading?.(container);
        }, 60);
    });
  }

  setTimeout(function() {
    highlightSegmentOnMap(day, startKm, endKm);
  }, 200);
}


// // ✅ TÜM YETIM SCALE-BAR-TRACK'LERI TEMİZLE (güvenlik)
// function cleanupOrphanScaleBars() {
//   document.querySelectorAll('.scale-bar-track').forEach(track => {
//     // Eğer track bir expanded-route-scale-bar veya route-scale-bar container'ının içinde DEĞİLSE
//     const parent = track.closest('[id^="expanded-route-scale-bar-day"], [id^="route-scale-bar-day"]');
//     if (!parent) {
//       console.warn('[cleanup] Orphan scale-bar-track removed:', track);
//       track.remove();
//     }
//   });
// }

// // Her segment seçiminden ÖNCE   temizle
// document.addEventListener('mousedown', (e) => {
//   const scaleBar = e.target.closest('.scale-bar-track');
//   if (scaleBar) {
//     setTimeout(cleanupOrphanScaleBars, 100);
//   }
// });


(function ensureElevationThrottleHelpers(){
  if (window.__elevHelpersReadyV2) return;

  // Global pacing: serialize requests
  window.__elevQueue = window.__elevQueue || Promise.resolve();
  window.__elevReqMinIntervalMs = 1000;

  window.__lastElevRequestTs = window.__lastElevRequestTs || 0;

  // Cooldown if 429 happens
  window.__elevCooldownUntil = window.__elevCooldownUntil || 0; // timestamp ms

  // Per-route singleflight guard (avoid duplicate fetches for same route)
  window.__elevInFlightByKey = window.__elevInFlightByKey || Object.create(null);

  // Simple route signature for caching/dedup
  window.__routeKeyFromCoords = window.__routeKeyFromCoords || function(coords){
    try {
      if (!Array.isArray(coords) || coords.length < 2) return '';
      const first = coords[0]?.join(',');
      const last  = coords[coords.length - 1]?.join(',');
      return `${coords.length}|${first}|${last}`;
    } catch { return ''; }
  };

  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  function enqueue(fn) {
    const next = window.__elevQueue.then(fn, fn);
    window.__elevQueue = next.catch(() => {}); // keep chain alive
    return next;
  }

  // Throttled fetch with cooldown on 429
  window.__throttledElevFetch = function(url, { retries = 2, baseDelay = 1000, cooldownMs = 180000 } = {}) {
    return enqueue(async () => {
      // Respect global cooldown
      const now0 = Date.now();
      if (now0 < window.__elevCooldownUntil) {
        throw new Error('Elevation fetch skipped (cooldown active)');
      }

      // Respect min interval
      const now = Date.now();
      const wait = Math.max(0, window.__elevReqMinIntervalMs - (now - window.__lastElevRequestTs));
      if (wait) await sleep(wait);

      let delay = baseDelay;
      for (let attempt = 0; attempt <= retries; attempt++) {
        const resp = await fetch(url);
        window.__lastElevRequestTs = Date.now();

        if (resp.status === 429) {
          // Derive cooldown from Retry-After if present; else use fallback
          const ra = parseInt(resp.headers.get('retry-after') || '0', 10);
          const cd = (ra > 0 ? ra * 1000 : cooldownMs);
          window.__elevCooldownUntil = Date.now() + cd;

          // Exponential backoff before retrying (if any retries left)
          await sleep(delay);
          delay = Math.min(delay * 2, 5000);
          if (attempt < retries) continue;

          // Give up: propagate as error so caller can skip drawing silently
          throw new Error('Elevation API rate-limited (429); cooldown engaged');
        }

        if (!resp.ok) throw new Error(`Elevation HTTP ${resp.status}`);
        return resp;
      }

      // Should not reach here
      throw new Error('Elevation retries exhausted');
    });

  };

  window.__elevHelpersReadyV2 = true;
})();


(function ensureScaleBarLoadingHelpers(){
  if (window.__tt_scaleBarLoaderReady) return;

  function trackOf(c){ return c?.querySelector?.('.scale-bar-track')||null; }
  window.showScaleBarLoading = function(c,t='Loading elevation…'){
    const tr = trackOf(c); if (!tr) return;
    let box = tr.querySelector('.tt-scale-loader');
    if (!box){ box=document.createElement('div'); box.className='tt-scale-loader'; box.innerHTML=`<div class="spinner"></div><div class="txt"></div>`; tr.appendChild(box); }
    const txt = box.querySelector('.txt'); if (txt) txt.textContent = t;
    box.style.display='flex';
  };
  window.updateScaleBarLoadingText = function(c,t){
    const tr = trackOf(c); const box = tr?.querySelector('.tt-scale-loader'); const txt = box?.querySelector('.txt'); if (txt) txt.textContent = t;
  };
  window.hideScaleBarLoading = function(c){
    const tr = trackOf(c); const box = tr?.querySelector('.tt-scale-loader'); if (box) box.style.display='none';
  };
  window.__tt_scaleBarLoaderReady = true;
})();
(function ensureElev429Planner(){
  if (window.__tt_elev429PlannerReady) return;
  window.planElevationRetry = function(container, routeKey, waitMs, retryFn){
    if (!container) return;
    const now = Date.now(), until = now + Math.max(2000, waitMs|0);
    if (container.__elevRetryTimer){ clearTimeout(container.__elevRetryTimer); container.__elevRetryTimer=null; }
    const tick = ()=> {
      const left = Math.max(0, Math.ceil((until - Date.now())/1000));
      updateScaleBarLoadingText(container, left>0 ? `Waiting ${left}s due to rate limit…` : `Retrying…`);
      if (left>0){ container.__elevRetryTicker = setTimeout(tick, 1000); }
    };
    if (container.__elevRetryTicker){ clearTimeout(container.__elevRetryTicker); }
    tick();
    container.__elevRetryTimer = setTimeout(()=>{ container.__elevRetryTimer=null; if (container.__elevRetryTicker) clearTimeout(container.__elevRetryTicker); retryFn && retryFn(); }, until-now);
  };
  window.__tt_elev429PlannerReady = true;
})();

(function ensureElevationMux(){
  // Global değişkenler ve Rate Limit koruması burada kalmalı
  const TTL_MS = 48 * 60 * 60 * 1000;
  const LS_PREFIX = 'tt_elev_cache_v1:';

  const providers = [
    { key: 'myApi', fn: viaMyApi, chunk: 80, minInterval: 1200 },
  ];

  const cooldownUntil = { myApi: 0 };
  const lastTs        = { myApi: 0 };

  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  function loadCache(routeKey, n) {
    try {
      const raw = localStorage.getItem(LS_PREFIX + routeKey + ':' + n);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || !obj.ts || !Array.isArray(obj.elev)) return null;
      if (Date.now() - obj.ts > TTL_MS) return null;
      return obj.elev;
    } catch { return null; }
  }

  function saveCache(routeKey, n, elev) {
    try {
      localStorage.setItem(LS_PREFIX + routeKey + ':' + n, JSON.stringify({ ts: Date.now(), elev }));
    } catch {}
  }

  async function viaMyApi(samples) {
    const CHUNK = 120;
    const res = [];
    for (let i=0;i<samples.length;i+=CHUNK){
      const chunk = samples.slice(i,i+CHUNK);
      const loc = chunk.map(p=>`${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join('|');
      const url = `/api/elevation?locations=${encodeURIComponent(loc)}`;
      const resp = await fetch(url);
      if (resp.status === 429) {
        cooldownUntil.myApi = Date.now() + 10*60*1000;
        throw new Error('429');
      }
      if (!resp.ok) throw new Error('HTTP '+resp.status);
      const j = await resp.json();
      if (j.results && j.results.length === chunk.length) {
        res.push(...j.results.map(r => r && typeof r.elevation==='number' ? r.elevation : null));
      } else if (Array.isArray(j.elevations) && j.elevations.length === chunk.length) {
        res.push(...j.elevations);
      } else if (j.data && Array.isArray(j.data)) {
        res.push(...j.data);
      } else {
        throw new Error('bad response');
      }
      if (samples.length > CHUNK) await sleep(400);
    }
    if (res.some(v => typeof v !== 'number')) throw new Error('missing values');
    return res;
  }

  window.getElevationsForRoute = async function(samples, container, routeKey) {
    // Cache kontrolü
    const cached = loadCache(routeKey, samples.length);
    if (cached && cached.length === samples.length) {
      // Not: Buradan loader kapatma komutunu kaldırdık, çağıran fonksiyon kapatacak.
      return cached;
    }

    for (const p of providers) {
      try {
        if (Date.now() < cooldownUntil[p.key]) continue;
        
        // --- DEĞİŞİKLİK: Burada artık yazı güncelleme YOK ---
        // Sadece veri çekmeye odaklansın.
        
        const elev = await p.fn(samples);
        if (Array.isArray(elev) && elev.length === samples.length) {
          saveCache(routeKey, samples.length, elev);
          return elev;
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  };

  window.__tt_elevMuxReady = true;
})();

(function(){
  if (!document.getElementById('suggestions-hidden-style')) {
    const st = document.createElement('style');
    st.id = 'suggestions-hidden-style';
    st.textContent = '#suggestions.hidden{display:none;}';
    document.head.appendChild(st);
  }
})();


// YOKSA EKLE: (varsa atla)
function ensureCanvasRenderer(m){ if(!m._ttCanvasRenderer) m._ttCanvasRenderer=L.canvas(); return m._ttCanvasRenderer; }
function highlightSegmentOnMap(day, startKm, endKm) {
                if (
              typeof window._lastSegmentDay !== "number" ||
              typeof window._lastSegmentStartKm !== "number" ||
              typeof window._lastSegmentEndKm !== "number"
            ) {
              // Segment seçili değil, highlight çizilmesin!
              return;
            }
  const cid = `route-map-day${day}`;
  const gj = window.lastRouteGeojsons?.[cid];
  if (!gj || !gj.features || !gj.features[0]?.geometry?.coordinates) return;

  window._segmentHighlight = window._segmentHighlight || {};
  const maps = [];
  const small = window.leafletMaps?.[cid];
  if (small) maps.push(small);
  const exp = window.expandedMaps?.[cid]?.expandedMap;
  if (exp) maps.push(exp);

  // Önce eski highlight'ları sil
  maps.forEach(m => {
    if (window._segmentHighlight[day]?.[m._leaflet_id]) {
      try { m.removeLayer(window._segmentHighlight[day][m._leaflet_id]); } catch(_){}
      try { delete window._segmentHighlight[day][m._leaflet_id]; } catch(_){}
    }
  });
clearScaleBarSelection(day);

  // Eğer reset (segment yok) ise haritayı ilk açılış merkez/zoom'una döndür
if (typeof startKm !== 'number' || typeof endKm !== 'number') {
  maps.forEach(m => {
    if (m && m._initialBounds) {
      try { m.fitBounds(m._initialBounds, { padding: [20, 20] }); } catch(_) {}
    } else if (m && m._initialView) {
      try { m.setView(m._initialView.center, m._initialView.zoom, { animate: true }); } catch(_) {}
    }
  });
  return;
}
  // Kümülatif mesafe
  function hv(lat1, lon1, lat2, lon2) {
    const R=6371000, toRad=x=>x*Math.PI/180;
    const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
    const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(a));
  }
  const coords = gj.features[0].geometry.coordinates;
  const cum=[0];
  for (let i=1;i<coords.length;i++){
    const [lon1,lat1]=coords[i-1], [lon2,lat2]=coords[i];
    cum[i]=cum[i-1]+hv(lat1,lon1,lat2,lon2);
  }
  const segStartM = startKm*1000, segEndM = endKm*1000;

  let iStart = 0, iEnd = coords.length - 1;
  for (let i=1;i<cum.length;i++){ if (cum[i] >= segStartM){ iStart = i; break; } }
  for (let i=cum.length-2;i>=0;i--){ if (cum[i] <= segEndM){ iEnd = i+1; break; } }
  iStart = Math.max(0, Math.min(iStart, coords.length-2));
  iEnd   = Math.max(iStart+1, Math.min(iEnd, coords.length-1));

  const sub = coords.slice(iStart, iEnd+1).map(c => [c[1], c[0]]);
  if (sub.length < 2) return;

  window._segmentHighlight[day] = window._segmentHighlight[day] || {};
  maps.forEach(m => {
    const poly = L.polyline(sub, {
      color: '#8a4af3',
      weight: 6,
      opacity: 0.95,
      dashArray: ''
    }).addTo(m);
    window._segmentHighlight[day][m._leaflet_id] = poly;
    if (poly.bringToFront) poly.bringToFront();
    // Segment seçilince mor çizgiye zoom yap
    try { m.fitBounds(poly.getBounds(), { padding: [16, 16] }); } catch(_) {}
  });
}

function drawSegmentProfile(container, day, startKm, endKm, samples, elevSmooth) {
  const svgNS = 'http://www.w3.org/2000/svg';

  window._lastSegmentDay = day;
  window._lastSegmentStartKm = startKm;
  window._lastSegmentEndKm = endKm;
  console.log('SEGMENT PROFILE SET', day, startKm, endKm);

  const track = container.querySelector('.scale-bar-track'); 
  if (!track) return;

  const selDiv = container.querySelector('.scale-bar-selection');
  if (selDiv) {
      selDiv.style.display = 'none';
      selDiv.style.width = '0px';
      selDiv.style.left = '0px';
  }

  track.querySelectorAll('svg[data-role="elev-segment"]').forEach(el => el.remove());
  track.querySelectorAll('.elev-segment-toolbar').forEach(el => el.remove());
  track.querySelectorAll('.elevation-labels-container').forEach(el => el.remove());

  const widthPx = Math.max(200, Math.round(track.getBoundingClientRect().width));
  const totalKm = Number(container.dataset.totalKm) || 0;
  const markers = (typeof getRouteMarkerPositionsOrdered === 'function')
    ? getRouteMarkerPositionsOrdered(day) : [];

  const min = Math.min(...elevSmooth);
  const max = Math.max(...elevSmooth, min + 1);
  const span = max - min;
  
  let vizMin, vizMax;
  if (span > 0) { 
      vizMin = min - span * 0.50; 
      vizMax = max + span * 1.0; 
  } else { 
      vizMin = min - 1; 
      vizMax = max + 1; 
  }

  const segmentElevData = {
      smooth: elevSmooth,
      vizMin: vizMin,
      vizMax: vizMax,
      min: min,
      max: max
  };

  if (startKm <= 0.05 && Math.abs(endKm - totalKm) < 0.05) {
    container._elevStartKm = 0;
    container._elevKmSpan  = totalKm;
    track._segmentStartPx = undefined;
    track._segmentWidthPx = undefined;
    createScaleElements(track, widthPx, totalKm, 0, markers, null);
  } else {
    container._elevStartKm = startKm;
    container._elevKmSpan  = endKm - startKm;
    createScaleElements(track, widthPx, endKm - startKm, startKm, markers, segmentElevData);

    const rect = track.getBoundingClientRect();
    const segStartPx = (startKm / totalKm) * rect.width;
    const segWidthPx = ((endKm - startKm) / totalKm) * rect.width;
    track._segmentStartPx = segStartPx;
    track._segmentWidthPx = segWidthPx;
  }

  const widthNow = widthPx || 400;
  const heightNow = 220;

  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'tt-elev-svg');
  svg.setAttribute('data-role', 'elev-segment');
  svg.setAttribute('viewBox', `0 0 ${widthNow} ${heightNow}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', String(heightNow));
  track.appendChild(svg);

  const gridG = document.createElementNS(svgNS, 'g');
  gridG.setAttribute('class','tt-elev-grid');
  svg.appendChild(gridG);

  const areaPath = document.createElementNS(svgNS, 'path');
  areaPath.setAttribute('class','tt-elev-area');
  svg.appendChild(areaPath);

  const segG = document.createElementNS(svgNS, 'g');
  segG.setAttribute('class','tt-elev-segments');
  svg.appendChild(segG);

  const X = (km) => (km / (endKm - startKm)) * widthNow;
  const Y = (e) => (isNaN(e) || vizMax === vizMin) ? (heightNow/2) : ((heightNow - 1) - ((e - vizMin) / (vizMax - vizMin)) * (heightNow - 2));

  for (let i = 0; i <= 4; i++) {
    const ev = vizMin + (i / 4) * (vizMax - vizMin);
    const y = Y(ev);
    const ln = document.createElementNS(svgNS, 'line');
    ln.setAttribute('x1', '0'); ln.setAttribute('x2', String(widthNow));
    ln.setAttribute('y1', String(y)); ln.setAttribute('y2', String(y));
    ln.setAttribute('stroke', '#d7dde2'); ln.setAttribute('stroke-dasharray', '4 4'); ln.setAttribute('opacity', '.8');
    gridG.appendChild(ln);
  }
  
  let topD = '';
  for (let i = 0; i < elevSmooth.length; i++) {
    const kmRel = (samples[i].distM / 1000) - startKm;
    const x = Math.max(0, Math.min(widthNow, X(kmRel)));
    const y = Y(elevSmooth[i]);
    topD += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
  }
  if (topD) {
    const floorY = heightNow; 
    const areaD = `${topD} L ${widthNow} ${floorY} L 0 ${floorY} Z`;
    areaPath.setAttribute('d', areaD);
    areaPath.setAttribute('fill', '#263445');
  }

  for (let i = 1; i < elevSmooth.length; i++) {
    const kmRel1 = (samples[i-1].distM / 1000) - startKm;
    const kmRel2 = (samples[i].distM / 1000) - startKm;
    const x1 = Math.max(0, Math.min(widthNow, X(kmRel1)));
    const y1 = Y(elevSmooth[i-1]);
    const x2 = Math.max(0, Math.min(widthNow, X(kmRel2)));
    const y2 = Y(elevSmooth[i]);

    const dx = samples[i].distM - samples[i-1].distM;
    const dy = elevSmooth[i] - elevSmooth[i-1];
    let slope = 0, color = '#72c100';

    if (dx !== 0) {
      slope = (dy / dx) * 100;
      color = (slope < 0) ? '#72c100' : getSlopeColor(slope);
    }

    const seg = document.createElementNS(svgNS, 'line');
    seg.setAttribute('x1', String(x1));
    seg.setAttribute('y1', String(y1));
    seg.setAttribute('x2', String(x2));
    seg.setAttribute('y2', String(y2));
    seg.setAttribute('stroke', color);
    seg.setAttribute('stroke-width', '3');
    seg.setAttribute('stroke-linecap', 'round');
    seg.setAttribute('fill', 'none');
    segG.appendChild(seg);
  }

  let up = 0, down = 0;
  for (let i = 1; i < elevSmooth.length; i++) {
    const d = elevSmooth[i] - elevSmooth[i-1];
    if (d > 1.5) up += d;
    else if (d < -1.5) down += -d;
  }
  const distKm = (endKm - startKm);
  const avgGrade = distKm > 0 ? ((elevSmooth[elevSmooth.length - 1] - elevSmooth[0]) / (distKm * 1000)) * 100 : 0;

  const tb = document.createElement('div');
  tb.className = 'elev-segment-toolbar';
  tb.style.cssText = `
   bottom: 10px; z-index: 1005; display: inline-flex; gap: 10px;
   align-items: center; border-radius: 10px; padding: 6px;
   font-size: 12px; color: rgb(0, 0, 0); right: 6px; position: absolute;
   background: rgb(255 255 255 / 43%);  
  `;
  tb.innerHTML = `
    <span class="pill" style="border:1px solid #e0e0e0;border-radius:8px;padding:2px 6px;font-weight:600;">${startKm.toFixed(1)}–${endKm.toFixed(1)} km</span>
    <span class="pill" style="border:1px solid #e0e0e0;border-radius:8px;padding:2px 6px;font-weight:600;">↑ ${Math.round(up)} m</span>
    <span class="pill" style="border:1px solid #e0e0e0;border-radius:8px;padding:2px 6px;font-weight:600;">↓ ${Math.round(down)} m</span>
    <span class="pill" style="border:1px solid #e0e0e0;border-radius:8px;padding:2px 6px;font-weight:600;">Avg %${avgGrade.toFixed(1)}</span>
    <button type="button" class="elev-segment-reset" style="appearance:none;border:1px solid #d0d7de;background:#fff;color:#333;border-radius:8px;padding:4px 8px;cursor:pointer;font-weight:600;">Reset</button>
  `;
  track.appendChild(tb);

  // --- KRİTİK DEĞİŞİKLİK: RESET BUTONUNA ÖZEL DOKUNMA YÖNETİMİ ---
  const resetBtn = tb.querySelector('.elev-segment-reset');
  if (resetBtn) {
      // Bu butona dokunulduğunda olayın Track'e (üst elemente) ulaşmasını engelle.
      // Böylece Track'in preventDefault'u çalışmaz ve Click olayı gerçekleşir.
      const stopProp = (e) => e.stopPropagation();
      resetBtn.addEventListener('touchstart', stopProp, { passive: true });
      resetBtn.addEventListener('mousedown', stopProp);

      resetBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Garanti olsun
        
        // --- RESET MANTIĞI ---
        track.querySelectorAll('svg[data-role="elev-segment"]').forEach(el => el.remove());
        track.querySelectorAll('.elev-segment-toolbar').forEach(el => el.remove());
        track.querySelectorAll('.elevation-labels-container').forEach(el => el.remove());

        if (typeof highlightSegmentOnMap === 'function') {
          highlightSegmentOnMap(day);
        }

        window._lastSegmentDay = undefined;
        window._lastSegmentStartKm = undefined;
        window._lastSegmentEndKm = undefined;

        const cid = `route-map-day${day}`;
        const expObj = window.expandedMaps && window.expandedMaps[cid];
        if (expObj && expObj.expandedMap) {
          let fitted = false;
          expObj.expandedMap.eachLayer(layer => {
            if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
              try {
                expObj.expandedMap.fitBounds(layer.getBounds(), { padding: [20, 20] });
                fitted = true;
              } catch(_) {}
            }
          });
          if (!fitted && expObj.expandedMap._initialView) {
            expObj.expandedMap.setView(
              expObj.expandedMap._initialView.center,
              expObj.expandedMap._initialView.zoom,
              { animate: true }
            );
          }
        }

        const selection = container.querySelector('.scale-bar-selection');
        if (selection) selection.style.display = 'none';

        container._elevStartKm = 0;
        container._elevKmSpan  = totalKm;

        const markers = (typeof getRouteMarkerPositionsOrdered === 'function') ? getRouteMarkerPositionsOrdered(day) : [];
        
        createScaleElements(track, widthPx, totalKm, 0, markers, null);

        if (Array.isArray(container._elevFullSamples)) {
          container._elevSamples = container._elevFullSamples.slice();
        }

        if (container._elevationDataFull && typeof container._redrawElevation === 'function') {
          container._elevationData = {
            min: container._elevationDataFull.min,
            max: container._elevationDataFull.max,
            smooth: container._elevationDataFull.smooth.slice()
          };
          container._redrawElevation(container._elevationData);
        } else {
          if (totalKm > 0 && typeof renderRouteScaleBar === 'function') {
            renderRouteScaleBar(container, totalKm, markers);
          }
        }
      });
  }

  track.removeEventListener('mousemove', track.__onMove);
  track.addEventListener('mousemove', track.__onMove);
}

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

function clearScaleBarSelection(day) {
  // Sadece ilgili gün için expanded scale bar'ı bul ve overlay'i gizle
  const sel = document.querySelector(`#expanded-route-scale-bar-day${day} .scale-bar-selection`);
  if (sel) sel.style.display = 'block';
  // Eğer her yerde tümünü kapatmak istersen:
  // document.querySelectorAll('.scale-bar-selection').forEach(s => s.style.display = 'none');
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

// Trip seçilince input-wrapper gizlensin
document.addEventListener('click', function(e) {
  if (e.target.closest('.trip-item')) {
    var iw = document.querySelector('.input-wrapper');
    if (iw) iw.style.display = 'none';
  }
});
// "trip-main-box" veya "trip-info-box" tıklanınca input-wrapper'ı gizle
document.addEventListener('click', function(e) {
  if (
    e.target.closest('.trip-main-box') ||
    e.target.closest('.trip-info-box') ||
    e.target.closest('.trip-title')
  ) {
    var iw = document.querySelector('.input-wrapper');
    if (iw) iw.style.display = 'none';
  }
});

function showLoadingPanel() {
  var loadingPanel = document.getElementById("loading-panel");
  if (loadingPanel) loadingPanel.style.display = "flex";
  document.querySelectorAll('.cw').forEach(cw => cw.style.display = "none");
}

function hideLoadingPanel() {
    var loadingPanel = document.getElementById("loading-panel");
    if (loadingPanel) loadingPanel.style.display = "none";
    if (!window.__welcomeHiddenForever) {
        document.querySelectorAll('.cw').forEach(cw => cw.style.display = "grid");
    } else {
        document.querySelectorAll('.cw').forEach(cw => cw.style.display = "none");
    }
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

function startStreamingTypewriterEffect(element, queue, speed = 5) {
  let chunkIndex = 0;
  let charIndex = 0;
  let stopped = false;
  element._typewriterStop = () => { stopped = true; };

  function type() {
    if (stopped) return;
    // Chunk queue güncellendikçe devam et
    if (chunkIndex < queue.length) {
      const chunk = queue[chunkIndex];
      if (charIndex < chunk.length) {
        element.innerHTML += chunk.charAt(charIndex);
        charIndex++;
        setTimeout(type, speed);
      } else {
        chunkIndex++;
        charIndex = 0;
        setTimeout(type, speed); // bir sonraki chunkı da hemen yaz
      }
    } else {
      // Chunk queue'ya yeni veri gelirse devam et
      setTimeout(type, speed);
    }
  }
  type();
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


