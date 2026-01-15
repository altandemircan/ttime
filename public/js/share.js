// --- Paylaşım Metni Oluşturucu ---
function generateShareableText() {
    let shareText = "Gezi Planım:\n\n";
    const maxDay = Math.max(0, ...window.cart.map(item => item.day || 0));

    for (let day = 1; day <= maxDay; day++) {
        const dayItems = window.cart.filter(item => item.day == day && item.name);
        if (dayItems.length > 0) {
            shareText += `--- Gün ${day} ---\n`;
            dayItems.forEach(item => {
                shareText += `• ${item.name} (${item.category})\n`;
            });
            shareText += "\n";
        }
    }

    const shortLink = createShortTripLink();
    shareText += `\nTam planı gör: ${shortLink}`;
    shareText += "\n\nTriptime.ai ile oluşturuldu!";
    
    return shareText;
}
function createShortTripLink() {
    const data = window.cart.map(item => [item.name, item.category, item.day]);
    const json = JSON.stringify(data);
    return window.location.origin + '/?trip=' + encodeURIComponent(json);
}
// mainscript.js'de loadSharedTripOnStart'ı GÜNCELLE:
(function loadSharedTripOnStart() {
    const urlParams = new URLSearchParams(window.location.search);
    const shareCode = urlParams.get('share');
    
    if (shareCode) {
        try {
            // DIRECT decode
            const jsonStr = decodeURIComponent(shareCode);
            const simpleData = JSON.parse(jsonStr);
            
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