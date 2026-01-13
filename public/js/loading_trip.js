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
    const msgEl = document.getElementById('loading-message'); // Değişkeni burada tanımlıyoruz
    const chatBox = document.getElementById("chat-box");
    
    if (!panel) return;
    
    // A. Paneli ve İndikatörü Göster
    panel.style.display = "flex"; 
    if (typeof showTypingIndicator === "function") {
        showTypingIndicator();
    }
    
    // B. Arka Planı Gizle ve Kilitle
    document.querySelectorAll('.cw').forEach(cw => cw.style.display = "none");
    if (chatBox) chatBox.classList.remove("awaiting-start");
    document.body.classList.add('app-locked'); 
    if (document.activeElement) document.activeElement.blur(); 
    
    // C. Loading Metinlerini Başlat
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
        // Fonksiyon içinde msgEl'i tekrar kontrol et
        const internalMsgEl = document.getElementById('loading-message');
        if (!internalMsgEl || panel.style.display === 'none') return;
        if (isTransitioning) return;
        
        isTransitioning = true;
        internalMsgEl.style.transition = "opacity 0.5s ease";
        internalMsgEl.style.opacity = 0;

        setTimeout(() => {
            current = (current + 1) % messages.length;
            if(internalMsgEl) {
                internalMsgEl.textContent = messages[current];
                internalMsgEl.style.opacity = 1;
            }
            setTimeout(() => { isTransitioning = false; }, 500); 
        }, 500); 
    }, 3000); 
};

window.hideLoadingPanel = function() {
    const panel = document.getElementById("loading-panel");
    if (panel) panel.style.display = "none";

    // İndikatörü gizle
    if (typeof hideTypingIndicator === "function") {
        hideTypingIndicator();
    }

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