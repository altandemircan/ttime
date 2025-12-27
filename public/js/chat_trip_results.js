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
            
            <span class="fav-heart" data-name="${name}" data-category="${category}" data-lat="${lat}" data-lon="${lon}">
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
            <div class="title">${name}</div>
            
            <div class="address">
                <img src="img/address_icon.svg"><span>${address || 'Address not found'}</span>
            </div>
            <div class="opening_hours">
                <img src="img/hours_icon.svg"><span>${opening || 'Working hours not found.'}</span>
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



/* === REPLACED showTripDetails (Maps / route controls REMOVED in Trip Details view) === */
/* === REPLACED showTripDetails (Notes attached to Items) === */
/* === REPLACED showTripDetails (Detailed Note Design) === */
function showTripDetails(startDate) {
    const isMobile = window.innerWidth <= 768;

    // Chat Screen ve Section Kontrolü
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

    // --- CSS: Gelişmiş Not Tasarımı İçin Stiller ---
    if (!document.getElementById('tt-attached-notes-style')) {
        const style = document.createElement('style');
        style.id = 'tt-attached-notes-style';
        style.textContent = `
            .attached-notes-container {
                position: absolute;
                top: 45px; /* Marker numarasının altına denk gelsin */
                right: 5px;
                left: 5px; /* Genişliği ortalamak için */
                z-index: 20;
                display: flex;
                flex-direction: column;
                gap: 5px;
                pointer-events: none; /* Boşluklara tıklayınca arkası işlesin */
            }
            /* Kullanıcının gönderdiği kart tasarımı için CSS */
            .attached-note-card {
                background: rgba(255, 255, 255, 0.96); /* Hafif şeffaf beyaz */
                border-radius: 12px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                padding: 8px 12px;
                pointer-events: auto; /* Karta tıklanabilsin */
                border: 1px solid #eee;
                transition: all 0.2s ease;
            }
            .attached-note-card .header-row {
                display: flex; 
                align-items: center; 
                justify-content: space-between; 
                width: 100%;
            }
            .attached-note-card .left-group {
                display: flex; 
                align-items: center; 
                gap: 10px;
            }
            .attached-note-card .item-position {
                position: relative;
                width: 32px; 
                height: 32px;
                display: flex; 
                align-items: center; 
                justify-content: center;
            }
            .attached-note-card .custom-marker-outer {
                /* Senin gönderdiğin HTML'deki inline stilleri destekler, 
                   ekstra override gerekirse buraya yazılır */
            }
            .attached-note-card .cart-image {
                width: 24px; 
                height: 24px;
                margin-left: 20px; /* Marker'ın yanına */
                object-fit: contain;
            }
            .attached-note-card .toggle-title {
                margin: 0;
                font-weight: 600;
                font-size: 0.9rem;
                color: #333;
            }
            .attached-note-card .arrow-icon {
                width: 16px; 
                height: 16px; 
                cursor: pointer;
                transition: transform 0.3s ease;
            }
            .attached-note-card .content {
                margin-top: 8px;
                padding-top: 8px;
                border-top: 1px solid #eee;
                font-size: 0.85rem;
                color: #555;
                line-height: 1.4;
            }
            .attached-note-card .info-section p {
                margin: 0;
            }
        `;
        document.head.appendChild(style);
    }

    // --- JS: Not Aç/Kapa Fonksiyonu (Global) ---
    window.toggleAttachedNote = function(el) {
        // Tıklanan okun olduğu kartı bul
        const card = el.closest('.attached-note-card');
        const content = card.querySelector('.content');
        const img = el.querySelector('img');
        
        if (content.style.display === 'none' || content.style.display === '') {
            content.style.display = 'block';
            if(img) img.style.transform = 'rotate(90deg)';
        } else {
            content.style.display = 'none';
            if(img) img.style.transform = 'rotate(0deg)';
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

        // --- Date Header Logic ---
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
            
            // --- NOT HTML OLUŞTURMA (Senin Tasarımın) ---
            let notesHtml = "";
            if (step.attachedNotes && step.attachedNotes.length > 0) {
                notesHtml = `<div class="attached-notes-container">`;
                step.attachedNotes.forEach(note => {
                    // Not içeriği ve başlığı
                    const noteTitle = note.name || "Note";
                    const noteDetails = note.noteDetails || ""; 
                    // HTML Yapısı: Senin gönderdiğin yapının aynısı (Drag/Remove temizlendi)
                    notesHtml += `
                    <div class="attached-note-card">
                        <div class="header-row">
                            <div class="left-group">
                                <div class="item-position">
                                    <div class="custom-marker-outer" style="
                                        flex-shrink: 0; transform: scale(0.70); position: absolute; left: 0; top: -4px;
                                        background: #f57f17 !important; border-radius: 50%; width: 24px; height: 24px;
                                        display: flex; align-items: center; justify-content: center; color: #fff;
                                        font-weight: bold; font-size: 16px; border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                                        <span class="custom-marker-label" style="font-size: 14px;">N</span>
                                    </div>
                                    <img src="img/custom-note.svg" alt="note" class="cart-image" style="width:20px; margin-left:14px;">
                                </div>
                                <div class="item-info">
                                    <p class="toggle-title">${noteTitle}</p>
                                </div>
                            </div>
                            <span class="arrow" onclick="toggleAttachedNote(this)">
                                <img src="https://www.svgrepo.com/show/520912/right-arrow.svg" class="arrow-icon">
                            </span>
                        </div>
                        <div class="content" style="display: none;">
                            <div class="info-section">
                                <div class="note-details">
                                    <p>${noteDetails.replace(/\n/g, '<br>')}</p>
                                </div>
                            </div>
                        </div>
                    </div>`;
                });
                notesHtml += `</div>`;
            }

            // --- ANA SLIDE HTML ---
            return `<li class="splide__slide">
          <div class="steps" data-day="${day}" data-category="${step.category}"${step.lat && step.lon ? ` data-lat="${step.lat}" data-lon="${step.lon}"` : ""} style="position: relative;">
            
            ${notesHtml} <div class="visual" style="opacity: 1;">
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

    // Splide mount kodu
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

    // Paylaşım başlığı ve butonları
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