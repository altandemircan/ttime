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
  if (slope < 2) return "#72c100";      // 0-2% yeşil (düz)
  if (slope < 5) return "#ffd700";      // 2-5% sarı (hafif)
  if (slope < 8) return "#ff8c00";      // 5-8% turuncu (orta)
  if (slope < 12) return "#d32f2f";     // 8-12% kırmızı (dik)
  return "#8e24aa";                     // 12%+ mor (çok dik)
}

const MAPBOX_TOKEN = "pk.eyJ1IjoiYWx0YW5kZW1pcmNhbiIsImEiOiJjbWRpaHFkZGIwZXd3Mm1yYjE2bWh3eHp5In0.hB1IaB766Iug4J26lt5itw";
window.MAPBOX_TOKEN = MAPBOX_TOKEN;
const GEOAPIFY_API_KEY = "d9a0dce87b1b4ef6b49054ce24aeb462";
window.GEOAPIFY_API_KEY = GEOAPIFY_API_KEY;

let selectedCity = "";

function showCitySuggestions(country, days) {
    const suggestionsContainer = document.getElementById("chat-location-suggestions");
    const cities = countryPopularCities[country];
    suggestionsContainer.innerHTML = "";
    if (!cities) return;
    cities.forEach(city => {
        const div = document.createElement("div");
        div.className = "category-area-option";
        div.innerText = city;
        div.onclick = () => {
            handleAnswer(`${city} ${days} days`);
        };
        suggestionsContainer.appendChild(div);
    });
    suggestionsContainer.style.display = "block";
}


document.addEventListener('click', function(e) {
    if (e.target.classList.contains('city-option-btn')) {
        const city = e.target.getAttribute('data-city');
        const days = parseInt(e.target.getAttribute('data-days'), 10) || 2;
        handleAnswer(`${city} ${days} days`);
    }
});

// Update your existing event listener to this:
document.addEventListener('click', function(event) {
  // Check if clicked element is the arrow image or its parent
  const arrowElement = event.target.closest('.arrow');
  
  if (arrowElement) {
    const cartItem = arrowElement.closest('.cart-item');
    if (cartItem) {
      const content = cartItem.querySelector('.content');
      if (content) {
        content.classList.toggle('active');
        
        // Rotate the arrow icon
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

    // BURAYA EKLE!
    let selectedOption = null;

function showSuggestions() {
    if (!suggestionsDiv) return;
    suggestionsDiv.innerHTML = "";

    const options = [
        "Plan a 2-day tour for Romex",
        "Do a 3-day city tour in Helsinki",
        "Do a 1-day city tour in Osaka"
    ];

    if (selectedOption) {
        // Sadece seçili öneriyi göster ve X ekle
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
        // Tüm önerileri göster
        options.forEach(option => {
            const suggestion = document.createElement("div");
            suggestion.className = "category-area-option";
            suggestion.innerText = option;
            suggestion.onclick = () => {
                selectedOption = option;
                chatInput.value = ""; // inputu temizle
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
        // İlk harfi büyük olan kelime(leri) alır, yoksa ilk kelimeyi alır
        const match = input.match(/([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)?)/);
        if (match) return match[1];
        return input.split(" ")[0];
    }

// 1. renderSuggestions artık sadece #suggestions alanına öneri yazar
function renderSuggestions(results) {
    const suggestionsDiv = document.getElementById("suggestions");
    suggestionsDiv.innerHTML = "";
   
    results.forEach((result) => {
        const props = result.properties;
        const displayText = [props.city || props.name, props.country]
            .filter(Boolean).join(', ')
            + (props.country_code ? " " + countryFlag(props.country_code) : "");
        const div = document.createElement("div");
        div.className = "category-area-option";
        div.textContent = displayText;
        if (window.selectedSuggestion && window.selectedSuggestion.displayText === displayText) {
            div.classList.add("selected-suggestion");
            const close = document.createElement("span");
            close.className = "close-suggestion";
            close.innerHTML = "✖";
            close.onclick = function (e) {
                e.stopPropagation();
                window.selectedSuggestion = null;
                chatInput.value = "";
                renderSuggestions(results);
            };
            div.appendChild(close);
        } else {
            div.onclick = () => {
            const locationText = displayText; // "Antalya, Turkey 🇹🇷"
            let userInput = chatInput.value.trim();

            // Eski inputtan şehir adını bul ve yerine öneriyi koy
            // 1. Kullanıcı ne yazdıysa (örn: Ant), onu bul
            const match = userInput.match(/([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)?)/);
            const oldCity = match ? match[1] : null;

            let newInput;
            if (oldCity) {
                // Sadece ilk geçen şehir adını öneriyle değiştir
                newInput = userInput.replace(oldCity, locationText);
            } else {
                // Eğer şehir bulunamazsa başa ekle
                newInput = locationText + (userInput ? " " + userInput : "");
            }

            chatInput.value = newInput.trim();

            window.selectedSuggestion = {
                displayText,
                props
            };
            window.selectedLocation = {
                name: props.name,
                city: props.city,
                country: props.country,
                lat: props.lat,
                lon: props.lon,
                country_code: props.country_code
            };
            renderSuggestions(results);
        };
        }
        suggestionsDiv.appendChild(div);
    });
}

// 2. Input event'i: autocomplete çıktığında chat-location-suggestions'ı gizle, sadece #suggestions'ı göster
chatInput.addEventListener("input", debounce(async function () {
    const queryText = this.value.trim();
    if (queryText.length < 2) {
        document.getElementById("chat-location-suggestions").style.display = "none";
        document.getElementById("suggestions").style.display = "none";
        return;
    }
    const locationQuery = extractLocationQuery(queryText);
    // Eğer ülke şehirleri varsa (Türkiye vb.) farklı davranabilirsin, örnek aşağıda
    if (countryPopularCities[locationQuery]) {
        document.getElementById("chat-location-suggestions").style.display = "none";
        const suggestionsDiv = document.getElementById("suggestions");
        suggestionsDiv.innerHTML = "";
        countryPopularCities[locationQuery].forEach(city => {
            const div = document.createElement("div");
            div.className = "category-area-option";
            div.textContent = city;
            div.onclick = () => {
                chatInput.value = city + " " + queryText.replace(locationQuery, "").trim();
                suggestionsDiv.style.display = "none";
                chatInput.focus();
            };
            suggestionsDiv.appendChild(div);
        });
        suggestionsDiv.style.display = "block";
        return;
    }
    // Normal autocomplete devamı:
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

    // <---- BURAYA EKLE ---->
    if (countryPopularCities[locationQuery]) {
        chatSuggestions.innerHTML = "";
        countryPopularCities[locationQuery].forEach(city => {
            const div = document.createElement("div");
            div.className = "category-area-option";
            div.textContent = city;
            div.onclick = () => {
                chatInput.value = city + " " + queryText.replace(locationQuery, "").trim();
                chatSuggestions.style.display = "none";
                chatInput.focus();
            };
            chatSuggestions.appendChild(div);
        });
        chatSuggestions.style.display = "block";
        return;
    }
    // <---- BURAYA EKLE ---->

    // Normal autocomplete devamı:
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

    // Plan başlatırken sadece seçilmiş konumdan bilgi al!
    window.buildPlanFromSelection = function (days) {
                if (!window.selectedLocation) {
            alert("Please select a city!");
            return;
        }
        const loc = window.selectedLocation;
        // Kendi plan fonksiyonunu burada çağırabilirsin, örnek:
        // callPlanAPI(loc.city || loc.name, days, loc.lat, loc.lon, loc.country);
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
    const suggestionsContainer = document.getElementById("suggestions");

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
    if (event.key === "Enter") {
        sendMessage();
        event.preventDefault();
    }
}
async function handleAnswer(answer) {
    document.getElementById("user-input").value = "";
    addMessage(answer, "user-message");
    showTypingIndicator();
    window.lastUserQuery = answer; // <--- Bunu ekle!
    try {
        const { location, days } = parsePlanRequest(answer);
        window.selectedCity = location;
        if (countryPopularCities[location]) {
            askCityForCountry(location, days);
            hideTypingIndicator();
            return;
        }
        latestTripPlan = await buildPlan(location, days);
        latestTripPlan = await enrichPlanWithWiki(latestTripPlan);
        if (latestTripPlan && latestTripPlan.length > 0) {
            window.latestTripPlan = JSON.parse(JSON.stringify(latestTripPlan));
            window.cart = JSON.parse(JSON.stringify(latestTripPlan));
            saveCurrentTripToStorage();

            showResults();
            updateTripTitle();
            const inputWrapper = document.querySelector('.input-wrapper');
            if (inputWrapper) {
                inputWrapper.style.display = 'none';
            }
            isFirstQuery = false;
            
            // ------ TRIP SIDEBAR OTOMATİK AÇILSIN ------
            if (typeof openTripSidebar === "function") {
                openTripSidebar();
            }
            // -------------------------------------------
        } else {
addMessage("Could not create a plan for the specified location.", "bot-message");
        }
    } catch (error) {
console.error("Plan creation error:", error);
addMessage("Please specify a valid city and number of days (e.g., 'Rome 2 days' or 'Paris 3 days')", "bot-message");
    } finally {
        hideTypingIndicator();
        isProcessing = false;
    }
}

 function sendMessage() {
          const input = document.getElementById("user-input");
          const val = input.value.trim();
          if (val) {
              handleAnswer(val);
              input.value = "";
          }
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
        textElement.textContent = text;
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
        typingIndicator.style.display = "none";
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



userInput.addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        const val = userInput.value.trim();
        if (val) handleAnswer(val);
        event.preventDefault();
    }
});

document.getElementById("send-button").addEventListener("click", function() {
    const val = userInput.value.trim();
    if (val) handleAnswer(val);
});



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
if (window.latestTripPlan && Array.isArray(window.latestTripPlan) && window.latestTripPlan.length > 0) {
        // Otomatik olarak window.cart'ı güncelle!
        window.cart = window.latestTripPlan.map(item => {
            // location garantisi!
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
        
        // Önce o günün step'lerini topla
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
        
        // Harita kontrolleri: sadece 2 veya daha fazla item varsa ekle
        let mapControlsHtml = '';
        if (daySteps.length >= 2) {
            mapControlsHtml = `
                <div id="route-map-day${day}" class="route-map">
                    <div id="map-bottom-controls-wrapper-day${day}">
                        <div id="map-bottom-controls-day${day}" class="map-bottom-controls">
                            <select id="map-style-select-day${day}">
                                <option value="streets-v12">Streets modes</option>
                                <option value="dark-v11">Navigation</option>
                                <option value="satellite-streets-v12">Satellite</option>
                            </select>
                            <button class="expand-map-btn" onclick="expandMap('route-map-day${day}', ${day})"><img src="img/see_route.gif"></button>

                            <span class="route-summary-control"></span>
                        </div>
                    </div>
                </div>`;
        } else if (daySteps.length === 1) {
            // 1 item varsa uyarı ekle
            stepsHtml += `<p class="one-item-message">Add one more item to see the route!</p>`;
        }

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
                            ${mapControlsHtml}
                        </div>
                    </div>
                </div>
            </li>`;
    }

    html += `</ul></div></div>`;
    chatBox.innerHTML += html;
    chatBox.scrollTop = chatBox.scrollHeight;
    setTimeout(fillAIDescriptionsSeq, 300);
    setTimeout(fillAIDescriptionsAutomatically, 300);

    setTimeout(() => {
        if (typeof addChatResultsToCart === "function" && !hasAutoAddedToCart) {
            addChatResultsToCart();
            hasAutoAddedToCart = true;
        }
        if (typeof makeChatStepsDraggable === "function") makeChatStepsDraggable();
    }, 200);
    setTimeout(() => {
        renderRouteForDay(1);
    }, 500);
        updateCart();


    // --- Thumbnail için gecikmeli kaydet ---
    saveCurrentTripToStorageWithThumbnailDelay();
setTimeout(() => {
    saveCurrentTripToStorageWithThumbnail().then(renderMyTripsPanel);
}, 1200); // harita DOM'da kesin oluşsun diye
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



function askCityForCountry(country, days) {
    const options = countryPopularCities[country] || [];
    if (options.length === 0) {
addMessage("Please specify the city you want to visit.", "bot-message");
        return;
    }
let message = `Which city do you want to visit?`;
    message += '<br><div class="city-options">';
    options.forEach(city => {
        // Burada!
        message += `<button class="city-option-btn" data-city="${city}" data-days="${days}">${city}</button>`;
    });
    message += '</div>';
    addMessage(message, "bot-message");
}

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

async function getLatLngFromAddressGeoapify(address) {
    const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(address)}&apiKey=${GEOAPIFY_KEY}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.features && data.features.length > 0) {
        return {
            lat: data.features[0].geometry.coordinates[1],
            lng: data.features[0].geometry.coordinates[0]
        };
    } else {
        return null;
    }
}


/*
let currentSlides = {
    1: 0,
    2: 0,
    3: 0
};
*/
// Global


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


// --- PATCH: addToCart başına ekle (EN BAŞA, day atamasından hemen sonra) ---
function addToCart(
    name, image, day, category, address = null, rating = null, user_ratings_total = null,
    opening_hours = null, place_id = null, location = null, website = null
) {
    // START: placeholder temizliği (ilk gerçek ekleme)
    if (window._removeMapPlaceholderOnce) {
        window.cart = (window.cart || []).filter(it => !it._placeholder);
        window._removeMapPlaceholderOnce = false;
    }
    // (Devamı mevcut kod...)
    day = day || window.currentDay || 1;
    let loc = null;
    if (location && typeof location.lat !== "undefined" && typeof location.lng !== "undefined") {
        loc = { lat: Number(location.lat), lng: Number(location.lng) };
    }
    const isDuplicate = window.cart.some(item =>
        item.day == day &&
        item.category === category &&
        item.name && name && item.name.trim() === name.trim() &&
        ((loc && item.location && item.location.lat === loc.lat && item.location.lng === loc.lng) ||
         (!loc && !item.location))
    );
    if (isDuplicate) return false;

    const newItem = {
        name: name ? name.trim() : "",
        image,
        day: Number(day),
        category,
        address: address?.trim(),
        rating,
        user_ratings_total,
        opening_hours,
        place_id,
        location: loc,
        website,
        addedAt: new Date().toISOString()
    };

    window.cart.push(newItem);
    if (typeof updateCart === "function") updateCart();
    if (typeof attachChatDropListeners === 'function') attachChatDropListeners();
    if (typeof openSidebar === 'function') openSidebar();

    if (window.innerWidth <= 768) {
        var sidebar = document.querySelector('.sidebar-overlay.sidebar-trip');
        if (sidebar) sidebar.classList.add('open');
    }
    return true;
}

// 9. removeFromCart fonksiyonu
function removeFromCart(index) {
    if (index >= 0 && index < window.cart.length) {
        window.cart.splice(index, 1);
        updateCart();
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
    document.getElementById("customNoteContainer").style.display = "none";
    document.querySelector(".add-custom-note-btn").style.display = "block";
}

function saveCustomNote(day) {
    const title = document.getElementById("noteTitle").value;
    const details = document.getElementById("noteDetails").value;

    if (title && details) {
        const newItem = {
            name: title,
            details: details,
            day: parseInt(day),
            category: "Note",
            image: "img/added-note.png"
        };

        window.cart.push(newItem);
        updateCart();
        closeCustomNoteInput();
    } else {
        alert("Please enter both title and details.");
    }
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
const INITIAL_EMPTY_MAP_ZOOM   = 7;             // Önceki 4'ten 2 kademe yakın

function initEmptyDayMap(day) {
    const containerId = `route-map-day${day}`;
    const el = document.getElementById(containerId);
    if (!el) return;

    // Harita zaten varsa (rota yokken base tile kalmış olabilir) sadece view güncelle
    if (window.leafletMaps && window.leafletMaps[containerId]) {
        try {
            window.leafletMaps[containerId].setView(INITIAL_EMPTY_MAP_CENTER, INITIAL_EMPTY_MAP_ZOOM);
        } catch(_) {}
        // İpucu yoksa ekle (eski rota katmanları silinmiş olabilir)
        if (!el.querySelector('.empty-map-hint')) {
            const hint = document.createElement('div');
            hint.className = 'empty-map-hint';
            hint.style.cssText = `
              position:absolute;
              top:10px;
              left:10px;
              background:rgba(255,255,255,.9);
              padding:6px 10px;
              font-size:12px;
              border-radius:6px;
              border:1px solid #e0e0e0;
              z-index:500;
              font-weight:500;
              color:#333;
              max-width:180px;
              line-height:1.3;
            `;
            hint.innerHTML = 'Click / long‑press the map to add points.<br>Add 2 points to see the route.';
            el.style.position = 'relative';
            el.appendChild(hint);
        }
        return;
    }

    // Yeni (ilk) boş harita oluştur
    el.style.height = '285px';
    el.classList.add('empty-route-map');

    const map = L.map(containerId, {
        scrollWheelZoom: true,
        fadeAnimation: false,
        zoomAnimation: false,
        preferCanvas: true
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

    // İpucu
    const hint = document.createElement('div');
    hint.className = 'empty-map-hint';
    hint.style.cssText = `
      position:absolute;
      top:10px;
      left:10px;
      background:rgba(255,255,255,.9);
      padding:6px 10px;
      font-size:12px;
      border-radius:6px;
      border:1px solid #e0e0e0;
      z-index:500;
      font-weight:500;
      color:#333;
      max-width:180px;
      line-height:1.3;
    `;
    hint.innerHTML = 'Click / long‑press the map to add points.<br>Add 2 points to see the route.';
    el.style.position = 'relative';
    el.appendChild(hint);
}

// --- PATCH: startMapPlanning (haritayı hemen aç + expand isteğe bağlı) ---
function startMapPlanning() {
    if (!window.cart || window.cart.length === 0) {
        window.cart = [{ day: 1, _placeholder: true }];
    }
    updateCart();              // Day 1 + boş harita gelir
    initEmptyDayMap(1);        // Garanti et (çok hızlı yeniden çizim durumlarında)
    window._removeMapPlaceholderOnce = true;

    // İstersen doğrudan büyük haritayı aç:
    if (typeof expandMap === 'function') {
        // Küçük harita hazırlanmış olmalı
        setTimeout(() => expandMap('route-map-day1', 1), 50);
    } else if (typeof openExpandedMapForDay === 'function') {
        openExpandedMapForDay(1);
    }
}
// updateCart içinde ilgili yerlere eklemeler yapıldı
function updateCart() {
    console.table(window.cart);
    let cartDiv = document.getElementById("cart-items");
    let menuCount = document.getElementById("menu-count");
    cartDiv.innerHTML = "";
    if (typeof window.customDayNames === 'undefined') {
        window.customDayNames = {};
    }
    // --- PATCH: updateCart içindeki boş state buton click bloğunu sadeleştir ---
if (!window.cart || window.cart.length === 0) {
    cartDiv.innerHTML = `
      <div id="empty-content">
        <p>Create your trip using the chat screen.</p>
        <button id="start-map-btn" type="button" style="
          cursor:pointer;
          margin:10px 0 6px;
          background:#1d72ff;
          color:#fff;
          border:none;
          padding:8px 14px;
          border-radius:6px;
          font-size:14px;
          font-weight:500;
        ">Start with map</button>
        <p class="empty-text" style="display:flex;gap:6px;align-items:center;justify-content:center;margin:8px 0 0;">
          <img src="https://cdn-icons-gif.flaticon.com/16780/16780154.gif" style="width:40px;height:40px;">
          <span class="enjoy">Enjoy!</span>
        </p>
      </div>
    `;
    menuCount.textContent = 0;
    menuCount.style.display = "none";
    const newChatBtn = document.getElementById("newchat");
    if (newChatBtn) newChatBtn.style.display = "none";

    const btn = document.getElementById('start-map-btn');
    if (btn) {
        btn.addEventListener('click', startMapPlanning); // <--- SADELEŞTİRİLDİ
    }
    return;
}
    let maxDay = 0;
    window.cart.forEach(item => { if (item.day > maxDay) maxDay = item.day; });

    for (let day = 1; day <= maxDay; day++) {
        const dayItems = window.cart.filter(item => item.day == day && item.name !== undefined);
        const dayContainer = document.createElement("div");
        dayContainer.classList.add("day-container");
        dayContainer.id = `day-container-${day}`;
        dayContainer.dataset.day = day;

        // Header
        const dayHeader = document.createElement("h4");
        dayHeader.classList.add("day-header");

        const titleContainer = document.createElement("div");
        titleContainer.className = "title-container";

        const titleSpan = document.createElement("span");
        titleSpan.classList.add("day-title");
        titleSpan.textContent = window.customDayNames[day] || `Day ${day}`;

        // Kalem butonu YOK (Rename sadece ⋯ menüde)
        titleContainer.appendChild(titleSpan);
        dayHeader.appendChild(titleContainer);

        // Header önce eklenir
        dayContainer.appendChild(dayHeader);

        // Onay alanı
        const confirmationContainer = document.createElement("div");
        confirmationContainer.classList.add("confirmation-container");
        confirmationContainer.style.display = "none";
        confirmationContainer.id = `confirmation-container-${day}`;
        dayContainer.appendChild(confirmationContainer);

        // ⋯ menü (Rename / No Plan / Remove)
        const actionMenu = createDayActionMenu(day);
        dayHeader.appendChild(actionMenu);

        // Day list
        const dayList = document.createElement("ul");
        dayList.classList.add("day-list");
        dayList.setAttribute("data-day", day);

        const dayItemsArr = dayItems;
        if (dayItemsArr.length === 0) {
            const emptyDayMessage = document.createElement("p");
            emptyDayMessage.classList.add("empty-day-message");
            emptyDayMessage.textContent = "No item has been added for this day yet.";
            dayList.appendChild(emptyDayMessage);
        } else {
            dayItemsArr.forEach((item, index) => {
                const li = document.createElement("li");
                li.classList.add("travel-item");
                li.setAttribute("draggable", true);
                li.setAttribute("data-index", window.cart.indexOf(item));
                li.addEventListener("dragstart", dragStart);

                let openingHoursDisplay = "No working hours info";
                if (item.opening_hours) {
                    if (Array.isArray(item.opening_hours)) {
                        // Boş elemanları temizle
                        const cleaned = item.opening_hours
                          .map(h => (h || '').trim())
                          .filter(h => h.length > 0);
                        if (cleaned.length) {
                            openingHoursDisplay = cleaned.join(" | ");
                        }
                    } else if (typeof item.opening_hours === "string" && item.opening_hours.trim().length > 0) {
                        openingHoursDisplay = item.opening_hours.trim();
                    }
                }

                let mapHtml = '';
                if (item.location && typeof item.location.lat === "number" && typeof item.location.lng === "number") {
                    mapHtml = createMapIframe(item.location.lat, item.location.lng, 16);
                } else {
                    mapHtml = '<div class="map-error">Location not available</div>';
                }

                li.innerHTML = `
        <div class="cart-item">
          <img src="https://www.svgrepo.com/show/458813/move-1.svg" alt="Drag" class="drag-icon">
          <img src="${item.image}" alt="${item.name}" class="cart-image">
          <img src="${categoryIcons[item.category] || 'https://www.svgrepo.com/show/522166/location.svg'}" alt="${item.category}" class="category-icon">
          <div class="item-info">
            <p class="toggle-title">${item.name}</p>
          </div>
          <button class="remove-btn" onclick="removeFromCart(${window.cart.indexOf(item)})">
            <img src="img/remove-icon.svg" alt="Close">
          </button>
          <span class="arrow">
            <img src="https://www.svgrepo.com/show/520912/right-arrow.svg" class="arrow-icon" onclick="toggleContent(this)">
          </span>
          <div class="content">
            <div class="info-section">
              <div class="place-rating">
                ${mapHtml}
              </div>
              <div class="contact">
                <p>📌 Address: ${item.address || 'Address not available'}</p>
              </div>
              <p class="working-hours-title">
                🕔 Working hours: <span class="working-hours-value">${openingHoursDisplay}</span>
              </p>
              ${item.location ? `
              <div class="coords-info" style="margin-top:8px;">
                📍 Coords: Lat: ${Number(item.location.lat).toFixed(7).replace('.', ',')}, Lng: ${Number(item.location.lng).toFixed(7).replace('.', ',')}
              </div>` : ''}
            </div>
          </div>
        </div>
      `;
                dayList.appendChild(li);

                if (dayItemsArr.length === 1 && index === 0) {
                    const oneItemMessage = document.createElement("p");
                    oneItemMessage.classList.add("one-item-message");
                    oneItemMessage.textContent = "Add one more item to see the route!";
                    dayList.appendChild(oneItemMessage);
                }

                if (dayItemsArr.length >= 2 && index < dayItemsArr.length - 1) {
                    const key = `route-map-day${day}`;
                    const summary = window.pairwiseRouteSummaries?.[key]?.[index];
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
            });
        }

        dayContainer.appendChild(dayList);

       // (ESKİ)
// if (dayItemsArr.length >= 2) {
//     const routeDiv = document.createElement("div");
//     routeDiv.id = `route-map-day${day}`;
//     routeDiv.className = "route-map";
//     dayContainer.appendChild(routeDiv);
//
//     const routeInfoDiv = document.createElement("div");
//     routeInfoDiv.id = `route-info-day${day}`;
//     routeInfoDiv.className = "route-info";
//     dayContainer.appendChild(routeInfoDiv);
// }

// (YENİ - KOŞULSUZ OLUŞTUR + EKSİKSE BOŞ HARİTAYI BAŞLAT)
const routeDiv = document.createElement("div");
routeDiv.id = `route-map-day${day}`;
routeDiv.className = "route-map";
dayContainer.appendChild(routeDiv);

const routeInfoDiv = document.createElement("div");
routeInfoDiv.id = `route-info-day${day}`;
routeInfoDiv.className = "route-info";
dayContainer.appendChild(routeInfoDiv);

// 2’den az gerçek konum varsa boş temel haritayı aç
const realPointCount = dayItemsArr.filter(it => it.name && it.location && typeof it.location.lat === 'number' && typeof it.location.lng === 'number').length;
if (realPointCount < 2) {
    initEmptyDayMap(day);  // Harita yoksa oluşturur, ipucunu gösterir
}

        cartDiv.appendChild(dayContainer);

        const addMoreButton = document.createElement("button");
        addMoreButton.classList.add("add-more-btn");
        addMoreButton.textContent = "+ Add Category";
        addMoreButton.setAttribute('data-day', day);
        addMoreButton.onclick = function() { showCategoryList(this.getAttribute('data-day')); };
        cartDiv.appendChild(addMoreButton);
    }

    const addNewDayButton = document.createElement("button");
    addNewDayButton.classList.add("add-new-day-btn");
    addNewDayButton.id = "add-new-day-button";
    addNewDayButton.textContent = "+ Add New Day";
    addNewDayButton.onclick = function() { addNewDay(this); };
    addNewDayButton.disabled = !(window.cart.length > 0 && window.cart.filter(item => item.day === window.cart[window.cart.length - 1].day).length > 0);
    cartDiv.appendChild(addNewDayButton);
    
    if (window.cart.startDate && window.cart.endDates) {
        const dateRangeDiv = document.createElement("div");
        dateRangeDiv.classList.add("date-range");
        dateRangeDiv.innerHTML = `
            <span class="date-info">📅 Dates: ${window.cart.startDate} - ${window.cart.endDates[window.cart.endDates.length - 1]}</span>
            <button class="see-details-btn" onclick="showTripDetails(window.cart.startDate)">🧐 Trip Details</button>
        `;
        cartDiv.appendChild(dateRangeDiv);
    }

    let addToCalendarButton = document.querySelector(".add-to-calendar-btn");
    if (!addToCalendarButton) {
        addToCalendarButton = document.createElement("button");
        addToCalendarButton.classList.add("add-to-calendar-btn");
        cartDiv.appendChild(addToCalendarButton);
    }
    addToCalendarButton.textContent = window.cart.startDate ? "Change Dates" : "Select Dates";
    addToCalendarButton.onclick = function() {
        openCalendar(maxDay);
    };
    
    const itemCount = window.cart.filter(item => item.name).length;
    menuCount.textContent = itemCount;
    menuCount.style.display = itemCount > 0 ? "inline-block" : "none";

    // NEW: Sepette öğe varsa New Chat görünsün, yoksa gizlensin
    const newChatBtn = document.getElementById("newchat");
    if (newChatBtn) newChatBtn.style.display = itemCount > 0 ? "block" : "none";

    attachDragListeners();
    
    let maxDay2 = 0;
    window.cart.forEach(item => { if (item.day > maxDay2) maxDay2 = item.day; });
    for (let day = 1; day <= maxDay2; day++) {
        initPlaceSearch(day);
    }
    addCoordinatesToContent();
    for (let day = 1; day <= maxDay; day++) {
        renderRouteForDay(day);
    }

    // Controls yerleştirildikten sonra bar halinde grupla
    setTimeout(wrapRouteControlsForAllDays, 0);

    attachChatDropListeners();
    Object.values(window.expandedMaps).forEach(({ expandedMap, day }) => {
        if (expandedMap) {
            updateExpandedMap(expandedMap, day);
        }
    });
    initDragDropSystem();
    if (typeof interact !== 'undefined') {
        setupMobileDragDrop();
    }
    setupSidebarAccordion();
    setupStepsDragHighlight();
    renderTravelModeControlsForAllDays();
}
document.addEventListener('DOMContentLoaded', updateCart);
// (dosyadaki diğer kodlar)
document.addEventListener('DOMContentLoaded', updateCart);
document.querySelectorAll('.accordion-label').forEach(label => {
    label.addEventListener('click', function() {
    });
});


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
        // fallback...
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
      const totalKm = (window.lastRouteSummaries?.[containerId]?.distance || 0) / 1000;
      const markerPositions = getRouteMarkerPositionsOrdered(day);
      if (totalKm > 0 && markerPositions.length > 0) {
        try { delete scaleBarDiv._elevProfile; } catch (_) { scaleBarDiv._elevProfile = null; }
        renderRouteScaleBar(scaleBarDiv, totalKm, markerPositions);
      } else {
        scaleBarDiv.innerHTML = '';
      }
    }
}

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
        <iframe class="gmap-plan"
                src="${baseUrl}?${params.toString()}"
                width="100%"
                height="250"
                frameborder="0"
                style="border:0"
                loading="lazy"
                referrerpolicy="no-referrer-when-downgrade">
        </iframe> 
    </div>`;
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
    // İkonun en yakın .cart-item ata divini bul
    const cartItem = arrowIcon.closest('.cart-item');
    if (!cartItem) return;
    // İçindeki .content divini bul
    const contentDiv = cartItem.querySelector('.content');
    if (!contentDiv) return;
    // Aç/kapa
    contentDiv.classList.toggle('open');
    // Eğer open classı varsa göster, yoksa gizle
    if (contentDiv.classList.contains('open')) {
        contentDiv.style.display = 'block';
    } else {
        contentDiv.style.display = 'none';
    }
}


function showTripDetails(startDate) {
    // Mobilde sadece paylaşım butonlarını göster
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

    // Ensure a screen to render into
    let chatScreen = document.getElementById("chat-screen");
    if (!chatScreen) {
        chatScreen = document.createElement("div");
        chatScreen.id = "chat-screen";
        document.body.appendChild(chatScreen);
    }

    // Root section
    let tripDetailsSection = document.getElementById("tt-trip-details");
    if (!tripDetailsSection) {
        tripDetailsSection = document.createElement("section");
        tripDetailsSection.id = "tt-trip-details";
        chatScreen.appendChild(tripDetailsSection);
    }
    tripDetailsSection.innerHTML = "";

    // No data guard
    if (!Array.isArray(window.cart) || window.cart.length === 0) {
        tripDetailsSection.textContent = "No trip details available.";
        return;
    }

    // Outer structure like normal
    const sect = document.createElement("div");
    sect.className = "sect";

    const ul = document.createElement("ul");
    ul.className = "accordion-list";
    sect.appendChild(ul);

    // Find total days
    let maxDay = 0;
    window.cart.forEach(it => { if (it.day > maxDay) maxDay = it.day; });

    const startDateObj = startDate ? new Date(startDate) : null;
    if (typeof window.customDayNames === "undefined") window.customDayNames = {};

    for (let day = 1; day <= maxDay; day++) {
        const dayItems = window.cart.filter(it => it.day == day && it.name !== undefined);

        // Build friendly day title + date
        let dateStr = "";
        if (startDateObj) {
            const d = new Date(startDateObj);
            d.setDate(startDateObj.getDate() + (day - 1));
            dateStr = d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
        }
        const dayTitle = window.customDayNames[day] || `Day ${day}`;
        const labelText = `${dayTitle}${dateStr ? ` (${dateStr})` : ""}`;

        // Day item li
        const li = document.createElement("li");
        li.className = "day-item";

        const container = document.createElement("div");
        container.className = "accordion-container";

        // Use unique IDs to avoid collisions with chat results
        const inputId = `tt-day-${day}`;

        const input = document.createElement("input");
        input.type = "checkbox";
        input.id = inputId;
        input.className = "accordion-toggle";
        input.checked = true; // default open
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

        // Steps
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

        const routeDiv = document.createElement("div");
        routeDiv.id = `route-map-day${day}`;
        routeDiv.className = "route-map";
        daySteps.appendChild(routeDiv);

        content.appendChild(daySteps);
        container.appendChild(content);
        li.appendChild(container);
        ul.appendChild(li);
    }

    tripDetailsSection.appendChild(sect);

    // --- TRIP INFORMATION bölümü (AI ile) ---
    const tripInfoDiv = document.createElement("div");
    tripInfoDiv.className = "trip-info-section";
    tripInfoDiv.innerHTML = `
        <h3>Trip Information</h3>
        <div class="trip-info-content">
            <span style="color:#888;">AI is analyzing your trip steps...</span>
        </div>
    `;
    tripDetailsSection.appendChild(tripInfoDiv);

    // --- AI Information bölümü (paylaşım üstü) ---
    const aiInfoDiv = document.createElement("div");
    aiInfoDiv.className = "ai-info-section";
    aiInfoDiv.innerHTML = `
        <h3>AI Information</h3>
        <div class="ai-info-content">
            <span style="color:#888;">AI is summarizing your trip...</span>
        </div>
    `;
    tripDetailsSection.appendChild(aiInfoDiv);

    // Share buttons at the end
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

    // --- Typewriter fonksiyonu ---
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

    // --- AI Information (plan-summary) ---
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

    // --- Trip Information (adım-adım AI ile) ---
   (async function(){
  try {
    // örnek fetch kodu, gerçek endpoint ve body ile değiştir
    const resp = await fetch('/llm-proxy/trip-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tripPlan: window.cart || []
      })
    });
    const data = await resp.json();
    console.log("AI Trip Info Response:", data);

    // örnek: summary varsa ekrana bas
    let html = "";
if (data.steps && data.steps.length) {
  data.steps.forEach(s => {
    html += `<div class="trip-step"><b>${s.name}:</b> ${s.ai_comment}</div>`;
  });
}
if (data.route_summary) {
  html += `<div class="trip-route-summary"><b>Route summary:</b> ${data.route_summary}</div>`;
}
if (data.summary) {
  html += `
    <div class="trip-summary">
      <b>AI 2-Day Program:</b><br>
      ${data.summary}
    </div>
  `;
}
if (!html.trim()) html = `<span style="color:#d32f2f">AI trip info could not be generated.</span>`;
typeWriterEffect(tripInfoDiv.querySelector('.trip-info-content'), html, 15);

  } catch (e) {
    document.querySelector('.trip-info-content').innerHTML = `<span style="color:#d32f2f">AI trip info could not be generated.</span>`;
  }
})();

    // Enhance: AI descriptions for visible steps
    setTimeout(() => {
        if (typeof fillAIDescriptionsAutomatically === "function") {
            fillAIDescriptionsAutomatically();
        }
    }, 0);

    setTimeout(() => {
        for (let day = 1; day <= maxDay; day++) {
            if (typeof renderRouteForDay === "function") {
                renderRouteForDay(day);
            }
        }
    }, 100);

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

function resetDayAction(day, confirmationContainerId) {
    const confirmationContainer = document.getElementById(confirmationContainerId);
    window.cart.forEach(item => {
        if (item.day == day) {
            item.name = undefined;
        }
    });

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

function setupMapStyleChangeListeners() {
    document.querySelectorAll('[id^="map-style-select-day"]').forEach(select => {
        select.addEventListener('change', function() {
            const match = this.id.match(/day(\d+)/);
            if (match) {
                const day = parseInt(match[1], 10);
                updateRouteStatsUI(day);
            }
        });
    });
}


function updateRouteStatsUI(day) {
    const key = `route-map-day${day}`;
    const summary = window.lastRouteSummaries?.[key];

    // Ascent/descent verisini oku
    const ascent = window.routeElevStatsByDay?.[day]?.ascent;
    const descent = window.routeElevStatsByDay?.[day]?.descent;

    // Eğer summary yoksa alanları temizle
    if (!summary) {
        // Küçük harita altındaki span (DOĞRU ID!)
        const routeSummarySpan = document.querySelector(`#map-bottom-controls-day${day} .route-summary-control`);
        if (routeSummarySpan) routeSummarySpan.innerHTML = "";
        // Büyük harita altındaki div
        const routeStatsDiv = document.querySelector('.route-stats');
        if (routeStatsDiv) routeStatsDiv.innerHTML = "";
        return;
    }

    // Mapbox summary.distance metre, summary.duration saniye döndürür!
    const distanceKm = (summary.distance / 1000).toFixed(2);
    const durationMin = Math.round(summary.duration / 60);

    // Küçük harita altındaki span (DOĞRU ID!)
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

    // Büyük harita altındaki div
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


function showScaleBarInExpandedMap(day) {
    const scaleBar = document.getElementById(`route-scale-bar-day${day}`);
    const statsDiv = document.querySelector('.route-stats');
    if (scaleBar && statsDiv) {
        scaleBar.style.display = '';
        statsDiv.insertAdjacentElement('afterend', scaleBar);
    }
}


async function expandMap(containerId, day) {
    console.log('expandMap called with:', containerId, day); // DEBUG
    
    // 1. Tüm scale bar'ları temizle
    document.querySelectorAll('.route-scale-bar').forEach(bar => {
        if (bar.parentNode) bar.parentNode.removeChild(bar);
    });

    // 2. Diğer expanded haritaları kapat
    if (window.expandedMaps) {
        Object.keys(window.expandedMaps).forEach(otherId => {
            const expandedData = window.expandedMaps[otherId];
            if (expandedData) restoreMap(otherId, expandedData.day);
        });
    }

    const originalContainer = document.getElementById(containerId);
    const map = window.leafletMaps[containerId];
    const expandButton = document.querySelector(`#tt-travel-mode-set-day${day} .expand-map-btn`); // GÜNCELLEME: expand button artık travel mode set'te
    
    console.log('originalContainer:', originalContainer); // DEBUG
    console.log('map:', map); // DEBUG
    console.log('expandButton:', expandButton); // DEBUG
    
    if (!originalContainer || !map || !expandButton) {
        console.error('Missing elements:', { originalContainer, map, expandButton }); // DEBUG
        return;
    }

    window._lastNearbyDay = day;
    expandButton.style.visibility = 'hidden';

    const expandedMapId = `expanded-map-${day}`;
    const expandedContainer = document.createElement('div');
    expandedContainer.id = expandedMapId;
    expandedContainer.className = 'expanded-map-container';

    // HEADER DIV (select + route-stats + use-my-location)
    const headerDiv = document.createElement('div');
    headerDiv.className = 'expanded-map-header';

    // Map style select
    const mapStyleSelect = document.createElement('select');
    mapStyleSelect.id = `map-style-select-day${day}`;
    [
        {value:"streets-v12",text:"Street modes"},
        {value:"dark-v11",text:"Navigation"},
        {value:"satellite-streets-v12",text:"Satellite"}
    ].forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.text;
        mapStyleSelect.appendChild(option);
    });
    headerDiv.appendChild(mapStyleSelect);

    // Route stats
    const statsDiv = document.createElement('div');
    statsDiv.className = 'route-stats';
    headerDiv.appendChild(statsDiv);

    // USE MY LOCATION BUTTON
    const locBtn = document.createElement('button');
    locBtn.type = 'button';
    locBtn.id = `use-my-location-btn-day${day}`;
    locBtn.innerHTML = '📍 Loc A';
    headerDiv.appendChild(locBtn);

    // --- Toggle mantığı ---
    window.isLocationActiveByDay[day] = false; // İlk başta pasif

    locBtn.addEventListener('click', function() {
        if (!window.isLocationActiveByDay[day]) {
            // Aktif hale getir (marker ekle)
            window.isLocationActiveByDay[day] = true;
            locBtn.innerHTML = '📍 Loc P';
            getMyLocation(day, expandedMap);
        } else {
            // Pasif hale getir (marker sil)
            if (window.userLocationMarkersByDay[day]) {
                window.userLocationMarkersByDay[day].forEach(marker => {
                    if (expandedMap.hasLayer(marker)) expandedMap.removeLayer(marker);
                });
            }
            window.userLocationMarkersByDay[day] = [];
            window.isLocationActiveByDay[day] = false;
            locBtn.innerHTML = '📍 Loc S';
        }
    });

    expandedContainer.appendChild(headerDiv);

    // Close button
    const closeButton = document.createElement('button');
    closeButton.className = 'close-expanded-map';
    closeButton.innerHTML = '✕ Close';
    closeButton.style.cssText = 'position: absolute; top: 16px; right: 16px; z-index: 10001; background: #ff4444; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-weight: 500;';
    closeButton.onclick = () => { restoreMap(containerId, day); };
    expandedContainer.appendChild(closeButton);

    // Scale bar
   const scaleBarDiv = document.createElement('div');
scaleBarDiv.className = 'route-scale-bar';
scaleBarDiv.id = `expanded-route-scale-bar-day${day}`;
expandedContainer.appendChild(scaleBarDiv);

    // Map area
    const mapDivId = `${containerId}-expanded`;
    let mapDiv = document.getElementById(mapDivId);
    if (mapDiv) {
        if (mapDiv._leaflet_id) mapDiv._leaflet_id = null;
        mapDiv.parentNode.removeChild(mapDiv);
    }
    mapDiv = document.createElement('div');
    mapDiv.id = mapDivId;
    mapDiv.className = 'expanded-map';
    expandedContainer.appendChild(mapDiv);

    document.body.appendChild(expandedContainer);

    originalContainer.style.display = 'none';

    // Harita oluştur
    const expandedMap = L.map(mapDiv.id, {
        center: map.getCenter(),
        zoom: map.getZoom(),
        scrollWheelZoom: true,
        fadeAnimation: false,
        zoomAnimation: false,
        preferCanvas: true
    });

    let expandedTileLayer;
    // expandMap içindeki local setExpandedMapTile — crossOrigin ekleyin
function setExpandedMapTile(styleKey) {
  const url = `https://api.mapbox.com/styles/v1/mapbox/${styleKey}/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`;
  if (expandedTileLayer) {
    expandedMap.removeLayer(expandedTileLayer);
    expandedTileLayer = null;
  }
  expandedTileLayer = L.tileLayer(url, {
    tileSize: 256,
    zoomOffset: 0,
    attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a>',
    crossOrigin: true // EKLENDİ
  });
  expandedTileLayer.addTo(expandedMap);
}


    setExpandedMapTile('streets-v12');

   // expandMap içindeki mapStyleSelect.onchange kısmında da crossOrigin ekleyin
mapStyleSelect.onchange = function() {
  setExpandedMapTile(this.value);
  const originalMap = window.leafletMaps[containerId];
  if (originalMap) {
    let originalTileLayer = null;
    originalMap.eachLayer(layer => {
      if (layer instanceof L.TileLayer) {
        originalTileLayer = layer;
      }
    });
    if (originalTileLayer) originalMap.removeLayer(originalTileLayer);

    const url = `https://api.mapbox.com/styles/v1/mapbox/${this.value}/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`;
    L.tileLayer(url, {
      tileSize: 256,
      zoomOffset: 0,
      attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a>',
      crossOrigin: true // EKLENDİ
    }).addTo(originalMap);
  }
};

    // Polyline ve marker'ları ekle
    const geojson = window.lastRouteGeojsons?.[containerId];
    if (geojson && geojson.features && geojson.features[0]?.geometry?.coordinates) {
        const geoCoords = geojson.features[0].geometry.coordinates;
        const polylineLatLngs = geoCoords.map(c => [c[1], c[0]]);
        const polyline = L.polyline(polylineLatLngs, { color: '#1976d2', weight: 7, opacity: 0.93 }).addTo(expandedMap);
        expandedMap.fitBounds(polyline.getBounds());
    }

    Object.values(map._layers).forEach(layer => {
        if (layer instanceof L.Marker) {
            const marker = L.marker(layer.getLatLng(), {
                icon: layer.options.icon,
                title: layer.options.title
            }).addTo(expandedMap);
            if (layer._popup) marker.bindPopup(layer._popup._content);
        }
    });

    setTimeout(() => expandedMap.invalidateSize({ pan: false }), 500);

    // Stats güncelle
    const geojsonSummary = geojson?.features[0]?.properties?.summary;
    const dayDisplay = getDayDisplayName(day);
    if (geojsonSummary) {
        statsDiv.innerHTML = `
               <b>${dayDisplay}</b> &nbsp; — &nbsp;
    <b>Distance:</b> ${(geojsonSummary.distance / 1000).toFixed(2)} km&nbsp; — &nbsp;
    <b>Duration:</b> ${Math.round(geojsonSummary.duration / 60)} min

        `;
    }

    window.expandedMaps = window.expandedMaps || {};
    window.expandedMaps[containerId] = {
        originalContainer,
        day,
        originalMap: map,
        expandedMap,
        expandButton
    };

    // Scale bar render
    const totalKm = window.lastRouteSummaries?.[containerId]?.distance / 1000 || 0;
    const markerPositions = getRouteMarkerPositionsOrdered(day);
    if (totalKm > 0 && markerPositions.length > 0) {
        renderRouteScaleBar(scaleBarDiv, totalKm, markerPositions);
    }

    addDraggableMarkersToExpandedMap(expandedMap, day);
    setupScaleBarInteraction(day, expandedMap);
    enableLongPressPopupOnMap(expandedMap, day);
}
function enableLongPressPopupOnMap(map, day) {
    const mapContainer = map.getContainer();
    let longPressTimer = null;
    let startPosition = null;
    let startTime = null;
    let isLongPressing = false;
    let circle = null;

    const LONG_PRESS_DURATION = 1000;
    const MOVE_THRESHOLD = 15;
    const CIRCLE_RADIUS = 500;

    // YARDIMCI: olay marker üzerinden mi geliyor?
    const isFromMarkerTarget = (target) => {
        return !!(target && (
            target.closest('.leaflet-marker-icon') ||
            target.closest('.custom-marker-outer') ||
            target.closest('.custom-marker-place-name') ||
            target.closest('.marker-remove-x-btn')
        ));
    };

    function clearLongPress() {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
        if (circle) {
            map.removeLayer(circle);
            circle = null;
        }
        isLongPressing = false;
        startPosition = null;
        startTime = null;
    }

    function getEventPosition(e) {
        if (e.touches && e.touches[0]) {
            return {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY,
                pageX: e.touches[0].pageX,
                pageY: e.touches[0].pageY,
                target: e.target
            };
        }
        return {
            x: e.clientX,
            y: e.clientY,
            pageX: e.pageX,
            pageY: e.pageY,
            target: e.target
        };
    }

    function getLatLngFromPosition(pos) {
        const containerRect = mapContainer.getBoundingClientRect();
        const containerPoint = L.point(
            pos.x - containerRect.left,
            pos.y - containerRect.top
        );
        return map.containerPointToLatLng(containerPoint);
    }

    function startLongPress(e) {
        // 1) Marker'dan geliyorsa uzun basmayı BAŞLATMA
        if (isFromMarkerTarget(e.target)) {
            clearLongPress();
            return;
        }
        // 2) Marker sürükleme aktifse (global bayrak) hiç başlatma
        if (window.__tt_markerDragActive) {
            clearLongPress();
            return;
        }

        clearLongPress();

        const position = getEventPosition(e);
        const latLng = getLatLngFromPosition(position);
        if (!latLng) return;

        startPosition = position;
        startTime = Date.now();
        isLongPressing = true;

        circle = L.circle(latLng, {
            radius: 10,
            color: '#1976d2',
            fillColor: '#1976d2',
            fillOpacity: 0.3,
            weight: 3
        }).addTo(map);

        let currentRadius = 10;
        const maxRadius = CIRCLE_RADIUS;
        const growthInterval = setInterval(() => {
            if (!isLongPressing || !circle) {
                clearInterval(growthInterval);
                return;
            }
            currentRadius += (maxRadius - 10) / (LONG_PRESS_DURATION / 50);
            if (currentRadius > maxRadius) currentRadius = maxRadius;
            circle.setRadius(currentRadius);
            circle.setStyle({
                fillOpacity: 0.1 + (0.4 * (currentRadius / maxRadius))
            });
        }, 50);

        longPressTimer = setTimeout(() => {
            // Marker drag esnasında ise yine iptal
            if (window.__tt_markerDragActive) {
                clearInterval(growthInterval);
                clearLongPress();
                return;
            }
            if (isLongPressing && startPosition) {
                if ('vibrate' in navigator) navigator.vibrate(100);
                const finalLatLng = getLatLngFromPosition(startPosition);
                showNearbyPlacesPopup(finalLatLng.lat, finalLatLng.lng, map, day, CIRCLE_RADIUS);
                clearInterval(growthInterval);
                clearLongPress();
                setTimeout(() => { isLongPressing = false; }, 200);
            }
        }, LONG_PRESS_DURATION);
    }

    function handleMove(e) {
        if (!isLongPressing) return;
        const currentPos = getEventPosition(e);
        const dx = Math.sqrt(Math.pow(currentPos.x - startPosition.x, 2) + Math.pow(currentPos.y - startPosition.y, 2));
        if (dx > MOVE_THRESHOLD) {
            clearLongPress();
        }
        // Marker drag aktifse de iptal
        if (window.__tt_markerDragActive) {
            clearLongPress();
        }
    }

    function handleEnd() {
        clearLongPress();
    }

    mapContainer.addEventListener('touchstart', startLongPress, { passive: false });
    mapContainer.addEventListener('touchmove', handleMove, { passive: false });
    mapContainer.addEventListener('touchend', handleEnd, { passive: false });
    mapContainer.addEventListener('touchcancel', handleEnd, { passive: false });

    mapContainer.addEventListener('mousedown', startLongPress);
    mapContainer.addEventListener('mousemove', handleMove);
    mapContainer.addEventListener('mouseup', handleEnd);
    mapContainer.addEventListener('mouseleave', handleEnd);

    return function cleanup() {
        clearLongPress();
        mapContainer.removeEventListener('touchstart', startLongPress);
        mapContainer.removeEventListener('touchmove', handleMove);
        mapContainer.removeEventListener('touchend', handleEnd);
        mapContainer.removeEventListener('touchcancel', handleEnd);
        mapContainer.removeEventListener('mousedown', startLongPress);
        mapContainer.removeEventListener('mousemove', handleMove);
        mapContainer.removeEventListener('mouseup', handleEnd);
        mapContainer.removeEventListener('mouseleave', handleEnd);
    };
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
    
    // Önceki popup'ları temizle
    closeNearbyPopup();
    
    // Loading indicator göster
    const loadingContent = `
        <div class="nearby-loading-message">
            <div class="nearby-loading-spinner"></div>
        <small class="nearby-loading-text">Searching for nearby places...</small>
        </div>
    `;
    showCustomPopup(lat, lng, map, loadingContent, false);

    try {
        // Önce konum bilgisini al
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
                    photos = await Promise.all(results.map(async (f, idx) => {
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

                // Places HTML'i oluştur
                placesHtml = results.map((f, idx) => {
                    const name = f.properties.name || "(İsim yok)";
                    const adr = f.properties.formatted || "";
                    const photo = photos[idx] || PLACEHOLDER_IMG;
                    const distStr = f.distance < 1000
                        ? `${Math.round(f.distance)} m`
                        : `${(f.distance/1000).toFixed(2)} km`;
                    
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

        // Düzenlenebilir nokta adı ve sepete ekleme butonu - yeni tasarım
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

        // Final HTML content
        const html = `
            <div class="nearby-popup-title">
                📍 Yakındaki Mekanlar
            </div>
            ${addPointSection}
            <ul class="nearby-places-list">${placesHtml}</ul>
        `;
        
        showCustomPopup(lat, lng, map, html, true);

        // Sonuçları global olarak sakla
        window._lastNearbyPlaces = results;
        window._lastNearbyPhotos = photos;
        window._lastNearbyDay = day;
        window._currentPointInfo = pointInfo;
        
        // Seçilen nokta için fotoğraf yükle
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
    if (window._nearbyMarker) {
        map.removeLayer(window._nearbyMarker);
    }
    window._nearbyMarker = L.circleMarker([lat, lng], {
        radius: 8,
        fillColor: '#1976d2',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
    }).addTo(map);
}

// Popup kapatma fonksiyonu
window.closeNearbyPopup = function() {
    // Custom popup elementini kaldır
    const popupElement = document.getElementById('custom-nearby-popup');
    if (popupElement) {
        popupElement.style.animation = 'slideOut 0.2s ease-in';
        setTimeout(() => {
            if (popupElement.parentNode) {
                popupElement.parentNode.removeChild(popupElement);
            }
        }, 200);
    }
    
    // Marker'ı kaldır
    if (window._nearbyMarker && window._nearbyMarker._map) {
        window._nearbyMarker._map.removeLayer(window._nearbyMarker);
        window._nearbyMarker = null;
    }
    
    // Global referansları temizle
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
function removeAllScaleBarsExcept(container) {
    document.querySelectorAll('.route-scale-bar').forEach(bar => {
        if (bar !== container && bar.parentNode) {
            bar.parentNode.removeChild(bar);
        }
    });
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
async function sendMapbox(coordinates, day) {
  try {
    const coordParam = coordinates.map(c => `${c[0]},${c[1]}`).join(';');
    const url = buildMapboxDirectionsUrl(coordParam, day); // <-- day eklendi
    const response = await fetch(url);
    if (!response.ok) throw new Error('Mapbox error: ' + response.status);
    const data = await response.json();
    const geojson = {
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
    };
    return geojson;
  } catch (error) {
    console.error('Mapbox Error:', error);
    throw error;
  }
}

function getDayPoints(day) {
    // Sadece cart dizisini oku, DOM'dan asla okuma!
    return window.cart
        .filter(item =>
            item.day == day &&
            item.location &&
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

function updateExpandedHeaderPosition(day) {
    const container = document.getElementById(`expanded-map-${day}`);
    if (!container) return;

    const header = container.querySelector('.expanded-map-header');
    if (!header) return;

    const pts = getDayPoints(day); // Zaten sende var
    const isEmpty = !pts || pts.length < 2;

    if (isEmpty) {
        if (!header.dataset._origStored) {
            header.dataset._origStored    = '1';
            header.dataset._origPosition  = header.style.position || '';
            header.dataset._origTop       = header.style.top || '';
            header.dataset._origBottom    = header.style.bottom || '';
            header.dataset._origLeft      = header.style.left || '';
            header.dataset._origRight     = header.style.right || '';
            header.dataset._origShadow    = header.style.boxShadow || '';
            header.dataset._origBorderTop = header.style.borderTop || '';
        }
        header.style.position  = 'absolute';
        header.style.top       = 'auto';
        header.style.bottom    = '0';
        header.style.left      = '0';
        header.style.right     = '0';
        header.style.boxShadow = '0 -2px 8px rgba(0,0,0,0.08)';
        header.style.borderTop = '1px solid #e0e0e0';
    } else {
        header.style.position  = header.dataset._origPosition  || '';
        header.style.top       = header.dataset._origTop       || '';
        header.style.bottom    = header.dataset._origBottom    || '';
        header.style.left      = header.dataset._origLeft      || '';
        header.style.right     = header.dataset._origRight     || '';
        header.style.boxShadow = header.dataset._origShadow    || '';
        header.style.borderTop = header.dataset._origBorderTop || '';
    }
}
async function renderRouteForDay(day) {
  const points = getDayPoints(day);
  const containerId = `route-map-day${day}`;

  // 1) 2'den az nokta: boş temel harita göster / koru
  if (points.length < 2) {
    // Boş harita yoksa oluştur (Avrupa merkezli)
    initEmptyDayMap(day);

    // Rota / istatistik / scale bar temizliği
    updateRouteStatsUI(day);
    clearDistanceLabels(day);

    // Expanded açık ise sadece polyline & markerları temizle ama haritayı bırak
    const expandedMapObj = window.expandedMaps?.[containerId];
    if (expandedMapObj && expandedMapObj.expandedMap) {
      expandedMapObj.expandedMap.eachLayer(layer => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline) {
          expandedMapObj.expandedMap.removeLayer(layer);
        }
      });
    }

    // Küçük haritada (sidebar) eski route çizimini silmek için:
    if (window.leafletMaps && window.leafletMaps[containerId]) {
      // Sadece polyline/marker temizle; base tile kalsın
      const map = window.leafletMaps[containerId];
      map.eachLayer(layer => {
        // TileLayer hariç (L.TileLayer) her şeyi temizle
        if (!(layer instanceof L.TileLayer)) {
          map.removeLayer(layer);
        }
      });
    }

    // Ölçek (elevation) barını sıfırla
    const scaleBarDiv = document.getElementById(`route-scale-bar-day${day}`);
    if (scaleBarDiv) scaleBarDiv.innerHTML = "";

    return; // Rota hesaplamasına girmeden çık
  }

  // 2) 2+ nokta: rota oluştur
  const snappedPoints = [];
  for (const pt of points) {
    const snapped = await snapPointToRoad(pt.lat, pt.lng);
    snappedPoints.push({ ...snapped, name: pt.name });
  }

  // (Buradan sonrası senin mevcut 2+ nokta rotalama kodunla aynı kalabilir)
  // Aşağıdaki blok senin önceki fonksiyonundaki 2+ case içeriğiyle devam etmeli:

  const coordinates = snappedPoints.map(pt => [pt.lng, pt.lat]);

  async function getRoute() {
    const coordParam = coordinates.map(c => `${c[0]},${c[1]}`).join(';');
    const url = buildMapboxDirectionsUrl(coordParam, day);
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
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
      summary: data.routes[0].distance && data.routes[0].duration ? {
        distance: data.routes[0].distance,
        duration: data.routes[0].duration
      } : null
    };
  }

  let routeData;
  let missingPoints = [];
  try {
    routeData = await getRoute();
    if (!routeData) return;
    missingPoints = snappedPoints.filter(p => isPointReallyMissing(p, routeData.coords, 100));
  } catch (e) {
    const infoPanel = document.getElementById(`route-info-day${day}`);
    if (infoPanel) infoPanel.textContent = "Rota çizilemedi!";
    const smallContainer = document.getElementById(containerId);
    if (smallContainer) smallContainer.innerHTML = "";
    document.getElementById(`map-style-select-day${day}`)?.remove();
    return;
  }

  // Missing points uyarısı
  if (missingPoints.length > 0) {
    const infoPanel = document.getElementById(`route-info-day${day}`);
    if (infoPanel) {
      infoPanel.innerHTML = `<span style="color:#d32f2f;font-size:0.85rem;font-weight:500;">
        <strong>Note:</strong> Some points could not be included in the route!<br>
        <strong>Missing:</strong> ${missingPoints.map(p => p.name).join(', ')}
      </span>`;
    }
  } else {
    const infoPanel = document.getElementById(`route-info-day${day}`);
    if (infoPanel) infoPanel.textContent = "";
  }

  window.lastRouteGeojsons = window.lastRouteGeojsons || {};
  window.lastRouteGeojsons[containerId] = routeData.geojson;

  window.lastRouteSummaries = window.lastRouteSummaries || {};
  window.lastRouteSummaries[containerId] = routeData.summary;

  // Küçük haritada rota
  renderLeafletRoute(containerId, routeData.geojson, snappedPoints, routeData.summary, day, missingPoints);

  // Expanded açıksa güncelle
  const expandedMapObj = window.expandedMaps?.[containerId];
  if (expandedMapObj && expandedMapObj.expandedMap) {
    updateExpandedMap(expandedMapObj.expandedMap, day);
  }

  // İkili özetler
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
      if (!response.ok) throw new Error('Mapbox error: ' + response.status);
      const data = await response.json();
      if (!data.routes || !data.routes[0] || !data.routes[0].geometry) throw new Error('No route found');
      pairwiseSummaries.push({
        distance: data.routes[0].distance,
        duration: data.routes[0].duration
      });
    } catch (e) {
      pairwiseSummaries.push({ distance: null, duration: null });
    }
  }
  window.pairwiseRouteSummaries = window.pairwiseRouteSummaries || {};
  window.pairwiseRouteSummaries[containerId] = pairwiseSummaries;
  updatePairwiseDistanceLabels(day);

  // Ölçek / elevation bar (küçük)
  const totalKm = routeData.summary ? routeData.summary.distance / 1000 : 0;
  const markerPositions = getRouteMarkerPositionsOrdered(day);
  const scaleBarDiv = document.getElementById(`route-scale-bar-day${day}`);
  if (scaleBarDiv && totalKm > 0 && markerPositions.length > 0) {
    try { delete scaleBarDiv._elevProfile; } catch (_) { scaleBarDiv._elevProfile = null; }
    renderRouteScaleBar(scaleBarDiv, totalKm, markerPositions);
  } else if (scaleBarDiv) {
    scaleBarDiv.innerHTML = "";
  }

  if (routeData.summary && typeof updateDistanceDurationUI === 'function') {
    updateDistanceDurationUI(routeData.summary.distance, routeData.summary.duration);
  }

  // Rota çizildi; boş harita ipucunu kaldır
  const hint = document.querySelector(`#route-map-day${day} .empty-map-hint`);
  if (hint) hint.remove();

  setTimeout(() => {
    updateRouteStatsUI(day);
  }, 250);
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
        // Marker'ı ekle
        const marker = L.marker([poi.lat, poi.lng]).addTo(map);

        // Popup içeriği oluştur
        const popupDiv = document.createElement('div');
        popupDiv.style.display = 'flex';
        popupDiv.style.flexDirection = 'column';
        popupDiv.style.alignItems = 'flex-start';

        // Yer adı
        const nameEl = document.createElement('div');
        nameEl.textContent = poi.name;
        nameEl.style.fontWeight = 'bold';
        nameEl.style.marginBottom = '8px';
        popupDiv.appendChild(nameEl);

        // "Geziye Ekle" butonu
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
addBtn.textContent = 'Add to Trip';
        addBtn.style.padding = '8px 12px';
        addBtn.style.background = '#1976d2';
        addBtn.style.color = '#fff';
        addBtn.style.border = 'none';
        addBtn.style.borderRadius = '6px';
        addBtn.style.cursor = 'pointer';

        addBtn.onclick = function() {
            // Çift ekleme kontrolü
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

        // Marker'a popup ekle
        marker.bindPopup(`<b>${p.name || "Point"}</b>`, {
  autoClose: false,
  closeButton: true
});
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
            ) {
                return;
            }
            const dayContainer = header.closest('.day-container');
            if (!dayContainer) return;

            // Gün numarası (her zaman string olarak alınır)
            const day = dayContainer.dataset.day || dayContainer.id.replace('day-container-', '');

            // .day-container içindekiler (day-list, route-map, route-info, bilgi barı)
            [
                '.day-list',
                '.route-map',
                '.route-info',
                `#map-bottom-controls-wrapper-day${day}`
            ].forEach(sel => {
                let el = null;
                // Eğer sel id ile başlıyorsa doğrudan document.getElementById, değilse dayContainer.querySelector
                if (sel.startsWith('#')) {
                    el = document.getElementById(`map-bottom-controls-wrapper-day${day}`);
                } else {
                    el = dayContainer.querySelector(sel);
                }
                if (el) el.classList.toggle('collapsed');
            });

            // .add-more-btn: .day-container'ın hemen sonundaki kardeşinde
            let next = dayContainer.nextElementSibling;
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
// ensureDayTravelModeSet fonksiyonunu güncelle
function ensureDayTravelModeSet(day, routeMapEl, controlsWrapperEl) {
  // Remove any legacy/header sets for this day
  document.querySelectorAll(`#day-container-${day} .day-header .tt-travel-mode-set`).forEach(el => el.remove());

  // Create or reuse the set
  let set = document.getElementById(`tt-travel-mode-set-day${day}`);
  if (!set) {
    set = document.createElement('div');
    set.id = `tt-travel-mode-set-day${day}`;
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

    // Interaction for travel mode buttons
    set.addEventListener('mousedown', e => e.stopPropagation(), { passive: true });
    set.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // Handle expand map button
      if (e.target.closest('.expand-map-btn')) {
        const containerId = `route-map-day${day}`;
        expandMap(containerId, day);
        return;
      }
      
      // Handle travel mode buttons
      const btn = e.target.closest('button[data-mode]');
      if (!btn) return;
      window.setTravelMode(btn.getAttribute('data-mode'), day);
    });
  }

  // Insert set exactly before the controls wrapper
  if (controlsWrapperEl && controlsWrapperEl.parentNode) {
    if (set.previousElementSibling !== routeMapEl || set.nextElementSibling !== controlsWrapperEl) {
      controlsWrapperEl.parentNode.insertBefore(set, controlsWrapperEl);
    }
  } else if (routeMapEl && routeMapEl.parentNode) {
    routeMapEl.parentNode.insertBefore(set, routeMapEl.nextSibling);
  }

  // Mark active
  if (typeof markActiveTravelModeButtons === 'function') {
    markActiveTravelModeButtons();
  }
}

// Styles (once)
/*
(function ensureTmInlineStyles() {

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
      background: #ffffff; border-color: #0d6efd; color: #fff;
    }
    .tt-travel-mode-set button:hover { filter: brightness(0.97); }
  `;
  document.head.appendChild(style);
})();*/
// Replace this function in son9.js

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
    margin: 10px 0;
    flex-direction: column;
    padding:10px;
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
  position: fixed !important; /* kesinlikle fixed */
  left: 0;
  right: 0;
  bottom: env(safe-area-inset-bottom, 0);
  z-index: 1000;
  background: #fff;
  box-shadow: 0 -2px 12px rgba(0,0,0,0.12);
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
  min-height: 150px;
      
        width: calc(100% - 435px);
}
@supports (height: 100dvh) {
  .scale-bar-track {
    bottom: 0 !important; /* yeni tarayıcılarda env ile çakışmasın */
  }
}
@media (max-width:768px) {
    .scale-bar-track {
            width: calc(100% - 20px);
    }
}
    /* Distance baseline and ticks (top) */
   
    .scale-bar-tick { position:absolute; top:10px; width:1px; height:16px; background:#cfd8dc; }
    .scale-bar-label { position:absolute; top:30px; transform:translateX(-50%); font-size:11px; color:#607d8b; }

    /* Elevation SVG layer and styling */
    .tt-elev-svg {
    position: absolute;
    left: 0;
    top: 48px;
    width: 100%;
    height: 136px;
    pointer-events: none;
    z-index: 0;
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
    .tt-elev-svg { position:absolute; left:0; top:48px; width:100%; height:136px; pointer-events:none; z-index:0; }
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
    container && (container.innerHTML = ""); 
    return; 
  }

  const day = (() => { const m = container.id && container.id.match(/day(\d+)/); return m ? parseInt(m[1], 10) : null; })();
  const gj = day ? (window.lastRouteGeojsons?.[`route-map-day${day}`]) : null;
  const coords = gj?.features?.[0]?.geometry?.coordinates;
  if (!coords || coords.length < 2) { container.innerHTML = `<div class="scale-bar-track"></div>`; return; }

  if (Date.now() < (window.__elevCooldownUntil || 0)) {
    window.showScaleBarLoading?.(container, 'Loading elevation…');
    const mid = coords[Math.floor(coords.length / 2)];
    const routeKey = `${coords.length}|${coords[0]?.join(',')}|${mid?.join(',')}|${coords[coords.length-1]?.join(',')}`;
    const waitMs = Math.max(5000, (window.__elevCooldownUntil || 0) - Date.now());
    if (!container.__elevRetryTimer && typeof planElevationRetry === 'function') {
      planElevationRetry(container, routeKey, waitMs, () => window.renderRouteScaleBar(container, totalKm, markers));
    }
    return;
  }

  const mid = coords[Math.floor(coords.length / 2)];
  const routeKey = `${coords.length}|${coords[0]?.join(',')}|${mid?.join(',')}|${coords[coords.length-1]?.join(',')}`;

  if (container.dataset.elevLoadedKey === routeKey) {
    window.hideScaleBarLoading?.(container);
    return;
  }

  // Clean up previous observer BEFORE creating new elements
  if (container._elevResizeObserver) {
    container._elevResizeObserver.disconnect();
    container._elevResizeObserver = null;
  }

  // UI sıfırlanır ve tekrar çizilir
  container.innerHTML = `<div class="scale-bar-track"></div>`;
  const track = container.querySelector('.scale-bar-track');

  let width = Math.max(200, Math.round(track.getBoundingClientRect().width));
  if (isNaN(width)) width = 400;

  // Marker/Komoot padding
  const MARKER_PAD_PX = 10;
  track.style.position = 'relative';
  track.style.paddingLeft = `${MARKER_PAD_PX}px`;
  track.style.paddingRight = `${MARKER_PAD_PX}px`;
  track.style.overflow = 'visible';

  // Dikey çizgi (vertical line)
  let verticalLine = track.querySelector('.scale-bar-vertical-line');
  if (!verticalLine) {
    verticalLine = document.createElement('div');
    verticalLine.className = 'scale-bar-vertical-line';
    verticalLine.style.cssText = `
      position:absolute;top:0;bottom:0;width:2px;
      background:#111;opacity:0.5;pointer-events:none;z-index:100;
      display:none;
    `;
    track.appendChild(verticalLine);
  }

  // Tooltip/cursor
  let tooltip = track.querySelector('.tt-elev-tooltip'); 
  if (!tooltip) { 
    tooltip = document.createElement('div'); 
    tooltip.className = 'tt-elev-tooltip'; 
    tooltip.textContent = ''; 
    tooltip.style.left = '0px'; 
    track.appendChild(tooltip); 
  }

  container.dataset.elevLoadedKey = routeKey;

  // Helper for scale ticks/labels/markers
  function niceStep(total, target) { 
    const raw = total / Math.max(1, target); 
    const pow10 = Math.pow(10, Math.floor(Math.log10(raw))); 
    const n = raw / pow10; 
    const f = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10; 
    return f * pow10; 
  }
  function createScaleElements(currentWidth) {
    track.querySelectorAll('.scale-bar-tick, .scale-bar-label').forEach(el => el.remove());
    track.querySelectorAll('[title]').forEach(el => {
      if (el.style.position === 'absolute' && el.style.top === '2px') el.remove();
    });
    const targetCount = Math.max(6, Math.min(14, Math.round(currentWidth / 100)));
    let stepKm = niceStep(totalKm, targetCount);
    let majors = Math.max(1, Math.round(totalKm / Math.max(stepKm, 1e-6)));
    if (majors < 6) { stepKm = niceStep(totalKm, 6); majors = Math.round(totalKm / stepKm); }
    if (majors > 14) { stepKm = niceStep(totalKm, 14); majors = Math.round(totalKm / stepKm); }
    for (let i = 0; i <= majors; i++) {
      const curKm = Math.min(totalKm, i * stepKm);
      const leftPct = (curKm / totalKm) * 100;
      const labelText = i === majors ? totalKm.toFixed(1) : (totalKm > 20 ? Math.round(curKm) : curKm.toFixed(1));
      const tick = document.createElement('div'); 
      tick.className = 'scale-bar-tick'; 
      tick.style.left = `${leftPct}%`; 
      track.appendChild(tick);
      const label = document.createElement('div'); 
      label.className = 'scale-bar-label'; 
      label.style.left = `${leftPct}%`; 
      label.textContent = `${labelText} km`; 
      track.appendChild(label);
    }
    if (Array.isArray(markers)) {
      markers.forEach((m, idx) => {
        const left = (m.distance / totalKm) * 100;
        const wrap = document.createElement('div');
        wrap.title = m.name || '';
        wrap.style.cssText = `position:absolute;left:${left}%;top:2px;width:18px;height:18px;transform:translateX(-50%);`;
        wrap.innerHTML = `<div style="width:18px;height:18px;border-radius:50%;background:#d32f2f;border:2px solid #fff;box-shadow:0 2px 6px #888;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;font-weight:700;">${idx + 1}</div>`;
        track.appendChild(wrap);
      });
    }
  }
  createScaleElements(width);

  // SVG creation (elevation profile)
  const svgNS = 'http://www.w3.org/2000/svg';
  const SVG_TOP = 48;
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  let SVG_H;
  if (isMobile) {
    SVG_H = Math.max(180, Math.min(240, Math.round(track.getBoundingClientRect().height - SVG_TOP - 12)));
  } else {
    SVG_H = Math.max(180, Math.min(320, Math.round(track.getBoundingClientRect().height - SVG_TOP - 16)));
  }
  if (isNaN(SVG_H)) SVG_H = isMobile ? 160 : 220;

  const svg = document.createElementNS(svgNS, 'svg');
  svg.className = 'tt-elev-svg';
  svg.setAttribute('viewBox', `0 0 ${width} ${SVG_H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', SVG_H);

  const gridG = document.createElementNS(svgNS, 'g');
  gridG.setAttribute('class', 'tt-elev-grid');
  svg.appendChild(gridG);

  const areaPath = document.createElementNS(svgNS, 'path');
  areaPath.setAttribute('class', 'tt-elev-area');
  svg.appendChild(areaPath);

  const segG = document.createElementNS(svgNS, 'g');
  svg.appendChild(segG);

  track.appendChild(svg);

  // Distance calculation
  function hv(lat1, lon1, lat2, lon2) {
    const R = 6371000, toRad = x => x*Math.PI/180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lat2 - lat1 === 0 ? 0 : lon2 - lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(a));
  }
  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i-1];
    const [lon2, lat2] = coords[i];
    cum[i] = cum[i-1] + hv(lat1, lon1, lat2, lon2);
  }
  const totalM = cum[cum.length - 1] || 1;
  const N = Math.max(60, Math.round(totalKm * 4.5)); // km başına 6-8 örnek idealdir

  const samples = [];
  for (let i = 0; i < N; i++) {
    const target = (i / (N - 1)) * totalM;
    let idx = 0;
    while (idx < cum.length && cum[idx] < target) idx++;
    if (idx === 0) { 
      const [lon, lat] = coords[0]; 
      samples.push({ lat, lng: lon, distM: 0 }); 
    }
    else if (idx >= cum.length) { 
      const [lon, lat] = coords[cum.length - 1]; 
      samples.push({ lat, lng: lon, distM: totalM }); 
    }
    else {
      const p = idx - 1, seg = cum[idx] - cum[p] || 1, t = (target - cum[p]) / seg;
      const [lon1, lat1] = coords[p], [lon2, lat2] = coords[idx];
      samples.push({ lat: lat1 + (lat2 - lat1) * t, lng: lon1 + (lon2 - lon1) * t, distM: target });
    }
  }

  window.showScaleBarLoading?.(container, 'Loading elevation…');

  function handleResize() {
    if (!track || !track.parentNode) return;
    const newWidth = Math.max(200, Math.round(track.getBoundingClientRect().width));
    if (Math.abs(newWidth - width) < 10) return;
    width = newWidth;
    if (svg && svg.parentNode) {
      svg.setAttribute('viewBox', `0 0 ${newWidth} ${SVG_H}`);
    }
    createScaleElements(newWidth);
    if (container._elevationData) {
      redrawElevation(container._elevationData);
    }
  }

  function redrawElevation(elevationData) {
    if (!track || !track.parentNode || !svg || !svg.parentNode) return;
    const { smooth, min, max } = elevationData;

    // VİSUAL MİN/MAX HESABI: ALTTA VE ÜSTTE 1/4 BOŞLUK
    let vizMin = min, vizMax = max;
    const elevSpan = max - min;
    if (elevSpan > 0) {
      vizMin = min - elevSpan * 0.50;
      vizMax = max + elevSpan * 1;
    } else {
      vizMin = min - 1;
      vizMax = max + 1;
    }

    const X = km => (km / totalKm) * width;
    const Y = e => {
      if (isNaN(e) || vizMin === vizMax) return SVG_H / 2;
      return (SVG_H - 1) - ((e - vizMin) / (vizMax - vizMin)) * (SVG_H - 2);
    };

    while (gridG.firstChild) gridG.removeChild(gridG.firstChild);
    while (segG.firstChild) segG.removeChild(segG.firstChild);

    // Grid çizgileri yeni görsel aralığa göre
    const levels = 4;
    for (let i = 0; i <= levels; i++) {
      const ev = vizMin + (i / levels) * (vizMax - vizMin);
      const y = Y(ev);
      if (isNaN(y)) continue;
      const ln = document.createElementNS(svgNS, 'line');
      ln.setAttribute('x1', '0');
      ln.setAttribute('x2', String(width));
      ln.setAttribute('y1', String(y));
      ln.setAttribute('y2', String(y));
      gridG.appendChild(ln);
      const tx = document.createElementNS(svgNS, 'text');
      tx.setAttribute('x', '6');
      tx.setAttribute('y', String(y - 4));
      tx.textContent = `${Math.round(ev)} m`;
      gridG.appendChild(tx);
    }
    let topD = '';
    for (let i = 0; i < smooth.length; i++) {
      const x = Math.max(0, Math.min(width, X(samples[i].distM / 1000)));
      const y = Y(smooth[i]);
      if (isNaN(x) || isNaN(y)) continue;
      topD += (topD === '' ? `M ${x} ${y}` : ` L ${x} ${y}`);
    }
    if (topD.length > 0) {
      const areaD = `${topD} L ${width} ${SVG_H} L 0 ${SVG_H} Z`;
      areaPath.setAttribute('d', areaD);
      areaPath.setAttribute('fill', '#263445');
    }
    for (let i = 1; i < smooth.length; i++) {
      const x1 = Math.max(0, Math.min(width, X(samples[i - 1].distM / 1000)));
      const y1 = Y(smooth[i - 1]);
      const x2 = Math.max(0, Math.min(width, X(samples[i].distM / 1000)));
      const y2 = Y(smooth[i]);
      if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) continue;
      const dx = samples[i].distM - samples[i - 1].distM;
      const dy = smooth[i] - smooth[i - 1];
      let slope = 0;
      let color = "#72c100";
      if (i > 1 && dx > 50) {
        slope = (dy / dx) * 100;
        color = getSlopeColor(Math.abs(slope));
      }
      const seg = document.createElementNS(svgNS, 'line');
      seg.setAttribute('x1', String(x1)); seg.setAttribute('y1', String(y1));
      seg.setAttribute('x2', String(x2)); seg.setAttribute('y2', String(y2));
      seg.setAttribute('stroke', color); seg.setAttribute('stroke-width', '3');
      seg.setAttribute('stroke-linecap', 'round');
      seg.setAttribute('fill', 'none');
      seg.dataset.slope = slope.toFixed(1);
      seg.dataset.idx = i;
      segG.appendChild(seg);
    }
  }

  let resizeTimeout;
  const resizeObserver = new ResizeObserver(() => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(handleResize, 100);
  });
  resizeObserver.observe(track);
  container._elevResizeObserver = resizeObserver;

  // DİKKAT: smooth, min, max erişimi için container._elevationData üzerinden alınmalı!
  track.addEventListener('mousemove', function(e) {
    const elevData = container._elevationData;
    if (!elevData || !Array.isArray(elevData.smooth)) return;
    const { smooth, min, max } = elevData;

    // Yine aynı görsel min/max'u mouseover için kullanalım:
    let vizMin = min, vizMax = max;
    const elevSpan = max - min;
    if (elevSpan > 0) {
      vizMin = min - elevSpan * 0.25;
      vizMax = max + elevSpan * 0.25;
    } else {
      vizMin = min - 1;
      vizMax = max + 1;
    }

    const ptX = e.clientX - track.getBoundingClientRect().left;
    let minDist = Infinity, foundSlope = null, foundElev = null, foundKm = null;

    // X fonksiyonu ile mouseX'i profile'a dönüştür
    const X = km => (km / totalKm) * width;
    const Y = e => {
      if (isNaN(e) || vizMin === vizMax) return SVG_H / 2;
      return (SVG_H - 1) - ((e - vizMin) / (vizMax - vizMin)) * (SVG_H - 2);
    };

    for (let i = 1; i < smooth.length; i++) {
      const x1 = Math.max(0, Math.min(width, X(samples[i - 1].distM / 1000)));
      const x2 = Math.max(0, Math.min(width, X(samples[i].distM / 1000)));
      const mid = (x1 + x2) / 2;
      const dist = Math.abs(ptX - mid);

      if (dist < minDist) {
        minDist = dist;
        const dx = samples[i].distM - samples[i - 1].distM;
        const dy = smooth[i] - smooth[i - 1];
        foundSlope = dx > 0 ? (dy / dx) * 100 : 0;
        foundElev = Math.round(smooth[i]);
        foundKm = (samples[i].distM / 1000);
      }
    }

    tooltip.style.opacity = '1';
tooltip.textContent = `${foundKm?.toFixed(2) || ''} km • ${foundElev || ''} m • %${foundSlope?.toFixed(1) || ''} slope`;
    tooltip.style.left = `${ptX}px`;

    // DİKEY ÇİZGİYİ GÖSTER (her mousemove'de kesin!)
    verticalLine.style.left = ptX + 'px';
    verticalLine.style.display = 'block';
  });

  // Mouse çıkınca dikey çizgiyi gizle
  track.addEventListener('mouseleave', function() {
    tooltip.style.opacity = '0';
    verticalLine.style.display = 'none';
  });

  // Mobil touch desteği
  track.addEventListener('touchmove', function(e){
    if (e.touches && e.touches[0]) {
      const rect = track.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      verticalLine.style.left = `${x}px`;
      verticalLine.style.display = 'block';
    }
  }, {passive: true});
  track.addEventListener('touchend', function(){
    verticalLine.style.display = 'none';
  });

  // ELEVASYON YÜKLEME VE PROFILE ÇİZME
  (async () => {
    try {
      const elevations = await window.getElevationsForRoute(samples, container, routeKey);
      if (elevations.length >= 5) {
        const firstFive = elevations.slice(0, 5);
        const minElev = Math.min(...firstFive);
        const maxElev = Math.max(...firstFive);
        if (Math.abs(maxElev - minElev) > 10) {
          const meanElev = Math.round(firstFive.reduce((a, b) => a + b, 0) / firstFive.length);
          for (let i = 0; i < 5; i++) elevations[i] = meanElev;
        }
      }
      if (!elevations || elevations.length !== samples.length || elevations.some(e => isNaN(e))) {
        container.innerHTML = `
          <div class="scale-bar-track">
            <div style="text-align:center;padding:12px;font-size:13px;color:#c62828;">
              Elevation profile unavailable
            </div>
          </div>
        `;
        return;
      }
      const smooth = movingAverage(elevations, 3); // Artık yumuşatılmış veriyle çalışırsın
      let up = 0, down = 0;
      for (let i = 1; i < smooth.length; i++) {
        const d = smooth[i] - smooth[i - 1];
        if (d > 1.5) up += d;
        else if (d < -1.5) down += -d;
      }
      if (typeof updateRouteAscentDescentUI === 'function' && day != null) {
        updateRouteAscentDescentUI(day, up, down);
      }
      if (day != null) {
        window.routeElevStatsByDay = window.routeElevStatsByDay || {};
        window.routeElevStatsByDay[day] = { ascent: up, descent: down };
        updateRouteStatsUI(day);
      }
      const min = Math.min(...smooth.filter(e => typeof e === "number" && !isNaN(e)));
      const max = Math.max(...smooth.filter(e => typeof e === "number" && !isNaN(e)), min + 1);
      container._elevationData = { smooth, min, max };
      redrawElevation(container._elevationData);
      window.hideScaleBarLoading?.(container);
    } catch (_) {
      window.updateScaleBarLoadingText?.(container, 'Elevation temporarily unavailable');
      try { delete container.dataset.elevLoadedKey; } catch (_) {}
    }
  })();
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
function adjustScaleBarPosition() {
  const sb = document.querySelector('.scale-bar-track');
  if (!sb) return;
  // iOS ve yeni Android'lerde en sağlamı visualViewport.height!
  if (window.visualViewport) {
    const viewportHeight = window.visualViewport.height;
    const windowHeight = window.innerHeight;
    // Eğer viewport daha kısa ise (adres çubuğu açık/klavye vs.)
    if (viewportHeight < windowHeight) {
      sb.style.bottom = (windowHeight - viewportHeight) + 'px';
    } else {
      sb.style.bottom = '0px';
    }
  } else {
    sb.style.bottom = '0px';
  }
  sb.style.position = 'fixed';
  sb.style.left = '0';
  sb.style.right = '0';
  sb.style.zIndex = 1000;
}
window.addEventListener('resize', adjustScaleBarPosition);
window.addEventListener('scroll', adjustScaleBarPosition);
window.addEventListener('orientationchange', adjustScaleBarPosition);
setTimeout(adjustScaleBarPosition, 100);