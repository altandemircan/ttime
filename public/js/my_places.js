// ======================================================
// my_places.js - MODERN, STYLE.CSS UYUMLU FAVORİLER
// ======================================================
window.favTrips = JSON.parse(localStorage.getItem('favTrips') || '[]');

function saveFavTrips() {
    localStorage.setItem('favTrips', JSON.stringify(window.favTrips));
}

// GRUP & LOKASYON TEMİZLEYİCİ
function getCleanLocationName(place) {
    let city = place.city, country = place.country;
    if (!city && place.address) {
        const parts = place.address.split(',').map(s => s.trim());
        if (parts.length > 0) {
            const last = parts[parts.length - 1];
            if (!/\d/.test(last)) country = last;
        }
        if (parts.length > 1) {
            const secondLast = parts[parts.length - 2];
            city = secondLast.replace(/[0-9]/g, '').trim();
        } else city = parts[0];
    }
    if (city && city.toLowerCase().includes('unknown')) city = "";
    if (country && country.toLowerCase().includes('unknown')) country = "";
    if (city && country && city !== country) return `${city}, ${country}`;
    if (city) return city;
    if (country) return country;
    return "Saved Places";
}
function groupFavoritesClean(list) {
    const groups = {};
    list.forEach(item => {
        const key = getCleanLocationName(item);
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });
    return groups;
}
// Mesafe kontrol
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

// ------ Modern Akordiyon Komponentleri
window.toggleFavAccordion = function(header) {
    const parent = header.closest('.fav-accordion');
    parent.classList.toggle('open');
};
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
                <h3 style="margin:0; font-size:16px;">Add to which day?</h3>
                <div class="mp-days" id="mp-days-list"></div>
                <button onclick="document.getElementById('mp-modal-ov').style.display='none'" 
                    style="margin-top:15px; border:none; background:none; color:#999; cursor:pointer;">Cancel</button>
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

// --------- MAIN RENDER ---------
async function renderFavoritePlacesPanel() {
    const panel = document.getElementById("favorite-places-panel");
    if (!panel) return;
    panel.innerHTML = "";

    const list = window.favTrips || [];
    if (list.length === 0) {
        panel.innerHTML = `<div class="mytrips-empty">No saved places.</div>`;
        return;
    }

    const groups = groupFavoritesClean(list);

    Object.entries(groups).forEach(([key, items], idx) => {
        // Akordiyon (Başlığı ve içeriği)
        const accordion = document.createElement("div");
        accordion.className = "fav-accordion" + (idx === 0 ? " open" : "");
        accordion.style.marginBottom = '22px';

        // ---------- Grup başlığı
        // Style.css'den: .sidebar_title .section-title gibi
        const header = document.createElement("div");
        header.className = "sidebar_title day-header"; // Gün başlığı gibi dursun
        header.style.cursor = "pointer";
        header.onclick = function() { toggleFavAccordion(this); };
        header.innerHTML = `
            <span class="title-container" style="font-weight:700;font-size:1.2em;color:#8a4af3;">
                <img src="img/pin.webp" style="width:18px;height:18px;vertical-align:middle;margin-right:5px;"> 
                ${key || 'Favorite Places'} 
                <span class="mp-badge" style="color:#7b5dbb;background:#f5f3fe;font-size:0.92em;margin-left:10px;">${items.length}</span>
            </span>
            <button class="arrow" style="background:none;border:none;padding:0 3px 0 8px;">
                <img src="img/arrow-down.svg" 
                    style="width:22px;height:22px;transition:transform 0.3s;"
                >
            </button>
        `;

        // ------------ İçerik Alanı (collapsible)
        const content = document.createElement("div");
        content.className = "fav-accordion-content";
        content.style.overflow = "hidden";
        content.style.maxHeight = idx === 0 ? "10000px" : "0";
        content.style.transition = "max-height 0.45s cubic-bezier(.4,0,.2,1)";

        // Items container
        const wrapper = document.createElement("div");
        wrapper.className = "mytrips-trip-list";
        wrapper.style.padding = "8px 0 0 0";

        // -- Her kart için .travel-item ve alt detaylar
        items.forEach(place => {
            const st = checkDist(place.lat, place.lon);

            // Kart
            const card = document.createElement("div");
            card.className = "travel-item cart-item";
            card.style.marginBottom = "12px";
            card.style.border = "1.5px solid #f5ecff";
            card.style.boxShadow = "0 2px 8px rgba(149, 157, 165, 0.07)";
            card.style.borderRadius = "14px";
            card.style.position = "relative";
            card.style.overflow = "visible";

            // Sol görsel
            const imgBox = document.createElement("div");
            imgBox.style.width = "60px";
            imgBox.style.height = "40px";
            imgBox.style.marginRight = "20px";
            imgBox.style.flexShrink = "0";
            imgBox.style.display = "flex";
            imgBox.style.alignItems = "center";
            imgBox.style.justifyContent = "center";
            const img = document.createElement("img");
            img.src = place.image || 'img/placeholder.png';
            img.onerror = function(e){ this.onerror = null; this.src='img/default_place.jpg'; };
            img.style.width = "100%"; img.style.height = "100%";
            img.style.borderRadius = "8px";
            img.style.objectFit = "cover";
            imgBox.appendChild(img);

            // Ana bilgi
            const info = document.createElement("div");
            info.className = "item-info";
            info.style.display = "flex";
            info.style.flexDirection = "column";
            info.innerHTML = `
                <span class="trip-title" style="font-size:1.08em;font-weight:700;color:#272727;">
                    ${place.name}
                </span>
                <span class="item-distance" style="margin-bottom:4px;font-size:0.92em;color:#7c6dc4;">
                    ${(place.category || 'Place')}
                </span>
                <span class="address" style="font-size:0.9em;color:#777;">
                    ${place.address || ''}
                </span>
            `;

            // (X) sil tuşu
            const del = document.createElement("button");
            del.className = "remove-btn";
            del.setAttribute("title", "Remove from favorites");
            del.style.position = "absolute"; del.style.top = "9px"; del.style.right = "9px";
            del.innerHTML = `<img src="img/trash.svg" style="width: 18px; height: 18px;">`;
            del.onclick = (e) => {
                e.stopPropagation();
                if (confirm(`Remove "${place.name}"?`)) {
                    const delIdx = window.favTrips.findIndex(f => f.name === place.name && String(f.lat) === String(place.lat));
                    if (delIdx > -1) {
                        window.favTrips.splice(delIdx, 1);
                        saveFavTrips();
                        renderFavoritePlacesPanel();
                        if(typeof updateAllFavVisuals === 'function') updateAllFavVisuals();
                    }
                }
            };

            // Alt düğmeler (.item-actions, .add-favorite-btn/.see-details-btn)
            const actions = document.createElement("div");
            actions.className = "item-actions";
            actions.style.marginTop = "0px";
            actions.style.gap = "7px";
            actions.style.display = "flex";

            // Start New
            const b1 = document.createElement("button");
            b1.className = "add-favorite-btn";
            b1.innerHTML = `<img src="img/lightning-bolt.svg" style="width:16px;margin-right:3px;"> Start New`;
            b1.onclick = () => startNewTripWithPlace(place);

            // Add Trip
            const b2 = document.createElement("button");
            b2.className = st.ok ? "see-details-btn" : "see-details-btn";
            b2.style.background = !st.ok ? "#f3f3f3":"";
            b2.style.color = !st.ok ? "#b2b2b2":"";
            b2.style.cursor = !st.ok ? "not-allowed":"pointer";
            b2.innerHTML = `<img src="img/plus.svg" style="width:16px;margin-right:2px;opacity:0.8;">&nbsp;Add Trip <small style="font-weight:500;padding-left:7px;">${st.msg}</small>`;
            if (st.ok) {
                b2.onclick = () => {
                    openDayModal((d) => {
                        if (typeof addToCart === "function") {
                            addToCart(
                                place.name, place.image, d, place.category,
                                place.address || "", null, null, place.opening_hours || "", null,
                                { lat: Number(place.lat), lng: Number(place.lon) }, place.website || ""
                            );
                            if (typeof updateCart === "function") updateCart();
                            renderFavoritePlacesPanel();
                        }
                    });
                };
            } else {
                b2.onclick = null;
            }
            actions.appendChild(b1);
            actions.appendChild(b2);

            // Kart birleştir
            card.appendChild(imgBox);
            card.appendChild(info);
            card.appendChild(del);
            card.appendChild(actions);

            wrapper.appendChild(card);
        });

        // Akordiyon içerik kısmı
        content.appendChild(wrapper);

        // Akordiyon toggle arrow animasyonu
        header.querySelector(".arrow img").style.transform = idx === 0 ? "rotate(90deg)" : "rotate(0deg)";
        accordion.dataset.open = idx === 0 ? "1" : "0";
        header.addEventListener('click', function() {
            const open = accordion.classList.toggle('open');
            content.style.maxHeight = open ? "10000px" : "0";
            header.querySelector(".arrow img").style.transform = open ? "rotate(90deg)" : "rotate(0deg)";
        });

        accordion.appendChild(header);
        accordion.appendChild(content);
        panel.appendChild(accordion);
    });
}