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
                    <img src="https://triptime.ai/img/for_favicon.png" class="loader-logo-static" alt="Logo">
                    <span class="loader-brand">triptime.ai</span>
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
                    background: #f8f9fa; /* Hafif kırık beyaz, arkadaki karmaşayı %100 kapatır */
                    z-index: 9999999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: 'Inter', -apple-system, sans-serif;
                }

                .loader-card {
                    background: #ffffff;
                    padding: 40px;
                    border-radius: 24px;
                    box-shadow: 0 15px 35px rgba(138, 74, 243, 0.1), 0 5px 15px rgba(0,0,0,0.05);
                    text-align: center;
                    width: 85%;
                    max-width: 380px;
                    border: 1px solid rgba(138, 74, 243, 0.1);
                    animation: cardEntrance 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
                }

                .loader-header {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    margin-bottom: 30px;
                }

                .loader-logo-static {
                    width: 32px;
                    height: 32px;
                }

                .loader-brand {
                    font-weight: 800;
                    font-size: 22px;
                    color: #1a1a1a;
                    letter-spacing: -0.03em;
                }

                .progress-container {
                    width: 100%;
                    height: 8px;
                    background: #eeeef0;
                    border-radius: 10px;
                    overflow: hidden;
                    margin-bottom: 20px;
                    position: relative;
                }

                .progress-bar-fill {
                    width: 45%;
                    height: 100%;
                    background: linear-gradient(90deg, #8a4af3, #b084f7); /* İstediğin mor tonu */
                    border-radius: 10px;
                    position: absolute;
                    left: -45%;
                    animation: loading-slide 1.6s infinite cubic-bezier(0.4, 0, 0.2, 1);
                }

                .loading-text {
                    font-size: 15px;
                    color: #555;
                    margin: 0;
                    font-weight: 500;
                    line-height: 1.4;
                }

                @keyframes loading-slide {
                    0% { left: -45%; width: 30%; }
                    50% { left: 30%; width: 60%; }
                    100% { left: 100%; width: 30%; }
                }

                @keyframes cardEntrance {
                    from { opacity: 0; transform: scale(0.9) translateY(20px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
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