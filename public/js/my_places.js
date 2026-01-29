// ======================================================
// my_places.js - TAMAMEN GÜNCELLENMİŞ VERSİYON
// ======================================================

// 1. BAŞLANGIÇ AYARLARI VE STATE
window.favTrips = JSON.parse(localStorage.getItem('favTrips') || '[]');

function saveFavTrips() {
    localStorage.setItem('favTrips', JSON.stringify(window.favTrips));
}

function getFavoriteTrips() {
    return window.favTrips || [];
}

// 2. GLOBAL EVENT LISTENER (Tüm Tıklamaları Burası Yönetir)
// Bu kısım sayesinde "attachFavEvents" çağırmaya veya inline onclick yazmaya gerek kalmaz.
document.addEventListener('click', async function(e) {
    
    // A) .add-favorite-btn BUTONUNA TIKLANDIYSA (Sepet veya Liste)
    const btn = e.target.closest('.add-favorite-btn');
    if (btn) {
        // Eğer butonun kendi onclick'i varsa (HTML'den gelen), çakışmayı önle
        // Ama biz burada işi hallediyoruz.
        e.preventDefault();
        e.stopPropagation();

        const heartEl = btn.querySelector('.fav-heart');
        if (!heartEl) return;

        // Verileri al
        const item = {
            name: btn.getAttribute('data-name'),
            category: btn.getAttribute('data-category'),
            lat: btn.getAttribute('data-lat'),
            lon: btn.getAttribute('data-lon'),
            image: btn.getAttribute('data-image') || ""
        };

        // İşlemi yap
        await toggleFavTrip(item, heartEl);
        
        // Yazıyı ve durumu güncelle
        updateFavoriteBtnText(heartEl);
        return; 
    }

    // B) SADECE .fav-heart İKONUNA TIKLANDIYSA (Slider gibi butonsuz yerler)
    const heart = e.target.closest('.fav-heart');
    if (heart && !heart.closest('.add-favorite-btn')) {
        e.preventDefault();
        e.stopPropagation();

        const item = {
            name: heart.getAttribute('data-name'),
            category: heart.getAttribute('data-category'),
            lat: heart.getAttribute('data-lat'),
            lon: heart.getAttribute('data-lon'),
            image: heart.getAttribute('data-image') || ""
        };

        await toggleFavTrip(item, heart);
        // İkon durumunu güncelle (Yazı olmadığı için sadece görsel)
        updateAllFavVisuals(); 
    }
});

// Eski kodlarla uyumluluk için boş fonksiyon (Hata vermemesi için kalsın)
function attachFavEvents() {
    // Artık eventler yukarıdaki Global Listener ile yönetiliyor.
    // Burası bilerek boş bırakıldı.
}

// Inline HTML'de "toggleFavFromCart(this)" kaldıysa hata vermesin diye bu da kalsın
// Ama asıl işi yukarıdaki listener yapıyor.
window.toggleFavFromCart = async function(btn) {
    // Global listener zaten yakalayacağı için burayı boş geçebiliriz 
    // veya manuel tetiklemek istersek bırakabiliriz. 
    // Çakışmayı önlemek için boş bırakıyorum, listener halledecek.
};

// 3. ANA MANTIK FONKSİYONLARI

async function toggleFavTrip(item, heartEl) {
    // Liste yoksa oluştur
    window.favTrips = window.favTrips || [];

    // Veri eksiklerini tamamla
    fillMissingItemData(item);

    // Favoride mi kontrol et
    const idx = window.favTrips.findIndex(f =>
        f.name === item.name &&
        String(f.lat) === String(item.lat)
    );

    if (idx >= 0) {
        // VARSA ÇIKAR
        window.favTrips.splice(idx, 1);
        console.log("Removed from favorites:", item.name);
    } else {
        // YOKSA EKLE
        window.favTrips.push(item);
        console.log("Added to favorites:", item.name);
    }

    // Kaydet
    saveFavTrips();
    
    // Görünümü Güncelle (Tüm sayfadaki aynı itemları bulup güncelle)
    updateAllFavVisuals();
    
    // Eğer My Places paneli açıksa orayı da yenile
    renderFavoritePlacesPanel();
}

// Yardımcı: Eksik verileri doldurur
async function fillMissingItemData(item) {
    if (!item.city || !item.country) {
        item.city = window.selectedCity || "Unknown City";
        item.country = "Unknown Country";
    }
    if (!item.image || item.image === "" || item.image.includes("placeholder")) {
        // Eğer görsel yoksa varsayılan
        item.image = "img/placeholder.png"; 
    }
}

// Yardımcı: Sayfadaki TÜM favori butonlarının ikonunu ve yazısını senkronize eder
function updateAllFavVisuals() {
    const allBtns = document.querySelectorAll('.add-favorite-btn, .fav-heart');
    
    allBtns.forEach(el => {
        // Bu bir buton mu kalp mi?
        const isBtn = el.classList.contains('add-favorite-btn');
        const heartEl = isBtn ? el.querySelector('.fav-heart') : el;
        
        if (!heartEl) return;

        const name = el.getAttribute('data-name') || heartEl.getAttribute('data-name');
        const lat = el.getAttribute('data-lat') || heartEl.getAttribute('data-lat');
        
        // Bu item favorilerde var mı?
        const isFav = window.favTrips.some(f => f.name === name && String(f.lat) === String(lat));

        // İkonu güncelle
        const img = heartEl.querySelector('img');
        if (img) {
            img.src = isFav ? "img/like_on.svg" : "img/like_off.svg";
        }
        
        if (isFav) heartEl.classList.add('is-fav');
        else heartEl.classList.remove('is-fav');

        // Eğer butonsa yazısını güncelle
        if (isBtn) {
            updateFavoriteBtnText(heartEl);
        }
    });
}

// Buton textini güncelleyen fonksiyon
function updateFavoriteBtnText(favHeartEl) {
    const btn = favHeartEl.closest('.add-favorite-btn');
    if (!btn) return;
    
    const name = favHeartEl.getAttribute('data-name');
    const lat = favHeartEl.getAttribute('data-lat');
    
    const isFav = window.favTrips.some(f => f.name === name && String(f.lat) === String(lat));
    
    const btnText = btn.querySelector('.fav-btn-text');
    if (btnText) {
        if (isFav) {
            btnText.textContent = "Remove from My Places";
        } else {
            btnText.textContent = "Add to My Places";
        }
    }
}

function isTripFav(item) {
    return window.favTrips && window.favTrips.some(f =>
        f.name === item.name &&
        String(f.lat) === String(item.lat)
    );
}


// 4. FAVORİ PANELİ RENDER (Sidebar için)

function groupFavoritesByCountryCity(favList) {
    const grouped = {};
    favList.forEach(place => {
        const city = place.city && place.city !== "Unknown City" ? place.city : "";
        const country = place.country && place.country !== "Unknown Country" ? place.country : "";
        let key = "";
        if (city && country) key = `${city}, ${country}`;
        else if (city) key = city;
        else if (country) key = country;
        else key = "Unknown";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(place);
    });
    return grouped;
}

async function renderFavoritePlacesPanel() {
    const favPanel = document.getElementById("favorite-places-panel");
    if (!favPanel) return;
    favPanel.innerHTML = "";

    const favList = window.favTrips || [];
    if (favList.length === 0) {
        favPanel.innerHTML = `<div style="text-align:center;padding:20px;color:#999;">No favorite places yet.</div>`;
        return;
    }

    const grouped = groupFavoritesByCountryCity(favList);

    Object.entries(grouped).forEach(([locationKey, places]) => {
        // Şehir Başlığı
        const groupDiv = document.createElement("div");
        groupDiv.className = "fav-place-group";
        groupDiv.innerHTML = `<h3 style="margin-bottom:10px; color:#6c3fc2;">${locationKey}</h3>`;

        const ul = document.createElement("ul");
        ul.style = "list-style: none; padding: 0px; margin: 0px;";

        places.forEach((place) => {
            // --- MESAFE KONTROLÜ ---
            // isPlaceAddableToCurrentTrip fonksiyonu önceki cevaptaki gibi olmalı
            const check = typeof isPlaceAddableToCurrentTrip === 'function' 
                          ? isPlaceAddableToCurrentTrip(place.lat, place.lon) 
                          : { canAdd: true, reason: "" };

            const li = document.createElement("li");
            li.className = "fav-item";
            // Orijinal CSS inline stillerin:
            li.style = "margin-bottom: 12px; background: rgb(248, 249, 250); border-radius: 12px; box-shadow: rgb(227, 227, 227) 0px 1px 6px; padding: 9px 12px; display: flex; align-items: center; gap: 16px; min-width: 0px;";

            // GÖRSEL (Solda)
            const imgDiv = document.createElement("div");
            imgDiv.style = "width: 42px; height: 42px;";
            imgDiv.innerHTML = `<img src="${place.image || 'img/placeholder.png'}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">`;

            // BİLGİ (Ortada)
            const infoDiv = document.createElement("div");
            infoDiv.style = "flex: 1 1 0%; min-width: 0px; display: flex; flex-direction: column; gap: 2px;";
            infoDiv.innerHTML = `
                <span style="font-weight:500;font-size:15px;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${place.name}</span>
                <span style="font-size:11px;color:#1976d2;background:#e3e8ff;border-radius:6px;padding:1px 7px;display:inline-block;margin-top:2px;width:max-content;">${place.category || 'Place'}</span>
            `;

            // BUTONLAR (Sağda - Yan Yana 3 tane)
            const btnDiv = document.createElement("div");
            btnDiv.style = "display: flex; flex-direction: row; align-items: center; gap: 6px;";

            // 1. BUTON: START NEW (▶)
            const startBtn = document.createElement("button");
            startBtn.className = "fav-action-btn btn-fav-start";
            startBtn.title = "Start New Trip Plan";
            startBtn.innerHTML = "▶"; // Play ikonu
            startBtn.onclick = () => startNewTripWithPlace(place);

            // 2. BUTON: ADD TO CURRENT (+)
            const addBtn = document.createElement("button");
            addBtn.className = `fav-action-btn btn-fav-add ${!check.canAdd ? 'disabled' : ''}`;
            addBtn.title = check.canAdd ? "Add to Current Trip" : `Cannot add: ${check.reason}`;
            addBtn.innerHTML = "+";
            
            if (check.canAdd) {
                addBtn.onclick = () => {
                    if (typeof addToCart === "function") {
                        addToCart(
                            place.name, place.image, window.currentDay || 1, place.category,
                            place.address || "", null, null, place.opening_hours || "", null,
                            { lat: Number(place.lat), lng: Number(place.lon) }, place.website || ""
                        );
                    }
                    if (typeof updateCart === "function") updateCart();
                    renderFavoritePlacesPanel(); // State güncellemek için
                };
            }

            // 3. BUTON: REMOVE (–)
            const removeBtn = document.createElement("button");
            removeBtn.className = "fav-action-btn btn-fav-remove";
            removeBtn.title = "Remove from favorites";
            removeBtn.innerHTML = "–";
            removeBtn.onclick = () => {
                const delIdx = window.favTrips.findIndex(f => f.name === place.name && String(f.lat) === String(place.lat));
                if (delIdx > -1) {
                    window.favTrips.splice(delIdx, 1);
                    saveFavTrips();
                    renderFavoritePlacesPanel();
                    if(typeof updateAllFavVisuals === 'function') updateAllFavVisuals();
                }
            };

            btnDiv.appendChild(startBtn);
            btnDiv.appendChild(addBtn);
            btnDiv.appendChild(removeBtn);

            li.appendChild(imgDiv);
            li.appendChild(infoDiv);
            li.appendChild(btnDiv);
            ul.appendChild(li);
        });
        
        groupDiv.appendChild(ul);
        favPanel.appendChild(groupDiv);
    });
}

// my_places.js dosyasının en altına veya uygun bir yerine ekleyin
(function addMyPlacesStyles() {
    const styleId = 'my-places-advanced-styles';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        .fav-action-btn {
            width: 32px; height: 32px; border-radius: 50%; border: none; 
            display: flex; align-items: center; justify-content: center; 
            cursor: pointer; transition: all 0.2s ease;
            font-size: 16px;
        }
        
        /* Add to Current Trip Button */
        .btn-add-current { background: #1976d2; color: #fff; }
        .btn-add-current:hover { background: #1565c0; transform: scale(1.05); }
        
        /* Start New Trip Button */
        .btn-start-new { background: #6c3fc2; color: #fff; font-size: 14px; }
        .btn-start-new:hover { background: #5e35b1; transform: scale(1.05); }

        /* Remove Button */
        .btn-remove-fav { background: #ffecec; color: #d32f2f; }
        .btn-remove-fav:hover { background: #ffcdd2; transform: scale(1.05); }

        /* DISABLED STATE (Mesafe Limiti) */
        .btn-add-current.disabled {
            background: #e0e0e0; 
            color: #9e9e9e; 
            cursor: not-allowed; 
            transform: none !important;
            opacity: 0.7;
        }

        /* Tooltip benzeri uyarı için */
        .fav-item { position: relative; transition: opacity 0.3s; }
        .fav-item.dimmed { opacity: 0.6; background: #f0f0f0 !important; }
        .dist-warning {
            font-size: 10px; color: #d32f2f; background: #ffecec; 
            padding: 2px 6px; border-radius: 4px; margin-top: 4px; display: inline-block;
        }
    `;
    document.head.appendChild(style);
})();

// 600km Limit Kontrolü
function isPlaceAddableToCurrentTrip(placeLat, placeLon) {
    // 1. Sepet boşsa her yer eklenebilir
    if (!window.cart || window.cart.length === 0) return { canAdd: true, reason: "" };

    // 2. Sepetteki 'Place' veya 'Restaurant' gibi lokasyonlu itemları bul
    const validItems = window.cart.filter(i => 
        i.location && 
        isFinite(Number(i.location.lat)) && 
        isFinite(Number(i.location.lng)) &&
        !i._starter && !i._placeholder
    );

    // Eğer sepette henüz hiç lokasyon yoksa (Sadece gün başlıkları varsa) eklenebilir
    if (validItems.length === 0) return { canAdd: true, reason: "" };

    // 3. Son eklenen lokasyonu referans al
    const lastItem = validItems[validItems.length - 1];
    
    // Haversine (mainscript.js içinde tanımlı olmalı) ile mesafe ölç
    if (typeof haversine !== 'function') return { canAdd: true, reason: "" }; // Fallback

    const distMeters = haversine(
        Number(lastItem.location.lat), Number(lastItem.location.lng),
        Number(placeLat), Number(placeLon)
    );

    // 600km (600,000 metre) kontrolü
    if (distMeters > 600000) {
        return { 
            canAdd: false, 
            reason: `Too far (${(distMeters/1000).toFixed(0)}km)` 
        };
    }

    return { canAdd: true, reason: "" };
}

// Yeni Gezi Başlatma Fonksiyonu
async function startNewTripWithPlace(place) {
    if (confirm(`Start a brand new trip plan for "${place.city || place.name}"? Current plan will be saved.`)) {
        
        // 1. Mevcut geziyi kaydet (Varsa)
        if (typeof saveCurrentTripToStorage === "function") await saveCurrentTripToStorage();

        // 2. Her şeyi sıfırla (mainscript.js'deki reset mantığına benzer)
        window.cart = [];
        window.activeTripKey = null;
        window.lastUserQuery = "";
        window.selectedCity = place.city || place.name;
        
        // Haritaları temizle
        if (typeof closeAllExpandedMapsAndReset === "function") closeAllExpandedMapsAndReset();
        if (typeof clearAllRouteCaches === "function") clearAllRouteCaches();

        // 3. Bu mekanı 1. güne ekle
        addToCart(
            place.name,
            place.image,
            1, // 1. Gün
            place.category,
            place.address || "",
            null, null, place.opening_hours || "",
            null,
            { lat: Number(place.lat), lng: Number(place.lon) },
            place.website || ""
        );

        // 4. UI Güncelle
        if (typeof updateCart === "function") updateCart();
        
        // 5. Sidebar'ı kapat (Mobilde)
        const overlay = document.getElementById('sidebar-overlay-favorite-places');
        if (overlay) overlay.classList.remove('open');
        
        // 6. Chat/Input alanını bu şehre göre ayarla
        const inputWrapper = document.querySelector('.input-wrapper');
        if (inputWrapper) inputWrapper.style.display = '';
        const userInput = document.getElementById('user-input');
        if (userInput) userInput.value = `Trip to ${place.city}`;

        // 7. Kullanıcıya bilgi ver
        if (typeof showToast === 'function') showToast("New trip started!", "success");
    }
}

(function addMyPlacesNativeStyles() {
    const styleId = 'my-places-native-styles';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        /* Panel içindeki kart yapısı */
        .fav-native-card {
            background: #fff;
            border: 1px solid #eee;
            border-radius: 12px;
            padding: 12px;
            margin-bottom: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
            transition: all 0.2s ease;
        }

        /* Üst kısım: Resim ve Bilgi */
        .fav-card-header {
            display: flex;
            gap: 12px;
            margin-bottom: 12px;
        }

        /* Resim (Senin cart-image class'ına benzer) */
        .fav-card-img {
            width: 60px;
            height: 60px;
            border-radius: 8px;
            object-fit: cover;
            flex-shrink: 0;
        }

        /* Başlık ve Kategori */
        .fav-card-info {
            display: flex;
            flex-direction: column;
            justify-content: center;
            overflow: hidden;
        }
        .fav-card-title {
            font-weight: 600;
            font-size: 15px;
            color: #333;
            margin: 0 0 4px 0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .fav-card-cat {
            font-size: 12px;
            color: #666;
            background: #f5f5f5;
            padding: 2px 8px;
            border-radius: 4px;
            width: fit-content;
        }

        /* Aksiyon Butonları Alanı */
        .fav-card-actions {
            display: flex;
            flex-direction: column;
            gap: 8px;
            border-top: 1px solid #f0f0f0;
            padding-top: 10px;
        }

        /* Senin butonlarını taklit eden butonlar */
        .fav-btn-primary, .fav-btn-secondary {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
            border: 1px solid transparent;
            width: 100%;
        }

        /* Start New Trip (Mor/Mavi ton - Senin ana rengin) */
        .fav-btn-primary {
            background: #f0f4ff; /* Hafif mavi arka plan */
            color: #1976d2;
            border: 1px solid #e3e8ff;
        }
        .fav-btn-primary:hover {
            background: #e3e8ff;
        }

        /* Add to Trip (Yeşilimsi veya koyu vurgu) */
        .fav-btn-secondary {
            background: #333;
            color: #fff;
        }
        .fav-btn-secondary:hover {
            background: #000;
        }

        /* Disabled Durumu */
        .fav-btn-secondary.disabled {
            background: #eee;
            color: #999;
            cursor: not-allowed;
            border: 1px solid #ddd;
        }

        /* Remove Butonu (Senin remove-btn class'ınla uyumlu) */
        .fav-remove-link {
            font-size: 12px;
            color: #d32f2f;
            text-decoration: underline;
            background: none;
            border: none;
            cursor: pointer;
            padding: 4px;
            align-self: center; /* Ortala */
        }
        .fav-remove-link:hover {
            color: #b71c1c;
        }
    `;
    document.head.appendChild(style);
})();

(function addCompactStyles() {
    const styleId = 'fav-compact-styles';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        /* Ortak Buton Stili (Senin orijinal stiline sadık) */
        .fav-action-btn {
            width: 32px; height: 32px; 
            border: none; border-radius: 50%; 
            font-size: 18px; font-weight: bold; 
            cursor: pointer; 
            display: flex; align-items: center; justify-content: center;
            transition: all 0.2s;
        }

        /* 1. Yeni Gezi Başlat (Yeşil veya Mor - Play İkonu) */
        .btn-fav-start { background: #e8f5e9; color: #2e7d32; font-size: 14px; }
        .btn-fav-start:hover { background: #c8e6c9; }

        /* 2. Mevcut Geziye Ekle (Mavi - Senin orijinalin) */
        .btn-fav-add { background: #1976d2; color: #fff; }
        .btn-fav-add:hover { background: #1565c0; }

        /* 2.1 Disabled Durumu (Mesafe Engeli) */
        .btn-fav-add.disabled {
            background: #e0e0e0 !important;
            color: #9e9e9e !important;
            cursor: not-allowed;
            opacity: 0.8;
        }

        /* 3. Sil (Kırmızı - Senin orijinalin) */
        .btn-fav-remove { background: #ffecec; color: #d32f2f; }
        .btn-fav-remove:hover { background: #ffcdd2; }
    `;
    document.head.appendChild(style);
})();