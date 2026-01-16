/**
 * share.js - THE FINAL FIX
 * Created with triptime.ai!
 */

// --- 1. SAYFA YÜKLENDİĞİNDE LİNKİ ÇÖZME ---
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const v1Raw = params.get('v1');
    const v2Raw = params.get('v2'); // Değişkeni burada tanımladık
    
    if (!v1Raw && !v2Raw) return;

    if (typeof showGlobalLoading === 'function') showGlobalLoading();

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
            const rawItems = tripData.items.split('*');
            window.cart = rawItems.map(str => {
                const parts = str.split('|');
                return {
                    name: parts[0], lat: parseFloat(parts[1]), lng: parseFloat(parts[2]),
                    location: { lat: parseFloat(parts[1]), lng: parseFloat(parts[2]) },
                    day: parseInt(parts[3]) || 1, image: parts[4] === "no-img" ? "" : decodeURIComponent(parts[4]), category: "Place"
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
                    if (typeof hideGlobalLoading === 'function') hideGlobalLoading();
                    if (window.map) window.map.invalidateSize();
                }, 1000);
            }
        }, 300);
    } catch (e) { 
        console.error("Yükleme Hatası:", e);
        if (typeof hideGlobalLoading === 'function') hideGlobalLoading();
    }
});

// --- 2. WHATSAPP PAYLAŞIM VE LİNK KISALTMA ---
async function shareOnWhatsApp() {
    if (typeof showGlobalLoading === 'function') showGlobalLoading();
    
    try {
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

        // Proxy üzerinden TinyURL (CORS Engeli Olmaz)
        try {
            const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent('https://tinyurl.com/api-create?url=' + encodeURIComponent(longUrl))}`);
            if (res.ok) {
                const data = await res.json();
                if (data.contents && data.contents.startsWith('http')) shortUrl = data.contents;
            }
        } catch (e) { console.log("Kısaltma yapılamadı."); }

        shareText += `View full plan: ${shortUrl}\n\nCreated with triptime.ai!`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
    } finally {
        if (typeof hideGlobalLoading === 'function') hideGlobalLoading();
    }
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