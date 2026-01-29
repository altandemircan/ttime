// ======================================================
// my_places.js - DAY SELECTION & ADVANCED LAYOUT
// ======================================================

window.favTrips = JSON.parse(localStorage.getItem('favTrips') || '[]');

function saveFavTrips() {
    localStorage.setItem('favTrips', JSON.stringify(window.favTrips));
}

// ------------------------------------------------------
// 1. CSS STYLES (JS ile inject ediyoruz)
// ------------------------------------------------------
(function addMyPlacesStyles() {
    const styleId = 'my-places-advanced-v2';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        /* Kart Yapısı */
        .fav-item-container {
            background: #fff;
            border: 1px solid #eee;
            border-radius: 12px;
            padding: 12px;
            margin-bottom: 12px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.03);
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        /* Üst Kısım: Resim + Bilgi + Sil Butonu */
        .fav-item-top {
            display: flex;
            gap: 12px;
            position: relative;
        }

        .fav-img-wrapper {
            width: 50px; height: 50px;
            flex-shrink: 0;
        }
        .fav-img {
            width: 100%; height: 100%;
            object-fit: cover; border-radius: 8px;
        }

        .fav-info {
            flex: 1; display: flex; flex-direction: column; justify-content: center;
            overflow: hidden;
        }
        .fav-name {
            font-size: 15px; font-weight: 600; color: #333;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .fav-cat {
            font-size: 12px; color: #666; background: #f0f2f5;
            padding: 2px 8px; border-radius: 4px; width: max-content;
            margin-top: 4px;
        }

        /* Sağ Üst Silme Butonu (X) */
        .fav-remove-x {
            width: 24px; height: 24px;
            display: flex; align-items: center; justify-content: center;
            color: #999; cursor: pointer; border-radius: 50%;
            font-size: 18px; line-height: 1;
            transition: all 0.2s;
        }
        .fav-remove-x:hover {
            background: #ffecec; color: #d32f2f;
        }

        /* Alt Kısım: Aksiyon Butonları (Yan Yana) */
        .fav-actions {
            display: flex; gap: 8px;
            border-top: 1px solid #f5f5f5;
            padding-top: 10px;
        }

        .fav-btn {
            flex: 1;
            display: flex; align-items: center; justify-content: center; gap: 6px;
            padding: 8px;
            border-radius: 8px;
            font-size: 13px; font-weight: 500;
            cursor: pointer; border: none;
            transition: transform 0.1s, background 0.2s;
        }
        .fav-btn:active { transform: scale(0.98); }

        /* Buton Renkleri */
        .btn-new-plan {
            background: #f3e5f5; color: #7b1fa2; /* Morumsu */
        }
        .btn-new-plan:hover { background: #e1bee7; }

        .btn-add-trip {
            background: #e3f2fd; color: #1565c0; /* Mavi */
        }
        .btn-add-trip:hover { background: #bbdefb; }

        /* Disabled / Uzak Mesafe */
        .btn-add-trip.disabled {
            background: #f5f5f5; color: #bdbdbd;
            cursor: not-allowed;
        }

        /* Mesafe Etiketi */
        .dist-tag {
            font-size: 10px; font-weight: normal; opacity: 0.8;
            margin-left: 2px;
        }

        /* --- DAY PICKER MODAL --- */
        .day-picker-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); z-index: 10000;
            display: flex; align-items: center; justify-content: center;
            opacity: 0; visibility: hidden; transition: opacity 0.2s;
        }
        .day-picker-overlay.show { opacity: 1; visibility: visible; }
        
        .day-picker-modal {
            background: #fff; width: 90%; max-width: 320px;
            border-radius: 16px; padding: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            transform: scale(0.9); transition: transform 0.2s;
        }
        .day-picker-overlay.show .day-picker-modal { transform: scale(1); }

        .day-picker-title { font-size: 16px; font-weight: bold; margin-bottom: 15px; color:#333; text-align:center;}
        .day-list { display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; }
        
        .day-btn {
            background: #f8f9fa; border: 1px solid #eee; padding: 12px;
            border-radius: 8px; text-align: left; font-size: 14px; color: #333;
            cursor: pointer; transition: background 0.2s; display: flex; justify-content: space-between;
        }
        .day-btn:hover { background: #e3f2fd; border-color: #bbdefb; color: #1565c0; }
        .day-btn strong { font-weight: 600; }
    `;
    document.head.appendChild(style);
})();

// ------------------------------------------------------
// 2. YARDIMCI FONKSİYONLAR
// ------------------------------------------------------

// Mesafe ve Uygunluk Kontrolü
function getPlaceAddStatus(placeLat, placeLon) {
    if (!window.cart || window.cart.length === 0) return { canAdd: true, distText: "" };
    
    // Sepetteki son geçerli lokasyonu bul
    const validItems = window.cart.filter(i => i.location && i.location.lat && i._type !== 'placeholder');
    if (validItems.length === 0) return { canAdd: true, distText: "" };
    
    const lastItem = validItems[validItems.length - 1];
    
    if (typeof haversine !== 'function') return { canAdd: true, distText: "" };

    const distMeters = haversine(
        Number(lastItem.location.lat), Number(lastItem.location.lng),
        Number(placeLat), Number(placeLon)
    );
    
    const distKm = (distMeters / 1000).toFixed(0);
    
    if (distMeters > 600000) { // 600km limiti
        return { canAdd: false, distText: `${distKm}km away (Too far)` };
    }
    return { canAdd: true, distText: `${distKm}km away` };
}

// Gün Seçim Modalı Göster
function showDaySelectionModal(place, callback) {
    // Mevcut günleri bul
    let maxDay = 1;
    if (window.cart && window.cart.length > 0) {
        maxDay = Math.max(...window.cart.map(i => i.dailyIndex || 1));
    }

    // Eğer sadece 1 gün varsa, direkt ekle (Modala gerek yok)
    if (maxDay <= 1) {
        callback(1);
        return;
    }

    // Modal DOM yapısını oluştur (yoksa)
    let overlay = document.getElementById('day-picker-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'day-picker-overlay';
        overlay.className = 'day-picker-overlay';
        overlay.innerHTML = `
            <div class="day-picker-modal">
                <div class="day-picker-title">Select Day to Add</div>
                <div class="day-list" id="day-picker-list"></div>
                <button onclick="document.getElementById('day-picker-overlay').classList.remove('show')" 
                        style="width:100%; margin-top:12px; padding:10px; background:none; border:none; color:#666; cursor:pointer;">
                    Cancel
                </button>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    const listEl = document.getElementById('day-picker-list');
    listEl.innerHTML = ''; // Temizle

    // Günleri Listele
    for (let i = 1; i <= maxDay; i++) {
        const btn = document.createElement('button');
        btn.className = 'day-btn';
        btn.innerHTML = `<span>Day <strong>${i}</strong></span> <span>➜</span>`;
        btn.onclick = function() {
            document.getElementById('day-picker-overlay').classList.remove('show');
            callback(i); // Seçilen günü fonksiyona geri döndür
        };
        listEl.appendChild(btn);
    }

    // Göster
    setTimeout(() => overlay.classList.add('show'), 10);
}

// ------------------------------------------------------
// 3. ANA RENDER FONKSİYONU
// ------------------------------------------------------
async function renderFavoritePlacesPanel() {
    const favPanel = document.getElementById("favorite-places-panel");
    if (!favPanel) return;
    favPanel.innerHTML = "";

    const favList = window.favTrips || [];
    if (favList.length === 0) {
        favPanel.innerHTML = `<div style="text-align:center;padding:30px;color:#999;">No saved places.</div>`;
        return;
    }

    const grouped = groupFavoritesByCountryCity(favList);

    Object.entries(grouped).forEach(([locationKey, places]) => {
        // Şehir Başlığı
        const groupDiv = document.createElement("div");
        groupDiv.style = "margin-bottom: 20px;";
        groupDiv.innerHTML = `<h3 style="margin:0 0 10px 4px; color:#6c3fc2; font-size:16px;">${locationKey}</h3>`;

        places.forEach((place) => {
            // Mesafe Kontrolü
            const status = getPlaceAddStatus(place.lat, place.lon);

            // KART CONTAINER
            const card = document.createElement("div");
            card.className = "fav-item-container";

            // --- ÜST KISIM (Resim, Bilgi, Sil) ---
            const topDiv = document.createElement("div");
            topDiv.className = "fav-item-top";

            // Resim
            const imgWrap = document.createElement("div");
            imgWrap.className = "fav-img-wrapper";
            imgWrap.innerHTML = `<img src="${place.image || 'img/placeholder.png'}" class="fav-img" onerror="this.src='img/default_place.jpg'">`;
            
            // Bilgi
            const infoDiv = document.createElement("div");
            infoDiv.className = "fav-info";
            infoDiv.innerHTML = `
                <div class="fav-name" title="${place.name}">${place.name}</div>
                <div class="fav-cat">${place.category || 'Place'}</div>
            `;

            // Silme Butonu (X)
            const removeBtn = document.createElement("div");
            removeBtn.className = "fav-remove-x";
            removeBtn.title = "Remove from list";
            removeBtn.innerHTML = "&times;"; // Çarpı işareti
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                if(confirm("Remove this place from favorites?")) {
                    const delIdx = window.favTrips.findIndex(f => f.name === place.name && String(f.lat) === String(place.lat));
                    if (delIdx > -1) {
                        window.favTrips.splice(delIdx, 1);
                        saveFavTrips();
                        renderFavoritePlacesPanel();
                        if(typeof updateAllFavVisuals === 'function') updateAllFavVisuals();
                    }
                }
            };

            topDiv.appendChild(imgWrap);
            topDiv.appendChild(infoDiv);
            topDiv.appendChild(removeBtn);

            // --- ALT KISIM (Butonlar) ---
            const actionsDiv = document.createElement("div");
            actionsDiv.className = "fav-actions";

            // 1. START NEW TRIP
            const startBtn = document.createElement("button");
            startBtn.className = "fav-btn btn-new-plan";
            startBtn.innerHTML = `<span>🚀</span> Start New Plan`;
            startBtn.onclick = () => startNewTripWithPlace(place);

            // 2. ADD TO CURRENT
            const addBtn = document.createElement("button");
            addBtn.className = `fav-btn btn-add-trip ${!status.canAdd ? 'disabled' : ''}`;
            
            // Buton metni: Mesafe bilgisini parantez içinde gösteriyoruz
            const kmInfo = status.distText ? `<span class="dist-tag">(${status.distText})</span>` : '';
            addBtn.innerHTML = `<span>+</span> Add to Trip ${kmInfo}`;
            
            if (!status.canAdd) {
                addBtn.title = `Too far to add (${status.distText})`;
            } else {
                addBtn.onclick = () => {
                    // GÜN SEÇİM MODALINI ÇAĞIR
                    showDaySelectionModal(place, (selectedDay) => {
                        if (typeof addToCart === "function") {
                            addToCart(
                                place.name,
                                place.image,
                                selectedDay, // Kullanıcının seçtiği gün
                                place.category,
                                place.address || "",
                                null, null, place.opening_hours || "",
                                null,
                                { lat: Number(place.lat), lng: Number(place.lon) },
                                place.website || ""
                            );
                        }
                        if (typeof updateCart === "function") updateCart();
                        renderFavoritePlacesPanel(); // State güncelle
                    });
                };
            }

            actionsDiv.appendChild(startBtn);
            actionsDiv.appendChild(addBtn);

            card.appendChild(topDiv);
            card.appendChild(actionsDiv);
            
            groupDiv.appendChild(card);
        });

        favPanel.appendChild(groupDiv);
    });
}