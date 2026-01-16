// ============================================================
// share.js - KESİN ÇÖZÜM (AI + PEXELS + ROTA)
// ============================================================

// --- 1. Link Oluşturucu (Pexels & Koordinat Fix) ---
// --- 1. Link Oluşturucu (Lat/Lng Sırasını Garantiye Alıyoruz) ---
function createShortTripLink() {
    const title = document.getElementById('trip_title')?.innerText || "My Trip Plan";
    const aiInfo = localStorage.getItem('ai_information') || "";

    const items = (window.cart || []).map(item => {
        // Samsun hatasını önlemek için: Önce Lat, Sonra Lng!
        const lat = item.lat || (item.location && item.location.lat) || 0;
        const lng = item.lng || (item.location && item.location.lng) || 0;
        
        const imgUrl = (item.image && item.image.length > 5) ? encodeURIComponent(item.image) : "no-img";
        
        // Format: Name | Lat | Lng | Day | Img
        return `${item.name}|${lat}|${lng}|${item.day || 1}|${imgUrl}`;
    }).join('*');

    const payload = { n: title, ai: aiInfo, items: items };
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?v1=${encodeURIComponent(JSON.stringify(payload))}`;
}

// --- 2. Karşılayıcı (Veriyi Doğru Sırayla Okuma) ---
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const v1Raw = params.get('v1');
    if (!v1Raw) return;

    try {
        const tripData = JSON.parse(decodeURIComponent(v1Raw));
        const rawItems = tripData.items.split('*');
        
        window.cart = rawItems.map(str => {
            const parts = str.split('|');
            // DİKKAT: Sıralama Linktekiyle Aynı Olmalı (Name|Lat|Lng|Day|Img)
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

        // AI ve Rota İçin Sistemin Hazır Olmasını Bekle
        const checkSystem = setInterval(() => {
            if (typeof updateCart === 'function' && window.map) {
                clearInterval(checkSystem);
                
                // Önce rota ve liste (Artık koordinatlar doğru olduğu için patlamayacak)
                updateCart();

                // AI Kutusunu Enjekte Et (Doğru Parametrelerle)
                if (tripData.ai && typeof insertTripAiInfo === "function") {
                    const parts = tripData.ai.split('\n\n');
                    const staticAi = {
                        summary: parts[0]?.replace(/Summary:\s*/i, '').trim() || "",
                        tip: parts[1]?.replace(/Tip:\s*/i, '').trim() || "",
                        highlight: parts[2]?.replace(/Highlight:\s*/i, '').trim() || ""
                    };
                    
                    // Mainscript'in AI render'ını tetikle
                    setTimeout(() => {
                        insertTripAiInfo(null, staticAi, null);
                    }, 500);
                }

                // Haritayı Tazele
                setTimeout(() => {
                    window.map.invalidateSize();
                    if (typeof fitMapToCart === 'function') fitMapToCart();
                }, 1000);
            }
        }, 200);

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