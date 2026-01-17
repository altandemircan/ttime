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

/**
 * share.js - THE AI ENABLED ULTIMATE VERSION
 * Created with triptime.ai!
 */

// ... [showGlobalLoading ve hideGlobalLoading kısımları aynı kalıyor] ...

// --- 2. SAYFA YÜKLENDİĞİNDE VERİ ÇÖZÜCÜ ---
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const v2Raw = params.get('v2');
    
    if (!v2Raw) return; // v1 desteğini istersen tutabilirsin ama v2 ana odağımız

    showGlobalLoading();

    try {
        const decoded = decodeURIComponent(v2Raw);
        // Yeni format: Başlık | Öğeler | AI_Verisi (Summary~Tip~Highlight)
        const [title, itemsStr, aiStr] = decoded.split('|');
        
        // 1. Şehir Planı Verileri
        const rawItems = itemsStr.split('*');
        window.cart = rawItems.map(str => {
            const p = str.split(',');
            if (p.length < 3) return null;
            return {
                name: p[0], lat: parseFloat(p[1]), lng: parseFloat(p[2]),
                location: { lat: parseFloat(p[1]), lng: parseFloat(p[2]) },
                day: parseInt(p[3]) || 1, image: "default", category: "Place"
            };
        }).filter(item => item !== null);

        // 2. AI Verisi Varsa Yakala (Kritik Nokta!)
        if (aiStr) {
            const [s, t, h] = aiStr.split('~');
            window.sharedAiStaticInfo = { summary: s, tip: t, highlight: h };
        }

        // UI Güncelleme
        localStorage.setItem('cart', JSON.stringify(window.cart));
        if (document.getElementById('trip_title')) document.getElementById('trip_title').innerText = title;
        
        // ... [updateCart ve hideGlobalLoading kısımları aynı] ...

        // Sayfa tamamen hazır olunca AI kutusunu bas
        // --- LOADER VE AI VERİSİ FİX ---
        let attempts = 0;
        const checkReady = setInterval(() => {
            attempts++;
            const isCartReady = typeof updateCart === 'function';
            if (isCartReady || attempts > 50) { 
                clearInterval(checkReady);
                try {
                    if (isCartReady) updateCart();
                    if (window.sharedAiStaticInfo && typeof insertTripAiInfo === 'function') {
                        insertTripAiInfo(null, window.sharedAiStaticInfo);
                    }
                    const overlay = document.getElementById('sidebar-overlay-trip');
                    if (overlay) overlay.classList.add('open');
                } catch(e) { console.error("Load Error:", e); }
                setTimeout(() => {
                    hideGlobalLoading();
                    if (window.map) window.map.invalidateSize();
                }, 800);
            }
        }, 300);

    } catch (e) { 
        console.error("Critical Load Error:", e);
        hideGlobalLoading();
    }
});

// --- 3. PAYLAŞIM FONKSİYONLARI ---

function createOptimizedLongLink() {
    const title = (document.getElementById('trip_title')?.innerText || "Trip").replace(/[|*~,]/g, '');
    
    // 1. Durakları Paketle
   const items = (window.cart || []).map(item => {
        const name = (item.name || "Place").replace(/[|*~,]/g, ''); 
        const latVal = item.lat || (item.location && (item.location.lat || item.location.y)) || 0;
        const lngVal = item.lng || (item.location && (item.location.lng || item.location.x)) || 0;
        const lat = parseFloat(latVal).toFixed(4);
        const lng = parseFloat(lngVal).toFixed(4);
        return `${name},${lat},${lng},${item.day || 1},0`;
    }).join('*')

    // 2. AI Verisini Paketle
    let aiPart = "";
    // Önce global değişkeni, o yoksa DOM'daki metni kontrol et
    const aiSummaryText = window.lastTripAIInfo?.summary || document.getElementById('ai-summary')?.innerText;
    
    if (aiSummaryText) {
        const s = aiSummaryText.replace(/[|*~]/g, '').trim();
        const t = (window.lastTripAIInfo?.tip || document.getElementById('ai-tip')?.innerText || "").replace(/[|*~]/g, '').trim();
        const h = (window.lastTripAIInfo?.highlight || document.getElementById('ai-highlight')?.innerText || "").replace(/[|*~]/g, '').trim();
        aiPart = `|${s}~${t}~${h}`;
    }

    return `${window.location.origin}${window.location.pathname}?v2=${encodeURIComponent(title + '|' + items + aiPart)}`;
}

// ... [shareOnWhatsApp fonksiyonu aynı kalsın, createOptimizedLongLink'i otomatik kullanacak zaten] ...
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