// ======================================================
// my_places.js - ACCORDION + SMART LOCATION FIX
// ======================================================

window.favTrips = JSON.parse(localStorage.getItem('favTrips') || '[]');

function saveFavTrips() {
    localStorage.setItem('favTrips', JSON.stringify(window.favTrips));
}

// ------------------------------------------------------
// 1. CSS (Accordion ve Kart Stilleri)
// ------------------------------------------------------
(function addSafeStyles() {
    const styleId = 'mp-accordion-styles';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        /* --- GRUP (ACCORDION) STİLLERİ --- */
        .mp-group {
            margin-bottom: 12px;
            background: #fff;
            border: 1px solid #e0e0e0;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        }

        /* Başlık (Tıklanabilir Alan) */
        .mp-group-header {
            padding: 14px 16px;
            background: #f8f9fa;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: background 0.2s;
            border-bottom: 1px solid transparent; /* Kapalıyken border yok */
        }
        .mp-group-header:hover {
            background: #f1f3f5;
        }
        
        /* Açık durumdayken başlık altı çizgi */
        .mp-group.open .mp-group-header {
            border-bottom: 1px solid #eee;
            background: #fff;
        }

        .mp-group-title {
            font-size: 15px;
            font-weight: 600;
            color: #6c3fc2; /* Mor Başlık */
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .mp-count-badge {
            font-size: 11px;
            font-weight: 500;
            color: #666;
            background: #e9ecef;
            padding: 2px 8px;
            border-radius: 10px;
        }

        /* Ok İkonu (Chevron) */
        .mp-chevron {
            font-size: 12px;
            color: #999;
            transition: transform 0.3s ease;
        }
        /* Açıkken ok dönsün */
        .mp-group.open .mp-chevron {
            transform: rotate(180deg);
        }

        /* İçerik Alanı (Animasyonlu Açılma) */
        .mp-group-content {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease-out;
            background: #fff;
        }
        .mp-group.open .mp-group-content {
            max-height: 2000px; /* Yeterince büyük bir değer */
            transition: max-height 0.5s ease-in;
        }
        
        .mp-list-padding {
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        /* --- KART YAPISI (mp- prefix) --- */
        .mp-card {
            background: #fff;
            border: 1px solid #eee;
            border-radius: 10px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 2px 5px rgba(0,0,0,0.03);
        }

        .mp-header-inner {
            display: flex;
            padding: 10px;
            gap: 12px;
            align-items: center;
            border-bottom: 1px solid #f9f9f9;
            position: relative;
        }

        .mp-img-box {
            width: 50px; height: 50px; flex-shrink: 0; border-radius: 6px; overflow: hidden; background: #eee;
        }
        .mp-img { width: 100%; height: 100%; object-fit: cover; }

        .mp-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .mp-title { font-size: 14px; font-weight: 600; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mp-cat { font-size: 11px; color: #666; background: #f5f5f5; padding: 2px 6px; border-radius: 4px; width: max-content; }

        .mp-remove {
            width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
            color: #ccc; cursor: pointer; border-radius: 4px; transition: 0.2s;
        }
        .mp-remove:hover { background: #ffebee; color: #d32f2f; }

        .mp-actions { display: flex; background: #fafafa; border-radius: 0 0 10px 10px; overflow: hidden; }
        .mp-btn {
            flex: 1; border: none; background: transparent; padding: 10px 5px;
            font-size: 13px; font-weight: 500; cursor: pointer;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            gap: 2px; transition: background 0.2s; color: #555;
        }
        .mp-btn-start { border-right: 1px solid #eee; color: #6c3fc2; }
        .mp-btn-start:hover { background: #f3e5f5; }
        .mp-btn-add { color: #1976d2; }
        .mp-btn-add:hover { background: #e3f2fd; }
        .mp-btn-disabled { background: #f5f5f5 !important; color: #ccc !important; cursor: not-allowed; }

        .mp-dist-warn { font-size: 10px; color: #e57373; margin-top: 2px; }
        .mp-dist-ok { font-size: 10px; color: #81c784; margin-top: 2px; }

        /* MODAL */
        .mp-modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.4); z-index: 99999;
            display: none; align-items: center; justify-content: center;
        }
        .mp-modal-content {
            background: #fff; width: 280px; padding: 20px;
            border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); text-align: center;
        }
        .mp-modal-list {
            display: flex; flex-direction: column; gap: 8px; margin-top: 15px; max-height: 300px; overflow-y: auto;
        }
        .mp-day-btn {
            background: #f8f9fa; border: 1px solid #eee; padding: 10px;
            border-radius: 6px; cursor: pointer; text-align: left; transition: 0.2s; font-size: 14px;
        }
        .mp-day-btn:hover { background: #e3f2fd; border-color: #90caf9; }
    `;
    document.head.appendChild(style);
})();

// ------------------------------------------------------
// 2. YARDIMCI FONKSİYONLAR
// ------------------------------------------------------

// "Unknown Country" sorununu çözen akıllı gruplama yardımcısı
function getSmartLocationName(place) {
    // 1. Varsa önceden tanımlı veriyi kullan
    if (place.city && place.country) {
        return `${place.city}, ${place.country}`;
    }

    // 2. Adres satırını analiz et (Address parsing)
    if (place.address) {
        const parts = place.address.split(',').map(s => s.trim());
        const country = parts[parts.length - 1]; // Genelde en son parça ülkedir
        
        // Şehri bulmaya çalış (Sondan bir önceki veya belli kelimeler hariç)
        let city = parts.length > 1 ? parts[parts.length - 2] : parts[0];
        
        // Eğer sayısal bir posta koduysa bir geriye git
        if (/\d/.test(city) && parts.length > 2) {
            city = parts[parts.length - 3];
        }

        // Ülke kontrolü (Boşsa veya sayıysa düzelt)
        if (!country || /\d/.test(country)) {
            return city || "Other Locations";
        }
        
        return `${city}, ${country}`;
    }

    return "Saved Places"; // Hiçbir bilgi yoksa
}

// Favorileri kendi yazdığımız güvenli fonksiyonla grupla
function groupFavoritesSmartly(list) {
    const groups = {};
    list.forEach(item => {
        const key = getSmartLocationName(item);
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });
    return groups;
}

// Mesafe Hesaplama
function checkPlaceDistance(placeLat, placeLon) {
    if (!window.cart || window.cart.length === 0) return { ok: true, text: "" };
    const validItems = window.cart.filter(i => i.location && i.location.lat && i._type !== 'placeholder');
    if (validItems.length === 0) return { ok: true, text: "" };
    
    const lastItem = validItems[validItems.length - 1];
    if (typeof haversine !== 'function') return { ok: true, text: "" };

    const distMeters = haversine(
        Number(lastItem.location.lat), Number(lastItem.location.lng),
        Number(placeLat), Number(placeLon)
    );
    const km = (distMeters / 1000).toFixed(0);
    
    if (distMeters > 600000) return { ok: false, text: `${km} km (Too far)` };
    return { ok: true, text: `${km} km away` };
}

// Gün Seçim Modalı
function openDayPicker(place, callback) {
    let maxDay = 1;
    if (window.cart && window.cart.length > 0) {
        maxDay = Math.max(...window.cart.map(i => i.dailyIndex || 1));
    }
    if (maxDay <= 1) { callback(1); return; }

    let overlay = document.getElementById('mp-day-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'mp-day-overlay';
        overlay.className = 'mp-modal-overlay';
        overlay.innerHTML = `
            <div class="mp-modal-content">
                <h3 style="margin:0; font-size:16px;">Add to which day?</h3>
                <div class="mp-modal-list" id="mp-day-list"></div>
                <button onclick="document.getElementById('mp-day-overlay').style.display='none'" 
                    style="margin-top:15px; background:none; border:none; color:#999; cursor:pointer;">Cancel</button>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    const listEl = document.getElementById('mp-day-list');
    listEl.innerHTML = '';
    for (let i = 1; i <= maxDay; i++) {
        const btn = document.createElement('button');
        btn.className = 'mp-day-btn';
        btn.innerHTML = `📅 <b>Day ${i}</b>`;
        btn.onclick = () => {
            document.getElementById('mp-day-overlay').style.display = 'none';
            callback(i);
        };
        listEl.appendChild(btn);
    }
    overlay.style.display = 'flex';
}

// Akordiyon Toggle Fonksiyonu
window.toggleMyPlacesGroup = function(headerEl) {
    const group = headerEl.parentElement;
    group.classList.toggle('open');
};

// ------------------------------------------------------
// 3. RENDER FONKSİYONU
// ------------------------------------------------------
async function renderFavoritePlacesPanel() {
    const favPanel = document.getElementById("favorite-places-panel");
    if (!favPanel) return;
    favPanel.innerHTML = "";

    const favList = window.favTrips || [];
    if (favList.length === 0) {
        favPanel.innerHTML = `<div style="text-align:center;padding:30px;color:#999;">No saved places yet.</div>`;
        return;
    }

    // Yeni akıllı gruplama fonksiyonunu kullan
    const grouped = groupFavoritesSmartly(favList);

    Object.entries(grouped).forEach(([locationKey, places], index) => {
        // --- GRUP KONTEYNERİ (ACCORDION ITEM) ---
        const groupDiv = document.createElement("div");
        groupDiv.className = "mp-group";
        
        // İlk grup varsayılan olarak açık olsun, diğerleri kapalı
        if (index === 0) groupDiv.classList.add('open'); 

        // --- BAŞLIK (HEADER) ---
        const header = document.createElement("div");
        header.className = "mp-group-header";
        header.onclick = function() { window.toggleMyPlacesGroup(this); };
        
        header.innerHTML = `
            <div class="mp-group-title">
                ${locationKey}
                <span class="mp-count-badge">${places.length}</span>
            </div>
            <div class="mp-chevron">▼</div>
        `;

        // --- İÇERİK (CONTENT) ---
        const contentDiv = document.createElement("div");
        contentDiv.className = "mp-group-content";
        
        const listPadding = document.createElement("div");
        listPadding.className = "mp-list-padding";

        places.forEach((place) => {
            const status = checkPlaceDistance(place.lat, place.lon);

            // KART OLUŞTURMA
            const card = document.createElement("div");
            card.className = "mp-card";

            // Header Inner
            card.innerHTML = `
                <div class="mp-header-inner">
                    <div class="mp-img-box">
                        <img src="${place.image || 'img/placeholder.png'}" class="mp-img" onerror="this.src='img/default_place.jpg'">
                    </div>
                    <div class="mp-info">
                        <div class="mp-title" title="${place.name}">${place.name}</div>
                        <div class="mp-cat">${place.category || 'Place'}</div>
                    </div>
                </div>
            `;

            // Silme Butonu (JS ile ekle, event için)
            const removeBtn = document.createElement("div");
            removeBtn.className = "mp-remove";
            removeBtn.innerHTML = "✕";
            removeBtn.onclick = (e) => {
                e.stopPropagation(); // Accordion kapanmasın
                if(confirm(`Remove "${place.name}" from favorites?`)) {
                    const delIdx = window.favTrips.findIndex(f => f.name === place.name && String(f.lat) === String(place.lat));
                    if (delIdx > -1) {
                        window.favTrips.splice(delIdx, 1);
                        saveFavTrips();
                        renderFavoritePlacesPanel();
                        if(typeof updateAllFavVisuals === 'function') updateAllFavVisuals();
                    }
                }
            };
            card.querySelector('.mp-header-inner').appendChild(removeBtn);

            // Aksiyon Butonları
            const actions = document.createElement("div");
            actions.className = "mp-actions";

            // Start New
            const btnStart = document.createElement("button");
            btnStart.className = "mp-btn mp-btn-start";
            btnStart.innerHTML = `<span>▶ Start New</span>`;
            btnStart.onclick = () => startNewTripWithPlace(place);

            // Add Trip
            const btnAdd = document.createElement("button");
            const btnClass = status.ok ? "mp-btn mp-btn-add" : "mp-btn mp-btn-disabled";
            const distInfo = status.ok 
                ? `<span class="mp-dist-ok">${status.text}</span>` 
                : `<span class="mp-dist-warn">${status.text}</span>`;
            
            btnAdd.className = btnClass;
            btnAdd.innerHTML = `<span>+ Add Trip</span> ${distInfo}`;
            
            if (status.ok) {
                btnAdd.onclick = () => {
                    openDayPicker(place, (day) => {
                         if (typeof addToCart === "function") {
                            addToCart(
                                place.name, place.image, day, place.category,
                                place.address || "", null, null, place.opening_hours || "", null,
                                { lat: Number(place.lat), lng: Number(place.lon) }, place.website || ""
                            );
                            if (typeof updateCart === "function") updateCart();
                            renderFavoritePlacesPanel();
                        }
                    });
                };
            } else {
                btnAdd.title = "Too far from current trip route";
            }

            actions.appendChild(btnStart);
            actions.appendChild(btnAdd);
            card.appendChild(actions);

            listPadding.appendChild(card);
        });

        contentDiv.appendChild(listPadding);
        groupDiv.appendChild(header);
        groupDiv.appendChild(contentDiv);
        favPanel.appendChild(groupDiv);
    });
}