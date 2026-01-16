// ============================================================
// share.js - KESİN ÇÖZÜM (AI + PEXELS + ROTA)
// ============================================================

// --- 1. Link Oluşturucu (Pexels & Koordinat Fix) ---
function createShortTripLink() {
    const title = document.getElementById('trip_title')?.innerText || "My Trip Plan";
    const aiInfo = localStorage.getItem('ai_information') || "";

    const items = (window.cart || []).map(item => {
        const lat = item.lat || (item.location && item.location.lat) || 0;
        const lng = item.lng || (item.location && item.location.lng) || 0;
        // Pexels URL'sini linki bozmaması için çift encode yapıyoruz
        const imgUrl = (item.image && item.image.length > 5) ? encodeURIComponent(item.image) : "no-img";
        // Ayraç olarak | kullanıyoruz ki resimdeki : bölmesin
        return `${item.name}|${lat}|${lng}|${item.day || 1}|${imgUrl}`;
    }).join('*');

    const payload = { n: title, ai: aiInfo, items: items };
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?v1=${encodeURIComponent(JSON.stringify(payload))}`;
}

// --- 2. Linke Tıklanınca Yükleyen Ana Kısım ---
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const v1Raw = params.get('v1');
    if (!v1Raw) return;

    try {
        const tripData = JSON.parse(decodeURIComponent(v1Raw));
        const rawItems = tripData.items.split('*');
        
        window.cart = rawItems.map(str => {
            const parts = str.split('|');
            const [name, lat, lon, day, img] = parts;
            // Çift decode: Pexels linkini kurtarır
            const finalImg = (img === "no-img" || !img) ? "" : decodeURIComponent(decodeURIComponent(img));
            
            return {
                name: name,
                lat: parseFloat(lat),
                lng: parseFloat(lon),
                location: { lat: parseFloat(lat), lng: parseFloat(lon) },
                day: parseInt(day),
                image: finalImg,
                category: "Place"
            };
        });

        // Verileri hemen hafızaya ve başlığa yaz
        localStorage.setItem('cart', JSON.stringify(window.cart));
        if (tripData.ai) localStorage.setItem('ai_information', tripData.ai);
        
        const titleEl = document.getElementById('trip_title');
        if (titleEl) titleEl.innerText = tripData.n;

        // UI Hazırla
        if (document.getElementById('tt-welcome')) document.getElementById('tt-welcome').style.display = 'none';
        const overlay = document.getElementById('sidebar-overlay-trip');
        if (overlay) overlay.classList.add('open');

        // --- KRİTİK TETİKLEYİCİ ---
        // Sistem (mainscript.js) hazır olana kadar bekle
        let aiTriggered = false;
        const waitForSystem = setInterval(() => {
            // Eğer updateCart ve harita hazırsa başla
            if (typeof updateCart === 'function' && window.map) {
                
                // 1. Rota ve Listeyi Hemen Çiz
                updateCart();

                // 2. AI Kutusunu Garantili Çiz (Zorlama modunda)
                if (tripData.ai && !aiTriggered && typeof insertTripAiInfo === "function") {
                    const parts = tripData.ai.split('\n\n');
                    const staticAi = {
                        summary: parts[0]?.replace(/Summary:\s*/i, '').trim() || "",
                        tip: parts[1]?.replace(/Tip:\s*/i, '').trim() || "",
                        highlight: parts[2]?.replace(/Highlight:\s*/i, '').trim() || ""
                    };
                    
                    // Önce UI'da yer aç, sonra bas
                    setTimeout(() => {
                        insertTripAiInfo(null, staticAi);
                        aiTriggered = true;
                    }, 500);
                }

                // 3. Haritayı son kez tazele (10 saniye sonra değil, hemen 1 saniye sonra)
                setTimeout(() => {
                    window.map.invalidateSize();
                    if (typeof fitMapToCart === 'function') fitMapToCart();
                }, 1000);

                clearInterval(waitForSystem); // Döngüyü kapat
            }
        }, 300);

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