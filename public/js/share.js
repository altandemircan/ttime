/**
 * share.js - Logo Animation + Modern Loading + WhatsApp Protection
 */

// --- 1. LOGOLU MODERN LOADING UI ---
function showGlobalLoading() {
    let loader = document.getElementById('trip-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'trip-loader';
        loader.innerHTML = `
            <div class="loader-content">
                <div class="logo-wrapper">
                    <img src="https://triptime.ai/img/for_favicon.png" class="loader-logo" alt="Triptime Logo">
                    <div class="modern-spinner"></div>
                </div>
                <p class="loading-text">Triptime AI Trip Planner is loading</p>
            </div>
            <style>
                #trip-loader {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(255, 255, 255, 0.98); z-index: 99999; 
                    display: flex; align-items: center; justify-content: center; 
                    font-family: 'Inter', sans-serif; backdrop-filter: blur(8px);
                }
                .loader-content { text-align: center; }
                .logo-wrapper {
                    position: relative; width: 80px; height: 80px; margin: 0 auto 25px;
                    display: flex; align-items: center; justify-content: center;
                }
                .loader-logo {
                    width: 45px; height: 45px; z-index: 2;
                    filter: drop-shadow(0 0 10px rgba(138, 74, 243, 0.2));
                }
                .modern-spinner {
                    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                    border: 3px solid rgba(138, 74, 243, 0.1);
                    border-left-color: #8a4af3; border-radius: 50%;
                    animation: modern-spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                    z-index: 1;
                }
                .loading-text {
                    color: #1a1a1a; font-size: 14px; margin-top: 0px;
                    
                }
                @keyframes modern-spin { to { transform: rotate(360deg); } }
                @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(0.98); } }
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

// --- 2. PAYLAŞIM FONKSİYONLARI ---
function generateShareableText() {
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
    shareText += `\nView full plan: ${createShortTripLink()}`;
    return shareText;
}

function createShortTripLink() {
    const title = document.getElementById('trip_title')?.innerText || "My Trip Plan";
    const aiInfo = localStorage.getItem('ai_information') || "";
    const items = (window.cart || []).map(item => {
        const lat = item.lat || (item.location && item.location.lat) || 0;
        const lng = item.lng || (item.location && item.location.lng) || 0;
        const imgUrl = (item.image && item.image.length > 5) ? encodeURIComponent(item.image) : "no-img";
        return `${item.name}|${lat}|${lng}|${item.day || 1}|${imgUrl}`;
    }).join('*');
    const payload = { n: title, ai: aiInfo, items: items };
    return `${window.location.origin}${window.location.pathname}?v1=${encodeURIComponent(JSON.stringify(payload))}`;
}

// --- 3. ANA KARŞILAYICI VE BAŞLATICI ---
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const v1Raw = params.get('v1');
    if (!v1Raw) return;

    showGlobalLoading();

    try {
        const tripData = JSON.parse(decodeURIComponent(v1Raw));
        const rawItems = tripData.items.split('*');
        window.cart = rawItems.map(str => {
            const parts = str.split('|');
            const [name, latStr, lonStr, dayStr, imgStr] = parts;
            const finalImg = (imgStr === "no-img" || !imgStr) ? "" : decodeURIComponent(decodeURIComponent(imgStr));
            return {
                name: name, lat: parseFloat(latStr), lng: parseFloat(lonStr),
                location: { lat: parseFloat(latStr), lng: parseFloat(lonStr) },
                day: parseInt(dayStr) || 1, image: finalImg, category: "Place"
            };
        });

        localStorage.setItem('cart', JSON.stringify(window.cart));
        if (tripData.ai) localStorage.setItem('ai_information', tripData.ai);
        if (document.getElementById('trip_title')) document.getElementById('trip_title').innerText = tripData.n;
        
        // Welcome section aktif kalıyor
        const welcomeSection = document.getElementById('tt-welcome');
        if (welcomeSection) {
            welcomeSection.style.display = 'block';
            welcomeSection.classList.add('active');
        }

        let attempts = 0;
        const checkEverything = setInterval(() => {
            attempts++;
            const isFunctionsReady = typeof updateCart === 'function' && typeof insertTripAiInfo === 'function';

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
                } catch (err) {}

                setTimeout(() => {
                    hideGlobalLoading();
                    try {
                        if (window.map && typeof window.map.invalidateSize === 'function') {
                            window.map.invalidateSize();
                            if (typeof fitMapToCart === 'function') fitMapToCart();
                        }
                    } catch (e) {}
                }, 1000);
            }
        }, 300);
    } catch (e) {
        hideGlobalLoading();
    }
});

function shareOnWhatsApp() {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(generateShareableText())}`, '_blank');
}