// 2️⃣  generateStepHtml() - DROPDOWN ADD BUTONUNUN SOLUNDA
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

    // Gün seçeneklerini oluştur (Dropdown için)
    const daysCount = window.latestTripPlan 
        ? Math.max(...window.latestTripPlan.map(item => item.day || 1)) 
        : 1;
    let dayOptionsHtml = '';
    for (let d = 1; d <= daysCount; d++) {
        const selected = d === day ? 'selected' : '';
        // Tick mantığını tamamen kaldırdık
        dayOptionsHtml += `<option value="${d}" ${selected}>Day ${d}</option>`;
    }

    return `
    <div class="steps" data-day="${day}" data-category="${category}" data-lat="${lat}" data-lon="${lon}" 
         data-step="${encodeURIComponent(JSON.stringify(step))}">
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
   
            <div class="title" title="${name}">${name}</div>
            
      
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
                <span onclick="window.showImage && window.showImage(this)">
                    <img src="img/camera_icon.svg">
                </span>
                <span onclick="window.showMap && window.showMap(this)">
                    <img src="img/map_icon.svg">
                </span>
                ${website ? `
                <span onclick="window.open('${website}', '_blank')">
                    <img src="img/website_link.svg" title="${website}">
                </span>
                ` : ''}
            </div>
            
            <!-- 🆕 DROPDOWN + ADD BUTONU (Sağ tarafta yan yana) -->
            <div style="display: flex; align-items: center; gap: 6px;">
                <select class="day-select-dropdown-premium" 
                        style="padding: 7px 10px; border: 1.5px solid #e0e0e0; border-radius: 6px; font-size: 0.85rem; background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%); color: #333; cursor: pointer; font-weight: 500; transition: all 0.3s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.05); appearance: none; background-image: url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 12 12%27%3E%3Cpath fill=%27%23333%27 d=%27M6 9L1 4h10z%27/%3E%3C/svg%3E'); background-repeat: no-repeat; background-position: right 8px center; padding-right: 28px;">
                    ${dayOptionsHtml}
                </select>
                
                <a class="addtotrip"><span>Add</span>
                    <img src="img/addtotrip-icon.svg">
                </a>
            </div>
        </div>
    </div>`;
}
// 4️⃣  DROPDOWN CSS'İ OTOMATİK ENJEKTE ET
function injectDropdownStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .day-select-dropdown-premium {
            padding: 7px 10px !important;
            border: 1.5px solid #e0e0e0 !important;
            border-radius: 6px !important;
            font-size: 0.85rem !important;
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%) !important;
            color: #333 !important;
            cursor: pointer !important;
            font-weight: 500 !important;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05) !important;
            font-family: inherit !important;
            min-width: 80px !important;
        }

        .day-select-dropdown-premium:hover {
            border-color: #4CAF50 !important;
            background: linear-gradient(135deg, #f0f9ff 0%, #f0f7f4 100%) !important;
            box-shadow: 0 4px 12px rgba(76, 175, 80, 0.15) !important;
        }

        .day-select-dropdown-premium:focus {
            outline: none !important;
            border-color: #4CAF50 !important;
            box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1), 0 4px 12px rgba(76, 175, 80, 0.2) !important;
        }

        .day-select-dropdown-premium option:checked {
            background-color: #4CAF50 !important;
            color: white !important;
        }

        /* 🆕 STEPS ITEM - ADDED TO CART STATE */
        .steps.item-added {
            opacity: 0.6;
            filter: grayscale(50%);
            position: relative;
        }

        .steps.item-added .addtotrip {
            display: none !important;
        }

        .steps.item-added::before {
            content: "✓ Added";
            position: absolute;
            top: 8px;
            right: 8px;
            background: #4CAF50;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: bold;
            z-index: 10;
            box-shadow: 0 2px 4px rgba(76, 175, 80, 0.3);
        }

        .steps.item-added:hover {
            opacity: 0.75;
        }

        @media (max-width: 768px) {
            .day-select-dropdown-premium {
                font-size: 0.8rem !important;
                padding: 6px 8px !important;
                min-width: 70px !important;
            }

            .steps.item-added::before {
                font-size: 0.7rem;
                padding: 3px 6px;
                top: 4px;
                right: 4px;
            }
        }

        @media (prefers-color-scheme: dark) {
            .day-select-dropdown-premium {
                background: linear-gradient(135deg, #2a2a2a 0%, #262626 100%) !important;
                color: #e0e0e0 !important;
                border-color: #444 !important;
            }

            .day-select-dropdown-premium:hover {
                border-color: #66BB6A !important;
                background: linear-gradient(135deg, #1b5e20 0%, #1e3a1f 100%) !important;
            }

            .steps.item-added::before {
                background: #66BB6A;
                box-shadow: 0 2px 4px rgba(102, 187, 106, 0.3);
            }
        }
    `;
    document.head.appendChild(style);
}

// Sayfa yüklendiğinde CSS'i enjekte et
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectDropdownStyles);
} else {
    injectDropdownStyles();
}

// Sayfa yüklendiğinde CSS'i enjekte et
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectDropdownStyles);
} else {
    injectDropdownStyles();
}



// === CHAT BUTON & DROPDOWN SENKRONİZASYONU ===

// === CHAT BUTON SENKRONİZASYONU (SADELEŞTİRİLMİŞ) ===

// Yardımcı: Bir item o gün için sepette mi?
function isItemInCartForDay(lat, lon, name, day) {
    if (!window.cart) return false;
    return window.cart.some(item => {
        // Gün tutuyor mu?
        if (Number(item.day) !== Number(day)) return false;
        
        // 1. Koordinat kontrolü (Varsa en sağlamı)
        // Sepetteki item yapısı farklı olabileceği için hem .lat hem .location.lat kontrol ediyoruz
        const iLat = item.lat || (item.location ? item.location.lat : null);
        const iLon = item.lon || (item.location ? (item.location.lng || item.location.lon) : null);

        if (lat && lon && iLat && iLon) {
            const dLat = Math.abs(iLat - lat);
            const dLng = Math.abs(iLon - lon);
            if (dLat < 0.0005 && dLng < 0.0005) return true;
        }
        
        // 2. İsim kontrolü (Yedek)
        if (name && item.name) {
            return name.toLowerCase().trim() === item.name.toLowerCase().trim();
        }
        return false;
    });
}

// Tüm butonları o anki dropdown seçimine göre güncelle
function updateAllChatButtons() {
    const steps = document.querySelectorAll('.steps');
    steps.forEach(step => {
        const dropdown = step.querySelector('.day-select-dropdown-premium');
        const btn = step.querySelector('.addtotrip');
        
        if (!dropdown || !btn) return;

        // Item bilgilerini al
        const lat = parseFloat(step.getAttribute('data-lat'));
        const lon = parseFloat(step.getAttribute('data-lon'));
        const name = step.querySelector('.title')?.textContent.trim();
        
        // Dropdown'da HANGİ GÜN seçili?
        const selectedDay = parseInt(dropdown.value);
        
        // O seçili günde bu item var mı?
        const isAdded = isItemInCartForDay(lat, lon, name, selectedDay);

        if (isAdded) {
            // VARSA: Pasif yap, "Added" yaz
            if (!btn.classList.contains('added-passive')) {
                btn.classList.add('added-passive');
                btn.innerHTML = `<span>Added</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                
                // Görsel stil (CSS yerine JS ile garanti olsun)
                btn.style.opacity = '0.6';
                btn.style.pointerEvents = 'none';
                btn.style.background = '#f0f0f0';
                btn.style.color = '#666';
                btn.style.borderColor = '#ccc';
                btn.style.boxShadow = 'none';
            }
        } else {
            // YOKSA: Aktif yap, "Add" yaz
            if (btn.classList.contains('added-passive')) {
                btn.classList.remove('added-passive');
                btn.innerHTML = `<span>Add</span><img src="img/addtotrip-icon.svg">`;
                
                // Stilleri sıfırla
                btn.style.opacity = '';
                btn.style.pointerEvents = '';
                btn.style.background = '';
                btn.style.color = '';
                btn.style.borderColor = '';
                btn.style.boxShadow = '';
            }
        }
    });
}

// Dropdown her değiştiğinde sadece o anki durumu kontrol et
document.addEventListener('change', function(e) {
    if (e.target && e.target.classList.contains('day-select-dropdown-premium')) {
        updateAllChatButtons();
    }
});

// Dropdown değiştiğinde buton durumunu anlık güncelle
document.addEventListener('change', function(e) {
    if (e.target && e.target.classList.contains('day-select-dropdown-premium')) {
        updateAllChatButtons();
    }
});