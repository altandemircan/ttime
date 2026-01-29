// ======================================================
// my_places.js - SMART TITLES & ACCORDION
// ======================================================

window.favTrips = JSON.parse(localStorage.getItem('favTrips') || '[]');

function saveFavTrips() {
    localStorage.setItem('favTrips', JSON.stringify(window.favTrips));
}

// ------------------------------------------------------
// 1. CSS: Akordiyon ve Kart Tasarımı
// ------------------------------------------------------
(function addSafeStyles() {
    const styleId = 'mp-accordion-final';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        /* --- GRUP (AKORDİYON) --- */
        .mp-group {
            margin-bottom: 12px;
            background: #fff;
            border: 1px solid #e0e0e0;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.02);
            transition: all 0.2s;
        }

        /* Başlık Kısmı */
        .mp-group-header {
            padding: 14px 16px;
            background: #f8f9fa;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            user-select: none;
            border-bottom: 1px solid transparent;
        }
        .mp-group-header:hover { background: #f1f3f5; }

        /* Başlık Yazısı */
        .mp-group-title {
            font-size: 15px; font-weight: 600; color: #6c3fc2;
            display: flex; align-items: center; gap: 10px;
        }
        
        /* Sayı Rozeti */
        .mp-badge {
            font-size: 11px; font-weight: 500; color: #555;
            background: #e9ecef; padding: 2px 8px; border-radius: 12px;
        }

        /* Ok İkonu */
        .mp-arrow {
            font-size: 12px; color: #999;
            transition: transform 0.3s ease;
        }
        
        /* AÇIK DURUM (OPEN) */
        .mp-group.open .mp-group-header {
            background: #fff;
            border-bottom: 1px solid #eee;
        }
        .mp-group.open .mp-arrow { transform: rotate(180deg); }
        
        /* İçerik Alanı (Animasyonlu) */
        .mp-content {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.4s ease-out;
            background: #fff;
        }
        .mp-group.open .mp-content {
            max-height: 3000px; /* İçerik uzarsa kesilmesin */
            transition: max-height 0.5s ease-in;
        }

        .mp-list-wrap { padding: 12px; display: flex; flex-direction: column; gap: 12px; }

        /* --- KART YAPISI --- */
        .mp-card {
            background: #fff; border: 1px solid #eee; border-radius: 10px;
            display: flex; flex-direction: column;
            box-shadow: 0 1px 3px rgba(0,0,0,0.03);
        }

        .mp-head {
            display: flex; padding: 10px; gap: 12px; align-items: center;
            border-bottom: 1px solid #f9f9f9; position: relative;
        }
        .mp-img-box {
            width: 48px; height: 48px; flex-shrink: 0; border-radius: 6px; 
            overflow: hidden; background: #eee;
        }
        .mp-img { width: 100%; height: 100%; object-fit: cover; }
        
        .mp-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .mp-name { font-size: 14px; font-weight: 600; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .mp-sub { font-size: 11px; color: #777; background: #f5f5f5; padding: 2px 6px; border-radius: 4px; width: max-content; }

        /* Silme İkonu (X) */
        .mp-del {
            width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
            color: #ccc; cursor: pointer; border-radius: 4px; font-size: 16px;
        }
        .mp-del:hover { background: #ffebee; color: #d32f2f; }

        /* Alt Butonlar */
        .mp-acts { display: flex; background: #fafafa; border-radius: 0 0 10px 10px; overflow: hidden; }
        .mp-btn {
            flex: 1; border: none; background: transparent; padding: 10px 4px;
            font-size: 13px; font-weight: 500; cursor: pointer;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            gap: 2px; color: #555; transition: background 0.2s;
        }
        .mp-btn-start { border-right: 1px solid #eee; color: #6c3fc2; }
        .mp-btn-start:hover { background: #f3e5f5; }
        .mp-btn-add { color: #1976d2; }
        .mp-btn-add:hover { background: #e3f2fd; }
        .mp-btn-dis { background: #f5f5f5 !important; color: #ccc !important; cursor: not-allowed; }

        .mp-hint-ok { font-size: 10px; color: #66bb6a; }
        .mp-hint-no { font-size: 10px; color: #ef5350; }

        /* MODAL */
        .mp-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.4); z-index: 10000;
            display: none; align-items: center; justify-content: center;
        }
        .mp-modal {
            background: #fff; width: 260px; padding: 20px;
            border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); text-align: center;
        }
        .mp-days { display: flex; flex-direction: column; gap: 8px; margin-top: 15px; max-height: 250px; overflow-y: auto; }
        .mp-day-row {
            background: #f8f9fa; border: 1px solid #eee; padding: 10px;
            border-radius: 6px; cursor: pointer; text-align: left; transition: 0.2s; font-size: 13px;
        }
        .mp-day-row:hover { background: #e3f2fd; border-color: #90caf9; }
    `;
    document.head.appendChild(style);
})();

// ------------------------------------------------------
// 2. MANTIK FONKSİYONLARI
// ------------------------------------------------------

// "Unknown Country" sorununu çözen fonksiyon
function getCleanLocationName(place) {
    // 1. Veride açıkça varsa kullan
    let city = place.city;
    let country = place.country;

    // 2. Yoksa adresten çıkarmaya çalış
    if (!city && place.address) {
        const parts = place.address.split(',').map(s => s.trim());
        
        // Genellikle son parça ülkedir
        if (parts.length > 0) {
            const last = parts[parts.length - 1];
            // Eğer sayı içermiyorsa ülke varsayalım
            if (!/\d/.test(last)) {
                country = last;
            }
        }
        
        // Genellikle sondan bir önceki şehirdir
        if (parts.length > 1) {
            const secondLast = parts[parts.length - 2];
            // Posta kodu temizle (Örn: "07050 Antalya" -> "Antalya")
            city = secondLast.replace(/[0-9]/g, '').trim();
        } else {
            // Tek parça varsa şehirdir
            city = parts[0];
        }
    }

    // 3. Temizleme ve Birleştirme
    // "Unknown" kelimesi geçiyorsa o veriyi yok say
    if (city && city.toLowerCase().includes('unknown')) city = "";
    if (country && country.toLowerCase().includes('unknown')) country = "";

    // 4. Sonuç Döndürme
    if (city && country && city !== country) {
        return `${city}, ${country}`;
    } else if (city) {
        return city; // Sadece şehir (Antalya)
    } else if (country) {
        return country;
    } else {
        return "Saved Places"; // Hiçbir şey bulunamazsa
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

// Akordiyon Tıklama İşleyicisi
window.toggleMpGroup = function(header) {
    const parent = header.parentElement;
    parent.classList.toggle('open');
};

// ------------------------------------------------------
// 3. RENDER (HTML OLUŞTURMA)
// ------------------------------------------------------
async function renderFavoritePlacesPanel() {
    const panel = document.getElementById("favorite-places-panel");
    if (!panel) return;
    panel.innerHTML = "";

    const list = window.favTrips || [];
    if (list.length === 0) {
        panel.innerHTML = `<div style="text-align:center;padding:30px;color:#999;">No saved places.</div>`;
        return;
    }

    const groups = groupFavoritesClean(list);

    // Grupları Dön
    Object.entries(groups).forEach(([key, items], idx) => {
        // Ana Kutu
        const group = document.createElement("div");
        group.className = "mp-group";
        if (idx === 0) group.classList.add('open'); // Sadece ilki açık gelsin

        // Başlık
        const head = document.createElement("div");
        head.className = "mp-group-header";
        head.onclick = function() { toggleMpGroup(this); };
        head.innerHTML = `
            <div class="mp-group-title">
                ${key} <span class="mp-badge">${items.length}</span>
            </div>
            <div class="mp-arrow">▼</div>
        `;

        // İçerik Alanı
        const content = document.createElement("div");
        content.className = "mp-content";
        const wrapper = document.createElement("div");
        wrapper.className = "mp-list-wrap";

        // Kartlar
        items.forEach(place => {
            const st = checkDist(place.lat, place.lon);
            
            const card = document.createElement("div");
            card.className = "mp-card";
            
            // Kart Üstü
            card.innerHTML = `
                <div class="mp-head">
                    <div class="mp-img-box">
                        <img src="${place.image || 'img/placeholder.png'}" class="mp-img" onerror="this.src='img/default_place.jpg'">
                    </div>
                    <div class="mp-info">
                        <div class="mp-name" title="${place.name}">${place.name}</div>
                        <div class="mp-sub">${place.category || 'Place'}</div>
                    </div>
                </div>
            `;
            
            // Silme Butonu
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
            card.querySelector('.mp-head').appendChild(del);

            // Alt Butonlar
            const acts = document.createElement("div");
            acts.className = "mp-acts";

            // Start New
            const b1 = document.createElement("button");
            b1.className = "mp-btn mp-btn-start";
            b1.innerHTML = `<span>▶ Start New</span>`;
            b1.onclick = () => startNewTripWithPlace(place);

            // Add Trip
            const b2 = document.createElement("button");
            b2.className = st.ok ? "mp-btn mp-btn-add" : "mp-btn mp-btn-dis";
            b2.innerHTML = `<span>+ Add Trip</span> <span class="${st.ok ? 'mp-hint-ok' : 'mp-hint-no'}">${st.msg}</span>`;
            
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