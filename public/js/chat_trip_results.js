// 2️⃣  generateStepHtml() - DROPDOWN VE BUTON BİRLEŞİK TASARIM
function generateStepHtml(step, day, category, idx = 0) {
    const name = getDisplayName(step) || category;
    const localName = getLocalName(step);
    const address = step?.address || "";
    const image = step?.image || "https://www.svgrepo.com/show/522166/location.svg";
    const website = step?.website || "";
    const opening = step?.opening_hours || "";
    const lat = step?.lat || (step?.location?.lat || step?.location?.latitude);
    const lon = step?.lon || (step?.location?.lon || step?.location?.lng || step?.location?.longitude);

    let tagsHtml = "";
    const tags = (step.properties && step.properties.categories) || step.categories;
    if (tags && Array.isArray(tags) && tags.length > 0) {
        const uniqueTags = getUniqueSpecificTags(tags);
        tagsHtml = uniqueTags.map(t => `<span class="geo-tag" title="${t.tag}">${t.label}</span>`).join(' ');
    }

    let catIcon = "https://www.svgrepo.com/show/522166/location.svg";
    if (category === "Coffee" || category === "Breakfast" || category === "Cafes")
        catIcon = "/img/coffee_icon.svg";
    else if (category === "Museum")
        catIcon = "/img/museum_icon.svg";
    else if (category === "Touristic attraction")
        catIcon = "/img/touristic_icon.svg";
    else if (category === "Restaurant" || category === "Lunch" || category === "Dinner")
        catIcon = "/img/restaurant_icon.svg";
    else if (category === "Accommodation")
        catIcon = "/img/accommodation_icon.svg";
    else if (category === "Parks")
        catIcon = "/img/park_icon.svg";

    const isFav = (typeof isTripFav === 'function') 
        ? isTripFav({ name, category, lat, lon }) 
        : false;
    const favIconSrc = isFav ? "/img/like_on.svg" : "/img/like_off.svg";

    // === GÜN SEÇİMİ DÜZELTMESİ ===
    // 1. Gelen 'day' parametresini kesinlikle sayıya çevir
    const targetDay = parseInt(day, 10) || 1;

    // 2. Toplam gün sayısını hem Plan'dan hem Cart'tan kontrol et (Manuel eklenen günler için)
    let maxDay = 1;
    if (window.cart && window.cart.length > 0) {
        maxDay = Math.max(...window.cart.map(i => i.day || 1));
    }
    if (window.latestTripPlan && window.latestTripPlan.length > 0) {
        const maxPlan = Math.max(...window.latestTripPlan.map(i => i.day || 1));
        if (maxPlan > maxDay) maxDay = maxPlan;
    }
    // Dropdown en az hedef gün kadar olmalı
    const daysCount = Math.max(maxDay, targetDay);

    let dayOptionsHtml = '';
    for (let d = 1; d <= daysCount; d++) {
        // Burada her ikisi de number olduğu için karşılaştırma doğru çalışır
        const selected = d === targetDay ? 'selected' : '';
        dayOptionsHtml += `<option value="${d}" ${selected}>Day ${d}</option>`;
    }

    // JSON verisini güvenli sakla
    const stepJson = encodeURIComponent(JSON.stringify(step));

    return `
    <div class="steps" data-day="${targetDay}" data-category="${category}" data-lat="${lat}" data-lon="${lon}" 
         data-step="${stepJson}">
        <div class="visual">
            <img class="check" src="${image}" alt="${name}" onerror="this.onerror=null; this.src='img/placeholder.png';">
            
            ${tagsHtml ? `
            <div class="geoapify-tags-section">
                <div class="geoapify-tags">${tagsHtml}</div>
            </div>` : ''}

            <div class="cats cats1">
                <img src="${catIcon}" alt="${category}"> ${category}
            </div>
            
            <span class="fav-heart" 
                  data-name="${name}" 
                  data-category="${category}" 
                  data-lat="${lat}" 
                  data-lon="${lon}" 
                  data-image="${image}">
                <img class="fav-icon" src="${favIconSrc}" alt="Favorite">
            </span>

            <span class="info-icon-wrapper">
                <img src="https://www.svgrepo.com/show/474873/info.svg" alt="Info">                
                <div class="info-tooltip">
                    Photos associated with this place are matched by analyzing search results and may not reflect reality.
                    <div style="position: absolute; top: -6px; right: 10px; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 6px solid #333;"></div>
                </div>
            </span>
            <style>
                .info-icon-wrapper:hover .info-tooltip { display: block !important; }
            </style>
        </div>

        <div class="info day_cats item-info-view">
   
            <div class="title" title="${name}">
                ${name}
                ${website ? `<a href="${website}" target="_blank" style="display: inline-block; margin-left: 6px; vertical-align: middle;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #8a4af3;">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                        <path d="M2 12h20"></path>
                    </svg>
                </a>` : ''}
            </div>
            
            <div class="address">
                <img src="img/address_icon.svg">
                <span title="${address || 'Address not found'}">
                    ${address || 'Address not found'}
                </span>
            </div>

            <div class="opening_hours">
                <img src="img/hours_icon.svg">
                <span title="${opening || 'Working hours not found.'}">
                    ${opening || 'Working hours not found.'}
                </span>
            </div>
        </div>

        <div class="item_action">
            <div class="change">
    <span onclick="window.showImage && window.showImage(this)" class="active">
        <img src="img/camera_icon.svg">
    </span>
    <span onclick="window.showMap && window.showMap(this)">
        <img src="img/map_icon.svg">
    </span>
</div>
            
            <div class="trip-action-group">
                <select class="day-select-dropdown-premium">
                    ${dayOptionsHtml}
                </select>
                
                <button class="action-btn btn-add addtotrip-toggle">
                    <span>Add</span>
                    <img src="img/addtotrip-icon.svg" style="width:14px; height:14px;">
                </button>
            </div>
        </div>
    </div>`;
}

// 4️⃣  DROPDOWN VE BUTON GRUBU CSS'İ
function injectDropdownStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* === BÜTÜNLEŞİK AKSİYON GRUBU === */
        .trip-action-group {
            display: inline-flex;
            align-items: center;
            background: #fff;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            transition: all 0.3s ease;
            margin-left: auto;
        }

        .trip-action-group:hover {
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            border-color: #d0d0d0;
        }

        /* Dropdown Stili */
        .trip-action-group select {
            appearance: none;
            -webkit-appearance: none;
            border: none;
            background-color: transparent;
            padding: 8px 6px 8px 12px;
            font-size: 0.9rem;
            font-weight: 600;
            color: #333;
            cursor: pointer;
            outline: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23333' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 0px center;
            padding-right: 16px;
            margin-right: 4px;
            font-family: inherit;
        }

        .trip-action-group select:hover {
            background-color: #f9f9f9;
        }

        /* Buton Stili (Temel) */
        .trip-action-group .action-btn {
            border: none;
            padding: 8px 10px;
            font-size: 0.85rem;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s;
            outline: none;
            height: 100%;
            font-family: inherit;
        }

        /* --- ADD MODU (MOR TASARIM) --- */
        .trip-action-group .action-btn.btn-add {
            background-color: #8a4af3;
            color: #ffffff;
            border-left: 1px solid rgba(255,255,255,0.2);
        }
        
        .trip-action-group .action-btn.btn-add:hover {
            background-color: #7b42db;
        }

        /* İkonu Beyaz Yapmak İçin Filtre */
        .trip-action-group .action-btn.btn-add img {
            filter: brightness(0) invert(1);
        margin-right:0px;
        }

        /* --- REMOVE MODU (Kırmızı Tasarım) --- */
        .trip-action-group .action-btn.btn-remove {
            background-color: #fff1f0;
            color: #dc3545;
            border-left: 1px solid #eee;
        }
        .trip-action-group .action-btn.btn-remove:hover {
            background-color: #ffe8e6;
        }

        /* === KAMERA/HARİTA İKON STİLLERİ === */
        .item_action .change {
            display: flex;
            gap: 8px;
        }

        .item_action .change span {
            cursor: pointer;
            padding: 6px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            background: #f5f5f5;
            border: 1px solid transparent;
        }

        .item_action .change span:hover {
            background: #e9e9e9;
            transform: translateY(-1px);
        }

        .item_action .change span.active {
            background: #8a4af3 !important;
            border-color: #8a4af3 !important;
        }

        .item_action .change span.active img {
            filter: brightness(0) invert(1) !important;
        }

        .item_action .change img {
            width: 20px;
            height: 20px;
            transition: filter 0.2s;
        }

        @media (prefers-color-scheme: dark) {
            .trip-action-group {
                background: #2a2a2a;
                border-color: #444;
            }
            .trip-action-group select {
                color: #e0e0e0;
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23e0e0e0' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
            }
            .trip-action-group .action-btn.btn-add {
                background-color: #8a4af3; 
                color: white;
            }
            .trip-action-group .action-btn.btn-remove {
                background-color: #3e2a2a;
                color: #ef5350;
                border-left-color: #444;
            }
            
            .item_action .change span {
                background: #2a2a2a;
                border-color: #444;
            }
            .item_action .change span:hover {
                background: #333;
            }
            .item_action .change span.active {
                background: #8a4af3 !important;
                border-color: #8a4af3 !important;
            }
        }

        /* === HARİTA IFRAME STİLLERİ === */
        iframe.leaflet-mini-map {
            display: block !important;
            pointer-events: none !important;
            user-select: none !important;
            -webkit-user-select: none !important;
        }

        .leaflet-marker-icon {
            z-index: 9999 !important;
        }

        .steps .visual iframe {
            cursor: default !important;
        }
    `;
    document.head.appendChild(style);
}

// CSS'i Yükle
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectDropdownStyles);
} else {
    injectDropdownStyles();
}


// ==========================================================
// === LOGIC: BUTON YÖNETİMİ, EKLEME VE ÇIKARMA İŞLEMLERİ ===
// ==========================================================


// 1. Yardımcı: Item sepette var mı?
function isItemInCartForDay(lat, lon, name, day) {
    if (!window.cart) return false;
    return window.cart.some(item => {
        if (Number(item.day) !== Number(day)) return false;
        
        const iLat = item.lat || (item.location ? item.location.lat : null);
        const iLon = item.lon || (item.location ? (item.location.lng || item.location.lon) : null);

        if (lat && lon && iLat && iLon) {
            const dLat = Math.abs(iLat - lat);
            const dLng = Math.abs(iLon - lon);
            if (dLat < 0.0005 && dLng < 0.0005) return true;
        }
        if (name && item.name) {
            return name.toLowerCase().trim() === item.name.toLowerCase().trim();
        }
        return false;
    });
}

// 2. Yardımcı: Sepet Index'ini Bul
function findCartItemIndex(lat, lon, name, day) {
    if (!window.cart) return -1;
    return window.cart.findIndex(item => {
        if (Number(item.day) !== Number(day)) return false;
        
        const iLat = item.lat || (item.location ? item.location.lat : null);
        const iLon = item.lon || (item.location ? (item.location.lng || item.location.lon) : null);

        if (lat && lon && iLat && iLon) {
            const dLat = Math.abs(iLat - lat);
            const dLng = Math.abs(iLon - lon);
            if (dLat < 0.0005 && dLng < 0.0005) return true;
        }
        if (name && item.name) {
            return name.toLowerCase().trim() === item.name.toLowerCase().trim();
        }
        return false;
    });
}

// 3. UI Güncelleme (Tüm butonları tara ve güncelle)
function updateAllChatButtons() {
    const steps = document.querySelectorAll('.steps');
    steps.forEach(step => {
        const dropdown = step.querySelector('.day-select-dropdown-premium');
        const btn = step.querySelector('.addtotrip-toggle');
        
        if (!dropdown || !btn) return;

        const lat = parseFloat(step.getAttribute('data-lat'));
        const lon = parseFloat(step.getAttribute('data-lon'));
        const name = step.querySelector('.title')?.textContent.trim();
        const selectedDay = parseInt(dropdown.value);
        
        const isAdded = isItemInCartForDay(lat, lon, name, selectedDay);

        if (isAdded) {
    if (!btn.classList.contains('btn-remove')) {
        btn.className = 'action-btn btn-remove addtotrip-toggle';
        btn.innerHTML = `
            <span class="btn-text">Remove</span>
            <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>`;
    }
} else {
            // ADD MODUNA GEÇ
            if (!btn.classList.contains('btn-add')) {
                btn.className = 'action-btn btn-add addtotrip-toggle';
                btn.innerHTML = `<span>Add</span>
                    <img src="img/addtotrip-icon.svg" style="width:14px; height:14px;">`;
            }
        }
    });
}

// 4. Olay Dinleyicileri (Click ve Change)
document.addEventListener('click', function(e) {
    const btn = e.target.closest('.addtotrip-toggle');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const step = btn.closest('.steps');
    const dropdown = step.querySelector('.day-select-dropdown-premium');
    const day = parseInt(dropdown.value);
    
    // Verileri data attribute'tan al
    const lat = parseFloat(step.getAttribute('data-lat'));
    const lon = parseFloat(step.getAttribute('data-lon'));
    const name = step.querySelector('.title')?.textContent.trim();
    
    // BUTON "REMOVE" MODUNDA MI?
    if (btn.classList.contains('btn-remove')) {
        const index = findCartItemIndex(lat, lon, name, day);
        if (index > -1) {
            window.cart.splice(index, 1);
            localStorage.setItem('cart', JSON.stringify(window.cart));
            
            // Eğer updateCart varsa çağır
            if (typeof updateCart === 'function') updateCart();
            
            // UI'ı hemen güncelle
            updateAllChatButtons();
        }
    } 
    // BUTON "ADD" MODUNDA
    else {
        // Ham veriyi çözümle
        let stepData = {};
        try {
            stepData = JSON.parse(decodeURIComponent(step.getAttribute('data-step')));
        } catch (err) {
            console.error("Step data parse error", err);
            return;
        }

        // Sepet objesi oluştur
        const newItem = {
            id: Date.now(),
            name: stepData.name || name,
            address: stepData.address || step.querySelector('.address')?.textContent.trim(),
            image: stepData.image || step.querySelector('img.check')?.src,
            day: day,
            lat: lat,
            lon: lon,
            location: { lat: lat, lng: lon },
            // Varsa diğer detaylar
            category: step.getAttribute('data-category'),
            website: stepData.website,
            opening_hours: stepData.opening_hours
        };
        
        window.cart.push(newItem);
        localStorage.setItem('cart', JSON.stringify(window.cart));
        
        if (typeof updateCart === 'function') updateCart();
        updateAllChatButtons();
    }
});

// Dropdown değiştiğinde kontrol et
document.addEventListener('change', function(e) {
    if (e.target && e.target.classList.contains('day-select-dropdown-premium')) {
        updateAllChatButtons();
    }
});

// MutationObserver: Chat'e yeni mesaj geldiğinde
const observer = new MutationObserver(function(mutations) {
    updateAllChatButtons();
});

// İlk yüklemede çalıştır
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        updateAllChatButtons();
        const chatContainer = document.getElementById('chat-container') || document.body;
        observer.observe(chatContainer, { childList: true, subtree: true });
    });
} else {
    updateAllChatButtons();
    const chatContainer = document.getElementById('chat-container') || document.body;
    observer.observe(chatContainer, { childList: true, subtree: true });
}

window.showMap = function(element) {
    const stepsElement = element.closest('.steps');
    const visualDiv = stepsElement.querySelector('.visual');
    const image = visualDiv.querySelector('img.check');
    const changeContainer = stepsElement.querySelector('.item_action .change');
    
    // Diğer elementleri gizle
    stepsElement.querySelectorAll('.geoapify-tags-section').forEach(el => { el.style.display = 'none'; });
    stepsElement.querySelectorAll('.fav-heart').forEach(el => { el.style.display = 'none'; });
    stepsElement.querySelectorAll('.cats').forEach(el => { el.style.display = 'none'; });
    stepsElement.querySelectorAll('.info-icon-wrapper').forEach(el => { el.style.display = 'none'; });
    
    const lat = parseFloat(stepsElement.getAttribute('data-lat'));
    const lon = parseFloat(stepsElement.getAttribute('data-lon'));
    
    if (!isNaN(lat) && !isNaN(lon)) {
        // Eski iframe'i kaldır
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
        iframe.style.pointerEvents = "none";
        iframe.sandbox = "allow-scripts allow-same-origin";
        visualDiv.appendChild(iframe);
        
        // Aktif ikonları ayarla - SADECE HARİTA İKONU AKTİF
        if (changeContainer) {
            const mapIcon = changeContainer.querySelector('span:nth-child(2)'); // Harita ikonu
            const cameraIcon = changeContainer.querySelector('span:nth-child(1)'); // Kamera ikonu
            
            // Önce hepsini temizle
            if (cameraIcon) cameraIcon.classList.remove('active');
            if (mapIcon) mapIcon.classList.remove('active');
            
            // Sadece harita ikonunu aktif yap
            if (mapIcon) mapIcon.classList.add('active');
        }
    } else {
        alert("Location not found.");
    }
};

window.showImage = function(element) {
    const stepsElement = element.closest('.steps');
    const visualDiv = stepsElement.querySelector('.visual');
    const image = visualDiv.querySelector('img.check');
    const changeContainer = stepsElement.querySelector('.item_action .change');
    
    // Eski iframe'i kaldır
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
    stepsElement.querySelectorAll('.info-icon-wrapper').forEach(el => {
        el.style.display = '';
    });
    
    // Aktif ikonları ayarla - SADECE KAMERA İKONU AKTİF
    if (changeContainer) {
        const mapIcon = changeContainer.querySelector('span:nth-child(2)'); // Harita ikonu
        const cameraIcon = changeContainer.querySelector('span:nth-child(1)'); // Kamera ikonu
        
        // Önce hepsini temizle
        if (cameraIcon) cameraIcon.classList.remove('active');
        if (mapIcon) mapIcon.classList.remove('active');
        
        // Sadece kamera ikonunu aktif yap
        if (cameraIcon) cameraIcon.classList.add('active');
    }
};


// Sayfa yüklendiğinde sadece harita görünümünde olmayan step'lerde kamera ikonunu aktif yap
function activateDefaultCameraIcons() {
    document.querySelectorAll('.steps').forEach(step => {
        const changeContainer = step.querySelector('.item_action .change');
        const visualDiv = step.querySelector('.visual');
        const hasMapIframe = visualDiv.querySelector('iframe.leaflet-mini-map');
        
        if (changeContainer && !hasMapIframe) {
            const cameraIcon = changeContainer.querySelector('span:nth-child(1)');
            const mapIcon = changeContainer.querySelector('span:nth-child(2)');
            
            if (cameraIcon && mapIcon) {
                // Harita iframe'i yoksa kamera aktif olsun
                cameraIcon.classList.add('active');
                mapIcon.classList.remove('active');
            }
        }
    });
}
// CSS yüklendikten sonra çalıştır
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(activateDefaultCameraIcons, 100);
    });
} else {
    setTimeout(activateDefaultCameraIcons, 100);
}

const chatContainer = document.getElementById('chat-container') || document.body;
observer.observe(chatContainer, { 
    childList: true, 
    subtree: true
});



