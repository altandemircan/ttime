document.addEventListener("DOMContentLoaded", function() {
    
    // --- 1. AYARLAR VE DEĞİŞKENLER ---
    const STORAGE_KEY = 'triptime_ai_history_v1';
    const MAX_MESSAGES_PER_CHAT = 10; 
    let currentChatId = null;
    let chatHistory = [];

    // --- DOM ELEMENTLERİNİ SEÇ ---
    const sidebarLogin = document.getElementById('sidebar-login');
    const sidebarTitle = sidebarLogin ? sidebarLogin.querySelector('.sidebar_title') : null;
    const formContainer = sidebarLogin ? sidebarLogin.querySelector('.form-container') : null;
    const formContent = document.getElementById('login-form'); 
    
    const chatBox = document.getElementById('ai-chat-box');
    const messagesDiv = document.getElementById('ai-chat-messages');
    const chatInput = document.getElementById('ai-chat-input');
    const sendBtn = document.getElementById('ai-chat-send-btn');

    if (!sidebarLogin || !chatBox || !messagesDiv || !formContainer || !formContent) return;

    // --- 2. CSS STYLES (DÜZELTİLMİŞ VERSİYON) ---
    const styleId = 'tt-ai-sidebar-styles';
    if (!document.getElementById(styleId)) {
        const css = `
            /* --- 1. ANA YAPI DÜZELTMESİ --- */
            /* HATA BURADAYDI: position:fixed kaldırdık. Artık overlay'e uyacak. */
            #sidebar-login {
                display: flex !important;
                flex-direction: column !important;
                height: 100% !important;
                width: 100% !important;
                overflow: hidden !important;
                padding: 0 !important;
                /* Mobilde tarayıcı barı sorunu için overlay'e değil içeriğe yükseklik veriyoruz */
                max-height: 100dvh !important; 
            }

            /* Mobilde Overlay'in kendisini tam ekran yapıyoruz */
            @media (max-width: 768px) {
                #sidebar-overlay-login.open {
                    height: 100dvh !important;
                    bottom: 0 !important;
                }
            }

            /* --- 2. İÇERİK AKIŞI (FLEX) --- */
            /* styles.css'deki column-reverse gibi kuralları eziyoruz */
            .form-container {
                flex: 1 !important;
                display: flex !important;
                flex-direction: column !important;
                height: auto !important;
                overflow: hidden !important;
                padding: 0 !important;
                margin: 0 !important;
                justify-content: flex-start !important;
            }

            #login-form {
                flex: 1 !important;
                display: flex !important;
                flex-direction: column !important;
                height: 100% !important;
                overflow: hidden !important;
                width: 100% !important;
            }

            /* --- 3. CHAT KUTUSU --- */
            #ai-chat-box {
                flex: 1 !important;
                display: flex !important;
                flex-direction: column !important;
                height: 100% !important;
                overflow: hidden !important;
                position: relative !important;
                padding: 0 10px !important;
            }

            /* --- 4. MESAJ LİSTESİ (SCROLL ALANI) --- */
            #ai-chat-messages {
                flex: 1 !important;
                overflow-y: auto !important;
                display: flex !important;
                flex-direction: column !important;
                padding-bottom: 10px !important;
                margin-bottom: 0 !important;
                width: 100% !important;
                -webkit-overflow-scrolling: touch;
            }

            /* Genel div marginlerini sıfırla */
            #ai-chat-messages div {
                margin: 0 !important;
            }

            /* Mesaj Baloncukları */
            .chat-message {
                margin: 8px 0px !important;      
                padding: 12px 16px !important;
                border-radius: 16px !important;
                width: fit-content !important;
                max-width: 85% !important;
                display: flex !important;
                gap: 10px !important;
                line-height: 1.5 !important;
                align-items: flex-start !important;
                flex-shrink: 0 !important;
            }

            .chat-message > div {
                margin: 0 !important;
                padding: 0 !important;
            }

            .ai-message {
                background: #f6f4ff !important;
                color: #1e293b !important;
                align-self: flex-start !important;
                text-align: left !important;
            }

            .user-message {
                background: #e6f5ff !important;
                color: #1e293b !important;
                align-self: flex-end !important;
                flex-direction: row-reverse !important;
                text-align: left !important;
                align-items: center !important;
            }

            .ai-message img {
                width: 24px !important;
                height: 24px !important;
                border-radius: 50% !important;
                object-fit: cover !important;
                flex-shrink: 0 !important;
                margin-top: 2px !important;
                display: block !important;
            }

            /* --- 5. INPUT ALANI (SABİTLEME) --- */
            .ai-input-wrapper {
                flex-shrink: 0 !important;
                width: 100% !important;
                background: #ffffff !important;
                border-top: 1px solid #f0f0f0 !important;
                z-index: 50 !important;
                padding: 10px !important;
                
                /* iPhone Safe Area */
                padding-bottom: calc(10px + env(safe-area-inset-bottom)) !important;
                
                position: relative !important;
                display: flex !important;
                flex-direction: column !important;
            }

            /* --- 6. DİĞER KONTROLLER --- */
            #ai-chat-controls {
                display: flex !important;
                gap: 8px !important;
                padding: 0 10px 10px 10px !important;
                flex-shrink: 0 !important;
                border-bottom: 1px solid #f0f0f0 !important;
                margin-bottom: 0 !important;
            }

            .ai-nav-btn {
                flex: 1;
                padding: 8px 12px;
                border: 1px solid #eee;
                background: #fff;
                border-radius: 8px;
                cursor: pointer;
                font-family: "Satoshi", sans-serif;
                font-size: 0.85rem;
                font-weight: 600;
                color: #555;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
            }
            .ai-nav-btn.active {
                background: #9868e8;
                color: #fff;
                border-color: #9868e8;
            }

            /* History */
            #ai-history-list {
                display: none;
                flex-direction: column;
                overflow-y: auto;
                padding: 0 10px;
                flex: 1 !important;
                height: 100% !important;
            }
            .history-card {
                background: #f9f9f9;
                border: 1px solid #eee;
                border-radius: 10px;
                padding: 12px;
                margin-bottom: 8px !important;
                cursor: pointer;
                position: relative;
                flex-shrink: 0;
            }
            .h-title { font-weight: 600; font-size: 0.9rem; display: block; margin-bottom: 4px; }
            .h-date { font-size: 0.75rem; color: #959595; }
            .h-delete { position: absolute; right: 10px; top: 10px; background: transparent; border: none; color: #ffcccc; cursor: pointer; }

            .view-hidden { display: none !important; }
        `;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = css;
        document.head.appendChild(style);
    }

    // --- 3. UI MANTIKLARI ---

    // Kontrol Butonları
    const controlsDiv = document.createElement('div');
    controlsDiv.id = 'ai-chat-controls';
    controlsDiv.innerHTML = `
        <button id="btn-ai-new" class="ai-nav-btn active"><span>✨ New Chat</span></button>
        <button id="btn-ai-history" class="ai-nav-btn"><span>📂 History</span></button>
    `;
    if (sidebarTitle && sidebarTitle.parentNode) sidebarTitle.insertAdjacentElement('afterend', controlsDiv);

    // History Listesi
    const historyListDiv = document.createElement('div');
    historyListDiv.id = 'ai-history-list';
    formContainer.appendChild(historyListDiv);

    // --- 4. CHAT FONKSİYONLARI ---

    function canAskQuestion() {
        const userMsgCount = chatHistory.filter(m => m.role === 'user').length;
        return userMsgCount < MAX_MESSAGES_PER_CHAT;
    }

    function getAllChats() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
    }

    function saveCurrentChat() {
        if (!chatHistory || chatHistory.length === 0) return;
        if (!currentChatId) currentChatId = 'chat_' + Date.now();
        const allChats = getAllChats();
        let title = chatHistory.find(m => m.role === 'user')?.content.slice(0, 35) || "Conversation";
        allChats[currentChatId] = { id: currentChatId, title: title, updatedAt: Date.now(), messages: chatHistory };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allChats));
    }

    function showChatScreen() {
        formContent.classList.remove('view-hidden');
        formContent.style.display = 'flex'; // Flex yapısı korunsun
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
        infoDiv.innerHTML = `<b>Mira AI:</b> Hello! Ask me anything about your trip plan. <br><span style='font-size:0.8rem;opacity:0.7'>(Limit: ${MAX_MESSAGES_PER_CHAT} messages per chat)</span>`;
        messagesDiv.appendChild(infoDiv);
        showChatScreen();
    }

    function loadChatFromHistory(id) {
        const chat = getAllChats()[id];
        if (!chat) return;
        currentChatId = chat.id;
        chatHistory = chat.messages || [];
        messagesDiv.innerHTML = '';
        
        chatHistory.forEach(msg => {
            const div = document.createElement('div');
            div.className = `chat-message ${msg.role === 'user' ? 'user-message' : 'ai-message'}`;
            const text = (typeof markdownToHtml === 'function' && msg.role === 'assistant') ? markdownToHtml(msg.content) : msg.content;
            
            if (msg.role === 'user') {
                div.innerHTML = `<div>🧑</div><div>${text}</div>`;
            } else {
                div.innerHTML = `<img src="https://dev.triptime.ai/img/avatar_aiio.png"><div>${text}</div>`;
            }
            messagesDiv.appendChild(div);
        });

        if (!canAskQuestion()) {
            const limitDiv = document.createElement('div');
            limitDiv.className = 'chat-message ai-message';
            limitDiv.innerHTML = "<span style='color:#d32f2f;font-size:0.85rem'><b>Note:</b> This chat has reached its message limit.</span>";
            messagesDiv.appendChild(limitDiv);
        }
        showChatScreen();
    }

    function renderHistoryList() {
        historyListDiv.innerHTML = '';
        const allChats = getAllChats();
        const sorted = Object.values(allChats).sort((a, b) => b.updatedAt - a.updatedAt);
        if (sorted.length === 0) {
            historyListDiv.innerHTML = '<div style="text-align:center;color:#959595;margin-top:40px;">No chat history found.</div>';
            return;
        }
        sorted.forEach(chat => {
            const card = document.createElement('div');
            card.className = 'history-card';
            const d = new Date(chat.updatedAt);
            card.innerHTML = `<span class="h-title">${chat.title}</span><span class="h-date">${d.toLocaleDateString()}</span><button class="h-delete">✕</button>`;
            card.onclick = (e) => { if(!e.target.classList.contains('h-delete')) loadChatFromHistory(chat.id); };
            card.querySelector('.h-delete').onclick = (e) => {
                e.stopPropagation();
                if(confirm('Delete?')) {
                    const db = getAllChats(); delete db[chat.id];
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
                    currentChatId === chat.id ? startNewChat() : renderHistoryList();
                }
            };
            historyListDiv.appendChild(card);
        });
    }

    document.getElementById('btn-ai-new').addEventListener('click', startNewChat);
    document.getElementById('btn-ai-history').addEventListener('click', showHistoryScreen);

    // --- 5. MESAJ GÖNDERME ---
    async function sendAIChatMessage(userMessage) {
        if (!canAskQuestion()) {
            const limitDiv = document.createElement('div');
            limitDiv.className = 'chat-message ai-message';
            limitDiv.innerHTML = "<span style='color:#d32f2f'>Limit Reached. Please start a New Chat.</span>";
            messagesDiv.appendChild(limitDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            return;
        }

        const userDiv = document.createElement('div');
        userDiv.className = 'chat-message user-message';
        userDiv.innerHTML = `<div>🧑</div><div>${userMessage}</div>`;
        messagesDiv.appendChild(userDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

        chatHistory.push({ role: "user", content: userMessage });
        saveCurrentChat();

        const aiDiv = document.createElement('div');
        aiDiv.className = 'chat-message ai-message';
        const aiImg = document.createElement('img');
        aiImg.src = '/img/aioo.webp'; 
        const aiContent = document.createElement('div');
        aiContent.innerHTML = '<span class="typing">...</span>';
        
        aiDiv.appendChild(aiImg);
        aiDiv.appendChild(aiContent);
        messagesDiv.appendChild(aiDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

        const eventSource = new EventSource(`/llm-proxy/chat-stream?messages=${encodeURIComponent(JSON.stringify(chatHistory))}`);
        let chunkQueue = [], hasError = false, isFirstChunk = true;

        eventSource.onmessage = function(event) {
            if (hasError) return;
            try {
                const data = JSON.parse(event.data);
                if (data.message && data.message.content) {
                    chunkQueue.push(data.message.content);
                    if (isFirstChunk) { aiContent.innerHTML = ''; isFirstChunk = false; }
                    if (typeof startStreamingTypewriterEffect === 'function' && chunkQueue.length === 1) {
                        startStreamingTypewriterEffect(aiContent, chunkQueue, 4);
                    } else if (typeof startStreamingTypewriterEffect !== 'function') {
                        aiContent.textContent += data.message.content; 
                    }
                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
                }
            } catch (e) {}
        };

        eventSource.onerror = function() {
            if (!hasError) {
                if (aiContent._typewriterStop) aiContent._typewriterStop();
                chunkQueue.length = 0; hasError = true; eventSource.close();
                aiContent.innerHTML += " <span style='color:red'>(Error)</span>";
                aiImg.src = 'https://dev.triptime.ai/img/avatar_aiio.png';
            }
        };

        eventSource.addEventListener('end', function() {
            if (!hasError) {
                const fullText = chunkQueue.join('');
                chatHistory.push({ role: "assistant", content: fullText });
                saveCurrentChat();
                if (aiContent._typewriterStop) aiContent._typewriterStop();
                chunkQueue.length = 0; hasError = true; eventSource.close();
                aiImg.src = 'https://dev.triptime.ai/img/avatar_aiio.png';
                aiContent.innerHTML = (typeof markdownToHtml === 'function') ? markdownToHtml(fullText) : fullText;
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            }
        });
    }

    if (sendBtn && chatInput) {
        sendBtn.addEventListener('click', () => {
            const val = chatInput.value.trim();
            if (val) { sendAIChatMessage(val); chatInput.value = ''; }
        });
        chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendBtn.click(); });
    }

    startNewChat();
});