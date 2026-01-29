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
    panel.innerHTML = "";

    const list = window.favTrips || [];
    if (list.length === 0) {
        panel.innerHTML = `<div class="mytrips-empty">No saved places.</div>`;
        return;
    }
    const groups = groupFavoritesClean(list);

    Object.entries(groups).forEach(([key, items], idx) => {
        // ---- Başlık kutusu
        const groupBox = document.createElement("div");
        groupBox.style.marginBottom = "30px";
        
        // Gün başlığı
        const dayHeader = document.createElement("div");
        dayHeader.className = "day-header";
        dayHeader.innerHTML = `
            <span class="title-container" style="font-size:1.2rem;">
              ${key}
            </span>
        `;

        // + Altındaki Liste (her biri = modern travel-item)
        const ul = document.createElement("ul");
        ul.className = "day-list"; // veya "accordion-list day-list" gibi birleştir
        
        items.forEach((place, i) => {
            const li = document.createElement("li");
            li.className = "travel-item"; // radius, shadow, bg hazır geliyor

            // Numara yuvarlak
            const marker = `
              <span class="custom-marker-outer" style="background:#d32f2f;width:34px;height:34px;box-shadow:0 2px 8px #0001;">
                <span class="custom-marker-label" style="font-size:1.12em;">${i+1}</span>
              </span>`;

            // Kategori ikonu
            const categoryIcon = place.icon ? `<img src="${place.icon}" class="category-icon" />` : "";

            // Sol küçük foto
            const img = `<img src="${place.image||'img/placeholder.png'}" class="cart-item" style="margin-right:0;width:48px;height:48px;border-radius:11px;object-fit:cover;">`;

            // Sağ ok
            const arrow = `<span class="arrow" style="margin-left:auto;"><img src="img/arrow-right.svg" style="width:20px;height:20px;opacity:0.45;"></span>`;

            // Mesafe barı (altı)
            let distanceRow = '';
            if (place.distanceKm && place.durationMin) {
                distanceRow = `
                  <div class="distance-label" style="font-size:0.95em;color:#888;margin-top:8px;display:flex;gap:18px;align-items:center;">
                      <img src="img/bike.svg" style="width:18px;height:18px;opacity:0.55;"> 
                      ${place.distanceKm} km • ${place.durationMin} min
                  </div>
                `;
            }

            li.innerHTML = `
              <div class="cart-item" style="gap:15px;align-items:center;">
                ${marker}
                ${img}
                <span class="trip-title" style="font-weight:700;font-size:1.1em;color:#355;">
                  ${categoryIcon}
                  ${place.name}
                </span>
                ${arrow}
              </div>
              ${distanceRow}
            `.replace(/\s{2,}/g, " "); // fazla whitespace sil

            ul.appendChild(li);
        });

        groupBox.appendChild(dayHeader);
        groupBox.appendChild(ul);
        panel.appendChild(groupBox);
    });
}