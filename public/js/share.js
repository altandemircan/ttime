/**
 * share.js - FULL VERSION (Loading Fix + Social Media Text)
 */

// --- 1. Paylaşım Metni Oluşturucu (Geri Geldi!) ---
function generateShareableText() {
    let shareText = "Here's your trip plan!\n\n";
    const maxDay = Math.max(0, ...window.cart.map(item => item.day || 0));

    for (let day = 1; day <= maxDay; day++) {
        const dayItems = window.cart.filter(item => item.day == day && item.name);
        if (dayItems.length > 0) {
            shareText += `--- Day ${day} ---\n`;
            dayItems.forEach(item => {
                shareText += `• ${item.name}\n`;
            });
            shareText += "\n";
        }
    } 

    const shortLink = createShortTripLink();
    shareText += `\nView full plan: ${shortLink}`;
    shareText += "\n\nCreated with triptime.ai!"; 
    return shareText;
}

// --- 2. Link Oluşturucu (Pexels Fix) ---
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

// --- 3. Ana Karşılayıcı ve Loading Ayarı ---
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const v1Raw = params.get('v1');
    if (!v1Raw) return;

    if (typeof showGlobalLoading === 'function') showGlobalLoading();

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
        if (document.getElementById('tt-welcome')) document.getElementById('tt-welcome').style.display = 'none';

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
                    if (typeof hideGlobalLoading === 'function') hideGlobalLoading();
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
        if (typeof hideGlobalLoading === 'function') hideGlobalLoading();
    }
});

// --- 4. Sosyal Medya Paylaşım Fonksiyonları ---
function shareOnWhatsApp() {
    const text = encodeURIComponent(generateShareableText());
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
}

function shareOnInstagram() {
    const textToShare = generateShareableText();
    if (navigator.clipboard) {
        navigator.clipboard.writeText(textToShare).then(() => {
            alert("Trip plan copied to clipboard for Instagram!");
        });
    }
}