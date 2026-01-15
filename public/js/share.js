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
function createShortTripLink() {
    // ÇOK BASİT ve GÜVENLİ
    const simpleData = {
        c: window.cart.map(item => ({
            n: item.name || '',
            t: item.category || '',
            d: item.day || 1,
            i: item.image || ''
        }))
    };
    
    const jsonStr = JSON.stringify(simpleData);
    const base64 = btoa(jsonStr);
    
    // URL-safe
    return `${window.location.origin}/?share=${base64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')}`;
}

// mainscript.js'de loadSharedTripOnStart'ı GÜNCELLE:
(function loadSharedTripOnStart() {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedTrip = urlParams.get('t');
    
    if (sharedTrip) {
        try {
            // BASE64 YOK - direkt decode
            const jsonStr = decodeURIComponent(sharedTrip);
            console.log("Gelen JSON:", jsonStr);
            
            const tripData = JSON.parse(jsonStr);
            
            // Basit veriyi çevir
            const fullTripData = {
                cart: (tripData.places || []).map((item, index) => ({
                    name: item[0] || `Place ${index + 1}`,
                    category: item[1] || 'Unknown',
                    day: item[2] || 1,
                    address: '',
                    image: `https://images.pexels.com/photos/3462098/pexels-photo-3462098.jpeg?auto=compress&cs=tinysrgb&h=350`
                })),
                customDayNames: {},
                tripDates: {}
            };
            
            // TASARIMI GÖSTER
            if (typeof showSharedTripDesign === 'function') {
                showSharedTripDesign(fullTripData);
            }
        } catch(e) {
            console.error("Basit JSON hatası:", e);
            // Ana sayfaya yönlendir
            window.location.href = window.location.origin;
        }
    }
})();

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