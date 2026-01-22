document.addEventListener("DOMContentLoaded", function() {
    
    // --- 1. AYARLAR VE DEĞİŞKENLER ---
    const STORAGE_KEY = 'triptime_ai_history_v1';
    const MAX_MESSAGES_PER_CHAT = 10; // Chat başına limit
    let currentChatId = null;
    let chatHistory = [];

    // --- DOM ELEMENTLERİNİ GÜVENLE SEÇ ---
    const sidebarLogin = document.getElementById('sidebar-login');
    const sidebarTitle = sidebarLogin ? sidebarLogin.querySelector('.sidebar_title') : null;
    // Form Container (Ana kapsayıcı)
    const formContainer = sidebarLogin ? sidebarLogin.querySelector('.form-container') : null;
    // Login Form (Sohbet kutusunu içeren div)
    const formContent = document.getElementById('login-form'); 
    
    const chatBox = document.getElementById('ai-chat-box');
    const messagesDiv = document.getElementById('ai-chat-messages');
    const chatInput = document.getElementById('ai-chat-input');
    const sendBtn = document.getElementById('ai-chat-send-btn');

    // Eğer temel elementler yoksa çalışma
    if (!sidebarLogin || !chatBox || !messagesDiv || !formContainer || !formContent) return;

    // --- 2. CSS STYLES ---
    const styleId = 'tt-ai-sidebar-styles';
if (!document.getElementById(styleId)) {
    const css = `
        /* Kontrol Butonları (Başlık Altı) */
        #ai-chat-controls {
            display: flex;
            gap: 8px;
            padding: 0 0 15px 0;
            margin-bottom: 10px;
            border-bottom: 1px solid #f0f0f0;
        }
        .ai-nav-btn {
            flex: 1;
            padding: 8px 12px;
            border: 1px solid #eee;
            background: #fff;
            border-radius: 12px;
            cursor: pointer;
            font-family: "Satoshi", sans-serif;
            font-size: 0.85rem;
            font-weight: 600;
            color: #555;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.03);
        }
        .ai-nav-btn:hover {
            background: #f4fbff;
            border-color: #12a5e8;  /* YENİ MAVİ */
            color: #12a5e8;         /* YENİ MAVİ */
        }
        .ai-nav-btn.active {
            background: linear-gradient(135deg, #12a5e8 0%, #67ccd1 100%);  /* YENİ GRADIENT */
            color: #fff;
            border-color: transparent;
            box-shadow: 0 4px 10px rgba(18, 165, 232, 0.25);  /* MAVİ GÖLGE */
        }

        /* Geçmiş Listesi Alanı */
        #ai-history-list {
            display: none;
            flex-direction: column;
            width: 100%;
            height: 100%;
            overflow-y: auto;
            padding-right: 4px;
            gap: 10px;
            order: 10;
            margin-top: 4px;
        }
        
        /* Geçmiş Kartı */
        .history-card {
            background: #f9f9f9;
            border: 1px solid #eee;
            border-radius: 10px;
            padding: 12px;
            cursor: pointer;
            position: relative;
            transition: all 0.2s ease;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.02);
            text-align: left;
            margin-top: 1px;
        }
        .history-card:hover {
            border-color: #12a5e8;  /* YENİ MAVİ */
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(18, 165, 232, 0.12); /* MAVİ GÖLGE */
        }
        .h-title {
            font-weight: 600;
            font-size: 0.9rem;
            color: #1e293b;
            margin-bottom: 4px;
            display: block;
            padding-right: 24px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .h-date {
            font-size: 0.75rem;
            color: #959595;
        }
        .h-delete {
            position: absolute;
            right: 8px;
            top: 8px;
            background: transparent;
            border: none;
            color: #ffd1d1;
            font-size: 16px;
            line-height: 1;
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            transition: all 0.2s;
        }
        .h-delete:hover {
            color: #ff4444;
            background: #fff5f5;
        }

        /* Gizleme Helper'ı */
        .view-hidden { display: none !important; }

        /* --- TYPING ANIMASYONU --- */
        .typing {
            display: inline-block;
            position: relative;
            color: transparent !important;
        }
        .typing::after {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            color: #12a5e8;  /* YENİ MAVİ */
            font-weight: bold;
            animation: typing-dots 1.5s infinite steps(4);
        }
        @keyframes typing-dots {
            0% { content: ''; }
            25% { content: '.'; }
            50% { content: '..'; }
            75% { content: '...'; }
        }
    `;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = css;
    document.head.appendChild(style);
}

    // --- 3. UI YERLEŞTİRME (Insert Logic) ---

    // A) Kontrol Butonları (New Chat / History)
    const controlsDiv = document.createElement('div');
    controlsDiv.id = 'ai-chat-controls';
    controlsDiv.innerHTML = `
        <button id="btn-ai-new" class="ai-nav-btn active">
            <span>✨ New Chat</span>
        </button>
        <button id="btn-ai-history" class="ai-nav-btn">
            <span>📂 History</span>
        </button>
    `;

    // Sidebar başlığından hemen sonraya ekle
    if (sidebarTitle && sidebarTitle.parentNode) {
        sidebarTitle.insertAdjacentElement('afterend', controlsDiv);
    }

    // B) Geçmiş Listesi Konteynerı
    const historyListDiv = document.createElement('div');
    historyListDiv.id = 'ai-history-list';
    formContainer.appendChild(historyListDiv);

    // --- 4. DATA & LOGIC ---

    function canAskQuestion() {
        const userMsgCount = chatHistory.filter(m => m.role === 'user').length;
        return userMsgCount < MAX_MESSAGES_PER_CHAT;
    }

    function getAllChats() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } 
        catch { return {}; }
    }

    function saveCurrentChat() {
        if (!chatHistory || chatHistory.length === 0) return;
        if (!currentChatId) currentChatId = 'chat_' + Date.now();

        const allChats = getAllChats();
        
        let title = "Conversation";
        const firstUserMsg = chatHistory.find(m => m.role === 'user');
        if (firstUserMsg) {
            title = firstUserMsg.content.slice(0, 35);
        }

        allChats[currentChatId] = {
            id: currentChatId,
            title: title,
            updatedAt: Date.now(),
            messages: chatHistory
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allChats));
    }

    // --- 5. GÖRÜNÜM GEÇİŞLERİ ---

    function showChatScreen() {
        formContent.classList.remove('view-hidden');
        formContent.style.display = 'block'; 
        
        historyListDiv.classList.add('view-hidden');
        historyListDiv.style.display = 'none';
        
        document.getElementById('btn-ai-new').classList.add('active');
        document.getElementById('btn-ai-history').classList.remove('active');
        
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function showHistoryScreen() {
        renderHistoryList();
        
        formContent.classList.add('view-hidden');
        formContent.style.display = 'none';

        historyListDiv.classList.remove('view-hidden');
        historyListDiv.style.display = 'flex';
        
        document.getElementById('btn-ai-new').classList.remove('active');
        document.getElementById('btn-ai-history').classList.add('active');
    }

    function startNewChat() {
        currentChatId = null;
        chatHistory = [];
        messagesDiv.innerHTML = '';
        
        const infoDiv = document.createElement("div");
        infoDiv.className = "chat-info";
        infoDiv.innerHTML = `<b>Mira AI:</b> Hello! Ask me anything about your trip plan. <span style='font-size:0.8rem;opacity:0.7'>(Limit: ${MAX_MESSAGES_PER_CHAT} messages per chat)</span>`;
        messagesDiv.appendChild(infoDiv);

        showChatScreen();
    }

    function loadChatFromHistory(id) {
        const allChats = getAllChats();
        const chat = allChats[id];
        if (!chat) return;

        currentChatId = chat.id;
        chatHistory = chat.messages || [];
        
        messagesDiv.innerHTML = ''; 

        chatHistory.forEach(msg => {
            const div = document.createElement('div');
            div.className = `chat-message ${msg.role === 'user' ? 'user-message' : 'ai-message'}`;
            
            const text = (typeof markdownToHtml === 'function' && msg.role === 'assistant')
                ? markdownToHtml(msg.content)
                : msg.content;

            if (msg.role === 'user') div.textContent = '🧑 ' + text;
            else {
                div.innerHTML = '<img src="/img/avatar_aiio.png"><div style="display:flex;flex-direction:column;flex:1;">' + text + '</div>';
            }
            messagesDiv.appendChild(div);
        });

        if (!canAskQuestion()) {
            const limitDiv = document.createElement('div');
            limitDiv.className = 'chat-message ai-message';
            limitDiv.style.background = "#fff3f3"; 
            limitDiv.style.color = "#d32f2f";
            limitDiv.style.fontSize = "0.85rem";
            limitDiv.style.border = "1px solid #ffcdd2";
            limitDiv.innerHTML = "<b>Note:</b> This chat has reached its message limit.";
            messagesDiv.appendChild(limitDiv);
        }

        showChatScreen();
    }

    function renderHistoryList() {
        historyListDiv.innerHTML = '';
        const allChats = getAllChats();
        const sorted = Object.values(allChats).sort((a, b) => b.updatedAt - a.updatedAt);

        if (sorted.length === 0) {
            historyListDiv.innerHTML = '<div style="text-align:center;color:#959595;margin-top:40px;font-size:0.9rem;">No chat history found.<br>Start a new chat!</div>';
            return;
        }

        sorted.forEach(chat => {
            const card = document.createElement('div');
            card.className = 'history-card';
            
            const d = new Date(chat.updatedAt);
            const dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

            card.innerHTML = `
                <span class="h-title">${chat.title}</span>
                <span class="h-date">${dateStr}</span>
                <button class="h-delete" title="Delete">✕</button>
            `;

            card.addEventListener('click', (e) => {
                if (e.target.classList.contains('h-delete')) return;
                loadChatFromHistory(chat.id);
            });

            card.querySelector('.h-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Delete this conversation?')) {
                    const db = getAllChats();
                    delete db[chat.id];
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
                    
                    if (currentChatId === chat.id) {
                        startNewChat();
                    } else {
                        renderHistoryList();
                    }
                }
            });

            historyListDiv.appendChild(card);
        });
    }

    // --- 6. EVENT LISTENERS ---

    document.getElementById('btn-ai-new').addEventListener('click', startNewChat);
    document.getElementById('btn-ai-history').addEventListener('click', showHistoryScreen);

    // --- 7. MESAJ GÖNDERME ---
// --- 7. MESAJ GÖNDERME ---
async function sendAIChatMessage(userMessage) {
    if (!canAskQuestion()) {
        const limitDiv = document.createElement('div');
        limitDiv.className = 'chat-message ai-message';
        limitDiv.style.background = "#ffeaea";
        limitDiv.style.border = "1px solid #ffcdd2";
        limitDiv.innerHTML = `<b>Limit Reached:</b> You've hit the ${MAX_MESSAGES_PER_CHAT} message limit for this chat.<br>Please start a <b>New Chat</b> to continue!`;
        messagesDiv.appendChild(limitDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        return;
    }

    
    // KULLANICI MESAJINI KUTUYA EKLE
    const userDiv = document.createElement('div');
    userDiv.innerHTML = `<div>🧑</div><div>${userMessage}</div>`;
    userDiv.className = 'chat-message user-message';
    messagesDiv.appendChild(userDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    chatHistory.push({ role: "user", content: userMessage });
    saveCurrentChat();

    // AI MESAJ KUTUSU OLUŞTUR
    const aiDiv = document.createElement('div');
    aiDiv.className = 'chat-message ai-message';

    const aiImg = document.createElement('video');
aiImg.src = '/img/intro.webm';
aiImg.alt = 'AI';
aiImg.autoplay = true;
aiImg.loop = true;
aiImg.muted = true;
aiImg.playsInline = true;

    const aiContent = document.createElement('div');
    aiContent.innerHTML = '<span class="typing">...</span>';

    const contentContainer = document.createElement('div');
    contentContainer.style.display = 'flex';
    contentContainer.style.flexDirection = 'column';
    contentContainer.style.flex = '1';

    contentContainer.appendChild(aiContent);
    aiDiv.appendChild(aiImg);
    aiDiv.appendChild(contentContainer);
    messagesDiv.appendChild(aiDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    // STREAM BAŞLASIN
    let hasError = false;
    let streamEnded = false;
    let fullTextBuffer = "";
    let isNearLimit = false;
    const SOFT_LIMIT = 220; // Yumuşak limit (kullanıcıya göster)
    const HARD_LIMIT = 280; // Gerçek limit (kesme noktası)

    console.log("[FRONT] sendAIChatMessage - AI sorgu başlatıldı", Date.now());
const eventSource = new EventSource(
        `/chat-stream?messages=${encodeURIComponent(JSON.stringify(chatHistory))}`
    );

    eventSource.onmessage = function(event) {
    console.log("[FRONT] SSE onmessage geldi", Date.now(), event.data);
    if (hasError) return;
    try {
        const data = JSON.parse(event.data);
            if (data.message && data.message.content) {
                const newText = data.message.content;
                fullTextBuffer += newText;
                
                // Karakter sayısını kontrol et
                const currentLength = fullTextBuffer.length;
                
                // Eğer yumuşak limite yaklaşıyorsa, backend'e uyarı gönder
                if (currentLength >= SOFT_LIMIT && !isNearLimit) {
                    isNearLimit = true;
                    console.log("Near character limit, will stop naturally");
                }
                
                // Gerçek zamanlı olarak göster
                aiContent.innerHTML = fullTextBuffer;
                
                // Eğer kesinlikle çok uzunsa ve doğal bir noktada kesilebilirse
                if (currentLength >= HARD_LIMIT) {
                    // Doğal bir durma noktası ara
                    const lastPeriod = fullTextBuffer.lastIndexOf('. ');
                    const lastExclamation = fullTextBuffer.lastIndexOf('! ');
                    const lastQuestion = fullTextBuffer.lastIndexOf('? ');
                    
                    let bestStopPoint = Math.max(lastPeriod, lastExclamation, lastQuestion);
                    
                    // Eğer uygun bir durma noktası bulundu ve makul uzunluktaysa
                    if (bestStopPoint > 180) {
                        fullTextBuffer = fullTextBuffer.substring(0, bestStopPoint + 1);
                        aiContent.innerHTML = fullTextBuffer;
                        eventSource.close();
                        setTimeout(completeResponse, 100);
                        return;
                    }
                }
                
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            }
        } catch (e) {
            console.log('Raw SSE data:', event.data);
        }
    };

    eventSource.onerror = function(e) {
    console.log("[FRONT] SSE error!", Date.now(), e);
    if (!hasError && !streamEnded) {
        hasError = true;
        eventSource.close();
        aiContent.innerHTML += " <span style='color:red;font-size:0.8em'>(Connection error)</span>";
    }
};

    eventSource.addEventListener('end', function() {
        completeResponse();
    });

    function completeResponse() {
        if (!hasError && !streamEnded) {
            streamEnded = true;
            eventSource.close();
            
            // Son düzenlemeler
            let finalText = fullTextBuffer.trim();
            
            // Fazla boşlukları temizle
            finalText = finalText.replace(/\s+/g, ' ');
            
            // KESME YAPMA! Sadece çok uzunsa ve tam bir cümlede değilse nokta ekle
            if (finalText.length > HARD_LIMIT) {
                // En son noktalama işaretini bul
                const lastPeriod = finalText.lastIndexOf('.');
                const lastExclamation = finalText.lastIndexOf('!');
                const lastQuestion = finalText.lastIndexOf('?');
                const lastStop = Math.max(lastPeriod, lastExclamation, lastQuestion);
                
                // Eğer son 50 karakter içinde noktalama yoksa, en yakın noktayı bul
                if (lastStop < finalText.length - 50) {
                    // Son boşluktan veya virgülden kes
                    const lastGoodBreak = Math.max(
                        finalText.lastIndexOf('. '),
                        finalText.lastIndexOf('! '),
                        finalText.lastIndexOf('? '),
                        finalText.lastIndexOf(', '),
                        finalText.lastIndexOf('; ')
                    );
                    
                    if (lastGoodBreak > 180) {
                        finalText = finalText.substring(0, lastGoodBreak + 1);
                    } else if (finalText.length > HARD_LIMIT) {
                        // Çok uzunsa ve uygun yer yoksa, son kelimeyi tamamla
                        finalText = finalText.substring(0, HARD_LIMIT - 3) + '...';
                    }
                }
            }
            
            // Eğer noktalama ile bitmiyorsa ekle
            if (finalText.length > 0) {
                const lastChar = finalText[finalText.length - 1];
                if (!['.', '!', '?'].includes(lastChar)) {
                    finalText += '.';
                }
            }
            
            // Güncelle
            aiContent.innerHTML = finalText;
         
            // Geçmişe kaydet
            chatHistory.push({ role: "assistant", content: finalText });
            saveCurrentChat();
            
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
    }

    // Timeout (45 saniye)
    setTimeout(() => {
    if (!streamEnded && !hasError) {
        console.log("[FRONT] STREAM TIMEOUT!", Date.now());
        eventSource.close();
        hasError = true;
        aiContent.innerHTML = "Response timed out. Please try again.";
        aiImg.src = '/img/avatar_aiio.png';
    }
}, 45000);
}

    if (sendBtn && chatInput) {
        sendBtn.addEventListener('click', () => {
            const val = chatInput.value.trim();
            if (val) {
                sendAIChatMessage(val);
                chatInput.value = '';
            }
        });
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendBtn.click();
        });
    }

    // Uygulama Başlangıcı
    startNewChat();
});

// Scroll helper
function setupMobileAIViewport() {
    if (window.innerWidth > 768) return;
    const sidebar = document.getElementById('sidebar-overlay-login');
    const chatBox = document.getElementById('ai-chat-box');
    const messagesDiv = document.getElementById('ai-chat-messages');
    const inputWrapper = document.querySelector('#ai-chat-box .ai-input-wrapper');
    if (!sidebar || !chatBox || !messagesDiv || !inputWrapper) return;
    if (!sidebar.classList.contains('open')) return;
    const viewportHeight = window.innerHeight;
    const sidebarTop = 100; 
    const availableHeight = viewportHeight - sidebarTop;
    sidebar.style.height = `${availableHeight}px`;
    chatBox.style.height = `${availableHeight}px`;
    const inputHeight = inputWrapper.offsetHeight;
    messagesDiv.style.paddingBottom = `${inputHeight + 10}px`;
    setTimeout(() => { messagesDiv.scrollTop = messagesDiv.scrollHeight; }, 50);
}

document.addEventListener('DOMContentLoaded', function() {
    const chatInput = document.getElementById('ai-chat-input');
    const messagesDiv = document.getElementById('ai-chat-messages');
    if (chatInput && messagesDiv) {
        chatInput.addEventListener('focus', function() {
            setTimeout(() => {
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
                setupMobileAIViewport();
            }, 350); 
        });
        chatInput.addEventListener('blur', function() {
            setTimeout(setupMobileAIViewport, 100);
        });
    }
    const originalToggleSidebarLogin = window.toggleSidebarLogin;
    if (originalToggleSidebarLogin) {
        window.toggleSidebarLogin = function() {
            originalToggleSidebarLogin();
            if (window.innerWidth <= 768) {
                setTimeout(() => {
                    setupMobileAIViewport();
                    const observer = new MutationObserver(() => { setupMobileAIViewport(); });
                    if (messagesDiv) {
                        observer.observe(messagesDiv, { childList: true, subtree: true });
                        setTimeout(() => observer.disconnect(), 10000);
                    }
                }, 300); 
            }
        };
    }
    window.addEventListener('resize', function() { if (window.innerWidth <= 768) setupMobileAIViewport(); });
    window.addEventListener('orientationchange', function() {
        setTimeout(() => { if (window.innerWidth <= 768) setupMobileAIViewport(); }, 500);
    });
    setTimeout(() => {
        if (window.innerWidth <= 768) {
            const sidebar = document.getElementById('sidebar-overlay-login');
            if (sidebar && sidebar.classList.contains('open')) setupMobileAIViewport();
        }
    }, 1000);
});

function fixAIScroll() {
    const messagesDiv = document.getElementById('ai-chat-messages');
    if (messagesDiv) messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

const originalSendAIChatMessage = window.sendAIChatMessage;
if (originalSendAIChatMessage) {
    window.sendAIChatMessage = function(userMessage) {
        originalSendAIChatMessage(userMessage);
        setTimeout(fixAIScroll, 100);
    };
}