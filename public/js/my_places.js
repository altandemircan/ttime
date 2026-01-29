// ======================================================
// my_places.js - IZOLATED STYLES & DAY PICKER
// ======================================================

window.favTrips = JSON.parse(localStorage.getItem('favTrips') || '[]');

function saveFavTrips() {
    localStorage.setItem('favTrips', JSON.stringify(window.favTrips));
}

// ------------------------------------------------------
// 1. CSS (Tamamen İzole Edilmiş - Çakışma Yapmaz)
// ------------------------------------------------------
(function addSafeStyles() {
    const styleId = 'mp-isolated-styles';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        /* -- KART YAPISI (mp- prefix ile korumalı) -- */
        .mp-card {
            background: #fff;
            border: 1px solid #e0e0e0;
            border-radius: 10px;
            margin-bottom: 12px;
            overflow: hidden; /* Taşmaları engelle */
            display: flex;
            flex-direction: column;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        /* Üst Kısım: Resim ve Metin */
        .mp-header {
            display: flex;
            padding: 10px;
            gap: 12px;
            align-items: center;
            border-bottom: 1px solid #f0f0f0;
            position: relative;
        }

        .mp-img-box {
            width: 50px;
            height: 50px;
            flex-shrink: 0; /* Küçülmesini engelle */
            border-radius: 6px;
            overflow: hidden;
            background: #eee;
        }
        .mp-img {
            width: 100%; height: 100%; object-fit: cover;
        }

        .mp-info {
            flex: 1; /* Kalan alanı kapla */
            min-width: 0; /* Taşma sorunu fix */
            display: flex; flex-direction: column; gap: 3px;
        }
        .mp-title {
            font-size: 14px; font-weight: 600; color: #333;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .mp-cat {
            font-size: 11px; color: #666; background: #f5f5f5;
            padding: 2px 6px; border-radius: 4px; width: max-content;
        }

        /* Silme İkonu (Sağ Üst) */
        .mp-remove {
            width: 24px; height: 24px;
            display: flex; align-items: center; justify-content: center;
            color: #bbb; cursor: pointer; border-radius: 4px;
            transition: 0.2s;
        }
        .mp-remove:hover { background: #ffebee; color: #d32f2f; }

        /* Alt Kısım: Butonlar */
        .mp-actions {
            display: flex;
            background: #fafafa;
        }
        
        .mp-btn {
            flex: 1; /* Eşit genişlik */
            border: none;
            background: transparent;
            padding: 10px 5px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            gap: 2px;
            transition: background 0.2s;
            height: auto;
            color: #555;
        }
        
        /* Sol Buton: Start New */
        .mp-btn-start {
            border-right: 1px solid #eee;
            color: #6c3fc2; /* Senin temanın moru */
        }
        .mp-btn-start:hover { background: #f3e5f5; }

        /* Sağ Buton: Add Current */
        .mp-btn-add {
            color: #1976d2; /* Mavi */
        }
        .mp-btn-add:hover { background: #e3f2fd; }

        /* Disabled */
        .mp-btn-disabled {
            background: #f5f5f5 !important;
            color: #ccc !important;
            cursor: not-allowed;
        }

        .mp-dist-warn { font-size: 10px; color: #e57373; margin-top: 2px;}
        .mp-dist-ok { font-size: 10px; color: #81c784; margin-top: 2px;}

        /* --- MODAL (GÜN SEÇİMİ) --- */
        .mp-modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.4); z-index: 99999;
            display: none; align-items: center; justify-content: center;
        }
        .mp-modal-content {
            background: #fff; width: 280px; padding: 20px;
            border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            text-align: center;
        }
        .mp-modal-list {
            display: flex; flex-direction: column; gap: 8px; margin-top: 15px;
            max-height: 300px; overflow-y: auto;
        }
        .mp-day-btn {
            background: #f8f9fa; border: 1px solid #eee; padding: 10px;
            border-radius: 6px; cursor: pointer; text-align: left;
            transition: 0.2s; font-size: 14px;
        }
        .mp-day-btn:hover { background: #e3f2fd; border-color: #90caf9; }
    `;
    document.head.appendChild(style);
})();

// ------------------------------------------------------
// 2. YARDIMCI FONKSİYONLAR
// ------------------------------------------------------

// Mesafe Hesaplama
function checkPlaceDistance(placeLat, placeLon) {
    // Sepet boşsa veya lokasyon yoksa serbest
    if (!window.cart || window.cart.length === 0) return { ok: true, text: "" };
    
    // Son geçerli lokasyonu bul
    const validItems = window.cart.filter(i => i.location && i.location.lat && i._type !== 'placeholder');
    if (validItems.length === 0) return { ok: true, text: "" };
    
    const lastItem = validItems[validItems.length - 1];
    
    // Haversine (mainscript.js içinde olmalı, yoksa fallback)
    if (typeof haversine !== 'function') return { ok: true, text: "" };

    const distMeters = haversine(
        Number(lastItem.location.lat), Number(lastItem.location.lng),
        Number(placeLat), Number(placeLon)
    );
    
    const km = (distMeters / 1000).toFixed(0);
    
    if (distMeters > 600000) { // 600km limiti
        return { ok: false, text: `${km} km (Too far)` };
    }
    return { ok: true, text: `${km} km away` };
}

// Gün Seçim Modalı
function openDayPicker(place, callback) {
    // Kaç gün var?
    let maxDay = 1;
    if (window.cart && window.cart.length > 0) {
        maxDay = Math.max(...window.cart.map(i => i.dailyIndex || 1));
    }

    // Tek gün varsa sormadan ekle
    if (maxDay <= 1) {
        callback(1);
        return;
    }

    // Modal Oluştur (DOM'da yoksa)
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
    listEl.innerHTML = ''; // Temizle

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

// ------------------------------------------------------
// 3. RENDER PANEL (Kart Oluşturucu)
// ------------------------------------------------------
async function renderFavoritePlacesPanel() {
    const favPanel = document.getElementById("favorite-places-panel");
    if (!favPanel) return;
    favPanel.innerHTML = "";

    const favList = window.favTrips || [];
    if (favList.length === 0) {
        favPanel.innerHTML = `<div style="text-align:center;padding:20px;color:#999;">No saved places yet.</div>`;
        return;
    }

    const grouped = groupFavoritesByCountryCity(favList);

    Object.entries(grouped).forEach(([locationKey, places]) => {
        // Şehir Başlığı
        const groupDiv = document.createElement("div");
        groupDiv.style.marginBottom = "20px";
        groupDiv.innerHTML = `<h3 style="margin:0 0 10px 2px; color:#6c3fc2; font-size:16px;">${locationKey}</h3>`;

        places.forEach((place) => {
            const status = checkPlaceDistance(place.lat, place.lon);

            // --- KART BAŞLANGIÇ ---
            const card = document.createElement("div");
            card.className = "mp-card";

            // 1. ÜST KISIM (HEADER)
            const header = document.createElement("div");
            header.className = "mp-header";

            header.innerHTML = `
                <div class="mp-img-box">
                    <img src="${place.image || 'img/placeholder.png'}" class="mp-img" onerror="this.src='img/default_place.jpg'">
                </div>
                <div class="mp-info">
                    <div class="mp-title" title="${place.name}">${place.name}</div>
                    <div class="mp-cat">${place.category || 'Place'}</div>
                </div>
            `;

            // Silme Butonu (Header içinde sağda)
            const removeBtn = document.createElement("div");
            removeBtn.className = "mp-remove";
            removeBtn.innerHTML = "✕"; // Çarpı
            removeBtn.title = "Remove from favorites";
            removeBtn.onclick = () => {
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
            header.appendChild(removeBtn);

            // 2. ALT KISIM (BUTONLAR)
            const actions = document.createElement("div");
            actions.className = "mp-actions";

            // Buton: Start New
            const btnStart = document.createElement("button");
            btnStart.className = "mp-btn mp-btn-start";
            btnStart.innerHTML = `<span>▶ Start New</span>`;
            btnStart.onclick = () => startNewTripWithPlace(place);

            // Buton: Add Current
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
                            renderFavoritePlacesPanel(); // State güncelle
                        }
                    });
                };
            } else {
                btnAdd.title = "Too far from current trip route";
            }

            actions.appendChild(btnStart);
            actions.appendChild(btnAdd);

            card.appendChild(header);
            card.appendChild(actions);
            groupDiv.appendChild(card);
            // --- KART BİTİŞ ---
        });

        favPanel.appendChild(groupDiv);
    });
}