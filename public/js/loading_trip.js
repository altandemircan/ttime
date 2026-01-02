
/* ======================================================
   TRIP LOADING & APP LOCK MECHANISM (CSS IN JS)
====================================================== */

// 1. Önce gerekli CSS stilini JS ile oluşturup sayfaya enjekte edelim
(function injectLockStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
        body.app-locked {
            pointer-events: none !important;
            user-select: none !important;
            cursor: wait !important;
            overflow: hidden !important; /* Scroll'u da engelleyelim */
        }
        /* Loading paneli etkileşime açık kalsın */
        body.app-locked .loading-panel {
            pointer-events: auto !important;
        }
    `;
    document.head.appendChild(style);
})();

// 2. Loading Panel Açma Fonksiyonu
window.showLoadingPanel = function() {
    const panel = document.getElementById("loading-panel");
    const msgEl = document.getElementById('loading-message');
    
    if (!panel) return;
    
    // Paneli aç
    panel.style.display = "flex"; 
    
    // Alttaki içeriği (cw) gizle
    document.querySelectorAll('.cw').forEach(cw => cw.style.display = "none");

    // --- KİLİTLEME İŞLEMİ ---
    // CSS sınıfını ekle
    document.body.classList.add('app-locked'); 
    // Mobilde klavye açıksa kapat
    if (document.activeElement) document.activeElement.blur();
    // ------------------------
    
    // Mesaj Ayarları
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

    // Mesaj Döngüsü
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

// 3. Loading Panel Kapatma Fonksiyonu
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

    // --- KİLİDİ AÇMA İŞLEMİ ---
    document.body.classList.remove('app-locked');
    // --------------------------

    // İçeriği duruma göre geri getir
    if (!window.__welcomeHiddenForever) {
        document.querySelectorAll('.cw').forEach(cw => cw.style.display = "grid");
    } else {
        document.querySelectorAll('.cw').forEach(cw => cw.style.display = "none");
    }
};