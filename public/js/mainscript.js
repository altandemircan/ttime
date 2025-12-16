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

// Kullanılan resimleri takip etmek için global set
window.__usedCollageImages = window.__usedCollageImages || new Set();

// Yeni plan yapıldığında bu hafızayı temizlemek gerekir.
// (Mevcut 'New Trip Plan' fonksiyonuna bunu eklemiş olacağız otomatikman, çünkü sayfa yenilenmese bile cart sıfırlanıyor)
function resetCollageMemory() {
    window.__usedCollageImages = new Set();
    window.__dayCollageCache = {}; // Cache'i de temizle ki yeni aramalar yapsın
}

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
// DÜZELTİLMİŞ FONKSİYON 2
function createScaleElements(track, widthPx, spanKm, startKmDom, markers = [], customElevData = null) {
  if (track && track.classList.contains('loading')) {
      track.querySelectorAll('.marker-badge').forEach(el => el.remove());
      return; 
  }

  const container = track?.parentElement;
  if ((!spanKm || spanKm < 0.01) && !customElevData) {
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
    
    if (i === 0) {
        label.style.transform = 'translateX(0%)'; 
        label.style.textAlign = 'left';
    } else if (i === majors) {
        label.style.transform = 'translateX(-100%)';
        label.style.textAlign = 'right';
    } else {
        label.style.transform = 'translateX(-50%)'; 
        label.style.textAlign = 'center';
    }

    label.style.fontSize = '11px';
    label.style.color = '#607d8b';
    label.textContent = `${(startKmDom + curKm).toFixed(spanKm > 20 ? 0 : 1)} km`;
    track.appendChild(label);
  }

  // --- MARKER POSITIONING ---
  let activeData = null;
  
  if (customElevData) {
      activeData = customElevData; 
  } else if (container && container._elevationData) {
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
      
      // Segment dışındakileri çizme
      if (dist < startKmDom - 0.05 || dist > startKmDom + spanKm + 0.05) {
          return;
      }

      const relKm = dist - startKmDom;
      let left = spanKm > 0 ? (relKm / spanKm) * 100 : 0;
      left = Math.max(0, Math.min(100, left));

      let bottomStyle = "2px"; 

      if (activeData && activeData.smooth && activeData.smooth.length > 0) {
          const { smooth, vizMin, vizMax } = activeData;
          const pct = Math.max(0, Math.min(1, left / 100));
          const sampleIdx = Math.floor(pct * (smooth.length - 1));
          const val = smooth[sampleIdx];
          
          if (typeof val === 'number') {
              const heightPct = ((val - vizMin) / (vizMax - vizMin)) * 100;
              bottomStyle = `calc(${heightPct}% - 7px)`;
          }
      }

      let transformX = '-50%';
      if (left < 1) transformX = '0%';
      else if (left > 99) transformX = '-100%';

      // --- DÜZELTME: BURADA idx DEĞİL originalIndex KULLANILIYOR ---
      const displayNum = m.originalIndex ? m.originalIndex : (idx + 1);
      // -------------------------------------------------------------

      const wrap = document.createElement('div');
      wrap.className = 'marker-badge';
      wrap.style.cssText = `position:absolute;left:${left}%;bottom:${bottomStyle};width:18px;height:18px;transform:translateX(${transformX});z-index:5;`;
      wrap.title = m.name || '';
      wrap.innerHTML = `<div style="width:18px;height:18px;border-radius:50%;background:#d32f2f;border:1px solid #fff;box-shadow:0 2px 6px #888;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;font-weight:700;">${displayNum}</div>`;
      track.appendChild(wrap);
    });
  }

  // --- Grid Labels ---
  let gridLabels = [];
  if (customElevData) {
      const { vizMin, vizMax } = customElevData;
      for(let i=0; i<=4; i++) {
          const val = vizMin + (i/4)*(vizMax - vizMin);
          const pct = (i/4) * 100; 
          gridLabels.push({ value: Math.round(val) + ' m', pct: pct });
      }
  } else {
      const svg = track.querySelector('svg.tt-elev-svg');
      if (svg) {
        gridLabels = Array.from(svg.querySelectorAll('text'))
          .map(t => ({
            value: t.textContent.trim(),
            y: Number(t.getAttribute('y')),
            svgHeight: Number(svg.getAttribute('height')) || 180
          }))
          .filter(obj => /-?\d+\s*m$/.test(obj.value));
      }
  }

  const elevationLabels = document.createElement('div');
  elevationLabels.className = 'elevation-labels-container';

  gridLabels.forEach((obj, index) => { 
    let topStyle = '';
    if (typeof obj.pct !== 'undefined') {
        topStyle = `top: ${100 - obj.pct}%; transform: translateY(-50%);`;
    } else {
        const trackHeight = track.clientHeight || 180;
        const correctedY = (obj.y / obj.svgHeight) * trackHeight;
        topStyle = `top: ${correctedY}px;`;
    }

    const wrapper = document.createElement('div');
    wrapper.style.cssText = `position: absolute; right: 0; ${topStyle}`;

     const tick = document.createElement('div');
    tick.style.cssText = `width: 35px; border-bottom: 1px dashed #cfd8dc; opacity: 0.7; display: block; margin-left: 0px; margin-top: 0px;`;

    const label = document.createElement('div');
    label.className = 'elevation-label';
    label.style.cssText = `font-size: 10px; color: #607d8b; background: none; line-height: 1.5; text-align: right; padding-right: 0px; white-space: nowrap;`;
    label.textContent = obj.value;

    if (index === 0) label.style.display = 'none';

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
// Temaya tıklayınca sadece öneri paneli dolsun, hiçbirini otomatik seçme!
document.querySelectorAll('.gallery-item').forEach(item => {
  item.addEventListener('click', async function() {
    
    // --- 1. MEVCUT GEZİYİ KAYDET VE SIFIRLA (RESET LOGIC) ---
    // Eğer halihazırda açık bir gezi varsa, önce onu kaydet
    if (window.cart && window.cart.length > 0 && typeof saveCurrentTripToStorage === "function") {
        saveCurrentTripToStorage();
    }

    // Global değişkenleri sıfırla (Yeni gezi için temiz sayfa)
    window.cart = [];
    window.latestTripPlan = [];
    window.selectedCity = null;
    window.selectedLocation = null;
    window.selectedLocationLocked = false;
    window.activeTripKey = null; // KRİTİK: Eski gezi ID'sini kopar, yeni ID oluşturacak.
    window.lastUserQuery = "";
    
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
// .add_theme için aynı mantık
document.querySelectorAll('.add_theme').forEach(btn => {
  btn.addEventListener('click', async function(e) {
    e.stopPropagation();

    // --- 1. MEVCUT GEZİYİ KAYDET VE SIFIRLA (RESET LOGIC) ---
    if (window.cart && window.cart.length > 0 && typeof saveCurrentTripToStorage === "function") {
        saveCurrentTripToStorage();
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

        // Buton animasyonu
        btn.classList.add('added');
        setTimeout(() => btn.classList.remove('added'), 1000);

        if (typeof restoreSidebar === "function") restoreSidebar();
        if (typeof updateCart === "function") updateCart();

        // --- YENİ EKLENEN KISIM: MOBİLDE SIDEBAR'I AÇ ---
        if (window.innerWidth <= 768) {
            // CSS yapınıza göre sidebar class'larını kontrol edip açıyoruz
            const sidebarTrip = document.querySelector('.sidebar-trip');
            const sidebarOverlay = document.querySelector('.sidebar-overlay.sidebar-trip');

            if (sidebarTrip) sidebarTrip.classList.add('open');
            if (sidebarOverlay) sidebarOverlay.classList.add('open');
        }
        // -----------------------------------------------
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
  // [FIX] Yükleme sırasında gri ekran yerine harita zemin rengi
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

const map = L.map(containerId, {
    center: startCenter,
    zoom: startZoom,
    scrollWheelZoom: true,
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

  // --- [FIX] OSM YERİNE OPENFREEMAP ---
  const openFreeMapStyle = 'https://tiles.openfreemap.org/styles/bright';
  if (typeof L.maplibreGL === 'function') {
      L.maplibreGL({
          style: openFreeMapStyle,
          attribution: '&copy; <a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> contributors',
          interactive: true
      }).addTo(map);
  } else {
      // Sadece kütüphane yüklenemediyse OSM fallback
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);
  }
  // ------------------------------------
  
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
window.insertTripAiInfo = async function(onFirstToken, aiStaticInfo = null, cityOverride = null) {
    // 1. Önce eski kutuları temizle
    document.querySelectorAll('.ai-info-section').forEach(el => el.remove());
    
    const tripTitleDiv = document.getElementById('trip_title');
    if (!tripTitleDiv) return;

    // Şehir bilgisini al
    let city = cityOverride || (window.selectedCity || '').replace(/ trip plan.*$/i, '').trim();
    let country = (window.selectedLocation && window.selectedLocation.country) || "";
    
    // Şehir yoksa ve statik veri de yoksa çık
    if (!city && !aiStaticInfo) return;

    // --- TEMİZLEME FONKSİYONU (Robot ikonunu siler) ---
    function cleanText(text) {
        if (!text) return "";
        // 🤖 ikonunu ve gereksiz boşlukları temizle
        return text.replace(/🤖/g, '').replace(/AI:/g, '').trim();
    }

    // HTML İskeleti
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

    const aiSummary = aiDiv.querySelector('#ai-summary');
    const aiTip = aiDiv.querySelector('#ai-tip');
    const aiHighlight = aiDiv.querySelector('#ai-highlight');
    const aiTime = aiDiv.querySelector('.ai-info-time');
    const aiSpinner = aiDiv.querySelector('#ai-spinner');
    const aiContent = aiDiv.querySelector('.ai-info-content');
    
    // İçerik Gösterme Yardımcısı
    function populateAndShow(data, timeElapsed = null) {
        if (aiSpinner) aiSpinner.style.display = "none";
        
        // Aç/Kapa butonu ekle (yoksa)
        const header = aiDiv.querySelector('#ai-toggle-header');
        if (!header.querySelector('#ai-toggle-btn')) {
            const btn = document.createElement('button');
            btn.id = "ai-toggle-btn";
            btn.className = "arrow-btn";
            btn.style = "border:none;background:transparent;font-size:18px;cursor:pointer;padding:0 10px;";
            btn.innerHTML = `<img src="https://www.svgrepo.com/show/520912/right-arrow.svg" class="arrow-icon open" style="width:18px;vertical-align:middle;transition:transform 0.2s;">`;
            header.appendChild(btn);

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
        aiContent.style.opacity = "1";

        // --- ROBOT İKONU TEMİZLİĞİ BURADA YAPILIYOR ---
        const txtSummary = cleanText(data.summary) || "Info not available.";
        const txtTip = cleanText(data.tip) || "Info not available.";
        const txtHighlight = cleanText(data.highlight) || "Info not available.";

        if (typeof typeWriterEffect === 'function' && !aiStaticInfo) {
             typeWriterEffect(aiSummary, txtSummary, 18, function() {
                typeWriterEffect(aiTip, txtTip, 18, function() {
                    typeWriterEffect(aiHighlight, txtHighlight, 18);
                });
            });
        } else {
            aiSummary.textContent = txtSummary;
            aiTip.textContent = txtTip;
            aiHighlight.textContent = txtHighlight;
        }

        if (timeElapsed) {
            aiTime.textContent = `⏱️ Generated in ${timeElapsed} ms`;
        } else {
            aiTime.textContent = "";
        }
    }

    // === SENARYO 1: KAYITLI VERİ VAR ===
    if (aiStaticInfo) {
        populateAndShow(aiStaticInfo);
        return;
    }

    // === SENARYO 2: API'YE GİT ===
    let t0 = performance.now();
    try {
        const resp = await fetch('/llm-proxy/plan-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ city, country })
        });

        const ollamaData = await resp.json();
        let elapsed = Math.round(performance.now() - t0);

        // Veriyi alırken temizlemiyoruz, ekrana basarken cleanText ile temizliyoruz.
        const aiData = {
            city: city,
            summary: ollamaData.summary,
            tip: ollamaData.tip,
            highlight: ollamaData.highlight,
            time: elapsed
        };

        // Kaydet
        window.cart.aiData = aiData; 
        window.lastTripAIInfo = aiData;
        
        if (typeof saveCurrentTripToStorage === "function") {
            saveCurrentTripToStorage();
        }

        populateAndShow(aiData, elapsed);

    } catch (e) {
        console.error("AI Error:", e);
        if (aiTime) aiTime.innerHTML = "<span style='color:red'>AI info could not be retrieved.</span>";
        if (aiSpinner) aiSpinner.style.display = "none";
        aiContent.style.maxHeight = "1200px";
        aiContent.style.opacity = "1";
        aiSummary.textContent = "AI service temporarily unavailable.";
    }
};

function createLeafletMapForItem(mapId, lat, lon, name, number, day) {
    window._leafletMaps = window._leafletMaps || {};
    
    // Eski harita varsa temizle
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

    // --- DEĞİŞİKLİK BURADA: OpenFreeMap Kullanımı ---
    const openFreeMapStyle = 'https://tiles.openfreemap.org/styles/bright';

    if (typeof L.maplibreGL === 'function') {
        // MapLibreGL (Vektör) kullan
        L.maplibreGL({
            style: openFreeMapStyle,
            attribution: '&copy; <a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> contributors',
            interactive: true
        }).addTo(map);
    } else {
        // Eğer kütüphane yüklenmediyse OSM Fallback
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
    }
    // ------------------------------------------------

    // ARTIK day VAR!
    if (typeof getDayPoints === "function" && typeof day !== "undefined") {
        const pts = getDayPoints(day).filter(
            p => typeof p.lat === "number" && typeof p.lng === "number" && !isNaN(p.lat) && !isNaN(p.lng)
        );
        // Eğer sadece 1 nokta varsa o noktaya odaklan
        if (pts.length === 1) {
            map.setView([pts[0].lat, pts[0].lng], 14);
        }
    }

    // Marker
    const icon = L.divIcon({
        html: getPurpleRestaurantMarkerHtml(), // Bu fonksiyonun tanımlı olduğundan emin olun, yoksa standart icon kullanın
        className: "",
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });
    
    // Eğer getPurpleRestaurantMarkerHtml yoksa fallback için basit bir HTML string:
    const fallbackHtml = `<div class="custom-marker-outer red" style="transform: scale(0.7);"><span class="custom-marker-label">${number}</span></div>`;
    const finalIcon = typeof getPurpleRestaurantMarkerHtml === 'function' ? icon : L.divIcon({ html: fallbackHtml, className: "", iconSize:[32,32], iconAnchor:[16,16] });

    L.marker([lat, lon], { icon: finalIcon }).addTo(map).bindPopup(name || '').openPopup();

    map.zoomControl.setPosition('topright');
    window._leafletMaps[mapId] = map;
    
    // Harita boyutunu düzelt (render hatasını önler)
    setTimeout(function() { map.invalidateSize(); }, 120);
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
    
    // Eski scale barları temizle
    document.querySelectorAll('.route-scale-bar[id^="route-scale-bar-day"]').forEach(el => el.remove());

    if (window.expandedMaps) {
        days.forEach(day => {
            if (typeof clearRouteSegmentHighlight === 'function') clearRouteSegmentHighlight(day);
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
    
    // Cart temizliği
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

    // --- CART BOŞ İSE ---
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
                  <div><button id="start-map-btn" type="button">Start with map</button></div>
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
        // Buton eventleri
        const addNewDayButton = document.getElementById("add-new-day-button");
        if (addNewDayButton && typeof addNewDay === 'function') addNewDayButton.onclick = function () { addNewDay(this); };
        
        // GPS import butonu (varsa)
        const gpsBtn = document.querySelector(".gps-import");
        if (gpsBtn && typeof handleGpsImport === 'function') gpsBtn.onclick = function () { handleGpsImport(); };

        return;
    }

    // --- CART DOLU İSE ---
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
        if (typeof createDayActionMenu === 'function') dayHeader.appendChild(createDayActionMenu(day));
        dayContainer.appendChild(dayHeader);

        const confirmationContainer = document.createElement("div");
        confirmationContainer.className = "confirmation-container";
        confirmationContainer.id = `confirmation-container-${day}`;
        confirmationContainer.style.display = "none";
        dayContainer.appendChild(confirmationContainer);

        const dayList = document.createElement("ul");
        dayList.className = "day-list";
        dayList.dataset.day = day;

        // Rota Hazırlıkları
        const containerId = `route-map-day${day}`;
        const pairwiseSummaries = window.pairwiseRouteSummaries?.[containerId] || [];
        
        // Travel Mode Al
        const travelMode = typeof getTravelModeForDay === "function" 
            ? String(getTravelModeForDay(day)).trim().toLowerCase() 
            : "car";

        // --- ITEM LOOP ---
        for (let idx = 0; idx < dayItemsArr.length; idx++) {
            const item = dayItemsArr[idx];
            const currIdx = window.cart.indexOf(item);

            const li = document.createElement("li");
            li.className = "travel-item";
            
            li.dataset.index = currIdx;
            if (item.location && typeof item.location.lat === "number" && typeof item.location.lng === "number") {
                li.setAttribute("data-lat", item.location.lat);
                li.setAttribute("data-lon", item.location.lng);
            }

            // Marker HTML
            const listMarkerHtml = `
                <div class="custom-marker-outer red" style="flex-shrink: 0; transform: scale(0.70); position: absolute; left: 30px; top: 0px;">
                    <span class="custom-marker-label" style="font-size: 14px;">${idx + 1}</span>
                </div>
            `;

            if (item.category === "Note") {
                // ... Note HTML ...
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
                          <p>${item.noteDetails ? (typeof escapeHtml === 'function' ? escapeHtml(item.noteDetails) : item.noteDetails) : ""}</p>
                          </div>
                      </div>
                      </div>
                  </div>
                `;
            } else {
                // ... Place HTML ...
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

                // Kategori ikonu (Fallback logic)
                let catIcon = 'https://www.svgrepo.com/show/522166/location.svg';
                if (window.categoryIcons && window.categoryIcons[item.category]) {
                    catIcon = window.categoryIcons[item.category];
                }

                li.innerHTML = `
                  <div class="cart-item">
                    <div style="display: flex; align-items: center; justify-content: space-between; width: 100%">
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="https://www.svgrepo.com/show/458813/move-1.svg" alt="Drag" class="drag-icon">
                        <div class="item-position">${listMarkerHtml}                
                          <img src="${item.image}" alt="${item.name}" class="cart-image">
                        </div>
                        <img src="${catIcon}" alt="${item.category}" class="category-icon">
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
                          <img class="fav-icon" src="${(typeof isTripFav === 'function' && isTripFav(item)) ? '/img/like_on.svg' : '/img/like_off.svg'}" alt="Favorite" style="width:18px;height:18px;">
                        </span>
                        <span class="fav-btn-text">${(typeof isTripFav === 'function' && isTripFav(item)) ? "Remove from My Places" : "Add to My Places"}</span>
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

            // --- SEPARATOR (Mesafe/Süre) ---
            const nextItem = dayItemsArr[idx + 1];
            const hasNextLoc =
                item.location &&
                typeof item.location.lat === "number" &&
                typeof item.location.lng === "number" &&
                nextItem &&
                nextItem.location &&
                typeof nextItem.location.lat === "number" &&
                typeof nextItem.location.lng === "number";

            if (hasNextLoc) {
                let distanceStr = '';
                let durationStr = '';
                let prefix = '';

                const isInTurkey = typeof areAllPointsInTurkey === 'function' 
                    ? areAllPointsInTurkey([item.location, nextItem.location]) 
                    : false;

                if (!isInTurkey) {
                    // Yurt dışı (Haversine)
                    const ptA = item.location;
                    const ptB = nextItem.location;
                    const distM = typeof haversine === 'function' ? haversine(ptA.lat, ptA.lng, ptB.lat, ptB.lng) : 0;
                    const durSec = Math.round((distM / 1000) / 4 * 3600);
                    distanceStr = distM >= 1000 ? (distM / 1000).toFixed(2) + " km" : Math.round(distM) + " m";
                    durationStr = durSec >= 60 ? Math.round(durSec / 60) + " min" : Math.round(durSec) + " sec";
                    prefix = `<span class="auto-generated-label" style="font-size:12px;margin-right:5px;">Auto generated</span>`;
                } else {
                    // Türkiye (OSRM Summary)
                    const summary = pairwiseSummaries[idx];
                    if (summary && typeof summary.distance === "number" && typeof summary.duration === "number") {
                        distanceStr = summary.distance >= 1000
                            ? (summary.distance / 1000).toFixed(2) + " km"
                            : Math.round(summary.distance) + " m";
                        durationStr = summary.duration >= 60
                            ? Math.round(summary.duration / 60) + " min"
                            : Math.round(summary.duration) + " sec";
                    } else {
                        // Fallback Haversine
                        const ptA = item.location;
                        const ptB = nextItem.location;
                        const distM = typeof haversine === 'function' ? haversine(ptA.lat, ptA.lng, ptB.lat, ptB.lng) : 0;
                        const durSec = Math.round((distM / 1000) / 4 * 3600);
                        distanceStr = distM >= 1000 ? (distM / 1000).toFixed(2) + " km" : Math.round(distM) + " m";
                        durationStr = durSec >= 60 ? Math.round(durSec / 60) + " min" : Math.round(durSec) + " sec";
                    }
                }

                // İkon Seçimi
                if (travelMode === "driving" || travelMode === "car") {
                    prefix = `<img src="https://dev.triptime.ai/img/way_car.svg" alt="Car">`;
                } else if (travelMode === "bike" || travelMode === "cycling") {
                    prefix = `<img src="https://dev.triptime.ai/img/way_bike.svg" alt="Bike">`;
                } else if (travelMode === "walk" || travelMode === "walking") {
                    prefix = `<img src="https://dev.triptime.ai/img/way_walk.svg" alt="Walk">`;
                } else {
                    prefix = '';
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
        } // Loop bitişi

        dayContainer.appendChild(dayList);

        // --- HARİTA & KONTROLLER ---
        if (typeof ensureDayMapContainer === 'function') ensureDayMapContainer(day);
        if (typeof initEmptyDayMap === 'function') initEmptyDayMap(day);

        // [YENİ] Fotoğraf Kolajını Render Et
        if (window.renderDayCollage) {
            await window.renderDayCollage(day, dayContainer, dayItemsArr);
        }

        if (typeof wrapRouteControls === 'function') wrapRouteControls(day);
        setTimeout(() => { if (typeof wrapRouteControls === 'function') wrapRouteControls(day); }, 0);

        // Add Category Butonu
        const anyDayHasRealItem = window.cart.some(i => !i._starter && !i._placeholder && i.category !== "Note" && i.name);
        const hideAddCat = window.__hideAddCatBtnByDay && window.__hideAddCatBtnByDay[day];

        if (anyDayHasRealItem && !hideAddCat) {
            const addMoreButton = document.createElement("button");
            addMoreButton.className = "add-more-btn";
            addMoreButton.textContent = "+ Add Category";
            addMoreButton.dataset.day = day;
            addMoreButton.onclick = function () {
                const cDiv = document.getElementById("cart-items");
                if (cDiv) cDiv.innerHTML = "";
                if (typeof showCategoryList === 'function') showCategoryList(this.dataset.day);
            };
            dayList.appendChild(addMoreButton);
        }

        cartDiv.appendChild(dayContainer);
    } // Gün döngüsü bitişi

    // --- EN ALT KISIM (Add New Day vb.) ---
    const addNewDayHr = document.createElement('hr');
    addNewDayHr.className = 'add-new-day-separator';
    cartDiv.appendChild(addNewDayHr);

    const addNewDayButton = document.createElement("button");
    addNewDayButton.className = "add-new-day-btn";
    addNewDayButton.id = "add-new-day-button";
    addNewDayButton.textContent = "+ Add New Day";
    if (typeof addNewDay === 'function') addNewDayButton.onclick = function () { addNewDay(this); };
    cartDiv.appendChild(addNewDayButton);

    // Diğer son işlemler
    const itemCount = window.cart.filter(i => i.name && !i._starter && !i._placeholder).length;
    if (menuCount) {
        menuCount.textContent = itemCount;
        menuCount.style.display = itemCount > 0 ? "inline-block" : "none";
    }

    days.forEach(d => { if(typeof initPlaceSearch === 'function') initPlaceSearch(d); });
    if(typeof addCoordinatesToContent === 'function') addCoordinatesToContent();
    
    days.forEach(d => {
        const suppressing = window.__suppressMiniUntilFirstPoint && window.__suppressMiniUntilFirstPoint[d];
        const realPoints = typeof getDayPoints === 'function' ? getDayPoints(d) : [];
        if (suppressing && realPoints.length === 0) return;
        
        renderRouteForDay(d); // Yeniden render
    });

    setTimeout(() => { if(typeof wrapRouteControlsForAllDays === 'function') wrapRouteControlsForAllDays(); }, 0);

    if (window.expandedMaps) {
        Object.values(window.expandedMaps).forEach(({ expandedMap, day }) => {
            if (expandedMap && typeof updateExpandedMap === 'function') updateExpandedMap(expandedMap, day);
        });
    }

    if (typeof interact !== 'undefined' && typeof setupMobileDragDrop === 'function') setupMobileDragDrop();
    if (typeof setupSidebarAccordion === 'function') setupSidebarAccordion();
    if (typeof renderTravelModeControlsForAllDays === 'function') renderTravelModeControlsForAllDays();

    // Select Dates Butonu
    (function ensureSelectDatesButton() {
        const hasRealItem = Array.isArray(window.cart) && window.cart.some(i => !i._starter && !i._placeholder && i.name && i.name.trim() !== '');
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

    // New Trip Plan Butonu (Cart içinde)
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
                // Temizlik
                const chatBox = document.getElementById('chat-box');
                if (chatBox) chatBox.innerHTML = '';
                const userInput = document.getElementById('user-input');
                if (userInput) userInput.value = '';

                window.selectedCity = null;
                window.selectedLocation = null;
                window.selectedLocationLocked = false;
                window.__locationPickedFromSuggestions = false;
                window.lastUserQuery = '';
                window.latestTripPlan = [];
                window.cart = [];
                
                // [YENİ] Fotoğraf hafızasını temizle
                if (window.__usedCollageImages) window.__usedCollageImages.clear();
                window.__dayCollageCache = {};

                if (typeof closeAllExpandedMapsAndReset === "function") closeAllExpandedMapsAndReset();
                window.routeElevStatsByDay = {};
                window.__ttElevDayCache = {};
                window._segmentHighlight = {};
                window._lastSegmentDay = undefined;
                window._lastSegmentStartKm = undefined;
                window._lastSegmentEndKm = undefined;

                document.querySelectorAll('.expanded-map-container, .route-scale-bar, .tt-elev-svg, .elev-segment-toolbar, .custom-nearby-popup').forEach(el => el.remove());

                updateCart(); // Recursive call (Cart boşalınca start ekranına döner)
                
                document.querySelectorAll('.sidebar-overlay').forEach(el => el.classList.remove('open'));
                const sidebar = document.querySelector('.sidebar-overlay.sidebar-gallery');
                if (sidebar) sidebar.classList.add('open');

                if (chatBox) {
                    // Welcome mesajı...
                    // ... (Mevcut welcome mesaj kodları)
                }
                const iw = document.querySelector('.input-wrapper');
                if (iw) iw.style.display = '';
                document.querySelectorAll('.category-area-option.selected-suggestion').forEach(el => el.classList.remove('selected-suggestion'));
                const tripDetailsSection = document.getElementById("tt-trip-details");
                if (tripDetailsSection) tripDetailsSection.remove();
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
        const iCount = window.cart.filter(i => i.name && !i._starter && !i._placeholder).length;
        newChat.style.display = iCount > 0 ? 'block' : 'none';
    })();

    // PDF Butonu
    (function ensurePdfButtonAndOrder() {
        const cartRoot = document.getElementById('cart');
        if (!cartRoot) return;
        let pdfBtn = document.getElementById('tt-pdf-dl-btn');
        if (!pdfBtn) {
            pdfBtn = document.createElement('button');
            pdfBtn.id = 'tt-pdf-dl-btn';
            pdfBtn.className = 'add-to-calendar-btn';
            pdfBtn.textContent = 'Download Offline Plan (PDF)';
            pdfBtn.style.backgroundColor = '#c05c9e';
            pdfBtn.style.color = '#fff';
            pdfBtn.onclick = function() {
                if (typeof saveCurrentTripToStorage === "function") saveCurrentTripToStorage();
                if (typeof downloadTripPlanPDF === "function") {
                    const key = window.activeTripKey || 'current_draft'; 
                    downloadTripPlanPDF(key);
                } else { alert("PDF module not ready."); }
            };
        }
        const hReal = window.cart && window.cart.some(i => i.name && !i._starter && !i._placeholder);
        pdfBtn.style.display = hReal ? 'block' : 'none';

        const datesBtn = cartRoot.querySelector('.add-to-calendar-btn[data-role="trip-dates"]');
        const newChatBtn = document.getElementById('newchat');

        if (datesBtn && pdfBtn) {
            datesBtn.insertAdjacentElement('afterend', pdfBtn);
        } else if (newChatBtn && pdfBtn && pdfBtn.parentNode !== cartRoot) {
            cartRoot.insertBefore(pdfBtn, newChatBtn);
        }
        if (pdfBtn && newChatBtn && document.body.contains(pdfBtn)) {
            pdfBtn.insertAdjacentElement('afterend', newChatBtn);
        }
    })();

    // Post Date & Trip Details
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
        const endDate = (window.cart.endDates && window.cart.endDates.length) ? window.cart.endDates[window.cart.endDates.length - 1] : window.cart.startDate;
        dateRangeDiv.innerHTML = `
            <span class="date-info">📅 Dates: ${window.cart.startDate} - ${endDate}</span>
            <button type="button" class="see-details-btn" data-role="trip-details-btn">🧐 Trip Details</button>
        `;
        const detailsBtn = dateRangeDiv.querySelector('[data-role="trip-details-btn"]');
        if (detailsBtn) {
            detailsBtn.onclick = () => {
                if (typeof showTripDetails === 'function') showTripDetails(window.cart.startDate);
            };
        }
    })();

    // Auto AI (Start with Map)
    (function autoGenerateAiInfo() {
        if (document.querySelector('.ai-info-section')) return;
        if (!window.cart || window.cart.length === 0) return;
        const first = window.cart.find(it => it.location && typeof it.location.lat === "number" && !it._starter && !it._placeholder);
        if (!first) return;

        let city = window.selectedCity;
        if (!city && first.address) {
            const parts = first.address.split(",");
            if (parts.length >= 2) {
                const rawCity = parts[parts.length - 2].trim();
                city = rawCity.replace(/^\d+\s*-?\s*/, ''); 
            } else {
                city = parts[0].trim();
            }
        }

        if (city) {
            if (!window.selectedCity || window.lastUserQuery === "Trip Plan") {
                window.selectedCity = city;
                window.lastUserQuery = "Trip to " + city;
                const tEl = document.getElementById("trip_title");
                if (tEl) tEl.textContent = window.lastUserQuery;
            }
            console.log("📍 Start with Map: Otomatik AI tetikleniyor ->", city);
            if (typeof insertTripAiInfo === "function") insertTripAiInfo(false, null, city);
        }
    })();

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
    
    // --- KÜÇÜK HARİTA İLE BİREBİR EŞİTLEME ---
    // drawCurvedLine fonksiyonundaki oranın aynısı:
    const thetaOffset = (Math.PI / 10); 
    // -----------------------------------------
    
    const r2 = (r / 2.0) / Math.cos(thetaOffset);
    const theta2 = theta + thetaOffset;
    
    const controlX = (r2 * Math.cos(theta2)) + lon1;
    const controlY = (r2 * Math.sin(theta2)) + lat1;
    
    const coords = [];
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
    // 1. Mevcut en yüksek gün sayısını bul
    let maxDay = 1;
    if (Array.isArray(window.cart) && window.cart.length > 0) {
        window.cart.forEach(item => {
            if (typeof item.day === "number" && item.day > maxDay) {
                maxDay = item.day;
            }
        });
    }

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

    // 4. HARİTA ODAKLAMA DÜZELTMESİ (Konya Sorunu Çözümü)
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

            // D) GARANTİ ODAKLAMA: Harita objesini bul ve manuel setView yap
            setTimeout(() => {
                const mapInstance = window.leafletMaps && window.leafletMaps[mapId];
                if (mapInstance && lastMarkerOfPrevDay.location) {
                    // Leaflet'in "invalidateSize" fonksiyonu, harita boyutu değişimini algılar
                    mapInstance.invalidateSize(); 
                    
                    // Doğrudan Konya koordinatına uçur
                    mapInstance.setView(
                        [lastMarkerOfPrevDay.location.lat, lastMarkerOfPrevDay.location.lng], 
                        14, 
                        { animate: false }
                    );
                }
            }, 150); // renderRouteForDay çalıştıktan hemen sonra

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
        scrollWheelZoom: true,
        // Akışkan Zoom Ayarları
        fadeAnimation: true,
        zoomAnimation: true,
        markerZoomAnimation: true,
        inertia: true,
        zoomSnap: 0,             
        zoomDelta: 0.1,
        wheelPxPerZoomLevel: 60, 
        wheelDebounceTime: 20,
        touchZoom: true,
        bounceAtZoomLimits: false
    });

    try {
        map.createPane('customRoutePane');
        map.getPane('customRoutePane').style.zIndex = 450;
    } catch (e) {}

  // --- TILE LAYER YÖNETİMİ (FİNAL DÜZELTME) ---
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
                attribution: '&copy; <a href="https://openfreemap.org" target="_blank">OpenFreeMap</a>',
                interactive: true
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
        L.marker([points[0].lat, points[0].lng], {
            icon: L.divIcon({
                html: `<div style="background:#d32f2f;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;border:2px solid #fff;box-shadow: 0 2px 8px rgba(0,0,0,0.2);">1</div>`,
                className: "",
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            })
        }).addTo(map).bindPopup(points[0].name || "Point");
    } else if (points.length >= 1) {
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
            if (missingPoints && missingPoints.length > 0) {
                missingPoints.forEach(mp => {
                    let minDist = Infinity;
                    let closestPoint = null;
                    
                    for (const rc of routeCoords) {
                        const d = Math.pow(rc[0] - mp.lat, 2) + Math.pow(rc[1] - mp.lng, 2);
                        if (d < minDist) {
                            minDist = d;
                            closestPoint = rc;
                        }
                    }

                    if (closestPoint) {
                        L.polyline([
                            [mp.lat, mp.lng], 
                            closestPoint
                        ], {
                            color: '#d32f2f', 
                            weight: 3,
                            opacity: 0.7,
                            dashArray: '5, 8',
                            pane: 'customRoutePane'
                        }).addTo(map);
                    }
                });
            }
            // -----------------------------------------------

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

        addNumberedMarkers(map, points);

        if (!bounds.isValid() && points.length > 0) {
            points.forEach(p => bounds.extend([p.lat, p.lng]));
        }
    } else {
        map.setView([0, 0], 2, { animate: false });
    }

    wrapRouteControls(day);
    map.zoomControl.setPosition('topright');
    window.leafletMaps[containerId] = map;

    // --- GÜVENLİ ODAKLAMA ---
    const refitMap = () => {
        if (!map || !sidebarContainer) return;
        if (sidebarContainer.offsetParent === null) return;

        try {
            map.invalidateSize();
            if (points.length === 1) {
                map.setView([points[0].lat, points[0].lng], 14, { animate: false });
            } else if (bounds && bounds.isValid()) {
                map.fitBounds(bounds, { padding: [20, 20], animate: false });
            }
        } catch (err) {}
    };

    requestAnimationFrame(refitMap);
    setTimeout(refitMap, 250);

    const ro = new ResizeObserver(() => { requestAnimationFrame(refitMap); });
    ro.observe(sidebarContainer);
    sidebarContainer._resizeObserver = ro;

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

// === SCALE BAR DRAG GLOBAL HANDLERLARI (DEBUG MODU) ===
function setupScaleBarInteraction(day, map) {
    const scaleBar = document.getElementById(`expanded-route-scale-bar-day${day}`);
    
    // Güvenlik kontrolleri
    if (!scaleBar || !map) return;

    // --- 1. Rota Verisini (Geometriyi) Al ---
    function getRouteGeometry() {
        const containerId = `route-map-day${day}`;
        let coordinates = [];
        let source = "none";

        // A) ÖNCELİK 1: Fly Mode Kavisli Yol (Curved Arc)
        if (window._curvedArcPointsByDay && window._curvedArcPointsByDay[day] && window._curvedArcPointsByDay[day].length > 0) {
             const arcPts = window._curvedArcPointsByDay[day];
             // Veri [Lng, Lat] gelebilir, kontrol edip [Lat, Lng] yapıyoruz
             coordinates = arcPts.map(p => [p[1], p[0]]); 
             source = "fly_arc";
        }

        // B) ÖNCELİK 2: OSRM/VPS Detaylı Rota (GeoJSON)
        if (coordinates.length === 0) {
            const geojson = window.lastRouteGeojsons && window.lastRouteGeojsons[containerId];
            if (geojson && geojson.features && geojson.features[0]?.geometry?.coordinates) {
                const coords = geojson.features[0].geometry.coordinates;
                if (coords.length > 2) {
                    coordinates = coords.map(c => [c[1], c[0]]); // [Lat, Lng]
                    source = "geojson";
                }
            }
        }

        // C) ÖNCELİK 3: Sepet (Cart) Düz Çizgi
        if (coordinates.length === 0 && window.cart) {
            const rawPts = window.cart
                .filter(i => i.day == day && i.location && !isNaN(i.location.lat))
                .map(i => [i.location.lat, i.location.lng]);
            if (rawPts.length > 1) {
                coordinates = rawPts;
                source = "straight";
            }
        }

        return { coordinates, source };
    }

    // --- 2. Mesafe Cache'i Oluştur ---
    function buildGeomCache() {
        const { coordinates, source } = getRouteGeometry();
        if (!coordinates || coordinates.length < 2) return null;

        let totalDist = 0;
        const distIndex = [0]; // Kümülatif mesafeler

        for (let i = 1; i < coordinates.length; i++) {
            const prev = coordinates[i - 1];
            const curr = coordinates[i];
            const d = haversine(prev[0], prev[1], curr[0], curr[1]);
            totalDist += d;
            distIndex.push(totalDist);
        }

        return {
            coords: coordinates,
            dists: distIndex,
            totalLen: totalDist,
            source: source // Kaynağı da sakla
        };
    }

    scaleBar._routeCache = null;
    
    // --- 3. Marker Oluşturma/Güncelleme ---
    const updateMarkerPosition = (lat, lng) => {
        const is3DMode = document.getElementById('maplibre-3d-view') && 
                         document.getElementById('maplibre-3d-view').style.display !== 'none';
        
        if (is3DMode && window._maplibre3DInstance) {
            if (!window._hoverMarker3D) {
                const el = document.createElement('div');
                el.className = 'hover-marker-3d';
                el.style.cssText = 'background: #8a4af3; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(138, 74, 243, 0.8); pointer-events: none;';
                window._hoverMarker3D = new maplibregl.Marker({ element: el })
                    .setLngLat([lng, lat])
                    .addTo(window._maplibre3DInstance);
            } else {
                window._hoverMarker3D.setLngLat([lng, lat]);
            }
        } else {
            let marker = window._hoverMarkersByDay ? window._hoverMarkersByDay[day] : null;
            if (!marker || !map.hasLayer(marker)) {
                const iconHtml = `<div style="background:#8a4af3;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>`;
                const icon = L.divIcon({ 
                    className: 'tt-hover-marker-icon', 
                    html: iconHtml, 
                    iconSize: [18, 18], 
                    iconAnchor: [9, 9] 
                });
                marker = L.marker([lat, lng], { 
                    icon: icon, 
                    zIndexOffset: 9999, 
                    interactive: false 
                }).addTo(map);
                window._hoverMarkersByDay = window._hoverMarkersByDay || {};
                window._hoverMarkersByDay[day] = marker;
            }
            marker.setLatLng([lat, lng]);
        }
    };

    // --- 4. Mouse Event Handler ---
    const handleMove = (e) => {
        if (!scaleBar._routeCache) {
            scaleBar._routeCache = buildGeomCache();
        }
        const cache = scaleBar._routeCache;
        if (!cache) return;

        const rect = scaleBar.getBoundingClientRect();
        const clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
        
        let percent = (clientX - rect.left) / rect.width;
        percent = Math.max(0, Math.min(1, percent));

        let targetMetre = 0;

        // === [FIX] ORAN HESABI (FLY MODE SENKRONİZASYONU) ===
        // Geometri uzunluğu (Eğri) / Özet uzunluğu (Düz)
        let geometryRatio = 1.0;
        const containerId = `route-map-day${day}`;
        const summary = window.lastRouteSummaries && window.lastRouteSummaries[containerId];
        
        // Eğer Fly Mode ise veya geometri özeten büyükse oranı hesapla
        if (cache.source === 'fly_arc' && summary && summary.distance > 0) {
            geometryRatio = cache.totalLen / summary.distance; 
        }
        // ====================================================

        // === SEGMENT (ZOOM) KONTROLÜ ===
        if (
            window._lastSegmentDay === day && 
            typeof window._lastSegmentStartKm === 'number' && 
            typeof window._lastSegmentEndKm === 'number'
        ) {
            const startKm = window._lastSegmentStartKm;
            const endKm = window._lastSegmentEndKm;
            // Mevcut km (Özet verisine göre)
            const currentKm = startKm + (percent * (endKm - startKm));
            
            // [FIX] Kilometreyi Metreye çevirip ORAN ile çarpıyoruz.
            // Böylece 100km'lik düz yolun sonu, 120km'lik eğrinin sonuna denk gelir.
            targetMetre = (currentKm * 1000) * geometryRatio; 

        } else {
            // Segment yoksa direkt geometri üzerindeki yüzdeyi al (Zaten tam boy)
            targetMetre = percent * cache.totalLen;
        }

        if (targetMetre > cache.totalLen) targetMetre = cache.totalLen;
        if (targetMetre < 0) targetMetre = 0;

        // Koordinat bulma (Interpolasyon)
        let idx = 0;
        for (let i = 0; i < cache.dists.length; i++) {
            if (cache.dists[i] >= targetMetre) {
                idx = i;
                break;
            }
        }

        let lat, lng;
        if (idx === 0) {
            [lat, lng] = cache.coords[0];
        } else {
            const d1 = cache.dists[idx - 1];
            const d2 = cache.dists[idx];
            const segmentDist = d2 - d1;
            const segmentRatio = (segmentDist > 0) ? (targetMetre - d1) / segmentDist : 0;

            const p1 = cache.coords[idx - 1];
            const p2 = cache.coords[idx];

            lat = p1[0] + (p2[0] - p1[0]) * segmentRatio;
            lng = p1[1] + (p2[1] - p1[1]) * segmentRatio;
        }

        if (!isNaN(lat) && !isNaN(lng)) {
            updateMarkerPosition(lat, lng);
        }
    };

    const cleanup = () => {
        if (window._hoverMarkersByDay && window._hoverMarkersByDay[day]) {
            try { map.removeLayer(window._hoverMarkersByDay[day]); } catch(e){}
            delete window._hoverMarkersByDay[day];
        }
        if (window._hoverMarker3D) {
            try { window._hoverMarker3D.remove(); } catch(e){}
            window._hoverMarker3D = null;
        }
    };

    if (scaleBar._activeHandler) {
        scaleBar.removeEventListener('mousemove', scaleBar._activeHandler);
        scaleBar.removeEventListener('touchmove', scaleBar._activeHandler);
        scaleBar.removeEventListener('mouseleave', scaleBar._activeCleanup);
        scaleBar.removeEventListener('touchend', scaleBar._activeCleanup);
    }

    scaleBar.addEventListener('mousemove', handleMove);
    scaleBar.addEventListener('touchmove', handleMove, { passive: true });
    scaleBar.addEventListener('mouseleave', cleanup);
    scaleBar.addEventListener('touchend', cleanup);
    scaleBar.addEventListener('mouseenter', () => {
         scaleBar._routeCache = buildGeomCache();
    });

    scaleBar._activeHandler = handleMove;
    scaleBar._activeCleanup = cleanup;
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
                if (typeof renderRouteForDay === "function") await renderRouteForDay(day);
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
            if (typeof renderRouteForDay === "function") await renderRouteForDay(day);
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
            position: absolute; bottom: 200px; display: flex; flex-direction: column; gap: 10px; z-index: 10001;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05); padding: 6px; border-radius: 12px;
            backdrop-filter: blur(4px); border: 1px solid rgba(0, 0, 0, 0.05); right: 20px;
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
        .expanded-map-header { position: absolute; bottom: 200px; left: 10px; z-index: 10001; display: flex; align-items: center; gap: 15px; left: -20px; }
        @media (max-width:768px) { .expanded-map-header { left: 10px; } .map-custom-controls { right: 20px; } }
        .map-layers-row { position: relative; display: flex; gap: 8px; padding: 6px; border-radius: 12px; backdrop-filter: blur(4px); box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05); flex-direction: column; width: auto; cursor: pointer; transition: all 0.2s ease; }
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
                } catch (err) { console.error(err); }

                expandedMapInstance.invalidateSize(true);
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
    compassBtn.innerHTML = `<div class="custom-compass-disc"><img src="https://www.svgrepo.com/show/526952/compass-big.svg" style="width:100%;height:100%;" alt="N"></div>`;
    compassBtn.onclick = function() {
        if (currentLayer === 'liberty' && window._maplibre3DInstance) {
            window._maplibre3DInstance.easeTo({ bearing: 0, pitch: 60, duration: 1000 });
        }
    };

    const locBtn = document.createElement('button');
    locBtn.className = 'map-ctrl-btn';
    locBtn.id = `use-my-location-btn-day${day}`;
    locBtn.innerHTML = '<img src="https://www.svgrepo.com/show/522166/location.svg" alt="Locate">';
    window.isLocationActiveByDay = window.isLocationActiveByDay || {};

    if (window.isLocationActiveByDay[day]) {
        locBtn.innerHTML = '<img src="https://www.svgrepo.com/show/522167/location.svg" alt="On">';
    }

    locBtn.onclick = function() {
        window.isLocationActiveByDay[day] = !window.isLocationActiveByDay[day];
        const isActive = window.isLocationActiveByDay[day];

        if (isActive) {
            locBtn.innerHTML = '<img src="https://www.svgrepo.com/show/522167/location.svg" alt="On">';
            if (!document.getElementById('tt-unified-loc-style')) {
                const s = document.createElement('style');
                s.id = 'tt-unified-loc-style';
                s.innerHTML = `@keyframes ttPulse { 0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; } 100% { transform: translate(-50%, -50%) scale(4.5); opacity: 0; } } @keyframes ttColorCycle { 0% { background-color: #4285F4; } 50% { background-color: #34A853; } 100% { background-color: #4285F4; } } .user-loc-wrapper { position: relative; width: 20px; height: 20px; } .user-loc-dot { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 14px; height: 14px; background-color: #4285F4; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.3); z-index: 2; animation: ttColorCycle 2s infinite ease-in-out; } .user-loc-ring-1, .user-loc-ring-2 { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 14px; height: 14px; background-color: rgba(66, 133, 244, 0.6); border-radius: 50%; z-index: 1; animation: ttPulse 2.5s infinite linear; } .user-loc-ring-2 { animation-delay: 1.25s; }`;
                document.head.appendChild(s);
            }
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(pos => {
                    window.updateUserLocationMarker(expandedMapInstance, day, pos.coords.latitude, pos.coords.longitude, currentLayer, true);
                }, () => {
                    window.isLocationActiveByDay[day] = false;
                    locBtn.innerHTML = '<img src="https://www.svgrepo.com/show/522166/location.svg" alt="Locate">';
                });
            }
        } else {
            locBtn.innerHTML = '<img src="https://www.svgrepo.com/show/522166/location.svg" alt="Locate">';
            window.updateUserLocationMarker(expandedMapInstance, day);
        }
    };

    controlsDiv.appendChild(zoomInBtn);
    controlsDiv.appendChild(zoomOutBtn);
    controlsDiv.appendChild(compassBtn);
    controlsDiv.appendChild(locBtn);

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

        console.log(`[ExpandedMap] Style: ${styleKey}`);

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

    // === 3D KONTROLÜ VE SCALE BAR FIX ===
    const is3DActive = document.getElementById('maplibre-3d-view') && 
                       document.getElementById('maplibre-3d-view').style.display !== 'none';

    if (is3DActive) {
        console.log("3D Mode active, updating 3D data and Scale Bar.");
        
        if (typeof refresh3DMapData === 'function') {
            refresh3DMapData(day);
        }

        // Scale Bar Tetikleyici (3D)
        const scaleBarDiv = document.getElementById(`expanded-route-scale-bar-day${day}`);
        const summary = window.lastRouteSummaries?.[containerId];

        if (scaleBarDiv && summary && summary.distance > 0) {
            const totalKm = summary.distance / 1000;
            const markerPositions = (typeof getRouteMarkerPositionsOrdered === 'function') 
                ? getRouteMarkerPositionsOrdered(day) 
                : [];
            
            if (typeof renderRouteScaleBar === 'function') {
                scaleBarDiv.innerHTML = ""; 
                renderRouteScaleBar(scaleBarDiv, totalKm, markerPositions);
                
                const track = scaleBarDiv.querySelector('.scale-bar-track');
                if (track) {
                    const width = Math.max(200, Math.round(track.getBoundingClientRect().width));
                    if (typeof createScaleElements === 'function') {
                        createScaleElements(track, width, totalKm, 0, markerPositions);
                    }
                }
            }
        }
        return; 
    }
    // ===================================================

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

    layersToRemove.forEach(layer => {
        try { expandedMap.removeLayer(layer); } catch (e) {}
    });

    if (!window._curvedArcPointsByDay) window._curvedArcPointsByDay = {};
    window._curvedArcPointsByDay[day] = []; 

    // 2. NOKTA HAZIRLIĞI
    const rawPoints = (typeof getDayPoints === 'function') ? getDayPoints(day) : [];
    const pts = rawPoints.filter(p => {
        const lat = Number(p.lat);
        const lng = Number(p.lng);
        return isFinite(lat) && isFinite(lng) && !isNaN(lat) && !isNaN(lng);
    });

    let bounds = L.latLngBounds(); 
    const isInTurkey = (typeof areAllPointsInTurkey === 'function') ? areAllPointsInTurkey(pts) : true;

    let hasValidRoute = (
      isInTurkey && geojson && geojson.features && geojson.features[0] &&
      geojson.features[0].geometry &&
      Array.isArray(geojson.features[0].geometry.coordinates) &&
      geojson.features[0].geometry.coordinates.length > 1
    );

    // --- ROTA ÇİZİMİ ---
    if (hasValidRoute) {
        const rawCoords = geojson.features[0].geometry.coordinates;
        const routeCoords = []; // [Lat, Lng] formatında
        rawCoords.forEach(c => {
            if (Array.isArray(c) && c.length >= 2 && !isNaN(c[0]) && !isNaN(c[1])) {
                routeCoords.push([c[1], c[0]]);
            }
        });

        if (routeCoords.length > 1) {
            const poly = L.polyline(routeCoords, {
                color: "#1976d2", weight: 6, opacity: 1, renderer: ensureCanvasRenderer(expandedMap) 
            }).addTo(expandedMap);
            bounds.extend(poly.getBounds());
            window._curvedArcPointsByDay[day] = routeCoords.map(coord => [coord[1], coord[0]]);

            // --- YENİ EKLENEN KISIM: EKSİK NOKTA BAĞLAYICILARI ---
            // Markerlar ile rota çizgisi arasındaki mesafeyi kontrol et.
            // Eğer marker rotaya oturmamışsa (Missing Point), kesik çizgi çek.
            pts.forEach(p => {
                let minDist = Infinity;
                let closestPoint = null;

                // En yakın rota noktasını bul (Basit Öklid hesabı yeterli)
                for (const rc of routeCoords) {
                    // rc: [lat, lng]
                    const dSq = (rc[0] - p.lat) ** 2 + (rc[1] - p.lng) ** 2;
                    if (dSq < minDist) {
                        minDist = dSq;
                        closestPoint = rc;
                    }
                }

                // Eşik değer (Yaklaşık 50-80 metreye denk gelen derece farkı karesi)
                // 0.0000005 derece karesi ~80m civarıdır.
                if (closestPoint && minDist > 0.0000005) {
                    L.polyline([[p.lat, p.lng], closestPoint], {
                        color: '#d32f2f', // Kırmızı
                        weight: 3,
                        opacity: 0.6,
                        dashArray: '5, 8', // Kesik çizgi
                        interactive: false // Tıklanmasın
                    }).addTo(expandedMap);
                }
            });
            // -----------------------------------------------------
        }
    } 
    else if (pts.length > 1 && !isInTurkey) {
        // Fly Mode (Yurtdışı)
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

    // --- MARKER ÇİZİMİ ---
    pts.forEach((item, idx) => {
        const markerHtml = `
            <div class="custom-marker-outer red" data-idx="${idx}" style="position:relative;">
                <span class="custom-marker-label">${idx + 1}</span>
            </div>`;
        const icon = L.divIcon({ html: markerHtml, className: "", iconSize: [32, 32], iconAnchor: [16, 16] });
        const marker = L.marker([item.lat, item.lng], { icon }).addTo(expandedMap);
        marker.bindPopup(`<b>${item.name || "Point"}</b>`);
        bounds.extend(marker.getLatLng());
    });

    // --- ODAKLANMA ---
    try {
        if (bounds.isValid()) {
            expandedMap.fitBounds(bounds, { padding: [50, 50] });
        } else {
            if (pts.length === 1) expandedMap.setView([pts[0].lat, pts[0].lng], 14, { animate: true });
            else expandedMap.setView([39.0, 35.0], 6, { animate: false });
        }
    } catch(e) { console.warn("FitBounds error:", e); }

    setTimeout(() => { try { expandedMap.invalidateSize(); } catch(e){} }, 200);
    
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
            const markerPositions = (typeof getRouteMarkerPositionsOrdered === 'function') 
                ? getRouteMarkerPositionsOrdered(day) 
                : [];
            
            scaleBarDiv.innerHTML = ""; 
            renderRouteScaleBar(scaleBarDiv, totalKm, markerPositions);
            
            const track = scaleBarDiv.querySelector('.scale-bar-track');
            if (track) {
                const width = Math.max(200, Math.round(track.getBoundingClientRect().width));
                if (typeof createScaleElements === 'function') {
                    createScaleElements(track, width, totalKm, 0, markerPositions);
                }
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

  expandedMap.eachLayer(l => {
    if (l instanceof L.Marker) expandedMap.removeLayer(l);
  });

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

    marker.bindPopup(`
      <div style="min-width:120px;">
        <b>${p.name || "Point"}</b><br>
        <button class="remove-marker-btn" data-day="${day}" data-idx="${idx}" style="font-size: 0.8rem !important">Remove place</button>
      </div>
    `, {
      autoClose: false,
      closeButton: true
    });

    // --- [FIX 1] POPUP İÇİNDEKİ SİLME BUTONU ---
    marker.on('popupopen', function(e) {
      setTimeout(() => {
        const btn = document.querySelector('.remove-marker-btn[data-day="' + day + '"][data-idx="' + idx + '"]');
        if (btn) {
          btn.onclick = async function() { // ASYNC yapıldı
            let n = 0;
            for (let i = 0; i < window.cart.length; i++) {
              const it = window.cart[i];
              if (it.day == day && it.location && !isNaN(it.location.lat) && !isNaN(it.location.lng)) {
                if (n === idx) {
                  window.cart.splice(i, 1);
                  
                  // BEKLEME (AWAIT) EKLENDİ
                  if (typeof renderRouteForDay === "function") await renderRouteForDay(day);
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

    // --- [FIX 2] MARKER ÜZERİNDEKİ "X" BUTONU ---
    marker.once('add', () => {
      const nameBox = marker.getElement()?.querySelector('.custom-marker-place-name');
      const xBtn = nameBox?.querySelector('.marker-remove-x-btn');
      if (xBtn) {
        xBtn.onclick = async (e) => { // ASYNC yapıldı
          e.stopPropagation();
          const cartIdx = findCartIndexByDayPosition(day, idx);
          if (cartIdx > -1) {
            window.cart.splice(cartIdx, 1);
            
            // BEKLEME (AWAIT) EKLENDİ
            if (typeof renderRouteForDay === "function") await renderRouteForDay(day);
            if (typeof updateCart === "function") await updateCart();
            if (typeof saveCurrentTripToStorage === "function") saveCurrentTripToStorage();
          }
        };
      }
    });

    marker.on('click', (e) => {
      if (e.originalEvent) e.originalEvent.stopPropagation();
      const outer = marker.getElement()?.querySelector('.custom-marker-outer');
      const wasActive = outer && outer.classList.contains('green');
      disableAllMarkerDragging(expandedMap);
      clearAllMarkersUI();

      if (!wasActive) {
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
      } else {
        marker.closePopup();
      }
    });

    marker.on('dragstart', () => {
      window.__tt_markerDragActive = true;
      hideDragArrows(marker);
      if (marker._hintTimer) {
        clearTimeout(marker._hintTimer);
        marker._hintTimer = null;
      }
      if (marker._hintTempPopup && expandedMap.hasLayer(marker._hintTempPopup)) {
        expandedMap.removeLayer(marker._hintTempPopup);
        marker._hintTempPopup = null;
      }
      const box = marker.getElement()?.querySelector('.custom-marker-place-name');
      if (box) {
        box.style.opacity = 0;
        box.classList.remove('name-bubble-animate');
      }
    });

    // --- [FIX 3] SÜRÜKLE BIRAK (DRAGEND) ZATEN DÜZELTİLMİŞTİ ---
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

      // BEKLEME (AWAIT)
      if (typeof renderRouteForDay === "function") await renderRouteForDay(day);
      if (typeof updateCart === "function") updateCart();
      
      if (marker.dragging && marker.dragging.disable) marker.dragging.disable();
      window.__tt_markerDragActive = false;
      if (typeof saveCurrentTripToStorage === "function") saveCurrentTripToStorage();

      L.popup().setLatLng(finalLatLng).setContent('Location updated').addTo(expandedMap);

      // Grafik Güncelleme (Safe)
      const containerId = `expanded-route-scale-bar-day${day}`;
      const scaleBarDiv = document.getElementById(containerId);
      const routeContainerId = `route-map-day${day}`;
      
      const updatedSummary = window.lastRouteSummaries?.[routeContainerId];
      const totalKm = (updatedSummary?.distance || 0) / 1000;
      const markerPositions = getRouteMarkerPositionsOrdered(day);

      if (scaleBarDiv && totalKm > 0 && markerPositions.length > 0) {
        try { delete scaleBarDiv.dataset.elevLoadedKey; } catch (_) {}
        scaleBarDiv.innerHTML = '<div class="spinner"></div>';
        renderRouteScaleBar(scaleBarDiv, totalKm, markerPositions);
        
        const track = scaleBarDiv.querySelector('.scale-bar-track');
        if (track) {
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
    try { delete scaleBarDiv.dataset.elevLoadedKey; } catch (_) {}
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

    function haversine(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const toRad = x => x * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(a));
    }

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
          <img class="tm-icon" src="https://www.svgrepo.com/show/262270/kite.svg" alt="FLY" loading="lazy" decoding="async" style="width:20px;height:20px;">
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
  
 
  if (isExpanded) {
      // --- DURUM 1: ZATEN AÇIK (PASİF) ---
      expandBtn.disabled = true;
      expandBtn.style.pointerEvents = 'none';
      expandBtn.style.opacity = '0.6';
      expandBtn.style.cursor = 'default';
      expandBtn.style.borderColor = '#ccc';
      expandBtn.style.background = '#f9f9f9';
      
      expandBtn.innerHTML = `
        <img class="tm-icon" src="/img/expand_animation.gif" alt="MAP" loading="lazy" decoding="async" style="filter: grayscale(100%);">
        <span class="tm-label" style="color: #888">Map Expanded</span>
      `;
  } else {
      // --- DURUM 2: KAPALI (AKTİF) ---
      expandBtn.style.background = '#ffffff';
      expandBtn.style.borderColor = 'rgb(43 129 213)';
      expandBtn.style.color = '#0080ff';
      expandBtn.style.cursor = 'pointer';
      
      // Hover efektleri sadece aktifken
      expandBtn.onmouseover = function() { expandBtn.style.background = "#fafafa"; };
      expandBtn.onmouseout = function() { expandBtn.style.background = "#ffffff"; };

      expandBtn.innerHTML = `
        <img class="tm-icon" src="/img/expand_animation.gif" alt="MAP" loading="lazy" decoding="async">
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
    const expandedContainer = document.getElementById(`expanded-map-${day}`);
    
    // NOT: Eski .route-stats'ı (varsa) kaldır
    expandedContainer?.querySelector('.route-stats')?.remove();

    // Mevcut segment toolbar'ı bul
    const existingToolbar = expandedContainer?.querySelector('.elev-segment-toolbar');
    
    // 1. Segment seçili mi kontrol et
    const isSegmentSelected = window._lastSegmentDay === day && 
                              typeof window._lastSegmentStartKm === 'number' &&
                              typeof window._lastSegmentEndKm === 'number';

    // 2. Küçük harita kontrol çubuğunda (map-bottom-controls) normal istatistikleri göster
    const smallSpan = document.querySelector(`#map-bottom-controls-day${day} .route-summary-control`);
    if (smallSpan && summary) {
        const elev = window.routeElevStatsByDay?.[day] || {};
        const strings = fmt(summary.distance, summary.duration, elev.ascent, elev.descent);
        smallSpan.innerHTML = buildBadgesHTML(strings);
    }

    if (!expandedContainer) return; // Genişletilmiş harita yoksa çık

    // 3. Segment seçiliyse: drawSegmentProfile zaten ilgili toolbar'ı oluşturdu/bıraktı. Çık.
    if (isSegmentSelected) {
        if (existingToolbar) existingToolbar.style.display = 'flex';
        return;
    } 
    
    // 4. Segment seçili değilse: TAM ROTA istatistiklerini Segment Toolbar formunda yaz
    
    // Önce eski segment toolbar'ı kaldır
    if (existingToolbar) existingToolbar.remove();

    if (summary) {
        const elev = window.routeElevStatsByDay?.[day] || {};
        const totalKm = (summary.distance / 1000).toFixed(1);
        const up = Math.round(elev.ascent || 0);
        const down = Math.round(elev.descent || 0);
        const durationMin = Math.round(summary.duration / 60);

        // Avg Grade bilgisi Road için **KULLANILMAYACAK**. Sadece mesafeler gösterilecek.
        
        const tb = document.createElement('div');
        tb.className = 'elev-segment-toolbar';
        tb.style.display = 'flex';
        
        // Rota bilgileri "pill" formunda (Avg pill'i ÇIKARILDI)
        tb.innerHTML = `
            <span class="pill">${totalKm} km</span>
            <span class="pill">${durationMin} min</span>
            <span class="pill">↑ ${up} m</span>
            <span class="pill">↓ ${down} m</span>
            <button type="button" class="elev-segment-reset" style="background:#9159ed; cursor: default;">Road</button>
        `;
        
        // Toolbar'ı panel içine, harita ve diğer panellerin hemen üstüne ekle
        const panelDiv = expandedContainer.querySelector('.expanded-map-panel');

        if (panelDiv && panelDiv.firstChild) {
            panelDiv.insertBefore(tb, panelDiv.firstChild);
        } else if (panelDiv) {
            panelDiv.appendChild(tb);
        }
    }
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
// Helper: Selection eventlerini bağla
function setupScaleBarEvents(track, selDiv) {
  // Önceki eventleri temizle
  window.removeEventListener('mousemove', window.__sb_onMouseMove);
  window.removeEventListener('mouseup', window.__sb_onMouseUp);
  window.removeEventListener('touchmove', window.__sb_onMouseMove); 
  window.removeEventListener('touchend', window.__sb_onMouseUp);   

  // Yeni eventleri ekle
  window.addEventListener('mousemove', window.__sb_onMouseMove);
  window.addEventListener('mouseup', window.__sb_onMouseUp);
  window.addEventListener('touchmove', window.__sb_onMouseMove, { passive: false }); 
  window.addEventListener('touchend', window.__sb_onMouseUp);     

  // Mouse Down
  track.addEventListener('mousedown', function(e) {
    const rect = track.getBoundingClientRect();
    window.__scaleBarDrag = { startX: e.clientX - rect.left, lastX: e.clientX - rect.left };
    window.__scaleBarDragTrack = track;
    window.__scaleBarDragSelDiv = selDiv;
    selDiv.style.left = `${window.__scaleBarDrag.startX}px`;
    selDiv.style.width = `0px`;
    selDiv.style.display = 'block';
  });

  // Mobil Long Press
  let longPressTimer = null;
  track.addEventListener('touchstart', function(e) {
    const rect = track.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    longPressTimer = setTimeout(() => {
        window.__scaleBarDrag = { startX: x, lastX: x };
        window.__scaleBarDragTrack = track;
        window.__scaleBarDragSelDiv = selDiv;
        selDiv.style.left = `${x}px`;
        selDiv.style.width = `0px`;
        selDiv.style.display = 'block';
        if (navigator.vibrate) navigator.vibrate(40);
    }, 600);
  }, { passive: true });

  track.addEventListener('touchmove', function(e) {
      if (longPressTimer && !window.__scaleBarDrag) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
      }
  }, { passive: true });

  track.addEventListener('touchend', function() {
      if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
      }
  });
}
function renderRouteScaleBar(container, totalKm, markers) {
  // 1. CSS GÜVENLİK KİLİDİ
  if (!document.getElementById('tt-scale-bar-css')) {
    const style = document.createElement('style');
    style.id = 'tt-scale-bar-css';
    style.innerHTML = `
        .scale-bar-track.loading > *:not(.tt-scale-loader) {
            opacity: 0.4; 
            pointer-events: none;
            transition: opacity 0.2s ease;
        }
        .scale-bar-track.loading .tt-scale-loader {
            opacity: 1 !important;
        }
        .scale-bar-track.loading {
            min-height: 200px; 
            width: 100%;
            position: relative;
        }
        /* TOOLTIP VE LINE HER ZAMAN EN ÜSTTE */
        .tt-elev-tooltip { z-index: 9999 !important; }
        .scale-bar-vertical-line { z-index: 9998 !important; }
        .scale-bar-selection { z-index: 9000 !important; }
    `;
    document.head.appendChild(style);
  }

  const spinner = container.querySelector('.spinner');
  if (spinner) spinner.remove();
  
  const dayMatch = container.id && container.id.match(/day(\d+)/);
  const day = dayMatch ? parseInt(dayMatch[1], 10) : null;
  const gjKey = day ? (window.lastRouteGeojsons && window.lastRouteGeojsons[`route-map-day${day}`]) : null;
  const coords = gjKey && gjKey.features && gjKey.features[0]?.geometry?.coordinates;

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
    window.showScaleBarLoading?.(container, 'Loading elevation...');
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
  }

  // Loader'ı her zaman oluştur ve görünür tut
  let loader = track.querySelector('.tt-scale-loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.className = 'tt-scale-loader';
    loader.innerHTML = `<div class="spinner"></div><div class="txt"></div>`;
    track.appendChild(loader);
  }
  loader.style.display = 'flex';
  window.updateScaleBarLoadingText?.(container, 'Loading elevation…');

  // Sadece loading sınıfı ekle (içerik kalsın)
  track.classList.add('loading');
  container.dataset.totalKm = String(totalKm);

  window.showScaleBarLoading?.(container, 'Loading elevation...');

  const N = Math.max(40, Math.round(totalKm * 2));
  
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

  (async () => {
    try {
      const elevations = await window.getElevationsForRoute(samples, container, routeKey);
      
      // --- VERİ HAZIR, ŞİMDİ ESKİSİNİ SİL VE YENİSİNİ KOY ---
      const oldLoader = track.querySelector('.tt-scale-loader');
      track.innerHTML = ''; // Temizlik
      if (oldLoader) track.appendChild(oldLoader); // Loader kalsın (henüz bitmedi)

      // Selection Div
      const selDiv = document.createElement('div');
      selDiv.className = 'scale-bar-selection';
      // Z-Index CSS'de verildi ama garanti olsun
      selDiv.style.cssText = `position:absolute; top:0; bottom:0; background: rgba(138,74,243,0.16); border: 1px solid rgba(138,74,243,0.45); display:none; z-index: 9000;`;
      track.appendChild(selDiv);
      window.__scaleBarDragTrack = track;
      window.__scaleBarDragSelDiv = selDiv;

      setupScaleBarEvents(track, selDiv); 

      // SVG Yapısı
      const width = Math.max(200, Math.round(track.getBoundingClientRect().width)) || 400;
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

      // Vertical Line & Tooltip (En sona ekliyoruz ki üstte kalsın)
      const verticalLine = document.createElement('div');
      verticalLine.className = 'scale-bar-vertical-line';
      verticalLine.style.cssText = `position:absolute;top:0;bottom:0;width:2px;background:#111;opacity:0.5;pointer-events:none;z-index:9998;display:block;`;
      verticalLine.style.left = '0px'; 
      track.appendChild(verticalLine);

      const tooltip = document.createElement('div');
      tooltip.className = 'tt-elev-tooltip';
      tooltip.style.left = '0px';
      tooltip.style.display = 'none';
      tooltip.style.zIndex = '9999'; // Garanti
      track.appendChild(tooltip);

      // Tooltip Hareket Listener'ı
      const onMoveTooltip = function(e) {
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

      track.removeEventListener('mousemove', onMoveTooltip);
      track.removeEventListener('touchmove', onMoveTooltip);
      track.addEventListener('mousemove', onMoveTooltip);
      track.addEventListener('touchmove', onMoveTooltip);

      if (!elevations || elevations.length !== samples.length || elevations.some(Number.isNaN)) {
        track.innerHTML = `<div style="text-align:center;padding:12px;font-size:13px;color:#c62828;">Elevation profile unavailable</div>`;
        return;
      }

      const smooth = movingAverage(elevations, 3);
      const min = Math.min(...smooth);
      const max = Math.max(...smooth, min + 1);

      container._elevationData = { smooth, min, max };
      container._elevationDataFull = { smooth: smooth.slice(), min, max };
      container.dataset.elevLoadedKey = routeKey;

      // REDRAW ELEVATION İÇİN GÜNCELLEME
      container._redrawElevation = function(elevationData) {
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

        // Grid
        for (let i = 0; i <= 4; i++) {
          const ev = vizMin + (i / 4) * (vizMax - vizMin);
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

        // Alan
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
          const areaD = `${topD} L ${width} ${SVG_H} L 0 ${SVG_H} Z`;
          areaPath.setAttribute('d', areaD);
          areaPath.setAttribute('fill', '#263445');
        }

        // Çizgiler
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
      };

      // Handle Resize
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
      }
      const ro = new ResizeObserver(() => { handleResize(); });
      ro.observe(track);
      container._elevResizeObserver = ro;

      // ÇİZİMİ BAŞLAT
      requestAnimationFrame(() => {
          container._redrawElevation(container._elevationData);
          window.hideScaleBarLoading?.(container);
          track.classList.remove('loading');
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
    } catch (err) {
      console.warn("Elevation fetch error:", err);
      window.updateScaleBarLoadingText?.(container, 'Elevation temporarily unavailable');
      try { delete container.dataset.elevLoadedKey; } catch(_) {}
      
      track.classList.remove('loading');
      createScaleElements(track, width || 400, totalKm, 0, markers);
    }
  })();
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
  
  // Gereksiz temizlikleri kaldır (DOM yapısını bozmamak için)
  // document.querySelectorAll... kısmını sildik.

  const key = `route-map-day${day}`;
  const gj = window.lastRouteGeojsons?.[key];
  const coords = gj?.features?.[0]?.geometry?.coordinates;
  if (!coords || coords.length < 2) return;

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
  // Örnekleme sayısını artırdık ki grafik kırık görünmesin
  const N = Math.min(300, Math.max(80, Math.round(segKm * 20)));

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

  window.showScaleBarLoading?.(container, 'Loading segment elevation...');

  const routeKey = `seg:${coords.length}|${samples[0].lat.toFixed(4)},${samples[0].lng.toFixed(4)}|${samples[samples.length - 1].lat.toFixed(4)},${samples[samples.length - 1].lng.toFixed(4)}|${N}`;
   try {
    const elev = await window.getElevationsForRoute(samples, container, routeKey);
    
    // Veri gelmezse veya hata olursa çıkma, çizmeye çalış
    if (!elev || elev.length !== N || elev.some(Number.isNaN)) {
        console.warn("Segment elevation data incomplete, skipping profile update.");
        return;
    }

    const smooth = movingAverage(elev, 3);
    
    // --- ÇİZİM FONKSİYONUNU ÇAĞIR ---
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
// SEGMENT SEÇİMİ SONRASI ZOOM VE HIGHLIGHT (ZOOM FIX)
function highlightSegmentOnMap(day, startKm, endKm) {
  // --- 1. TEMİZLİK ---
  if (window._segment3DMarkers) {
      window._segment3DMarkers.forEach(m => m.remove());
      window._segment3DMarkers = [];
  }

  if (typeof startKm !== "number" || typeof endKm !== "number" || typeof day !== "number") {
      // 2D Temizlik
      if (window._segmentHighlight && window._segmentHighlight[day]) {
          Object.values(window._segmentHighlight[day]).forEach(layer => { try { layer.remove(); } catch(_) {} });
          delete window._segmentHighlight[day];
      }
      // 3D Temizlik
      if (window._maplibre3DInstance) {
          if (window._maplibre3DInstance.getLayer('segment-highlight-layer')) window._maplibre3DInstance.removeLayer('segment-highlight-layer');
          if (window._maplibre3DInstance.getSource('segment-highlight-source')) window._maplibre3DInstance.removeSource('segment-highlight-source');
      }
      return;
  }

  const cid = `route-map-day${day}`;
  let coords = null;
  
  // Fly Mode vs Normal Mode
  if (window._curvedArcPointsByDay && window._curvedArcPointsByDay[day] && window._curvedArcPointsByDay[day].length > 1) {
      coords = window._curvedArcPointsByDay[day]; 
  } else {
      const gj = window.lastRouteGeojsons?.[cid];
      if (gj && gj.features && gj.features[0]?.geometry?.coordinates) {
          coords = gj.features[0].geometry.coordinates; 
      }
  }

  if (!coords || coords.length < 2) return;

  // --- 2. HESAPLAMA ---
  function hv(lat1, lon1, lat2, lon2) {
    const R=6371000, toRad=x=>x*Math.PI/180;
    const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
    const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(a));
  }

  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i-1];
    const [lon2, lat2] = coords[i];
    cum[i] = cum[i-1] + hv(lat1, lon1, lat2, lon2);
  }

  const segStartM = startKm * 1000;
  const segEndM = endKm * 1000;
  let iStart = 0, iEnd = coords.length - 1;

  for (let i = 0; i < cum.length; i++) {
      if (cum[i] >= segStartM) { iStart = i > 0 ? i - 1 : i; break; }
  }
  for (let i = iStart; i < cum.length; i++) {
      if (cum[i] >= segEndM) { iEnd = i; break; }
  }

  const subCoordsLeaflet = coords.slice(iStart, iEnd + 1).map(c => [c[1], c[0]]);
  if (subCoordsLeaflet.length < 2) return;

  // --- 3. 2D ÇİZİM VE ZOOM ---
  window._segmentHighlight = window._segmentHighlight || {};
  if (!window._segmentHighlight[day]) window._segmentHighlight[day] = {};

  const maps2D = [];
  if (window.leafletMaps && window.leafletMaps[cid]) maps2D.push(window.leafletMaps[cid]);
  const expandedObj = Object.values(window.expandedMaps || {}).find(obj => obj.day === day);
  const is3DActive = document.getElementById('maplibre-3d-view') && document.getElementById('maplibre-3d-view').style.display !== 'none';
  if (expandedObj && expandedObj.expandedMap && !is3DActive) {
      maps2D.push(expandedObj.expandedMap);
  }

  Object.values(window._segmentHighlight[day]).forEach(layer => { try { layer.remove(); } catch(_) {} });
  window._segmentHighlight[day] = {};

  const markerOptions = { radius: 6, color: '#8a4af3', fillColor: '#ffffff', fillOpacity: 1, weight: 2, opacity: 1, interactive: false, pane: 'segmentPane' };

  maps2D.forEach(m => {
    if (!m.getPane('segmentPane')) {
        m.createPane('segmentPane');
        m.getPane('segmentPane').style.zIndex = 650; 
        m.getPane('segmentPane').style.pointerEvents = 'none';
    }
    const svgRenderer = L.svg({ pane: 'segmentPane' });

    const poly = L.polyline(subCoordsLeaflet, {
        color: '#8a4af3', weight: 8, opacity: 1.0, lineCap: 'round', lineJoin: 'round', dashArray: null, pane: 'segmentPane', renderer: svgRenderer 
    }).addTo(m);
    
    window._segmentHighlight[day][`poly_${m._leaflet_id}`] = poly;
    const startPt = subCoordsLeaflet[0];
    const endPt = subCoordsLeaflet[subCoordsLeaflet.length - 1];
    window._segmentHighlight[day][`start_${m._leaflet_id}`] = L.circleMarker(startPt, { ...markerOptions, renderer: svgRenderer }).addTo(m);
    window._segmentHighlight[day][`end_${m._leaflet_id}`] = L.circleMarker(endPt, { ...markerOptions, renderer: svgRenderer }).addTo(m);
    
    // --- ZOOM KISMI ---
    try {
        if (poly.getBounds().isValid()) {
            m.fitBounds(poly.getBounds(), { 
                padding: [100, 100], // Kenarlardan boşluk
                maxZoom: 19,         // FIX: Daha derine zoom yapabilsin
                animate: true, 
                duration: 1.0 
            });
        }
    } catch(e) {}
  });

  // --- 4. 3D ÇİZİM VE ZOOM ---
  if (is3DActive && window._maplibre3DInstance) {
      const map3d = window._maplibre3DInstance;
      const subCoordsGeoJSON = coords.slice(iStart, iEnd + 1);
      const sourceId = 'segment-highlight-source';
      const layerId = 'segment-highlight-layer';

      if (map3d.getSource(sourceId)) {
          map3d.getSource(sourceId).setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: subCoordsGeoJSON } });
      } else {
          map3d.addSource(sourceId, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: subCoordsGeoJSON } } });
          map3d.addLayer({
              id: layerId, type: 'line', source: sourceId,
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: { 'line-color': '#8a4af3', 'line-width': 8, 'line-opacity': 1.0 }
          });
      }
      if (map3d.getLayer(layerId)) map3d.moveLayer(layerId); // En üste

      window._segment3DMarkers = window._segment3DMarkers || [];
      const create3DMarker = (lngLat) => {
          const el = document.createElement('div');
          el.className = 'segment-marker-3d';
          el.style.cssText = `width: 14px; height: 14px; background-color: #ffffff; border: 3px solid #8a4af3; border-radius: 50%; box-shadow: 0 1px 4px rgba(0,0,0,0.4); z-index: 9999;`;
          const marker = new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map3d);
          window._segment3DMarkers.push(marker);
      };
      if (subCoordsGeoJSON.length > 0) {
          create3DMarker(subCoordsGeoJSON[0]);
          create3DMarker(subCoordsGeoJSON[subCoordsGeoJSON.length - 1]);
      }

      // --- 3D ZOOM ---
      const bounds = new maplibregl.LngLatBounds();
      subCoordsGeoJSON.forEach(c => bounds.extend(c));
      map3d.fitBounds(bounds, {
          padding: { top: 80, bottom: 240, left: 80, right: 80 }, 
          maxZoom: 19, // FIX: 3D için de limit artırıldı
          duration: 1200
      });
  }
}
function drawSegmentProfile(container, day, startKm, endKm, samples, elevSmooth) {
  const svgNS = 'http://www.w3.org/2000/svg';
  window._lastSegmentDay = day;
  window._lastSegmentStartKm = startKm;
  window._lastSegmentEndKm = endKm;

  const track = container.querySelector('.scale-bar-track'); 
  if (!track) return;

  const selDiv = container.querySelector('.scale-bar-selection');
  if (selDiv) { selDiv.style.display = 'none'; selDiv.style.width = '0px'; selDiv.style.left = '0px'; }

  // Temizlik
  track.querySelectorAll('svg[data-role="elev-segment"]').forEach(el => el.remove());
  track.querySelectorAll('svg[data-role="elev-base"]').forEach(el => el.style.display = 'none'); 
  track.querySelectorAll('.elev-segment-toolbar').forEach(el => el.remove());
  track.querySelectorAll('.elevation-labels-container').forEach(el => el.remove());
  
  const expandedContainer = container.closest('.expanded-map-container');
  expandedContainer?.querySelector('.elev-segment-toolbar')?.remove(); 

  const widthPx = Math.max(200, Math.round(track.getBoundingClientRect().width));
  const totalKm = Number(container.dataset.totalKm) || 0;
  
  const allMarkers = (typeof getRouteMarkerPositionsOrdered === 'function') ? getRouteMarkerPositionsOrdered(day) : [];
  // Sadece segment içindeki markerlar
  const segmentMarkers = allMarkers.filter(m => m.distance >= startKm && m.distance <= endKm);

  const min = Math.min(...elevSmooth);
  const max = Math.max(...elevSmooth, min + 1);
  const span = max - min;
  
  let vizMin, vizMax;
  if (span > 0) { vizMin = min - span * 0.50; vizMax = max + span * 1.0; } 
  else { vizMin = min - 1; vizMax = max + 1; }

  container._elevationData = { smooth: elevSmooth, vizMin, vizMax, min, max };
  container._elevSamples = samples; 
  container._elevStartKm = startKm;
  container._elevKmSpan  = endKm - startKm;

  // Segment Markerlarını Çiz
  createScaleElements(track, widthPx, endKm - startKm, startKm, segmentMarkers, { smooth: elevSmooth, vizMin, vizMax });

  const rect = track.getBoundingClientRect();
  track._segmentStartPx = 0; 
  track._segmentWidthPx = rect.width;

  // SVG Çizimi
  const widthNow = widthPx || 400;
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const SVG_TOP = 48;
  let heightNow = isMobile
    ? Math.max(180, Math.min(240, Math.round(track.getBoundingClientRect().height - SVG_TOP - 12)))
    : Math.max(180, Math.min(320, Math.round(track.getBoundingClientRect().height - SVG_TOP - 16)));
  if (isNaN(heightNow)) heightNow = isMobile ? 160 : 220;

  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'tt-elev-svg');
  svg.setAttribute('data-role', 'elev-segment');
  svg.setAttribute('viewBox', `0 0 ${widthNow} ${heightNow}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', String(heightNow));
  track.appendChild(svg);

  const existingTooltip = track.querySelector('.tt-elev-tooltip');
  const existingLine = track.querySelector('.scale-bar-vertical-line');
  if (existingLine) track.appendChild(existingLine);
  if (existingTooltip) track.appendChild(existingTooltip);

  const gridG = document.createElementNS(svgNS, 'g');
  gridG.setAttribute('class','tt-elev-grid');
  svg.appendChild(gridG);
  const areaPath = document.createElementNS(svgNS, 'path');
  areaPath.setAttribute('class','tt-elev-area');
  svg.appendChild(areaPath);
  const segG = document.createElementNS(svgNS, 'g');
  segG.setAttribute('class','tt-elev-segments');
  svg.appendChild(segG);

  const X = (kmRel) => (kmRel / (endKm - startKm)) * widthNow;
  const Y = (e) => (isNaN(e) || vizMax === vizMin) ? (heightNow/2) : ((heightNow - 1) - ((e - vizMin) / (vizMax - vizMin)) * (heightNow - 2));

  // Grid
  for (let i = 0; i <= 4; i++) {
    const ev = vizMin + (i / 4) * (vizMax - vizMin);
    const y = Y(ev);
    const ln = document.createElementNS(svgNS, 'line');
    ln.setAttribute('x1', '0'); ln.setAttribute('x2', String(widthNow));
    ln.setAttribute('y1', String(y)); ln.setAttribute('y2', String(y));
    ln.setAttribute('stroke', '#d7dde2'); ln.setAttribute('stroke-dasharray', '4 4'); ln.setAttribute('opacity', '.8');
    gridG.appendChild(ln);
  }
  
  // Area
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

  // Segments
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

  // Toolbar
  let up = 0, down = 0;
  for (let i = 1; i < elevSmooth.length; i++) {
    const d = elevSmooth[i] - elevSmooth[i-1];
    if (d > 1.5) up += d; else if (d < -1.5) down += -d;
  }
  const distKm = (endKm - startKm);
  const avgGrade = distKm > 0 ? ((elevSmooth[elevSmooth.length - 1] - elevSmooth[0]) / (distKm * 1000)) * 100 : 0;

  const tb = document.createElement('div');
  tb.className = 'elev-segment-toolbar';
  tb.innerHTML = `
    <span class="pill">${startKm.toFixed(1)}–${endKm.toFixed(1)} km</span>
    <span class="pill">↑ ${Math.round(up)} m</span>
    <span class="pill">↓ ${Math.round(down)} m</span>
    <span class="pill">Avg %${avgGrade.toFixed(1)}</span>
    <button type="button" class="elev-segment-reset" style="background:#d32f2f;">Segment (X)</button>
  `;
  
  const expandedContainerChildren = expandedContainer.querySelector('.expanded-map-panel');
  if (expandedContainerChildren && expandedContainerChildren.firstChild) {
      expandedContainerChildren.insertBefore(tb, expandedContainerChildren.firstChild);
  } else if (expandedContainerChildren) {
      expandedContainerChildren.appendChild(tb);
  }
  
  const resetBtn = tb.querySelector('.elev-segment-reset');
  if (resetBtn) {
      const stopProp = (e) => e.stopPropagation();
      resetBtn.addEventListener('touchstart', stopProp, { passive: true });
      resetBtn.addEventListener('mousedown', stopProp);

     // --- RESET (UNZOOM) MANTIĞI ---
     resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // 1. DOM Temizliği
        track.querySelectorAll('svg[data-role="elev-segment"]').forEach(el => el.remove());
        track.querySelectorAll('svg[data-role="elev-base"]').forEach(el => el.style.display = 'block'); 
        track.querySelectorAll('.elev-segment-toolbar').forEach(el => el.remove());
        track.querySelectorAll('.elevation-labels-container').forEach(el => el.remove());

        if (typeof highlightSegmentOnMap === 'function') {
          highlightSegmentOnMap(day); 
        }

        window._lastSegmentDay = undefined;
        window._lastSegmentStartKm = undefined;
        window._lastSegmentEndKm = undefined;

        const selection = container.querySelector('.scale-bar-selection');
        if (selection) selection.style.display = 'none';

        // 2. Map Unzoom
        const cid = `route-map-day${day}`;
        const gj = window.lastRouteGeojsons?.[cid];
        let bounds = null;
        let bounds3d = null;

        if (gj && gj.features && gj.features[0]?.geometry?.coordinates) {
            const coords = gj.features[0].geometry.coordinates; 
            bounds = L.latLngBounds(coords.map(c => [c[1], c[0]]));
            if (window.maplibregl) {
                bounds3d = new maplibregl.LngLatBounds();
                coords.forEach(c => bounds3d.extend(c));
            }
        } else {
            const allPoints = typeof getDayPoints === 'function' ? getDayPoints(day) : [];
            const validPoints = allPoints.filter(p => isFinite(p.lat) && isFinite(p.lng));
            if (validPoints.length > 0) {
                bounds = L.latLngBounds(validPoints.map(p => [p.lat, p.lng]));
                if (window.maplibregl) {
                    bounds3d = new maplibregl.LngLatBounds();
                    validPoints.forEach(p => bounds3d.extend([p.lng, p.lat]));
                }
            }
        }

        const expObj = window.expandedMaps && window.expandedMaps[cid];
        if (expObj && expObj.expandedMap && bounds && bounds.isValid()) {
            expObj.expandedMap.fitBounds(bounds, { padding: [50, 50], animate: true, duration: 1.0 });
        }

        const is3DActive = document.getElementById('maplibre-3d-view') && document.getElementById('maplibre-3d-view').style.display !== 'none';
        if (is3DActive && window._maplibre3DInstance && bounds3d) {
            window._maplibre3DInstance.fitBounds(bounds3d, {
                padding: { top: 80, bottom: 240, left: 60, right: 60 },
                duration: 1200
            });
        }

        // --- 3. Scale Bar Reset (FIX: SIRALAMA DÜZELTİLDİ) ---
        
        // A) Önce veriyi FULL moda geri yükle
        if (container._elevationDataFull) {
          container._elevationData = {
            min: container._elevationDataFull.min,
            max: container._elevationDataFull.max,
            smooth: container._elevationDataFull.smooth.slice()
          };
        }
        
        container._elevStartKm = 0;
        container._elevKmSpan  = totalKm;
        
        // Full Samples'ı geri yükle
        if (Array.isArray(container._elevFullSamples)) {
          container._elevSamples = container._elevFullSamples.slice();
        }

        // B) SVG Çizgilerini Yenile (Bu fonksiyon eski closure verisi ile marker çizebilir, sorun değil, aşağıda ezeceğiz)
        if (typeof container._redrawElevation === 'function') {
          container._redrawElevation(container._elevationData);
        } 
        
        // C) Markerları TEMİZ, GÜNCEL VERİLERLE Yeniden Çiz (Öncekileri siler ve doğrusunu koyar)
        // Güncel genişliği al (Sidebar açılıp kapanmış olabilir)
        const currentWidth = Math.max(200, Math.round(track.getBoundingClientRect().width));
        // Güncel marker listesini al
        const freshMarkers = (typeof getRouteMarkerPositionsOrdered === 'function') ? getRouteMarkerPositionsOrdered(day) : [];
        
        // Markerları "activeData: null" göndererek oluştur ki container._elevationData'yı (Full olanı) kullansın
        createScaleElements(track, currentWidth, totalKm, 0, freshMarkers, null);
        
        updateRouteStatsUI(day);
      });
  }
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
        }

        /* 6. Mobil Performans İyileştirmesi */
        .leaflet-container {
            touch-action: none; /* Tarayıcının varsayılan zoom'unu engelle */
        }
    `;
    document.head.appendChild(style);
})();
/**
 * Kullanıcı konum markerını haritada günceller.
 * Hem 2D (Leaflet) hem 3D (MapLibre) modlarını destekler.
 */
window.updateUserLocationMarker = function(expandedMap, day, lat, lng, layer) {
    const locHtml = `<div class="user-loc-wrapper"><div class="user-loc-ring-1"></div><div class="user-loc-ring-2"></div><div class="user-loc-dot"></div></div>`;
    
    // Eski markerları temizle
    if (window._userLocMarker3D) { 
        try { window._userLocMarker3D.remove(); } catch(e){} 
        window._userLocMarker3D = null; 
    }
    if (window._userLocMarker2D && expandedMap) { 
        try { expandedMap.removeLayer(window._userLocMarker2D); } catch(e){} 
        window._userLocMarker2D = null; 
    }

    // Koordinat yoksa (kapatma durumu) çık
    if (typeof lat !== 'number' || typeof lng !== 'number') return;

    const is3D = (layer === 'liberty' && window._maplibre3DInstance);

    if (is3D) {
        // 3D Marker Ekle
        const el = document.createElement('div');
        el.innerHTML = locHtml; 
        window._userLocMarker3D = new maplibregl.Marker({ element: el })
            .setLngLat([lng, lat])
            .addTo(window._maplibre3DInstance);
    } else if (expandedMap) {
        // 2D Marker Ekle
        const customIcon = L.divIcon({
            className: 'custom-loc-icon-leaflet',
            html: locHtml,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
        window._userLocMarker2D = L.marker([lat, lng], { icon: customIcon, zIndexOffset: 1000 })
            .addTo(expandedMap);
    }
};

/**
 * Konum durumunu kontrol eder ve gerekirse haritayı odaklar.
 */
window.syncUserLocationState = function(day, expandedMapInstance, currentLayer) {
    const isActive = window.isLocationActiveByDay && window.isLocationActiveByDay[day];
    const btn = document.getElementById(`use-my-location-btn-day${day}`);
    
    if (!isActive) {
        if(btn) btn.innerHTML = '<img src="https://www.svgrepo.com/show/522166/location.svg" alt="Locate">';
        return;
    }

    // Aktifse konumu al ve çiz
    if (navigator.geolocation) {
        if(btn) btn.innerHTML = '<img src="https://www.svgrepo.com/show/522167/location.svg" alt="On">';
        
        navigator.geolocation.getCurrentPosition(pos => {
            const { latitude, longitude } = pos.coords;
            
            // Markerı çiz
            window.updateUserLocationMarker(expandedMapInstance, day, latitude, longitude, currentLayer);
            
            // Haritayı uçur (isteğe bağlı, katman değişiminde odaklasın isteniyorsa)
            if (currentLayer === 'liberty' && window._maplibre3DInstance) {
                window._maplibre3DInstance.flyTo({ center: [longitude, latitude], zoom: 14 });
            } else if (expandedMapInstance) {
                expandedMapInstance.setView([latitude, longitude], 14);
            }
        }, () => {
            // Hata olursa pasife çek
            window.isLocationActiveByDay[day] = false;
            if(btn) btn.innerHTML = '<img src="https://www.svgrepo.com/show/522166/location.svg" alt="Locate">';
        });
    }
};
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

// === MY TRIPS TITLE FIX ===
// My Trips listesinden bir geziye tıklandığında başlığı oradan alıp zorla düzeltir.
document.addEventListener('click', function(e) {
    // Tıklanan yer bir gezi kutusu mu?
    const tripBox = e.target.closest('.mytrips-tripbox');
    
    // Eğer butonlara (sil, pdf, fav) tıklandıysa veya kutu değilse işlem yapma
    if (!tripBox || e.target.closest('button')) return;

    // Tıklanan kutunun içindeki doğru başlığı bul (örn: "Antalya trip plan")
    const sidebarTitleEl = tripBox.querySelector('.trip-title');
    
    if (sidebarTitleEl) {
        const correctTitle = sidebarTitleEl.textContent.trim();
        
        // Diğer yükleme fonksiyonları çalıştıktan hemen sonra devreye girsin diye ufak gecikme
        setTimeout(() => {
            // 1. Ana Başlığı Düzelt
            const mainTitleEl = document.getElementById('trip_title');
            if (mainTitleEl) {
                mainTitleEl.textContent = correctTitle;
            }

            // 2. Global değişkenleri güncelle (PDF ve AI için önemli)
            window.lastUserQuery = correctTitle;

            // 3. Şehir ismini başlıktan ayıkla ("Antalya trip plan" -> "Antalya")
            // Bu sayede "Trip to Barcelona" hafızası silinir.
            const cityName = correctTitle.replace(/ trip plan$/i, '').replace(/ trip$/i, '').trim();
            if (cityName) {
                window.selectedCity = cityName;
                
                // Eğer ekranda yanlış şehre ait AI kutusu varsa kaldır
                const oldAiInfo = document.querySelector('.ai-info-section');
                if (oldAiInfo) oldAiInfo.remove();
            }
        }, 150); // 150ms gecikme ile son sözü bu kod söyler
    }
});

// --- GÜNCELLENMİŞ KONUM FONKSİYONU (ZOOM KONTROLLÜ) ---
window.updateUserLocationMarker = function(expandedMap, day, lat, lng, layer = 'bright', shouldFly = false) {
    const locHtml = `<div class="user-loc-wrapper"><div class="user-loc-ring-1"></div><div class="user-loc-ring-2"></div><div class="user-loc-dot"></div></div>`;
    
    // Eski markerları temizle
    if (window._userLocMarker3D) { try { window._userLocMarker3D.remove(); } catch(e){} window._userLocMarker3D = null; }
    if (window._userLocMarker2D && expandedMap) { try { expandedMap.removeLayer(window._userLocMarker2D); } catch(e){} window._userLocMarker2D = null; }

    // Konum verisi yoksa çık
    if (typeof lat !== 'number') return;

    // 3D Harita Modu
    if (layer === 'liberty' && window._maplibre3DInstance) {
        const el = document.createElement('div');
        el.innerHTML = locHtml; 
        window._userLocMarker3D = new maplibregl.Marker({ element: el })
            .setLngLat([lng, lat])
            .addTo(window._maplibre3DInstance);
        
        // Sadece istenirse uç
        if (shouldFly) {
            window._maplibre3DInstance.flyTo({ center: [lng, lat], zoom: 14 });
        }
    } 
    // 2D Harita Modu
    else if (expandedMap) {
        const customIcon = L.divIcon({ className: 'custom-loc-icon-leaflet', html: locHtml, iconSize: [20, 20], iconAnchor: [10, 10] });
        window._userLocMarker2D = L.marker([lat, lng], { icon: customIcon, zIndexOffset: 1000 }).addTo(expandedMap);
        
        // Sadece istenirse uç
        if (shouldFly) {
            expandedMap.flyTo([lat, lng], 14);
        }
    }
};
// ------------------------------------------------------
// Helpers
// --- Collage helpers ---
// ============================================================
// --- 1. Hiyerarşi Analizi ve İsim Çıkarma (GELİŞTİRİLMİŞ) ---
// ============================================================

function extractSmartSearchTerm(info, fallbackCity = "") {
  if (!info) return fallbackCity || "";

  const props = info.properties || {};
  const addr = props.address || {}; // Bazı API'lerde address objesi ayrıdır, bazılarında root'tadır.

  // Olası alanları normalize et (API farklarına karşı önlem)
  const suburb = addr.suburb || addr.neighbourhood || props.suburb || "";
  const district = addr.district || addr.county || props.district || props.county || "";
  const city = addr.city || addr.town || addr.village || props.city || props.town || "";
  const state = addr.state || addr.province || props.state || "";
  const country = addr.country || props.country || "Turkey";

  // LOGIC: En anlamlı turistik bölgeyi seç.
  
  // 1. KURAL: Eğer elimizde bir İLÇE (District) varsa ve bu ilçe ŞEHİR (State) ile aynı değilse (Merkez ilçe değilse), 
  // fotoğraf araması için en iyi aday İLÇE'dir. (Örn: Altınkum -> Konyaaltı)
  if (district && district.toLowerCase() !== state.toLowerCase()) {
      // "Merkez" kelimesi geçen ilçeleri filtrele (Antalya Merkez gibi), genelde il ismini kullanmak daha iyidir.
      if (!district.toLowerCase().includes("merkez")) {
          return { term: district, context: state }; // Döndür: Konyaaltı (Context: Antalya)
      }
  }

  // 2. KURAL: İlçe yoksa veya uygun değilse ŞEHİR/İL (City/State) kullan.
  if (city) return { term: city, context: country };
  if (state) return { term: state, context: country };

  // 3. KURAL: Hiçbiri yoksa fallback
  return { term: fallbackCity, context: "" };
}

async function fetchSmartLocationName(lat, lng, fallbackCity = "") {
  try {
    const info = await getPlaceInfoFromLatLng(lat, lng);
    return extractSmartSearchTerm(info, fallbackCity);
  } catch (_) {
    return { term: fallbackCity, context: "" };
  }
}

// ============================================================
// --- 2. Akıllı Görsel Arama (ZENGİNLEŞTİRİLMİŞ) ---
// ============================================================

async function getCityCollageImages(searchObj) {
  let searchTerm = "";
  let context = "";

  if (typeof searchObj === 'string') {
      searchTerm = searchObj;
  } else {
      searchTerm = searchObj.term;
      context = searchObj.context || "";
  }

  if (!searchTerm) return [];

  const cacheKey = searchTerm + "_" + context;
  window.__dayCollageCache = window.__dayCollageCache || {};
  if (window.__dayCollageCache[cacheKey]) return window.__dayCollageCache[cacheKey];

  const cleanTerm = searchTerm.replace(/( district| province| city| municipality| mahallesi| belediyesi| valiliği)/gi, "").trim();
  const cleanContext = context.replace(/( district| province| city)/gi, "").trim();

  // Sorguları çeşitlendir (Bol bol resim lazım)
  const queries = [
    `${cleanTerm} ${cleanContext} tourism`, 
    `${cleanTerm} city`,
    `${cleanTerm} street`,
    `${cleanTerm} food`,
    `${cleanTerm} people`,
    `${cleanTerm} night`,
    `${cleanTerm} nature`,
    `${cleanTerm} beach`,
    `${cleanTerm} landmark`,
    `visit ${cleanTerm} ${cleanContext}`
  ];

  // Yedek (İl bazlı)
  if (cleanContext && cleanTerm.toLowerCase() !== cleanContext.toLowerCase()) {
      queries.push(`${cleanContext} travel`);
      queries.push(`${cleanContext} life`);
  }

  const images = [];
  const seen = new Set();

  // Hedef: En az 20 fotoğraf topla
  for (const q of queries) {
    if (images.length >= 20) break;
    try {
      const img = await getPhoto(q, "pexels");
      if (img && !seen.has(img)) {
        images.push(img);
        seen.add(img);
      }
    } catch (_) {}
  }

  // Eğer çok az varsa (örn: 2 tane), bunları çoğalt ki slider bozulmasın
  while (images.length < 6 && images.length > 0) {
    images.push(...images);
  }

  window.__dayCollageCache[cacheKey] = images;
  return images;
} 

// ============================================================
// --- 3. Collage Renderer (GÜNCELLENMİŞ) ---
// ============================================================

window.renderDayCollage = async function renderDayCollage(day, dayContainer, dayItemsArr) {
  if (!dayContainer) return;

  // 1. İskelet
  let collage = dayContainer.querySelector(".day-collage");
  if (!collage) {
    collage = document.createElement("div");
    collage.className = "day-collage";
    collage.style.cssText = `
      margin: 12px 0 6px 0;
      border-radius: 10px;
      overflow: hidden;
      background: #f7f9fc;
      padding: 8px;
      position: relative;
      display: block;
      min-height: 100px;
    `;
    const dayListEl = dayContainer.querySelector(".day-list");
    if (dayListEl && dayListEl.parentNode) {
      dayListEl.parentNode.insertBefore(collage, dayListEl.nextSibling);
    } else {
      dayContainer.appendChild(collage);
    }
  }

  // 2. Lokasyon
  const firstWithLoc = (dayItemsArr || []).find(
    (it) => it.location && isFinite(it.location.lat) && isFinite(it.location.lng)
  );

  if (!firstWithLoc) {
    collage.style.display = "none";
    return;
  }

  collage.style.display = "block";
  collage.innerHTML = `<div style="width:100%;text-align:center;padding:20px;color:#607d8b;font-size:13px;">Loading...</div>`;

  // 3. İsim
  const searchObj = await fetchSmartLocationName(
      firstWithLoc.location.lat,
      firstWithLoc.location.lng,
      window.selectedCity || ""
  );

  // 4. Tüm Resimler
  const allImages = await getCityCollageImages(searchObj);

  if (!allImages || allImages.length === 0) {
    collage.innerHTML = "";
    collage.style.display = "none";
    return;
  }

  // 5. --- SEÇİM (6 Tane Al) ---
  const selectedImages = [];
  const TARGET_COUNT = 6; // Her gün için 6 resim hedefle (Slider çalışsın diye)

  // A. Kullanılmamışları al
  for (const src of allImages) {
      if (selectedImages.length >= TARGET_COUNT) break;
      if (!window.__usedCollageImages.has(src)) {
          selectedImages.push(src);
          window.__usedCollageImages.add(src);
      }
  }

  // B. Yetmediyse eskilerden tamamla
  if (selectedImages.length < TARGET_COUNT) {
      for (const src of allImages) {
          if (selectedImages.length >= TARGET_COUNT) break;
          selectedImages.push(src); // Tekrar kullan
      }
  }
  
  // 6. --- SLIDER KURULUMU ---
  // Masaüstünde 3, Mobilde 1 tane göster
  const isMobile = window.innerWidth < 600;
  const visible = isMobile ? 1 : 3; 
  let index = 0;

  const titleHtml = searchObj.term ? 
    `<div style="position:absolute; top:12px; left:12px; z-index:2; background:rgba(0,0,0,0.6); color:#fff; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:600; pointer-events:none;">
       ${searchObj.term}
     </div>` : '';

  collage.innerHTML = `
    ${titleHtml}
    <div class="collage-viewport" style="overflow:hidden; width:100%; position:relative; border-radius:8px;">
      <div class="collage-track" style="display:flex; transition: transform 0.4s cubic-bezier(0.25, 1, 0.5, 1); will-change: transform;"></div>
    </div>
    <button class="collage-nav prev" style="position:absolute; left:6px; top:50%; transform:translateY(-50%); background:rgba(255,255,255,0.9); color:#000; border:none; border-radius:50%; width:32px; height:32px; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow: 0 2px 6px rgba(0,0,0,0.3); z-index:5;">❮</button>
    <button class="collage-nav next" style="position:absolute; right:6px; top:50%; transform:translateY(-50%); background:rgba(255,255,255,0.9); color:#000; border:none; border-radius:50%; width:32px; height:32px; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow: 0 2px 6px rgba(0,0,0,0.3); z-index:5;">❯</button>
  `;

  const track = collage.querySelector(".collage-track");

  selectedImages.forEach((src) => {
    const slide = document.createElement("div");
    // Flex genişliği: 100 / görünen sayısı
    slide.style.cssText = `
      flex: 0 0 ${100 / visible}%;
      max-width: ${100 / visible}%;
      padding: 4px;
      box-sizing: border-box;
    `;
    slide.innerHTML = `
      <div style="width:100%; height:160px; border-radius:8px; overflow:hidden; background:#e5e8ed; position:relative;">
        <img src="${src}" loading="lazy" style="width:100%; height:100%; object-fit:cover; display:block;">
      </div>
    `;
    track.appendChild(slide);
  });

  // Slider Güncelleme Fonksiyonu
  function update() {
    const total = selectedImages.length;
    // Maksimum kaydırma indisi: Toplam - Görünen
    // Örn: 6 resim var, 3 görünüyor -> Max index = 3 (0, 1, 2, 3)
    const max = Math.max(0, total - visible);
    
    // Index sınırla
    index = Math.max(0, Math.min(max, index));

    const stepPct = 100 / visible;
    const offsetPct = index * stepPct;
    track.style.transform = `translateX(-${offsetPct}%)`;
    
    const prevBtn = collage.querySelector(".collage-nav.prev");
    const nextBtn = collage.querySelector(".collage-nav.next");
    
    if (prevBtn) {
        prevBtn.style.opacity = index === 0 ? 0.3 : 1;
        prevBtn.style.pointerEvents = index === 0 ? 'none' : 'auto';
    }
    if (nextBtn) {
        nextBtn.style.opacity = index === max ? 0.3 : 1;
        nextBtn.style.pointerEvents = index === max ? 'none' : 'auto';
    }
  }

  const prevBtn = collage.querySelector(".collage-nav.prev");
  const nextBtn = collage.querySelector(".collage-nav.next");
  
  if (prevBtn) prevBtn.onclick = (e) => { 
      e.stopPropagation(); 
      index--; 
      update(); 
  };
  if (nextBtn) nextBtn.onclick = (e) => { 
      e.stopPropagation(); 
      index++; 
      update(); 
  };

  // Resize olayında slider'ı düzelt (Mobil/Desktop geçişi)
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => {
        // Ekran boyutuna göre visible'ı güncellememiz gerekirse buraya reload mantığı konabilir
        // Basit tutmak için sadece update çağırıyoruz.
        update();
    });
    ro.observe(collage);
  }

  update();
};