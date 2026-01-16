// ============================================================
// share.js - FULL UPDATED VERSION
// ============================================================

// --- 1. Paylaşım Metni Oluşturucu (WhatsApp/Insta vs. için) ---
function generateShareableText() {
    let shareText = "Here's your trip plan!\n\n";
    const maxDay = Math.max(0, ...window.cart.map(item => item.day || 0));
    const dateOptions = { day: 'numeric', month: 'long' };

    for (let day = 1; day <= maxDay; day++) {
        const dayItems = window.cart.filter(item => item.day == day && item.name);
        if (dayItems.length > 0) {
            const dayName = (window.customDayNames && window.customDayNames[day]) || `Day ${day}`;
            let dayHeader;
            const startDateValue = window.tripDates && window.tripDates.startDate ? window.tripDates.startDate : null;
            
            if (startDateValue) {
                const startDateObj = new Date(startDateValue);
                const currentDate = new Date(startDateObj.setDate(startDateObj.getDate() + (day - 1)));
                const formattedDate = currentDate.toLocaleDateString('en-US', dateOptions);
                dayHeader = `--- ${dayName} - ${formattedDate} ---\n`;
            } else {
                dayHeader = `--- ${dayName} ---\n`;
            }
            
            shareText += dayHeader;
            dayItems.forEach(item => {
                shareText += `• ${item.name} (${item.category || 'Place'})\n`;
            });
            shareText += "\n";
        }
    } 

    const shortLink = createShortTripLink();
    shareText += `\n\nView full plan: ${shortLink}`;
    shareText += "\n\nThis plan was created with triptime.ai!"; 
    return shareText;
}

// --- 4. Sosyal Medya Paylaşım Fonksiyonları ---
function shareOnWhatsApp() {
    const text = encodeURIComponent(generateShareableText()); // Senin metnin, dokunmuyoruz.
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const baseUrl = isMobile ? "https://api.whatsapp.com/send" : "https://web.whatsapp.com/send";
    window.open(`${baseUrl}?text=${text}`, '_blank');
}

function shareOnInstagram() {
    const textToShare = generateShareableText();
    if (navigator.clipboard) {
        navigator.clipboard.writeText(textToShare).then(() => {
            alert("Trip plan copied to clipboard!");
        });
    }
}

function shareOnFacebook() {
    const shortLink = createShortTripLink();
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shortLink)}`, '_blank');
}

function shareOnTwitter() {
    const textToShare = generateShareableText();
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(textToShare)}`, '_blank');
}



// --- 2. Link Oluşturucu (Tüm veriyi linke gömer) ---
function createShortTripLink() {
    const title = document.getElementById('trip_title')?.innerText || "My Trip Plan";
    const aiInfo = localStorage.getItem('ai_information') || "";

    const items = (window.cart || []).map(item => {
        // Koordinatları garantiye al
        const lat = item.lat || (item.location && item.location.lat) || 0;
        const lng = item.lng || (item.location && item.location.lng) || 0;
        
        // Resmi garantiye al (Pexels veya manuel yükleme)
        let img = "no-img";
        if (item.image && item.image !== "") {
            img = item.image;
        }

        return `${item.name}:${lat}:${lng}:${item.day || 1}:${encodeURIComponent(img)}`;
    }).join('*');

    const payload = {
        n: title,
        ai: aiInfo,
        items: items
    };

    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?v1=${encodeURIComponent(JSON.stringify(payload))}`;
}

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const v1Raw = params.get('v1');
    if (!v1Raw) return;

    try {
        const tripData = JSON.parse(decodeURIComponent(v1Raw));
        const rawItems = tripData.items.split('*');
        
        window.cart = rawItems.map(str => {
            const parts = str.split(':');
            const [name, lat, lon, day, img] = parts;
            const finalImg = (img === "no-img" || !img) ? "" : decodeURIComponent(img);
            
            return {
                name: name,
                lat: parseFloat(lat),
                lng: parseFloat(lon),
                location: { lat: parseFloat(lat), lng: parseFloat(lon) },
                day: parseInt(day),
                image: finalImg,
                category: "Place" // Varsayılan kategori
            };
        });

        // Hafızayı tazele
        localStorage.setItem('cart', JSON.stringify(window.cart));
        if (tripData.ai) localStorage.setItem('ai_information', tripData.ai);
        
        const titleEl = document.getElementById('trip_title');
        if (titleEl) titleEl.innerText = tripData.n;

        // UI Hazırla
        if (document.getElementById('tt-welcome')) document.getElementById('tt-welcome').style.display = 'none';
        const overlay = document.getElementById('sidebar-overlay-trip');
        if (overlay) overlay.classList.add('open');

        // SİSTEMİ ATEŞLE (Harita + Rota + AI + Resimler)
        setTimeout(() => {
            if (typeof updateCart === 'function') {
                updateCart(); // Resimler bu fonksiyon içindeki render döngüsüyle ekrana basılır
            }
            
            // AI Kutusunu bas
            if (tripData.ai && typeof insertTripAiInfo === "function") {
                const parts = tripData.ai.split('\n\n');
                const staticAi = {
                    summary: parts[0]?.replace('Summary:', '').trim(),
                    tip: parts[1]?.replace('Tip:', '').trim(),
                    highlight: parts[2]?.replace('Highlight:', '').trim()
                };
                insertTripAiInfo(null, staticAi);
            }

            // Haritayı odakla
            if (window.map) {
                window.map.invalidateSize();
                if (typeof fitMapToCart === 'function') fitMapToCart();
            }
        }, 1200);

    } catch (e) {
        console.error("Kritik Yükleme Hatası:", e);
    }
});