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
    const msgEl = document.getElementById('loading-message');
    const chatBox = document.getElementById("chat-box");
    
    if (!panel) return;
    
    panel.style.display = "flex"; 
    document.querySelectorAll('.cw').forEach(cw => cw.style.display = "none");

    if (chatBox && chatBox.classList.contains("awaiting-start")) {
        chatBox.classList.remove("awaiting-start");
    }

    // --- EKLEME: Typing Indicator'ı başlat ---
    if (typeof showTypingIndicator === "function") {
        showTypingIndicator();
    }

    document.body.classList.add('app-locked'); 
    if (document.activeElement) document.activeElement.blur(); 
    
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

window.hideLoadingPanel = function() {
    const panel = document.getElementById("loading-panel");
    if (panel) {
        panel.style.display = "none";
    }

    // --- EKLEME: Typing Indicator'ı gizle ---
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