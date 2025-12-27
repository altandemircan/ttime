// chat_trip_results.js

// chat_trip_results.js İÇİNDEKİ generateStepHtml FONKSİYONU
function generateStepHtml(step, day, category, idx = 0, attachedNotes = []) {
    const name = getDisplayName(step) || category;
    const localName = getLocalName(step); // Helper function assumed to exist or standard
    const address = step?.address || "";
    // Görsel yoksa placeholder
    const image = step?.image || "img/placeholder.png"; 
    const website = step?.website || "";
    const opening = step?.opening_hours || "";
    const lat = step?.lat || (step?.location?.lat);
    const lon = step?.lon || (step?.location?.lon);

    // Etiketler (Tags)
    let tagsHtml = "";
    const tags = (step.properties && step.properties.categories) || step.categories;
    if (tags && Array.isArray(tags) && tags.length > 0) {
        // getUniqueSpecificTags global bir yardımcı fonksiyonsa:
        const uniqueTags = (typeof getUniqueSpecificTags === 'function') 
            ? getUniqueSpecificTags(tags) 
            : tags.slice(0, 3).map(t=>({tag:t, label:t})); 
            
        tagsHtml = uniqueTags.map(t => `<span class="geo-tag" title="${t.tag}">${t.label}</span>`).join(' ');
    }

    // Kategori İkonu
    let catIcon = "https://www.svgrepo.com/show/522166/location.svg";
    if (window.categoryIcons && window.categoryIcons[category]) {
        catIcon = window.categoryIcons[category];
    }

    // --- NOTLARI HTML OLARAK HAZIRLA ---
    let notesHtml = '';
    if (attachedNotes && attachedNotes.length > 0) {
        notesHtml = `<div class="attached-notes-wrapper">`;
        attachedNotes.forEach(note => {
            notesHtml += `
                <div class="attached-note-bubble">
                    <img src="img/custom-note.svg" class="note-mini-icon">
                    <span class="note-text">${escapeHtml(note.name || 'Note')}</span>
                </div>`;
        });
        notesHtml += `</div>`;
    }

    // --- HTML ÇIKTISI ---
    return `
      <div class="steps" data-day="${day}" data-category="${category}" data-lat="${lat}" data-lon="${lon}" style="position: relative;">
        
        ${notesHtml} <div class="visual" style="opacity: 1;">
          <div class="marker-num" style="width:24px;height:24px;background:#d32f2f;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;border:2px solid #fff;box-shadow:0 2px 6px #888;margin-right:7px;">${idx}</div>
          <img class="check" src="${image}" alt="${name}" onerror="this.onerror=null; this.src='img/placeholder.png';">
        </div>

        <div class="info day_cats item-info-view">
          <div class="title">${name}</div>
          <div class="address">
            <img src="img/address_icon.svg"> ${address || 'Address not available'}
          </div>
          <div class="geoapify-tags-section">
            <div class="geoapify-tags">${tagsHtml}</div>
          </div>
          <div class="opening_hours">
            <img src="img/hours_icon.svg"> ${opening || 'Working hours not found.'}
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
          <div style="display: flex; gap: 12px;">
            <div class="cats cats${day}">
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



/* === REPLACED showTripDetails (Maps / route controls REMOVED in Trip Details view) === */
function showTripDetails(startDate) {
    // Mobil için tek render, desktop için ayrı kodun varsa ona da aynısını uygula!

    // Ekran kontrolü
    const isMobile = window.innerWidth <= 768;

    // Bölgeyi bul/oluştur
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
            // ===>>> Burası chat/kategori ile aynı render!
            daySteps.innerHTML = `
  <div class="splide" id="splide-trip-details-day${day}">
    <div class="splide__track">
      <ul class="splide__list">
        ${dayItems.map((step, idx) => `<li class="splide__slide">
          <div class="steps" data-day="${day}" data-category="${step.category}"${step.lat && step.lon ? ` data-lat="${step.lat}" data-lon="${step.lon}"` : ""}>
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
                <div class="cats cats${idx % 5 + 1}">
                  <img src="" alt="${step.category}"> ${step.category}
                </div>
                <a class="addtotrip">
                  <img src="img/addtotrip-icon.svg">
                </a>
              </div>
            </div>
          </div>
        </li>`).join('')}
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

    // Splide mount kodu: chat/kategori sliderdaki ile birebir aynı!
    setTimeout(() => {
        // Tüm .splide sliderları için instance mount et
        document.querySelectorAll('.splide').forEach(sliderElem => {
            if (!sliderElem._splideInstance) {
                const splideInstance = new Splide(sliderElem, {
  type: 'slide',
  perPage: 5, // veya perPage: 1 (her seferinde bir item gözüksün)
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