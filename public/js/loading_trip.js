/* ======================================================
   GLOBAL VARIABLES & MAP INITIALIZATION
====================================================== */
let map;
let service;
let directionsService;
let directionsRenderer;
let autocomplete;

function initMap() {
    const defaultLocation = { lat: 41.0082, lng: 28.9784 }; // Istanbul

    // Map settings
    const mapOptions = {
        center: defaultLocation,
        zoom: 12,
        disableDefaultUI: true,
        styles: [{ "featureType": "poi", "stylers": [{ "visibility": "off" }] }]
    };

    map = new google.maps.Map(document.getElementById("map"), mapOptions);

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: false,
        polylineOptions: { strokeColor: "#4285F4", strokeWeight: 5 }
    });

    service = new google.maps.places.PlacesService(map);

    // Autocomplete setup
    const input = document.getElementById("location-input");
    if (input) {
        const options = {
            fields: ["formatted_address", "geometry", "name"],
            strictBounds: false,
        };

        autocomplete = new google.maps.places.Autocomplete(input, options);
        autocomplete.bindTo("bounds", map);

        autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            if (!place.geometry || !place.geometry.location) return;
            map.setCenter(place.geometry.location);
        });
    }
}

/* ======================================================
   EVENT LISTENERS & MAIN LOGIC
====================================================== */
document.addEventListener("DOMContentLoaded", () => {

    const planBtn = document.getElementById("plan-trip-btn");
    const locationInput = document.getElementById("location-input");
    const daysSelect = document.getElementById("days-select");

    // Check if button exists before adding listener
    if (planBtn) {
        planBtn.addEventListener("click", () => {
            if (!locationInput) return;

            const destination = locationInput.value.trim();
            const days = daysSelect ? daysSelect.value : "3"; 

            if (!destination) {
                if (typeof addMessage === "function") addMessage("Please enter a destination.", "bot-message");
                return;
            }

            if (typeof addMessage === "function") {
                addMessage(`I want to go to ${destination} for ${days} days.`, "user-message");
            }

            // Start Loading (Locks the screen)
            if (typeof showLoadingPanel === "function") showLoadingPanel();

            // Simulation
            setTimeout(() => {
                if (typeof hideLoadingPanel === "function") hideLoadingPanel();
                if (typeof addMessage === "function") {
                    addMessage(`Great! I have prepared your ${days}-day trip to ${destination}.`, "bot-message survey-results");
                }
            }, 5000);
        });
    }

    // Enter key support
    if (locationInput) {
        locationInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter" && planBtn) planBtn.click();
        });
    }
});


/* ======================================================
   TRIP LOADING & CHAT STATE MANAGEMENT (MOBILE SHIELD FIX)
====================================================== */

// 1. LOCK MECHANISM (INVISIBLE SHIELD FOR MOBILE)
(function injectLockStyles() {
    if (!document.getElementById('lock-style-injection')) {
        const style = document.createElement('style');
        style.id = 'lock-style-injection';
        style.innerHTML = `
            /* Body state when locked */
            body.app-locked {
                overflow: hidden !important;
                touch-action: none !important; /* Prevent swipe on mobile */
            }

            /* INVISIBLE SHIELD */
            /* Covers the entire screen to block all touches */
            body.app-locked::after {
                content: "";
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                width: 100vw; height: 100vh;
                background: transparent; /* Transparent */
                z-index: 2147483647; /* Max z-index */
                pointer-events: auto !important; /* Capture all clicks/touches */
                cursor: wait;
            }
        `; 
        document.head.appendChild(style);
    }
})();

window.showLoadingPanel = function() {
    const chatBox = document.getElementById("chat-box");
    
    // 1. LOCK SCREEN
    document.body.classList.add('app-locked');
    if (document.activeElement) document.activeElement.blur(); // Close keyboard

    // 2. Clear existing panel if any
    const existingPanel = document.getElementById("loading-panel");
    if (existingPanel) existingPanel.remove();

    // 3. Create Panel
    const panel = document.createElement("div");
    panel.id = "loading-panel"; 
    panel.className = "loading-panel"; 
    
    // Content
    panel.innerHTML = `
        <img src="/img/travel-destination.gif" alt="Loading..." style="width: 72px; height: 72px;">
        <div class="loading-text">
            <h2 id="loading-message">Analyzing your request...</h2>
            <p>Mira is preparing your trip plan, please wait!</p>
        </div>
    `;

    // 4. Place Panel (Priority: Above Result > Above Typing > Append)
    if (chatBox) {
        const targetResult = chatBox.querySelector(".survey-results"); 
        const typingIndicator = document.getElementById("typing-indicator"); 

        if (targetResult) {
            chatBox.insertBefore(panel, targetResult);
        } else if (typingIndicator) {
            chatBox.insertBefore(panel, typingIndicator);
        } else {
            chatBox.appendChild(panel);
        }
        panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // 5. Animation Loop
    if (window.loadingInterval) clearInterval(window.loadingInterval);

    const messages = [
        "Analyzing your request...",
        "Finding places...",
        "Exploring route options...",
        "Compiling your travel plan..."
    ];
    let current = 0;
    
    window.loadingInterval = setInterval(() => {
        const msgEl = document.getElementById('loading-message');
        if (!msgEl) return; 

        msgEl.style.opacity = 0.5;
        setTimeout(() => {
            current = (current + 1) % messages.length;
            if (msgEl) {
                msgEl.textContent = messages[current];
                msgEl.style.opacity = 1;
            }
        }, 300);
    }, 3000);
};

window.hideLoadingPanel = function() {
    // 1. UNLOCK SCREEN
    document.body.classList.remove('app-locked');

    // 2. Remove panel
    const panel = document.getElementById("loading-panel");
    if (panel) panel.remove();

    // 3. Stop animation
    if (window.loadingInterval) {
        clearInterval(window.loadingInterval);
        window.loadingInterval = null;
    }
};

/* ======================================================
   CHAT UI HELPERS
====================================================== */

window.showTypingIndicator = function() {
    const chatBox = document.getElementById("chat-box");
    let indicator = document.getElementById("typing-indicator");
    
    if (!indicator) {
        indicator = document.createElement("div");
        indicator.id = "typing-indicator";
        indicator.className = "typing-indicator";
        indicator.innerHTML = '<span></span><span></span><span></span>';
        if (chatBox) chatBox.appendChild(indicator);
    } else if (chatBox) {
        chatBox.appendChild(indicator); 
    }
    
    if (indicator) indicator.style.display = "block";
    if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
};

window.hideTypingIndicator = function() {
    const typingIndicator = document.getElementById("typing-indicator");
    if (typingIndicator) typingIndicator.style.display = "none";
};

function addCanonicalMessage(canonicalStr) {
  const chatBox = document.getElementById("chat-box");
  if (!chatBox) return;
  const msg = document.createElement("div");
  msg.className = "message canonical-message";
  msg.innerHTML = `<img src="/img/profile-icon.svg" alt="Profile" class="profile-img">
  <span>${canonicalStr}</span>`;
  
  const typingIndicator = chatBox.querySelector('#typing-indicator');
  if (typingIndicator && typingIndicator.nextSibling) {
    chatBox.insertBefore(msg, typingIndicator.nextSibling);
  } else {
    chatBox.appendChild(msg);
  }
}

function addWelcomeMessage() {
    if (!window.__welcomeShown) {
        addMessage("Let's get started.", "bot-message request-bot-message");
        window.__welcomeShown = true;
    }
}
    
function addMessage(text, className) {
    const chatBox = document.getElementById("chat-box");
    const messageElement = document.createElement("div");
    messageElement.className = "message " + className;

    let profileElem;
    if (className.includes("user-message")) {
        profileElem = document.createElement("div");
        profileElem.className = "profile-img"; 
        profileElem.textContent = "🧑";
    } else {
        profileElem = document.createElement("img");
        profileElem.src = "img/avatar_aiio.png";
        profileElem.className = "profile-img";
    }

    messageElement.appendChild(profileElem);
    const contentDiv = document.createElement("div");
    contentDiv.innerHTML = text;
    messageElement.appendChild(contentDiv);

    const typingIndicator = document.getElementById("typing-indicator");
    if (typingIndicator) {
        chatBox.insertBefore(messageElement, typingIndicator);
    } else {
        chatBox.appendChild(messageElement);
    }
    
   chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
}