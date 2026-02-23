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

    // Mobilde "Back to Editing" butonu en üstte göster
    if (window.innerWidth <= 768) {
        const mobileBackBtn = document.createElement('button');
        mobileBackBtn.id = 'tt-mobile-back-btn';
        mobileBackBtn.textContent = '← Back to Editing';
        mobileBackBtn.style.cssText = `
            display: block;
            width: 100%;
            padding: 14px 20px;
            background: #4aac48;
            border: none;
            border-bottom: 1px solid #e8e0ff;
            color: #ffffff;
            font-weight: 600;
            font-size: 0.95rem;
            text-align: left;
            cursor: pointer;
            letter-spacing: 0.01em;
        `;
        mobileBackBtn.onclick = () => { if (typeof exitShareMode === 'function') exitShareMode(); };
        tripDetailsSection.appendChild(mobileBackBtn);
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
            <button class="share-btn whatsapp" onclick="showDatePickerBeforeShare('whatsapp')">
                <img src="img/share_whatsapp.svg" alt="WhatsApp"> WhatsApp
            </button>
            <button class="share-btn telegram" onclick="showDatePickerBeforeShare('telegram')">
                <img src="img/share_telegram.svg" alt="Telegram"> Telegram
            </button>            
            ${window.innerWidth <= 768 ? `
            <button class="share-btn messenger" onclick="showDatePickerBeforeShare('messenger')">
                <img src="img/share_messenger.svg" alt="Messenger"> Messenger
            </button>` : ''}
            <button class="share-btn facebook" onclick="showDatePickerBeforeShare('facebook')">
                <img src="img/share_facebook.svg" alt="Facebook"> Facebook
            </button>
            <button class="share-btn email" onclick="showDatePickerBeforeShare('email')">
                <img src="img/share_email.svg" alt="Email"> Email
            </button>
            <button class="share-btn twitter" onclick="showDatePickerBeforeShare('twitter')">
                <img src="img/share_x.svg" alt="Twitter"> Twitter
            </button>
        </div>
    `;
    tripDetailsSection.appendChild(shareDiv);

    // Copy link section with visible URL
    const copyLinkSection = document.createElement('div');
    copyLinkSection.className = 'copy-link-section';
    copyLinkSection.innerHTML = `
        <div class="copy-link-container">
            <div class="link-label">Or copy your trip link:</div>
            <div class="link-box">
                <input type="text" id="trip-share-url" readonly class="trip-url-input" value="Loading...">
                <button class="copy-btn" onclick="copyTripLink()">
                    <img src="img/share_copy.svg" alt="Copy"> Copy Link
                </button>
            </div>
        </div>
        
        <style>
            .copy-link-section {
                margin-top: 30px;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 12px;
                border: 1px solid #e0e0e0;
            }
            
            .copy-link-container {
                max-width: 800px;
                margin: 0;
            }
            
            .link-label {
                font-size: 14px;
                color: #666;
                margin-bottom: 10px;
                font-weight: 500;
            }
            
            .link-box {
                display: flex;
                gap: 10px;
                align-items: center;
            }
            
            .trip-url-input {
                flex: 1;
                max-width: 600px;
                padding: 12px 15px;
                border: 1px solid #d0d0d0;
                border-radius: 8px;
                font-size: 14px;
                font-family: monospace;
                background: #fff;
                color: #333;
                outline: none;
                width: -webkit-fill-available;
            }
            
            .trip-url-input:focus {
                border-color: #8a4af3;
            }
            
            .copy-btn {
                padding: 12px 20px;
                background: #8a4af3;
                color: white;
                border: none;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 6px;
                transition: all 0.2s;
                white-space: nowrap;
            }
            
            .copy-btn:hover {
                background: #7a3ad3;
                transform: translateY(-1px);
            }
            
            .copy-btn img {
                width: 16px;
                height: 16px;
                filter: brightness(0) invert(1);
            }
            
            @media (max-width: 768px) {
                .link-box {
                    flex-direction: column;
                }
                
                .copy-btn {
                    width: 100%;
                    justify-content: center;
                }
            }
        </style>
    `;
    tripDetailsSection.appendChild(copyLinkSection);

    // En alta "Back to Editing" butonu
    const bottomBackBtn = document.createElement('button');
    bottomBackBtn.id = 'tt-bottom-back-btn';
    bottomBackBtn.textContent = '← Back to Editing';
    bottomBackBtn.style.cssText = `
        display: block;
        width: 100%;
        padding: 14px 20px;
        margin-top: 16px;
        background: #4aac48;
        border: 1px solid #e8e0ff;
        border-radius: 8px;
        color: #ffffff;
        font-weight: 600;
        font-size: 0.95rem;
        text-align: center;
        cursor: pointer;
        letter-spacing: 0.01em;
    `;
    bottomBackBtn.onclick = () => { if (typeof exitShareMode === 'function') exitShareMode(); };
    tripDetailsSection.appendChild(bottomBackBtn);

    // Generate and display the link (with shortening)
    setTimeout(async () => {
        const url = createOptimizedLongLink();
        const urlInput = document.getElementById('trip-share-url');
        
        try {
            const response = await fetch('/api/shorten', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ longUrl: url })
            });
            if (response.ok) {
                const result = await response.json();
                if (urlInput) urlInput.value = result.shortUrl;
            } else {
                if (urlInput) urlInput.value = url;
            }
        } catch (e) {
            console.warn("URL shortening failed");
            if (urlInput) urlInput.value = url;
        }
    }, 100);
}

// Copy link function
window.copyTripLink = function() {
    const urlInput = document.getElementById('trip-share-url');
    if (!urlInput) return;
    
    urlInput.select();
    urlInput.setSelectionRange(0, 99999);
    
    navigator.clipboard.writeText(urlInput.value).then(() => {
        const copyBtn = document.querySelector('.copy-btn');
        if (copyBtn) {
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = '<img src="img/check.svg" alt="Copied" style="filter: brightness(0) invert(1);"> Copied!';
            copyBtn.style.background = '#4caf50';
            
            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
                copyBtn.style.background = '#8a4af3';
            }, 2000);
        }
    }).catch(() => {
        alert('Failed to copy. Please copy manually.');
    });
};