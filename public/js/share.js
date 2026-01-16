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

// --- 2. Link Oluşturucu (Tüm veriyi linke gömer) ---
function createShortTripLink() {
    const title = document.getElementById('trip_title')?.innerText || "My Trip Plan";
    const aiInfo = localStorage.getItem('ai_information') || ""; // Yukarıdaki kod burayı dolduruyor

    const items = (window.cart || []).map(item => {
        return `${item.name}:${item.lat}:${item.lng}:${item.day || 1}:${item.image || ''}`;
    }).join('*');

    const payload = {
        n: title,
        ai: aiInfo,
        items: items
    };

    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?v1=${encodeURIComponent(JSON.stringify(payload))}`;
}

// --- 3. Linke Tıklanınca Veriyi Yükleyen Kısım ---
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const v1Raw = params.get('v1');
    if (!v1Raw) return;

    try {
        const tripData = JSON.parse(decodeURIComponent(v1Raw));
        const rawItems = tripData.items.split('*');
        
        // 1. window.cart'ı doldur
        window.cart = rawItems.map(str => {
            const parts = str.split(':');
            const [name, lat, lon, day, img, cat] = parts;
            return {
                name: name,
                lat: parseFloat(lat),
                lng: parseFloat(lon),
                location: { lat: parseFloat(lat), lng: parseFloat(lon) },
                day: parseInt(day),
                image: (img === "no-img" || !img) ? "" : decodeURIComponent(img),
                category: cat || "Place"
            };
        });

        // 2. AI Bilgisini ve Gezi Adını Geri Yükle + EKRANA BAS
        if (tripData.ai) {
            localStorage.setItem('ai_information', tripData.ai);
            
            // Linkten gelen AI metnini parçalayıp ekrandaki kutuya basıyoruz
            if (typeof insertTripAiInfo === "function") {
                const parts = tripData.ai.split('\n\n');
                const staticAi = {
                    summary: parts[0] ? parts[0].replace('Summary:', '').trim() : "",
                    tip: parts[1] ? parts[1].replace('Tip:', '').trim() : "",
                    highlight: parts[2] ? parts[2].replace('Highlight:', '').trim() : ""
                };
                // API'ye gitmeden eldeki veriyi UI'ya çizer
                insertTripAiInfo(null, staticAi);
            }
        }
        
        const titleEl = document.getElementById('trip_title');
        if (titleEl) titleEl.innerText = tripData.n;

        // 3. LocalStorage Güncelle
        localStorage.setItem('cart', JSON.stringify(window.cart));

        // 4. UI'ı Hazırla
        if (document.getElementById('tt-welcome')) document.getElementById('tt-welcome').style.display = 'none';
        const overlay = document.getElementById('sidebar-overlay-trip');
        if (overlay) overlay.classList.add('open');

        // 5. Sistemi Ateşle
        setTimeout(() => {
            if (typeof updateCart === 'function') updateCart();
            if (window.map) window.map.invalidateSize();
        }, 800);

    } catch (e) {
        console.error("Critical Load Error:", e);
    }
});

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