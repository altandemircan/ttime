document.addEventListener("DOMContentLoaded", function() {
    
    // --- 1. CONFIG & VARIABLES ---
    const STORAGE_KEY = 'triptime_ai_history_v1';
    let currentChatId = null;
    let chatHistory = [];

    // --- DOM ELEMENTLERİNİ BUL ---
    const sidebarLogin = document.getElementById('sidebar-login');
    const sidebarTitle = sidebarLogin ? sidebarLogin.querySelector('.sidebar_title') : null;
    const formContainer = sidebarLogin ? sidebarLogin.querySelector('.form-container') : null;
    const formContent = document.getElementById('login-form'); // Chat kutusunu kapsayan alan
    const chatBox = document.getElementById('ai-chat-box');
    const messagesDiv = document.getElementById('ai-chat-messages');
    const chatInput = document.getElementById('ai-chat-input');
    const sendBtn = document.getElementById('ai-chat-send-btn');

    if (!sidebarLogin || !chatBox) return;

    // --- 2. CSS STYLES (Arayüz Düzenlemeleri) ---
    const styleId = 'tt-ai-sidebar-styles';
    if (!document.getElementById(styleId)) {
        const css = `
            /* Kontrol Butonları Alanı (Başlık ile Form Arası) */
            #ai-chat-controls {
                display: flex;
                justify-content: center;
                gap: 10px;
                padding: 10px 20px;
                background: #fff;
                border-bottom: 1px solid #f0f0f0;
                margin-bottom: 5px;
            }
            .ai-nav-btn {
                flex: 1;
                padding: 8px;
                border: 1px solid #e0e0e0;
                background: #f9f9f9;
                border-radius: 8px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 600;
                color: #555;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
            }
            .ai-nav-btn:hover { background: #f0f0f0; }
            .ai-nav-btn.active {
                background: #8a4af3;
                color: #fff;
                border-color: #8a4af3;
            }

            /* Geçmiş Listesi Görünümü */
            #ai-history-list {
                display: none; /* Başlangıçta gizli */
                flex-direction: column;
                width: 100%;
                height: 100%;
                overflow-y: auto;
                padding: 10px;
                box-sizing: border-box;
            }
            .history-card {
                background: #fff;
                border: 1px solid #eee;
                border-radius: 10px;
                padding: 12px;
                margin-bottom: 10px;
                cursor: pointer;
                transition: transform 0.2s, box-shadow 0.2s;
                position: relative;
                text-align: left;
            }
            .history-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                border-color: #8a4af3;
            }
            .h-title {
                font-weight: 700;
                font-size: 14px;
                color: #333;
                margin-bottom: 4px;
                display: block;
                padding-right: 25px; /* Silme butonu için yer */
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .h-date {
                font-size: 11px;
                color: #999;
            }
            .h-delete {
                position: absolute;
                right: 10px;
                top: 12px;
                background: transparent;
                border: none;
                color: #ffcccc;
                font-size: 16px;
                line-height: 1;
                cursor: pointer;
                transition: color 0.2s;
            }
            .h-delete:hover { color: #ff4444; }

            /* Görünürlük Sınıfları */
            .view-hidden { display: none !important; }
        `;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = css;
        document.head.appendChild(style);
    }

    // --- 3. UI ELEMENTLERİNİ YERLEŞTİRME ---

    // A) Butonları Başlık ve Form Container arasına ekle
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
    // Sidebar title'dan hemen sonraya ekle
    if (sidebarTitle && sidebarTitle.parentNode) {
        sidebarTitle.parentNode.insertBefore(controlsDiv, sidebarTitle.nextSibling);
    } else {
        // Fallback: Sidebar'ın en başına
        sidebarLogin.insertBefore(controlsDiv, sidebarLogin.firstChild);
    }

    // B) History Listesini Chat Box ile aynı seviyeye (form-content içine) ekle
    const historyListDiv = document.createElement('div');
    historyListDiv.id = 'ai-history-list';
    if (formContent) {
        formContent.appendChild(historyListDiv);
    }

    // --- 4. YARDIMCI FONKSİYONLAR (Storage & Logic) ---

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
        if (!currentChatId) currentChatId = 'chat_' + Date.now();

        const allChats = getAllChats();
        
        // Başlık belirleme (İlk kullanıcı mesajı)
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

    // --- 5. GÖRÜNÜM YÖNETİMİ ---

    function showChatScreen() {
        chatBox.classList.remove('view-hidden'); // Chat kutusunu göster
        historyListDiv.classList.remove('active'); // CSS display none için değil, JS mantığı
        historyListDiv.style.display = 'none';     // Listeyi gizle
        
        document.getElementById('btn-ai-new').classList.add('active');
        document.getElementById('btn-ai-history').classList.remove('active');
        
        // Scroll en alta
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function showHistoryScreen() {
        renderHistoryList(); // Listeyi güncelle
        chatBox.classList.add('view-hidden'); // Chat kutusunu gizle
        historyListDiv.style.display = 'flex'; // Listeyi göster
        
        document.getElementById('btn-ai-new').classList.remove('active');
        document.getElementById('btn-ai-history').classList.add('active');
    }

    function startNewChat() {
        currentChatId = null;
        chatHistory = [];
        messagesDiv.innerHTML = '';
        
        // Başlangıç mesajı
        const infoDiv = document.createElement("div");
        infoDiv.className = "chat-info";
        infoDiv.innerHTML = "<b>Mira AI:</b> Hello! I can help you plan your trip. Ask me anything! <br><span style='font-size:11px;opacity:0.7'>(Daily limit: 10)</span>";
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
            div.className = `chat-message ${msg.role === 'user' ? 'user-message' : 'ai-message'}`;
            
            // Markdown render (varsa)
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
            historyListDiv.innerHTML = '<div style="text-align:center;color:#999;margin-top:40px;">No chat history found.<br>Start a new chat!</div>';
            return;
        }

        sorted.forEach(chat => {
            const card = document.createElement('div');
            card.className = 'history-card';
            
            const dateStr = new Date(chat.updatedAt).toLocaleDateString() + ' ' + new Date(chat.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

            card.innerHTML = `
                <span class="h-title">${chat.title}</span>
                <span class="h-date">${dateStr}</span>
                <button class="h-delete" title="Delete Chat">✕</button>
            `;

            // Tıklayınca Yükle
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
                        startNewChat(); // Eğer açık olanı sildiyse yeniye geç
                    } else {
                        renderHistoryList(); // Listeyi yenile
                    }
                }
            });

            historyListDiv.appendChild(card);
        });
    }

    // --- 6. EVENT LISTENERS ---

    document.getElementById('btn-ai-new').addEventListener('click', startNewChat);
    document.getElementById('btn-ai-history').addEventListener('click', showHistoryScreen);

    // --- 7. MESAJ GÖNDERME MANTIĞI ---
    async function sendAIChatMessage(userMessage) {
        if (!canAskQuestion()) {
            const limitDiv = document.createElement('div');
            limitDiv.className = 'chat-message ai-message';
            limitDiv.style.background = "#ffeaea";
            limitDiv.textContent = "🤖 Daily limit reached (10). See you tomorrow!";
            messagesDiv.appendChild(limitDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            return;
        }

        // User Mesajı
        const userDiv = document.createElement('div');
        userDiv.textContent = '🧑 ' + userMessage;
        userDiv.className = 'chat-message user-message';
        messagesDiv.appendChild(userDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

        // Geçmişe ekle ve kaydet
        chatHistory.push({ role: "user", content: userMessage });
        saveCurrentChat();

        // AI Placeholder
        const aiDiv = document.createElement('div');
        aiDiv.innerHTML = '🤖 <span class="typing">...</span>';
        aiDiv.className = 'chat-message ai-message';
        messagesDiv.appendChild(aiDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

        // API İsteği
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
                    // İlk chunk geldiğinde "..." sil
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
                hasError = true; // Loop bitsin
                eventSource.close();

                // Markdown render
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

    // Başlangıç
    startNewChat();
});