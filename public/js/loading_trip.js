/* ======================================================
   TRIP LOADING & CHAT STATE MANAGEMENT
====================================================== */

// 1. Gerekli kilit stillerini sayfaya enjekte et (Tek seferlik)
(function injectLockStyles() {
    if (!document.getElementById('lock-style-injection')) {
        const style = document.createElement('style');
        style.id = 'lock-style-injection';
        style.innerHTML = `
            body.app-locked {
                pointer-events: none !important;
                user-select: none !important;
                cursor: wait !important;
                overflow: hidden !important;
            }
            body.app-locked .loading-panel {
                pointer-events: auto !important;
            }
        `; 
        document.head.appendChild(style);
    }
})();

// 2. Loading Panelini Açma (Sorgu Gönderildiğinde Tetiklenir)
window.showLoadingPanel = function() {
    const panel = document.getElementById("loading-panel");
    const msgEl = document.getElementById('loading-message');
    const chatBox = document.getElementById("chat-box");
    
    if (!panel) return;
    
    // A. Loading Panelini Görünür Yap
    panel.style.display = "flex"; 
    
    // B. Alttaki İçeriği (cw) Gizle
    document.querySelectorAll('.cw').forEach(cw => cw.style.display = "none");

    // C. [ÖNEMLİ] Chat Kutusunun "Gizli" Durumunu Kaldır
    // Bu satır sayesinde "Let's get started" mesajı, loading başladığı an görünür hale gelir.
    if (chatBox && chatBox.classList.contains("awaiting-start")) {
        chatBox.classList.remove("awaiting-start");
    }

    // D. Sayfayı Kilitle (Tıklamaları Engelle)
    document.body.classList.add('app-locked'); 
    if (document.activeElement) document.activeElement.blur(); // Klavyeyi kapat
    
    // E. Mesaj Animasyonlarını Başlat
    if (msgEl) {
        msgEl.textContent = "Analyzing your request...";
        msgEl.style.opacity = 1;
    }

    if (window.loadingInterval) clearInterval(window.loadingInterval);

    const messages = [
        "Analyzing your request",
        "Finding places",
        "Exploring route options",
        "Compiling your travel plan"
    ];
    let current = 0;
    let isTransitioning = false;

    window.loadingInterval = setInterval(() => {
        if (!msgEl || panel.style.display === 'none') return;
        if (isTransitioning) return;
        
        isTransitioning = true;
        msgEl.style.transition = "opacity 0.5s ease";
        msgEl.style.opacity = 0;

        setTimeout(() => {
            current = (current + 1) % messages.length;
            if(msgEl) {
                msgEl.textContent = messages[current];
                msgEl.style.opacity = 1;
            }
            setTimeout(() => { isTransitioning = false; }, 500); 
        }, 500); 
    }, 3000); 
};

// 3. Loading Panelini Kapatma
window.hideLoadingPanel = function() {
    const panel = document.getElementById("loading-panel");
    if (panel) {
        panel.style.display = "none";
    }

    // Animasyonu durdur
    if (window.loadingInterval) {
        clearInterval(window.loadingInterval);
        window.loadingInterval = null;
    }

    // KİLİDİ AÇ
    document.body.classList.remove('app-locked');

    // İçerik (cw) yönetimi
    // Eğer sonuçlar geldiyse (welcomeHiddenForever true) cw gizli kalır, chat görünür.
    // İptal edildiyse (welcomeHiddenForever false) cw geri gelir.
    if (!window.__welcomeHiddenForever) {
        document.querySelectorAll('.cw').forEach(cw => cw.style.display = "grid");
        
        // Eğer işlem iptal edildiyse ve chat hiç başlamadıysa tekrar gizle (Opsiyonel)
        // const chatBox = document.getElementById("chat-box");
        // if(chatBox && chatBox.innerHTML.trim() === "") chatBox.classList.add("awaiting-start");
    } else {
        document.querySelectorAll('.cw').forEach(cw => cw.style.display = "none");
    }
};