
// --- Paylaşım Metni Oluşturucu ---
function generateShareableText() {
    let shareText = "Here's your trip plan!\n\n";
    const maxDay = Math.max(0, ...window.cart.map(item => item.day || 0));
    const dateOptions = { day: 'numeric', month: 'long' };

    for (let day = 1; day <= maxDay; day++) {
        const dayItems = window.cart.filter(item => item.day == day && item.name);
        if (dayItems.length > 0) {
            if (typeof window.customDayNames === 'undefined') window.customDayNames = {};
            const dayName = window.customDayNames[day] || `Day ${day}`;
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
                shareText += `• ${item.name} (${item.category})\n`;
            });
            shareText += "\n";
        }
    }

    // KISA LINK OLUŞTUR
    const shortLink = createShortTripLink();
    shareText += `\n\nView full plan: ${shortLink}`;
    shareText += "\n\nThis plan was created with triptime.ai! Create your own trip plan and share it with your friends!"; 
    
    return shareText;
}

// KISA LINK OLUŞTUR (TEK BIR FONKSIYON)
function createShortTripLink() {
    // Sadeleştirilmiş veri
    const minimalData = {
        i: window.cart.map(item => ({
            n: item.name,        // name
            c: item.category,    // category
            d: item.day,         // day
            la: item.lat,        // lat
            lo: item.lon         // lon
        })),
        dn: window.customDayNames || {},
        td: window.tripDates || {}
    };
    
    const jsonStr = JSON.stringify(minimalData);
    const base64 = btoa(encodeURIComponent(jsonStr));
    
    // Parametreyi kısalt
    return `${window.location.origin}/?t=${base64}`;
}

// WhatsApp share
function shareOnWhatsApp() {
    const textToShare = generateShareableText();
    const encodedText = encodeURIComponent(textToShare);
    const whatsappAppUrl = `whatsapp://send?text=${encodedText}`;
    const whatsappWebUrl = `https://web.whatsapp.com/send?text=${encodedText}`;
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        window.open(whatsappAppUrl, '_blank');
    } else {
        window.open(whatsappWebUrl, '_blank');
    }
}

// Instagram - Copy to clipboard
function shareOnInstagram() {
    const textToShare = generateShareableText();
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(textToShare).then(() => {
            alert("Trip plan copied to clipboard! Now go to Instagram and paste it into your post description.");
        }, () => {
            alert("Automatic copy failed.");
        });
    } else {
        const textArea = document.createElement("textarea");
        textArea.value = textToShare;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            alert("Trip plan copied to clipboard! Now go to Instagram and paste it into your post description.");
        } catch (err) {
            alert("Copy failed.");
        }
        document.body.removeChild(textArea);
    }
}

// Facebook share
function shareOnFacebook() {
    const textToShare = generateShareableText();
    const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://triptime.ai')}&quote=${encodeURIComponent(textToShare)}`;
    window.open(facebookShareUrl, '_blank');
}

// Twitter share
function shareOnTwitter() {
    const textToShare = generateShareableText();
    const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(textToShare)}&url=${encodeURIComponent('https://triptime.ai')}`;
    window.open(twitterShareUrl, '_blank');
}


// Tüm platformlarda, tüm Türkçe/emoji ve json kombinasyonlarında patlamaz:
function safeBase64Decode(b64str) {
    try {
        // 1. encodeURIComponent ile encode edilmişse burada açılır (çoğu eski tasarımlar bunu kullanır)
        let decoded = atob(b64str);
        // Eğer decodeJSON gibi görünüyorsa (%7B ile başlıyorsa), decodeURIComponent uygula
        if (decoded.startsWith('%')) {
            decoded = decodeURIComponent(decoded);
        } else {
            // Yoksa, bytes'ı UTF-8'e çevirerek normalleştir (çünkü atob tek başına UTF-8 çözemez!)
            try {
                // Modern browserlarda TextDecoder çok hızlı/failsafe
                decoded = new TextDecoder("utf-8").decode(Uint8Array.from(atob(b64str), c => c.charCodeAt(0)));
            } catch (e) {
                // Eski tarayıcılar için fallback
                decoded = decodeURIComponent(escape(atob(b64str)));
            }
        }
        return decoded;
    } catch (err) {
        return null;
    }
}
// KISA LINK OLUŞTUR (GÜNCELLENMİŞ VERSİYON)
function createShortTripLink() {
    const minimalData = {
        i: window.cart.map(item => ({
            n: item.name,
            c: item.category,
            d: item.day,
            la: item.location ? Number(item.location.lat).toFixed(4) : (item.lat ? Number(item.lat).toFixed(4) : 0),
            lo: item.location ? Number(item.location.lng).toFixed(4) : (item.lon ? Number(item.lon).toFixed(4) : 0)
        })),
        dn: window.customDayNames || {},
        td: window.tripDates || {}
    };
    
    // 1. JSON string'e çevir
    const jsonStr = JSON.stringify(minimalData);
    
    // 2. Türkçe karakterleri %XX formatına çevir (Unicode uyumu için)
    const uriEncoded = encodeURIComponent(jsonStr);
    
    // 3. Base64'e çevir
    let base64 = btoa(uriEncoded);
    
    // 4. URL-Safe hale getir (+ yerine -, / yerine _, = kaldır)
    // Bu adım, tarayıcının linki bozmasını engeller.
    base64 = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    return `${window.location.origin}/?t=${base64}`;
}