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
    
    // 1. Karşılama Ekranını (cw) Gizle ve Chat'in Görünür Olduğundan Emin Ol
    document.querySelectorAll('.cw').forEach(cw => cw.style.display = "none");
    if (chatBox) {
        chatBox.classList.remove("awaiting-start");
    }

    // 2. Mükerrer olmaması için varsa eski loader'ı temizle
    const existingLoader = document.getElementById("chat-embedded-loader");
    if (existingLoader) existingLoader.remove();

    // 3. Yükleme Mesaj Baloncuğunu Oluştur (Dinamik HTML)
    const loaderDiv = document.createElement("div");
    loaderDiv.id = "chat-embedded-loader"; // Daha sonra silmek için ID veriyoruz
    loaderDiv.className = "message bot-message loading-message-container";
    
    // HTML yapısı (Sizin orijinal gif ve metin yapınıza sadık kalarak)
    loaderDiv.innerHTML = `
        <div class="profile-img"><img src="/img/avatar_aiio.png" alt="AI"></div>
        <div class="chat-loader-content">
            <img src="/img/travel-destination.gif" alt="Loading...">
            <div class="loading-text-wrapper">
                <h2 id="chat-loading-message">Analyzing your request...</h2>
                <p>Mira is preparing your trip plan...</p>
            </div>
        </div>
    `;

    // 4. Sohbet Kutusuna Ekle (Typing Indicator varsa onun önüne)
    const typingIndicator = document.getElementById("typing-indicator");
    if (typingIndicator) {
        chatBox.insertBefore(loaderDiv, typingIndicator);
    } else {
        chatBox.appendChild(loaderDiv);
    }

    // En aşağıya kaydır
    chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });

    // 5. Metin Animasyonunu Başlat (Sırayla değişen mesajlar)
    if (window.loadingInterval) clearInterval(window.loadingInterval);

    const messages = [
        "Analyzing your request...",
        "Finding the best spots...",
        "Exploring route options...",
        "Compiling your travel plan..."
    ];
    let current = 0;
    
    window.loadingInterval = setInterval(() => {
        const msgEl = document.getElementById('chat-loading-message');
        if (!msgEl) return; // Element silindiyse dur

        msgEl.style.opacity = 0.5; // Hafif sönükleşme efekti
        
        setTimeout(() => {
            current = (current + 1) % messages.length;
            if (msgEl) {
                msgEl.textContent = messages[current];
                msgEl.style.opacity = 1;
            }
        }, 300);
    }, 2500);
};

window.hideLoadingPanel = function() {
    // 1. Chat içindeki loader elementini bul
    const loader = document.getElementById("chat-embedded-loader");
    if (loader) {
        // Silmeden önce hafifçe yok olma efekti (opsiyonel)
        loader.style.opacity = '0';
        loader.style.transition = 'opacity 0.5s ease';
        setTimeout(() => {
            if(loader.parentNode) loader.parentNode.removeChild(loader);
        }, 500);
    }

    // 2. Zamanlayıcıyı Temizle
    if (window.loadingInterval) {
        clearInterval(window.loadingInterval);
        window.loadingInterval = null;
    }

    // 3. Body kilidini kaldır (Eğer kilit kaldıysa)
    document.body.classList.remove('app-locked');
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
