/**
 * share.js - Final Stabil Versiyon
 * Pexels Fix + AI Garantici + Loading Overlay + Hata Koruma
 */

// --- 1. Loading UI Fonksiyonları ---
function showGlobalLoading() {
    let loader = document.getElementById('trip-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'trip-loader';
        loader.innerHTML = `
            <div class="loader-content">
                <div class="spinner"></div>
                <p>Magical trip plan is loading...</p>
            </div>
            <style>
                #trip-loader {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: white; z-index: 99999; display: flex;
                    align-items: center; justify-content: center; font-family: sans-serif;
                }
                .loader-content { text-align: center; }
                .spinner {
                    width: 50px; height: 50px; border: 5px solid #f3f3f3;
                    border-top: 5px solid #3498db; border-radius: 50%;
                    animation: spin 1s linear infinite; margin: 0 auto 15px;
                }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        `;
        document.body.appendChild(loader);
    }
}

function hideGlobalLoading() {
    const loader = document.getElementById('trip-loader');
    if (loader) {
        loader.style.transition = "opacity 0.5s";
        loader.style.opacity = "0";
        setTimeout(() => { if(loader) loader.remove(); }, 500);
    }
}

// --- 2. Link Oluşturucu (Pexels & Koordinat Fix) ---
function createShortTripLink() {
    const title = document.getElementById('trip_title')?.innerText || "My Trip Plan";
    const aiInfo = localStorage.getItem('ai_information') || "";

    const items = (window.cart || []).map(item => {
        const lat = item.lat || (item.location && item.location.lat) || 0;
        const lng = item.lng || (item.location && item.location.lng) || 0;
        const imgUrl = (item.image && item.image.length > 5) ? encodeURIComponent(item.image) : "no-img";
        // Ayraç olarak | kullanıyoruz
        return `${item.name}|${lat}|${lng}|${item.day || 1}|${imgUrl}`;
    }).join('*');

    const payload = { n: title, ai: aiInfo, items: items };
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?v1=${encodeURIComponent(JSON.stringify(payload))}`;
}

// --- 3. Ana Karşılayıcı ve Başlatıcı ---
// --- 3. Ana Karşılayıcı ve Başlatıcı ---
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const v1Raw = params.get('v1');
    if (!v1Raw) return;

    if (typeof showGlobalLoading === 'function') showGlobalLoading();

    try {
        const tripData = JSON.parse(decodeURIComponent(v1Raw));
        const rawItems = tripData.items.split('*');
        
        window.cart = rawItems.map(str => {
            const parts = str.split('|');
            const [name, latStr, lonStr, dayStr, imgStr] = parts;
            const latVal = parseFloat(latStr);
            const lngVal = parseFloat(lonStr);
            const finalImg = (imgStr === "no-img" || !imgStr) ? "" : decodeURIComponent(decodeURIComponent(imgStr));
            
            return {
                name: name,
                lat: latVal,
                lng: lngVal,
                location: { lat: latVal, lng: lngVal },
                day: parseInt(dayStr) || 1,
                image: finalImg,
                category: "Place"
            };
        });

        localStorage.setItem('cart', JSON.stringify(window.cart));
        if (tripData.ai) localStorage.setItem('ai_information', tripData.ai);
        
        if (document.getElementById('trip_title')) document.getElementById('trip_title').innerText = tripData.n;
        if (document.getElementById('tt-welcome')) document.getElementById('tt-welcome').style.display = 'none';

        let attempts = 0;
        const checkEverything = setInterval(() => {
            attempts++;
            
            // Fonksiyonlar hazır mı diye bakıyoruz
            const isFunctionsReady = typeof updateCart === 'function' && typeof insertTripAiInfo === 'function';

            // Hazırsa veya 10 saniye geçtiyse içeri dal
            if (isFunctionsReady || attempts > 35) {
                clearInterval(checkEverything);

                try {
                    if (typeof updateCart === 'function') updateCart();

                    if (tripData.ai && typeof insertTripAiInfo === "function") {
                        const parts = tripData.ai.split('\n\n');
                        const staticAi = {
                            summary: parts[0]?.replace(/Summary:\s*/i, '').trim() || "",
                            tip: parts[1]?.replace(/Tip:\s*/i, '').trim() || "",
                            highlight: parts[2]?.replace(/Highlight:\s*/i, '').trim() || ""
                        };
                        insertTripAiInfo(null, staticAi, null);
                    }

                    const overlay = document.getElementById('sidebar-overlay-trip');
                    if (overlay) overlay.classList.add('open');
                } catch (err) {
                    console.warn("Çizim atlandı.");
                }

                // LOADING'İ HER DURUMDA KAPATAN KISIM
                setTimeout(() => {
                    // Önce loading'i yok et
                    if (typeof hideGlobalLoading === 'function') hideGlobalLoading();

                    // Harita hatasını burada hapsediyoruz (invalidateSize patlamasın)
                    try {
                        if (window.map && typeof window.map.invalidateSize === 'function') {
                            window.map.invalidateSize();
                            if (typeof fitMapToCart === 'function') fitMapToCart();
                        }
                    } catch (e) {
                        console.log("Harita hatası yutuldu, loading kapandı.");
                    }
                }, 1000); // 1 saniye beklet ve aç
            }
        }, 300);

    } catch (e) {
        if (typeof hideGlobalLoading === 'function') hideGlobalLoading();
    }
});

// --- Sosyal Medya Paylaşım (Opsiyonel) ---
function shareOnWhatsApp() {
    let text = `Check out my trip plan: ${createShortTripLink()}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
}