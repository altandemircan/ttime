// chat_trip_results.js

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
        catIcon = "/img/park_icon.svg"; // Varsa

    // Favori durumu (örnek fonksiyon)
    const isFav = (typeof isTripFav === 'function') 
        ? isTripFav({ name, category, lat, lon }) 
        : false;
    const favIconSrc = isFav ? "/img/like_on.svg" : "/img/like_off.svg";

    // --- HTML ÇIKTISI (Info İkonu Eklendi) ---
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
                /* Tooltip Hover Efekti */
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
                
            </div>
            
            <a class="addtotrip"><span>Add to trip</span>
                <img src="img/addtotrip-icon.svg">
            </a>
        </div>
    </div>`;
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

    // --- 1. CSS GÜNCELLEMESİ: İkonlar Sabit, Kutu "Absolute" ---
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

                /* Üstteki Açıklama Kutusu (Artık Aşağıda Açılacak) */
                .shared-note-view {
                    display: none; 
                    position: absolute; 
                    
                    /* --- DEĞİŞİKLİK BURADA --- */
                    top: 100%; /* Butonların altına yerleş */
                    left: 0;
                    width: 100%;
                    margin-top: 12px; /* Butonlarla arasına biraz boşluk */
                    /* ------------------------ */
                    
                    background: rgba(255, 255, 255, 0.98);
                    border-radius: 8px;
                    padding: 12px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.2); /* Gölgeyi biraz artırdık */
                    border: 1px solid #ddd;
                    pointer-events: auto;
                    
                    flex-direction: column;
                    justify-content: center;
                    animation: slideDown 0.2s ease-out; /* Animasyon yönü değişti */
                    z-index: 25;
                }
                
                .shared-note-view.open {
                    display: flex;
                }

                /* Yukarıdan aşağı süzülme efekti */
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
                    /* Çok uzun metinler için scroll bar ekleyelim mi? İstersen açabilirsin: */
                    /* max-height: 150px; overflow-y: auto; */
                }

                /* Butonların Alanı */
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
                
                /* Ok işareti (Baloncuk efekti) */
                .shared-note-view::after {
                    content: '';
                    position: absolute;
                    
                    /* --- OK YÖNÜ DEĞİŞTİ --- */
                    top: -6px; /* Kutunun tepesine */
                    left: 20px; 
                    width: 10px;
                    height: 10px;
                    background: #fff;
                    transform: rotate(45deg);
                    
                    /* Üst ve Sol kenarlık vererek yukarı bakan ok yaptık */
                    border-top: 1px solid #ddd;
                    border-left: 1px solid #ddd;
                    /* Alt ve Sağ kaldırıldı */
                    border-bottom: none; 
                    border-right: none;
                }
            `;
            document.head.appendChild(style);
        }

    // --- 2. JS FONKSİYONU ---
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

    const startDateObj = startDate ? new Date(startDate) : null;
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
        label.innerHTML = `${labelText} <img src="img/arrow_down.svg" class="accordion-arrow">`;
        container.appendChild(label);

        const content = document.createElement("div");
        content.className = "accordion-content";
        const daySteps = document.createElement("div");
        daySteps.className = "day-steps active-view";
        daySteps.setAttribute("data-day", String(day));

        if (groupedItems.length > 0) {
            daySteps.innerHTML = `
  <div class="splide" id="splide-trip-details-day${day}">
    <div class="splide__track">
      <ul class="splide__list">
        ${groupedItems.map((step, idx) => {
            
            // --- 3. HTML OLUŞTURMA ---
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
            <button class="share-btn whatsapp" onclick="shareOnWhatsApp()">
                <img src="img/share_whatsapp.svg" alt="WhatsApp"> WhatsApp
            </button>
            <button class="share-btn instagram" onclick="shareOnInstagram()">
                <img src="img/share_instagram.svg" alt="Instagram"> Instagram
            </button>
            <button class="share-btn facebook" onclick="shareOnFacebook()">
                <img src="img/share_facebook.svg" alt="Facebook"> Facebook
            </button>
            <button class="share-btn twitter" onclick="shareOnTwitter()">
                <img src="img/share_x.svg" alt="Twitter"> Twitter
            </button>
        </div>
    `;
    tripDetailsSection.appendChild(shareDiv);
}




// PAYLAŞILAN GEZİ ÖZEL SAYFASI
function showSharedTripPage(tripData) {
    const chatScreen = document.getElementById("chat-screen") || document.createElement("div");
    chatScreen.id = "chat-screen";
    document.body.innerHTML = ''; // Sayfayı temizle
    document.body.appendChild(chatScreen);
    
    // Özel CSS
    const style = document.createElement('style');
    style.textContent = `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            background: #f5f7fa;
            min-height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .shared-trip-wrapper {
            max-width: 100%;
            margin: 0 auto;
        }
        
        .trip-hero {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        
        .trip-hero::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320"><path fill="rgba(255,255,255,0.1)" d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,160C1248,160,1344,128,1392,112L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path></svg>');
            background-size: cover;
            opacity: 0.3;
        }
        
        .trip-hero h1 {
            font-size: 2.8rem;
            margin-bottom: 10px;
            position: relative;
            z-index: 1;
        }
        
        .trip-hero p {
            font-size: 1.2rem;
            opacity: 0.9;
            max-width: 600px;
            margin: 0 auto 30px;
            position: relative;
            z-index: 1;
        }
        
        .hero-stats {
            display: flex;
            justify-content: center;
            gap: 40px;
            margin-top: 30px;
            position: relative;
            z-index: 1;
        }
        
        .stat-item {
            text-align: center;
        }
        
        .stat-number {
            font-size: 2.5rem;
            font-weight: bold;
            display: block;
        }
        
        .stat-label {
            font-size: 0.9rem;
            opacity: 0.8;
        }
        
        .trip-content {
            padding: 40px 20px;
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .day-section {
            background: white;
            border-radius: 15px;
            margin-bottom: 30px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.08);
            overflow: hidden;
            transition: transform 0.3s ease;
        }
        
        .day-section:hover {
            transform: translateY(-5px);
        }
        
        .day-header {
            background: linear-gradient(to right, #4facfe 0%, #00f2fe 100%);
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .day-title {
            font-size: 1.5rem;
            font-weight: 600;
        }
        
        .day-date {
            font-size: 1rem;
            opacity: 0.9;
        }
        
        .day-places {
            padding: 20px;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
        }
        
        /* Mevcut steps tasarımını güçlendir */
        .shared-step {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            border: 1px solid #e1e5e9;
            transition: all 0.3s ease;
            position: relative;
        }
        
        .shared-step:hover {
            border-color: #667eea;
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.15);
        }
        
        .step-number {
            position: absolute;
            top: 15px;
            left: 15px;
            background: #667eea;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 14px;
            z-index: 2;
            box-shadow: 0 3px 10px rgba(102, 126, 234, 0.3);
        }
        
        .step-image {
            width: 100%;
            height: 180px;
            object-fit: cover;
            display: block;
        }
        
        .step-info {
            padding: 20px;
        }
        
        .step-category {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: #f0f7ff;
            color: #4facfe;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 500;
            margin-bottom: 15px;
        }
        
        .step-category img {
            width: 16px;
            height: 16px;
        }
        
        .step-title {
            font-size: 1.3rem;
            font-weight: 600;
            color: #333;
            margin-bottom: 10px;
            line-height: 1.3;
        }
        
        .step-details {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-top: 15px;
        }
        
        .detail-item {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            font-size: 0.9rem;
            color: #666;
        }
        
        .detail-item img {
            width: 16px;
            height: 16px;
            opacity: 0.7;
            margin-top: 2px;
        }
        
        .cta-section {
            text-align: center;
            padding: 60px 20px;
            background: white;
            margin-top: 40px;
            border-radius: 15px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.08);
        }
        
        .cta-title {
            font-size: 2rem;
            color: #333;
            margin-bottom: 20px;
        }
        
        .cta-buttons {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-top: 30px;
            flex-wrap: wrap;
        }
        
        .cta-btn {
            padding: 15px 30px;
            border-radius: 50px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            border: none;
            transition: all 0.3s ease;
            display: inline-flex;
            align-items: center;
            gap: 10px;
            text-decoration: none;
        }
        
        .cta-btn-primary {
            background: linear-gradient(to right, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        .cta-btn-secondary {
            background: white;
            color: #667eea;
            border: 2px solid #667eea;
        }
        
        .cta-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        }
        
        .powered-by {
            text-align: center;
            padding: 20px;
            color: #666;
            font-size: 0.9rem;
            margin-top: 30px;
        }
        
        @media (max-width: 768px) {
            .day-places {
                grid-template-columns: 1fr;
            }
            
            .trip-hero h1 {
                font-size: 2rem;
            }
            
            .hero-stats {
                flex-direction: column;
                gap: 20px;
            }
            
            .cta-buttons {
                flex-direction: column;
                align-items: center;
            }
            
            .cta-btn {
                width: 100%;
                max-width: 300px;
                justify-content: center;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Günleri grupla
    const days = {};
    tripData.cart.forEach(item => {
        if (!days[item.day]) days[item.day] = [];
        days[item.day].push(item);
    });
    
    // İstatistikler
    const totalPlaces = tripData.cart.length;
    const totalDays = Object.keys(days).length;
    const categories = [...new Set(tripData.cart.map(item => item.category))];
    
    // HTML Oluştur
    chatScreen.innerHTML = `
        <div class="shared-trip-wrapper">
            <div class="trip-hero">
                <h1>✈️ Amazing Trip Plan</h1>
                <p>Discover this carefully curated travel itinerary with ${totalPlaces} amazing places across ${totalDays} days</p>
                
                <div class="hero-stats">
                    <div class="stat-item">
                        <span class="stat-number">${totalDays}</span>
                        <span class="stat-label">Days</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">${totalPlaces}</span>
                        <span class="stat-label">Places</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">${categories.length}</span>
                        <span class="stat-label">Categories</span>
                    </div>
                </div>
            </div>
            
            <div class="trip-content">
                ${Object.entries(days).map(([day, places]) => {
                    const dayName = tripData.customDayNames?.[day] || `Day ${day}`;
                    let dateStr = '';
                    if (tripData.tripDates?.startDate) {
                        const startDate = new Date(tripData.tripDates.startDate);
                        const currentDate = new Date(startDate);
                        currentDate.setDate(startDate.getDate() + (parseInt(day) - 1));
                        dateStr = currentDate.toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                        });
                    }
                    
                    return `
                    <div class="day-section">
                        <div class="day-header">
                            <div>
                                <div class="day-title">${dayName}</div>
                                ${dateStr ? `<div class="day-date">${dateStr}</div>` : ''}
                            </div>
                            <div style="font-size: 0.9rem; opacity: 0.9;">
                                ${places.length} places
                            </div>
                        </div>
                        
                        <div class="day-places">
                            ${places.map((place, idx) => `
                                <div class="shared-step">
                                    <div class="step-number">${idx + 1}</div>
                                    <img class="step-image" src="${place.image || 'https://images.pexels.com/photos/3462098/pexels-photo-3462098.jpeg?auto=compress&cs=tinysrgb&h=350'}" alt="${place.name}" onerror="this.src='img/placeholder.png'">
                                    
                                    <div class="step-info">
                                        <div class="step-category">
                                            <img src="${getCategoryIcon(place.category)}" alt="${place.category}">
                                            ${place.category}
                                        </div>
                                        
                                        <div class="step-title">${place.name}</div>
                                        
                                        <div class="step-details">
                                            ${place.address ? `
                                            <div class="detail-item">
                                                <img src="img/address_icon.svg" alt="Address">
                                                <span>${place.address}</span>
                                            </div>` : ''}
                                            
                                            ${place.opening_hours ? `
                                            <div class="detail-item">
                                                <img src="img/hours_icon.svg" alt="Hours">
                                                <span>${place.opening_hours}</span>
                                            </div>` : ''}
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    `;
                }).join('')}
                
                <div class="cta-section">
                    <h2 class="cta-title">Ready to customize this trip?</h2>
                    <p style="color: #666; max-width: 600px; margin: 0 auto 30px; line-height: 1.6;">
                        This trip plan was shared with you. You can customize it, add your own places, 
                        or use it as inspiration for your next adventure!
                    </p>
                    
                    <div class="cta-buttons">
                        <button class="cta-btn cta-btn-primary" onclick="loadThisTrip()">
                            <img src="img/addtotrip-icon.svg" style="width: 20px; height: 20px;">
                            Use This Trip Plan
                        </button>
                        <button class="cta-btn cta-btn-secondary" onclick="window.location.href = 'https://triptime.ai'">
                            ✨ Create Your Own Trip
                        </button>
                    </div>
                </div>
                
                <div class="powered-by">
                    Powered by <strong>Triptime.ai</strong> • Share your own trips with friends!
                </div>
            </div>
        </div>
    `;
    
    // Global fonksiyon
    window.loadThisTrip = function() {
        // Mevcut geziyi yükle
        window.cart = tripData.cart;
        window.customDayNames = tripData.customDayNames || {};
        window.tripDates = tripData.tripDates || {};
        localStorage.setItem('cart', JSON.stringify(window.cart));
        
        // Ana sayfaya yönlendir
        window.location.href = window.location.origin + '/?loadedFromShare=true';
    };
}

// Kategori ikonu fonksiyonu
function getCategoryIcon(category) {
    if (category === "Coffee" || category === "Breakfast" || category === "Cafes")
        return "/img/coffee_icon.svg";
    else if (category === "Museum")
        return "/img/museum_icon.svg";
    else if (category === "Touristic attraction")
        return "/img/touristic_icon.svg";
    else if (category === "Restaurant" || category === "Lunch" || category === "Dinner")
        return "/img/restaurant_icon.svg";
    else if (category === "Accommodation")
        return "/img/accommodation_icon.svg";
    else if (category === "Parks")
        return "/img/park_icon.svg";
    else
        return "https://www.svgrepo.com/show/522166/location.svg";
}