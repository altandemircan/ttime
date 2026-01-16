// --- 1. Loading UI Oluşturucu ---
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
        setTimeout(() => loader.remove(), 500);
    }
}

// --- 2. Link Oluşturucu (Ayraç: | ) ---
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

// --- 3. Ana Karşılayıcı ---
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const v1Raw = params.get('v1');
    if (!v1Raw) return;

    // Hemen loading göster
    showGlobalLoading();

    try {
        const tripData = JSON.parse(decodeURIComponent(v1Raw));
        const rawItems = tripData.items.split('*');
        
        window.cart = rawItems.map(str => {
            const [name, latStr, lonStr, dayStr, imgStr] = str.split('|');
            const latVal = parseFloat(latStr);
            const lngVal = parseFloat(lonStr);
            return {
                name: name, lat: latVal, lng: lngVal,
                location: { lat: latVal, lng: lngVal },
                day: parseInt(dayStr) || 1,
                image: (imgStr === "no-img" || !imgStr) ? "" : decodeURIComponent(decodeURIComponent(imgStr)),
                category: "Place"
            };
        });

        localStorage.setItem('cart', JSON.stringify(window.cart));
        if (tripData.ai) localStorage.setItem('ai_information', tripData.ai);
        
        // UI Başlangıç Hazırlığı
        if (document.getElementById('trip_title')) document.getElementById('trip_title').innerText = tripData.n;
        if (document.getElementById('tt-welcome')) document.getElementById('tt-welcome').style.display = 'none';

        // --- ZİNCİRLEME YÜKLEME KONTROLÜ ---
        let attempts = 0;
        const checkEverything = setInterval(() => {
            attempts++;
            const isMapReady = !!window.map;
            const isFunctionsReady = typeof updateCart === 'function' && typeof insertTripAiInfo === 'function';

            if ((isMapReady && isFunctionsReady) || attempts > 50) {
                clearInterval(checkEverything);

                // 1. Rota ve Listeyi Çiz
                updateCart();

                // 2. AI Kutusunu Bas
                if (tripData.ai) {
                    const parts = tripData.ai.split('\n\n');
                    insertTripAiInfo(null, {
                        summary: parts[0]?.replace(/Summary:\s*/i, '').trim() || "",
                        tip: parts[1]?.replace(/Tip:\s*/i, '').trim() || "",
                        highlight: parts[2]?.replace(/Highlight:\s*/i, '').trim() || ""
                    }, null);
                }

                // 3. Sidebar'ı Aç
                const overlay = document.getElementById('sidebar-overlay-trip');
                if (overlay) overlay.classList.add('open');

                // 4. Haritayı Odakla ve Bitir
                setTimeout(() => {
                    window.map.invalidateSize();
                    if (typeof fitMapToCart === 'function') fitMapToCart();
                    
                    // HER ŞEY TAMAM, PERDEYİ AÇ
                    hideGlobalLoading();
                }, 1000);
            }
        }, 300);

    } catch (e) {
        console.error("Yükleme Hatası:", e);
        hideGlobalLoading();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const v1Raw = params.get('v1');
    if (!v1Raw) return;

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
        if (document.getElementById('sidebar-overlay-trip')) document.getElementById('sidebar-overlay-trip').classList.add('open');

        // --- AI VE ROTA BAŞLATICI (GARANTİCİ) ---
        
        // 1. AI Kutusunu Haritadan Bağımsız Bas (Hemen)
        setTimeout(() => {
            if (tripData.ai && typeof insertTripAiInfo === "function") {
                const parts = tripData.ai.split('\n\n');
                const staticAi = {
                    summary: parts[0]?.replace(/Summary:\s*/i, '').trim() || "",
                    tip: parts[1]?.replace(/Tip:\s*/i, '').trim() || "",
                    highlight: parts[2]?.replace(/Highlight:\s*/i, '').trim() || ""
                };
                insertTripAiInfo(null, staticAi, null);
                console.log("✅ AI Kutsu haritadan bağımsız basıldı.");
            }
        }, 500); // Yarım saniye sonra AI gelsin

        // 2. Harita ve Rota İçin Döngü (Harita gelince çalışır)
        const checkMap = setInterval(() => {
            if (typeof updateCart === 'function' && window.map) {
                clearInterval(checkMap);
                updateCart(); // Rota ve Listeyi Çiz
                
                setTimeout(() => {
                    window.map.invalidateSize();
                    if (typeof fitMapToCart === 'function') fitMapToCart();
                }, 1000);
                console.log("✅ Harita ve Rota hazır.");
            }
        }, 500);

    } catch (e) {
        console.error("Yükleme Hatası:", e);
    }
});
// Paylaşım metni oluşturucu (WhatsApp vb için)
function generateShareableText() {
    let shareText = "Here's your trip plan!\n\n";
    const maxDay = Math.max(0, ...window.cart.map(item => item.day || 0));
    for (let day = 1; day <= maxDay; day++) {
        const dayItems = window.cart.filter(item => item.day == day);
        if (dayItems.length > 0) {
            shareText += `--- Day ${day} ---\n`;
            dayItems.forEach(item => shareText += `• ${item.name}\n`);
            shareText += "\n";
        }
    }
    shareText += `\nView full plan: ${createShortTripLink()}`;
    return shareText;
}

function shareOnWhatsApp() {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(generateShareableText())}`, '_blank');
}