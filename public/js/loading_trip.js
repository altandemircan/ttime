/* ======================================================
   TRIP LOADING & CHAT STATE MANAGEMENT (Mobile Fix)
====================================================== */

// 1. Gerekli kilit stillerini sayfaya enjekte et (MOBİL İÇİN GÜÇLENDİRİLDİ)
(function injectLockStyles() {
    if (!document.getElementById('lock-style-injection')) {
        const style = document.createElement('style');
        style.id = 'lock-style-injection';
        style.innerHTML = `
            /* Mobilde kaydırmayı ve dokunmayı kesin engellemek için */
            body.app-locked {
                overflow: hidden !important; /* Scroll bar'ı gizle */
                touch-action: none !important; /* Mobilde parmak kaydırmayı kapat */
                -webkit-overflow-scrolling: none !important; /* iOS scroll fix */
                overscroll-behavior: none !important; /* Lastik bant efektini kapat */
                user-select: none !important;
            }

            /* Tüm ekranı kaplayan görünmez bir kalkan oluştur (Tıklamaları yutar) */
            body.app-locked::before {
                content: "";
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                width: 100%; height: 100%;
                background: rgba(255, 255, 255, 0); /* Tam şeffaf */
                z-index: 99999; /* Çok yüksek katman */
                pointer-events: auto !important; /* Dokunuşları yakala */
                cursor: wait;
            }

            /* Yükleme paneli kalkanın üstünde kalsın (Görünürlük için) */
            body.app-locked .loading-panel {
                position: relative; 
                z-index: 100000 !important; /* Kalkandan daha yüksek */
                pointer-events: auto !important;
            }
        `; 
        document.head.appendChild(style);
    }
})();

window.showLoadingPanel = function() {
    const chatBox = document.getElementById("chat-box");
    
    // ➤ EKRANI KİLİTLE (Mobilde de çalışır)
    document.body.classList.add('app-locked');

    // Varsa eskisini temizle
    const existingPanel = document.getElementById("loading-panel");
    if (existingPanel) existingPanel.remove();

    // 1. Paneli oluştur
    const panel = document.createElement("div");
    panel.id = "loading-panel"; 
    panel.className = "loading-panel"; 
    
    // İçerik
    panel.innerHTML = `
        <img src="/img/travel-destination.gif" alt="Loading..." style="width: 72px; height: 72px;">
        <div class="loading-text">
            <h2 id="loading-message">Analyzing your request...</h2>
            <p>Mira is preparing your trip plan, please wait!</p>
        </div>
    `;

    // 2. Paneli Yerleştir (Sıralama Önceliği: Sonuç > Typing > En Son)
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

        // Panele odaklan
        panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // 3. Animasyon Döngüsü
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
    // ➤ EKRAN KİLİDİNİ AÇ
    document.body.classList.remove('app-locked');

    // Paneli kaldır
    const panel = document.getElementById("loading-panel");
    if (panel) {
        panel.remove();
    }

    if (window.loadingInterval) {
        clearInterval(window.loadingInterval);
        window.loadingInterval = null;
    }
};

/* Diğer fonksiyonlar aynen kalabilir */
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

function addWelcomeMessage() {
    if (!window.__welcomeShown) {
        addMessage("Let's get started.", "bot-message request-bot-message");
        window.__welcomeShown = true;
    }
}
    
function addMessage(text, className) {
    const chatBox = document.getElementById("chat-box");
    const messageElement = document.createElement("div");
    messageElement.className = "message " + className;

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

    const typingIndicator = document.getElementById("typing-indicator");
    if (typingIndicator) {
        chatBox.insertBefore(messageElement, typingIndicator);
    } else {
        chatBox.appendChild(messageElement);
    }
    
   chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
}