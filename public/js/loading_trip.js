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
    const chatBox = document.getElementById("chat-box");
    // Hata veren msgEl burada tanımlanıyor:
    const msgEl = document.getElementById('loading-message');
    
    if (!panel) return;

    // A. Loading Panelini Görünür Yap
    panel.style.display = "flex"; 
    
    // B. Alttaki İçeriği (cw) Gizle ve Kilitle
    document.querySelectorAll('.cw').forEach(cw => cw.style.display = "none");
    if (chatBox) {
        chatBox.classList.remove("awaiting-start");
    }
    document.body.classList.add('app-locked'); 
    if (document.activeElement) document.activeElement.blur(); 

    // C. [KRİTİK] Üç Nokta Animasyonunu (Typing Indicator) Tetikle
    // Bu fonksiyon mainscript.js içinde indikatörü en sona taşımalıdır.
    if (typeof showTypingIndicator === "function") {
        showTypingIndicator();
    }
    
    // D. Sayfa Üstü Loading Mesaj Animasyonlarını Başlat
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
        // Fonksiyon içinde DOM referansını tazeleyelim (hata almamak için)
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

window.showTypingIndicator = function() {
    const chatBox = document.getElementById("chat-box");
    let indicator = document.getElementById("typing-indicator");
    
    if (!indicator) {
        indicator = document.createElement("div");
        indicator.id = "typing-indicator";
        indicator.className = "typing-indicator";
        indicator.innerHTML = '<span></span><span></span><span></span>';
        if (chatBox) chatBox.appendChild(indicator);
    } else if (chatBox) {
        chatBox.appendChild(indicator); 
    }
    
    if (indicator) indicator.style.display = "block";
    if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
};

window.hideTypingIndicator = function() {
    const typingIndicator = document.getElementById("typing-indicator");
    if (typingIndicator) typingIndicator.style.display = "none";
};

function addCanonicalMessage(canonicalStr) {
  const chatBox = document.getElementById("chat-box");
  if (!chatBox) return;
  const msg = document.createElement("div");
  msg.className = "message canonical-message";
  msg.innerHTML = `<img src="/img/profile-icon.svg" alt="Profile" class="profile-img">
  <span>${canonicalStr}</span>`;
  // Typing-indicator varsa hemen sonrasına ekle, yoksa direk ekle
  const typingIndicator = chatBox.querySelector('#typing-indicator');
  if (typingIndicator && typingIndicator.nextSibling) {
    chatBox.insertBefore(msg, typingIndicator.nextSibling);
  } else {
    chatBox.appendChild(msg);
  }
}

// Helper fonksiyonu güncelliyoruz
function addWelcomeMessage() {
    if (!window.__welcomeShown) {
        // BURASI DEĞİŞTİ:
        addMessage("Let's get started.", "bot-message request-bot-message");
        window.__welcomeShown = true;
    }
}

    
function addMessage(text, className) {
    const chatBox = document.getElementById("chat-box");
    const messageElement = document.createElement("div");
    messageElement.className = "message " + className;

    // Profil görseli mantığı
    let profileElem;
    if (className.includes("user-message")) {
        profileElem = document.createElement("div");
        profileElem.className = "profile-img"; 
        profileElem.textContent = "🧑";
    } else {
        profileElem = document.createElement("img");
        profileElem.src = "img/avatar_aiio.png";
        profileElem.className = "profile-img";
    }

    messageElement.appendChild(profileElem);
    const contentDiv = document.createElement("div");
    contentDiv.innerHTML = text;
    messageElement.appendChild(contentDiv);

    // --- KRİTİK DEĞİŞİKLİK: İndikatörü her zaman mesajın altına taşı ---
    const typingIndicator = document.getElementById("typing-indicator");
    if (typingIndicator) {
        // Mesajı indikatörün önüne ekle
        chatBox.insertBefore(messageElement, typingIndicator);
    } else {
        chatBox.appendChild(messageElement);
    }
    
   chatBox.scrollTo({
    top: chatBox.scrollHeight,
    behavior: 'smooth'
});
}
