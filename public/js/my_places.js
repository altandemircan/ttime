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
        favPanel.innerHTML = `<div class="mytrips-empty">No favorite places yet.<br>Add places to favorites to see them here!</div>`;
        return;
    }

    const grouped = groupFavoritesByCountryCity(favList);

    Object.entries(grouped).forEach(([locationKey, places]) => {
        const section = document.createElement("div");
        section.className = "fav-place-group";
        section.innerHTML = `<h3 style="margin-bottom:10px; color:#6c3fc2;">${locationKey}</h3>`;

        const ul = document.createElement("ul");
        ul.style = "list-style:none;padding:0;margin:0;";

        places.forEach((place, i) => {
            // --- 1. MESAFE KONTROLÜ ---
            const check = isPlaceAddableToCurrentTrip(place.lat, place.lon);
            const isDimmed = !check.canAdd; // Uzaksa hafif soluk yap

            const li = document.createElement("li");
            li.className = `fav-item ${isDimmed ? 'dimmed' : ''}`;
            // Stilini CSS class'ına taşıdık ama inline override gerekebilir
            li.style = "margin-bottom:12px;background:#f8f9fa;border-radius:12px;box-shadow:0 1px 6px #e3e3e3;padding:9px 12px;display:flex;align-items:center;gap:16px;min-width:0;";

            const imgDiv = document.createElement("div");
            imgDiv.style = "width:42px;height:42px;";
            const img = document.createElement("img");
            img.src = place.image || "img/placeholder.png";
            img.alt = place.name || "";
            img.style = "width:100%;height:100%;object-fit:cover;border-radius:8px;";
            imgDiv.appendChild(img);

            const infoDiv = document.createElement("div");
            infoDiv.style = "flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;";
            
            // Eğer eklenemiyorsa altına küçük uyarı ekle
            const warningHtml = isDimmed ? `<span class="dist-warning">⚠️ ${check.reason}</span>` : '';

            infoDiv.innerHTML = `
                <span style="font-weight:500;font-size:15px;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${place.name}</span>
                <span style="font-size:11px;color:#1976d2;background:#e3e8ff;border-radius:6px;padding:1px 7px;display:inline-block;margin-top:2px;width:max-content;text-overflow:ellipsis;overflow:hidden;">${place.category || ""}</span>
                ${warningHtml}
            `;

            const btnDiv = document.createElement("div");
            btnDiv.style = "display:flex;flex-direction:row;align-items:center;gap:6px;";

            // --- BUTON 1: START NEW TRIP (Roket) ---
            const startBtn = document.createElement("button");
            startBtn.className = "fav-action-btn btn-start-new";
            startBtn.title = "Start a NEW trip with this place";
            startBtn.innerHTML = "🚀"; // Veya bir SVG ikon
            startBtn.onclick = function() {
                startNewTripWithPlace(place);
            };

            // --- BUTON 2: ADD TO CURRENT (+) ---
            const addBtn = document.createElement("button");
            addBtn.className = `fav-action-btn btn-add-current ${isDimmed ? 'disabled' : ''}`;
            addBtn.title = isDimmed ? `Cannot add: ${check.reason}` : "Add to CURRENT trip";
            addBtn.innerHTML = "+";
            
            if (!isDimmed) {
                addBtn.onclick = function() {
                    if (typeof addToCart === "function") {
                        addToCart(
                            place.name,
                            place.image,
                            window.currentDay || 1,
                            place.category,
                            place.address || "",
                            null, null, place.opening_hours || "",
                            null,
                            place.lat && place.lon ? { lat: Number(place.lat), lng: Number(place.lon) } : null,
                            place.website || ""
                        );
                    }
                    if (typeof updateCart === "function") updateCart();
                    
                    // Ekledikten sonra paneli tekrar render et (Mesafe kontrolünü güncellemek için)
                    renderFavoritePlacesPanel();
                };
            }

            // --- BUTON 3: REMOVE (-) ---
            const removeBtn = document.createElement("button");
            removeBtn.className = "fav-action-btn btn-remove-fav";
            removeBtn.title = "Remove from favorites";
            removeBtn.innerHTML = "–"; // &minus;
            
            removeBtn.onclick = function() {
                const delIdx = window.favTrips.findIndex(f => f.name === place.name && String(f.lat) === String(place.lat));
                if (delIdx > -1) {
                    window.favTrips.splice(delIdx, 1);
                    saveFavTrips();
                    renderFavoritePlacesPanel(); 
                    updateAllFavVisuals(); 
                }
            };

            // Butonları ekle
            btnDiv.appendChild(startBtn); // Yeni gezi
            btnDiv.appendChild(addBtn);   // Mevcut geziye ekle
            btnDiv.appendChild(removeBtn); // Sil

            li.appendChild(imgDiv);
            li.appendChild(infoDiv);
            li.appendChild(btnDiv);

            ul.appendChild(li);
        });

        section.appendChild(ul);
        favPanel.appendChild(section);
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