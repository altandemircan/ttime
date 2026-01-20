/* ======================================================
   TRIP LOADING & CHAT STATE MANAGEMENT (Mobile Fixed)
====================================================== */

// 1. KİLİT MEKANİZMASI (MOBİL UYUMLU GÖRÜNMEZ KALKAN)
(function injectLockStyles() {
    if (!document.getElementById('lock-style-injection')) {
        const style = document.createElement('style');
        style.id = 'lock-style-injection';
        style.innerHTML = `
            /* Kilit aktifken body özellikleri */
            body.app-locked {
                overflow: hidden !important;       /* Scroll barı yok et */
                height: 100vh !important;          /* Sayfa boyunu sabitle */
                touch-action: none !important;     /* Mobilde parmak hareketini engelle */
                -ms-touch-action: none !important;
            }

            /* GÖRÜNMEZ KALKAN: Tüm ekranın önüne geçen şeffaf duvar */
            body.app-locked::after {
                content: "";
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(255, 255, 255, 0); /* Tam şeffaf */
                z-index: 2147483647; /* En, en üst katman */
                cursor: wait;
                touch-action: none; /* Kalkana dokunulunca da işlem yapma */
            }
        `; 
        document.head.appendChild(style);
    }
})();

window.showLoadingPanel = function() {
    const chatBox = document.getElementById("chat-box");
    
    // 1. EKRANI KİLİTLE (Görünmez kalkanı devreye sok)
    document.body.classList.add('app-locked');

    // 2. Varsa eski paneli temizle
    const existingPanel = document.getElementById("loading-panel");
    if (existingPanel) existingPanel.remove();

    // 3. Paneli Oluştur
    const panel = document.createElement("div");
    panel.id = "loading-panel"; 
    panel.className = "loading-panel"; 
    
    // İçerik (GIF ve Yazı)
    panel.innerHTML = `
        <img src="/img/travel-destination.gif" alt="Loading..." style="width: 72px; height: 72px;">
        <div class="loading-text">
            <h2 id="loading-message">Analyzing your request...</h2>
            <p>Mira is preparing your trip plan, please wait!</p>
        </div>
    `;

    // 4. Paneli Yerleştir (Sıralama Önceliği: Sonuç > Typing > En Son)
    if (chatBox) {
        const targetResult = chatBox.querySelector(".survey-results"); 
        const typingIndicator = document.getElementById("typing-indicator"); 

        if (targetResult) {
            chatBox.insertBefore(panel, targetResult);
        } else if (typingIndicator) {
            chatBox.insertBefore(panel, typingIndicator);
        } else {
            chatBox.appendChild(panel);
        }

        // Panele odaklan (Kilitlenmeden hemen önce görünür olsun)
        panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // 5. Animasyon Döngüsü
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
    // 1. KİLİDİ KALDIR (Kalkanı yok et)
    document.body.classList.remove('app-locked');

    // 2. Paneli sil
    const panel = document.getElementById("loading-panel");
    if (panel) {
        panel.remove();
    }

    // 3. Animasyonu durdur
    if (window.loadingInterval) {
        clearInterval(window.loadingInterval);
        window.loadingInterval = null;
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
  
  const typingIndicator = chatBox.querySelector('#typing-indicator');
  if (typingIndicator && typingIndicator.nextSibling) {
    chatBox.insertBefore(msg, typingIndicator.nextSibling);
  } else {
    chatBox.appendChild(msg);
  }
}

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
