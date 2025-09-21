function generateShareableText() {
    let shareText = "İşte gezi planın!\n\n";
    const maxDay = Math.max(0, ...window.cart.map(item => item.day || 0));

    // Tarih formatlama ayarları (gün ve ay adı)
    const dateOptions = { day: 'numeric', month: 'long' };

    for (let day = 1; day <= maxDay; day++) {
        const dayItems = window.cart.filter(item => item.day == day && item.name);
        if (dayItems.length > 0) {
            
            // --- GÜN BAŞLIĞI OLUŞTURMA BÖLÜMÜ GÜNCELLENDİ ---
            if (typeof window.customDayNames === 'undefined') {
                window.customDayNames = {};
            }
            const dayName = window.customDayNames[day] || `${day}. Gün`;
            
            let dayHeader;

            // Eğer başlangıç tarihi varsa, her gün için tarihi hesapla ve formatla
            // Artık window.tripDates.startDate kullanılmalı!
            const startDateValue = window.tripDates && window.tripDates.startDate ? window.tripDates.startDate : null;
            if (startDateValue) {
                const startDateObj = new Date(startDateValue);
                const currentDate = new Date(startDateObj.setDate(startDateObj.getDate() + (day - 1)));
                const formattedDate = currentDate.toLocaleDateString('tr-TR', dateOptions);
                dayHeader = `--- ${dayName} - ${formattedDate} ---\n`;
            } else {
                dayHeader = `--- ${dayName} ---\n`;
            }
            // --- GÜN BAŞLIĞI OLUŞTURMA SONU ---

            shareText += dayHeader; // Oluşturulan başlığı metne ekle

            dayItems.forEach(item => {
                shareText += `• ${item.name} (${item.category})\n`;
            });
            shareText += "\n";
        }
    }

    shareText += "Bu plan triptime.ai ile oluşturuldu! Sen de kendi gezi planını oluştur ve arkadaşlarınla paylaş!"; 
    
    return shareText;
}

// WhatsApp'ta paylaşım yapan yardımcı fonksiyon
function shareOnWhatsApp() {
    const textToShare = generateShareableText();
    const encodedText = encodeURIComponent(textToShare);

    // Mobil veya WhatsApp Desktop yüklü sistemler
    const whatsappAppUrl = `whatsapp://send?text=${encodedText}`;
    // WhatsApp Web için URL
    const whatsappWebUrl = `https://web.whatsapp.com/send?text=${encodedText}`;

    // Basit tespit: Eğer cihaz mobil değilse WhatsApp Web aç
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        window.open(whatsappAppUrl, '_blank');
    } else {
        window.open(whatsappWebUrl, '_blank');
    }
}

// Instagram için metni panoya kopyalayan yardımcı fonksiyon
function shareOnInstagram() {
    const textToShare = generateShareableText();
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(textToShare).then(() => {
            alert("Gezi planı metni panoya kopyalandı! Şimdi Instagram'a gidip gönderi açıklamasına yapıştırabilirsiniz.");
        }, () => {
            alert("Otomatik kopyalama başarısız oldu.");
        });
    } else {
        // Güvenli olmayan bağlantılar için yedek yöntem
        const textArea = document.createElement("textarea");
        textArea.value = textToShare;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            alert("Gezi planı metni panoya kopyalandı! Şimdi Instagram'a gidip gönderi açıklamasına yapıştırabilirsiniz.");
        } catch (err) {
            alert("Kopyalama başarısız oldu.");
        }
        document.body.removeChild(textArea);
    }
}