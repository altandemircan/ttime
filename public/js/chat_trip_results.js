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

    // TARİH HESAPLA (startDate varsa)
    let dateStr = "";
    if (window.cart.startDate) {
        // Eğer cart'ta startDate varsa onu kullan
        const startDateObj = new Date(window.cart.startDate);
        const d = new Date(startDateObj);
        d.setDate(startDateObj.getDate() + (day - 1));
        dateStr = d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    } else if (startDate) {
        // Fallback: fonksiyona parametre olarak geçen startDate'i kullan
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + (day - 1));
        dateStr = d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    }
    
    const dayTitle = window.customDayNames[day] || `Day ${day}`;
    const labelText = `${dayTitle}${dateStr ? ` (${dateStr})` : ""}`;
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




