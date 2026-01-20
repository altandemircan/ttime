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
    const chatBox = document.getElementById("chat-box");
    
    // ➤ [EKLENDİ] EKRANI KİLİTLE (Tıklamayı engelle)
    document.body.classList.add('app-locked');

    // Varsa eskisini temizle (çakışma olmasın)
    const existingPanel = document.getElementById("loading-panel");
    if (existingPanel) existingPanel.remove();

    // 1. Paneli JS ile oluştur (HTML'dekiyle BİREBİR aynı yapıda)
    const panel = document.createElement("div");
    panel.id = "loading-panel"; // ID aynı kalsın ki eski CSS stillerini alsın
    panel.className = "loading-panel"; 
    
    // İçeriği aynen koruyoruz (GIF ve Yazı)
    panel.innerHTML = `
        <img src="/img/travel-destination.gif" alt="Loading..." style="width: 72px; height: 72px;">
        <div class="loading-text">
            <h2 id="loading-message">Analyzing your request...</h2>
            <p>Mira is preparing your trip plan, please wait!</p>
        </div>
    `;

    // 2. Paneli Chat Kutusuna Doğru Konumda Yerleştir
    if (chatBox) {
        // Hedef elementleri kontrol et
        const targetResult = chatBox.querySelector(".survey-results"); // Öncelik 1: Sonuç kartı
        const typingIndicator = document.getElementById("typing-indicator"); // Öncelik 2: Üç nokta animasyonu

        if (targetResult) {
            // Eğer ekranda sonuç kartı varsa, loading onun HİZASINA (üstüne) gelsin
            chatBox.insertBefore(panel, targetResult);
        } else if (typingIndicator) {
            // Sonuç yoksa ama yazıyor animasyonu varsa, onun üstüne gelsin
            chatBox.insertBefore(panel, typingIndicator);
        } else {
            // Hiçbiri yoksa normal şekilde en sona ekle
            chatBox.appendChild(panel);
        }

        // Kullanıcının görebilmesi için panele odaklan
        panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // 3. Yazı Değişme Animasyonu (Mevcut mantık)
    if (window.loadingInterval) clearInterval(window.loadingInterval);

    const messages = [
        "Analyzing your request...",
        "Finding places...",
        "Exploring route options...",
        "Compiling your travel plan..."
    ];
    let current = 0;
    
    window.loadingInterval = setInterval(() => {
        const msgEl = document.getElementById('loading-message');
        if (!msgEl) return; 

        msgEl.style.opacity = 0.5;
        setTimeout(() => {
            current = (current + 1) % messages.length;
            if (msgEl) {
                msgEl.textContent = messages[current];
                msgEl.style.opacity = 1;
            }
        }, 300);
    }, 3000);
};

window.hideLoadingPanel = function() {
    // ➤ [EKLENDİ] EKRAN KİLİDİNİ AÇ (Tıklamaya izin ver)
    document.body.classList.remove('app-locked');

    // Chat içindeki paneli bul ve sil
    const panel = document.getElementById("loading-panel");
    if (panel) {
        panel.remove();
    }

    if (window.loadingInterval) {
        clearInterval(window.loadingInterval);
        window.loadingInterval = null;
    }
    
    // Eğer cw (welcome screen) gizliyse geri açma mantığı gerekiyorsa buraya eklenebilir,
    // ama chat akışında olduğumuz için genelde dokunmaya gerek yoktur.
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