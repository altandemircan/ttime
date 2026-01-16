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
    if (!window.cart || window.cart.length === 0) return window.location.origin;
    
    // Gezi Adını al (id="trip_title" alanından dinamik çekiyoruz)
    const titleEl = document.getElementById('trip_title');
    const tripName = titleEl ? titleEl.innerText : "My Trip Plan";
    
    // AI bilgisini localStorage'dan alıyoruz
    const aiInfo = localStorage.getItem('ai_information') || "";

    // window.cart'ı paketle (Resim URL'leri dahil)
    const items = window.cart.map(it => {
        const name = it.name.replace(/[:|*]/g, "");
        const la = it.lat || it.location?.lat || 0;
        const lo = it.lng || it.location?.lng || 0;
        const day = it.day || 1;
        const img = it.image ? encodeURIComponent(it.image) : "no-img"; 
        const cat = it.category || "Place";
        return `${name}:${la}:${lo}:${day}:${img}:${cat}`;
    }).join('*');

    const tripData = { n: tripName, ai: aiInfo, items: items };
    return `${window.location.origin}${window.location.pathname}?v1=${encodeURIComponent(JSON.stringify(tripData))}`;
}

// --- 3. Linke Tıklanınca Veriyi Yükleyen Kısım ---
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const v1Raw = params.get('v1');
    if (!v1Raw) return;

    try {
        const tripData = JSON.parse(decodeURIComponent(v1Raw));
        const rawItems = tripData.items.split('*');
        
        // 1. window.cart'ı resimler ve kategorilerle beraber doldur
        window.cart = rawItems.map(str => {
            const parts = str.split(':');
            const [name, lat, lon, day, img, cat] = parts;
            return {
                name: name,
                lat: parseFloat(lat),
                lng: parseFloat(lon),
                location: { lat: parseFloat(lat), lng: parseFloat(lon) },
                day: parseInt(day),
                image: img === "no-img" ? "" : decodeURIComponent(img),
                category: cat || "Place"
            };
        });

        // 2. AI Bilgisini ve Gezi Adını Geri Yükle
        if (tripData.ai) {
            localStorage.setItem('ai_information', tripData.ai);
        }
        
        const titleEl = document.getElementById('trip_title');
        if (titleEl) titleEl.innerText = tripData.n;

        // 3. LocalStorage Güncelle
        localStorage.setItem('cart', JSON.stringify(window.cart));

        // 4. UI'ı Hazırla
        if (document.getElementById('tt-welcome')) document.getElementById('tt-welcome').style.display = 'none';
        const overlay = document.getElementById('sidebar-overlay-trip');
        if (overlay) overlay.classList.add('open');

        // 5. Sistemi Ateşle (mainscript'teki listeleme fonksiyonu)
        setTimeout(() => {
            if (typeof updateCart === 'function') updateCart();
            // Haritayı yenile (sidebar açıldığı için kayma yapmasın)
            if (window.map) window.map.invalidateSize();
        }, 800);

    } catch (e) {
        console.error("Critical Load Error:", e);
    }
});

// --- 4. Sosyal Medya Paylaşım Fonksiyonları ---
function shareOnWhatsApp() {
    // 1. Paylaşılacak linki oluştur (Mevcut fonksiyonunu kullanır)
    const tripLink = createShortTripLink(); 
    const text = encodeURIComponent("Check out my trip plan on Triptime! 🌍\n" + tripLink);

    // 2. Cihaz tespiti (Mobil mi Masaüstü mü?)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // 3. Linki belirle
    // Mobil ise 'api.whatsapp', masaüstü ise 'web.whatsapp'
    const baseUrl = isMobile 
        ? "https://api.whatsapp.com/send" 
        : "https://web.whatsapp.com/send";

    const finalUrl = `${baseUrl}?text=${text}`;

    // 4. Yeni sekmede aç
    window.open(finalUrl, '_blank');
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