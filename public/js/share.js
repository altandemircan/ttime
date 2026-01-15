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

    shareText += "This plan was created with triptime.ai! Create your own trip plan and share it with your friends!"; 
    
    return shareText;
}

// WhatsApp share
async function shareOnWhatsApp() {
    const textToShare = generateShareableText();
    const includePdfCheck = document.getElementById('includePdfCheck');

    // Eğer PDF seçiliyse ve tarayıcı destekliyorsa
    if (includePdfCheck && includePdfCheck.checked && navigator.canShare) {
        try {
            // Mevcut PDF oluşturma fonksiyonunu çağırıyoruz
            const doc = downloadTripPlanPDF(); 
            const pdfBlob = doc.output('blob');
            const pdfFile = new File([pdfBlob], "TripPlan.pdf", { type: "application/pdf" });

            if (navigator.canShare({ files: [pdfFile] })) {
                await navigator.share({
                    files: [pdfFile],
                    text: textToShare,
                    title: 'Trip Plan'
                });
                return; 
            }
        } catch (err) { console.error("PDF share failed:", err); }
    }

    // PDF seçili değilse veya hata olursa eski metin yöntemi
    const encodedText = encodeURIComponent(textToShare);
    const whatsappUrl = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) 
        ? `whatsapp://send?text=${encodedText}` 
        : `https://web.whatsapp.com/send?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
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