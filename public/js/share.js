/**
 * share.js - THE FINAL ULTIMATE VERSION
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

// --- 2. SAYFA YÜKLENDİĞİNDE VERİ ÇÖZÜCÜ (v1 & v2) ---
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
                if (p.length < 3) return null;
                const latVal = parseFloat(p[1]);
                const lngVal = parseFloat(p[2]);
                // Güvenlik: Koordinat 0 veya NaN ise ekleme
                if (!latVal || !lngVal || isNaN(latVal) || isNaN(lngVal)) return null;
                return {
                    name: p[0], lat: latVal, lng: lngVal,
                    location: { lat: latVal, lng: lngVal },
                    day: parseInt(p[3]) || 1, 
                    image: p[4] === "1" ? "default" : "", 
                    category: "Place"
                };
            }).filter(item => item !== null);
        } else if (v1Raw) {
            const decodedV1 = JSON.parse(decodeURIComponent(v1Raw));
            tripData = decodedV1;
            const rawItems = (tripData.items || "").split('*');
            window.cart = rawItems.map(str => {
                const parts = str.split('|');
                if (parts.length < 3) return null;
                return {
                    name: parts[0], lat: parseFloat(parts[1]), lng: parseFloat(parts[2]),
                    location: { lat: parseFloat(parts[1]), lng: parseFloat(parts[2]) },
                    day: parseInt(parts[3]) || 1, image: parts[4] === "no-img" ? "" : decodeURIComponent(parts[4]), category: "Place"
                };
            }).filter(item => item !== null);
        }

        // Temiz veriyi kaydet
        localStorage.setItem('cart', JSON.stringify(window.cart));
        if (document.getElementById('trip_title')) document.getElementById('trip_title').innerText = tripData.n;
        
        const welcomeSection = document.getElementById('tt-welcome');
        if (welcomeSection) { welcomeSection.style.display = 'block'; welcomeSection.classList.add('active'); }

        let attempts = 0;
        const checkReady = setInterval(() => {
            attempts++;
            if (typeof updateCart === 'function' || attempts > 40) {
                clearInterval(checkReady);
                try {
                    if (typeof updateCart === 'function') updateCart();
                    const overlay = document.getElementById('sidebar-overlay-trip');
                    if (overlay) overlay.classList.add('open');
                } catch(e) {}
                
                setTimeout(() => {
                    hideGlobalLoading();
                    if (window.map) window.map.invalidateSize();
                }, 1200);
            }
        }, 300);
    } catch (e) { 
        console.error("Critical Load Error:", e);
        hideGlobalLoading();
    }
});

// --- 3. PAYLAŞIM FONKSİYONLARI ---
async function shareOnWhatsApp() {
    console.log("WhatsApp tetiklendi...");
    
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

    const longUrl = createOptimizedLongLink();
    let shortUrl = longUrl;

    // KENDİ SERVİSİMİZİ KULLANIYORUZ
    try {
        const response = await fetch('/api/shorten', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ longUrl: longUrl })
        });
        
        if (response.ok) {
            const result = await response.json();
            shortUrl = result.shortUrl;
        }
    } catch (e) {
        console.warn("Kendi kısaltma servisimiz cevap vermedi, uzun linkle devam ediliyor.");
    }

    shareText += `View full plan: ${shortUrl}\n\nCreated with triptime.ai!`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
}
function createOptimizedLongLink() {
    const title = (document.getElementById('trip_title')?.innerText || "Trip").replace(/[|*,]/g, '');
    const items = (window.cart || []).map(item => {
        const name = item.name.replace(/[|*,]/g, ''); 
        const lat = parseFloat(item.lat || (item.location && item.location.lat) || 0).toFixed(4);
        const lng = parseFloat(item.lng || (item.location && item.location.lng) || 0).toFixed(4);
        return `${name},${lat},${lng},${item.day || 1},0`;
    }).join('*');
    return `${window.location.origin}${window.location.pathname}?v2=${encodeURIComponent(title + '|' + items)}`;
}

async function generateShareableText() {
    const longUrl = createOptimizedLongLink();
    let shortUrl = longUrl;
    try {
        const apiTarget = `https://tinyurl.com/api-create?url=${encodeURIComponent(longUrl)}`;
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(apiTarget)}`);
        const data = await res.json();
        if (data.contents && data.contents.startsWith('http')) shortUrl = data.contents;
    } catch(e) {}
    return `Check out my trip plan: ${shortUrl}\n\nCreated with triptime.ai!`;
}