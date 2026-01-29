// ======================================================
// my_places.js - SMART TITLES & ACCORDION
// ======================================================

window.favTrips = JSON.parse(localStorage.getItem('favTrips') || '[]');

function saveFavTrips() {
    localStorage.setItem('favTrips', JSON.stringify(window.favTrips));
}

// ------------------------------------------------------
// 1. CSS: updateCart tasarımına uygun hale getirilmiş
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
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: rgba(149, 157, 165, 0.1) 0px 4px 12px;
            transition: all 0.3s ease;
        }

        .mp-group:hover {
            box-shadow: rgba(149, 157, 165, 0.2) 0px 8px 24px;
            border-color: #8a4af3;
        }

        /* Başlık Kısmı */
        .mp-group-header {
            padding: 14px 16px;
            background: #faf8ff;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            user-select: none;
            border-bottom: 1px solid transparent;
            font-family: 'Satoshi', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        
        .mp-group-header:hover { 
            background: #f1e9ff; 
        }

        /* Başlık Yazısı */
        .mp-group-title {
            font-size: 0.95rem; 
            font-weight: 600; 
            color: #8a4af3;
            display: flex; 
            align-items: center; 
            gap: 10px;
        }
        
        /* Sayı Rozeti */
        .mp-badge {
            font-size: 0.8rem; 
            font-weight: 600; 
            color: #ffffff;
            background: #8a4af3; 
            padding: 2px 8px; 
            border-radius: 12px;
        }

        /* Ok İkonu */
        .mp-arrow {
            font-size: 0.9rem; 
            color: #8a4af3;
            transition: transform 0.3s ease;
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        /* AÇIK DURUM (OPEN) */
        .mp-group.open .mp-group-header {
            background: #fff;
            border-bottom: 1px solid #e2e8f0;
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
            padding: 12px; 
            display: flex; 
            flex-direction: column; 
            gap: 12px; 
        }

        /* --- KART YAPISI (updateCart tasarımına benzer) --- */
        .mp-card {
            background: #fff; 
            border: 1px solid #e2e8f0; 
            border-radius: 10px;
            box-shadow: rgba(149, 157, 165, 0.1) 0px 4px 12px;
            transition: all 0.3s ease;
            overflow: hidden;
        }

        .mp-card:hover {
            box-shadow: rgba(149, 157, 165, 0.2) 0px 8px 24px;
            border-color: #8a4af3;
            transform: translateY(-2px);
        }

        .mp-card-head {
            display: flex; 
            padding: 12px; 
            gap: 12px; 
            align-items: center;
            border-bottom: 1px solid #f9f9f9; 
            position: relative;
            background: #fff;
        }
        
        /* Resim kutusu - updateCart'taki cart-image gibi */
        .mp-img-box {
            width: 60px; 
            height: 40px; 
            flex-shrink: 0; 
            border-radius: 8px; 
            overflow: hidden; 
            background: #f5f5f5;
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
            gap: 4px; 
        }
        
        .mp-name { 
            font-size: 0.95rem; 
            font-weight: 600; 
            color: #1e293b; 
            overflow: hidden; 
            text-overflow: ellipsis; 
            white-space: nowrap; 
        }
        
        .mp-sub { 
            font-size: 0.8rem; 
            color: #8a4af3; 
            background: #faf8ff; 
            padding: 3px 8px; 
            border-radius: 6px; 
            width: max-content; 
            font-weight: 500;
        }

        /* Silme Butonu - updateCart'taki remove-btn gibi */
        .mp-del {
            width: 28px; 
            height: 28px; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            color: #959595; 
            cursor: pointer; 
            border-radius: 6px; 
            font-size: 1rem;
            font-weight: 600;
            transition: all 0.2s ease;
            background: #f8f9fa;
        }
        
        .mp-del:hover { 
            background: #ffebee; 
            color: #ff4444; 
        }

        /* Alt Butonlar - updateCart'taki butonlara benzer */
        .mp-acts { 
            display: flex; 
            background: #fafafa; 
            border-radius: 0 0 10px 10px; 
            overflow: hidden; 
            border-top: 1px solid #f0f0f0;
        }
        
        .mp-btn {
            flex: 1; 
            border: none; 
            background: transparent; 
            padding: 10px;
            font-size: 0.85rem; 
            font-weight: 600; 
            cursor: pointer;
            display: flex; 
            align-items: center; 
            justify-content: center;
            gap: 6px; 
            color: #1e293b; 
            transition: all 0.2s ease;
            font-family: 'Satoshi', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        
        .mp-btn-start { 
            border-right: 1px solid #f0f0f0; 
            color: #8a4af3; 
        }
        
        .mp-btn-start:hover { 
            background: #faf8ff; 
        }
        
        .mp-btn-add { 
            color: #02aee4; 
        }
        
        .mp-btn-add:hover { 
            background: #eaf5f9; 
        }
        
        .mp-btn-dis { 
            background: #f5f5f5 !important; 
            color: #ccc !important; 
            cursor: not-allowed; 
        }

        .mp-hint-ok { 
            font-size: 0.75rem; 
            color: #5cae5c; 
            font-weight: 500;
        }
        
        .mp-hint-no { 
            font-size: 0.75rem; 
            color: #ff4444; 
            font-weight: 500;
        }

        /* MODAL */
        .mp-overlay {
            position: fixed; 
            top: 0; 
            left: 0; 
            width: 100%; 
            height: 100%;
            background: rgba(0,0,0,0.5); 
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
            border-radius: 15px; 
            box-shadow: 0 6px 20px rgba(0,0,0,0.15); 
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
            background: #faf8ff; 
            border: 1px solid #e2e8f0; 
            padding: 12px;
            border-radius: 8px; 
            cursor: pointer; 
            text-align: left; 
            transition: 0.2s; 
            font-size: 0.9rem;
            font-weight: 500;
            color: #1e293b;
        }
        
        .mp-day-row:hover { 
            background: #f1e9ff; 
            border-color: #8a4af3; 
            transform: translateY(-1px);
        }
    `;
    document.head.appendChild(style);
})();

// ------------------------------------------------------
// 2. MANTIK FONKSİYONLARI (Aynı kalacak)
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
                <h3 style="margin:0; font-size:16px; font-weight:600; color:#1e293b; margin-bottom:20px;">Add to which day?</h3>
                <div class="mp-days" id="mp-days-list"></div>
                <button onclick="document.getElementById('mp-modal-ov').style.display='none'" 
                    style="margin-top:20px; border:none; background:none; color:#959595; cursor:pointer; font-size:0.9rem; padding:8px 16px; border-radius:8px; transition:0.2s;" 
                    onmouseover="this.style.background='#f5f5f5'" 
                    onmouseout="this.style.background='transparent'">
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

// ------------------------------------------------------
// 3. RENDER (updateCart benzeri HTML oluşturma)
// ------------------------------------------------------
async function renderFavoritePlacesPanel() {
    const panel = document.getElementById("favorite-places-panel");
    if (!panel) return;
    panel.innerHTML = "";

    const list = window.favTrips || [];
    if (list.length === 0) {
        panel.innerHTML = `<div style="text-align:center;padding:30px;color:#959595;font-size:0.9rem;background:#faf8ff;border-radius:10px;margin:20px 0;">No saved places yet.</div>`;
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
            
            const card = document.createElement("div");
            card.className = "mp-card";
            
            // updateCart'taki item yapısına benzer şekilde oluştur
            card.innerHTML = `
                <div class="mp-card-head">
                    <div class="mp-img-box">
                        <img src="${place.image || 'img/placeholder.png'}" class="mp-img" onerror="this.src='img/default_place.jpg'">
                    </div>
                    <div class="mp-info">
                        <div class="mp-name" title="${place.name}">${place.name}</div>
                        <div class="mp-sub">${place.category || 'Place'}</div>
                    </div>
                </div>
            `;
            
            // Silme butonu - updateCart'taki gibi
            const del = document.createElement("div");
            del.className = "mp-del";
            del.innerHTML = "✕";
            del.onclick = (e) => {
                e.stopPropagation();
                if(confirm(`Remove "${place.name}"?`)) {
                    const delIdx = window.favTrips.findIndex(f => f.name === place.name && String(f.lat) === String(place.lat));
                    if (delIdx > -1) {
                        window.favTrips.splice(delIdx, 1);
                        saveFavTrips();
                        renderFavoritePlacesPanel();
                        if(typeof updateAllFavVisuals === 'function') updateAllFavVisuals();
                    }
                }
            };
            card.querySelector('.mp-card-head').appendChild(del);

            // Alt butonlar - updateCart'taki butonlara benzer
            const acts = document.createElement("div");
            acts.className = "mp-acts";

            // Start New Trip butonu
            const b1 = document.createElement("button");
            b1.className = "mp-btn mp-btn-start";
            b1.innerHTML = `<img src="img/start_icon.svg" style="width:16px;height:16px;"> Start New`;
            b1.onclick = () => startNewTripWithPlace(place);

            // Add to Trip butonu
            const b2 = document.createElement("button");
            b2.className = st.ok ? "mp-btn mp-btn-add" : "mp-btn mp-btn-dis";
            b2.innerHTML = `<img src="img/add_icon.svg" style="width:16px;height:16px;"> Add to Trip`;
            
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
                b2.title = "Too far";
                b2.innerHTML += `<span class="${st.ok ? 'mp-hint-ok' : 'mp-hint-no'}">${st.msg}</span>`;
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