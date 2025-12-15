document.addEventListener("DOMContentLoaded", function() {
    
    // --- 1. AYARLAR VE DEĞİŞKENLER ---
    const STORAGE_KEY = 'triptime_ai_history_v1';
    let currentChatId = null;
    let chatHistory = [];

    // --- DOM ELEMENTLERİNİ GÜVENLE SEÇ ---
    const sidebarLogin = document.getElementById('sidebar-login');
    const sidebarTitle = sidebarLogin ? sidebarLogin.querySelector('.sidebar_title') : null;
    const formContent = document.getElementById('login-form'); 
    const chatBox = document.getElementById('ai-chat-box');
    const messagesDiv = document.getElementById('ai-chat-messages');
    const chatInput = document.getElementById('ai-chat-input');
    const sendBtn = document.getElementById('ai-chat-send-btn');

    // Eğer temel elementler yoksa çalışma
    if (!sidebarLogin || !chatBox || !messagesDiv) return;

    // --- 2. CSS STYLES (Mevcut Tasarıma Uyumlu) ---
    // Bu stiller sadece yeni eklenen butonlar ve geçmiş listesi içindir.
    // Mevcut sitenin yapısını bozmaz.
    const styleId = 'tt-ai-sidebar-styles';
    if (!document.getElementById(styleId)) {
        const css = `
            /* Kontrol Butonları (Başlık Altı) */
            #ai-chat-controls {
                display: flex;
                gap: 8px;
                padding: 0 0 15px 0; /* Alt boşluk */
                margin-bottom: 10px;
                border-bottom: 1px solid #f0f0f0;
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
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                box-shadow: 0 1px 2px rgba(0,0,0,0.03);
            }
            .ai-nav-btn:hover {
                background: #faf8ff;
                border-color: #8a4af3;
                color: #8a4af3;
            }
            .ai-nav-btn.active {
                background: #8a4af3;
                color: #fff;
                border-color: #8a4af3;
                box-shadow: 0 4px 10px rgba(138, 74, 243, 0.2);
            }

            /* Geçmiş Listesi Alanı */
            #ai-history-list {
                display: none; /* JS ile açılacak */
                flex-direction: column;
                width: 100%;
                height: 100%;
                overflow-y: auto;
                padding-right: 4px; /* Scrollbar payı */
                gap: 10px;
            }
            
            /* Geçmiş Kartı (Mevcut tripbox stiline benzer) */
            .history-card {
                background: #fff;
                border: 1px solid #eee;
                border-radius: 10px;
                padding: 12px;
                cursor: pointer;
                position: relative;
                transition: all 0.2s ease;
                box-shadow: 0 2px 5px rgba(0,0,0,0.02);
            }
            .history-card:hover {
                border-color: #8a4af3;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.08);
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
                color: #ffcccc;
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

    // Sidebar başlığından hemen sonraya ekle (Title <-> Form arası)
    if (sidebarTitle && sidebarTitle.parentNode) {
        sidebarTitle.insertAdjacentElement('afterend', controlsDiv);
    } else {
        // Fallback: Form'un en başına
        sidebarLogin.insertBefore(controlsDiv, sidebarLogin.firstChild);
    }

    // B) Geçmiş Listesi Konteynerı
    // Chat kutusunun (ai-chat-box) hemen yanına/yerine gelecek
    const historyListDiv = document.createElement('div');
    historyListDiv.id = 'ai-history-list';
    
    // Chat box'ın parent'ına (muhtemelen form-content) ekleyelim ki chat-box ile yer değiştirebilsin
    chatBox.parentNode.insertBefore(historyListDiv, chatBox);

    // --- 4. DATA & LOGIC ---

    function getDailyQuestionCount() {
        const today = new Date().toISOString().slice(0, 10);
        const key = "questionCount_" + today;
        return parseInt(localStorage.getItem(key) || "0", 10);
    }
    function incrementQuestionCount() {
        const today = new Date().toISOString().slice(0, 10);
        const key = "questionCount_" + today;
        let count = getDailyQuestionCount();
        localStorage.setItem(key, count + 1);
    }
    function canAskQuestion() {
        return getDailyQuestionCount() < 10;
    }

    function getAllChats() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } 
        catch { return {}; }
    }

    function saveCurrentChat() {
        if (!chatHistory || chatHistory.length === 0) return;
        
        // Yeni ID oluştur
        if (!currentChatId) currentChatId = 'chat_' + Date.now();

        const allChats = getAllChats();
        
        // Başlık belirle (İlk kullanıcı mesajı)
        let title = "Conversation";
        const firstUserMsg = chatHistory.find(m => m.role === 'user');
        if (firstUserMsg) {
            title = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? "..." : "");
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
        // Chat'i göster
        chatBox.classList.remove('view-hidden');
        // History'yi gizle
        historyListDiv.classList.add('view-hidden'); 
        historyListDiv.style.display = 'none';
        
        // Buton durumları
        document.getElementById('btn-ai-new').classList.add('active');
        document.getElementById('btn-ai-history').classList.remove('active');
        
        // Scroll
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function showHistoryScreen() {
        renderHistoryList();
        
        // Chat'i gizle
        chatBox.classList.add('view-hidden');
        // History'yi göster
        historyListDiv.classList.remove('view-hidden');
        historyListDiv.style.display = 'flex';
        
        // Buton durumları
        document.getElementById('btn-ai-new').classList.remove('active');
        document.getElementById('btn-ai-history').classList.add('active');
    }

    function startNewChat() {
        currentChatId = null;
        chatHistory = [];
        messagesDiv.innerHTML = '';
        
        // Başlangıç Mesajı
        const infoDiv = document.createElement("div");
        infoDiv.className = "chat-info"; // styles.css'deki stil
        infoDiv.innerHTML = "<b>Mira AI:</b> Hello! Ask me anything about your trip plan. <br><span style='font-size:0.8rem;opacity:0.7'>(Daily limit: 10)</span>";
        messagesDiv.appendChild(infoDiv);

        showChatScreen();
    }

    function loadChatFromHistory(id) {
        const allChats = getAllChats();
        const chat = allChats[id];
        if (!chat) return;

        currentChatId = chat.id;
        chatHistory = chat.messages || [];
        
        messagesDiv.innerHTML = ''; // Temizle

        chatHistory.forEach(msg => {
            const div = document.createElement('div');
            // styles.css'deki user-message / ai-message sınıflarını kullan
            div.className = `chat-message ${msg.role === 'user' ? 'user-message' : 'ai-message'}`;
            
            const text = (typeof markdownToHtml === 'function' && msg.role === 'assistant')
                ? markdownToHtml(msg.content)
                : msg.content;

            if (msg.role === 'user') div.textContent = '🧑 ' + text;
            else div.innerHTML = '🤖 ' + text;
            
            messagesDiv.appendChild(div);
        });

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

            // Kart Tıklama -> Sohbeti Yükle
            card.addEventListener('click', (e) => {
                if (e.target.classList.contains('h-delete')) return;
                loadChatFromHistory(chat.id);
            });

            // Silme Butonu
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
    async function sendAIChatMessage(userMessage) {
        if (!canAskQuestion()) {
            const limitDiv = document.createElement('div');
            limitDiv.className = 'chat-message ai-message';
            limitDiv.style.background = "#ffeaea";
            limitDiv.innerHTML = "<b>Limit Reached:</b> See you tomorrow!";
            messagesDiv.appendChild(limitDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            return;
        }

        // 1. Kullanıcı Mesajını Bas
        const userDiv = document.createElement('div');
        userDiv.textContent = '🧑 ' + userMessage;
        userDiv.className = 'chat-message user-message';
        messagesDiv.appendChild(userDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

        // 2. Kaydet
        chatHistory.push({ role: "user", content: userMessage });
        saveCurrentChat();

        // 3. AI Placeholder
        const aiDiv = document.createElement('div');
        aiDiv.innerHTML = '🤖 <span class="typing">...</span>';
        aiDiv.className = 'chat-message ai-message';
        messagesDiv.appendChild(aiDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

        // 4. API İsteği (Stream)
        const eventSource = new EventSource(
            `/llm-proxy/chat-stream?messages=${encodeURIComponent(JSON.stringify(chatHistory))}`
        );

        let chunkQueue = [];
        let hasError = false;

        eventSource.onmessage = function(event) {
            if (hasError) return;
            try {
                const data = JSON.parse(event.data);
                if (data.message && data.message.content) {
                    chunkQueue.push(data.message.content);
                    if (aiDiv.querySelector('.typing')) aiDiv.innerHTML = '🤖 ';
                    
                    if (typeof startStreamingTypewriterEffect === 'function' && chunkQueue.length === 1) {
                        startStreamingTypewriterEffect(aiDiv, chunkQueue, 4);
                    } else if (typeof startStreamingTypewriterEffect !== 'function') {
                        aiDiv.textContent += data.message.content; 
                    }
                }
            } catch (e) {}
        };

        eventSource.onerror = function() {
            if (!hasError) {
                if (aiDiv._typewriterStop) aiDiv._typewriterStop();
                chunkQueue.length = 0;
                hasError = true;
                eventSource.close();
                aiDiv.innerHTML += " <span style='color:red;font-size:0.8em'>(Connection error)</span>";
            }
        };

        eventSource.addEventListener('end', function() {
            if (!hasError) {
                const fullText = chunkQueue.join('');
                
                // AI Cevabını Kaydet
                chatHistory.push({ role: "assistant", content: fullText });
                saveCurrentChat();
                incrementQuestionCount();

                if (aiDiv._typewriterStop) aiDiv._typewriterStop();
                chunkQueue.length = 0;
                hasError = true;
                eventSource.close();

                // Markdown varsa işle
                if (typeof markdownToHtml === 'function') {
                    aiDiv.innerHTML = '🤖 ' + markdownToHtml(fullText);
                } else {
                    aiDiv.innerHTML = '🤖 ' + fullText;
                }
            }
        });
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