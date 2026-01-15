// --- Helper: Generate PDF as a File object ---
async function getTripPDFFile() {
    if (typeof window.jspdf === "undefined") return null;

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Basic PDF content (You can expand this to match your pdf_download.js style)
        doc.setFontSize(18);
        doc.text("My Trip Plan", 10, 20);
        
        let y = 30;
        window.cart.forEach((item, index) => {
            if (item.name) {
                doc.setFontSize(12);
                doc.text(`${index + 1}. ${item.name} (${item.category})`, 10, y);
                y += 10;
                if (y > 280) { doc.addPage(); y = 20; }
            }
        });

        const pdfBlob = doc.output('blob');
        return new File([pdfBlob], "TripPlan.pdf", { type: 'application/pdf' });
    } catch (e) {
        console.error("PDF generation failed:", e);
        return null;
    }
}

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
    
    // Check if the "Include PDF" checkbox is checked
    const includePdfCheck = document.getElementById('includePdfCheck');
    const shouldIncludePdf = includePdfCheck && includePdfCheck.checked;

    if (shouldIncludePdf && navigator.canShare) {
        const pdfFile = await getTripPDFFile();
        if (pdfFile && navigator.canShare({ files: [pdfFile] })) {
            try {
                await navigator.share({
                    files: [pdfFile],
                    title: 'My Trip Plan',
                    text: textToShare
                });
                return; // Successfully shared via Web Share API
            } catch (err) {
                if (err.name !== 'AbortError') console.error("PDF Share failed:", err);
            }
        }
    }

    // Fallback to original URL-based text share (if checkbox is off or browser doesn't support file sharing)
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