/**
 * share.js - THE FINAL ULTIMATE VERSION
 * Created with triptime.ai!
 */

// --- 1. MODERN LOADING UI ---
function showGlobalLoading() {
    let loader = document.getElementById('trip-loader');
    if (!loader) {
        const messages = [
            "AI is crafting your perfect route...",
            "Checking local gems for you...",
            "Organizing your travel days...",
            "Almost ready for takeoff!"
        ];
        const randomMsg = messages[Math.floor(Math.random() * messages.length)];

        loader = document.createElement('div');
        loader.id = 'trip-loader';
        loader.innerHTML = `
            <div class="loader-card">
                <div class="loader-header">
                    <img src="/img/triptime_logo.svg" class="main-logo" alt="Triptime AI">
                </div>
                
                <div class="loader-body">
                    <div class="progress-container">
                        <div class="progress-bar-fill"></div>
                    </div>
                    <p class="loading-text">${randomMsg}</p>
                </div>
            </div>

            <style>
                #trip-loader {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: #f8f9fa; /* Arkadaki hizasızlığı kapatan solid fon */
                    z-index: 9999999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                }

                .loader-card {
                    background: #ffffff;
                    padding: 40px 30px;
                    border-radius: 24px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.05);
                    text-align: center;
                    width: 90%;
                    max-width: 360px;
                    animation: cardEntrance 0.5s ease-out;
                }

                .loader-header {
                    margin-bottom: 25px;
                }

                .main-logo {
                    width: 200px; 
                    height: auto;
                    display: block;
                    margin: 0 auto;
                }

                .progress-container {
                    width: 100%;
                    height: 6px;
                    background: #f0f0f2;
                    border-radius: 10px;
                    overflow: hidden;
                    margin-bottom: 15px;
                    position: relative;
                }

                .progress-bar-fill {
                    width: 40%;
                    height: 100%;
                    background: #8a4af3; /* İstediğin mor tonu */
                    border-radius: 10px;
                    position: absolute;
                    left: -40%;
                    animation: loading-slide 1.4s infinite cubic-bezier(0.45, 0, 0.55, 1);
                }

                .loading-text {
                    font-size: 14px;
                    color: #666;
                    margin: 0;
                    font-weight: 500;
                }

                @keyframes loading-slide {
                    0% { left: -40%; width: 30%; }
                    50% { width: 50%; }
                    100% { left: 100%; width: 30%; }
                }

                @keyframes cardEntrance {
                    from { opacity: 0; transform: translateY(15px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            </style>
        `;
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
            const imgVal = p[4] === '0' ? 'default' : p[4];
return {
    name: p[0], lat: parseFloat(p[1]), lng: parseFloat(p[2]),
    location: { lat: parseFloat(p[1]), lng: parseFloat(p[2]) },
    day: parseInt(p[3]) || 1, 
    image: imgVal, 
    category: "Place"
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
       // URL'yi çok uzatmamak için resim varsa gönderiyoruz
const imgPath = (item.image && item.image !== 'default') ? item.image : '0';
return `${name},${lat},${lng},${item.day || 1},${imgPath}`;
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