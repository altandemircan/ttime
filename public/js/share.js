/**
 * share.js - THE FINAL CLEAN VERSION
 * Created with triptime.ai!
 */

// --- 1. MODERN LOADING UI ---
function showGlobalLoading() {
    let loader = document.getElementById('trip-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'trip-loader';
        loader.innerHTML = `
            <div class="loader-content">
                <div class="logo-wrapper">
                    <div class="modern-spinner"></div>
                    <img src="https://triptime.ai/img/for_favicon.png" class="loader-logo" alt="Triptime Logo">
                </div>
                <p class="loading-text">Triptime AI Trip Planner is loading</p>
            </div>
            <style>
                #trip-loader { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255, 255, 255, 0.98); z-index: 99999; display: flex; align-items: center; justify-content: center; font-family: 'Inter', sans-serif; backdrop-filter: blur(8px); }
                .loader-content { display: flex; flex-direction: column; align-items: center; justify-content: center; }
                .logo-wrapper { position: relative; width: 80px; height: 80px; margin-bottom: 20px; display: flex; align-items: center; justify-content: center; }
                .loader-logo { width: 54px; height: 54px; z-index: 2; filter: drop-shadow(0 0 8px rgba(138, 74, 243, 0.15)); }
                .modern-spinner { position: absolute; top: 0; left: 0; right: 0; bottom: 0; border: 3px solid rgba(138, 74, 243, 0.1); border-left-color: #8a4af3; border-radius: 50%; animation: modern-spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite; z-index: 1; }
                .loading-text { color: #1a1a1a; font-size: 14px; font-weight: 500; animation: pulse 1.8s ease-in-out infinite; }
                @keyframes modern-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
            </style>`;
        document.body.appendChild(loader);
    }
}

function hideGlobalLoading() {
    const loader = document.getElementById('trip-loader');
    if (loader) {
        loader.style.transition = "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)";
        loader.style.opacity = "0";
        loader.style.transform = "scale(1.1)";
        setTimeout(() => { if(loader) loader.remove(); }, 600);
    }
}

/**
 * share.js - THE BULTIMATE FIX (With API Failover)
 * Created with triptime.ai!
 */

async function shareOnWhatsApp() {
    if (typeof showGlobalLoading === 'function') showGlobalLoading();
    
    try {
        // 1. WHATSAPP METNİ (DOKUNULMAZ)
        let shareText = "Check out my trip plan!\n\n";
        const maxDay = Math.max(0, ...window.cart.map(item => item.day || 0));

        for (let day = 1; day <= maxDay; day++) {
            const dayItems = window.cart.filter(item => item.day == day && item.name);
            if (dayItems.length > 0) {
                shareText += `--- Day ${day} ---\n`;
                dayItems.forEach(item => { shareText += `• ${item.name}\n`; });
                shareText += "\n";
            }
        }

        // 2. LİNKİ HAZIRLA
        const longUrl = createOptimizedLongLink();
        let shortUrl = longUrl;

        // 3. TINYURL'İ ARACI (PROXY) İLE ÇAĞIR (CORS ENGELİNİ AŞMAK İÇİN)
        try {
            // TinyURL'i doğrudan değil, bir proxy servisi üzerinden çağırıyoruz
            const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent('https://tinyurl.com/api-create?url=' + encodeURIComponent(longUrl))}`);
            
            if (response.ok) {
                const data = await response.json();
                if (data.contents && data.contents.startsWith('http')) {
                    shortUrl = data.contents;
                }
            }
        } catch (apiErr) {
            console.error("Kısaltma servisi engellendi, uzun linke dönüldü.");
        }

        // 4. METNİ BİRLEŞTİR VE İMZA
        shareText += `View full plan: ${shortUrl}`;
        shareText += "\n\nCreated with triptime.ai!";

        // 5. WHATSAPP'I AÇ
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');

    } catch (e) {
        console.error("Hata oluştu:", e);
    } finally {
        if (typeof hideGlobalLoading === 'function') hideGlobalLoading();
    }
}

// BU FONKSİYONU DA GÜNCELLE (EN KISA HALİ BU)
function createOptimizedLongLink() {
    const title = (document.getElementById('trip_title')?.innerText || "Trip").replace(/[|*,]/g, '');
    const items = (window.cart || []).map(item => {
        const name = item.name.substring(0, 20).replace(/[|*,]/g, ''); // İsimleri 20 karakterle kısıtladık ki link iyice küçülsün
        const lat = parseFloat(item.lat || 0).toFixed(3); // Hassasiyeti 3'e düşürdük
        const lng = parseFloat(item.lng || 0).toFixed(3);
        return `${name},${lat},${lng},${item.day || 1},0`;
    }).join('*');

    const rawData = `${title}|${items}`;
    return `${window.location.origin}${window.location.pathname}?v2=${encodeURIComponent(rawData)}`;
}

// --- 4. SAYFA YÜKLENDİĞİNDE LİNKİ OKU (v1 VE v2 DESTEKLİ) ---
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const v1Raw = params.get('v1');
    const v2Raw = params.get('v2');
    
    if (!v1Raw && !v2Raw) return;

    showGlobalLoading();

    try {
        let tripData = { n: "Trip Plan", ai: "" };

        if (v2Raw) {
            const decoded = decodeURIComponent(v2Raw);
            const [title, itemsStr] = decoded.split('|');
            tripData.n = title;
            const rawItems = itemsStr.split('*');
            window.cart = rawItems.map(str => {
                const p = str.split(',');
                return {
                    name: p[0], lat: parseFloat(p[1]), lng: parseFloat(p[2]),
                    location: { lat: parseFloat(p[1]), lng: parseFloat(p[2]) },
                    day: parseInt(p[3]) || 1, image: p[4] === "1" ? "default" : "", category: "Place"
                };
            });
        } else if (v1Raw) {
            const decodedV1 = JSON.parse(decodeURIComponent(v1Raw));
            tripData = decodedV1;
            const rawItems = tripData.items.split('*');
            window.cart = rawItems.map(str => {
                const parts = str.split('|');
                const [name, latStr, lonStr, dayStr, imgStr] = parts;
                return {
                    name: name, lat: parseFloat(latStr), lng: parseFloat(lonStr),
                    location: { lat: parseFloat(latStr), lng: parseFloat(lonStr) },
                    day: parseInt(dayStr) || 1, image: imgStr === "no-img" ? "" : decodeURIComponent(imgStr), category: "Place"
                };
            });
        }

        localStorage.setItem('cart', JSON.stringify(window.cart));
        if (document.getElementById('trip_title')) document.getElementById('trip_title').innerText = tripData.n;
        
        const welcomeSection = document.getElementById('tt-welcome');
        if (welcomeSection) { welcomeSection.style.display = 'block'; welcomeSection.classList.add('active'); }

        let attempts = 0;
        const checkReady = setInterval(() => {
            attempts++;
            if (typeof updateCart === 'function' || attempts > 35) {
                clearInterval(checkReady);
                if (typeof updateCart === 'function') updateCart();
                const overlay = document.getElementById('sidebar-overlay-trip');
                if (overlay) overlay.classList.add('open');
                setTimeout(() => {
                    hideGlobalLoading();
                    if (window.map) window.map.invalidateSize();
                }, 1000);
            }
        }, 300);
    } catch (e) { hideGlobalLoading(); }
});