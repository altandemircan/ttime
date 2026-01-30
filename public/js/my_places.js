// ======================================================
// my_places.js - SMART TITLES & ACCORDION
// ======================================================

window.favTrips = JSON.parse(localStorage.getItem('favTrips') || '[]');

function saveFavTrips() {
    localStorage.setItem('favTrips', JSON.stringify(window.favTrips));
}

// ------------------------------------------------------
// 1. CSS: Yumuşak renkler, yan yana butonlar
// ------------------------------------------------------
(function addSafeStyles() {
    const styleId = 'mp-accordion-final';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        /* --- GRUP (AKORDİYON) --- */
        .mp-group {
            margin-bottom: 16px;
            background: #fff;
          
            border-radius: 12px;
            overflow: hidden;
            box-shadow: rgba(149, 157, 165, 0.08) 0px 4px 12px;
            transition: all 0.3s ease;
        }

        .mp-group:hover {
            box-shadow: rgba(149, 157, 165, 0.12) 0px 6px 16px;
            border-color: #e2e8f0;
        }

        /* Başlık Kısmı */
        .mp-group-header {
            padding: 14px 16px;
            background: #fafafc;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            user-select: none;
            border-bottom: 1px solid #f0f2f5;
            font-family: 'Satoshi', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        
        .mp-group-header:hover { 
            background: #f5f7fa; 
        }

        /* Başlık Yazısı */
        .mp-group-title {
            font-size: 0.95rem; 
            font-weight: 600; 
            color: #4a5568;
            display: flex; 
            align-items: center; 
            gap: 10px;
        }
        
        /* Sayı Rozeti */
        .mp-badge {
      font-size: 0.8rem;
    font-weight: 600;
    color: #718096;
    background: #ffffff;
    padding: 0px 6px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
        }

        /* Ok İkonu */
        .mp-arrow {
            font-size: 0.9rem; 
            color: #a0aec0;
            transition: transform 0.3s ease;
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        /* AÇIK DURUM (OPEN) */
        .mp-group.open .mp-group-header {
           border-bottom: 1px solid #e2e8f0;
    background: #eeefef;
    color: #333333;
    padding: 10px 10px;
    cursor: pointer;
    font-weight: bold;
    border-radius: 6px;
    margin-bottom: 10px;
        }
        
        .mp-group.open .mp-arrow { 
            transform: rotate(180deg); 
        }
        
        /* İçerik Alanı (Animasyonlu) */
        .mp-content {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.4s ease-out;
            background: #fff;
        }
        
        .mp-group.open .mp-content {
            max-height: 3000px;
            transition: max-height 0.5s ease-in;
        }

        .mp-list-wrap { 
            padding: 12px 0; 
            display: flex; 
            flex-direction: column; 
            gap: 12px; 
            box-shadow: rgba(149, 157, 165, 0.2) 0px 8px 24px;
        }

        /* --- KART YAPISI --- */
        .mp-card {
                background: #fff;
    overflow: hidden;
    box-shadow: rgba(149, 157, 165, 0.2) 0px 8px 24px;
    background-color: #fff;
    transition: background-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
    border-radius: 12px;
        }

        .mp-card:hover {
            box-shadow: rgba(149, 157, 165, 0.1) 0px 4px 12px;
            border-color: #d0d7e2;
        }

        /* Kart Üst Kısmı */
        .mp-card-head {
            display: flex; 
            padding: 12px; 
            gap: 12px; 
            align-items: flex-start;
            position: relative;
            background: #fff;
        }
        
        /* Resim kutusu */
        .mp-img-box {
            width: 56px; 
            height: 40px; 
            flex-shrink: 0; 
            border-radius: 8px; 
            overflow: hidden; 
            background: #f7f9fc;
            border: 1px solid #edf2f7;
        }
        
        .mp-img { 
            width: 100%; 
            height: 100%; 
            object-fit: cover; 
        }
        
        .mp-info { 
            flex: 1; 
            min-width: 0; 
            display: flex; 
            flex-direction: column; 
            gap: 6px; 
        }
        
        .mp-name { 
            font-size: 0.95rem; 
            font-weight: 600; 
            color: #2d3748; 
            line-height: 1.4;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }
        
        /* Kategori etiketi */
        .mp-cats {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: #f8fafc;
            color: #4a5568;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 0.8rem;
            font-weight: 500;
            border: 1px solid #e2e8f0;
            width: fit-content;
        }
        
        .mp-cats img {
            width: 14px;
            height: 14px;
            opacity: 0.7;
        }

        /* Favori butonu - SAĞDA */
        .mp-fav-btn {
            position: absolute;
            top: 12px;
            right: 12px;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            border-radius: 8px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            transition: all 0.2s ease;
        }
        
        .mp-fav-btn:hover {
            background: #f1f5f9;
            border-color: #cbd5e0;
        }
        
        .mp-fav-btn img {
            width: 16px;
            height: 16px;
        }

        /* Alt Butonlar - YAN YANA, AYNI BOYUT */
        .mp-acts { 
            display: flex; 
            background: #fafcfd; 
            border-radius: 0 0 10px 10px; 
            overflow: hidden; 
            border-top: 1px solid #edf2f7;
            padding: 10px;
            gap: 10px;
        }
        
        .mp-btn {
     flex: 1;
    display: flex;
    gap: 8px;
    font-family: 'Satoshi', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    padding: 10px;
    width: 100%;
    font-weight: 600;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 0.9rem;
        }
        
        /* YUMUŞAK MOR buton */
        .mp-btn-start { 
            background: linear-gradient(135deg, #8a4af3 0%, #7a3ae3 100%);
            border: none;
            box-shadow: 0 2px 6px rgba(138, 74, 243, 0.2);
            color: #ffffff;
        }
        
        .mp-btn-start:hover { 
            background: linear-gradient(135deg, #7a3ae3 0%, #6a2ad3 100%);
            box-shadow: 0 3px 8px rgba(138, 74, 243, 0.3);
        }
        
        /* KOYU MAVİ buton */
        .mp-btn-add { 
            background: linear-gradient(135deg, #02aee4 0%, #0098d4 100%);
            border: none;
            box-shadow: 0 2px 6px rgba(2, 174, 228, 0.2);
            color: #ffffff;
        }
        
        .mp-btn-add:hover { 
            background: linear-gradient(135deg, #0098d4 0%, #0088c4 100%);
            box-shadow: 0 3px 8px rgba(2, 174, 228, 0.3);
        }
        
        .mp-btn-dis { 
            background: #e8eaed !important; 
            color: #999999 !important; 
            cursor: not-allowed;
            box-shadow: none !important;
        }

        .mp-hint-ok { 
            font-size: 0.75rem; 
            color: #48bb78;
            margin-left: 4px;
            font-weight: 500;
        }
        
        .mp-hint-no { 
            font-size: 0.75rem; 
            color: #f56565; 
            margin-left: 4px;
            font-weight: 500;
        }

        /* Mesafe bilgisi */
        .mp-distance-info {
            font-size: 0.75rem;
            color: #718096;
            margin-top: 4px;
            display: flex;
            align-items: center;
            gap: 4px;
        }

        /* MODAL */
        .mp-overlay {
            position: fixed; 
            top: 0; 
            left: 0; 
            width: 100%; 
            height: 100%;
            background: rgba(0,0,0,0.4); 
            z-index: 10000;
            display: none; 
            align-items: center; 
            justify-content: center;
            backdrop-filter: blur(2px);
        }
        
        .mp-modal {
            background: #fff; 
            width: 280px; 
            padding: 24px;
            border-radius: 12px; 
            box-shadow: 0 8px 24px rgba(0,0,0,0.1); 
            text-align: center;
            font-family: 'Satoshi', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        
        .mp-days { 
            display: flex; 
            flex-direction: column; 
            gap: 8px; 
            margin-top: 20px; 
            max-height: 250px; 
            overflow-y: auto; 
        }
        
        .mp-day-row {
            background: #f8fafc; 
            border: 1px solid #e2e8f0; 
            padding: 12px;
            border-radius: 8px; 
            cursor: pointer; 
            text-align: left; 
            transition: 0.2s; 
            font-size: 0.9rem;
            font-weight: 500;
            color: #4a5568;
        }
        
        .mp-day-row:hover { 
            background: #edf2f7; 
            border-color: #cbd5e0; 
        }
    `;
    document.head.appendChild(style);
})();

// ------------------------------------------------------
// 2. MANTIK FONKSİYONLARI
// ------------------------------------------------------

// "Unknown Country" sorununu çözen fonksiyon
function getCleanLocationName(place) {
    let city = place.city;
    let country = place.country;

    if (!city && place.address) {
        const parts = place.address.split(',').map(s => s.trim());
        
        if (parts.length > 0) {
            const last = parts[parts.length - 1];
            if (!/\d/.test(last)) {
                country = last;
            }
        }
        
        if (parts.length > 1) {
            const secondLast = parts[parts.length - 2];
            city = secondLast.replace(/[0-9]/g, '').trim();
        } else {
            city = parts[0];
        }
    }

    if (city && city.toLowerCase().includes('unknown')) city = "";
    if (country && country.toLowerCase().includes('unknown')) country = "";

    if (city && country && city !== country) {
        return `${city}, ${country}`;
    } else if (city) {
        return city;
    } else if (country) {
        return country;
    } else {
        return "Saved Places";
    }
}

// Gruplama
function groupFavoritesClean(list) {
    const groups = {};
    list.forEach(item => {
        const key = getCleanLocationName(item);
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });
    return groups;
}

// Mesafe Kontrol
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

// Modal Toggle
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
                <h3 style="margin:0; font-size:16px; font-weight:600; color:#2d3748; margin-bottom:20px;">Add to which day?</h3>
                <div class="mp-days" id="mp-days-list"></div>
                <button onclick="document.getElementById('mp-modal-ov').style.display='none'" 
                    style="margin-top:20px; border:none; background:#f7fafc; color:#718096; cursor:pointer; font-size:0.9rem; padding:8px 16px; border-radius:8px; transition:0.2s;" 
                    onmouseover="this.style.background='#edf2f7'" 
                    onmouseout="this.style.background='#f7fafc'">
                    Cancel
                </button>
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

// Akordiyon Tıklama İşleyicisi
window.toggleMpGroup = function(header) {
    const parent = header.parentElement;
    parent.classList.toggle('open');
};

// Kategori ikonunu getiren fonksiyon
function getPlaceCategoryIcon(category) {
    const iconMap = {
        'Restaurant': '/img/restaurant_icon.svg',
        'Cafe': '/img/coffee_icon.svg',
        'Coffee': '/img/coffee_icon.svg',
        'Hotel': '/img/accommodation_icon.svg',
        'Museum': '/img/museum_icon.svg',
        'Park': '/img/park_icon.svg',
        'Beach': '/img/beach_icon.svg',
        'Shopping': '/img/market_icon.svg',
        'Bar': '/img/bar_icon.svg',
        'Viewpoint': '/img/viewpoint_icon.svg',
        'Historical': '/img/historical_icon.svg',
        'Touristic Attraction': '/img/touristic_icon.svg',
        'Touristic': '/img/touristic_icon.svg',
        'touristic attraction': '/img/touristic_icon.svg'
    };
    return iconMap[category] || '/img/location.svg';
}
// ------------------------------------------------------
// 3. RENDER - Yumuşak renkler, yan yana butonlar
// ------------------------------------------------------
async function renderFavoritePlacesPanel() {
    const panel = document.getElementById("favorite-places-panel");
    if (!panel) return;
    panel.innerHTML = "";

    const list = window.favTrips || [];
    if (list.length === 0) {
        panel.innerHTML = `<div style="text-align:center;padding:30px;color:#a0aec0;font-size:0.9rem;background:#f8fafc;border-radius:10px;margin:20px 0;border:1px dashed #e2e8f0;">No saved places yet.</div>`;
        return;
    }

    const groups = groupFavoritesClean(list);

    Object.entries(groups).forEach(([key, items], idx) => {
        const group = document.createElement("div");
        group.className = "mp-group";
        if (idx === 0) group.classList.add('open');

        const head = document.createElement("div");
        head.className = "mp-group-header";
        head.onclick = function() { toggleMpGroup(this); };
        head.innerHTML = `
            <div class="mp-group-title">
                ${key} <span class="mp-badge">${items.length}</span>
            </div>
            <div class="mp-arrow">▼</div>
        `;

        const content = document.createElement("div");
        content.className = "mp-content";
        const wrapper = document.createElement("div");
        wrapper.className = "mp-list-wrap";

        items.forEach((place, placeIndex) => {
            const st = checkDist(place.lat, place.lon);
            const isFav = isTripFav(place);
            
            const card = document.createElement("div");
            card.className = "mp-card";
            
            // Kart oluştur
            card.innerHTML = `
                <div class="mp-card-head">
                    <div class="mp-img-box">
                        <img src="${place.image || 'img/placeholder.png'}" class="mp-img" onerror="this.src='img/default_place.jpg'">
                    </div>
                    <div class="mp-info">
                        <div class="mp-name" title="${place.name}">${place.name}</div>
                        <div class="mp-cats">
                            <img src="${getPlaceCategoryIcon(place.category)}" alt="${place.category}">
                            ${place.category || 'Place'}
                        </div>
                        ${st.msg ? `<div class="mp-distance-info">📍 ${st.msg}</div>` : ''}
                    </div>
                </div>
            `;
            
            // Favori butonu - SAĞ ÜST KÖŞEDE
            const favBtn = document.createElement("button");
            favBtn.className = "mp-fav-btn";
            favBtn.innerHTML = `<img class="fav-icon" src="${isFav ? 'img/like_on.svg' : 'img/like_off.svg'}" alt="${isFav ? 'Remove from fav' : 'Add to fav'}">`;
            favBtn.onclick = (e) => {
                e.stopPropagation();
                const favIdx = window.favTrips.findIndex(f => 
                    f.name === place.name && 
                    String(f.lat) === String(place.lat)
                );
                if (favIdx > -1) {
                    window.favTrips.splice(favIdx, 1);
                    saveFavTrips();
                    renderFavoritePlacesPanel();
                    if(typeof updateAllFavVisuals === 'function') updateAllFavVisuals();
                }
            };
            card.querySelector('.mp-card-head').appendChild(favBtn);

            // Alt butonlar - YAN YANA, AYNI BOYUT
            const acts = document.createElement("div");
            acts.className = "mp-acts";

            // Start New Trip butonu - KOYU MOR
            const b1 = document.createElement("button");
            b1.className = "mp-btn mp-btn-start";
            b1.innerHTML = `<img src="img/start_with_place.svg" style="width:16px;height:16px;filter:brightness(0) invert(1);"> Start New`;
            b1.onclick = () => startNewTripWithPlace(place);

            // Add to Trip butonu - KOYU MAVİ
            const b2 = document.createElement("button");
            b2.className = st.ok ? "mp-btn mp-btn-add" : "mp-btn mp-btn-dis";
            
            if (st.ok) {
                b2.innerHTML = `<img src="img/add_to_current_trip.svg" style="width:16px;height:16px;filter:brightness(0) invert(1);"> Add to Trip`;
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
                b2.innerHTML = `<img src="img/add_to_current_trip.svg" style="width:16px;height:16px;filter:brightness(0) invert(1);"> Add to Trip`;
                b2.title = "Too far";
            }

            acts.appendChild(b1);
            acts.appendChild(b2);
            card.appendChild(acts);
            
            wrapper.appendChild(card);
        });

        content.appendChild(wrapper);
        group.appendChild(head);
        group.appendChild(content);
        panel.appendChild(group);
    });
}

// Helper function to check if a place is in favorites
function isTripFav(item) {
    return window.favTrips.some(f => 
        f.name === item.name && 
        String(f.lat) === String(item.lat || item.location?.lat)
    );
}