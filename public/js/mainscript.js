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

window.cart = window.cart || [];

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
const MAPBOX_TOKEN = "pk.eyJ1IjoiYWx0YW5kZW1pcmNhbiIsImEiOiJjbWRpaHFkZGIwZXd3Mm1yYjE2bWh3eHp5In0.hB1IaB766Iug4J26lt5itw";
window.MAPBOX_TOKEN = MAPBOX_TOKEN;
const GEOAPIFY_API_KEY = "d9a0dce87b1b4ef6b49054ce24aeb462";
window.GEOAPIFY_API_KEY = GEOAPIFY_API_KEY;

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
            "Plan a 2-day tour for Rome",
            "Do a 3 days city tour in Helsinki",
            "1-day city tour in Osaka"
        ];

        if (selectedOption) {
            const suggestion = document.createElement("div");
            suggestion.className = "category-area-option selected-suggestion";
            suggestion.innerText = selectedOption;

            const close = document.createElement("span");
            close.className = "close-suggestion";
            close.innerText = "✖";
            close.style.marginLeft = "8px";
            close.style.cursor = "pointer";
            close.onclick = function(e) {
                e.stopPropagation();
                selectedOption = null;
                chatInput.value = "";
                showSuggestions();
            };

            suggestion.appendChild(close);
            suggestionsDiv.appendChild(suggestion);
        } else {
            options.forEach(option => {
                const suggestion = document.createElement("div");
                suggestion.className = "category-area-option";
                suggestion.innerText = option;
                suggestion.onclick = () => {
                    selectedOption = option;
                    chatInput.value = "";
                    showSuggestions();
                };
                suggestionsDiv.appendChild(suggestion);
            });
        }
    }

    if (!chatInput) return;

    let chatSuggestions = document.getElementById("chat-location-suggestions");
    if (!chatSuggestions) {
        chatSuggestions = document.createElement("div");
        chatSuggestions.id = "chat-location-suggestions";
        chatSuggestions.className = "autocomplete-suggestions";
        const wrapper = chatInput.closest('.input-wrapper') || chatInput.parentNode;
        wrapper.appendChild(chatSuggestions);
    }

    let selectedSuggestion = null;
    let lastResults = [];

    async function geoapifyAutocomplete(query) {
        const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&limit=7&apiKey=${GEOAPIFY_API_KEY}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("API error");
        const data = await response.json();
        const sortedResults = sortLocations(data.features || []);
        return sortedResults;
    }

    function countryFlag(iso2) {
        if (!iso2) return "";
        return String.fromCodePoint(...[...iso2.toUpperCase()].map(c => 127397 + c.charCodeAt()));
    }

    function extractLocationQuery(input) {
        const match = input.match(/([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)?)/);
        if (match) return match[1];
        return input.split(" ")[0];
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

    // --- Instant suggestions (fastAutocomplete) ---
    let __autoAbort = null;
    function fastAutocomplete() {
      const chatInput = document.getElementById('user-input');
      const suggestionsDiv = document.getElementById('suggestions');
      if (!chatInput || !suggestionsDiv) return;
      if (window.selectedLocationLocked) return;

      const raw = chatInput.value.trim();
      if (raw.length < 2) {
        suggestionsDiv.innerHTML = "";
        suggestionsDiv.classList.add('hidden');
        return;
      }

      if (__autoAbort) __autoAbort.abort();
      __autoAbort = new AbortController();

      const seed = (typeof tt_extractSeedFromRaw === 'function')
        ? tt_extractSeedFromRaw(raw)
        : raw.split(/\s+/).pop();
      if (!seed || seed.length < 2) {
        suggestionsDiv.innerHTML = "";
        suggestionsDiv.classList.add('hidden');
        return;
      }

      suggestionsDiv.innerHTML = `<div class="category-area-option" style="opacity:.55;">Loading...</div>`;
      suggestionsDiv.classList.remove('hidden');

      geoapifyAutocomplete(seed, __autoAbort.signal)
        .then(results => {
          renderSuggestions(results || []);
        })
        .catch(err => {
          if (err.name === 'AbortError') return;
            suggestionsDiv.innerHTML = `<div class="category-area-option" style="opacity:.55;">No results</div>`;
          suggestionsDiv.classList.remove('hidden');
        });
    }

    (function attachLightAutocomplete(){
        const chatInput = document.getElementById("user-input");
        const suggestionsDiv = document.getElementById("suggestions");
        if (!chatInput || !suggestionsDiv) return;

        function debounce(fn, w=350){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),w);} }

        function tt_extractSeedFromRaw(raw){
            if (!raw || typeof raw !== 'string') return '';
            const original = raw.trim();
            let cleaned = original.replace(/\u0336/g, '').trim();
            cleaned = cleaned
                .replace(/\b(plan|planning|travel|trip|tour|itinerary|program|create|make|build|generate|please|show|give)\b/ig, ' ')
                .replace(/\b(for|in|to|a|an|the|of|city)\b/ig, ' ')
                .replace(/\d+\s*(?:-?\s*(day|days))\b/ig, ' ')
                .replace(/[,.;:!?]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            if (!cleaned) cleaned = original;
            const tokens = cleaned.split(/\s+/).filter(Boolean);
            if (!tokens.length) return '';
            for (let span = Math.min(4, tokens.length); span >= 2; span--) {
                const slice = tokens.slice(tokens.length - span);
                const candidate = slice.join(' ');
                if (/^[\p{L}0-9][\p{L}\p{M}0-9'’\-\s.]+$/u.test(candidate)) {
                    return candidate.split(/\s+/)
                        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(' ');
                }
            }
            const last = tokens[tokens.length - 1];
            return last.charAt(0).toUpperCase() + last.slice(1);
        }

        async function doAutocomplete(){
            if (window.selectedLocationLocked) return;
            const raw = chatInput.value.trim();
            if (raw.length < 2){
                suggestionsDiv.innerHTML="";
                suggestionsDiv.classList.add('hidden');
                return;
            }
            const dayMatch = raw.match(/(\d+)\s*-?\s*(day|gün)/i);
            let days = dayMatch ? parseInt(dayMatch[1],10) : 2;
            if (!days || days<1) days=2;

            const seed = tt_extractSeedFromRaw(raw);
            if (!seed || seed.length < 2){
                suggestionsDiv.innerHTML = "";
                suggestionsDiv.classList.add('hidden');
                return;
            }
            let results=[];
            try { results = await geoapifyAutocomplete(seed); } catch(e){ results=[]; }

            const filtered = results.filter(r=>{
                const p = r.properties||{};
                return (p.city||p.name) && (p.country || p.country_code);
            }).slice(0,7);

            if (!filtered.length){
                suggestionsDiv.innerHTML = `<div class="category-area-option" style="opacity:.6;">No results</div>`;
                suggestionsDiv.classList.remove('hidden');
                return;
            }

            suggestionsDiv.innerHTML="";
            filtered.forEach(f=>{
                const p=f.properties;
                const city=p.city||p.name;
                const country=p.country||p.country_code?.toUpperCase()||"";
                const flag=p.country_code
                    ? String.fromCodePoint(...[...p.country_code.toUpperCase()].map(c=>127397+c.charCodeAt()))
                    : "";
                const div=document.createElement("div");
                div.className="category-area-option";
                div.textContent=`${city}, ${country} ${flag}`.trim();
                div.onclick=()=>{
                    window.selectedLocation={
                        name:p.name||city,
                        city:city,
                        country:country,
                        lat:p.lat,
                        lon:p.lon,
                        country_code:p.country_code||""
                    };
                    window.selectedSuggestion={ displayText: div.textContent, props:p };
                    window.selectedLocationLocked = true;
                    window.__locationPickedFromSuggestions = true;
                    if (typeof setChatInputValue === 'function')
                        setChatInputValue(`Plan a ${days}-day tour for ${city}`);
                    else
                        chatInput.value = `Plan a ${days}-day tour for ${city}`;
                    suggestionsDiv.classList.add('hidden');
                    enableSendButton && enableSendButton();
                    updateCanonicalPreview();
                };
                suggestionsDiv.appendChild(div);
            });
        }

        chatInput.addEventListener("input", () => {
          if (window.__skipInputOnce) { window.__skipInputOnce = false; return; }
          fastAutocomplete();
        });
    })();

    function lockSelectedCity(city, days) {
        const chatInput = document.getElementById("user-input");
        if (!chatInput) return;
        if (!days || days < 1) days = 2;
        window.selectedLocation = {
            name: city,
            city: city,
            country: "",
            lat: null,
            lon: null,
            country_code: ""
        };
        window.selectedSuggestion = { displayText: city };
        const canon = formatCanonicalPlan(`${city} ${days} days`);
        const uiInput = document.getElementById('user-input');
        if (uiInput) uiInput.value = canon.canonical;
        chatInput.value = canon.canonical;
        window.selectedLocationLocked = true;
        enableSendButton();
        updateCanonicalPreview();
        const suggestionsDiv = document.getElementById("suggestions");
        if (suggestionsDiv) suggestionsDiv.classList.add('hidden');
    }

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
            if ([...suggestionsDiv.children].some(c => c.dataset.displayText === displayText)) return;

            const div = document.createElement("div");
            div.className = "category-area-option";
            div.textContent = displayText;
            div.dataset.displayText = displayText;

            if (window.selectedSuggestion && window.selectedSuggestion.displayText === displayText) {
                div.classList.add("selected-suggestion");
                const close = document.createElement("span");
                close.className = "close-suggestion";
                close.textContent = "✖";
                close.onclick = (e) => {
                    e.stopPropagation();
                    window.selectedSuggestion = null;
                    window.selectedLocation = null;
                    window.selectedLocationLocked = false;
                    window.__locationPickedFromSuggestions = false;
                    chatInput.value = "";
                    disableSendButton?.();
                    renderSuggestions(results);
                };
                div.appendChild(close);
            } else {
                div.onclick = () => {
                    const raw = chatInput.value.trim();
                    const dayMatch = raw.match(/(\d+)\s*-?\s*day/i) || raw.match(/(\d+)\s*-?\s*gün/i);
                    let days = dayMatch ? parseInt(dayMatch[1], 10) : 2;
                    if (!days || days < 1) days = 2;
                    window.selectedSuggestion = { displayText, props };
                    window.selectedLocation = {
                        name: props.name || city,
                        city: city,
                        country: country,
                        lat: props.lat ?? props.latitude ?? null,
                        lon: props.lon ?? props.longitude ?? null,
                        country_code: props.country_code || ""
                    };
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
                    hideSuggestionsDiv?.();
                    if (typeof updateCanonicalPreview === "function") {
                        updateCanonicalPreview();
                    }
                };
            }
            suggestionsDiv.appendChild(div);
        });
        if (suggestionsDiv.children.length > 0) {
            showSuggestionsDiv?.();
        } else {
            hideSuggestionsDiv?.(true);
        }
    }

    // (REMOVED BRANCH) countryPopularCities based suggestion override
    chatInput.addEventListener("input", debounce(async function () {
        const queryText = this.value.trim();
        if (queryText.length < 2) {
            document.getElementById("chat-location-suggestions").style.display = "none";
            document.getElementById("suggestions").classList.add('hidden');
            return;
        }
        const locationQuery = extractLocationQuery(queryText);
        const suggestions = await geoapifyAutocomplete(locationQuery);
        window.lastResults = suggestions;
        document.getElementById("chat-location-suggestions").style.display = "none";
        renderSuggestions(suggestions);
    }, 400));

    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    chatInput.addEventListener("input", debounce(async function () {
        const queryText = this.value.trim();
        if (queryText.length < 2) {
            chatSuggestions.innerHTML = "";
            chatSuggestions.style.display = "none";
            return;
        }
        const locationQuery = extractLocationQuery(queryText);
        const suggestions = await geoapifyAutocomplete(locationQuery);
        lastResults = suggestions;
        renderSuggestions(suggestions);
    }, 400));

    chatInput.addEventListener("focus", function () {
        if (lastResults.length) renderSuggestions(lastResults);
    });

    document.addEventListener("mousedown", function (event) {
        if (!chatSuggestions.contains(event.target) && event.target !== chatInput) {
            if (!selectedSuggestion) chatSuggestions.style.display = "none";
        }
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
            question: "Let's get started. Please specify a location, duration, and the type of trip you want.",
            options: [
                { name: "Plan a 2-day tour for Romet" },
                { name: "Do a 3-day city tour in Helsinki" },
                { name: "Do a 1-day city tour in Osaka" },
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
      const url = buildMapboxDirectionsUrl(coordParam, day); // <-- day eklendi
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

    // İngilizce cümlelerin sonundaki şehir adını bul (ör: in Helsinki)
    let cityMatch = text.match(/(?:in|for|to)\s+([A-Za-zçğıöşüÇĞİÖŞÜ0-9'’\s]+)$/i);
    if (cityMatch) {
        location = cityMatch[1].trim();
    }

    // 4-day, 3 day vb. gün sayısını bul
    let dayMatch = text.match(/(\d+)[- ]*day/);
    if (dayMatch) {
        days = parseInt(dayMatch[1]);
    }

    // Türkçe "2 gün", "Roma 2 gün" vb.
    if (!days) {
        let trMatch = text.match(/([A-Za-zçğıöşüÇĞİÖŞÜ0-9'’\s]+)[, ]+(\d+)[, ]*gün/i);
        if (trMatch) {
            location = trMatch[1].trim();
            days = parseInt(trMatch[2]);
        }
    }

    // Sadece şehir adı (tek kelime)
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
// === CANONICAL PLAN FORMATTER (English-only) ===
// === Canonical Plan Normalizer & Strikethrough Helpers ===
function formatCanonicalPlan(rawInput) {
    if (!rawInput || typeof rawInput !== 'string')
        return { canonical: "", city: "", days: 1, changed: false };

    let raw = rawInput.replace(/\u0336/g, '').trim(); // strip combining strikethrough if any

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
function selectSuggestion(option) {
    const userInput = document.getElementById("user-input");
    userInput.value = option;
    if (isFirstQuery) {
        handleAnswer(option);
    } else {
        // For subsequent queries, just populate the input field
        userInput.focus();
    }
}
function handleKeyPress(event) {
  if (event.key !== "Enter") return;
  if (window.isProcessing) {
    event.preventDefault();
    return;
  }
  sendMessage();
  event.preventDefault();
}
// Basit şehir adı normalizasyonu (ör: "rome", "ROMe  " -> "Rome")
function normalizeCityName(raw) {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

// Kullanıcı girdisinden (örn: "Plan a 2-day tour for Rome") şehir + gün çekmeye çalış
function extractCityAndDays(query) {
  let days = null;
  let city = null;

  // ör: "Plan a 2-day tour for Rome"
  const dayMatch = query.match(/(\d+)\s*-?\s*day/i);
  if (dayMatch) days = parseInt(dayMatch[1], 10);

  // "for X", "in X", "to X" kalıbı
  const cityMatch = query.match(/\b(?:for|in|to)\s+([A-Za-zÇĞİÖŞÜçğıöşü'’\-\s]{2,})$/i);
  if (cityMatch) {
    city = cityMatch[1].trim();
  } else {
    // Sonda tek kelime ihtimali
    const tail = query.trim().split(/\s+/).pop();
    if (tail && /^[A-Za-zÇĞİÖŞÜçğıöşü'’-]{2,}$/.test(tail)) {
      city = tail;
    }
  }

  if (!days || isNaN(days) || days < 1) days = 2;
  city = normalizeCityName(city);
  return { city, days };
}

// Geocode doğrulama (cache ile)
const __cityCoordCache = new Map();


(function unifyChatInputListener(){
  // DEVRE DISI: Lokasyon kilit mantığını bozduğundan kapatıldı
  return;
})();

chatInput.addEventListener("input", function() {
    // Kullanıcı kilitli formatı bozdu mu?
    if (window.selectedLocationLocked) {
        if (!/^Plan a \d+-day tour for /.test(this.value.trim())) {
            window.selectedLocationLocked = false;
            window.selectedLocation = null;
            disableSendButton();
        }
    }
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
    addMessage("Please enter a location request (e.g. 'Rome 2 days').", "bot-message");
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

  try {
    // Mevcut parse fonksiyonunu kullanıyoruz
    const { location, days } = parsePlanRequest(raw);

    // parsePlanRequest beklenen alanları çıkaramadıysa
    if (!location || !days || isNaN(days)) {
      addMessage("I could not understand that. Try for example: 'Paris 3 days' or 'Plan a 2-day tour for Rome'.", "bot-message");
      return;
    }

    // Ekstra gürültü filtresi
    if (location.length < 2) {
      addMessage("Location name looks too short. Please clarify (e.g. 'Osaka 1 day').", "bot-message");
      return;
    }

    window.selectedCity = location; // Diğer kodların beklentisini bozmuyoruz

  

    // OTOMATİK PLAN ÜRETİMİ (mevcut davranışı koru)
    latestTripPlan = await buildPlan(location, days);
    latestTripPlan = await enrichPlanWithWiki(latestTripPlan);

    if (latestTripPlan && latestTripPlan.length > 0) {
      window.latestTripPlan = JSON.parse(JSON.stringify(latestTripPlan));
      window.cart = JSON.parse(JSON.stringify(latestTripPlan));
      saveCurrentTripToStorage();

      showResults();
      updateTripTitle();

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

function sendMessage() {
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
    chatBox.scrollTop = chatBox.scrollHeight;
}

 function showTypingIndicator() {
    const chatBox = document.getElementById("chat-box"); // <-- EKLE!
    let indicator = document.getElementById("typing-indicator");
    if (!indicator) {
        indicator = document.createElement("div");
        indicator.id = "typing-indicator";
        indicator.textContent = "Typing...";

        indicator.style = "padding:8px 0;color:#888; font-style: italic;";
        chatBox.appendChild(indicator);
    } else {
        indicator.style.display = "block";
    }
    chatBox.scrollTop = chatBox.scrollHeight;
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

// See travel themes
document.querySelectorAll('.gallery-item').forEach(item => {
  // Tüm itema tıklama
  item.addEventListener('click', function() {
    const themeTitle = item.querySelector('.caption p').textContent.trim();
    document.getElementById('user-input').value = themeTitle;
    if (typeof updateSuggestions === 'function') {
      updateSuggestions(themeTitle);
    }
    document.getElementById('user-input').focus();
    // sendMessage(); // otomatik gönderilmesini istiyorsan aç
  });
});

// Sadece add_theme ikonuna tıklama ile eklemek istersen
document.querySelectorAll('.add_theme').forEach(btn => {
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    const themeTitle = btn.parentNode.querySelector('.caption p').textContent.trim();
    document.getElementById('user-input').value = themeTitle;
    if (typeof updateSuggestions === 'function') {
      updateSuggestions(themeTitle);
    }
    document.getElementById('user-input').focus();
    // sendMessage(); // otomatik gönderilmesini istiyorsan aç
  });
});

// .addtotrip butonuna basıldığında day bilgisini stepsDiv'den veya window.currentDay'den al.
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

        // Gün bilgisini stepsDiv'den ya da window.currentDay'den al
        const day = stepsDiv.getAttribute('data-day') || window.currentDay || 1;
        const category = stepsDiv.getAttribute('data-category');
        const title = stepsDiv.querySelector('.title')?.textContent.trim() || '';
        const image = stepsDiv.querySelector('img.check')?.src || 'img/placeholder.png';
        const address = stepsDiv.querySelector('.address')?.textContent.replace(/^[^:]*:\s*/, '').trim() || '';
        const opening_hours = stepsDiv.querySelector('.opening_hours')?.textContent.replace(/^[^:]*:\s*/, '').trim() || '';
        const lat = stepsDiv.getAttribute('data-lat');
        const lon = stepsDiv.getAttribute('data-lon');
        const website = (stepsDiv.querySelector('[onclick*="openWebsite"]')?.getAttribute('onclick')?.match(/'([^']+)'/) || [])[1] || '';

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
            (lat && lon) ? { lat: Number(lat), lng: Number(lon) } : null,
            website
        );
        
        btn.classList.add('added');
        setTimeout(() => btn.classList.remove('added'), 1000);
        
        if (typeof restoreSidebar === "function") restoreSidebar();
    };

    document.addEventListener('click', listener);
    window.__triptime_addtotrip_listener = listener;
}

// Listener'ı başlat
initializeAddToTripListener();

let selectedCity = null;
let selectedDays = null;
let isProcessing = false;


async function getLLMResponse(aiData) {
    const response = await fetch('http://tripplan.online:3001/llm-proxy/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiData)
    });
    return response.json();
}



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

async function getAICategories(city, days) {
    try {
        const response = await fetch('/llm-proxy/suggest-categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ city, days })
        });
        return await response.json();
    } catch (error) {
        return [];
    }
}

async function generateAINotes(name, city, category) {
    try {
        const response = await fetch('/llm-proxy/generate-notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, city, category })
        });
        const data = await response.json();
        return data.notes;
    } catch (error) {
        return "";
    }
}

async function generateAITags(name, category) {
    try {
        const response = await fetch('/llm-proxy/generate-tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, category })
        });
        const data = await response.json();
        return data.tags;
    } catch (error) {
        return [];
    }
}

function showAITags(place) {
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'ai-tags';
    
    place.ai_tags.forEach(tag => {
        const tagElement = document.createElement('span');
        tagElement.textContent = `#${tag}`;
        tagsContainer.appendChild(tagElement);
    });
    
    return tagsContainer;
}

async function fillAIDescriptionsAutomatically() {
    document.querySelectorAll('.steps').forEach(async stepsDiv => {
        const infoView = stepsDiv.querySelector('.item-info-view, .info.day_cats');
        if (!infoView) return;
        const descriptionDiv = infoView.querySelector('.description');
        if (!descriptionDiv) return;
        if (descriptionDiv.dataset.aiFilled) return;

        // Loading animasyonu göster
        descriptionDiv.innerHTML = `
            <img src="img/information_icon.svg">
            <span class="ai-guide-loading">
                AI Guide loading...
                <span class="dot-anim">.</span>
                <span class="dot-anim">.</span>
                <span class="dot-anim">.</span>
            </span>
        `;

        const name = infoView.querySelector('.title')?.textContent?.trim() || '';
        const address = infoView.querySelector('.address')?.textContent?.replace(/^[^:]*:\s*/, '').trim() || '';
        const city = window.selectedCity || '';
        const category = stepsDiv.getAttribute('data-category') || '';

        if (!name || !city) return;

            try {
        const resp = await fetch('/llm-proxy/item-guide', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, address, city, category }),
        });
        const data = await resp.json();
        if (data.text) {
            descriptionDiv.innerHTML = `<img src="img/information_icon.svg"> ${data.text}`;
            descriptionDiv.dataset.aiFilled = "1";
        } else {
            descriptionDiv.innerHTML = `<img src="img/information_icon.svg"> <span class="error">${data.error || "AI description could not be retrieved."}</span>`;
        }
    } catch {
        descriptionDiv.innerHTML = `<img src="img/information_icon.svg"> <span class="error">AI servisine erişilemedi.</span>`;
    }
});
}

let hasAutoAddedToCart = false;
function showResults() {

    // Eski chat balonlarında kalmış route-map-day* kalıntılarını temizle (opsiyonel güvenlik)
    (function cleanupChatRouteArtifacts(){
        const chatBox = document.getElementById("chat-box");
        if (!chatBox) return;
        chatBox.querySelectorAll('[id^="route-map-day"]').forEach(el => {
            // Sadece chat balonlarının içindeyse sil (sidebar’daki day-container değilse)
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
        // window.cart senkronize
        window.cart = window.latestTripPlan.map(item => {
            let loc = null;
            if (item.location && typeof item.location.lat !== "undefined" && typeof item.location.lng !== "undefined") {
                loc = { lat: Number(item.location.lat), lng: Number(item.location.lng) };
            } else if (item.lat && item.lon) {
                loc = { lat: Number(item.lat), lng: Number(item.lon) };
            }
            return { ...item, location: loc };
        });
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

    const days = Math.max(...latestTripPlan.map(item => item.day));
    for (let day = 1; day <= days; day++) {
        let stepsHtml = '';
        const daySteps = [];

        // Aynı sırayı (Coffee → Attraction → Restaurant → Accommodation) koru
        for (const cat of dailyCategories) {
            const step = latestTripPlan.find(item =>
                item.day == day &&
                (item.category === cat.en || item.category === cat.tr)
            );
            if (step) {
                daySteps.push(step);
                stepsHtml += generateStepHtml(step, day, cat.en);
            }
        }

        const dayId = `day-${day}`;

        // 1 item için uyarıyı chat’te de göstermek istersen:
        if (daySteps.length === 1) {
            stepsHtml += `<p class="one-item-message">Add one more item to optimize the route (shown in sidebar)!</p>`;
        }

        // ÖNEMLİ: mapControlsHtml TAMAMEN KALDIRILDI (chat içinde harita yok)
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
    chatBox.scrollTop = chatBox.scrollHeight;

    // AI açıklamaları
    setTimeout(fillAIDescriptionsSeq, 300);
    setTimeout(fillAIDescriptionsAutomatically, 300);

    // Sepeti (sidebar) doldur
    if (typeof addChatResultsToCart === "function" && !window.hasAutoAddedToCart) {
        try {
            addChatResultsToCart();
            window.hasAutoAddedToCart = true;
        } catch (e) {}
    }

    if (typeof makeChatStepsDraggable === "function") makeChatStepsDraggable();

    // Rotayı sadece sidebar tarafı için asenkron çiz (gün 1 örneği)
    setTimeout(() => {
        if (typeof getDayPoints === 'function') {
            const pts = getDayPoints(1);
            if (Array.isArray(pts) && pts.length >= 2) {
                // Sadece sidebar day-container içinde route-map-day1 varsa çizilecek
                renderRouteForDay(1);
            }
        }
    }, 500);

    updateCart();

    // Thumbnail / trip kaydı
    saveCurrentTripToStorageWithThumbnailDelay();
    setTimeout(() => {
        saveCurrentTripToStorageWithThumbnail().then(renderMyTripsPanel);
    }, 1200);
}

async function fillAIDescriptionsSeq() {
    const steps = Array.from(document.querySelectorAll('.steps'));
    for (const stepsDiv of steps) {
        const infoView = stepsDiv.querySelector('.item-info-view, .info.day_cats');
        if (!infoView) continue;
        const descriptionDiv = infoView.querySelector('.description');
        if (!descriptionDiv) continue;
        if (descriptionDiv.dataset.aiFilled) continue;

        descriptionDiv.innerHTML = `
            <img src="img/information_icon.svg">
            <span class="ai-guide-loading">
                AI Guide loading...
                <span class="dot-anim">.</span>
                <span class="dot-anim">.</span>
                <span class="dot-anim">.</span>
            </span>
        `;

        const name = infoView.querySelector('.title')?.textContent?.trim() || '';
        const address = infoView.querySelector('.address')?.textContent?.replace(/^[^:]*:\s*/, '').trim() || '';
        const city = window.selectedCity || '';
        const category = stepsDiv.getAttribute('data-category') || '';

        if (!name || !city) continue;

        try {
            const resp = await fetch('/llm-proxy/item-guide', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, address, city, category })
            });
            const data = await resp.json();
            if (data.text) {
                descriptionDiv.innerHTML = `<img src="img/information_icon.svg"> ${data.text}`;
                descriptionDiv.dataset.aiFilled = "1";
            } else {
                descriptionDiv.innerHTML = `<img src="img/information_icon.svg"> <span class="error">${data.error || "AI açıklama alınamadı."}</span>`;
            }
        } catch {
            descriptionDiv.innerHTML = `<img src="img/information_icon.svg"> <span class="error">AI servisine erişilemedi.</span>`;
        }
    }
}

// 3. Frontend'de metni biçimlendirme
/*function formatAIResponse(text) {
    const paragraphs = text.split("\n\n").filter(p => p.trim().length > 0);
    return paragraphs.map(p => `<p>${p}</p>`).join('');
}*/

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
            case "Touristic attraction": return "img/tourist_icon.svg";
            case "Restaurant": return "img/restaurant_icon.svg";
            case "Accommodation": return "img/accommodation_icon.svg";
            default: return "https://www.svgrepo.com/show/522166/location.svg";
        }
    }

function generateStepHtml(step, day, category, idx = 0) {
    const name = step?.name || category;
    const address = step?.address || "";
    const image = step?.image || "https://www.svgrepo.com/show/522166/location.svg";
    const website = step?.website || "";
    const opening = step?.opening_hours || "";
    const lat = step?.lat || (step?.location?.lat || step?.location?.latitude);
    const lon = step?.lon || (step?.location?.lon || step?.location?.lng || step?.location?.longitude);

    let catIcon = "https://www.svgrepo.com/show/522166/location.svg";
    if (category === "Coffee" || category === "Breakfast" || category === "Cafes")
        catIcon = "img/coffee_icon.svg";
    else if (category === "Touristic attraction")
        catIcon = "img/touristic_icon.svg";
    else if (category === "Restaurant" || category === "Restaurants")
        catIcon = "img/restaurant_icon.svg";
    else if (category === "Accommodation")
        catIcon = "img/accommodation_icon.svg";

    return `
    <div class="steps" data-day="${day}" data-category="${category}"${lat && lon ? ` data-lat="${lat}" data-lon="${lon}"` : ""}>
        <div class="visual" style="opacity: 1;">
           <img class="check" src="${image}" alt="${name}" onerror="this.onerror=null; this.src='img/placeholder.png';">
        </div>
        <div class="info day_cats item-info-view">
            <div class="title">${name}</div>
            <div class="address">
                <img src="img/address_icon.svg"> ${address}
            </div>
            <div class="description" data-original-description="No detailed description.">
                <img src="img/information_icon.svg">
                <span class="ai-guide-loading">
                  AI Guide loading...
                  <span class="dot-anim">.</span>
                  <span class="dot-anim">.</span>
                  <span class="dot-anim">.</span>
                </span>
            </div>
            <div class="opening_hours">
<img src="img/hours_icon.svg"> ${opening ? opening : "Opening hours not found."}
            </div>
        </div>
        <div class="item_action">
            <div class="change">
                <span onclick="window.showImage && window.showImage(this)">
                    <img src="img/camera_icon.svg">
                </span>
                <span onclick="window.showMap && window.showMap(this)">
                    <img src="img/map_icon.svg">
                </span>
                ${website ? `
                <span onclick="window.openWebsite && window.openWebsite(this, '${website}')">
                    <img src="img/website_link.svg" style="vertical-align:middle;width:20px;">
                </span>
                ` : ""}
            </div>
            <div style="display: flex; gap: 12px;">
                <div class="cats cats${idx % 5 + 1}">
                    <img src="${catIcon}" alt="${category}"> ${category}
                </div>
                <a class="addtotrip">
                    <img src="img/addtotrip-icon.svg">
                </a>
            </div>
        </div>
    </div>
    `;
}



const placeCategories = {
    "Coffee": "catering.cafe",           
    "Touristic attraction": "tourism.sights",         
    "Restaurant": "catering.restaurant",
    "Accommodation": "accommodation.hotel"
};




window.showSuggestionsInChat = async function(category, day = 1) {
// Expanded map açıksa kapat!
if (window.expandedMaps) {
    Object.keys(window.expandedMaps).forEach(containerId => {
        const expanded = window.expandedMaps[containerId];
        if (expanded && typeof restoreMap === "function") {
            restoreMap(containerId, expanded.day);
        }
    });
}    
    const city = window.selectedCity || document.getElementById("city-input")?.value;
    if (!city) {
addMessage("Please select a city first.", "bot-message");
        return;
    }
    if (!geoapifyCategoryMap[category]) {
addMessage(`No place category found for "${category}".`, "bot-message");
        return;
    }
    const places = await getPlacesForCategory(city, category, 5);
    if (!places.length) {
addMessage(`No places found for this category in "${city}".`, "bot-message");
        return;
    }
    await enrichCategoryResults(places, city);
    displayPlacesInChat(places, category, day);
    if (typeof makeChatStepsDraggable === "function") makeChatStepsDraggable();

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
  const categories = ["Coffee", "Touristic attraction", "Restaurant", "Accommodation"];
  let plan = [];
  let categoryResults = {};

  for (const cat of categories) {
    categoryResults[cat] = await getPlacesForCategory(city, cat, 30);
  }

  for (let day = 1; day <= days; day++) {
    let dailyPlaces = [];
    let usedIndexes = {};
    for (const cat of categories) {
      const places = categoryResults[cat];
      if (places.length > 0) {
        let idx;
        do {
          idx = Math.floor(Math.random() * places.length);
        } while (usedIndexes[cat] && usedIndexes[cat].includes(idx) && usedIndexes[cat].length < places.length);

        usedIndexes[cat] = usedIndexes[cat] || [];
        usedIndexes[cat].push(idx);

        dailyPlaces.push({ day, category: cat, ...places[idx] });
      } else {
        dailyPlaces.push({ day, category: cat, name: cat, address: "No address found" });
      }
    }

    // Günün toplam rotasını limitle: day ile çağır!
    const limitedPlaces = await limitDayRouteToMaxDistance(
      dailyPlaces.filter(p => p.lat && p.lon),
      day,            // <-- eklendi
      10
    );
    if (limitedPlaces.length < categories.length) {
      plan = plan.concat(dailyPlaces);
    } else {
      plan = plan.concat(limitedPlaces);
    }
  }

  plan = await enrichPlanWithWiki(plan);
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


function addChatResultsToCart() {
    // Eğer cart zaten doluysa tekrar ekleme!
    if (window.cart && window.cart.length > 0) return;

    const chatResults = document.querySelectorAll(".steps");
    const sorted = Array.from(chatResults).sort((a, b) => {
        const dayA = Number(a.getAttribute('data-day') || 1);
        const dayB = Number(b.getAttribute('data-day') || 1);
        if (dayA !== dayB) return dayA - dayB;
        const catA = a.getAttribute('data-category') || '';
        const catB = b.getAttribute('data-category') || '';
        const catOrder = ["Coffee", "Touristic attraction", "Restaurant", "Accommodation"];
        return catOrder.indexOf(catA) - catOrder.indexOf(catB);
    });

    sorted.forEach(result => {
        const day = Number(result.getAttribute('data-day') || 1);
        const category = result.getAttribute('data-category');
        const name = result.querySelector('.title').textContent;
        const image = result.querySelector('img.check').src;
        const lat = result.getAttribute('data-lat');
        const lon = result.getAttribute('data-lon');
        // Sadece lat/lon varsa ekle!
        if (lat && lon) {
            addToCart(
                name,
                image,
                day,
                category,
                result.querySelector('.address')?.textContent.replace(/^[^:]*:\s*/, '').trim() || '',
                null, null,
                result.querySelector('.opening_hours')?.textContent.replace(/^[^:]*:\s*/, '').trim() || '',
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

    // DOM'daki gerçek koordinatı oku:
    const lat = parseFloat(stepsElement.getAttribute('data-lat'));
    const lon = parseFloat(stepsElement.getAttribute('data-lon'));

    if (!isNaN(lat) && !isNaN(lon)) {
        const delta = 0.001;
        const iframeHTML = `<iframe class="gmap-chat" src="https://www.openstreetmap.org/export/embed.html?bbox=${lon-delta},${lat-delta},${lon+delta},${lat+delta}&layer=mapnik&marker=${lat},${lon}" width="100%" height="250" frameborder="0" style="border:0"></iframe>`;
        const oldIframe = visualDiv.querySelector('iframe.gmap-chat');
        if (oldIframe) oldIframe.remove();
        image.style.display = "none";
        visualDiv.insertAdjacentHTML('beforeend', iframeHTML);
    } else {
        alert("Location not found.");
    }
};

    window.showImage = function (element) {
        const visualDiv = element.closest('.steps').querySelector('.visual');
        const image = visualDiv.querySelector('img.check');
        const iframe = visualDiv.querySelector('iframe.gmap-chat');
        if (iframe) iframe.remove();
        if (image) image.style.display = '';
    };

    document.getElementById("send-button").addEventListener("click", sendMessage);
    userInput.addEventListener("keypress", handleKeyPress);

    displayQuestion();
});



// Kategori adı ile Geoapify kodu eşleştirme (kategori seçiminde kullanılacak)
const geoapifyCategoryMap = {
  // Basic Plan
  "Coffee": "catering.cafe",
  "Touristic attraction": "tourism.sights",
  "Restaurant": "catering.restaurant",
  "Accommodation": "accommodation.hotel",
  // Traveler Needs (20 ana kategori)
  "Bar": "catering.bar",
  "Fast Food": "catering.fast_food",
  "Supermarket": "commercial.supermarket",
  "Bakery": "catering.bakery",
  "Nightclub": "entertainment.nightclub",
  "Cinema": "entertainment.cinema",
  "Art Gallery": "entertainment.gallery",
  "Theatre": "entertainment.theatre",
  "Casino": "entertainment.casino",
  "Theme Park": "tourism.theme_park",
  "Zoo": "tourism.zoo",
  "Aquarium": "tourism.aquarium",
  "Viewpoint": "tourism.view_point",
  "Mall": "shopping.mall",
  "Bookstore": "commercial.books",
  "ATM": "service.atm",
  "Pharmacy": "healthcare.pharmacy",
  "Hospital": "healthcare.hospital",
  "Police": "service.police",
  "Airport": "transport.airport"
};

// 2. Şehir koordinatlarını almak için fonksiyon (Geoapify geocode API)
async function getCityCoordinates(city) {
    const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(city)}&limit=1&apiKey=${GEOAPIFY_API_KEY}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.features && data.features.length > 0) {
        const f = data.features[0];
        return { lat: f.properties.lat, lon: f.properties.lon };
    }
    return null;
}




// 3. getPlacesForCategory (lat/lon number olarak!)
async function getPlacesForCategory(city, category, limit = 4, radius = 3000) {
    const geoCategory = geoapifyCategoryMap[category] || placeCategories[category];
    if (!geoCategory) {
        console.warn("Kategori haritada bulunamadı:", category);
        return [];
    }
    const coords = await getCityCoordinates(city);
    if (!coords || !coords.lat || !coords.lon) return [];
    const url = `https://api.geoapify.com/v2/places?categories=${geoCategory}&filter=circle:${coords.lon},${coords.lat},${radius}&limit=${limit}&apiKey=${GEOAPIFY_API_KEY}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.features && data.features.length > 0) {
        const filtered = data.features.filter(f =>
            !!f.properties.name && f.properties.name.trim().length > 2
        );
        return filtered.map(f => ({
            name: f.properties.name,
            address: f.properties.formatted || "",
            lat: Number(f.properties.lat),
            lon: Number(f.properties.lon),
            website: f.properties.website || '',
            opening_hours: f.properties.opening_hours || '',
            categories: f.properties.categories || [],
            city: city,
            properties: f.properties
        }));
    }
    return [];
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
    { en: "Touristic attraction" },
    { en: "Restaurant" },
    { en: "Accommodation" }
];
const chatCategories = ["Coffee", "Touristic attraction", "Restaurant", "Accommodation"];


const categoryIcons = {
    "Coffee": "img/coffee_icon.svg",
    "Touristic attraction": "img/touristic_icon.svg",   
    "Restaurant": "img/restaurant_icon.svg",
    "Accommodation": "img/accommodation_icon.svg"
};


function addToCart(
  name,
  image,
  day,
  category,
  address = null,
  rating = null,
  user_ratings_total = null,
  opening_hours = null,
  place_id = null,
  location = null,
  website = null,
  options = {}
) {
  const {
    silent = false,
    skipRender = false,
    forceDay = null
  } = options || {};

  // ---- 1) Placeholder temizliği (ilk gerçek ekleme)
  if (window._removeMapPlaceholderOnce) {
    window.cart = (window.cart || []).filter(it => !it._placeholder);
    window._removeMapPlaceholderOnce = false;
  }

  // ---- 2) Cart yapısını garanti et
  if (!Array.isArray(window.cart)) {
    window.cart = [];
  }

  // ---- 3) Gün seçimi mantığı
  // priority: forceDay > explicit day arg > window.currentDay > son öğenin günü > 1
  let resolvedDay = Number(
    (forceDay != null ? forceDay :
     (day != null ? day :
      (window.currentDay != null ? window.currentDay :
       (window.cart.length ? window.cart[window.cart.length - 1].day : 1))))
  );
  if (!Number.isFinite(resolvedDay) || resolvedDay <= 0) resolvedDay = 1;

  // ---- 4) Lokasyon normalizasyonu
  let loc = null;
  if (location && typeof location.lat !== "undefined" && typeof location.lng !== "undefined") {
    const latNum = Number(location.lat);
    const lngNum = Number(location.lng);
    if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
      loc = { lat: latNum, lng: lngNum };
    }
  }

  // ---- 5) İsim / kategori / image fallback
  const safeName = (name || '').toString().trim();
  const safeCategory = (category || 'Place').trim();
  const safeImage = image || 'img/placeholder.png';

  // ---- 6) Duplicate kontrolü
  // Aynı gün + aynı isim (case-insensitive trim) + aynı kategori + (aynı koordinatlar veya ikisi de koordinatsız)
  const isDuplicate = window.cart.some(item => {
    if (item.day !== resolvedDay) return false;
    if (!item.name || !safeName) return false;
    if (item.category !== safeCategory) return false;
    const sameName = item.name.trim().toLowerCase() === safeName.toLowerCase();
    if (!sameName) return false;

    // Koordinat karşılaştırması
    if (loc && item.location) {
      return item.location.lat === loc.lat && item.location.lng === loc.lng;
    }
    if (!loc && !item.location) return true;
    return false;
  });

  if (isDuplicate) {
    // İstersen burada kısa bir toast gösterebilirsin:
    if (window.showToast) window.showToast('Item already exists for this day.', 'info');
    return false;
  }

  // ---- 7) Yeni öğe
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
// --- İlk gerçek nokta sonrası auto-expand (planlama aktifse) ---
// --- İlk gerçek nokta / mini harita gösterimi ---
try {
  if (!newItem._starter && newItem.location) {
    const day = newItem.day;
    const realPoints = window.cart.filter(it =>
      it.day === day &&
      it.location &&
      !it._starter &&
      !it._placeholder
    ).length;
 
    if (realPoints === 1) {
      if (window.__suppressMiniUntilFirstPoint && window.__suppressMiniUntilFirstPoint[day]) {
        delete window.__suppressMiniUntilFirstPoint[day];
      }
      ensureDayMapContainer(day);
      const mini = document.getElementById(`route-map-day${day}`);
      if (mini) mini.classList.remove('mini-suppressed');
      if (typeof renderRouteForDay === 'function') {
        setTimeout(() => renderRouteForDay(day), 0);
      }
    } else if (realPoints > 1) {
      if (typeof renderRouteForDay === 'function') {
        setTimeout(() => renderRouteForDay(day), 0);
      }
    }
  }
} catch (e) {
  console.warn('[mini map first point]', e);
}
  // ---- 8) UI güncellemesi
  // silent = true ise hiçbir şey yapma (batch import için)
  if (!silent) {
    if (typeof updateCart === "function") {
      updateCart(); // Gün & map container yenilensin
    }

    // skipRender değilse rota/haritayı güncelle (0-1-2+ senaryosunu hallediyor)
    if (!skipRender && typeof renderRouteForDay === "function") {
      // DOM güncellemeleri bitti & Leaflet detach riskini azalt
      setTimeout(() => renderRouteForDay(resolvedDay), 0);
    }
  }

  // ---- 9) Sidebar aç (mobil)
  if (!silent && typeof openSidebar === 'function') {
    openSidebar();
    if (window.innerWidth <= 768) {
      const sidebar = document.querySelector('.sidebar-overlay.sidebar-trip');
      if (sidebar) sidebar.classList.add('open');
    }
  }

  // ---- 10) Drag-drop vb. ek entegrasyonlar
  if (!silent && typeof attachChatDropListeners === 'function') {
    attachChatDropListeners();
  }

  return true;
}
(function attachGpsImportClick(){
  if (window.__gpsImportHandlerAttached) return;

  document.addEventListener('click', function(e){
    const btn = e.target.closest('.gps-import');
    if (!btn) return;

    // Dosya seçim input’u
    const pickFile = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.gpx,.kml,.tcx,.fit';
      input.onchange = async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        try {
          if (btn.dataset.global === '1') {
            // Global başlangıç: Day 1’i garanti et
            if (!Array.isArray(window.cart) || window.cart.length === 0) {
              window.cart = [];
            }
            // Day 1 gerçek item yoksa (starter vs temizle)
            window.cart = window.cart.filter(it => !(it._starter || it._placeholder));

            await importGpsFileForDay(file, 1);  // importGpsFileForDay fonksiyonun zaten varsa onu kullan
          } else {
            const day = Number(btn.dataset.day);
            if (!day) return;
            // Gün dolu kontrolü
            const hasItems = window.cart.some(it =>
              it.day === day &&
              it.name &&
              !it._starter &&
              !it._placeholder
            );
            if (hasItems) {
              alert(`Day ${day} is not empty. Remove items first to import a GPS track.`);
              return;
            }
            await importGpsFileForDay(file, day);
          }
        } catch(err) {
          console.error('GPS import failed:', err);
          alert('GPS file could not be imported.');
        }
      };
      input.click();
    };

    pickFile();
  });

  window.__gpsImportHandlerAttached = true;
})();

/* === GPS IMPORT CORE (minimal) === */
/* Day boşluk kontrolü (updateCart içindeki mantıkla uyumlu tutuyoruz) */
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

/* Ana import fonksiyonu */
async function importGpsFileForDay(file, day){
  console.log('[GPS] import start', file.name, '→ day', day);
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const text = await file.text();

  let points = [];
  if (ext === 'gpx') points = parseGpxToLatLng(text);
  else if (ext === 'kml') points = parseKmlToLatLng(text);
  else throw new Error('Unsupported file type: ' + ext);

  if (!points.length) throw new Error('No coordinates found in file.');

  if (!__dayIsEmpty(day)) {
    console.warn('[GPS] Day not empty, aborting.');
    return;
  }

  // Starter & placeholder temizle
  window.cart = window.cart.filter(it => !it._starter && !it._placeholder);

  // Track meta kaydet (ham çizim modu)
  window.importedTrackByDay = window.importedTrackByDay || {};
  window.importedTrackByDay[day] = {
    rawPoints: points.map(p => ({ lat: p.lat, lng: p.lng, time: p.time || null })),
    drawRaw: true,
    fileName: file.name
  };

  const start = points[0];
  const finish = points[points.length - 1];

  // Aynı koordinatsa tek item ekle
  const baseName = file.name.replace(/\.[^.]+$/, '');
  addToCart(
    baseName + ' Start',
    'img/placeholder.png',
    day,
    'Track',
    null,null,null,null,null,
    { lat: start.lat, lng: start.lng },
    null,
    { forceDay: day }
  );

  if (points.length > 1 &&
      (Math.abs(finish.lat - start.lat) > 1e-6 || Math.abs(finish.lng - start.lng) > 1e-6)) {
    addToCart(
      baseName + ' Finish',
      'img/placeholder.png',
      day,
      'Track',
      null,null,null,null,null,
      { lat: finish.lat, lng: finish.lng },
      null,
      { forceDay: day }
    );
  }

  // UI yenile (addToCart zaten çağırdı ama garanti olsun)
  if (typeof updateCart === 'function') updateCart();
  if (typeof renderRouteForDay === 'function') renderRouteForDay(day);

  console.log('[GPS] imported → points:', points.length);
}
// 9. removeFromCart fonksiyonu (GÜNCELLENDİ)
// - Sepet tamamen boşalınca: expanded haritalar + tüm rota/elevation cache temizlenir.
// - Silinen gün 0 veya 1 noktaya düştüyse: o güne ait rota/elevation + expanded map kalıntıları temizlenir.
// - Diğer günlerin rotaları yeniden render edilir.
// 9. removeFromCart fonksiyonu (GÜNCELLENDİ: 2 -> 1 düşüşte expanded map KAPANMAZ)
function removeFromCart(index){
  if (!Array.isArray(window.cart)) return;

  const removed = window.cart[index];
  const removedDay = removed && removed.day;

  window.cart.splice(index, 1);

  // Sepet tamamen boşaldıysa full cleanup + expandedları kapat
  if (window.cart.length === 0) {
    if (typeof closeAllExpandedMapsAndReset === 'function') closeAllExpandedMapsAndReset();
    if (typeof clearAllRouteCaches === 'function') clearAllRouteCaches();
    updateCart();
    return;
  }

  // Normal güncelleme
  updateCart();

  // Silinen öğenin günü artık <2 nokta ise sadece rota/elevation temizle (expanded'ı kapatma!)
  if (removedDay) {
    const dayPoints = getDayPoints(removedDay);
    if (dayPoints.length < 2) {
      if (typeof clearRouteCachesForDay === 'function') clearRouteCachesForDay(removedDay);
      if (typeof clearRouteVisualsForDay === 'function') clearRouteVisualsForDay(removedDay);
      // NOT: Önceki sürümde burada expanded haritayı kapatıyorduk. Artık kapatmıyoruz.
      // renderRouteForDay 1 nokta için expanded haritada tek marker gösterimini zaten yapıyor.
    }
  }

  // Kalan günlerin rotalarını yeniden çiz
  if (typeof renderRouteForDay === 'function') {
    const days = [...new Set(window.cart.map(i => i.day))];
    days.forEach(d => setTimeout(() => renderRouteForDay(d), 0));
  }
}
function addItem(element, day, category, name, image, extra) {
    const stepsDiv = element.closest('.steps');
    const address = stepsDiv.querySelector('.address')?.textContent.replace(/^[^:]*:\s*/, '').trim() || '';
    const opening_hours = stepsDiv.querySelector('.opening_hours')?.textContent.replace(/^[^:]*:\s*/, '').trim() || '';
    const lat = stepsDiv.getAttribute('data-lat');
    const lon = stepsDiv.getAttribute('data-lon');
    const place = typeof extra === 'string' ? JSON.parse(extra.replace(/&quot;/g, '"')) : extra || {};

    // location'u garantile
    let location = null;
    if (place.location && typeof place.location.lat !== "undefined" && typeof place.location.lng !== "undefined") {
        location = {
            lat: Number(place.location.lat),
            lng: Number(place.location.lng)
        };
    } else if (lat && lon) {
        location = {
            lat: Number(lat),
            lng: Number(lon)
        };
    }

    addToCart(
        name,
        image,
        day,
        category,
        place.address || address,
        place.rating,
        place.user_ratings_total,
        place.opening_hours || opening_hours,
        place.place_id,
        location,
        place.website
    );
    if (typeof restoreSidebar === "function") restoreSidebar();
}


const categories = {
    "🎟️ Things to do": ["Attractions", "Parks", "Campgrounds", "Museums", "..."],
    "🍽️ Food & Drink": ["Restaurants", "Bars", "Cafes", "Night Life", "..."],
    "🎭 Art & Sports": ["Art Galleries", "Book Stores", "Movie Theater", "Stadium", "..."],
    "🛒 Shopping": ["ATMs", "Banks", "Electronics Stores", "Clothing Stores", "..."],
    "🛠️ Services": ["Travel Agency", "Car Rentals", "Hospitals", "Airport", "..."]
};

function displayPlacesInChat(places, category, day) {
    const chatBox = document.getElementById("chat-box");
    const uniqueId = `suggestion-${day}-${category.replace(/\s+/g, '-').toLowerCase()}`;
    let html = `
        <div class="survey-results bot-message message">
            <div class="accordion-container">
                <input type="checkbox" id="${uniqueId}" class="accordion-toggle" checked>
                <label for="${uniqueId}" class="accordion-label">
    Suggestions for ${category}
                    <img src="img/arrow_down.svg" class="accordion-arrow">
                </label>
                <div class="accordion-content">
                    <div class="day-steps">`;

    places.forEach((place, idx) => {
        // Geoapify için lat/lon çoğu zaman properties.lat/properties.lon veya geometry.coordinates
        // Diğer API'ler için location.lat/location.lng de olabilir!
        const props = place.properties || place;
        let lat = null, lon = null;
        if (props.lat && props.lon) {
            lat = props.lat;
            lon = props.lon;
        } else if (props.geometry && props.geometry.coordinates) {
            // Geoapify GeoJSON: coordinates = [lon, lat]
            lon = props.geometry.coordinates[0];
            lat = props.geometry.coordinates[1];
        } else if (props.location) {
            lat = props.location.lat || props.location.latitude;
            lon = props.location.lon || props.location.lng || props.location.longitude;
        }

        const image = place.image || "img/placeholder.png";
        const name = props.name || category;
        const address = props.formatted || props.address || "";
        const description = `${category} in ${name}`;
        const website = props.website || "";
        const opening = props.opening_hours || "";
        const categories = props.categories ? props.categories.join(', ') : "";

        let catIcon = "https://www.svgrepo.com/show/522166/location.svg";
        if (category === "Coffee" || category === "Breakfast" || category === "Cafes")
            catIcon = "img/coffee_icon.svg";
        else if (category === "Touristic attraction" || category === "Attractions")
            catIcon = "img/touristic_icon.svg";
        else if (category === "Restaurant" || category === "Restaurants")
            catIcon = "img/restaurant_icon.svg";
        else if (category === "Accommodation")
            catIcon = "img/accommodation_icon.svg";

        html += `
<div class="steps" data-day="${day}" data-category="${category}"${lat && lon ? ` data-lat="${lat}" data-lon="${lon}"` : ""}>
    <div class="visual" style="opacity: 1;">
        <img class="check" src="${image}" alt="${name}" onerror="this.onerror=null; this.src='img/placeholder.png';">
    </div>
    <div class="info day_cats">
        <div class="title">${name}</div>
        <div class="address">
            <img src="img/address_icon.svg"> ${address}
        </div>
       <div class="description" data-original-description="${description}">
    <img src="img/information_icon.svg"> ${description}
</div>
        <div class="opening_hours">
            <img src="img/hours_icon.svg"> ${opening ? opening : "No opening hours found!"}
        </div>
    </div>
    <div class="item_action">
        <div class="change">
            <span onclick="window.showImage && window.showImage(this)">
                <img src="img/camera_icon.svg">
            </span>
            <span onclick="window.showMap && window.showMap(this)">
                <img src="img/map_icon.svg">
            </span>
            ${website ? `
            <span onclick="window.openWebsite && window.openWebsite(this, '${website}')">
                <img src="img/website_link.svg" style="vertical-align:middle;width:20px;">
            </span>
            ` : ""}
        </div>
        <div style="display: flex; gap: 12px;">
            <div class="cats cats${idx % 5 + 1}">
                <img src="${catIcon}" alt="${category}"> ${category}
            </div>
            <a class="addtotrip">
                <img src="img/addtotrip-icon.svg">
            </a>
        </div>
    </div>
</div>`;
    });

    html += "</div></div></div></div>";
    chatBox.innerHTML += html;
    chatBox.scrollTop = chatBox.scrollHeight;

    if (typeof makeChatStepsDraggable === "function") makeChatStepsDraggable();
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


function showCategoryList(day) {
    const cartDiv = document.getElementById("cart-items");
    cartDiv.innerHTML = "";

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

    // --- Kategori tanımları ---
    const basicPlanCategories = [
        { name: "Coffee", icon: "🍳" },
        { name: "Touristic attraction", icon: "🏞️" },
        { name: "Restaurant", icon: "🍽️" },
        { name: "Accommodation", icon: "🏨" }
    ];

    // 30 ana gezgin kategorisi (KODUN BAŞINDA veya globalde tanımlı olmalı!)
    const travelMainCategories = [
  { name: "Bar", code: "catering.bar", icon: "🍹" },
  { name: "Fast Food", code: "catering.fast_food", icon: "🍔" },
  { name: "Supermarket", code: "commercial.supermarket", icon: "🛒" },
  { name: "Bakery", code: "catering.bakery", icon: "🥐" },
  { name: "Nightclub", code: "entertainment.nightclub", icon: "🌃" },
  { name: "Cinema", code: "entertainment.cinema", icon: "🎬" },
  { name: "Art Gallery", code: "entertainment.gallery", icon: "🎨" },
  { name: "Theatre", code: "entertainment.theatre", icon: "🎭" },
  { name: "Casino", code: "entertainment.casino", icon: "🎰" },
  { name: "Theme Park", code: "tourism.theme_park", icon: "🎢" },
  { name: "Zoo", code: "tourism.zoo", icon: "🦁" },
  { name: "Aquarium", code: "tourism.aquarium", icon: "🐠" },
  { name: "Viewpoint", code: "tourism.view_point", icon: "🔭" },
  { name: "Mall", code: "shopping.mall", icon: "🛍️" },
  { name: "Bookstore", code: "commercial.books", icon: "📚" },
  { name: "ATM", code: "service.atm", icon: "🏧" },
  { name: "Pharmacy", code: "healthcare.pharmacy", icon: "💊" },
  { name: "Hospital", code: "healthcare.hospital", icon: "🏥" },
  { name: "Police", code: "service.police", icon: "🚓" },
  { name: "Airport", code: "transport.airport", icon: "✈️" }
];

    // -------- BASIC PLAN BLOK --------
    const basicPlanItem = document.createElement("div");
    basicPlanItem.classList.add("category-item");
    const basicHeader = document.createElement("h4");
    basicHeader.textContent = "Basic Plan";
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
        toggleBtn.textContent = "Hide";
        subCategoryItem.appendChild(iconSpan);
        subCategoryItem.appendChild(nameSpan);
        subCategoryItem.appendChild(toggleBtn);
        basicList.appendChild(subCategoryItem);

        // Kategoriye tıklama
        subCategoryItem.addEventListener("click", (e) => {
            if (!e.target.classList.contains('toggle-subcategory-btn')) {
                showSuggestionsInChat(cat.name, day);
            }
        });
        toggleBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            subCategoryItem.classList.toggle("hidden");
            toggleBtn.textContent = subCategoryItem.classList.contains("hidden") ? "Show" : "Hide";
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
        toggleBtn.textContent = "Hide";
        subCategoryItem.appendChild(iconSpan);
        subCategoryItem.appendChild(nameSpan);
        subCategoryItem.appendChild(toggleBtn);
        travelerList.appendChild(subCategoryItem);

        // Kategoriye tıklama
        subCategoryItem.addEventListener("click", (e) => {
            if (!e.target.classList.contains('toggle-subcategory-btn')) {
                showSuggestionsInChat(cat.name, day);
            }
        });
        toggleBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            subCategoryItem.classList.toggle("hidden");
            toggleBtn.textContent = subCategoryItem.classList.contains("hidden") ? "Show" : "Hide";
        });
    });
    travelerItem.appendChild(travelerList);
    cartDiv.appendChild(travelerItem);

    // -------- Kategori gizleme/gösterme & kapatma butonları --------
    let hiddenCategoriesCount = 0;
    const toggleAllButton = document.createElement("button"); 
    toggleAllButton.classList.add("toggle-all-btn");
    toggleAllButton.textContent = "Hide Hidden Categories";
    let hideHiddenMode = false;

    toggleAllButton.addEventListener("click", () => {
        hideHiddenMode = !hideHiddenMode;
        toggleAllButton.textContent = hideHiddenMode 
            ? "Show All Categories" 
            : "Hide Hidden Categories";
        updateAllHiddenCategories();
    });

    function updateAllHiddenCategories() {
        const allSubItems = document.querySelectorAll(".subcategory-item");
        allSubItems.forEach(item => {
            if (item.classList.contains("hidden")) {
                if (hideHiddenMode) {
                    item.style.display = "none";
                    item.closest(".category-item").querySelector(".subcategory-list").style.display = "none";
                } else {
                    item.style.display = "flex";
                    item.closest(".category-item").querySelector(".subcategory-list").style.display = "block";
                }
            }
        });
    }

    function updateToggleAllButton() {
        const allSubItems = document.querySelectorAll(".subcategory-item");
        hiddenCategoriesCount = Array.from(allSubItems).filter(x => x.classList.contains("hidden")).length;
        if (hiddenCategoriesCount > 0) {
            toggleAllButton.style.display = "block";
        } else {
            toggleAllButton.style.display = "none";
            hideHiddenMode = false;
            updateAllHiddenCategories();
        }
    }

    updateToggleAllButton();

    const closeButton = document.createElement("button");
    closeButton.classList.add("close-btn");
    closeButton.textContent = "Close";
    closeButton.addEventListener("click", restoreSidebar);

    cartDiv.appendChild(toggleAllButton);
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
    const now = Date.now();
    if (now - lastRequestTime < MIN_REQUEST_INTERVAL) {
        return [];
    }
    lastRequestTime = now;

    if (!query || query.length < 3) return [];
    
    // Check cache first
    if (apiCache.has(query)) {
        return apiCache.get(query);
    }

    // **YANLIŞ OLANI DEĞİL, DOĞRU OLANI KULLAN:**
    const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&limit=4&apiKey=${GEOAPIFY_API_KEY}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("API request failed");
        const data = await response.json();
        const results = data.features || [];
        
        // Cache results for 5 minutes
        apiCache.set(query, results);
        setTimeout(() => apiCache.delete(query), 300000);
        
        return results;
    } catch (error) {
        console.error("Geoapify API error:", error);
        return [];
    }
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
        step.image = await getImageForPlace(step.name, step.category, step.city || selectedCity);
step.description = "No detailed description.";
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
        window.cart.push(newItem);
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
        if (window.cart[idx]) { // <-- burada düzelt!
            newOrder.push(window.cart[idx]);
        }
    });
    // O günün cart itemlarını yeni sırayla ekle
    window.cart = [
        ...window.cart.filter(item => item.day != day),
        ...newOrder
    ];
}

/* updateCart: küçük haritada scale bar oluşturmayı kaldır, bar sarmayı aktif et */

const INITIAL_EMPTY_MAP_CENTER = [42.0, 12.3];  // (lat, lon)
const INITIAL_EMPTY_MAP_ZOOM   = 6;             // Önceki 4'ten 2 kademe yakın
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
  if (!el) el = ensureDayMapContainer(day);
  if (!el) return;

  if (typeof L === 'undefined') {
    setTimeout(() => initEmptyDayMap(day), 60);
    return;
  }

  // Mevcut instance & iç DOM kontrolü
  const existingMap = window.leafletMaps && window.leafletMaps[containerId];
  const hasInner = el.querySelector('.leaflet-container');

  if (existingMap && hasInner) {
    // Sağlam durumda, sadece view’i güncelleyebilirsin (opsiyonel)
    return;
  } else if (existingMap && !hasInner) {
    // Detached
    try { existingMap.remove(); } catch(_){}
    delete window.leafletMaps[containerId];
  }

  if (!el.style.height) el.style.height = '285px';

// 1) KÜÇÜK HARİTA: initEmptyDayMap içindeki L.map(...) seçeneklerini değiştir
const map = L.map(containerId, {
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
}).setView(INITIAL_EMPTY_MAP_CENTER, INITIAL_EMPTY_MAP_ZOOM);

  L.tileLayer(
    `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`,
    {
      tileSize: 256,
      zoomOffset: 0,
      attribution: '© Mapbox © OpenStreetMap',
      crossOrigin: true
    }
  ).addTo(map);

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
/* ================== START WITH MAP: DIRECT EXPANDED EMPTY MAP PATCH ================== */
/* İSTENEN: Butondaki gün (data-day="X") için 1. gün haritasını yeniden kullanmak yerine
            o güne ait tamamen boş (noktasız) BÜYÜK harita açılsın ve planlama o güne başlasın. */
// Bu IIFE içindeki startDayMapPlanningAndExpand fonksiyonunu bu şekilde güncelleyin
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
  window.__hideStartMapButtonByDay = window.__hideStartMapButtonByDay || {};
  window.__hideStartMapButtonByDay[1] = true;

  window.__forceEmptyMapForDay = window.__forceEmptyMapForDay || {};
  window.__forceEmptyMapForDay[1] = true;
  window.__suppressMiniUntilFirstPoint = window.__suppressMiniUntilFirstPoint || {};
  window.__suppressMiniUntilFirstPoint[1] = true;

  if (!Array.isArray(window.cart) || window.cart.length === 0) {
    window.cart = [{ day: 1, name: 'Start', category: 'Note', image: 'img/placeholder.png', _starter: true }];
  } else if (!window.cart.some(it => it.day === 1)) {
    window.cart.push({ day: 1, name: 'Start', category: 'Note', image: 'img/placeholder.png', _starter: true });
  }

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
        imageUrl = await getImageForPlace(placeInfo.name, 'Place', window.selectedCity || '');
      } catch(_) {}

      addToCart(
        placeInfo.name || 'Point',
        imageUrl,
        day,
        'Place',
        placeInfo.address || '',
        null,
        null,
        placeInfo.opening_hours || '',
        null,
        { lat, lng },
        '',
        { forceDay: day } // garanti
      );

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


// updateCart içinde ilgili yerlere eklemeler yapıldı
// updateCart (güncellenmiş)
function updateCart() {
  console.table(window.cart);
  const cartDiv = document.getElementById("cart-items");
  const menuCount = document.getElementById("menu-count");
  if (!cartDiv) return;

  // 0) Tamamen boş global durum
  if (!window.cart || window.cart.length === 0) {
    if (typeof closeAllExpandedMapsAndReset === 'function') closeAllExpandedMapsAndReset();
const showStartMap = !(window.__hideStartMapButtonByDay && window.__hideStartMapButtonByDay[1]);
cartDiv.innerHTML = `
  <div id="empty-content">
    <p>Create your trip using the chat screen.</p>
    <button type="button" class="import-btn gps-import" data-import-type="multi" data-global="1" title="Supports GPX, TCX, FIT, KML">
      Import GPS File
    </button>
    ${showStartMap ? `
      <div id="empty-or-sep" style="text-align:center;padding:10px 0 4px;font-weight:500;">or</div>
      <button id="start-map-btn" type="button">Start with map</button>
    ` : ``}
  </div>
`;
if (menuCount) {
  menuCount.textContent = 0;
  menuCount.style.display = "none";
}
const newChatBtn = document.getElementById("newchat");
if (newChatBtn) newChatBtn.style.display = "none";

const btn = document.getElementById('start-map-btn');
if (btn) btn.addEventListener('click', startMapPlanning);

// Start with map butonu YOKSA veya görünmüyorsa "or" satırını kaldır
const sep = document.getElementById('empty-or-sep');
if (!btn || window.getComputedStyle(btn).display === 'none') {
  if (sep) sep.remove();
}
return;
  }

  // 1) Gün listesi
  const days = [...new Set(window.cart.map(i => i.day))].sort((a, b) => a - b);
  window._debug_days = days; // <-- BU SATIRI EKLE!

  cartDiv.innerHTML = "";

  const globalIndexMap = new Map();
  window.cart.forEach((it, idx) => globalIndexMap.set(it, idx));

  // 2) Her gün
  days.forEach(day => {
    // Sadece gerçek (starter/placeholder hariç) item’lar
const dayItemsArr = window.cart.filter(i =>
  Number(i.day) === Number(day) &&
  !i._starter &&
  !i._placeholder &&
  (i.name || i.category === "Note")
);
    console.log('Gün:', day, dayItemsArr); // <-- BURAYA YAZ

    const isEmptyDay = dayItemsArr.length === 0;

    // Gün container
    let dayContainer = document.getElementById(`day-container-${day}`);
    if (!dayContainer) {
      dayContainer = document.createElement("div");
      dayContainer.className = "day-container";
      dayContainer.id = `day-container-${day}`;
      dayContainer.dataset.day = day;
    } else {
      // Mevcut küçük harita / info sakla
      const savedRouteMap = dayContainer.querySelector(`#route-map-day${day}`);
      const savedRouteInfo = dayContainer.querySelector(`#route-info-day${day}`);
      dayContainer.innerHTML = "";

      // (Artık boşsa küçük harita hiç gösterilmeyecek; bu yüzden sadece gerçek item varsa geri koy)
      if (!isEmptyDay) {
        if (savedRouteMap) dayContainer.appendChild(savedRouteMap);
        if (savedRouteInfo) dayContainer.appendChild(savedRouteInfo);
      }
    }

    // Header
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

    // Confirm alanı
    const confirmationContainer = document.createElement("div");
    confirmationContainer.className = "confirmation-container";
    confirmationContainer.id = `confirmation-container-${day}`;
    confirmationContainer.style.display = "none";
    dayContainer.appendChild(confirmationContainer);

    // Liste
    const dayList = document.createElement("ul");
    dayList.className = "day-list";
    dayList.dataset.day = day;

  // 2.a Boş gün görünümü (YENİ TASARIM)
if (isEmptyDay) {
  const hideByFlag = !!(window.__hideStartMapButtonByDay && window.__hideStartMapButtonByDay[day]);
  const planningThisDay = window.mapPlanningActive && window.mapPlanningDay === day;
  const showStartMap = !(hideByFlag || planningThisDay);

  const emptyWrap = document.createElement("div");
  emptyWrap.className = "empty-day-block";

  emptyWrap.innerHTML = `
    <p class="empty-day-message">No item has been added for this day yet.</p>
    <div class="empty-day-actions" style="display:block;text-align:center;">
      <button type="button"
              class="import-btn gps-import"
              data-import-type="multi"
              data-global="1"
              title="Supports GPX, TCX, FIT, KML">
        Import GPS File
      </button>
      ${showStartMap ? `
        <div class="start-map-sep" style="text-align:center;padding:10px 0 4px;font-weight:500;">or</div>
        <button type="button"
                class="start-map-btn"
                data-day="${day}">
          Start with map
        </button>
      ` : ``}
    </div>
  `;



  dayList.appendChild(emptyWrap);
}

else {
  let lastCoordItem = null;
  let lastCoordIdx = null;
  for (let idx = 0; idx < dayItemsArr.length; idx++) {
    const item = dayItemsArr[idx];
    const currIdx = globalIndexMap.get(item);

    // 1) Eğer hem lastCoordItem hem bu item koordinatlıysa önce separator ekle
    if (
      lastCoordItem &&
      lastCoordItem.location && item.location &&
      typeof lastCoordItem.location.lat === "number" &&
      typeof lastCoordItem.location.lng === "number" &&
      typeof item.location.lat === "number" &&
      typeof item.location.lng === "number"
    ) {
      const key = `route-map-day${day}`;
      const summary = window.pairwiseRouteSummaries?.[key]?.[lastCoordIdx];
      let distanceStr = '';
      let durationStr = '';
      if (summary) {
        distanceStr = summary.distance >= 1000
          ? (summary.distance / 1000).toFixed(1) + " km"
          : Math.round(summary.distance) + " m";
        durationStr = summary.duration >= 60
          ? Math.round(summary.duration / 60) + " dk"
          : Math.round(summary.duration) + " sn";
      }
      const distanceSeparator = document.createElement('div');
      distanceSeparator.className = 'distance-separator';
      distanceSeparator.innerHTML = `
        <div class="separator-line"></div>
        <div class="distance-label">
          <span class="distance-value">${distanceStr}</span> • 
          <span class="duration-value">${durationStr}</span>
        </div>
        <div class="separator-line"></div>
      `;
      dayList.appendChild(distanceSeparator);
    }

  // 2) Şimdi item'i ekle
const li = document.createElement("li");
li.className = "travel-item";
li.draggable = true;
li.dataset.index = currIdx;
if (item.location && typeof item.location.lat === "number" && typeof item.location.lng === "number") {
    li.setAttribute("data-lat", item.location.lat);
    li.setAttribute("data-lon", item.location.lng);
}
const leafletMapId = "leaflet-map-" + currIdx;

if (item.category === "Note") {
  li.classList.add("custom-note");
}

// Eğer koordinat varsa, ekle:

li.addEventListener("dragstart", dragStart);

if (item.category === "Note") {
  li.innerHTML = `
    <div class="cart-item">
      <img src="${item.image || 'img/added-note.png'}" alt="${item.name}" class="cart-image">
      <div class="item-info">
        <p class="toggle-title">${item.name}</p>
      </div>
      <button class="remove-btn" onclick="removeFromCart(${currIdx})">
        <img src="img/remove-icon.svg" alt="Close">
      </button>
      <span class="arrow">
        <img src="https://www.svgrepo.com/show/520912/right-arrow.svg" class="arrow-icon" onclick="toggleContent(this)">
      </span>
      <div class="content">
        <div class="info-section">
          <div class="note-details">
            <p>${item.noteDetails ? escapeHtml(item.noteDetails) : ""}</p>
          </div>
        </div>
      </div>
    </div>
  `;
  dayList.appendChild(li);
  continue; // DİĞER KODLAR ÇALIŞMASIN!
} else {
  // DİĞER TÜM ITEM’LAR İÇİN ESKİ DETAYLI KOD
  let openingHoursDisplay = "No working hours info";
  if (item.opening_hours) {
    if (Array.isArray(item.opening_hours)) {
      const cleaned = item.opening_hours.map(h => (h || '').trim()).filter(Boolean);
      if (cleaned.length) openingHoursDisplay = cleaned.join(" | ");
    } else if (typeof item.opening_hours === "string" && item.opening_hours.trim()) {
      openingHoursDisplay = item.opening_hours.trim();
    }
  }

const mapHtml = (item.location &&
    typeof item.location.lat === "number" &&
    typeof item.location.lng === "number")
    ? `<div class="map-container"><div class="leaflet-map" id="${leafletMapId}" style="width:100%;height:250px;"></div></div>`
    : '<div class="map-error">Location not available</div>';



  li.innerHTML = `
    <div class="cart-item">
      <img src="https://www.svgrepo.com/show/458813/move-1.svg" alt="Drag" class="drag-icon">
      <img src="${item.image}" alt="${item.name}" class="cart-image">
      <img src="${categoryIcons[item.category] || 'https://www.svgrepo.com/show/522166/location.svg'}" alt="${item.category}" class="category-icon">
      <div class="item-info">
        <p class="toggle-title">${item.name}</p>
      </div>
      <button class="remove-btn" onclick="removeFromCart(${currIdx})">
        <img src="img/remove-icon.svg" alt="Close">
      </button>
      <span class="arrow">
        <img src="https://www.svgrepo.com/show/520912/right-arrow.svg" class="arrow-icon" onclick="toggleContent(this)">
      </span>
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
                  🌐 Website: <a href="${item.website}" target="_blank" rel="noopener">
                    ${item.website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              ` : ''}
              <div class="google-search-info" style="margin-top:8px;">
                <a href="https://www.google.com/search?tbm=isch&q=${encodeURIComponent(item.name + ' ' + (window.selectedCity || ''))}"
                   target="_blank" rel="noopener">
                  🇬 Search images on Google
                </a>
              </div>
            ` : ''
          }
        </div>
      </div>
    </div>
  `;
}

// Not: escapeHtml fonksiyonun yoksa şöyle bir şey kullanabilirsin:
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function(m) {
    return ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m];
  });
}

    dayList.appendChild(li);

    // 3) Eğer bu item koordinatlıysa güncelle
    if (
      item.location &&
      typeof item.location.lat === "number" &&
      typeof item.location.lng === "number"
    ) {
      lastCoordItem = item;
      lastCoordIdx = currIdx;
    }

    // 4) Tek item uyarısı
    if (dayItemsArr.length === 1 && idx === 0) {
      const oneItemMessage = document.createElement("p");
      oneItemMessage.className = "one-item-message";
      oneItemMessage.textContent = "Add one more item to see the route!";
      dayList.appendChild(oneItemMessage);
    }
  }
}

    dayContainer.appendChild(dayList);

    // --- MAP LOGIC (final + force empty map desteği) ---
// --- MAP LOGIC (mini harita gecikmeli) ---
// --- MAP LOGIC (mini harita bastırma) ---
window.__suppressMiniUntilFirstPoint = window.__suppressMiniUntilFirstPoint || {};
const realPointCount = dayItemsArr.filter(it =>
  it.location &&
  typeof it.location.lat === 'number' &&
  typeof it.location.lng === 'number'
).length;

const suppress = window.__suppressMiniUntilFirstPoint[day] === true;

if (realPointCount === 0) {
  if (suppress) {
    // Mini konteyner var olsun ama gizli kalsın
    ensureDayMapContainer(day);
    const mini = document.getElementById(`route-map-day${day}`);
    if (mini) mini.classList.add('mini-suppressed');
  } else {
    removeDayMapCompletely(day);
  }
} else {
  ensureDayMapContainer(day);
  const mini = document.getElementById(`route-map-day${day}`);
  if (mini) mini.classList.remove('mini-suppressed');
  if (realPointCount === 1) initEmptyDayMap(day);
  if (suppress) delete window.__suppressMiniUntilFirstPoint[day];
}

    // Gün container'ı sepete ekle
    cartDiv.appendChild(dayContainer);

    // + Add Category butonu
    const addMoreButton = document.createElement("button");
    addMoreButton.className = "add-more-btn";
    addMoreButton.textContent = "+ Add Category";
    addMoreButton.dataset.day = day;
    addMoreButton.onclick = function () { showCategoryList(this.dataset.day); };
    cartDiv.appendChild(addMoreButton);
  }); // days.forEach sonu

  // 3) + Add New Day
  const addNewDayHr = document.createElement('hr');
addNewDayHr.className = 'add-new-day-separator';
cartDiv.appendChild(addNewDayHr);

const addNewDayButton = document.createElement("button");
addNewDayButton.className = "add-new-day-btn";
addNewDayButton.id = "add-new-day-button";
addNewDayButton.textContent = "+ Add New Day";
addNewDayButton.onclick = function () { addNewDay(this); };
cartDiv.appendChild(addNewDayButton);

  // 4) Sayaç / butonlar
const itemCount = window.cart.filter(i => i.name && !i._starter && !i._placeholder).length;
  if (menuCount) {
    menuCount.textContent = itemCount;
    menuCount.style.display = itemCount > 0 ? "inline-block" : "none";
  }


  // 5) Çeşitli init
  attachDragListeners();
  days.forEach(d => initPlaceSearch(d));
  addCoordinatesToContent();
  days.forEach(d => {
  const suppressing = window.__suppressMiniUntilFirstPoint &&
                      window.__suppressMiniUntilFirstPoint[d];
  // Suppression aktif ve henüz 0 gerçek nokta varsa rota çizme / map’i oynama
  const realPoints = getDayPoints ? getDayPoints(d) : [];
  if (suppressing && realPoints.length === 0) {
    return; // renderRouteForDay atlanır
  }
  renderRouteForDay(d);
});  setTimeout(wrapRouteControlsForAllDays, 0);
  attachChatDropListeners();

  if (window.expandedMaps) {
    Object.values(window.expandedMaps).forEach(({ expandedMap, day }) => {
      if (expandedMap) updateExpandedMap(expandedMap, day);
    });
  }

  initDragDropSystem();
  if (typeof interact !== 'undefined') setupMobileDragDrop();
  setupSidebarAccordion();
  setupStepsDragHighlight();
  renderTravelModeControlsForAllDays();

  // 6) Trip dates butonu
  (function ensureSelectDatesButton() {
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

  // >>> BURAYA EKLE <<<
  (function ensureNewChatInsideCart(){
    // Dışarıda eski #newchat varsa kaldır
    const oldOutside = document.querySelector('#newchat');
    if (oldOutside && !oldOutside.closest('#cart')) oldOutside.remove();

    const cartRoot = document.getElementById('cart');
    if (!cartRoot) return;

    let newChat = cartRoot.querySelector('#newchat');
    if (!newChat){
      newChat = document.createElement('div');
      newChat.id = 'newchat';
      newChat.textContent = 'New Chat';
      newChat.onclick = startNewChat;
      newChat.style.cursor = 'pointer';
    }

    // Select Dates butonunun hemen altına yerleştir
    const datesBtn = cartRoot.querySelector('.add-to-calendar-btn[data-role="trip-dates"]');
    if (datesBtn && datesBtn.nextSibling !== newChat){
      datesBtn.insertAdjacentElement('afterend', newChat);
    } else if (!datesBtn && newChat.parentNode !== cartRoot){
      cartRoot.appendChild(newChat);
    }

    // Sepet doluysa göster
const itemCount = window.cart.filter(i => i.name && !i._starter && !i._placeholder).length;
    newChat.style.display = itemCount > 0 ? 'block' : 'none';
  })();

  // 7) Paylaşım bölümü (tarih seçildiyse)
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

  // 8) Tarih aralığı ve Trip Details
  (function ensureTripDetailsBlock() {
    if (!window.cart.startDate || !window.cart.endDates || !window.cart.endDates.length) {
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
    const endDate = window.cart.endDates[window.cart.endDates.length - 1];
    dateRangeDiv.innerHTML = `
      <span class="date-info">📅 Dates: ${window.cart.startDate} - ${endDate}</span>
      <button type="button" class="see-details-btn" data-role="trip-details-btn">🧐 Trip Details</button>
    `;
    const detailsBtn = dateRangeDiv.querySelector('[data-role="trip-details-btn"]');
    if (detailsBtn) {
      detailsBtn.onclick = () => {
        if (typeof showTripDetails === 'function') {
          showTripDetails(window.cart.startDate);
        } else {
          console.warn('showTripDetails not found');
        }
      };
    }
  })();
}

document.addEventListener('DOMContentLoaded', updateCart);
document.querySelectorAll('.accordion-label').forEach(label => {
    label.addEventListener('click', function() {
    });
});



function searchPlaceOnGoogle(place, city) {
  // Boşlukları + ile değiştir, çift tırnak ve özel karakterlerden koru
  const query = [place, city].filter(Boolean).join(' ').replace(/"/g, '').trim();
  const url = 'https://www.google.com/search?q=' + encodeURIComponent(query);
  window.open(url, '_blank');
}

// XSS koruması için (örn. "Villa Medici" gibi isimlerde sorun olmasın)
function escapeHtml(text) {
  return String(text || '').replace(/["'\\]/g, '');
}



// Stil bir kez eklensin
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
      gap: 12px;
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


// PATCH: refresh expanded scale bar after route updates
function updateExpandedMap(expandedMap, day) {
    expandedMap.eachLayer(layer => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline) {
            expandedMap.removeLayer(layer);
        }
    });

    const containerId = `route-map-day${day}`;
    const geojson = window.lastRouteGeojsons?.[containerId];
    const points = getDayPoints(day);

if (geojson && geojson.features && geojson.features[0]?.geometry?.coordinates) {
        const coords = geojson.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
        const polyline = L.polyline(coords, {
  color: '#1976d2',
  weight: 7,
  opacity: 0.93,
  renderer: ensureCanvasRenderer(expandedMap)
}).addTo(expandedMap);

        addNumberedMarkers(expandedMap, points);
        expandedMap.fitBounds(polyline.getBounds());

        // EKSIK NOKTALAR İÇİN KIRMIZI KESİK ÇİZGİ
        points.forEach((mp) => {
            if (isPointReallyMissing(mp, geojson.features[0].geometry.coordinates, 50)) {
                let minIdx = 0, minDist = Infinity;
                for (let i = 0; i < coords.length; i++) {
                    const [lat, lng] = coords[i];
                    const d = haversine(lat, lng, mp.lat, mp.lng);
                    if (d < minDist) {
                        minDist = d;
                        minIdx = i;
                    }
                }
                const start = [mp.lat, mp.lng];
                const end = coords[minIdx];
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
    } else {
  // Fallback: 0 veya 1 nokta
  const pts = getDayPoints(day);
  // Eski marker / polyline temizle
  expandedMap.eachLayer(layer => {
    if (layer instanceof L.Marker || layer instanceof L.Polyline) {
      if (!(layer instanceof L.TileLayer)) expandedMap.removeLayer(layer);
    }
  });

  if (pts.length === 1) {
    const p = pts[0];
    const m = L.circleMarker([p.lat, p.lng], {
      radius: 10,
      color: '#8a4af3',
      fillColor: '#8a4af3',
      fillOpacity: 0.92,
      weight: 3
    }).addTo(expandedMap);
    m.bindPopup(`<b>${p.name || 'Point'}</b>`).openPopup();
    expandedMap.setView([p.lat, p.lng], 15);
  } else {
    // 0 nokta ise sadece center’a yakınlaştır
    expandedMap.setView(INITIAL_EMPTY_MAP_CENTER, INITIAL_EMPTY_MAP_ZOOM);
  }
}

    addDraggableMarkersToExpandedMap(expandedMap, day);

    const sumKey = `route-map-day${day}`;
    const sum = window.lastRouteSummaries?.[sumKey];
    if (sum && typeof updateDistanceDurationUI === 'function') {
      updateDistanceDurationUI(sum.distance, sum.duration);
    }

    // NEW: re-render expanded scale bar with fresh route
const scaleBarDiv = document.getElementById(`expanded-route-scale-bar-day${day}`);
if (scaleBarDiv) {
  try {
    const pts = (typeof getDayPoints === 'function') ? getDayPoints(day) : [];
    if (!pts || pts.length < 2) {
      scaleBarDiv.innerHTML = '';
      scaleBarDiv.style.display = 'none';
    } else {
      const totalKm = (window.lastRouteSummaries?.[containerId]?.distance || 0) / 1000;
      const markerPositions = (typeof getRouteMarkerPositionsOrdered === 'function')
        ? getRouteMarkerPositionsOrdered(day)
        : [];
      if (totalKm > 0 && markerPositions.length > 0) {
        scaleBarDiv.style.display = '';
        try { delete scaleBarDiv._elevProfile; } catch (_) { scaleBarDiv._elevProfile = null; }
        renderRouteScaleBar(scaleBarDiv, totalKm, markerPositions);
      } else {
        scaleBarDiv.innerHTML = '';
        scaleBarDiv.style.display = 'none';
      }
    }
  } catch (_) {
    scaleBarDiv.innerHTML = '';
    scaleBarDiv.style.display = 'none';
  }
}
    adjustExpandedHeader(day);
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
      if(!(l instanceof L.TileLayer)){
        try{ eMap.removeLayer(l);}catch(_){}
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
            if (!(l instanceof L.TileLayer)) {
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


function createLeafletMapForItem(mapId, lat, lon, name) {
    window._leafletMaps = window._leafletMaps || {};
    if (window._leafletMaps[mapId]) return; // Aynı haritayı tekrar başlatma

    var map = L.map(mapId, {
        center: [lat, lon],
        zoom: 16,
        scrollWheelZoom: false,
        zoomControl: true,           // <-- zoom butonu aktif!
        attributionControl: false
    });
 
    L.tileLayer(
      'https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=' + window.MAPBOX_TOKEN,
      {
        tileSize: 256,
        zoomOffset: 0,
        attribution: '© Mapbox © OpenStreetMap',
        crossOrigin: true
      }
    ).addTo(map);

    // Zoom butonlarının yerini sağ üst yap (opsiyonel)
    map.zoomControl.setPosition('topright');

    L.marker([lat, lon]).addTo(map).bindPopup(name || '').openPopup();

    window._leafletMaps[mapId] = map;

    setTimeout(function() {
        map.invalidateSize();
    }, 100);
}



// 1) Reverse geocode: önce amenity (POI) dene, sonra building, sonra genel adres
async function getPlaceInfoFromLatLng(lat, lng) {
  const base = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${GEOAPIFY_API_KEY}`;

  // Helper to read result
  const pick = (data) => {
    const props = data?.features?.[0]?.properties;
    if (!props) return null;
    return {
      name: props.name || props.address_line1 || "Unnamed Place",
      address: props.formatted || "",
      opening_hours: props.opening_hours || "",
    };
  };

  try {
    // a) POI (amenity) öncelik
    const rAmenity = await fetch(`${base}&type=amenity&limit=1`);
    const dAmenity = await rAmenity.json();
    const amenityRes = pick(dAmenity);
    if (amenityRes && amenityRes.name && amenityRes.name !== "Unnamed Place") {
      return amenityRes;
    }
  } catch {}

  try {
    // b) Bina
    const rBuilding = await fetch(`${base}&type=building&limit=1`);
    const dBuilding = await rBuilding.json();
    const buildingRes = pick(dBuilding);
    if (buildingRes) return buildingRes;
  } catch {}

  try {
    // c) Genel fallback
    const r = await fetch(`${base}&limit=1`);
    const d = await r.json();
    const res = pick(d);
    if (res) return res;
  } catch {}

  return { name: "Unnamed Place", address: "", opening_hours: "" };
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
    createLeafletMapForItem(mapId, lat, lon, name);
}
}


/* === REPLACED showTripDetails (Maps / route controls REMOVED in Trip Details view) === */
function showTripDetails(startDate) {
    // Mobil: sadece paylaşım butonları (AYNI KALDI)
    if (window.innerWidth <= 768) {
        const dateRangeDiv = document.querySelector('.date-range');
        if (!dateRangeDiv) return;
        if (document.getElementById('mobile-share-buttons')) return;

        const shareDiv = document.createElement('div');
        shareDiv.id = 'mobile-share-buttons';
        shareDiv.className = 'share-buttons-container';
        shareDiv.innerHTML = `
            <button class="share-button whatsapp-button" onclick="shareOnWhatsApp()">
                <img src="https://www.svgrepo.com/show/452133/whatsapp.svg" alt="WhatsApp"> Share on WhatsApp
            </button>
            <button class="share-button instagram-button" onclick="shareOnInstagram()">
                <img src="https://www.svgrepo.com/show/452229/instagram-1.svg" alt="Instagram"> Copy for Instagram
            </button>
        `;
        document.querySelectorAll('#mobile-share-buttons').forEach(el => el.remove());
        dateRangeDiv.insertAdjacentElement('afterend', shareDiv);
        return;
    }

    // Konteyner hazırla
    let chatScreen = document.getElementById("chat-screen");
    if (!chatScreen) {
        chatScreen = document.createElement("div");
        chatScreen.id = "chat-screen";
        document.body.appendChild(chatScreen);
    }

    let tripDetailsSection = document.getElementById("tt-trip-details");
    if (!tripDetailsSection) {
        tripDetailsSection = document.createElement("section");
        tripDetailsSection.id = "tt-trip-details";
        chatScreen.appendChild(tripDetailsSection);
    }
    tripDetailsSection.innerHTML = "";

    if (!Array.isArray(window.cart) || window.cart.length === 0) {
        tripDetailsSection.textContent = "No trip details available.";
        return;
    }

    const sect = document.createElement("div");
    sect.className = "sect";
    const ul = document.createElement("ul");
    ul.className = "accordion-list";
    sect.appendChild(ul);

    let maxDay = 0;
    window.cart.forEach(it => { if (it.day > maxDay) maxDay = it.day; });

    const startDateObj = startDate ? new Date(startDate) : null;
    if (typeof window.customDayNames === "undefined") window.customDayNames = {};

    for (let day = 1; day <= maxDay; day++) {
        const dayItems = window.cart.filter(it => it.day == day && it.name !== undefined);

        // Tarih etiketi
        let dateStr = "";
        if (startDateObj) {
            const d = new Date(startDateObj);
            d.setDate(startDateObj.getDate() + (day - 1));
            dateStr = d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
        }
        const dayTitle = window.customDayNames[day] || `Day ${day}`;
        const labelText = `${dayTitle}${dateStr ? ` (${dateStr})` : ""}`;

        const li = document.createElement("li");
        li.className = "day-item";

        const container = document.createElement("div");
        container.className = "accordion-container";

        const inputId = `tt-day-${day}`;
        const input = document.createElement("input");
        input.type = "checkbox";
        input.id = inputId;
        input.className = "accordion-toggle";
        input.checked = true;
        container.appendChild(input);

        const label = document.createElement("label");
        label.setAttribute("for", inputId);
        label.className = "accordion-label";
        label.innerHTML = `
            ${labelText}
            <img src="img/arrow_down.svg" class="accordion-arrow">
        `;
        container.appendChild(label);

        const content = document.createElement("div");
        content.className = "accordion-content";

        const daySteps = document.createElement("div");
        daySteps.className = "day-steps active-view";
        daySteps.setAttribute("data-day", String(day));

        if (dayItems.length > 0) {
            const stepsHtml = dayItems.map((item, idx) => {
                const step = {
                    ...item,
                    location: item.location ? {
                        lat: Number(item.location.lat),
                        lng: Number(item.location.lng)
                    } : item.location
                };
                if (!step.location && typeof item.lat === "number" && typeof item.lon === "number") {
                    step.location = { lat: item.lat, lng: item.lon };
                }
                if (typeof generateStepHtml === "function") {
                    return generateStepHtml(step, day, item.category, idx);
                }
                const lat = step.location?.lat ?? item.lat;
                const lon = step.location?.lng ?? item.lon;
                const address = item.address || "Address not available";
                const opening = item.opening_hours || "";
                const website = item.website || "";
                let catIcon = "https://www.svgrepo.com/show/522166/location.svg";
                if (item.category === "Coffee" || item.category === "Breakfast" || item.category === "Cafes") catIcon = "img/coffee_icon.svg";
                else if (item.category === "Touristic attraction") catIcon = "img/touristic_icon.svg";
                else if (item.category === "Restaurant" || item.category === "Restaurants") catIcon = "img/restaurant_icon.svg";
                else if (item.category === "Accommodation") catIcon = "img/accommodation_icon.svg";
                return `
<div class="steps" data-day="${day}" data-category="${item.category}"${(lat!=null && lon!=null) ? ` data-lat="${lat}" data-lon="${lon}"` : ""} draggable="true">
  <div class="visual" style="opacity:1;">
    <img class="check" src="${item.image}" alt="${item.name}" onerror="this.onerror=null; this.src='img/placeholder.png';">
  </div>
  <div class="info day_cats item-info-view">
    <div class="title">${item.name}</div>
    <div class="address"><img src="img/address_icon.svg"> ${address}</div>
    <div class="description" data-original-description="${(item.description || 'No detailed description.').replace(/"/g, '&quot;')}">
      <img src="img/information_icon.svg">
      <span class="ai-guide-loading">
        AI Guide loading...
        <span class="dot-anim">.</span><span class="dot-anim">.</span><span class="dot-anim">.</span>
      </span>
    </div>
    <div class="opening_hours"><img src="img/hours_icon.svg"> ${opening ? opening : "No opening hours found!"}</div>
  </div>
  <div class="item_action">
    <div class="change">
      <span onclick="window.showImage && window.showImage(this)"><img src="img/camera_icon.svg"></span>
      <span onclick="window.showMap && window.showMap(this)"><img src="img/map_icon.svg"></span>
      ${website ? `<span onclick="window.openWebsite && window.openWebsite(this, '${website}')"><img src="img/website_link.svg" style="vertical-align:middle;width:20px;"></span>` : ""}
    </div>
    <div style="display:flex;gap:12px;">
      <div class="cats cats${(idx % 5) + 1}">
        <img src="${catIcon}" alt="${item.category}"> ${item.category}
      </div>
      <a class="addtotrip"><img src="img/addtotrip-icon.svg"></a>
    </div>
  </div>
</div>`;
            }).join("");
            daySteps.innerHTML = stepsHtml;
            daySteps.querySelectorAll(".steps").forEach(el => el.setAttribute("draggable", "true"));
        } else {
            const emptyP = document.createElement("p");
            emptyP.className = "empty-day-message";
            emptyP.textContent = "No item has been added for this day yet.";
            daySteps.appendChild(emptyP);
        }

        // ÖNEMLİ: Trip Details içinde HARİTA / ROUTE / TRAVEL MODE / ROUTE SUMMARY YOK!
        // (Eski: route-map-dayX + travel mode + expand butonu + summary ekliyordu. Hepsi kaldırıldı.)

        content.appendChild(daySteps);
        container.appendChild(content);
        li.appendChild(container);
        ul.appendChild(li);
    }

    tripDetailsSection.appendChild(sect);

    // Trip Information (AI adım yorumları)
    const tripInfoDiv = document.createElement("div");
    tripInfoDiv.className = "trip-info-section";
    tripInfoDiv.innerHTML = `
        <h3>Trip Information</h3>
        <div class="trip-info-content">
            <span style="color:#888;">AI is analyzing your trip steps...</span>
        </div>
    `;
    tripDetailsSection.appendChild(tripInfoDiv);

    // AI Summary
    const aiInfoDiv = document.createElement("div");
    aiInfoDiv.className = "ai-info-section";
    aiInfoDiv.innerHTML = `
        <h3>AI Information</h3>
        <div class="ai-info-content">
            <span style="color:#888;">AI is summarizing your trip...</span>
        </div>
    `;
    tripDetailsSection.appendChild(aiInfoDiv);

    // Share buttons
    const shareButtonsContainer = document.createElement("div");
    shareButtonsContainer.classList.add("share-buttons-container");
    shareButtonsContainer.innerHTML = `
       <button class="share-button whatsapp-button" onclick="shareOnWhatsApp()">
          <img src="https://www.svgrepo.com/show/452133/whatsapp.svg" alt="WhatsApp"> Share on WhatsApp
       </button>
       <button class="share-button instagram-button" onclick="shareOnInstagram()">
          <img src="https://www.svgrepo.com/show/452229/instagram-1.svg" alt="Instagram"> Copy for Instagram
       </button>
    `;
    tripDetailsSection.appendChild(shareButtonsContainer);

    // Typewriter
    function typeWriterEffect(element, html, speed = 16) {
        let i = 0;
        element.innerHTML = "";
        function type() {
            if (i < html.length) {
                if (html[i] === "<") {
                    const close = html.indexOf(">", i);
                    if (close !== -1) {
                        element.innerHTML += html.slice(i, close + 1);
                        i = close + 1;
                    } else {
                        element.innerHTML += html[i++];
                    }
                } else {
                    element.innerHTML += html[i++];
                }
                setTimeout(type, speed);
            }
        }
        type();
    }
    function safeHtml(str) {
        if (!str) return "";
        return String(str).replace(/^\s+|\s+$/g, '').replace(/\n{2,}/g, '\n').replace(/<[^>]*>/g, '');
    }

    // AI Summary
    (async function(){
        try {
            const plan = (window.latestTripPlan && window.latestTripPlan.length) ? window.latestTripPlan : window.cart;
            if (!Array.isArray(plan) || plan.length === 0) return;
            const city = window.selectedCity || plan[0]?.city || "";
            const days = plan.reduce((max, p) => Math.max(max, p.day || 1), 1);
            aiInfoDiv.querySelector('.ai-info-content').innerHTML = `<span style="color:#888;">AI is summarizing your trip...</span>`;
            const resp = await fetch('/llm-proxy/plan-summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan, city, days })
            });
            const data = await resp.json();
            let html = "";
            if (data.summary) html += `<p><b>Summary:</b> ${safeHtml(data.summary)}</p>`;
            if (data.tip) html += `<p><b>Tip:</b> ${safeHtml(data.tip)}</p>`;
            if (data.highlight) html += `<p><b>Highlight:</b> ${safeHtml(data.highlight)}</p>`;
            if (!html) html = `<span style="color:#d32f2f">AI summary could not be generated.</span>`;
            typeWriterEffect(aiInfoDiv.querySelector('.ai-info-content'), html, 18);
        } catch (e) {
            aiInfoDiv.querySelector('.ai-info-content').innerHTML = `<span style="color:#d32f2f">AI summary could not be generated.</span>`;
        }
    })();

    // Trip Info
    (async function(){
      try {
        const resp = await fetch('/llm-proxy/trip-info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tripPlan: window.cart || [] })
        });
        const data = await resp.json();
        let html = "";
        if (data.steps && data.steps.length) {
          data.steps.forEach(s => {
            html += `<div class="trip-step"><b>${safeHtml(s.name)}:</b> ${safeHtml(s.ai_comment)}</div>`;
          });
        }
        if (data.route_summary) {
          html += `<div class="trip-route-summary"><b>Route summary:</b> ${safeHtml(data.route_summary)}</div>`;
        }
        if (data.summary) {
          html += `<div class="trip-summary"><b>AI Program:</b><br>${safeHtml(data.summary)}</div>`;
        }
        if (!html.trim()) html = `<span style="color:#d32f2f">AI trip info could not be generated.</span>`;
        typeWriterEffect(tripInfoDiv.querySelector('.trip-info-content'), html, 15);
      } catch (e) {
        tripInfoDiv.querySelector('.trip-info-content').innerHTML = `<span style="color:#d32f2f">AI trip info could not be generated.</span>`;
      }
    })();

    // Step içi AI açıklamalar
    setTimeout(() => {
        if (typeof fillAIDescriptionsAutomatically === "function") {
            fillAIDescriptionsAutomatically();
        }
    }, 0);

    // Trip Details içinde harita / rota çizme YOK: renderRouteForDay çağırmıyoruz.

    if (typeof makeChatStepsDraggable === "function") {
        setTimeout(() => makeChatStepsDraggable(), 0);
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
    let maxDay = 0;
    window.cart.forEach(item => {
        const currentDay = parseInt(item.day, 10);
        if (currentDay > maxDay) {
            maxDay = currentDay;
        }
    });

    const newDay = maxDay + 1;

    if (!window.cart.some(item => item.day === newDay)) {
        window.cart.push({ day: newDay });
    }

     window.currentDay = newDay;
    updateCart();
}




// 1. Önce koordinat bilgilerini içerik bölümüne ekleyen fonksiyon
function addCoordinatesToContent() {
    document.querySelectorAll('.travel-item').forEach(item => {
        const contentDiv = item.querySelector('.content');
        const index = item.getAttribute('data-index');
        const cartItem = window.cart[index];
       
    });
}




function addNumberedMarkers(map, points) {
    if (!map || !points || !Array.isArray(points)) return;

    points.forEach((item, idx) => {
        const label = `${idx + 1}. ${item.name || "Point"}`; // fallback eklendi
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

    if (window.leafletMaps[containerId]) {
        window.leafletMaps[containerId].remove();
        delete window.leafletMaps[containerId];
    }

    sidebarContainer.innerHTML = "";
    sidebarContainer.style.height = "285px";
    sidebarContainer.classList.remove("big-map", "full-screen-map");

    const controlsWrapperId = `map-bottom-controls-wrapper-day${day}`;
    document.getElementById(controlsWrapperId)?.remove();

    const controlsWrapper = document.createElement("div");
    controlsWrapper.id = controlsWrapperId;

    const controlRowId = `map-bottom-controls-day${day}`;
    const controlRow = document.createElement("div");
    controlRow.id = controlRowId;
    controlRow.className = "map-bottom-controls";





    // Route summary
   const infoDiv = document.createElement("span");
    infoDiv.className = "route-summary-control";
    if (summary) {
        infoDiv.innerHTML =
    `<b>Distance:</b> ${(summary.distance / 1000).toFixed(1)} km&nbsp;&nbsp;` +
                `<b>Duration:</b> ${Math.round(summary.duration / 60)} min`;

    }
    controlRow.appendChild(infoDiv);

    controlsWrapper.appendChild(controlRow);
    sidebarContainer.parentNode.insertBefore(controlsWrapper, sidebarContainer.nextSibling);

    // ADD RIGHT AFTER IT:
    ensureDayTravelModeSet(day, sidebarContainer, controlsWrapper);

    // Harita oluşturma kodu aynı kalacak...
    const coords = geojson.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
    const map = L.map(containerId, { 
        scrollWheelZoom: true,
        fadeAnimation: false,
        zoomAnimation: false,
        preferCanvas: true
    });

    // Tile layer (default streets)
    let tileLayer = L.tileLayer(
  `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`,
  {
    tileSize: 256,
    zoomOffset: 0,
    attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a>',
    crossOrigin: true // EKLENDİ
  }
);
tileLayer.addTo(map);

    const polyline = L.polyline(coords, {
  color: '#1976d2',
  weight: 5,
  opacity: 0.92,
  renderer: ensureCanvasRenderer(map)
}).addTo(map);

    if (Array.isArray(missingPoints) && missingPoints.length > 0) {
        const routeCoords = geojson.features[0].geometry.coordinates;
        function haversine(lat1, lon1, lat2, lon2) {
            const R = 6371000, toRad = x => x * Math.PI / 180;
            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
            return 2 * R * Math.asin(Math.sqrt(a));
        }
        missingPoints.forEach((mp) => {
            let minIdx = 0, minDist = Infinity;
            for (let i = 0; i < routeCoords.length; i++) {
                const [lng, lat] = routeCoords[i];
                const d = haversine(lat, lng, mp.lat, mp.lng);
                if (d < minDist) {
                    minDist = d;
                    minIdx = i;
                }
            }
            const start = [mp.lat, mp.lng];
            const end = [routeCoords[minIdx][1], routeCoords[minIdx][0]];
           L.polyline([start, end], {
  dashArray: '8, 12',
  color: '#d32f2f',
  weight: 4,
  opacity: 0.8,
  interactive: false,
  renderer: ensureCanvasRenderer(map)
}).addTo(map);
        });
    }

    addNumberedMarkers(map, points);

    if (geojson.features[0].properties && geojson.features[0].properties.names) {
        addGeziPlanMarkers(map, geojson.features[0].properties.names, day);
    }

    map.fitBounds(polyline.getBounds());
    map.zoomControl.setPosition('topright');
    window.leafletMaps[containerId] = map;
}
// Harita durumlarını yönetmek için global değişken
window.mapStates = {};

// Harita durumlarını yönetmek için global değişken
window.expandedMaps = {};
// Güncellenmiş expandMap fonksiyonu: YÜKSEKLİK/ELEVATION ile ilgili her şey kaldırıldı!


// Üstte tanımlı helper: setExpandedMapTile — crossOrigin ekleyin
function setExpandedMapTile(expandedMap, styleKey) {
  const url = `https://api.mapbox.com/styles/v1/mapbox/${styleKey}/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`;
// Programatik input set helper (manuel yazımı ayırt etmek için)
if (typeof setChatInputValue !== 'function') {
  window.__programmaticInput = false;
  function setChatInputValue(str) {
    const inp = document.getElementById('user-input');
    if (!inp) return;
    window.__programmaticInput = true;
    inp.value = str;
    // microtask sonunda flag’i geri al
    setTimeout(() => { window.__programmaticInput = false; }, 0);
  }
}
  let foundTile = null;
  expandedMap.eachLayer(layer => {
    if (layer instanceof L.TileLayer) {
      foundTile = layer;
    }
  });
  if (foundTile) expandedMap.removeLayer(foundTile);

  L.tileLayer(url, {
    tileSize: 256,
    zoomOffset: 0,
    attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a>',
    crossOrigin: true // EKLENDİ
  }).addTo(expandedMap);
}


function updateRouteStatsUI(day) {
  const key = `route-map-day${day}`;
  const summary = window.lastRouteSummaries?.[key];

  // Ascent/descent verisini oku
  const ascent = window.routeElevStatsByDay?.[day]?.ascent;
  const descent = window.routeElevStatsByDay?.[day]?.descent;

  // Eğer summary yoksa alanları temizle
  if (!summary) {
    // Küçük harita altındaki span
    const routeSummarySpan = document.querySelector(`#map-bottom-controls-day${day} .route-summary-control`);
    if (routeSummarySpan) routeSummarySpan.innerHTML = "";
    // Büyük harita altındaki div
    const routeStatsDiv = document.querySelector('.route-stats');
    if (routeStatsDiv) routeStatsDiv.innerHTML = "";
    return;
  }

  // Mesafe/Süre
  const distanceKm = (summary.distance / 1000).toFixed(2);
  const durationMin = Math.round(summary.duration / 60);

  // Küçük harita altındaki span (sidebar/cart)
  const routeSummarySpan = document.querySelector(`#map-bottom-controls-day${day} .route-summary-control`);
  if (routeSummarySpan) {
    routeSummarySpan.innerHTML = `
      <span class="stat stat-distance">
        <img class="icon" src="/img/way_distance.svg" alt="Distance" loading="lazy" decoding="async">
        <span class="badge">${distanceKm} km</span>
      </span>
      <span class="stat stat-duration">
        <img class="icon" src="/img/way_time.svg" alt="Duration" loading="lazy" decoding="async">
        <span class="badge">${durationMin} dk</span>
      </span>
      <span class="stat stat-ascent">
        <img class="icon" src="/img/way_ascent.svg" alt="Ascent" loading="lazy" decoding="async">
        <span class="badge">${(typeof ascent === "number" && !isNaN(ascent)) ? Math.round(ascent) + " m" : "— m"}</span>
      </span>
      <span class="stat stat-descent">
        <img class="icon" src="/img/way_descent.svg" alt="Descent" loading="lazy" decoding="async">
        <span class="badge">${(typeof descent === "number" && !isNaN(descent)) ? Math.round(descent) + " m" : "— m"}</span>
      </span>
    `;
  }

  // Büyük harita (expanded) altındaki div
  const routeStatsDiv = document.querySelector('.route-stats');
  if (routeStatsDiv) {
    routeStatsDiv.innerHTML = `
      <span class="stat stat-distance"><b>Distance:</b> ${distanceKm} km</span>
      <span class="stat stat-duration"><b>Duration:</b> ${durationMin} min</span>
      <span class="stat stat-ascent"><b>Çıkış:</b> ${(typeof ascent === "number" && !isNaN(ascent)) ? Math.round(ascent) + " m" : "— m"}</span>
      <span class="stat stat-descent"><b>İniş:</b> ${(typeof descent === "number" && !isNaN(descent)) ? Math.round(descent) + " m" : "— m"}</span>
    `;
  }
}

 
async function expandMap(containerId, day) {
  console.log('[expandMap] start →', containerId, 'day=', day);

  // Önce varsa aynı gün için tekrar açmaya çalışma
  if (window.expandedMaps && window.expandedMaps[containerId]) {
    console.log('[expandMap] already expanded, returning');
    return;
  }

  // Diğer expanded haritaları kapat (yalnızca farklı günler)
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
  const expandButton = document.querySelector(`#tt-travel-mode-set-day${day} .expand-map-btn`);

  console.log('[expandMap] elements:', { originalContainer, map, expandButton });

  // HARİTA YOKSA (ör: 0 nokta + force map) yine de devam edebilelim
  if (!originalContainer) {
    console.error('[expandMap] original small map container yok. İptal.');
    return;
  }
  if (!map) {
    console.warn('[expandMap] Leaflet instance yok. Yeniden initEmptyDayMap çağrılıyor…');
    initEmptyDayMap(day);
  }

  // Buton yoksa da devam et – sadece visibility gizleyemeyiz
  if (expandButton) {
    expandButton.style.visibility = 'hidden';
  } else {
    console.warn('[expandMap] expandButton bulunamadı, devam ediyorum.');
  }

  // Küçük haritayı gizle
  originalContainer.style.display = 'none';

  // Expanded container
  const expandedMapId = `expanded-map-${day}`;
  const expandedContainer = document.createElement('div');
  expandedContainer.id = expandedMapId;
  expandedContainer.className = 'expanded-map-container';
  document.body.appendChild(expandedContainer);

  // HEADER
  // HEADER
const headerDiv = document.createElement('div');
headerDiv.className = 'expanded-map-header';

const mapStyleSelect = document.createElement('select');
mapStyleSelect.id = `map-style-select-day${day}`;
[
  { value: 'streets-v12', text: 'Street modes' },
  { value: 'dark-v11', text: 'Navigation' },
  { value: 'satellite-streets-v12', text: 'Satellite' }
].forEach(o => {
  const opt = document.createElement('option');
  opt.value = o.value;
  opt.textContent = o.text;
  mapStyleSelect.appendChild(opt);
});
headerDiv.appendChild(mapStyleSelect);

const statsDiv = document.createElement('div');
statsDiv.className = 'route-stats';
headerDiv.appendChild(statsDiv);

// Önce header'ı ekle
expandedContainer.appendChild(headerDiv);

const locBtn = document.createElement('button');
locBtn.type = 'button';
locBtn.id = `use-my-location-btn-day${day}`;
locBtn.classList.add('use-my-location-btn'); // sabit CSS sınıfı eklendi
locBtn.innerHTML = '<img src="https://www.svgrepo.com/show/522166/location.svg" alt="Locate" class="category-icon">';
expandedContainer.appendChild(locBtn);

  // Close button
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
  // Aynı gün için eski expanded bar varsa kaldır
  const oldBar = document.getElementById(`expanded-route-scale-bar-day${day}`);
  if (oldBar) oldBar.remove();
  // Scale bar alanı
 // Scale bar alanı (0/1 item → gizli, 2+ → görünür)
const scaleBarDiv = document.createElement('div');
scaleBarDiv.className = 'route-scale-bar';
scaleBarDiv.id = `expanded-route-scale-bar-day${day}`;
try {
  const ptsForBar = (typeof getDayPoints === 'function') ? getDayPoints(day) : [];
  scaleBarDiv.style.display = (Array.isArray(ptsForBar) && ptsForBar.length >= 2) ? '' : 'none';
} catch (_) {}
expandedContainer.appendChild(scaleBarDiv);

  // Harita alanı
  const mapDivId = `${containerId}-expanded`;
  const mapDiv = document.createElement('div');
  mapDiv.id = mapDivId;
  mapDiv.className = 'expanded-map';
  expandedContainer.appendChild(mapDiv);

  // Leaflet expanded map
  const baseMap = window.leafletMaps ? window.leafletMaps[containerId] : null;
  let center = [42, 12];
  let zoom = 6;
  try {
    if (baseMap) {
      center = baseMap.getCenter();
      zoom = baseMap.getZoom();
    }
  } catch (_) {}

  // 2) BÜYÜK HARİTA: expandMap içindeki expandedMap oluşturma bloğunu değiştir
const expandedMap = L.map(mapDivId, {
  center,
  zoom,
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

  let expandedTileLayer = null;
  function setExpandedMapTile(styleKey) {
    if (expandedTileLayer) {
      try { expandedMap.removeLayer(expandedTileLayer); } catch (_){}
      expandedTileLayer = null;
    }
    expandedTileLayer = L.tileLayer(
      `https://api.mapbox.com/styles/v1/mapbox/${styleKey}/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`,
      {
        tileSize: 256,
        zoomOffset: 0,
        attribution: '© Mapbox © OpenStreetMap',
        crossOrigin: true
      }
    );
    expandedTileLayer.addTo(expandedMap);
  }
  setExpandedMapTile('streets-v12');

  mapStyleSelect.onchange = function() {
    setExpandedMapTile(this.value);
    // Küçük haritanın da stilini eşitle (opsiyonel)
    const originalMap = window.leafletMaps && window.leafletMaps[containerId];
    if (originalMap) {
      let old;
      originalMap.eachLayer(l => { if (l instanceof L.TileLayer) old = l; });
      if (old) try { originalMap.removeLayer(old); } catch (_){}
      L.tileLayer(
        `https://api.mapbox.com/styles/v1/mapbox/${this.value}/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`,
        {
          tileSize: 256,
          zoomOffset: 0,
          attribution: '© Mapbox © OpenStreetMap',
          crossOrigin: true
        }
      ).addTo(originalMap);
    }
  };

  // Mevcut rota / marker’ları kopyala
  const geojson = window.lastRouteGeojsons?.[containerId];
  if (geojson?.features?.[0]?.geometry?.coordinates) {
    const coords = geojson.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
    const poly = L.polyline(coords, { color: '#1976d2', weight: 7, opacity: 0.93 }).addTo(expandedMap);
    try { expandedMap.fitBounds(poly.getBounds()); } catch (_){}
  }

  if (baseMap) {
    Object.values(baseMap._layers).forEach(layer => {
      if (layer instanceof L.Marker) {
        const mk = L.marker(layer.getLatLng(), { icon: layer.options.icon }).addTo(expandedMap);
        if (layer._popup) mk.bindPopup(layer._popup._content);
      }
    });
  }

  // 0 veya 1 nokta fallback (küçük harita gibi davran)
  const points = (typeof getDayPoints === 'function') ? getDayPoints(day) : [];
  if (!geojson && points.length === 1) {
expandedMap.flyTo([points[0].lat, points[0].lng], 15, { duration: 0.6, easeLinearity: 0.2 });    L.circleMarker([points[0].lat, points[0].lng], {
      radius: 11,
      color: '#8a4af3',
      fillColor: '#8a4af3',
      fillOpacity: 0.92,
      weight: 3
    }).addTo(expandedMap).bindPopup(`<b>${points[0].name || 'Point'}</b>`).openPopup();
  } else if (!geojson && points.length === 0) {
    // Gerçek nokta yoksa default merkez
    expandedMap.setView([42, 12], 5);
  }

  setTimeout(() => expandedMap.invalidateSize({ pan: false }), 400);

  // Stats
  const summary = window.lastRouteSummaries?.[containerId];
  if (summary) {
    statsDiv.innerHTML = `
      <b>${getDayDisplayName(day)}</b>&nbsp;—&nbsp;
      <b>Distance:</b> ${(summary.distance / 1000).toFixed(2)} km&nbsp;—&nbsp;
      <b>Duration:</b> ${Math.round(summary.duration / 60)} min
    `;
  } else {
    statsDiv.innerHTML = `<b>${getDayDisplayName(day)}</b>`;
  }

  // Global kayıt
  window.expandedMaps = window.expandedMaps || {};
  window.expandedMaps[containerId] = {
    originalContainer,
    day,
    originalMap: baseMap,
    expandedMap,
    expandButton
  };

  // Scale bar
  const totalKm = summary ? summary.distance / 1000 : 0;
  const markerPositions = getRouteMarkerPositionsOrdered
    ? getRouteMarkerPositionsOrdered(day)
    : [];
  if (totalKm > 0 && markerPositions.length > 0 && typeof renderRouteScaleBar === 'function') {
  scaleBarDiv.style.display = '';
  renderRouteScaleBar(scaleBarDiv, totalKm, markerPositions);
} else {
  scaleBarDiv.innerHTML = '';
  scaleBarDiv.style.display = 'none';
}
  // Draggable markers / near search / header ayarı
  if (typeof addDraggableMarkersToExpandedMap === 'function') {
    addDraggableMarkersToExpandedMap(expandedMap, day);
  }
  if (typeof setupScaleBarInteraction === 'function') {
    setupScaleBarInteraction(day, expandedMap);
  }
  if (typeof attachClickNearbySearch === 'function') {
    attachClickNearbySearch(expandedMap, day);
  }
  if (typeof adjustExpandedHeader === 'function') {
    adjustExpandedHeader(day);
  }

  // Konum butonu
  window.isLocationActiveByDay = window.isLocationActiveByDay || {};
  window.userLocationMarkersByDay = window.userLocationMarkersByDay || {};

  locBtn.addEventListener('click', () => {
    if (!window.isLocationActiveByDay[day]) {
      window.isLocationActiveByDay[day] = true;
      locBtn.innerHTML = '<img src="https://www.svgrepo.com/show/522167/location.svg" alt="On" class="category-icon">';
      if (typeof getMyLocation === 'function') {
        getMyLocation(day, expandedMap);
      }
      setTimeout(() => {
        const arr = window.userLocationMarkersByDay?.[day];
        if (arr && arr.length) {
          const last = arr[arr.length - 1];
            if (last?.getLatLng) expandedMap.flyTo(last.getLatLng(), Math.max(expandedMap.getZoom(), 15), { duration: 0.5, easeLinearity: 0.2 });
        }
      }, 300);
    } else {
      const arr = window.userLocationMarkersByDay?.[day] || [];
      arr.forEach(m => { try { expandedMap.removeLayer(m); } catch (_){ }});
      window.userLocationMarkersByDay[day] = [];
      window.isLocationActiveByDay[day] = false;
      locBtn.innerHTML = '<img src="https://www.svgrepo.com/show/522166/location.svg" alt="Locate" class="category-icon">';
    }
  });

  console.log('[expandMap] done for day', day);
}

/* ==== NEW: Click-based nearby search (replaces long-press) ==== */
function attachClickNearbySearch(map, day, options = {}) {
  const radius = options.radius || 500; // metres

  // Uzun basma varsa temizle
  if (map.__ttLongPressCleanup) {
    try { map.__ttLongPressCleanup(); } catch(_){}
    map.__ttLongPressCleanup = null;
  }

  // Tek bağla
  if (map.__ttNearbyClickBound) return;
  map.__ttNearbyClickBound = true;

  // TEK TIK ayıracı: timer + gecikme
  let __nearbySingleTimer = null;
  const __nearbySingleDelay = (options && options.singleDelay) || 300; // ms

  map.on('click', function(e) {
    if (__nearbySingleTimer) clearTimeout(__nearbySingleTimer);
    __nearbySingleTimer = setTimeout(async () => {
      // Tek tık: yakındaki mekanları aç
      const { lat, lng } = e.latlng;
      closeNearbyPopup(); // önceki varsa kapat
      showNearbyPlacesPopup(lat, lng, map, day, radius);
    }, __nearbySingleDelay);
  });

  // Çift tık (zoom) gelirse tek-tıkı iptal et
  map.on('dblclick', function() {
    if (__nearbySingleTimer) {
      clearTimeout(__nearbySingleTimer);
      __nearbySingleTimer = null;
    }
  });

  // Zoom başlarsa (ör. çift tık, pinch), tek-tıkı iptal et
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

    const html = `
      <div class="nearby-popup-title">
        📍 Yakındaki Mekanlar
      </div>
      ${addPointSection}
      <ul class="nearby-places-list">${placesHtml}</ul>
    `;

    showCustomPopup(lat, lng, map, html, true);

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
    
    // Expanded map varsa ona da marker ekle
    const expandedMapData = Object.values(window.expandedMaps || {}).find(m => m.day === day);
    if (expandedMapData && expandedMapData.expandedMap) {
        const map = expandedMapData.expandedMap;
        
        // Başarı popup'ı göster
        L.popup()
            .setLatLng([actualLat, actualLng])
            .setContent(`<div style="text-align:center;"><b>${f.properties.name}</b><br><small style="color:#4caf50;">✓ Eklendi!</small></div>`)
            .openOn(map);
        
        setTimeout(() => map.closePopup(), 2000);
        
        // Haritayı yeni eklenen yere odakla (isteğe bağlı)
        map.setView([actualLat, actualLng], map.getZoom(), { animate: true });
    }
};

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

// Hem pulslu ikon (görsel) hem de altta mantıksal nokta istersen ikinci küçük circle ekleyebilirsin.
// Burada sadece tek DivIcon yeterli.
window._nearbyPulseMarker = L.marker([lat, lng], { icon: pulseIcon, interactive:false }).addTo(map);

// Eğer ayrı bir veri katmanı gerekirse (ör: popup açma) ekstra marker ekleyebilirsin:
// window._nearbyMarker = L.circleMarker([lat, lng], { radius: 0 }).addTo(map);
}
(function ensureNearbyPulseStyles(){
  if (document.getElementById('tt-nearby-pulse-styles')) return;
  const s = document.createElement('style');
  s.id = 'tt-nearby-pulse-styles';
  s.textContent = `
    .nearby-pulse-icon-wrapper { background: transparent; border: none; }
    .nearby-pulse-root {
      position: relative;
      width: 28px;
      height: 28px;
      transform: translate(-14px, -14px);
      pointer-events: none;
      z-index: 650;
    }
    .nearby-pulse-core {
      position: absolute;
      left: 50%; top: 50%;
      width: 14px; height: 14px;
      transform: translate(-50%, -50%);
      background: #1976d2;
      border: 2px solid #fff;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      z-index: 2;
    }
    .nearby-pulse-ring,
    .nearby-pulse-ring2 {
      position: absolute;
      left: 50%; top: 50%;
      width: 14px; height: 14px;
      transform: translate(-50%, -50%);
      border: 2px solid #1976d2;
      border-radius: 50%;
      opacity: 0;
      animation: ttPulse 2.8s linear infinite;
    }
    .nearby-pulse-ring2 { animation-delay: 1.4s; }
    @keyframes ttPulse {
      0%   { transform: translate(-50%, -50%) scale(0.25); opacity: 0.55; }
      60%  { opacity: 0.05; }
      100% { transform: translate(-50%, -50%) scale(2.8); opacity: 0; }
    }
  `;
  document.head.appendChild(s);
})();
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







function setupScaleBarInteraction(day, map) {
    const scaleBar = document.getElementById(`expanded-route-scale-bar-day${day}`);
    if (!scaleBar || !map) return;

    let hoverMarker = null;

    function onMove(e) {
        // Mouse veya dokunma pozisyonunu alın
        const rect = scaleBar.getBoundingClientRect();
        let x;
        if (e.touches && e.touches.length) {
            x = e.touches[0].clientX - rect.left;
        } else {
            x = e.clientX - rect.left;
        }
        const percent = Math.max(0, Math.min(x / rect.width, 1));

        // Rota ve mesafe bilgilerini alın
        const containerId = `route-map-day${day}`;
        const geojson = window.lastRouteGeojsons?.[containerId];
        if (!geojson || !geojson.features || !geojson.features[0]?.geometry?.coordinates) return;
        const coords = geojson.features[0].geometry.coordinates;

        // Her segmentin kümülatif mesafesini hesapla
        let cumDist = [0];
        for (let i = 1; i < coords.length; i++) {
            cumDist[i] = cumDist[i - 1] + haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
        }
        const totalDist = cumDist[cumDist.length - 1];
        const targetDist = percent * totalDist;

        // Hangi noktada olduğumuzu bul
        let idx = 0;
        while (cumDist[idx] < targetDist && idx < cumDist.length - 1) idx++;
        // Hedef noktayı doğrudan iki nokta arasında interpolate edelim
        let lat, lng;
        if (idx === 0) {
            lat = coords[0][1];
            lng = coords[0][0];
        } else {
            const prevDist = cumDist[idx - 1];
            const nextDist = cumDist[idx];
            const ratio = (targetDist - prevDist) / (nextDist - prevDist);
            lat = coords[idx - 1][1] + (coords[idx][1] - coords[idx - 1][1]) * ratio;
            lng = coords[idx - 1][0] + (coords[idx][0] - coords[idx - 1][0]) * ratio;
        }

        // Haritada göstergeyi oluştur/güncelle
        if (hoverMarker) {
            hoverMarker.setLatLng([lat, lng]);
        } else {
            hoverMarker = L.circleMarker([lat, lng], {
                radius: 10,
                color: "#fff",
                fillColor: "#8a4af3",
                fillOpacity: 0.9,
                weight: 3,
                zIndexOffset: 9999
            }).addTo(map);
        }
    }

    function onLeave() {
        if (hoverMarker) {
            map.removeLayer(hoverMarker);
            hoverMarker = null;
        }
    }

    scaleBar.addEventListener("mousemove", onMove);
    scaleBar.addEventListener("mouseleave", onLeave);

    // Mobile touch desteği
    scaleBar.addEventListener("touchmove", onMove);
    scaleBar.addEventListener("touchend", onLeave);
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

        if (originalMap && originalMap.invalidateSize) {
            setTimeout(() => {
                originalMap.invalidateSize({ pan: false });
            }, 100);
        }
    } catch (e) {
console.error('Error while closing the map:', e);
    } finally {
        delete window.expandedMaps[containerId];
    }
}


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

// Yardımcı: Marker üzerinde long-press ile drag başlat
// Marker üzerinde long-press ile drag başlat (ÇAKIŞMA ÖNLEME DAHİL)
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
        handedToLeaflet = false;
        // Marker drag aktif bayrağını kapat
        window.__tt_markerDragActive = false;
    };

    const onDown = (e) => {
        const isTouch = e.type.startsWith('touch');
        const pt = isTouch ? (e.touches[0] || e.changedTouches?.[0]) : e;
        if (!pt) return;

        startX = pt.clientX;
        startY = pt.clientY;
        pressed = true;
        armed = false;
        handedToLeaflet = false;

        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            armed = true;
            if ('vibrate' in navigator) navigator.vibrate(20);
        }, delay);
        // Burada stopPropagation yapmıyoruz; harita long-press tarafı kendi filtresiyle marker’ı ayıklayacak.
    };

    const maybeStartDrag = (e) => {
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




// Haritadaki tüm marker'larda dragging'i kapat (başka marker aktifse devre dışı bırak)
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
        <button class="marker-remove-x-btn" data-marker-idx="${idx}" style="
          position: relative; right: -10px; width: 22px; height: 22px;
          background: #fff; color: #d32f2f; border-radius: 50%;
          border: 1.5px solid #d32f2f; font-size: 16px; font-weight: bold;
          cursor: pointer; z-index: 2; box-shadow: #888 0 2px 6px;
          line-height: 22px; padding: 0; top:-1px;">&times;</button>
      </div>
    `;
    const icon = L.divIcon({ html: markerHtml, className: "", iconSize: [32, 48], iconAnchor: [16, 16] });
    const marker = L.marker([p.lat, p.lng], { draggable: false, icon }).addTo(expandedMap);

    marker.bindPopup(`<div><b>${p.name || "Point"}</b></div>`, {
      autoClose: false,
      closeButton: true
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
} else if (scaleBarDiv) {
  scaleBarDiv.innerHTML = '';
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


// (İstersen) buildPlan içerisine eklediğin item'lara _generated:true koyup burada hariç tutabilirsin:
function getDayPoints(day) {
  return window.cart
    .filter(item =>
      item.day == day &&
      item.location &&
      !item._starter &&
      !item._placeholder &&
      !item._generated && // opsiyonel
      !isNaN(Number(item.location.lat)) &&
      !isNaN(Number(item.location.lng))
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

// UPDATED renderRouteForDay
// Değişiklikler:
// - 0 nokta (points.length === 0) durumunda artık harita container hiç oluşturulmuyor.
// - 0 nokta için: removeDayMapCompletely(day) (veya yoksa removeDayMap) ile mevcut küçük harita + info + controls tamamen kaldırılıyor.
// - 1+ nokta durumunda eski davranış korunuyor.
// - Diğer tüm rota / pairwise / elevation mantığı aynen bırakıldı.

async function renderRouteForDay(day) {
    // Suppression: start with map modunda ve henüz hiç gerçek nokta yoksa
if (window.__suppressMiniUntilFirstPoint &&
    window.__suppressMiniUntilFirstPoint[day]) {
  const pts0 = getDayPoints(day);
  if (!pts0 || pts0.length === 0) {
    // Küçük haritayı SİLME, dokunma, sadece çık
    return;
  }
}
  const containerId = `route-map-day${day}`;

  // Günün cart item'ları (isimli olanlar)
  const dayNamedItems = window.cart.filter(it => it.day == day && it.name !== undefined);

  // Noktaları en başta al (location’u olanlar)
  const points = getDayPoints(day);

 
  // 0 NOKTA (location yok) -> küçük harita YOK
if (!points || points.length === 0) {
  if (typeof clearRouteCachesForDay === 'function') clearRouteCachesForDay(day);
  if (typeof clearRouteVisualsForDay === 'function') clearRouteVisualsForDay(day);
  if (typeof clearDistanceLabels === 'function') clearDistanceLabels(day);
  if (typeof updateRouteStatsUI === 'function') updateRouteStatsUI(day);

  if (typeof removeDayMapCompletely === 'function') {
    removeDayMapCompletely(day);
  } else if (typeof removeDayMap === 'function') {
    removeDayMap(day);
  } else {
    document.getElementById(`route-map-day${day}`)?.remove();
    document.getElementById(`route-info-day${day}`)?.remove();
    document.getElementById(`map-bottom-controls-wrapper-day${day}`)?.remove();
    document.getElementById(`route-controls-bar-day${day}`)?.remove();
  }
  return;
}

  // 1 NOKTA
  if (points.length === 1) {
    if (typeof clearRouteCachesForDay === 'function') clearRouteCachesForDay(day);
    if (typeof clearRouteVisualsForDay === 'function') clearRouteVisualsForDay(day);

    ensureDayMapContainer(day);
    initEmptyDayMap(day);

    const map = window.leafletMaps?.[containerId];
    if (typeof updateRouteStatsUI === 'function') updateRouteStatsUI(day);
    if (typeof clearDistanceLabels === 'function') clearDistanceLabels(day);

    if (map) {
      map.eachLayer(l => { if (!(l instanceof L.TileLayer)) map.removeLayer(l); });
      const p = points[0];
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: 8,
        color: '#8a4af3',
        fillColor: '#8a4af3',
        fillOpacity: 0.9,
        weight: 2
      }).addTo(map).bindPopup(`<b>${p.name || 'Point'}</b>`);
      if (marker._path) marker._path.classList.add('single-point-pulse');
      else setTimeout(() => marker._path && marker._path.classList.add('single-point-pulse'), 30);
      try { map.flyTo([p.lat, p.lng], 14, { duration: 0.6, easeLinearity: 0.2 }); } catch {}
    }

    const expandedMapObj = window.expandedMaps?.[containerId];
    if (expandedMapObj?.expandedMap) {
      const eMap = expandedMapObj.expandedMap;
      eMap.eachLayer(l => { if (l instanceof L.Marker || l instanceof L.Polyline) eMap.removeLayer(l); });
      const p = points[0];
      const m = L.circleMarker([p.lat, p.lng], {
        radius: 11,
        color: '#8a4af3',
        fillColor: '#8a4af3',
        fillOpacity: 0.92,
        weight: 3
      }).addTo(eMap).bindPopup(`<b>${p.name || 'Point'}</b>`).openPopup();
      if (m._path) m._path.classList.add('single-point-pulse');
      try { eMap.flyTo([p.lat, p.lng], 15, { duration: 0.6, easeLinearity: 0.2 });
 } catch {}
    }
    return;
  }

  // (Aşağıdaki kısım senin son kodundaki ile AYNI – ham track modu + normal rota)
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
        map.eachLayer(l => { if (!(l instanceof L.TileLayer)) map.removeLayer(l); });
        const latlngs = raw.map(pt => [pt.lat, pt.lng]);
        const poly = addPolylineSafe(map, latlngs, { color: '#1565c0', weight: 5, opacity: 0.9 });
        addCircleMarkerSafe(map, latlngs[0], { radius:8, color:'#2e7d32', fillColor:'#2e7d32', fillOpacity:0.95, weight:2 }).bindPopup('Start');
        addCircleMarkerSafe(map, latlngs[latlngs.length - 1], { radius:8, color:'#c62828', fillColor:'#c62828', fillOpacity:0.95, weight:2 }).bindPopup('Finish');
        try { map.fitBounds(poly.getBounds(), { padding:[20,20] }); } catch(_){}
      }

      let distM = 0;
      for (let i=1;i<raw.length;i++){
        const a = raw[i-1], b = raw[i];
        distM += haversine(a.lat, a.lng, b.lat, b.lng);
      }

      let durationSec;
      const firstTimed = raw.find(p => p.time);
      const lastTimed  = [...raw].reverse().find(p => p.time);
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
      delete window.lastRouteGeojsons[containerId];

      if (typeof updateRouteStatsUI === 'function') updateRouteStatsUI(day);
      if (typeof updatePairwiseDistanceLabels === 'function') updatePairwiseDistanceLabels(day);
      if (typeof adjustExpandedHeader === 'function') adjustExpandedHeader(day);

      const expandedMapObj = window.expandedMaps?.[containerId];
      if (expandedMapObj?.expandedMap) {
        const eMap = expandedMapObj.expandedMap;
        eMap.eachLayer(l => { if (!(l instanceof L.TileLayer)) eMap.removeLayer(l); });
        const latlngs = raw.map(pt => [pt.lat, pt.lng]);
        const polyEx = L.polyline(latlngs, { color:'#1565c0', weight:7, opacity:0.9 }).addTo(eMap);
        try { eMap.fitBounds(polyEx.getBounds()); } catch(_){}
        L.circleMarker(latlngs[0], { radius:9, color:'#2e7d32', fillColor:'#2e7d32', fillOpacity:0.95, weight:2 }).addTo(eMap);
        L.circleMarker(latlngs[latlngs.length -1], { radius:9, color:'#c62828', fillColor:'#c62828', fillOpacity:0.95, weight:2 }).addTo(eMap);
      }
      return;
    }
  }

  // 2+ NOKTA normal rota
  ensureDayMapContainer(day);
  initEmptyDayMap(day);

  const snappedPoints = [];
  for (const pt of points) {
    const snapped = await snapPointToRoad(pt.lat, pt.lng);
    snappedPoints.push({ ...snapped, name: pt.name });
  }
  const coordinates = snappedPoints.map(pt => [pt.lng, pt.lat]);

  async function fetchRoute() {
    const coordParam = coordinates.map(c => `${c[0]},${c[1]}`).join(';');
    const url = buildMapboxDirectionsUrl(coordParam, day);
    const response = await fetch(url);
    if (!response.ok) {
      alert("Rota oluşturulamıyor: Seçtiğiniz noktalar arasında yol yok veya çok uzak. Lütfen noktaları değiştirin.");
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
              source: 'Mapbox'
            }
          }
        }]
      },
      coords: data.routes[0].geometry.coordinates,
      summary: {
        distance: data.routes[0].distance,
        duration: data.routes[0].duration
      }
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
    if (infoPanel) infoPanel.textContent = "Rota çizilemedi!";
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

  renderLeafletRoute(containerId, routeData.geojson, snappedPoints, routeData.summary, day, missingPoints);

  const expandedMapObj = window.expandedMaps?.[containerId];
  if (expandedMapObj?.expandedMap) {
    updateExpandedMap(expandedMapObj.expandedMap, day);
  }

  const pairwiseSummaries = [];
  for (let i = 0; i < points.length - 1; i++) {
    try {
      const pairCoords = [
        [points[i].lng, points[i].lat],
        [points[i + 1].lng, points[i + 1].lat]
      ];
      const coordParam = pairCoords.map(c => `${c[0]},${c[1]}`).join(';');
      const url = buildMapboxDirectionsUrl(coordParam, day);
      const response = await fetch(url);
      if (!response.ok) throw new Error('Mapbox error');
      const data = await response.json();
      if (!data.routes || !data.routes[0]) throw new Error('No route found');
      pairwiseSummaries.push({
        distance: data.routes[0].distance,
        duration: data.routes[0].duration
      });
    } catch {
      pairwiseSummaries.push({ distance: null, duration: null });
    }
  }
  window.pairwiseRouteSummaries = window.pairwiseRouteSummaries || {};
  window.pairwiseRouteSummaries[containerId] = pairwiseSummaries;
  if (typeof updatePairwiseDistanceLabels === 'function') updatePairwiseDistanceLabels(day);

  // Küçük scale bar DEVRE DIŞI: expanded haritada göstereceğiz
  const scaleBarDiv = document.getElementById(`route-scale-bar-day${day}`);
  if (scaleBarDiv) scaleBarDiv.innerHTML = "";

  if (routeData.summary && typeof updateDistanceDurationUI === 'function') {
    updateDistanceDurationUI(routeData.summary.distance, routeData.summary.duration);
  }

  const hint = document.querySelector(`#route-map-day${day} .empty-map-hint`);
  if (hint) hint.remove();

  setTimeout(() => typeof updateRouteStatsUI === 'function' && updateRouteStatsUI(day), 200);
  if (typeof adjustExpandedHeader === 'function') adjustExpandedHeader(day);
}


/** Her iki mekan arası ayraçlara pairwise summary'leri yazar */
function updatePairwiseDistanceLabels(day) {
    const containerId = `route-map-day${day}`;
    const pairwiseSummaries = window.pairwiseRouteSummaries?.[containerId] || [];
    // Sıralı separator'lara sırayla yaz
    const separators = document.querySelectorAll(`#day-container-${day} .distance-separator`);
    separators.forEach((separator, idx) => {
        const summary = pairwiseSummaries[idx];
        let distanceStr = '', durationStr = '';
        if (summary && summary.distance != null) {
            distanceStr = summary.distance >= 1000
                ? (summary.distance / 1000).toFixed(1) + " km"
                : Math.round(summary.distance) + " m";
            durationStr = summary.duration >= 60
                ? Math.round(summary.duration / 60) + " dk"
                : Math.round(summary.duration) + " sn";
        } else {
            distanceStr = "—";
            durationStr = "—";
        }
        const label = separator.querySelector('.distance-label');
        if (label) {
            label.innerHTML = `
               
                <span class="distance-value">${distanceStr}</span> • 
                <span class="duration-value">${durationStr}</span>
            `;
        }
    });
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





// 4. Aktif gün numarası (containerId ile gerekirse dinamik)
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
        const homeIcon = document.getElementById("home-icon");
        if (homeIcon) homeIcon.classList.add('active');
    } else if (option === 2) {
        if (aboutUsSection) {
            aboutUsSection.style.display = 'block';
            aboutUsSection.classList.add('active');
        }
        const ttIcon = document.getElementById("tt-icon");
        if (ttIcon) ttIcon.classList.add('active');
    }
}

document.addEventListener('click', function(event) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;

    const homeIcon = document.querySelector('img[src="img/home-icon.svg"]');
    const ttIcon = document.querySelector('img[src="img/tt-icon.svg"]');
    const welcomeSection = document.getElementById('tt-welcome');
    const aboutUsSection = document.getElementById('tt-about-us');
    const userMessageDiv = document.querySelector('.message.user-message');

    let clickedOnHomeIcon = homeIcon && homeIcon.contains(event.target);
    let clickedOnTtIcon = ttIcon && ttIcon.contains(event.target);
    let clickedInsideWelcome = welcomeSection && welcomeSection.contains(event.target);
    let clickedInsideAboutUs = aboutUsSection && aboutUsSection.contains(event.target);

    if (!clickedOnHomeIcon && !clickedOnTtIcon && !clickedInsideWelcome && !clickedInsideAboutUs) {
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



function startNewChat() {
    document.getElementById('chat-box').innerHTML = '';
    const chatBox = document.getElementById('chat-box');
    const newMessage = document.createElement('div');
    newMessage.className = 'message bot-message';
    newMessage.innerHTML = "<img src='img/avatar_aiio.png' alt='Bot Profile' class='profile-img'>Let's get started. Please specify a location, duration, and the type of trip you want";
    chatBox.appendChild(newMessage);
    document.getElementById('user-input').value = '';

    const inputWrapper = document.querySelector('.input-wrapper');
    if (inputWrapper) {
        inputWrapper.style.display = 'block';
    }
}
                       function switchToLogin() {
    document.getElementById("login-form").classList.remove("hidden");
    document.getElementById("signup-form").classList.add("hidden");
}

function switchToSignup() {
    document.getElementById("signup-form").classList.remove("hidden");
    document.getElementById("login-form").classList.add("hidden");
}




function hideLoadingPanel() {
    // Ekranda loading paneli gizle
    const panel = document.getElementById("loading-panel");
    if (panel) {
        panel.style.display = "none";
    }
}
   function showLoadingPanel() {
    // Ekranda loading paneli görünür yap
    const panel = document.getElementById("loading-panel");
    if (panel) {
        panel.style.display = "grid"; // veya "block" da kullanılabilir ama "grid" ile tam ortalanır!
    }
}

    // Butonlara click eventi ekle
    document.querySelectorAll('.suggest-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            showLoadingPanel();
            // Sorgu bitince paneli kapat örnek: 2sn sonra gizle
            setTimeout(hideLoadingPanel, 2000);
        });
    });


// Harita objelerini global tut 
window.leafletMaps = window.leafletMaps || {};


const PLACEHOLDER_IMG = "img/placeholder.png";

const MAPBOX_STYLES = [
    {name: "Streets modes", key: "streets-v12"},        
    {name: "Navigation", key: "dark-v11"},       
    {name: "Satellite", key: "satellite-streets-v12"}
];

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

      // Gün içindeki ana bloklar (mevcut davranış)
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

      // + Add Category butonu (gün container’ının hemen ardından)
      const next = dayContainer.nextElementSibling;
      if (next && next.classList.contains('add-more-btn')) {
        next.classList.toggle('collapsed');
      }
    };
  });
}   

/* 4) Sync vertical guide line with scale-bar hover on expanded map
      — patch setupScaleBarInteraction to also show the map line */
(function patchSetupScaleBarInteraction(){
  if (!window.setupScaleBarInteraction || window.__ttElevScalePatched) return;
  const original = window.setupScaleBarInteraction;
  window.setupScaleBarInteraction = function(day, map) {
    const cleanup = original(day, map) || null;

    // Also hook into our own hover to draw a vertical line under the map marker
    const scaleBar = document.getElementById(`expanded-route-scale-bar-day${day}`);
    if (!scaleBar || !map) return cleanup;

    const containerId = `route-map-day${day}`;

    function onMove(e) {
      const rect = scaleBar.getBoundingClientRect();
      const x = (e.touches && e.touches.length) ? (e.touches[0].clientX - rect.left) : (e.clientX - rect.left);
      const percent = Math.max(0, Math.min(x / rect.width, 1));
      const geojson = window.lastRouteGeojsons?.[containerId];
      if (!geojson || !geojson.features || !geojson.features[0]?.geometry?.coordinates) return;
      const coords = geojson.features[0].geometry.coordinates;

      // cum distances
      let cumDist = [0];
      for (let i = 1; i < coords.length; i++) {
        const [lng1, lat1] = coords[i - 1];
        const [lng2, lat2] = coords[i];
        const d = (function(lat1, lon1, lat2, lon2) {
          const R=6371000, toRad=(x)=>x*Math.PI/180;
          const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
          const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
          return 2*R*Math.asin(Math.sqrt(a));
        })(lat1, lng1, lat2, lng2);
        cumDist[i] = cumDist[i-1] + d;
      }
      const totalDist = cumDist[cumDist.length - 1];
      const target = percent * totalDist;

      let idx = 0;
      while (cumDist[idx] < target && idx < cumDist.length - 1) idx++;
      let lat, lng;
      if (idx === 0) {
        lat = coords[0][1]; lng = coords[0][0];
      } else {
        const prev = idx - 1;
        const seg = cumDist[idx] - cumDist[prev] || 1;
        const t = (target - cumDist[prev]) / seg;
        lat = coords[prev][1] + (coords[idx][1] - coords[prev][1]) * t;
        lng = coords[prev][0] + (coords[idx][0] - coords[prev][0]) * t;
      }
      showMarkerVerticalLineOnMap(map, L.latLng(lat, lng));
    }

    function onLeave() {
      hideMarkerVerticalLineOnMap(map);
    }

    scaleBar.addEventListener('mousemove', onMove);
    scaleBar.addEventListener('mouseleave', onLeave);
    scaleBar.addEventListener('touchmove', onMove, { passive: true });
    scaleBar.addEventListener('touchend', onLeave, { passive: true });

    // Return a cleanup wrapper that also detaches our handlers
    return function patchedCleanup() {
      if (cleanup) cleanup();
      scaleBar.removeEventListener('mousemove', onMove);
      scaleBar.removeEventListener('mouseleave', onLeave);
      scaleBar.removeEventListener('touchmove', onMove);
      scaleBar.removeEventListener('touchend', onLeave);
    };
  };
  window.__ttElevScalePatched = true;
})();

/* 5) Patch marker interactions to show/hide the vertical guide line */
(function patchMarkerDragClicks(){
  if (!window.addDraggableMarkersToExpandedMap || window.__ttElevMarkerPatched) return;
  const original = window.addDraggableMarkersToExpandedMap;

  window.addDraggableMarkersToExpandedMap = function(expandedMap, day) {
    original(expandedMap, day);

    // Re-bind clicks for current markers
    // Show line on marker click; hide on map click; update on drag
    expandedMap.eachLayer(layer => {
      if (!(layer instanceof L.Marker)) return;

      // Click -> show vertical line under marker
      layer.on('click', () => {
        const ll = layer.getLatLng();
        showMarkerVerticalLineOnMap(expandedMap, ll);
      });

      // Drag interactions update the guide line
      layer.on('dragstart', () => hideMarkerVerticalLineOnMap(expandedMap));
      layer.on('dragend', () => {
        const ll = layer.getLatLng();
        showMarkerVerticalLineOnMap(expandedMap, ll);
      });
    });

    // Click on map background -> hide line
    expandedMap.on('click', () => hideMarkerVerticalLineOnMap(expandedMap));
  };

  window.__ttElevMarkerPatched = true;
})();



function getRouteMarkerPositionsOrdered(day, snapThreshold = 0.2) {
    // snapThreshold: km cinsinden (örn: 0.2 km = 200m)
    const containerId = `route-map-day${day}`;
    const geojson = window.lastRouteGeojsons?.[containerId];
    if (!geojson || !geojson.features || !geojson.features[0]?.geometry?.coordinates) return [];
    const routeCoords = geojson.features[0].geometry.coordinates;
    const points = getDayPoints(day);

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

    // Polyline cumulative distance
    let cumDist = [0];
    for (let i = 1; i < routeCoords.length; i++) {
        const [lon1, lat1] = routeCoords[i - 1], [lon2, lat2] = routeCoords[i];
        cumDist[i] = cumDist[i - 1] + haversine(lat1, lon1, lat2, lon2);
    }

    // SIRALI snap: her marker için, polyline'da bir öncekinin index'inden sonrasını tara
    let lastIdx = 0;
    return points.map((marker) => {
        let minIdx = lastIdx, minDist = Infinity;
        for (let i = lastIdx; i < routeCoords.length; i++) {
            const [lon, lat] = routeCoords[i];
            const d = haversine(lat, lon, marker.lat, marker.lng);
            if (d < minDist) {
                minDist = d;
                minIdx = i;
            }
        }
        // Eğer minDist snapThreshold (örn: 200m) üstündeyse, "yakınında bitir" mantığı: yine de en yakın noktayı kullan! (uyarı istersen burada ekle)
        lastIdx = minIdx;
        return {
            name: marker.name,
            distance: cumDist[minIdx] / 1000, // km
            snapped: minDist <= snapThreshold * 1000, // threshold'un altında mı
            snappedDistance: minDist // metre
        }
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
function setupStepsDragHighlight() {
    document.querySelectorAll('.steps[draggable="true"]').forEach(item => {
        item.addEventListener('dragstart', function(e) {
            setAllDayListBorders(true);  // Tüm day-list'lere mor border ekle
        });
        item.addEventListener('dragend', function(e) {
            setAllDayListBorders(false); // Border'ı kaldır
        });
    });
}

// Her DOM güncellemesinden sonra (örn. updateCart() fonksiyonu bitiminde) tekrar çağır!
document.addEventListener('DOMContentLoaded', setupStepsDragHighlight);















/***** Travel mode (clean, per-day) *****/

// Storage key for per-day modes
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

// Back-compat profile getter (without day) — uses currentDay as best-effort
/* function getMapboxProfile() {
  return getTravelModeForDay(window.currentDay || 1);
} */

// Day-aware profile getter
function getMapboxProfileForDay(day) {
  return getTravelModeForDay(day);
}

// Set mode only for the given day and re-render that day
window.setTravelMode = function(mode, day) {
  const m = (mode || '').toLowerCase();
  if (!['driving','cycling','walking'].includes(m)) return;

  const d = parseInt(day || window.currentDay || 1, 10);
  saveTravelModeForDay(d, m);

  // Keep a coarse global for legacy code that may read window.travelMode
  window.travelMode = m;
  localStorage.setItem('tt_travel_mode', m);

  try { if (typeof renderRouteForDay === 'function') renderRouteForDay(d); } catch(_) {}
  try {
    const containerId = `route-map-day${d}`;
    const expandedObj = window.expandedMaps?.[containerId];
    if (expandedObj && expandedObj.expandedMap && typeof updateExpandedMap === 'function') {
      updateExpandedMap(expandedObj.expandedMap, d);
    }
  } catch(_) {}

  markActiveTravelModeButtons();
};

// Build Directions URL; day is optional (defaults to currentDay)
window.buildMapboxDirectionsUrl = function(coordsStr, day) {
  const profile = getMapboxProfileForDay(day || window.currentDay || 1);
  const token = window.MAPBOX_TOKEN || window.MAPBOX_ACCESS_TOKEN || window.mapboxToken;
  // Programatik input set helper (manuel yazımı ayırt etmek için)
if (typeof setChatInputValue !== 'function') {
  window.__programmaticInput = false;
  function setChatInputValue(str) {
    const inp = document.getElementById('user-input');
    if (!inp) return;
    window.__programmaticInput = true;
    inp.value = str;
    // microtask sonunda flag’i geri al
    setTimeout(() => { window.__programmaticInput = false; }, 0);
  }
}
  return `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordsStr}?alternatives=false&geometries=geojson&overview=full&steps=false&access_token=${token}`;
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
  const realPoints = typeof getDayPoints === "function" ? getDayPoints(day) : [];
  const setId = `tt-travel-mode-set-day${day}`;
  // Önce her durumda eskiyi kaldır
  const oldSet = document.getElementById(setId);
  if (oldSet) oldSet.remove();

  // 0 veya 1 gerçek nokta varsa: sadece expand map tuşu
  if (!Array.isArray(realPoints) || realPoints.length < 2) {
    const set = document.createElement('div');
    set.id = setId;
    set.className = 'tt-travel-mode-set';
    set.dataset.day = String(day);
    set.innerHTML = `
      <button type="button" class="expand-map-btn" aria-label="Expand Map">
        <img class="tm-icon" src="img/see_route.gif" alt="MAP" loading="lazy" decoding="async">
        <span class="tm-label">MAP</span>
      </button>
    `;
    // Insert
    if (controlsWrapperEl && controlsWrapperEl.parentNode) {
      controlsWrapperEl.parentNode.insertBefore(set, controlsWrapperEl);
    } else if (routeMapEl && routeMapEl.parentNode) {
      routeMapEl.parentNode.insertBefore(set, routeMapEl.nextSibling);
    }
    // Event: expand map butonunu tıklandığında aç
    set.querySelector('.expand-map-btn').onclick = function() {
      const containerId = `route-map-day${day}`;
      expandMap(containerId, day);
    };
    return;
  }

  // 2+ nokta varsa tam travel mode set + expand map tuşu
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
    <button type="button" class="expand-map-btn" aria-label="Expand Map">
      <img class="tm-icon" src="img/see_route.gif" alt="MAP" loading="lazy" decoding="async">
      <span class="tm-label">MAP</span>
    </button>
  `;
  // Insert
  if (controlsWrapperEl && controlsWrapperEl.parentNode) {
    controlsWrapperEl.parentNode.insertBefore(set, controlsWrapperEl);
  } else if (routeMapEl && routeMapEl.parentNode) {
    routeMapEl.parentNode.insertBefore(set, routeMapEl.nextSibling);
  }
  // Travel mode buttons
  set.addEventListener('mousedown', e => e.stopPropagation(), { passive: true });
  set.addEventListener('click', (e) => {
    e.stopPropagation();
    // Expand map
    if (e.target.closest('.expand-map-btn')) {
      const containerId = `route-map-day${day}`;
      expandMap(containerId, day);
      return;
    }
    // Travel mode buttons
    const btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    window.setTravelMode(btn.getAttribute('data-mode'), day);
  });

  // Actives (varsayılanı işaretle)
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

// Lightweight styles for per-day set
(function ensureTmStyles(){
  if (document.getElementById('tt-travel-mode-style-multi')) return;
  const style = document.createElement('style');
  style.id = 'tt-travel-mode-style-multi';
  style.textContent = `
    .tt-travel-mode-set {
      display: inline-flex;
      gap: 6px;
 align-items: flex-start;
    justify-content: space-between;
border-bottom:1px solid #ddd;
      margin-left: 12px;
        padding: 6px 0 12px 0;
        width: -webkit-fill-available;
    }
    .tt-travel-mode-set button {
      border: 1px solid #ccc; background: #fff; color: #333; border-radius: 8px;
      padding: 6px 10px; cursor: pointer; font-size: 13px; line-height: 1; min-width: 32px;
    }
    .tt-travel-mode-set button.active {
      background: #ffffff; border-color: #0d6efd; color: #fff;
    }
    .tt-travel-mode-set button:hover { filter: brightness(0.97); }
  `;
  document.head.appendChild(style);
})();

// Init once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  cleanupLegacyTravelMode();
  try { renderTravelModeControlsForAllDays(); } catch(_) {}
});

// Add once (outside the loop): minimal styles for the travel mode set above stats
/*
(function ensureTmMiniStyles(){
  if (document.getElementById('tt-travel-mode-style-inline')) return;
  const style = document.createElement('style');
  style.id = 'tt-travel-mode-style-inline';
  style.textContent = `
    .tt-travel-mode-set {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      margin: 6px 0 8px 0;
    }
    .tt-travel-mode-set button {
      border: 1px solid #ccc; background: #fff; color: #333; border-radius: 8px;
      padding: 6px 10px; cursor: pointer; font-size: 13px; line-height: 1; min-width: 32px;
    }
    .tt-travel-mode-set button.active {
      background: #0d6efd; border-color: #0d6efd; color: #fff;
    }
    .tt-travel-mode-set button:hover { filter: brightness(0.97); }
  `;
  document.head.appendChild(style);
})(); */

// Canvas renderer helper (tek map için reuse edilir)
function ensureCanvasRenderer(map) {
  if (!map._ttCanvasRenderer) {
    map._ttCanvasRenderer = L.canvas(); // you can pass padding if needed
  }
  return map._ttCanvasRenderer;
}



/* ------------------ Responsive .steps Slider (per .day-steps) ------------------ */
(function initResponsiveStepsSliderModule(){
  function ensureStyles() {
    if (document.getElementById('tt-resp-steps-slider-styles')) return;
    const s = document.createElement('style');
    s.id = 'tt-resp-steps-slider-styles';
    s.textContent = `
      .day-steps.tt-resp { position: relative; }
      .tt-resp-viewport {width: 100%; }
      .tt-resp-track {
        display: flex;
        gap: 12px;
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        -webkit-overflow-scrolling: touch;
        padding: 4px 2px 8px 2px;
      }
      .tt-resp-track > .steps {
        flex: 0 0 calc(100% / var(--slides-per-view, 1));
        scroll-snap-align: start;
      }
      .tt-resp-nav {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        width: 38px; height: 38px;
        border: none; border-radius: 50%;
        background: rgba(0,0,0,0.38);
        color: #fff; font-size: 20px; line-height: 38px;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; z-index: 3;
        transition: background 0.2s ease, opacity 0.2s ease;
      }
      .tt-resp-nav:hover { background: rgba(0,0,0,0.5); }
      .tt-resp-nav.prev { left: 6px; }
      .tt-resp-nav.next { right: 6px; }
      .tt-resp-nav[disabled] { opacity: 0.4; cursor: default; }
      /* 1 slayt veya görünürden azsa oklar gizlensin */
      .day-steps.tt-resp[data-nav="hidden"] .tt-resp-nav { display: none; }
    `;
    document.head.appendChild(s);
  }

  function computeSlidesPerView(el) {
    // Konteyner genişliğine göre 1 / 2 / 3
    const w = el.clientWidth || window.innerWidth;
    if (w >= 1200) return 3;
    if (w >= 768) return 2;
    return 1;
  }

  function getStepsChildren(container) {
    return Array.from(container.querySelectorAll(':scope > .steps'));
  }

  function buildSlider(container) {
    if (!container || container.dataset.sliderized === '1') return;
    const steps = getStepsChildren(container);
    if (steps.length === 0) return;

    // Viewport ve Track’i oluştur
    const viewport = document.createElement('div');
    viewport.className = 'tt-resp-viewport';
    const track = document.createElement('div');
    track.className = 'tt-resp-track';

    // Track’i en üste yerleştir (harita/diğer bloklar altta kalır)
    container.insertBefore(viewport, steps[0]);
    viewport.appendChild(track);

    // .steps’leri track içine taşı
    steps.forEach(s => track.appendChild(s));

    // Oklar
    const prevBtn = document.createElement('button');
    prevBtn.className = 'tt-resp-nav prev';
    prevBtn.type = 'button';
    prevBtn.setAttribute('aria-label', 'Previous');
    prevBtn.innerHTML = '‹';

    const nextBtn = document.createElement('button');
    nextBtn.className = 'tt-resp-nav next';
    nextBtn.type = 'button';
    nextBtn.setAttribute('aria-label', 'Next');
    nextBtn.innerHTML = '›';

    // Tıklamalar üst seviyeye yayılmasın (accordion vs. tetiklenmesin)
    [prevBtn, nextBtn].forEach(btn => {
      btn.addEventListener('click', e => e.stopPropagation());
      btn.addEventListener('mousedown', e => e.stopPropagation(), { passive: true });
    });

    container.appendChild(prevBtn);
    container.appendChild(nextBtn);

    container.classList.add('tt-resp');
    container.dataset.sliderized = '1';

    // State
    let index = 0;

    function slides() {
      return Array.from(track.querySelectorAll(':scope > .steps'));
    }

    function slidesPerView() {
      return parseInt(getComputedStyle(container).getPropertyValue('--slides-per-view') || '1', 10) || 1;
    }

    function setSlidesPerViewResponsive() {
      const spv = computeSlidesPerView(container);
      container.style.setProperty('--slides-per-view', String(spv));
      // Yeterli slayt yoksa okları gizle
      const total = slides().length;
      const needNav = total > spv;
      container.dataset.nav = needNav ? 'shown' : 'hidden';
      // Var olan konuma hizala
      goTo(index, false);
    }

    function clamp(i) {
      const total = slides().length;
      const maxIndex = Math.max(0, total - 1);
      if (i < 0) return 0;
      if (i > maxIndex) return maxIndex;
      return i;
    }

    function targetOffsetLeft(i) {
      const list = slides();
      const el = list[i];
      if (!el) return 0;
      // offsetLeft track’e göre olduğundan doğru hizalar
      return el.offsetLeft;
    }

    function updateButtons() {
      const total = slides().length;
      const spv = slidesPerView();
      const maxStart = Math.max(0, total - spv);
      prevBtn.disabled = (index <= 0);
      nextBtn.disabled = (index >= maxStart);
    }

    function goTo(i, smooth = true) {
      const spv = slidesPerView();
      const total = slides().length;
      // Görünür pencere kadar kaydırırken index start slaytı temsil etsin
      const maxStart = Math.max(0, total - spv);
      index = Math.max(0, Math.min(i, maxStart));
      const left = targetOffsetLeft(index);
      track.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
      updateButtons();
    }

    prevBtn.addEventListener('click', () => goTo(index - 1));
    nextBtn.addEventListener('click', () => goTo(index + 1));

    // Scroll sırasında en yakın başlangıç slaydını bul
    let raf = null;
    track.addEventListener('scroll', () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const list = slides();
        if (!list.length) return;
        const spv = slidesPerView();
        // Başlangıç slaytlarını (0..total-spv) arasından en yakını
        const candidates = list.slice(0, Math.max(1, list.length - spv + 1));
        let best = 0, bestDist = Infinity;
        const currentLeft = track.scrollLeft;
        candidates.forEach((el, i) => {
          const dist = Math.abs(el.offsetLeft - currentLeft);
          if (dist < bestDist) { bestDist = dist; best = i; }
        });
        if (best !== index) {
          index = best;
          updateButtons();
        }
      });
    });

    // Mouse wheel ile yatay kaydırmayı kolaylaştır (opsiyonel)
    track.addEventListener('wheel', (e) => {
      // Shift basılı değilken dikey tekerleği yataya çevir
      if (!e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        track.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });

    // Resize’larda SPV güncelle
    const ro = new ResizeObserver(() => setSlidesPerViewResponsive());
    ro.observe(container);

    // Başlangıç
    setSlidesPerViewResponsive();
    updateButtons();

    // Dışarıdan erişim: en yakınını hizala
    container._ttRespSliderGoTo = goTo;
  }

  // Tüm mevcut .day-steps için uygula
  function initAll() {
    document.querySelectorAll('.day-steps').forEach(buildSlider);
  }

  // Sonradan eklenen .day-steps veya .steps için izleyici
  function watchDOM() {
    const mo = new MutationObserver((mutList) => {
      for (const mut of mutList) {
        mut.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          if (node.matches?.('.day-steps')) buildSlider(node);
          node.querySelectorAll?.('.day-steps').forEach(buildSlider);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  // Harici tetikleyici
  window.initDayStepsSliders = function() {
    initAll();
  };

  // Başlat
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensureStyles();
      initAll();
      watchDOM();
    });
  } else {
    ensureStyles();
    initAll();
    watchDOM();
  }
})();



/* Route controls bar styles (travel mode + map controls in one row) */
(function ensureRouteControlsBarStyles(){
  if (document.getElementById('tt-route-controls-bar-styles')) return;
  const s = document.createElement('style');
  s.id = 'tt-route-controls-bar-styles';
  s.textContent = `
    .route-controls-bar {
    display: flex;
    gap: 8px;
    margin: 10px 0 20px 0;
    flex-direction: column;
    padding: 10px;
    border-radius: 6px;
    background: #fafafa;
    border: 1px solid #ddd;
    }
    .route-controls-bar .tt-travel-mode-set { margin: 0; }
    @media (max-width: 560px) {
      .route-controls-bar { gap: 8px; }
    }
  `;
  document.head.appendChild(s);
})();

function wrapRouteControls(day) {
  const tm = document.getElementById(`tt-travel-mode-set-day${day}`);
  const controls = document.getElementById(`map-bottom-controls-wrapper-day${day}`);
  if (!controls) return;

  const dayContainer = document.getElementById(`day-container-${day}`);
  const parent = (tm && tm.parentNode === controls.parentNode) ? controls.parentNode : (dayContainer || controls.parentNode);

  const existing = document.getElementById(`route-controls-bar-day${day}`);
  if (existing) existing.remove();

  const bar = document.createElement('div');
  bar.className = 'route-controls-bar';
  bar.id = `route-controls-bar-day${day}`;

  // PATCH:
  if (controls && controls.parentNode === parent) {
    parent.insertBefore(bar, controls);
  } else {
    parent.appendChild(bar);
  }

  if (tm) bar.appendChild(tm);
  bar.appendChild(controls);

  const smallScaleBar = parent.querySelector(`#route-scale-bar-day${day}`);
  if (smallScaleBar) smallScaleBar.remove();
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


/* Route özeti (Mesafe/Süre) için etiketleri kaldır, ikon + değer göster */
(function ensureRouteStatsIconStyles(){
  if (document.getElementById('tt-route-stats-icon-styles')) return;
  const s = document.createElement('style');
  s.id = 'tt-route-stats-icon-styles';
  s.textContent = `
    .route-summary-control 
    {    width: 100%;
    font-size: 0.9rem;
    text-align: left;
    display: inline-flex
;
    align-items: center;
    gap: 12px;
     }
    .route-summary-control .stat { display: inline-flex; align-items: center; gap: 6px; color: inherit; }
    .route-summary-control .stat svg { width: 16px; height: 16px; display: block; }
  `;
  document.head.appendChild(s);
})();

(function initRouteSummaryIconizer(){
  // Basit metin ayrıştırıcı: "Mesafe: 3.58 km  Süre: 13 dk" gibi metinden değeri çeker
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

  // Mevcut tüm özetleri uygula
  function applyAll() {
    document.querySelectorAll('.route-summary-control').forEach(applyIcons);
  }

  // Dinamik güncellemeleri izle (metin değişirse tekrar uygula)
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


/* ===== SVG icon + label (badge-like) for travel modes and route summary ===== */

/* 1) Configure your SVG icon URLs from svgrepo (replace with any you like) */
window.TT_SVG_ICONS = {
  // Travel modes
  driving: '/img/way_car.svg',
  walking: '/img/way_walk.svg',
  cycling: '/img/way_bike.svg',

  // Route summary
  distance: 'https://www.svgrepo.com/show/533308/route.svg',
  duration: 'https://www.svgrepo.com/show/532984/clock-outline.svg',
};

/* 2) Styles: small, clean, tag-like labels next to icons */
(function ensureIconLabelStyles(){
  if (document.getElementById('tt-icon-label-styles')) return;
  const s = document.createElement('style');
  s.id = 'tt-icon-label-styles';
  s.textContent = `
    /* Travel mode set button with SVG + small label */
    .tt-travel-mode-set button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0px;
    border: none;
}   
    .tt-travel-mode-set button .tm-icon {
      width: 18px;
      height: 18px;
      display: inline-block;
    }
    .tt-travel-mode-set button .tm-label {
      display: inline-block;
      padding: 2px 6px;
      font-size: 12px;
      line-height: 1;
      border: 1px solid #d0d7de;
      border-radius: 6px; /* tag-style */
      color: #24292f;
      background: #ffffff;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      font-weight: 600;
    }
    .tt-travel-mode-set button.active .tm-label {
          background: #8a4af3;
   
    color: #ffffff;
}
    }

    /* Route summary (distance/time) with SVG + small value badge */
    .route-summary-control {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
  
.route-summary-control .stat {
    
    font-size: 0.9rem;
    text-align: left;
    display: inline-flex
;
    align-items: center;
    gap: 6px;
}
    .route-summary-control .stat .icon {
      width: 16px;
      height: 16px;
      display: inline-block;
    }
  
  `;
  document.head.appendChild(s);
})();


/* 4) Convert route summary text ("Mesafe: ...  Süre: ...") to SVG + badge values */
(function initRouteSummaryIconizer(){
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

/* 5) Hook into existing flows so enhancements are applied at the right time */
function enhanceAllTravelModeSets() {
  document.querySelectorAll('.day-container').forEach(dc => {
    const day = parseInt(dc.dataset.day || '0', 10);
    if (day) enhanceTravelModeSet(day);
  });
}

// If you have a patched renderLeafletRoute, add enhancement after controls are drawn
(function patchEnhancements(){
  if (!window.__tt_enhance_icons_patched && typeof renderLeafletRoute === 'function') {
    const original = renderLeafletRoute;
    window.renderLeafletRoute = async function(containerId, geojson, points = [], summary = null, day = 1, missingPoints = []) {
      const result = await original.apply(this, arguments);
      try { enhanceTravelModeSet(day); } catch (_) {}
      return result;
    };
    window.__tt_enhance_icons_patched = true;
  }
})();

// Also run after your own wrapRouteControlsForAllDays if present
if (typeof wrapRouteControlsForAllDays === 'function') {
  const originalWrapAll = wrapRouteControlsForAllDays;
  window.wrapRouteControlsForAllDays = function() {
    originalWrapAll.apply(this, arguments);
    try { enhanceAllTravelModeSets(); } catch(_) {}
  };
} else {
  // Fallback: run after initial render
  setTimeout(enhanceAllTravelModeSets, 0);
}


/* === Route summary: add Ascent/Descent badges and switch icons to distance.svg/time.svg ===
   Safe patch to append to the end of mukemmel.js
*/
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
      ? Math.round(durationSeconds / 60) + ' dk' : '';
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

(function ensureElevStyles(){
  if (document.getElementById('tt-elev-styles')) return;
  const s = document.createElement('style');
  s.id = 'tt-elev-styles';
  s.textContent = `
    /* Scale bar container */
     .scale-bar-track {
  position: relative;
  left: auto;
  right: auto;
  bottom: auto;
  z-index: 1;
  background: #fff;
  box-shadow: none;
  border-radius: 0;
  min-height: 150px;
  width: 100%;
}
    @supports (height: 100dvh) { .scale-bar-track { bottom: auto; } }
    @media (max-width:768px) { .scale-bar-track { width: 100%; } }
    /* Distance baseline and ticks (top) */
   
    .scale-bar-tick { position:absolute; top:10px; width:1px; height:16px; background:#cfd8dc; }
    .scale-bar-label { position:absolute; top:30px; transform:translateX(-50%); font-size:11px; color:#607d8b; }

    /* Elevation SVG layer and styling */
    .tt-elev-svg {
    position: absolute;
    left: 0;    
    width: 100%;
    height: 186px;
    pointer-events: none;
    z-index: -1;
    background:#ffffff;
}
    .tt-elev-grid line { stroke:#d7dde2; stroke-dasharray:4 4; opacity:.8; }
    .tt-elev-grid text { fill:#90a4ae; font-size:11px; }
    .tt-elev-area { fill:#dbe2ec; }              /* dark navy fill */
    .tt-elev-stroke { stroke:#b6ea53; fill:none; stroke-width:3; } /* lime outline */

    /* Hover cursor on the chart */
    .tt-elev-cursor { position:absolute; top:48px; bottom:16px; width:2px; background:#263238; opacity:.25; pointer-events:none; }
    .tt-elev-tooltip {
      position:absolute; top:26px; transform:translateX(-50%);
      padding:2px 6px; font-size:11px; line-height:1; color:#222; background:#fff;
      border:1px solid #d0d7de; border-radius:6px; box-shadow:0 1px 3px rgba(0,0,0,0.08);
      white-space:nowrap; opacity:0.96; pointer-events:none; z-index:3;
    }

    /* Vertical line under the marker on the map */
    .tt-map-vert-line {
      position:absolute; top:0; bottom:0; width:2px;
      background:rgba(0,0,0,.65); pointer-events:none; z-index: 500;
    }
  `;
  document.head.appendChild(s);
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

/* 1) Styles once */
(function ensureElevStyles(){
  if (document.getElementById('tt-elev-styles')) return;
  const s = document.createElement('style');
  s.id = 'tt-elev-styles';
  s.textContent = `
    /* Scale bar container */
    

    /* Distance baseline and ticks (top) */
 
    .scale-bar-tick { position:absolute; top:10px; width:1px; height:16px; background:#cfd8dc; }
    .scale-bar-label { position:absolute; top:30px; transform:translateX(-50%); font-size:11px; color:#607d8b; }

    /* Elevation SVG layer and styling */
    .tt-elev-svg {     position: absolute;
    left: 0;
    width: 100%;
    height: 186px;
    pointer-events: none;
    z-index: 0; 
    background: #ffffff;
    }
    .tt-elev-grid line { stroke:#d7dde2; stroke-dasharray:4 4; opacity:.8; }
    .tt-elev-grid text { fill:#90a4ae; font-size:11px; }
    .tt-elev-area { fill:#263445; }              /* dark navy fill */
    .tt-elev-stroke { stroke:#b6ea53; fill:none; stroke-width:3; } /* lime outline */

    /* Hover cursor on the chart */
    .tt-elev-cursor { position:absolute; top:48px; bottom:16px; width:2px; background:#263238; opacity:.25; pointer-events:none; }
    .tt-elev-tooltip {
      position:absolute; top:26px; transform:translateX(-50%);
      padding:2px 6px; font-size:11px; line-height:1; color:#222; background:#fff;
      border:1px solid #d0d7de; border-radius:6px; box-shadow:0 1px 3px rgba(0,0,0,0.08);
      white-space:nowrap; opacity:0.96; pointer-events:none; z-index:3;
    }

    /* Vertical line under the marker on the map */
    .tt-map-vert-line {
      position:absolute; top:0; bottom:0; width:2px;
      background:rgba(0,0,0,.65); pointer-events:none; z-index: 500;
    }
  `;
  document.head.appendChild(s);
})();

/* 2) Vertical guide line on the map */
function showMarkerVerticalLineOnMap(map, latlng) {
  if (!map || !latlng) return;
  const cont = map.getContainer();
  if (!cont) return;
  const pt = map.latLngToContainerPoint(latlng);
  let line = cont.querySelector('.tt-map-vert-line');
  if (!line) {
    line = document.createElement('div');
    line.className = 'tt-map-vert-line';
    cont.appendChild(line);
  }
  line.style.left = `${Math.round(pt.x)}px`;
  line.style.display = 'block';
}

(function disableMapVerticalGuideLine(){
  // 1) Force-hide any existing vertical line elements
  document.querySelectorAll('.tt-map-vert-line').forEach(el => {
    el.style.display = 'none';
  });

  // 2) One-time CSS to keep it hidden even if created elsewhere
  if (!document.getElementById('tt-hide-map-vert-line-style')) {
    const s = document.createElement('style');
    s.id = 'tt-hide-map-vert-line-style';
    s.textContent = `.tt-map-vert-line{ display:none !important; }`;
    document.head.appendChild(s);
  }

  // 3) Override helpers so any future calls become no-op (safe)
  window.showMarkerVerticalLineOnMap = function(map, latlng){
    try {
      const cont = map?.getContainer?.();
      const line = cont && cont.querySelector('.tt-map-vert-line');
      if (line) line.style.display = 'none';
    } catch {}
  };
  window.hideMarkerVerticalLineOnMap = function(map){
    try {
      const cont = map?.getContainer?.();
      const line = cont && cont.querySelector('.tt-map-vert-line');
      if (line) line.style.display = 'none';
    } catch {}
  };
})();
function hideMarkerVerticalLineOnMap(map) {
  const cont = map?.getContainer?.();
  if (!cont) return;
  const line = cont.querySelector('.tt-map-vert-line');
  if (line) line.style.display = 'none';
}

function renderRouteScaleBar(container, totalKm, markers) {
if (!container || isNaN(totalKm) || totalKm <= 0) {
  if (container) { container.innerHTML = ""; container.style.display = 'none'; }
  return;
}

  // Sadece expanded bar’da çalış; küçük bar’ı kapat
  if (/^route-scale-bar-day\d+$/.test(container.id || '')) {
    container.innerHTML = '';
    return;
  }

  // Day ve route geojson
  const dayMatch = container.id && container.id.match(/day(\d+)/);
  const day = dayMatch ? parseInt(dayMatch[1], 10) : null;
  const gjKey = day ? `route-map-day${day}` : null;
  const gj = gjKey ? (window.lastRouteGeojsons?.[gjKey]) : null;
  const coords = gj?.features?.[0]?.geometry?.coordinates;
 if (!coords || coords.length < 2) {
  container.innerHTML = `<div class="scale-bar-track"></div>`;
  container.style.display = 'none';
  return;
}
  // Cooldown / cache anahtarı
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
  if (container.dataset.elevLoadedKey === routeKey) {
    window.hideScaleBarLoading?.(container);
  }

  // Tek track
  let track = container.querySelector('.scale-bar-track');
  if (!track) {
    container.innerHTML = '';
    track = document.createElement('div');
    track.className = 'scale-bar-track';
    container.appendChild(track);
  } else {
    // Base render’ında, önceki tüm içerikleri kaldır (hem base hem segment)
    track.innerHTML = '';
  }

  // Container metadata
  container.dataset.totalKm = String(totalKm);

  // Seçim overlay
  const selDiv = document.createElement('div');
  selDiv.className = 'scale-bar-selection';
  selDiv.style.cssText = `
    position:absolute; top:0; bottom:0;
    background: rgba(138,74,243,0.16);
    border: 1px solid rgba(138,74,243,0.45);
    display:none; z-index: 6;
  `;
  track.appendChild(selDiv);

  // Görünüm
  const MARKER_PAD_PX = 10;
  track.style.position = 'relative';
  track.style.paddingLeft = `${MARKER_PAD_PX}px`;
  track.style.paddingRight = `${MARKER_PAD_PX}px`;
  track.style.overflow = 'visible';

  // Hover dikey çizgi + tooltip
  const verticalLine = document.createElement('div');
  verticalLine.className = 'scale-bar-vertical-line';
  verticalLine.style.cssText = `
    position:absolute;top:0;bottom:0;width:2px;
    background:#111;opacity:0.5;pointer-events:none;z-index:100;display:none;
  `;
  track.appendChild(verticalLine);

  const tooltip = document.createElement('div');
  tooltip.className = 'tt-elev-tooltip';
  tooltip.style.left = '0px';
  track.appendChild(tooltip);

  // Nice tick helpers
  function niceStep(total, target) {
    const raw = total / Math.max(1, target);
    const p10 = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / p10;
    const f = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return f * p10;
  }
  function createScaleElements(widthPx) {
    track.querySelectorAll('.scale-bar-tick, .scale-bar-label, .marker-badge').forEach(el => el.remove());
    const targetCount = Math.max(6, Math.min(14, Math.round(widthPx / 100)));
    let stepKm = niceStep(totalKm, targetCount);
    let majors = Math.max(1, Math.round(totalKm / Math.max(stepKm, 1e-6)));
    if (majors < 6) { stepKm = niceStep(totalKm, 6); majors = Math.round(totalKm / stepKm); }
    if (majors > 14) { stepKm = niceStep(totalKm, 14); majors = Math.round(totalKm / stepKm); }

    for (let i = 0; i <= majors; i++) {
      const curKm = Math.min(totalKm, i * stepKm);
      const leftPct = (curKm / totalKm) * 100;

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
      label.textContent = `${(i === majors ? totalKm : curKm).toFixed(totalKm > 20 ? 0 : 1)} km`;
      track.appendChild(label);
    }

    if (Array.isArray(markers)) {
      markers.forEach((m, idx) => {
        const left = (m.distance / totalKm) * 100;
        const wrap = document.createElement('div');
        wrap.className = 'marker-badge';
        wrap.style.cssText = `position:absolute;left:${left}%;top:2px;width:18px;height:18px;transform:translateX(-50%);`;
        wrap.title = m.name || '';
        wrap.innerHTML = `<div style="width:18px;height:18px;border-radius:50%;background:#d32f2f;border:2px solid #fff;box-shadow:0 2px 6px #888;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;font-weight:700;">${idx + 1}</div>`;
        track.appendChild(wrap);
      });
    }
  }

  // Mesafe (Haversine)
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

  // Örnekleme (tam profil)
  const N = Math.max(60, Math.round(totalKm * 5));
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

  // Tam profil örneklerini sakla
  container._elevFullSamples = samples.slice();
  container._elevSamples = samples.slice();
  container._elevStartKm = 0;
  container._elevKmSpan = totalKm;

  // Ölçek ve SVG haznesi
  let width = Math.max(200, Math.round(track.getBoundingClientRect().width));
  if (isNaN(width)) width = 400;
  createScaleElements(width);

  // BASE SVG (data-role="elev-base")
  const svgNS = 'http://www.w3.org/2000/svg';
  const SVG_TOP = 48;
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  let SVG_H = isMobile
    ? Math.max(180, Math.min(240, Math.round(track.getBoundingClientRect().height - SVG_TOP - 12)))
    : Math.max(180, Math.min(320, Math.round(track.getBoundingClientRect().height - SVG_TOP - 16)));
  if (isNaN(SVG_H)) SVG_H = isMobile ? 160 : 220;

  // Önceki base svg’yi kaldır
  track.querySelectorAll('svg[data-role="elev-base"]').forEach(el => el.remove());

  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'tt-elev-svg');
  svg.setAttribute('data-role', 'elev-base');
  svg.setAttribute('viewBox', `0 0 ${width} ${SVG_H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', SVG_H);
  track.appendChild(svg);

  const gridG = document.createElementNS(svgNS, 'g');
  gridG.setAttribute('class', 'tt-elev-grid');
  svg.appendChild(gridG);

  const areaPath = document.createElementNS(svgNS, 'path');
  areaPath.setAttribute('class', 'tt-elev-area');
  svg.appendChild(areaPath);

  const segG = document.createElementNS(svgNS, 'g');
  segG.setAttribute('class', 'tt-elev-segments');
  svg.appendChild(segG);

  // Redraw (aktif domain + örneklerle)
  function redrawElevation(elevationData) {
    if (!elevationData) return;
    const { smooth, min, max } = elevationData;

    const s = container._elevSamples || [];
    const startKmDom = Number(container._elevStartKm || 0);
    const spanKm = Number(container._elevKmSpan || totalKm) || 1;

    // Görsel min/max
    let vizMin = min, vizMax = max;
    const eSpan = max - min;
    if (eSpan > 0) { vizMin = min - eSpan * 0.50; vizMax = max + eSpan * 1.0; }
    else { vizMin = min - 1; vizMax = max + 1; }

    const X = kmRel => (kmRel / spanKm) * width;
    const Y = e => (isNaN(e) || vizMin === vizMax) ? (SVG_H / 2) : ((SVG_H - 1) - ((e - vizMin) / (vizMax - vizMin)) * (SVG_H - 2));

    while (gridG.firstChild) gridG.removeChild(gridG.firstChild);
    while (segG.firstChild) segG.removeChild(segG.firstChild);

    // Grid
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

    // Eğim renkli çizgiler
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
  }
  container._redrawElevation = redrawElevation;

  // Hover (aktif domain ile)
  if (track.__onMove)   track.removeEventListener('mousemove', track.__onMove);
  if (track.__onLeave)  track.removeEventListener('mouseleave', track.__onLeave);

  track.__onMove = (e) => {
    const ed = container._elevationData;
    if (!ed || !Array.isArray(ed.smooth)) return;
    const { smooth, min, max } = ed;

    const s = container._elevSamples || [];
    const startKmDom = Number(container._elevStartKm || 0);
    const spanKm = Number(container._elevKmSpan || totalKm) || 1;

    const rect = track.getBoundingClientRect();
    const ptX = e.clientX - rect.left;
    const widthNow = Math.max(200, Math.round(rect.width));

    let vizMin = min, vizMax = max;
    const eSpan = max - min;
    if (eSpan > 0) { vizMin = min - eSpan * 0.25; vizMax = max + eSpan * 0.25; }
    else { vizMin = min - 1; vizMax = max + 1; }

    const X = kmRel => (kmRel / spanKm) * widthNow;

    let minDist = Infinity, foundSlope = 0, foundElev = null, foundKmAbs = 0;
    const n = Math.min(smooth.length, s.length);
    for (let i = 1; i < n; i++) {
      const kmAbs1 = s[i - 1].distM / 1000;
      const kmAbs2 = s[i].distM / 1000;
      const x1 = Math.max(0, Math.min(widthNow, X(kmAbs1 - startKmDom)));
      const x2 = Math.max(0, Math.min(widthNow, X(kmAbs2 - startKmDom)));
      const mid = (x1 + x2) / 2;
      const dist = Math.abs(ptX - mid);
      if (dist < minDist) {
        minDist = dist;
        const dx = s[i].distM - s[i - 1].distM;
        const dy = smooth[i] - smooth[i - 1];
        foundSlope = dx > 0 ? (dy / dx) * 100 : 0;
        foundElev = Math.round(smooth[i]);
        foundKmAbs = kmAbs2;
      }
    }

    tooltip.style.opacity = '1';
    tooltip.textContent = `${foundKmAbs.toFixed(2)} km • ${foundElev ?? ''} m • %${foundSlope.toFixed(1)} slope`;
    tooltip.style.left = `${ptX}px`;
    verticalLine.style.left = `${ptX}px`;
    verticalLine.style.display = 'block';
  };

  track.__onLeave = () => {
    tooltip.style.opacity = '0';
    verticalLine.style.display = 'none';
  };

  track.addEventListener('mousemove', track.__onMove);
  track.addEventListener('mouseleave', track.__onLeave);

  // Mouse seçim (global handler’ları tekille)
  if (track.__onDown) track.removeEventListener('mousedown', track.__onDown);
  if (window.__sb_onMouseMove) { window.removeEventListener('mousemove', window.__sb_onMouseMove); window.__sb_onMouseMove = null; }
  if (window.__sb_onMouseUp)   { window.removeEventListener('mouseup',   window.__sb_onMouseUp);   window.__sb_onMouseUp   = null; }

  let drag = null; // {startX, lastX}
  track.__onDown = (e) => {
    const rect = track.getBoundingClientRect();
    drag = { startX: e.clientX - rect.left, lastX: e.clientX - rect.left };
    selDiv.style.left = `${drag.startX}px`;
    selDiv.style.width = `0px`;
    selDiv.style.display = 'block';
  };
  track.addEventListener('mousedown', track.__onDown);

  window.__sb_onMouseMove = (e) => {
    if (!drag) return;
    const rect = track.getBoundingClientRect();
    drag.lastX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const left = Math.min(drag.startX, drag.lastX);
    const right = Math.max(drag.startX, drag.lastX);
    selDiv.style.left = `${left}px`;
    selDiv.style.width = `${right - left}px`;
  };
  window.addEventListener('mousemove', window.__sb_onMouseMove);

  window.__sb_onMouseUp = () => {
    if (!drag) return;
    const rect = track.getBoundingClientRect();
    const leftPx = Math.min(drag.startX, drag.lastX);
    const rightPx = Math.max(drag.startX, drag.lastX);
    drag = null;

    if (rightPx - leftPx < 8) { selDiv.style.display = 'none'; return; }

    const totalKmToUse = Number(container.dataset.totalKm) || totalKm;
    const startKm = (leftPx / rect.width) * totalKmToUse;
    const endKm   = (rightPx / rect.width) * totalKmToUse;

    if (day != null) {
      fetchAndRenderSegmentElevation(container, day, startKm, endKm);
      if (typeof highlightSegmentOnMap === 'function') highlightSegmentOnMap(day, startKm, endKm);
    }
  };
  window.addEventListener('mouseup', window.__sb_onMouseUp);

  // Loader
  window.showScaleBarLoading?.(container, 'Loading elevation…');

  // Elevation verisini yükle
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
      container._elevationDataFull = { smooth: smooth.slice(), min, max }; // Tam profil snapshot
      container.dataset.elevLoadedKey = routeKey;

      redrawElevation(container._elevationData);
      window.hideScaleBarLoading?.(container);
    } catch {
      window.updateScaleBarLoadingText?.(container, 'Elevation temporarily unavailable');
      try { delete container.dataset.elevLoadedKey; } catch(_) {}
    }
  })();

  // Resize
  function handleResize() {
    const newW = Math.max(200, Math.round(track.getBoundingClientRect().width));
    if (Math.abs(newW - width) < 10) return;
    width = newW;
    svg.setAttribute('viewBox', `0 0 ${newW} ${SVG_H}`);
    createScaleElements(newW);
    if (container._elevationData) redrawElevation(container._elevationData);
  }
  if (container._elevResizeObserver) {
    try { container._elevResizeObserver.disconnect(); } catch(_) {}
    container._elevResizeObserver = null;
  }
  const ro = new ResizeObserver(() => { handleResize(); });
  ro.observe(track);
  container._elevResizeObserver = ro;
}
async function fetchAndRenderSegmentElevation(container, day, startKm, endKm) {
  // Duplike container’ları temizle
  const containerId = container.id;
  document.querySelectorAll(`#${CSS.escape(containerId)}`).forEach((el, idx) => {
    if (idx > 0) el.remove();
  });

  const key = `route-map-day${day}`;
  const gj = window.lastRouteGeojsons?.[key];
  const coords = gj?.features?.[0]?.geometry?.coordinates;
  if (!coords || coords.length < 2) return;

  // SADECE segment overlay’leri temizle
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

  // Kümülatif mesafe
  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1];
    const [lon2, lat2] = coords[i];
    cum[i] = cum[i - 1] + hv(lat1, lon1, lat2, lon2);
  }
  const totalM = cum[cum.length - 1] || 1;

  const segStartM = Math.max(0, Math.min(totalM, startKm * 1000));
  const segEndM   = Math.max(0, Math.min(totalM, endKm * 1000));
  if (segEndM - segStartM < 100) return; // çok kısa

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

  window.showScaleBarLoading?.(container, `Loading segment ${startKm.toFixed(1)}–${endKm.toFixed(1)} km…`);

  // Segment overlay’i için elevation al
  const routeKey = `seg:${coords.length}|${samples[0].lat.toFixed(4)},${samples[0].lng.toFixed(4)}|${samples[samples.length - 1].lat.toFixed(4)},${samples[samples.length - 1].lng.toFixed(4)}|${N}`;
  try {
    const elev = await window.getElevationsForRoute(samples, container, routeKey);
    if (!elev || elev.length !== N || elev.some(Number.isNaN)) return;

    const smooth = movingAverage(elev, 3);

    // BASE verileri DEĞİŞTİRME – sadece overlay çiz
    drawSegmentProfile(container, day, startKm, endKm, samples, smooth);
  } finally {
    window.hideScaleBarLoading?.(container);
  }
}


// ✅ TÜM YETIM SCALE-BAR-TRACK'LERI TEMİZLE (güvenlik)
function cleanupOrphanScaleBars() {
  document.querySelectorAll('.scale-bar-track').forEach(track => {
    // Eğer track bir expanded-route-scale-bar veya route-scale-bar container'ının içinde DEĞİLSE
    const parent = track.closest('[id^="expanded-route-scale-bar-day"], [id^="route-scale-bar-day"]');
    if (!parent) {
      console.warn('[cleanup] Orphan scale-bar-track removed:', track);
      track.remove();
    }
  });
}

// Her segment seçiminden ÖNCE temizle
document.addEventListener('mousedown', (e) => {
  const scaleBar = e.target.closest('.scale-bar-track');
  if (scaleBar) {
    setTimeout(cleanupOrphanScaleBars, 100);
  }
});


function highlightSegmentOnMap(day, startKm, endKm) {
  const cid = `route-map-day${day}`;
  const gj = window.lastRouteGeojsons?.[cid];
  if (!gj || !gj.features || !gj.features[0]?.geometry?.coordinates) return;

  window._segmentHighlight = window._segmentHighlight || {};
  const maps = [];
  const small = window.leafletMaps?.[cid];
  if (small) maps.push(small);
  const exp = window.expandedMaps?.[cid]?.expandedMap;
  if (exp) maps.push(exp);

  // Önce mevcut highlight’ları kaldır ve referansları sil
  maps.forEach(m => {
    if (window._segmentHighlight[day]?.[m._leaflet_id]) {
      try { m.removeLayer(window._segmentHighlight[day][m._leaflet_id]); } catch(_){}
      try { delete window._segmentHighlight[day][m._leaflet_id]; } catch(_){}
    }
  });

  // start/end verilmemişse sadece temizle
  if (typeof startKm !== 'number' || typeof endKm !== 'number') return;

  const coords = gj.features[0].geometry.coordinates; // [lng,lat]

  function hv(lat1, lon1, lat2, lon2) {
    const R=6371000, toRad=x=>x*Math.PI/180;
    const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
    const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(a));
  }
  const cum=[0];
  for (let i=1;i<coords.length;i++){
    const [lon1,lat1]=coords[i-1], [lon2,lat2]=coords[i];
    cum[i]=cum[i-1]+hv(lat1,lon1,lat2,lon2);
  }
  const segStartM = startKm*1000, segEndM=endKm*1000;

  let iStart = 0, iEnd = coords.length - 1;
  for (let i=1;i<cum.length;i++){ if (cum[i] >= segStartM){ iStart = i; break; } }
  for (let i=cum.length-2;i>=0;i--){ if (cum[i] <= segEndM){ iEnd = i+1; break; } }
  iStart = Math.max(0, Math.min(iStart, coords.length-2));
  iEnd = Math.max(iStart+1, Math.min(iEnd, coords.length-1));

  const sub = coords.slice(iStart, iEnd+1).map(c => [c[1], c[0]]);
  if (sub.length < 2) return;

  function ensureCanvasRenderer(m){ if(!m._ttCanvasRenderer) m._ttCanvasRenderer=L.canvas(); return m._ttCanvasRenderer; }

  window._segmentHighlight[day] = window._segmentHighlight[day] || {};
  maps.forEach(m => {
    const poly = L.polyline(sub, { color:'#8a4af3', weight:6, opacity:0.95, dashArray:'', renderer: ensureCanvasRenderer(m) }).addTo(m);
    window._segmentHighlight[day][m._leaflet_id] = poly;
    try { m.fitBounds(poly.getBounds(), { padding: [16,16] }); } catch(_){}
  });
}
(function patchSetupScaleBarInteraction(){
  if (!window.setupScaleBarInteraction || window.__ttElevScalePatched) return;
  const original = window.setupScaleBarInteraction;
  window.setupScaleBarInteraction = function(day, map) {
    // Keep original behavior; don't attach extra hover that draws vertical map line
    const cleanup = original(day, map) || null;
    return function patchedCleanup() {
      if (cleanup) cleanup();
    };
  };
  window.__ttElevScalePatched = true;
})();

(function patchMarkerDragClicks(){
  if (!window.addDraggableMarkersToExpandedMap || window.__ttElevMarkerPatched) return;
  const original = window.addDraggableMarkersToExpandedMap;

  window.addDraggableMarkersToExpandedMap = function(expandedMap, day) {
    original(expandedMap, day);

    // Re-bind clicks for current markers
    expandedMap.eachLayer(layer => {
      if (!(layer instanceof L.Marker)) return;

      // Click -> show vertical line under marker
      layer.on('click', () => {
        const ll = layer.getLatLng();
        showMarkerVerticalLineOnMap(expandedMap, ll);
      });

      // Drag interactions update the guide line
      layer.on('dragstart', () => hideMarkerVerticalLineOnMap(expandedMap));
      layer.on('dragend', () => {
        const ll = layer.getLatLng();
        showMarkerVerticalLineOnMap(expandedMap, ll);
      });
    });

    // Click on map background -> hide line
    expandedMap.on('click', () => hideMarkerVerticalLineOnMap(expandedMap));
  };

  window.__ttElevMarkerPatched = true;
})();

/* 6) Ensure cleanup when closing expanded map */
(function patchRestoreMapCleanup(){
  if (!window.restoreMap || window.__ttElevRestorePatched) return;
  const original = window.restoreMap;
  window.restoreMap = function(containerId, day) {
    const expanded = window.expandedMaps?.[containerId];
    if (expanded && expanded.expandedMap) {
      hideMarkerVerticalLineOnMap(expanded.expandedMap);
    }
    return original(containerId, day);
  };
  window.__ttElevRestorePatched = true;
})();


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


/* === Open‑Meteo Elevation fetch guard: throttle + singleflight + retry-after ===
   Drop-in patch: DO NOT modify existing renderRouteScaleBar. Append at file end.
*/
(function patchOpenMeteoElevationFetch(){
  if (window.__tt_openMeteoPatched) return;

  const OM_BASE = 'https://api.open-meteo.com/v1/elevation?';
  const originalFetch = window.fetch.bind(window);

  // Global pacing/state for ONLY Open‑Meteo elevation calls
  const queue = { chain: Promise.resolve() };               // serialize requests
  let lastTs = 0;
  const minIntervalMs = 1800;                               // >=1.8s between calls
  let cooldownUntil = 0;                                    // set after 429
  const inFlightByKey = new Map();                          // singleflight per URL

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // Enqueue a task so elevation calls never overlap
  function enqueue(task) {
    const next = queue.chain.then(task, task);
    queue.chain = next.catch(() => {}); // keep chain alive
    return next;
  }

  async function throttledFetchOnce(url, init) {
    // Respect 429 cooldown if any
    const now0 = Date.now();
    if (now0 < cooldownUntil) {
      await sleep(cooldownUntil - now0);
    }

    // Respect min interval
    const now = Date.now();
    const wait = Math.max(0, minIntervalMs - (now - lastTs));
    if (wait) await sleep(wait);

    const resp = await originalFetch(url, init);
    lastTs = Date.now();

    if (resp.status === 429) {
      // Use Retry-After if provided; otherwise 3 minutes cooldown
      const ra = parseInt(resp.headers.get('retry-after') || '0', 10);
      cooldownUntil = Date.now() + (ra > 0 ? ra * 1000 : 180000);
    }
    return resp;
  }

  async function throttledFetchWithRetry(url, init) {
    // First attempt (serialized)
    let resp = await enqueue(() => throttledFetchOnce(url, init));

    if (resp.status === 429) {
      // One retry: wait until cooldown, then go again
      const now = Date.now();
      if (now < cooldownUntil) {
        await sleep(cooldownUntil - now);
      }
      resp = await enqueue(() => throttledFetchOnce(url, init));
    }
    return resp;
  }

  // Monkey-patch fetch: only affect Open‑Meteo elevation calls
  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';

    if (!url.startsWith(OM_BASE)) {
      // Not elevation endpoint -> pass through
      return originalFetch(input, init);
    }

    // Singleflight by exact URL (same lat/lon list)
    if (inFlightByKey.has(url)) {
      return inFlightByKey.get(url);
    }

    const p = (async () => {
      try {
        const resp = await throttledFetchWithRetry(url, init);
        return resp;
      } finally {
        // Clear the singleflight slot after completion
        inFlightByKey.delete(url);
      }
    })();

    inFlightByKey.set(url, p);
    return p;
  };

  window.__tt_openMeteoPatched = true;
})();
/* === Scale bar loader helpers (centered overlay) === */
/* Scale bar ortası loader + 429 için tek seferlik yeniden deneme planlayıcı */
(function ensureScaleBarLoadingHelpers(){
  if (window.__tt_scaleBarLoaderReady) return;
  if (!document.getElementById('tt-scale-bar-loader-styles')) {
    const s = document.createElement('style');
    s.id = 'tt-scale-bar-loader-styles';
    s.textContent = `
      .tt-scale-loader{    position: absolute;
    left: 50%;
    top: 70%;
    transform: translate(-50%, -50%);
    display: flex
;
    align-items: center;
    gap: 10px;
    z-index: 5;
    background: #ffffff;
    /* border: 1px solid #e0e0e0; */
    border-radius: 10px;
    padding: 10px 13px;
    /* box-shadow: 0 4px 12px rgba(0, 0, 0, .08); */
    font-size: 12px;
    color: #8a4af3;
    font-weight: 700;}
      .tt-scale-loader .spinner{width: 20px;
    height: 20px;
    border: 4px solid #e0e0e0;
    border-top-color: #8a4af3;
    border-radius: 50%;
    animation: ttspin .9s linear infinite;}
      @keyframes ttspin{to{transform:rotate(360deg)}}
      .scale-bar-track{position:relative}
    `;
    document.head.appendChild(s);
  }
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


/* === Elevation provider failover + per-route cache (Open‑Meteo -> OpenTopoData -> Open‑Elevation) === */
// 2) Sağlayıcı failover: Open‑Meteo’yu geçici olarak devre dışı bırak (429 görmeyelim)
// ensureElevationMux bloğunda providers dizisini böyle sırala:
(function ensureElevationMux(){
  if (window.__tt_elevMuxReady) return;

  const TTL_MS = 48 * 60 * 60 * 1000;
  const LS_PREFIX = 'tt_elev_cache_v1:';

  // SIRALAMA: Önce OpenTopoData, sonra Open‑Elevation. Open‑Meteo KAPALI.
  const providers = [
    { key: 'openElevation', fn: viaOpenElevation, chunk: 50, minInterval: 2000 },
    { key: 'openTopoData', fn: viaOpenTopoData, chunk: 80, minInterval: 1200 },
    
    // { key: 'openMeteo',    fn: viaOpenMeteo,    chunk: 20, minInterval: 1800 }, // devre dışı
  ];

  const cooldownUntil = { openMeteo: 0, openTopoData: 0, openElevation: 0 };
  const lastTs        = { openMeteo: 0, openTopoData: 0, openElevation: 0 };

  // Open‑Meteo’yu uzun süreli kapat (7 gün)
  cooldownUntil.openMeteo = Date.now() + 7 * 24 * 60 * 60 * 1000;
  // İstersen UI’dan açıp kapatabilmek için:
  window.disableOpenMeteoElevation = function(days = 365) {
    cooldownUntil.openMeteo = Date.now() + days * 24 * 60 * 60 * 1000;
  };
  window.enableOpenMeteoElevation = function() {
    cooldownUntil.openMeteo = 0;
  };
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

  async function throttle(key, minInterval) {
    const now = Date.now();
    const cd = cooldownUntil[key] || 0;
    if (now < cd) await sleep(cd - now);
    const wait = Math.max(0, minInterval - (now - (lastTs[key] || 0)));
    if (wait) await sleep(wait);
    lastTs[key] = Date.now();
  }

  async function viaOpenMeteo(samples) {
    const CHUNK = 100;
    const res = [];
    for (let i=0;i<samples.length;i+=CHUNK){
      const chunk = samples.slice(i,i+CHUNK);
      const lats = chunk.map(p=>p.lat.toFixed(6)).join(',');
      const lons = chunk.map(p=>p.lng.toFixed(6)).join(',');
      const url  = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`;
      await throttle('openMeteo', 1800);
      const resp = await fetch(url);
      if (resp.status === 429) {
        const ra = parseInt(resp.headers.get('retry-after')||'0',10);
        cooldownUntil.openMeteo = Date.now() + (ra>0? ra*1000 : 10*60*1000); // 10 dk
        throw new Error('429');
      }
      if (!resp.ok) throw new Error('HTTP '+resp.status);
      const j = await resp.json();
      if (!j.elevation || j.elevation.length !== chunk.length) throw new Error('bad response');
      res.push(...j.elevation);
      if (samples.length > CHUNK) await sleep(1000);
    }
    return res;
  }

  async function viaOpenTopoData(samples) {
    // Dataset: SRTM 90m — Türkiye’yi kapsar
const DATASET = 'srtm30m';
    const CHUNK = 80; // max 100 önerilir
    const res = [];
    for (let i=0;i<samples.length;i+=CHUNK){
      const chunk = samples.slice(i,i+CHUNK);
      const loc = chunk.map(p=>`${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join('|');
      const url = `https://api.opentopodata.org/v1/${DATASET}?locations=${encodeURIComponent(loc)}&interpolation=bilinear`;
      await throttle('openTopoData', 200);
      const resp = await fetch(url);
      if (resp.status === 429) {
        cooldownUntil.openTopoData = Date.now() + 10*60*1000;
        throw new Error('429');
      }
      if (!resp.ok) throw new Error('HTTP '+resp.status);
      const j = await resp.json();
      if (!j.results || j.results.length !== chunk.length) throw new Error('bad response');
      res.push(...j.results.map(r => r && typeof r.elevation==='number' ? r.elevation : null));
      if (samples.length > CHUNK) await sleep(800);
    }
    // null varsa başarısız say
    if (res.some(v => typeof v !== 'number')) throw new Error('missing values');
    return res;
  }

  async function viaOpenElevation(samples) {
    const CHUNK = 100;
    const res = [];
    for (let i=0;i<samples.length;i+=CHUNK){
      const chunk = samples.slice(i,i+CHUNK);
      const loc = chunk.map(p=>`${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join('|');
      const url = `https://api.open-elevation.com/api/v1/lookup?locations=${encodeURIComponent(loc)}`;
      await throttle('openElevation', 2000);
      const resp = await fetch(url);
      if (resp.status === 429) {
        cooldownUntil.openElevation = Date.now() + 10*60*1000;
        throw new Error('429');
      }
      if (!resp.ok) throw new Error('HTTP '+resp.status);
      const j = await resp.json();
      if (!j.results || j.results.length !== chunk.length) throw new Error('bad response');
      res.push(...j.results.map(r => r && typeof r.elevation==='number' ? r.elevation : null));
      if (samples.length > CHUNK) await sleep(1000);
    }
    if (res.some(v => typeof v !== 'number')) throw new Error('missing values');
    return res;
  }

  // Ana giriş: sırayla dene, başarılı olunca cache’le
  window.getElevationsForRoute = async function(samples, container, routeKey) {
    // 1) Cache
    const cached = loadCache(routeKey, samples.length);
    if (cached && cached.length === samples.length) {
      try { if (typeof hideScaleBarLoading === 'function') hideScaleBarLoading(container); } catch(_){}
      return cached;
    }

    // 2) Sağlayıcıları sırayla dene
    for (const p of providers) {
      try {
        if (Date.now() < cooldownUntil[p.key]) continue; // cooldown’da ise atla
        if (typeof updateScaleBarLoadingText === 'function') {
          updateScaleBarLoadingText(container, `Loading elevation… (${p.key})`);
        }
        const elev = await p.fn(samples);
        if (Array.isArray(elev) && elev.length === samples.length) {
          saveCache(routeKey, samples.length, elev);
          try { if (typeof hideScaleBarLoading === 'function') hideScaleBarLoading(container); } catch(_){}
          return elev;
        }
      } catch (e) {
        // sıradakine geç
        continue;
      }
    }
    // 3) Başaramadı
    return null;
  };

  window.__tt_elevMuxReady = true;
})();
// Fixed band davranışı devre dışı
function adjustScaleBarPosition() { /* disabled */ }


// === Feedback Form ===
(function initFeedbackSidebar(){
  const sidebar = document.getElementById('sidebar-feedback');
  if (!sidebar) return;

  const form = sidebar.querySelector('#feedback-form');
  const statusEl = sidebar.querySelector('#feedback-status');
  const btnCancel = sidebar.querySelector('#feedback-cancel');
  const btnClose = sidebar.querySelector('.close-feedback');

  function showStatus(msg, cls) {
    statusEl.textContent = msg;
    statusEl.className = 'feedback-status ' + (cls || '');
  }

  // Basit aç/kapat tetikleyici (kendi butonun varsa oradan çağır)
  window.openFeedback = function() {
    sidebar.style.display = 'block';
  };
  window.closeFeedback = function() {
    sidebar.style.display = 'none';
    form.reset();
    showStatus('');
  };

  btnCancel?.addEventListener('click', () => closeFeedback());
  btnClose?.addEventListener('click', () => closeFeedback());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showStatus('Gönderiliyor...', '');
    const fd = new FormData(form);
    const type = fd.get('type');
    const message = (fd.get('message') || '').toString().trim();
    const userEmail = (fd.get('userEmail') || '').toString().trim();
    const file = fd.get('screenshot');

    if (!message) {
      showStatus('Mesaj boş olamaz.', 'error');
      return;
    }

    // 1) Eğer backend hazır DEĞİLSE: mailto fallback
    // (Çok uzun mesaj + ekran görüntüsü yoksa)
    if (!window.FEEDBACK_API_ENABLED) {
      const body = encodeURIComponent(
        `Tür: ${type}\nEmail: ${userEmail || '-'}\n\nMesaj:\n${message}`
      );
      // Kullanıcıyı mail client'a yönlendir
      window.location.href = `mailto:altandemircan@gmail.com?subject=${encodeURIComponent('Yeni Feedback')}&&body=${body}`;
      showStatus('Mail istemcisi açılıyor (dosya ekleri desteklenmez).', 'success');
      form.reset();
      return;
    }

    // 2) Backend varsa (örnek API POST)
    try {
      let base64Image = null;
      if (file instanceof File && file.size > 0) {
        base64Image = await new Promise(res => {
          const r = new FileReader();
            r.onload = () => res(r.result);
            r.readAsDataURL(file);
        });
      }

      const payload = {
        type,
        message,
        userEmail: userEmail || null,
        screenshot: base64Image
      };

      const resp = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) throw new Error('Sunucu hatası');
      showStatus('Teşekkürler! Feedback alındı.', 'success');
      form.reset();
    } catch(err) {
      console.error(err);
      showStatus('Gönderilemedi. Daha sonra tekrar dene.', 'error');
    }
  });
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
  const cid = `route-map-day${day}`;
  const gj = window.lastRouteGeojsons?.[cid];
  if (!gj || !gj.features || !gj.features[0]?.geometry?.coordinates) return;

  window._segmentHighlight = window._segmentHighlight || {};
  const maps = [];
  const small = window.leafletMaps?.[cid];
  if (small) maps.push(small);
  const exp = window.expandedMaps?.[cid]?.expandedMap;
  if (exp) maps.push(exp);

  maps.forEach(m => {
    if (window._segmentHighlight[day]?.[m._leaflet_id]) {
      try { m.removeLayer(window._segmentHighlight[day][m._leaflet_id]); } catch(_){}
    }
  });

  if (typeof startKm !== 'number' || typeof endKm !== 'number') return;

  const coords = gj.features[0].geometry.coordinates; // [lng,lat]

  function hv(lat1, lon1, lat2, lon2) {
    const R=6371000, toRad=x=>x*Math.PI/180;
    const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
    const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(a));
  }
  const cum=[0];
  for (let i=1;i<coords.length;i++){
    const [lon1,lat1]=coords[i-1], [lon2,lat2]=coords[i];
    cum[i]=cum[i-1]+hv(lat1,lon1,lat2,lon2);
  }
  const segStartM = startKm*1000, segEndM=endKm*1000;

  let iStart = 0, iEnd = coords.length - 1;
  for (let i=1;i<cum.length;i++){ if (cum[i] >= segStartM){ iStart = i; break; } }
  for (let i=cum.length-2;i>=0;i--){ if (cum[i] <= segEndM){ iEnd = i+1; break; } }
  iStart = Math.max(0, Math.min(iStart, coords.length-2));
  iEnd = Math.max(iStart+1, Math.min(iEnd, coords.length-1));

  const sub = coords.slice(iStart, iEnd+1).map(c => [c[1], c[0]]);
  if (sub.length < 2) return;

  window._segmentHighlight[day] = window._segmentHighlight[day] || {};
  maps.forEach(m => {
    const poly = L.polyline(sub, { color:'#8a4af3', weight:6, opacity:0.95, dashArray:'', renderer: ensureCanvasRenderer(m) }).addTo(m);
    window._segmentHighlight[day][m._leaflet_id] = poly;
    try { m.fitBounds(poly.getBounds(), { padding: [16,16] }); } catch(_){}
  });
}

function drawSegmentProfile(container, day, startKm, endKm, samples, elevSmooth) {
  const track = container.querySelector('.scale-bar-track'); 
  if (!track) return;

  // SADECE segment overlay’leri temizle (base SVG durur)
  track.querySelectorAll('svg[data-role="elev-segment"]').forEach(el => el.remove());
  track.querySelectorAll('.elev-segment-toolbar').forEach(el => el.remove());

  // Segment overlay SVG
  const svgNS = 'http://www.w3.org/2000/svg';
  const widthNow = Math.max(200, Math.round(track.getBoundingClientRect().width)) || 400;
  const heightNow = 220;

  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'tt-elev-svg');
  svg.setAttribute('data-role', 'elev-segment'); // ÖNEMLİ
  svg.setAttribute('viewBox', `0 0 ${widthNow} ${heightNow}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', String(heightNow));
  // Base’in ÜSTÜNDE
  
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

  // Görsel aralık
  const min = Math.min(...elevSmooth);
  const max = Math.max(...elevSmooth, min + 1);
  const span = max - min;
  const vizMin = min - span * 0.5;
  const vizMax = max + span * 1.0;

  const segKm = Math.max(0.001, endKm - startKm);
  const X = (km) => (km / segKm) * widthNow;
  const Y = (e) => (isNaN(e) || vizMax === vizMin) ? (heightNow/2) : ((heightNow - 1) - ((e - vizMin) / (vizMax - vizMin)) * (heightNow - 2));

  // Grid (4 çizgi)
  for (let i = 0; i <= 4; i++) {
    const ev = vizMin + (i / 4) * (vizMax - vizMin);
    const y = Y(ev);
    const ln = document.createElementNS(svgNS, 'line');
    ln.setAttribute('x1', '0'); ln.setAttribute('x2', String(widthNow));
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
  for (let i = 0; i < elevSmooth.length; i++) {
    const kmRel = (samples[i].distM / 1000) - startKm;
    const x = Math.max(0, Math.min(widthNow, X(kmRel)));
    const y = Y(elevSmooth[i]);
    topD += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
  }
  if (topD) {
    const areaD = `${topD} L ${widthNow} ${heightNow} L 0 ${heightNow} Z`;
    areaPath.setAttribute('d', areaD);
    areaPath.setAttribute('fill', '#263445');
  }

  // Eğim renkli segmentler
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

  // Toolbar
  // Değerler
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
        bottom: 20px;
    z-index: 1005;
    display: inline-flex;
    gap: 10px;
    align-items: center;
    border-radius: 10px;
    padding: 6px 6px;
    font-size: 12px;
    color: rgb(0 0 0);
    right: 6px;
    position: absolute;   
    background: #8a4af317;  
  `;
  tb.innerHTML = `
    <span class="pill" style="border:1px solid #e0e0e0;border-radius:8px;padding:2px 6px;font-weight:600;">${startKm.toFixed(1)}–${endKm.toFixed(1)} km</span>
    <span class="pill" style="border:1px solid #e0e0e0;border-radius:8px;padding:2px 6px;font-weight:600;">↑ ${Math.round(up)} m</span>
    <span class="pill" style="border:1px solid #e0e0e0;border-radius:8px;padding:2px 6px;font-weight:600;">↓ ${Math.round(down)} m</span>
    <span class="pill" style="border:1px solid #e0e0e0;border-radius:8px;padding:2px 6px;font-weight:600;">Avg %${avgGrade.toFixed(1)}</span>
    <button type="button" class="elev-segment-reset" style="appearance:none;border:1px solid #d0d7de;background:#fff;color:#333;border-radius:8px;padding:4px 8px;cursor:pointer;font-weight:600;">Reset</button>
  `;
  track.appendChild(tb);

  // Reset → base’e dön
  tb.querySelector('.elev-segment-reset')?.addEventListener('click', () => {
    // Sadece segment overlay’leri ve toolbar’ı temizle
    track.querySelectorAll('svg[data-role="elev-segment"]').forEach(el => el.remove());
    track.querySelectorAll('.elev-segment-toolbar').forEach(el => el.remove());

    // Harita highlight’ını temizle
    if (typeof highlightSegmentOnMap === 'function') {
      highlightSegmentOnMap(day);
    }

    // Seçim overlay’i gizle
    const selection = container.querySelector('.scale-bar-selection');
    if (selection) selection.style.display = 'none';

    // Tam profile dön (base SVG ÜZERİNDE)
    const totalKm = Number(container.dataset.totalKm) || 0;
    container._elevStartKm = 0;
    container._elevKmSpan  = totalKm;

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
      // Fallback: baştan kur
      const markers = (typeof getRouteMarkerPositionsOrdered === 'function') ? getRouteMarkerPositionsOrdered(day) : [];
      if (totalKm > 0 && typeof renderRouteScaleBar === 'function') {
        renderRouteScaleBar(container, totalKm, markers);
      }
    }
  });
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

    // Expanded container + scale bar (o güne ait)
    document.getElementById(`expanded-map-${d}`)?.remove();
    document.getElementById(`expanded-route-scale-bar-day${d}`)?.remove();

    // Olası yetim kopyalar (aynı id’li wrapper/scale-bar tekrar eklenmişse)
    document.querySelectorAll(`.expanded-map-container[id="expanded-map-${d}"]`).forEach(el => el.remove());
    document.querySelectorAll(`#expanded-route-scale-bar-day${d}`).forEach(el => el.remove());

    // Expanded wrapper içindeki overlay parçaları (segment toolbar, seçim, svg)
    const expWrap = document.getElementById(`expanded-map-${d}`);
    if (expWrap) {
      expWrap.querySelectorAll('svg.tt-elev-svg, .scale-bar-selection, .scale-bar-vertical-line, .elev-segment-toolbar').forEach(el => el.remove());
    } else {
      // Wrapper bulunamazsa globalden sadece bu güne ait bar içinde kalanları temizle
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

  // 3) Ölçek çubukları / irtifa UI temizlik (satır içi)
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
}

