// Gezi planını base64 linkine çevir
async function createShortTripLink() {
    const tripData = {
        cart: window.cart,
        customDayNames: window.customDayNames || {},
        tripDates: window.tripDates || {},
        version: "1.0"
    };
    
    const jsonStr = JSON.stringify(tripData);
    const base64 = btoa(encodeURIComponent(jsonStr));
    
    // Backend'de kısa URL oluştur (örnek)
    try {
        const response = await fetch('https://api.triptime.ai/shorten', {
            method: 'POST',
            body: JSON.stringify({ data: base64 }),
            headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();
        return result.shortUrl; // "triptime.ai/t/abc123"
    } catch(e) {
        // Fallback: normal uzun link
        return `${window.location.origin}/?shared=${base64}`;
    }
}


// --- Paylaşım Metni Oluşturucu ---
// --- Paylaşım Metni Oluşturucu ---
function generateShareableText() {
    // Base64 link oluştur
    const tripData = {
        cart: window.cart,
        customDayNames: window.customDayNames || {},
        tripDates: window.tripDates || {},
        version: "1.0"
    };
    
    const jsonStr = JSON.stringify(tripData);
    const base64 = btoa(encodeURIComponent(jsonStr));
    const shareLink = `${window.location.origin}/?sharedTrip=${base64}`;
    
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

     const shortLink = createShortTripLink();
    shareText += `\n\nView full plan: ${shortLink}`;
    
    return shareText;
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
