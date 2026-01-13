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

window.showLoadingPanel = function() {
    const panel = document.getElementById("loading-panel");
    const msgEl = document.getElementById('loading-message'); // Bu satırın varlığından emin olun
    const chatBox = document.getElementById("chat-box");
    
    if (!panel) return;
    
    // A. Loading Panelini Görünür Yap
    panel.style.display = "flex"; 
    
    // B. Alttaki İçeriği (cw) Gizle
    document.querySelectorAll('.cw').forEach(cw => cw.style.display = "none");

    // C. Chat Kutusunu Hazırla
    if (chatBox) {
        chatBox.classList.remove("awaiting-start");
    }

    // D. [ÖNEMLİ] Üç Nokta Animasyonunu Göster
    if (typeof showTypingIndicator === "function") {
        showTypingIndicator();
    }

    // E. Sayfayı Kilitle
    document.body.classList.add('app-locked'); 
    if (document.activeElement) document.activeElement.blur(); 
    
    // F. Mesaj Animasyonlarını Başlat
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
        const currentMsgEl = document.getElementById('loading-message'); // İçeride tekrar kontrol
        if (!currentMsgEl || panel.style.display === 'none') return;
        if (isTransitioning) return;
        
        isTransitioning = true;
        currentMsgEl.style.transition = "opacity 0.5s ease";
        currentMsgEl.style.opacity = 0;

        setTimeout(() => {
            current = (current + 1) % messages.length;
            if(currentMsgEl) {
                currentMsgEl.textContent = messages[current];
                currentMsgEl.style.opacity = 1;
            }
            setTimeout(() => { isTransitioning = false; }, 500); 
        }, 500); 
    }, 3000); 
};

window.hideLoadingPanel = function() {
    const panel = document.getElementById("loading-panel");
    if (panel) panel.style.display = "none";

    // --- BURASI KRİTİK: Üç noktayı gizle ---
    if (typeof hideTypingIndicator === "function") {
        hideTypingIndicator();
    }

    document.body.classList.remove('app-locked');

    if (window.loadingInterval) {
        clearInterval(window.loadingInterval);
        window.loadingInterval = null;
    }

    document.body.classList.remove('app-locked');

    if (!window.__welcomeHiddenForever) {
        document.querySelectorAll('.cw').forEach(cw => cw.style.display = "grid");
    } else {
        document.querySelectorAll('.cw').forEach(cw => cw.style.display = "none");
    }
};