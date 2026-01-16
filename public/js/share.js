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
                    <div class="modern-spinner"></div>
                    <img src="https://triptime.ai/img/for_favicon.png" class="loader-logo" alt="Triptime Logo">
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
                .loader-content { 
                    display: flex; flex-direction: column; align-items: center; justify-content: center; 
                }
                .logo-wrapper {
                    position: relative; 
                    width: 80px; height: 80px; 
                    margin-bottom: 20px;
                    display: flex; align-items: center; justify-content: center;
                }
                .loader-logo {
                    width: 54px; height: 54px; 
                    z-index: 2;
                    display: block;
                    filter: drop-shadow(0 0 8px rgba(138, 74, 243, 0.15));
                }
                .modern-spinner {
                    position: absolute; 
                    /* Spinner wrapper'ı tam kaplar */
                    top: 0; left: 0; right: 0; bottom: 0;
                    border: 3px solid rgba(138, 74, 243, 0.1);
                    border-left-color: #8a4af3; 
                    border-radius: 50%;
                    animation: modern-spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                    z-index: 1;
                }
                .loading-text {
                    color: #1a1a1a; 
                    font-size: 14px; 
                    margin: 0;
                    font-weight: 500;
                    animation: pulse 1.8s ease-in-out infinite;
                }
                @keyframes modern-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
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
async function generateShareableText() {
    let shareText = "Check out my trip plan!\n\n";
    const maxDay = Math.max(0, ...window.cart.map(item => item.day || 0));

    // Günlük plan listesini oluştur
    for (let day = 1; day <= maxDay; day++) {
        const dayItems = window.cart.filter(item => item.day == day && item.name);
        if (dayItems.length > 0) {
            shareText += `--- Day ${day} ---\n`;
            dayItems.forEach(item => {
                shareText += `* ${item.name}\n`;
            });
            shareText += "\n";
        }
    }

    const longUrl = createShortTripLink(); // O devasa link
    
    try {
        // ÜCRETSİZ ALTIN VURUŞ: TinyURL API ile linki küçült
        const response = await fetch(`https://tinyurl.com/api-create?url=${encodeURIComponent(longUrl)}`);
        if (!response.ok) throw new Error('Shortener error');
        const shortUrl = await response.text();
        shareText += `View full plan: ${shortUrl}`;
    } catch (err) {
        // API'de sorun olursa (internet kesikse vb.) eski uzun linki bas, sistem durmasın
        shareText += `View full plan: ${longUrl}`;
    }

    shareText += "\n\nCreated with triptime.ai!"; 
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

function createOptimizedLongLink() {
    const title = document.getElementById('trip_title')?.innerText || "Trip";
    
    // URL'yi asıl şişiren Pexels linklerini ve AI metnini paylaşım linkinden çıkarıyoruz
    // Çünkü alıcı linki açtığında sistem zaten koordinatlara göre yeni resim çekebilir
    const items = (window.cart || []).map(item => {
        const lat = parseFloat(item.lat || 0).toFixed(4);
        const lng = parseFloat(item.lng || 0).toFixed(4);
        // Resim URL'sini göndermiyoruz, sadece "no-img" veya "has-img" işareti koyuyoruz
        const imgSign = item.image ? "1" : "0"; 
        return `${item.name}|${lat}|${lng}|${item.day || 1}|${imgSign}`;
    }).join('*');

    // AI metnini çok uzun olduğu için linkten atıyoruz (Alıcı tarafı gerekirse tekrar üretir)
    const payload = { n: title, items: items }; 
    const baseUrl = window.location.origin + window.location.pathname;
    
    return `${baseUrl}?v1=${encodeURIComponent(JSON.stringify(payload))}`;
}

// --- 2. ASYNC WHATSAPP PAYLAŞIM ---
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

        const optimizedUrl = createOptimizedLongLink();
        
        // TinyURL'e gönderilen link artık çok daha kısa, kesin çalışır
        const response = await fetch(`https://tinyurl.com/api-create?url=${encodeURIComponent(optimizedUrl)}`);
        const shortUrl = response.ok ? await response.text() : optimizedUrl;

        shareText += `View full plan: ${shortUrl}`;
        shareText += "\n\nCreated with triptime.ai!";

        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
    } catch (e) {
        console.error("Link kısaltma hatası:", e);
    } finally {
        if (typeof hideGlobalLoading === 'function') hideGlobalLoading();
    }
}

function shareOnInstagram() {
    // Instagram için de kısa linkli versiyonu kopyalayalım
    if (typeof showGlobalLoading === 'function') showGlobalLoading();
    generateShareableText().then(textToShare => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(textToShare).then(() => {
                alert("Trip plan with short link copied to clipboard!");
            });
        }
        if (typeof hideGlobalLoading === 'function') hideGlobalLoading();
    });
}