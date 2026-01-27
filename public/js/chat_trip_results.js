
// 2️⃣  generateStepHtml() - DROPDOWN'U "change" DIV'İNE EKLE (HTML AYNI KALIR)
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
        const checkmark = d === day ? ' ✓' : '';
        dayOptionsHtml += `<option value="${d}" ${selected}>Day ${d}${checkmark}</option>`;
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
                
                <!-- 🆕 DROPDOWN (change div'ine ekli) -->
                <select class="day-select-dropdown-premium" 
                        style="padding: 7px 10px; border: 1.5px solid #e0e0e0; border-radius: 6px; font-size: 0.85rem; background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%); color: #333; cursor: pointer; font-weight: 500; transition: all 0.3s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.05); appearance: none; background-image: url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 12 12%27%3E%3Cpath fill=%27%23333%27 d=%27M6 9L1 4h10z%27/%3E%3C/svg%3E'); background-repeat: no-repeat; background-position: right 8px center; padding-right: 28px;">
                    ${dayOptionsHtml}
                </select>
            </div>
            
            <a class="addtotrip"><span>Add to trip</span>
                <img src="img/addtotrip-icon.svg">
            </a>
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

        @media (max-width: 768px) {
            .day-select-dropdown-premium {
                font-size: 0.8rem !important;
                padding: 6px 8px !important;
                min-width: 70px !important;
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


function showTripDetails(startDate) {
    const isMobile = window.innerWidth <= 768;

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

    if (!document.getElementById('tt-attached-notes-style')) {
        const style = document.createElement('style');
        style.id = 'tt-attached-notes-style';
        style.textContent = `
            .attached-notes-container {
                position: absolute;
                top: 14px;
                right: 36px;
                left: 10px;
                z-index: 20;
                display: block;
                pointer-events: none;
            }
            .shared-note-view {
                display: none; 
                position: absolute; 
                top: 100%;
                left: 0;
                width: 100%;
                margin-top: 12px;
                background: rgba(255, 255, 255, 0.98);
                border-radius: 8px;
                padding: 12px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                border: 1px solid #ddd;
                pointer-events: auto;
                flex-direction: column;
                justify-content: center;
                animation: slideDown 0.2s ease-out;
                z-index: 25;
            }
            .shared-note-view.open {
                display: flex;
            }
            @keyframes slideDown {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .shared-note-view h5 {
                margin: 0 0 4px 0;
                font-size: 0.9rem;
                color: #d32f2f;
                font-weight: 700;
            }
            .shared-note-view p {
                margin: 0;
                font-size: 0.8rem;
                color: #444;
                line-height: 1.3;
            }
            .note-buttons-wrapper {
                position: relative; 
                display: flex;
                gap: 12px; 
                pointer-events: auto;
                padding-left: 5px;
            }
            .note-trigger-btn {
                position: relative;
                width: 36px;
                height: 36px;
                background: #fff;
                border-radius: 8px;
                border: 1px solid #ddd;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                transition: all 0.2s;
            }
            .note-trigger-btn:hover {
                background: #f9f9f9;
            }
            .note-trigger-btn.active {
                border-color: #d32f2f;
                background: #fff5f5;
                transform: scale(1.1);
            }
            .note-trigger-icon {
                width: 24px; 
                height: 24px;
                opacity: 0.8;
            }
            .note-trigger-btn.active .note-trigger-icon {
                opacity: 1;
            }
            .note-trigger-badge {
                position: absolute;
                top: -6px;
                right: -6px;
                width: 18px; 
                height: 18px;
                background: #f57f17;
                color: #fff;
                font-size: 10px;
                font-weight: bold;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 2px solid #fff;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            }
            .shared-note-view::after {
                content: '';
                position: absolute;
                top: -6px;
                left: 20px; 
                width: 10px;
                height: 10px;
                background: #fff;
                transform: rotate(45deg);
                border-top: 1px solid #ddd;
                border-left: 1px solid #ddd;
                border-bottom: none; 
                border-right: none;
            }
        `;
        document.head.appendChild(style);
    }

    window.updateAttachedNote = function(displayId, btnElement) {
        const displayBox = document.getElementById(displayId);
        if(!displayBox) return;

        const isAlreadyActive = btnElement.classList.contains('active');

        const parentWrapper = btnElement.closest('.note-buttons-wrapper');
        const siblings = parentWrapper.querySelectorAll('.note-trigger-btn');
        siblings.forEach(el => el.classList.remove('active'));

        if (isAlreadyActive) {
            displayBox.classList.remove('open'); 
        } else {
            const title = btnElement.getAttribute('data-title');
            const desc = btnElement.getAttribute('data-desc');

            displayBox.innerHTML = `
                <h5>${title}</h5>
                <p>${desc}</p>
            `;
            displayBox.classList.add('open'); 
            btnElement.classList.add('active'); 
        }
    };

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

    if (typeof window.customDayNames === "undefined") window.customDayNames = {};

    for (let day = 1; day <= maxDay; day++) {
        const rawItems = window.cart.filter(it => it.day == day && it.name !== undefined);
        
        let groupedItems = [];
        let currentParent = null;

        rawItems.forEach(item => {
            if (item.category === 'Note') {
                if (currentParent) {
                    currentParent.attachedNotes.push(item);
                }
            } else {
                currentParent = { ...item, attachedNotes: [] };
                groupedItems.push(currentParent);
            }
        });

        // --- DÜZELTME BURADA BAŞLIYOR ---
        
        // 1. Önce değişkeni tanımlıyoruz (Hata almamak için şart)
        let dateStr = ""; 

        // 2. Tarih kaynağını belirliyoruz (Sırasıyla: Cart > LocalStorage > Parametre)
        const activeStartDate = window.cart.startDate || localStorage.getItem('tripStartDate') || startDate;

        // 3. Tarih varsa hesaplıyoruz
        if (activeStartDate) {
            const startDateObj = new Date(activeStartDate);
            // Geçerli bir tarih mi kontrolü
            if (!isNaN(startDateObj.getTime())) {
                const d = new Date(startDateObj);
                d.setDate(startDateObj.getDate() + (day - 1));
                dateStr = d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
            }
        }
        
        // (Eski "if (window.cart.startDate)..." bloğunu buradan sildik, yukarıdaki kod zaten o işi yapıyor)

        // --- DÜZELTME BİTTİ ---
        
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
        label.innerHTML = `${labelText} <img src="img/arrow_down.svg" class="accordion-arrow">`;
        container.appendChild(label);

        const content = document.createElement("div");
        content.className = "accordion-content";
        const daySteps = document.createElement("div");
        daySteps.className = "day-steps active-view";
        daySteps.setAttribute("data-day", String(day));

        if (groupedItems.length > 0) {
            // ... (Buradaki HTML oluşturma kodların aynı kalacak) ...
             daySteps.innerHTML = `
  <div class="splide" id="splide-trip-details-day${day}">
    <div class="splide__track">
      <ul class="splide__list">
        ${groupedItems.map((step, idx) => {
            
            let notesHtml = "";
            if (step.attachedNotes && step.attachedNotes.length > 0) {
                const uniqueDisplayId = `note-display-${day}-${idx}`;
                
                notesHtml = `
                <div class="attached-notes-container">
                    
                    <div id="${uniqueDisplayId}" class="shared-note-view">
                        </div>

                    <div class="note-buttons-wrapper">
                        ${step.attachedNotes.map((note, nIdx) => {
                            const nTitle = note.name || "Note";
                            const nDesc = (note.noteDetails || "").replace(/"/g, '&quot;').replace(/\n/g, '<br>');
                            
                            return `
                            <div class="note-trigger-btn" 
                                 onclick="updateAttachedNote('${uniqueDisplayId}', this)"
                                 data-title="${nTitle}"
                                 data-desc="${nDesc}">
                                
                                <img src="img/custom-note.svg" class="note-trigger-icon">
                                <div class="note-trigger-badge">N</div>
                                
                            </div>
                            `;
                        }).join('')}
                    </div>

                </div>`;
            }

            return `<li class="splide__slide">
          <div class="steps" data-day="${day}" data-category="${step.category}"${step.lat && step.lon ? ` data-lat="${step.lat}" data-lon="${step.lon}"` : ""} style="position: relative;">
            
            ${notesHtml} 
            
            <div class="visual" style="opacity: 1;">
              <div class="marker-num" style="width:24px;height:24px;background:#d32f2f;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;border:2px solid #fff;box-shadow:0 2px 6px #888;margin-right:7px;">${idx + 1}</div>
              <img class="check" src="${step.image || "https://www.svgrepo.com/show/522166/location.svg"}" alt="${step.name || step.category}" onerror="this.onerror=null; this.src='img/placeholder.png';">
            </div>
            <div class="info day_cats item-info-view">
              <div class="title">${step.name || step.category}</div>
              <div class="address">
                <img src="img/address_icon.svg"> ${step.address || ""}
              </div>
              <div class="geoapify-tags-section">
                <div class="geoapify-tags"></div>
              </div>
              <div class="opening_hours">
                <img src="img/hours_icon.svg"> ${step.opening_hours ? step.opening_hours : "Working hours not found."}
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
                ${step.website ? `
                <span onclick="window.openWebsite && window.openWebsite(this, '${step.website}')">
                  <img src="img/website_link.svg" style="vertical-align:middle;width:20px;">
                </span>
                ` : ""}
              </div>
              <div style="display: flex; gap: 12px;">
                <div class="cats cats${(idx % 5) + 1}">
                  <img src="" alt="${step.category}"> ${step.category}
                </div>
                <a class="addtotrip">
                  <img src="img/addtotrip-icon.svg">
                </a>
              </div>
            </div>
          </div>
        </li>`;
        }).join('')}
      </ul>
    </div>
  </div>
`;
        } else {
            const emptyP = document.createElement("p");
            emptyP.className = "empty-day-message";
            emptyP.textContent = "No items have been added for this day yet.";
            daySteps.appendChild(emptyP);
        }
        content.appendChild(daySteps);
        container.appendChild(content);
        li.appendChild(container);
        ul.appendChild(li);
    }
    tripDetailsSection.appendChild(sect);

    setTimeout(() => {
        document.querySelectorAll('.splide').forEach(sliderElem => {
            if (!sliderElem._splideInstance) {
                const splideInstance = new Splide(sliderElem, {
                    type: 'slide',
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

    const shareTitle = document.createElement("div");
    shareTitle.className = "share-buttons-title";
    tripDetailsSection.appendChild(shareTitle);

    shareTitle.innerHTML = `
        Share your travel plan and help others discover amazing places.<br>
        With <strong>Triptime AI</strong>, every journey becomes a story worth sharing!
    `;

    const shareDiv = document.createElement('div');
    shareDiv.id = 'mobile-share-buttons';
    shareDiv.className = 'share-buttons-container';
    shareDiv.innerHTML = `
        <div class="share-buttons">
            <button class="share-btn whatsapp" onclick="showDatePickerBeforeShare()">
                <img src="img/share_whatsapp.svg" alt="WhatsApp"> WhatsApp
            </button>
            <button class="share-btn instagram" onclick="showDatePickerBeforeShare()">
                <img src="img/share_instagram.svg" alt="Instagram"> Instagram
            </button>
            <button class="share-btn facebook" onclick="showDatePickerBeforeShare()">
                <img src="img/share_facebook.svg" alt="Facebook"> Facebook
            </button>
            <button class="share-btn twitter" onclick="showDatePickerBeforeShare()">
                <img src="img/share_x.svg" alt="Twitter"> Twitter
            </button>
        </div>
    `;
    tripDetailsSection.appendChild(shareDiv);
}




