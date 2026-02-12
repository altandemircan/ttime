// ======================================================
// my_places.js - SMART TITLES & ACCORDION
// ======================================================

window.favTrips = JSON.parse(localStorage.getItem('favTrips') || '[]');

function saveFavTrips() {
    localStorage.setItem('favTrips', JSON.stringify(window.favTrips));
}

// ------------------------------------------------------
// 1. CSS: Yumuşak renkler, 3 buton yan yana
// ------------------------------------------------------
(function addSafeStyles() {
    const styleId = 'mp-accordion-final';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        /* --- GRUP (AKORDİYON) --- */
        .mp-group {
            margin-bottom: 16px;
            background: #fff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: rgba(149, 157, 165, 0.08) 0px 4px 12px;
            transition: all 0.3s ease;
        }

        .mp-group:hover {
            border-color: #e2e8f0;
        }

        /* Başlık Kısmı */
        .mp-group-header {
            padding: 14px 16px;
            background: #fafafc;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            user-select: none;
            border-bottom: 1px solid #f0f2f5;
            font-family: 'Satoshi', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        
        .mp-group-header:hover { 
            background: #f5f7fa; 
        }

        /* Başlık Yazısı */
        .mp-group-title {
            font-size: 0.95rem; 
            font-weight: 600; 
            color: #4a5568;
            display: flex; 
            align-items: center; 
            gap: 10px;
        }
        
        /* Sayı Rozeti */
        .mp-badge {
            font-size: 0.8rem;
            font-weight: 600;
            color: #718096;
            background: #ffffff;
            padding: 0px 6px;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
        }

        /* Ok İkonu */
        .mp-arrow {
            font-size: 0.9rem; 
            color: #a0aec0;
            transition: transform 0.3s ease;
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .mp-group.open .mp-arrow { 
            transform: rotate(180deg); 
        }
        
        /* İçerik Alanı (Animasyonlu) */
        .mp-content {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.4s ease-out;
            background: #fff;
        }
        
        .mp-group.open .mp-content {
            max-height: 3000px;
            transition: max-height 0.5s ease-in;
        }

        .mp-list-wrap { 
            padding: 12px 0; 
            display: flex; 
            flex-direction: column; 
            gap: 12px; 
            box-shadow: rgba(149, 157, 165, 0.2) 0px 8px 24px;
        }

        /* --- KART YAPISI --- */
        .mp-card {
            position: relative;
            background: #fff;
            overflow: hidden;
            box-shadow: rgba(149, 157, 165, 0.2) 0px 8px 24px;
            transition: background-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
            border-radius: 12px;
        }

        .mp-card:hover {
            box-shadow: rgba(149, 157, 165, 0.1) 0px 4px 12px;
            border-color: #d0d7e2;
        }

        /* Kart Üst Kısmı */
        .mp-card-head {
            display: flex; 
            padding: 12px; 
            gap: 12px; 
            align-items: flex-start;
            position: relative;
            background: #fff;
        }
        
        /* Favori butonu - SAĞ ÜSTTE */
        .mp-card-head .mp-fav-btn {
            position: absolute;
            top: 8px;
            right: 8px;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.95);
            border: 1px solid #e2e8f0;
            transition: all 0.2s ease;
            box-shadow: 0 2px 4px rgba(0,0,0,0.08);
            z-index: 10;
        }
        
        .mp-card-head .mp-fav-btn:hover {
            background: #fff;
            border-color: #cbd5e0;
            box-shadow: 0 4px 8px rgba(0,0,0,0.12);
            transform: scale(1.05);
        }
        
        .mp-card-head .mp-fav-btn img {
            width: 18px;
            height: 18px;
        }
        
        /* Resim kutusu */
        .mp-img-box {
            width: 56px; 
            height: 40px; 
            flex-shrink: 0; 
            border-radius: 8px; 
            overflow: hidden; 
            background: #f7f9fc;
            border: 1px solid #edf2f7;
        }
        
        .mp-img { 
            width: 100%; 
            height: 100%; 
            object-fit: cover; 
        }
        
        .mp-info { 
            flex: 1; 
            min-width: 0; 
            display: flex; 
            flex-direction: column; 
            gap: 6px;
            padding-right: 40px; /* Fav butonu için boşluk */
        }
        
        .mp-name { 
            font-size: 0.95rem; 
            font-weight: 600; 
            color: #2d3748; 
            line-height: 1.4;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }
        
        /* Kategori etiketi */
        .mp-cats {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: #f8fafc;
            color: #4a5568;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 0.8rem;
            font-weight: 500;
            border: 1px solid #e2e8f0;
            width: fit-content;
        }
        
        .mp-cats img {
            width: 14px;
            height: 14px;
            opacity: 0.7;
        }

        /* Alt Butonlar - 3 BUTON YAN YANA */
        .mp-acts { 
            display: flex;
            background: #fafcfd;
            border-radius: 0 0 10px 10px;
            overflow: hidden;
            border-top: 1px solid #edf2f7;
            padding: 10px;
            gap: 8px;
            flex-direction: row;
            align-items: stretch;
           
        }
        
        .mp-btn {
            flex: 1;
            display: flex;
            gap: 6px;
            transition: all 0.3s ease;
            
            padding: 10px 6px;
            font-weight: 600;
            align-items: center;
            justify-content: center;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            box-shadow: rgba(149, 157, 165, 0.15) 0px 2px 8px;
            font-family: 'Satoshi';
            white-space: nowrap;
        }
        
        /* Start New - KOYU MAVİ */
        .mp-btn-start { 
            background: #fff;
            border: 1px solid #ddd;
            color: #1e293b;
        }
        
        .mp-btn-start:hover { 
            box-shadow: 0 2px 10px rgba(69, 170, 232, 0.3);
        }
        
        /* Set Destination - YEŞİL */
        .mp-btn-dest {
            background: #fff;
            border: 1px solid #ddd;
            color: #059669;
        }
        
        .mp-btn-dest:hover {
            box-shadow: 0 2px 10px rgba(16, 185, 129, 0.3);
        }
        
        /* Add to Trip - MOR */
        .mp-btn-add { 
            background: #fff;
            border: 1px solid #ddd;
            color: #9462dd;
        }
        
        .mp-btn-add:hover { 
            box-shadow: 0 2px 10px rgba(164, 117, 241, 0.3);
        }
        
        /* DİSABLED DURUM */
        .mp-btn-dis { 
            background: #e8eaed !important; 
            color: #999999 !important; 
            cursor: not-allowed;
            box-shadow: none !important;
            border: none;
        }

        .mp-hint-ok { 
            font-size: 0.75rem; 
            color: #48bb78;
            margin-left: 4px;
            font-weight: 500;
        }
        
        .mp-hint-no { 
            font-size: 0.75rem; 
            color: #f56565; 
            margin-left: 4px;
            font-weight: 500;
        }

        .mp-meta-row {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
            margin-top: 4px;
        }

        .mp-distance-info {
            margin-top: 0 !important;
            font-size: 0.75rem !important;
        }

        /* MODAL */
        .mp-overlay {
            position: fixed; 
            top: 0; 
            left: 0; 
            width: 100%; 
            height: 100%;
            background: rgba(0,0,0,0.4); 
            z-index: 10000;
            display: none; 
            align-items: center; 
            justify-content: center;
            backdrop-filter: blur(2px);
        }
        
        .mp-modal {
            background: #fff; 
            width: 280px; 
            padding: 24px;
            border-radius: 12px; 
            box-shadow: 0 8px 24px rgba(0,0,0,0.1); 
            text-align: center;
            font-family: 'Satoshi', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        
        .mp-days { 
            display: flex; 
            flex-direction: column; 
            gap: 8px; 
            margin-top: 20px; 
            max-height: 250px; 
            overflow-y: auto; 
        }
        
        .mp-day-row {
            background: #f8fafc; 
            border: 1px solid #e2e8f0; 
            padding: 12px;
            border-radius: 8px; 
            cursor: pointer; 
            text-align: left; 
            transition: 0.2s; 
            font-size: 0.9rem;
            font-weight: 500;
            color: #4a5568;
        }
        
        .mp-day-row:hover { 
            background: #edf2f7; 
            border-color: #cbd5e0; 
        }
    `;
    document.head.appendChild(style);
})();

// ------------------------------------------------------
// 2. MANTIK FONKSİYONLARI
// ------------------------------------------------------

// "Unknown Country" sorununu çözen fonksiyon
function getCleanLocationName(place) {
    let city = place.city;
    let country = place.country;

    if (!city && place.address) {
        const parts = place.address.split(',').map(s => s.trim());
        
        if (parts.length > 0) {
            const last = parts[parts.length - 1];
            if (!/\d/.test(last)) {
                country = last;
            }
        }
        
        if (parts.length > 1) {
            const secondLast = parts[parts.length - 2];
            city = secondLast.replace(/[0-9]/g, '').trim();
        } else {
            city = parts[0];
        }
    }

    if (city && city.toLowerCase().includes('unknown')) city = "";
    if (country && country.toLowerCase().includes('unknown')) country = "";

    if (city && country && city !== country) {
        return `${city}, ${country}`;
    } else if (city) {
        return city;
    } else if (country) {
        return country;
    } else {
        return "Saved Places";
    }
}

// Gruplama
function groupFavoritesClean(list) {
    const groups = {};
    list.forEach(item => {
        const key = getCleanLocationName(item);
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });
    return groups;
}


window.startNewTripWithPlace = function (place) {
    if (!confirm("Your current trip plan will be cleared and a new trip will be started with this place. Do you want to continue?")) {
        return;
    }

    // === 1. RESET (mevcut sistemle uyumlu) ===
    if (window.cart && window.cart.length > 0 && typeof saveCurrentTripToStorage === "function") {
        saveCurrentTripToStorage();
    }

    window.cart = [];
    window.latestTripPlan = [];
    window.activeTripKey = `trip_${Date.now()}`;
    window.selectedCity = place.city || place._groupKey || "";

    localStorage.setItem('activeTripKey', window.activeTripKey);
    localStorage.setItem('selectedCity', window.selectedCity);

    window.lastUserQuery = "";
    window.directionsPolylines = {};
    window.routeElevStatsByDay = {};

    // === 2. İLK ITEM (DEĞİŞMEDİ) ===
    const newItem = {
        name: place.name,
        title: place.name,
        image: place.image || 'img/placeholder.png',
        day: 1,
        dailyIndex: 1,
        category: place.category,
        address: place.address || "",
        location: {
            lat: Number(place.lat),
            lng: Number(place.lon)
        },
        lat: Number(place.lat),
        lon: Number(place.lon),
        website: place.website || "",
        note: ""
    };

    window.cart.push(newItem);
    localStorage.setItem('cart', JSON.stringify(window.cart));

    // === 3. UI GÜNCELLE (mevcut sistem) ===
    if (typeof updateCart === "function") updateCart();

    const tripTitleDiv = document.getElementById('trip_title');
    if (tripTitleDiv) {
        tripTitleDiv.textContent = `${window.selectedCity || "Trip"} Trip Plan`;
    }

    // === 4. AI BİLGİSİ (ESKİ DAVRANIŞ GERİ) ===
    // Şehir AI bilgisi otomatik gelir
    if (typeof insertTripAiInfo === "function" && window.selectedCity) {
        insertTripAiInfo(false, null, window.selectedCity);
    }

    // === 5. PANEL GEÇİŞLERİ (ESKİ HALİYLE) ===
    const favSidebar = document.getElementById('sidebar-overlay-favorite-places');
    if (favSidebar && favSidebar.classList.contains('open')) {
        if (typeof window.toggleSidebar === "function") {
            window.toggleSidebar('sidebar-overlay-favorite-places');
        } else {
            favSidebar.classList.remove('open');
        }
    }

    const tripSidebar = document.getElementById('sidebar-overlay-trip');
    if (tripSidebar && !tripSidebar.classList.contains('open')) {
        if (typeof window.toggleSidebarTrip === "function") {
            window.toggleSidebarTrip();
        } else {
            tripSidebar.classList.add('open');
        }
    }

    // === 6. DAY 1 AÇ (mevcut özellik) ===
    if (typeof window.showDay === "function") {
        window.showDay(1);
    }
};

// YENİ FONKSİYON: Set Destination (Rota/Yay çizimi)
window.setDestinationFromPlace = function(place) {
    console.log("Set Destination clicked for:", place.name);
    
    // Kullanıcının mevcut konumunu al
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;
            const destLat = Number(place.lat);
            const destLng = Number(place.lon);

            // Harita varsa yay/rota çiz
            const currentMap = window.leafletMaps?.[1] || window._maplibre3DInstance;
            
            if (currentMap) {
                // Türkiye kontrolü (basit koordinat bazlı)
                const isTurkey = (userLat >= 36 && userLat <= 42 && userLng >= 26 && userLng <= 45) &&
                                 (destLat >= 36 && destLat <= 42 && destLng >= 26 && destLng <= 45);

                if (isTurkey) {
                    // Türkiye içi - Gerçek rota çiz
                    console.log("Drawing route in Turkey");
                    if (typeof drawRouteOnMap === "function") {
                        drawRouteOnMap(currentMap, userLat, userLng, destLat, destLng, place.name);
                    }
                } else {
                    // Global - Yay çiz
                    console.log("Drawing arc globally");
                    if (typeof drawArcOnMap === "function") {
                        drawArcOnMap(currentMap, userLat, userLng, destLat, destLng, place.name);
                    }
                }
                
                // Haritayı göster
                const tripSidebar = document.getElementById('sidebar-overlay-trip');
                if (tripSidebar?.classList.contains('open')) {
                    if (typeof window.toggleSidebarTrip === "function") {
                        window.toggleSidebarTrip();
                    }
                }
            } else {
                alert("Map is not available. Please open the trip planner.");
            }
        },
        (error) => {
            console.error("Geolocation error:", error);
            alert("Unable to get your location. Please enable location services.");
        }
    );
};

// Mesafe Kontrol
function checkDist(lat, lon) {
    if (!window.cart || window.cart.length === 0) return { ok: true, msg: "" };
    const valid = window.cart.filter(i => i.location && i.location.lat && i._type !== 'placeholder');
    if (valid.length === 0) return { ok: true, msg: "" };
    
    const last = valid[valid.length - 1];
    if (typeof haversine !== 'function') return { ok: true, msg: "" };

    const m = haversine(Number(last.location.lat), Number(last.location.lng), Number(lat), Number(lon));
    const km = (m / 1000).toFixed(0);
    
    if (m > 600000) return { ok: false, msg: `${km}km (Too far)` };
    return { ok: true, msg: `${km}km away` };
}

// Modal Toggle
function openDayModal(callback) {
    let max = 1;
    if (window.cart && window.cart.length > 0) {
        max = Math.max(...window.cart.map(i => i.dailyIndex || 1));
    }
    if (max <= 1) { callback(1); return; }

    let el = document.getElementById('mp-modal-ov');
    if (!el) {
        el = document.createElement('div');
        el.id = 'mp-modal-ov';
        el.className = 'mp-overlay';
        el.innerHTML = `
            <div class="mp-modal">
                <h3 style="margin:0; font-size:16px; font-weight:600; color:#2d3748; margin-bottom:20px;">Add to which day?</h3>
                <div class="mp-days" id="mp-days-list"></div>
                <button onclick="document.getElementById('mp-modal-ov').style.display='none'" 
                    style="margin-top:20px; border:none; background:#f7fafc; color:#718096; cursor:pointer; font-size:0.9rem; padding:8px 16px; border-radius:8px; transition:0.2s;" 
                    onmouseover="this.style.background='#edf2f7'" 
                    onmouseout="this.style.background='#f7fafc'">
                    Cancel
                </button>
            </div>`;
        document.body.appendChild(el);
    }
    const list = document.getElementById('mp-days-list');
    list.innerHTML = '';
    for (let i = 1; i <= max; i++) {
        const d = document.createElement('div');
        d.className = 'mp-day-row';
        d.innerHTML = `📅 <b>Day ${i}</b>`;
        d.onclick = () => {
            document.getElementById('mp-modal-ov').style.display = 'none';
            callback(i);
        };
        list.appendChild(d);
    }
    el.style.display = 'flex';
}

// Akordiyon Tıklama İşleyicisi
window.toggleMpGroup = function(header) {
    const parent = header.parentElement;
    parent.classList.toggle('open');
};

// Kategori ikonunu getiren fonksiyon
function getPlaceCategoryIcon(category) {
    const iconMap = {
        "Coffee": "img/coffee_icon.svg",
        "Breakfast": "img/coffee_icon.svg",
        "Cafes": "img/coffee_icon.svg",        
        "Museum": "img/museum_icon.svg",        
        "Touristic attraction": "img/touristic_icon.svg",        
        "Restaurant": "img/restaurant_icon.svg",
        "Lunch": "img/restaurant_icon.svg",
        "Dinner": "img/restaurant_icon.svg",        
        "Accommodation": "img/accommodation_icon.svg",
        "Hotel": "img/accommodation_icon.svg",        
        "Parks": "img/park_icon.svg",

        // -- Yeni Eklenen Kategoriler --
        "Bar": "img/bar_icon.svg",
        "Pub": "img/pub_icon.svg",
        "Fast Food": "img/fastfood_icon.svg",
        "Supermarket": "img/supermarket_icon.svg",
        "Pharmacy": "img/pharmacy_icon.svg",
        "Hospital": "img/hospital_icon.svg",
        "Bookstore": "img/bookstore_icon.svg",
        "Post Office": "img/postoffice_icon.svg",
        "Library": "img/library_icon.svg",
        "Hostel": "img/hostel_icon.svg",
        "Cinema": "img/cinema_icon.svg",
        "Jewelry Shop": "img/jewelry_icon.svg",
        "University": "img/university_icon.svg",
        "Religion": "img/religion_icon.svg"
    };
    return iconMap[category] || '/img/location.svg';
}

// ------------------------------------------------------
// 3. RENDER - 3 buton: Start New, Set Destination, Add to Trip
// ------------------------------------------------------
async function renderFavoritePlacesPanel() {
    const panel = document.getElementById("favorite-places-panel");
    if (!panel) return;
    panel.innerHTML = "";

    const list = window.favTrips || [];
    if (list.length === 0) {
        panel.innerHTML = `<div style="text-align:center;padding:30px;color:#a0aec0;font-size:0.9rem;background:#f8fafc;border-radius:10px;margin:20px 0;border:1px dashed #e2e8f0;">No saved places yet.</div>`;
        return;
    }

    const groups = groupFavoritesClean(list);

    Object.entries(groups).forEach(([key, items], idx) => {
        const group = document.createElement("div");
        group.className = "mp-group";
        if (idx === 0) group.classList.add('open');

        const head = document.createElement("div");
        head.className = "mp-group-header";
        head.onclick = function() { toggleMpGroup(this); };
        head.innerHTML = `
            <div class="mp-group-title">
                ${key} <span class="mp-badge">${items.length}</span>
            </div>
            <div class="mp-arrow">▼</div>
        `;

        const content = document.createElement("div");
        content.className = "mp-content";
        const wrapper = document.createElement("div");
        wrapper.className = "mp-list-wrap";

        items.forEach((place, placeIndex) => {
            // Şehir adını place'e ekle
            place._groupKey = key;
            
            const st = checkDist(place.lat, place.lon);
            const isFav = isTripFav(place);
            
            const distColor = st.ok ? '#48bb78' : '#f56565'; 

            const card = document.createElement("div");
            card.className = "mp-card";
            
            // Kart üst kısmı
            card.innerHTML = `
    <div class="mp-card-head">
        <div class="mp-img-box">
            <img src="${place.image || 'img/placeholder.png'}" class="mp-img" onerror="this.src='img/default_place.jpg'">
        </div>
        <div class="mp-info">
            <div class="mp-name" title="${place.name}">${place.name}</div>
            
            <div class="mp-meta-row">
                <div class="mp-cats">
                    <img src="${getPlaceCategoryIcon(place.category)}" alt="${place.category}">
                    ${place.category || 'Place'}
                </div>
                ${st.msg ? `<div class="mp-distance-info" style="color:${distColor};">📍 ${st.msg}</div>` : ''}
            </div>
            
        </div>
        
        <!-- FAV BUTONU SAĞ ÜSTTE -->
        <button class="mp-fav-btn">
            <img class="fav-icon" src="${isFav ? 'img/like_on.svg' : 'img/like_off.svg'}" alt="${isFav ? 'Remove from fav' : 'Add to fav'}">
        </button>
    </div>
`;
            
            // Alt butonlar container
            const acts = document.createElement("div");
            acts.className = "mp-acts";

            // 1. Start New
            const b1 = document.createElement("button");
            b1.className = "mp-btn mp-btn-start";
            b1.innerHTML = `Start New`;
            b1.onclick = () => startNewTripWithPlace(place);

            // 2. Set Destination
            const b2 = document.createElement("button");
            b2.className = "mp-btn mp-btn-dest";
            b2.innerHTML = `Set Destination`;
            b2.onclick = () => setDestinationFromPlace(place);

            // 3. Add to Trip
            const b3 = document.createElement("button");
            b3.className = st.ok ? "mp-btn mp-btn-add" : "mp-btn mp-btn-dis";
            
            if (st.ok) {
                b3.innerHTML = `Add to Trip`;
                b3.onclick = function(e) {
                    if (e) {
                        e.preventDefault();
                        e.stopPropagation();
                    }

                    openDayModal((selectedDay) => {
                        if (typeof addToCart === "function") {
                            
                            if (!window.activeTripKey) {
                                window.activeTripKey = `trip_${Date.now()}`;
                                if (window.selectedCity) {
                                    window.activeTripKey = `${window.selectedCity.replace(/\s+/g, '_')}_${Date.now()}`;
                                }
                            }

                            addToCart(
                                place.name, 
                                place.image, 
                                selectedDay, 
                                place.category,
                                place.address || "", 
                                null, 
                                null, 
                                place.opening_hours || "", 
                                null,
                                { lat: Number(place.lat), lng: Number(place.lon) }, 
                                place.website || ""
                            );

                            console.log("Forcing storage save for 'cart'...");
                            localStorage.setItem('cart', JSON.stringify(window.cart));
                            
                            if (window.activeTripKey) localStorage.setItem('activeTripKey', window.activeTripKey);
                            if (window.selectedCity) localStorage.setItem('selectedCity', window.selectedCity);

                            if (typeof saveCurrentTripToStorage === "function") {
                                saveCurrentTripToStorage({ withThumbnail: false, delayMs: 0 });
                            }

                            renderFavoritePlacesPanel();
                            
                            const favSidebar = document.getElementById('sidebar-overlay-favorite-places');
                            if (favSidebar && favSidebar.classList.contains('open')) {
                                if (typeof window.toggleSidebar === 'function') {
                                    window.toggleSidebar('sidebar-overlay-favorite-places');
                                } else {
                                    favSidebar.classList.remove('open');
                                }
                            }
                            
                            setTimeout(() => {
                                const tripSidebar = document.getElementById('sidebar-overlay-trip');
                                if (tripSidebar) {
                                    if (typeof window.toggleSidebarTrip === 'function') {
                                        if (!tripSidebar.classList.contains('open')) {
                                            window.toggleSidebarTrip();
                                        }
                                    } else {
                                        tripSidebar.classList.add('open');
                                    }
                                }
                            }, 100);
                        }
                    });
                };
            } else {
                b3.innerHTML = `Add to Trip`;
                b3.title = "Too far";
            }

            // Butonları ekle
            acts.appendChild(b1);
            acts.appendChild(b2);
            acts.appendChild(b3);

            // Favori butonuna event listener ekle
            const favBtn = card.querySelector('.mp-fav-btn');
            if (favBtn) {
                favBtn.onclick = (e) => {
                    e.stopPropagation();
                    const favIdx = window.favTrips.findIndex(f => 
                        f.name === place.name && 
                        String(f.lat) === String(place.lat)
                    );
                    if (favIdx > -1) {
                        window.favTrips.splice(favIdx, 1);
                        saveFavTrips();
                        renderFavoritePlacesPanel();
                        if(typeof updateAllFavVisuals === 'function') updateAllFavVisuals();
                    }
                };
            }

            card.appendChild(acts);
            wrapper.appendChild(card);
        });

        content.appendChild(wrapper);
        group.appendChild(head);
        group.appendChild(content);
        panel.appendChild(group);
    });
}

// Helper function to check if a place is in favorites
function isTripFav(item) {
    return window.favTrips.some(f => 
        f.name === item.name && 
        String(f.lat) === String(item.lat || item.location?.lat)
    );
}

// toggleFavFromCart fonksiyonu - gezi listesinden fav ekle/çıkar
function toggleFavFromCart(btn) {
    const name = btn.getAttribute('data-name');
    const category = btn.getAttribute('data-category');
    const lat = btn.getAttribute('data-lat');
    const lon = btn.getAttribute('data-lon');
    const image = btn.getAttribute('data-image');
    const address = btn.getAttribute('data-address') || '';
    const website = btn.getAttribute('data-website') || '';
    const opening_hours = btn.getAttribute('data-opening_hours') || '';

    const place = {
        name, category, lat: parseFloat(lat), lon: parseFloat(lon), image, address, website, opening_hours,
        city: window.selectedCity || '',
        country: (window.selectedLocation && window.selectedLocation.country) || ''
    };

    if (!window.favTrips) window.favTrips = [];

    const idx = window.favTrips.findIndex(f => 
        f.name === place.name && String(f.lat) === String(place.lat)
    );

    if (idx > -1) {
        window.favTrips.splice(idx, 1);
        btn.classList.remove('fav-active');
        btn.querySelector('.fav-icon').src = 'img/like_off.svg';
    } else {
        window.favTrips.push(place);
        btn.classList.add('fav-active');
        btn.querySelector('.fav-icon').src = 'img/like_on.svg';
    }

    localStorage.setItem('favTrips', JSON.stringify(window.favTrips));
    
    if (typeof updateAllFavVisuals === 'function') {
        updateAllFavVisuals();
    }
    if (typeof renderFavoritePlacesPanel === 'function') {
        renderFavoritePlacesPanel();
    }
}