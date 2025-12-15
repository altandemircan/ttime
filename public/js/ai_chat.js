document.addEventListener("DOMContentLoaded", function() {
    // --- 1. CSS ENJEKSİYONU (Arayüz Güzelleştirme) ---
    const styleId = 'tt-ai-chat-styles';
    if (!document.getElementById(styleId)) {
        const css = `
            #ai-chat-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px;
                background: #f8f9fa;
                border-bottom: 1px solid #eee;
                margin-bottom: 10px;
                border-radius: 8px 8px 0 0;
            }
            .ai-header-btn {
                background: white;
                border: 1px solid #ddd;
                padding: 5px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                color: #555;
                transition: all 0.2s;
            }
            .ai-header-btn:hover { background: #eee; }
            .ai-header-btn.active { background: #8a4af3; color: white; border-color: #8a4af3; }
            
            #ai-history-view {
                display: none;
                flex-direction: column;
                height: 100%;
                overflow-y: auto;
                padding: 10px;
            }
            .history-item {
                background: #fff;
                border: 1px solid #eee;
                padding: 12px;
                margin-bottom: 8px;
                border-radius: 8px;
                cursor: pointer;
                transition: transform 0.1s, box-shadow 0.1s;
                position: relative;
            }
            .history-item:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 10px rgba(0,0,0,0.05);
                border-color: #d1c4e9;
            }
            .history-title { font-weight: 600; font-size: 14px; color: #333; margin-bottom: 4px; display:block; padding-right: 20px; }
            .history-date { font-size: 11px; color: #999; }
            .history-delete {
                position: absolute;
                right: 10px;
                top: 10px;
                background: none;
                border: none;
                color: #ff9898;
                font-size: 16px;
                cursor: pointer;
                padding: 2px;
            }
            .history-delete:hover { color: #ff4444; }
            
            /* Mevcut chat ekranı gizlendiğinde */
            #ai-chat-messages.hidden { display: none !important; }
            .ai-input-wrapper.hidden { display: none !important; }
        `;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = css;
        document.head.appendChild(style);
    }

    // --- 2. DEĞİŞKENLER VE STORAGE KEY ---
    const STORAGE_KEY = 'triptime_ai_history_v1';
    let currentChatId = null; // Aktif sohbet ID'si
    let chatHistory = [];     // Aktif sohbetin mesajları (bellekteki)

    // DOM Elementleri
    const container = document.getElementById('ai-chat-box');
    const messagesDiv = document.getElementById('ai-chat-messages');
    const inputWrapper = document.querySelector('.ai-input-wrapper'); // Input alanı
    const chatInput = document.getElementById('ai-chat-input');
    const sendBtn = document.getElementById('ai-chat-send-btn');

    if (!container || !messagesDiv) return;

    // --- 3. ARAYÜZ OLUŞTURMA (HEADER & HISTORY) ---
    // Header (New Chat / History)
    const header = document.createElement('div');
    header.id = 'ai-chat-header';
    header.innerHTML = `
        <button id="ai-btn-new" class="ai-header-btn">+ New Chat</button>
        <button id="ai-btn-history" class="ai-header-btn">History 📂</button>
    `;
    container.insertBefore(header, messagesDiv);

    // History View Container
    const historyView = document.createElement('div');
    historyView.id = 'ai-history-view';
    container.insertBefore(historyView, messagesDiv);

    // --- 4. YARDIMCI FONKSİYONLAR ---

    // Günlük Limit Kontrolü (Değişmedi)
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

    // Storage: Tüm geçmişi çek
    function getAllChats() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        } catch { return {}; }
    }

    // Storage: Aktif sohbeti kaydet
    function saveCurrentChat() {
        if (!chatHistory || chatHistory.length === 0) return;

        // ID yoksa oluştur (Timestamp)
        if (!currentChatId) {
            currentChatId = 'chat_' + Date.now();
        }

        const allChats = getAllChats();
        
        // Başlık belirle (İlk kullanıcı mesajı veya varsayılan)
        let title = "New Conversation";
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

    // UI: Yeni Sohbet Başlat
    function startNewChat() {
        currentChatId = null;
        chatHistory = [];
        messagesDiv.innerHTML = '';
        
        // Hoşgeldin / Limit uyarısı
        var infoDiv = document.createElement("div");
        infoDiv.className = "chat-info";
        infoDiv.textContent = "Mira: Ask me anything about your trip! (Daily limit: 10)";
        messagesDiv.appendChild(infoDiv);

        showChatView();
    }

    // UI: Sohbeti Yükle
    function loadChat(id) {
        const allChats = getAllChats();
        const chat = allChats[id];
        if (!chat) return;

        currentChatId = chat.id;
        chatHistory = chat.messages || [];
        
        // Ekranı temizle ve mesajları diz
        messagesDiv.innerHTML = '';
        
        chatHistory.forEach(msg => {
            const div = document.createElement('div');
            div.className = `chat-message ${msg.role === 'user' ? 'user-message' : 'ai-message'}`;
            // Markdown desteği varsa markdownToHtml kullan, yoksa düz text
            const contentHTML = (typeof markdownToHtml === 'function' && msg.role === 'assistant') 
                ? markdownToHtml(msg.content) 
                : msg.content;
                
            if (msg.role === 'user') div.textContent = '🧑 ' + contentHTML;
            else div.innerHTML = '🤖 ' + contentHTML;
            
            messagesDiv.appendChild(div);
        });

        // En alta kaydır
        setTimeout(() => {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }, 50);

        showChatView();
    }

    // UI: Geçmiş Listesini Render Et
    function renderHistory() {
        const allChats = getAllChats();
        const sortedChats = Object.values(allChats).sort((a, b) => b.updatedAt - a.updatedAt);
        
        historyView.innerHTML = '';
        
        if (sortedChats.length === 0) {
            historyView.innerHTML = '<div style="text-align:center;color:#999;margin-top:20px;">No history yet.</div>';
            return;
        }

        sortedChats.forEach(chat => {
            const item = document.createElement('div');
            item.className = 'history-item';
            
            const dateStr = new Date(chat.updatedAt).toLocaleDateString() + ' ' + new Date(chat.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

            item.innerHTML = `
                <span class="history-title">${chat.title}</span>
                <span class="history-date">${dateStr}</span>
                <button class="history-delete" title="Delete">✕</button>
            `;

            // Tıklama: Yükle
            item.addEventListener('click', (e) => {
                // Silme butonuna basıldıysa yükleme yapma
                if (e.target.classList.contains('history-delete')) return;
                loadChat(chat.id);
            });

            // Silme
            item.querySelector('.history-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Delete this chat?')) {
                    const db = getAllChats();
                    delete db[chat.id];
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
                    
                    // Eğer aktif sohbet silindiyse yenisine geç
                    if (currentChatId === chat.id) startNewChat();
                    
                    renderHistory(); // Listeyi yenile
                }
            });

            historyView.appendChild(item);
        });
    }

    // Görünüm Değiştiriciler
    function showChatView() {
        messagesDiv.classList.remove('hidden');
        inputWrapper.classList.remove('hidden');
        historyView.style.display = 'none';
        document.getElementById('ai-btn-new').classList.add('active');
        document.getElementById('ai-btn-history').classList.remove('active');
    }

    function showHistoryView() {
        renderHistory();
        messagesDiv.classList.add('hidden');
        inputWrapper.classList.add('hidden');
        historyView.style.display = 'flex';
        document.getElementById('ai-btn-new').classList.remove('active');
        document.getElementById('ai-btn-history').classList.add('active');
    }

    // --- 5. EVENT LISTENERS (Butonlar) ---
    
    document.getElementById('ai-btn-new').addEventListener('click', startNewChat);
    document.getElementById('ai-btn-history').addEventListener('click', showHistoryView);

    // --- 6. MESAJ GÖNDERME MANTIĞI (GÜNCELLENDİ) ---
    async function sendAIChatMessage(userMessage) {
        if (!messagesDiv) return;

        // Limit Kontrol
        if (!canAskQuestion()) {
            var limitDiv = document.createElement('div');
            limitDiv.className = 'chat-message ai-message';
            limitDiv.style.background = "#ffeaea";
            limitDiv.style.textAlign = "center";
            limitDiv.style.fontWeight = "bold";
            limitDiv.textContent = "🤖 You have reached your daily question limit (10). Please come back tomorrow!";
            messagesDiv.appendChild(limitDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            return;
        }

        // 1. Kullanıcı Mesajını Bas
        var userDiv = document.createElement('div');
        userDiv.textContent = '🧑 ' + userMessage;
        userDiv.className = 'chat-message user-message';
        messagesDiv.appendChild(userDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

        // 2. Hafızaya Ekle ve Kaydet
        chatHistory.push({ role: "user", content: userMessage });
        saveCurrentChat(); // <-- KAYIT

        // 3. AI Placeholder
        var aiDiv = document.createElement('div');
        aiDiv.innerHTML = '🤖 ';
        aiDiv.className = 'chat-message ai-message';
        messagesDiv.appendChild(aiDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

        // 4. API İsteği
        const eventSource = new EventSource(
            `/llm-proxy/chat-stream?messages=${encodeURIComponent(JSON.stringify(chatHistory))}`
        );

        let chunkQueue = [];
        let sseEndedOrErrored = false;

        eventSource.onmessage = function(event) {
            if (sseEndedOrErrored) return;
            try {
                const data = JSON.parse(event.data);
                if (data.message && typeof data.message.content === "string" && data.message.content.length > 0) {
                    chunkQueue.push(data.message.content);
                    if (chunkQueue.length === 1 && aiDiv.innerHTML === '🤖 ') {
                        if (typeof startStreamingTypewriterEffect === 'function') {
                            startStreamingTypewriterEffect(aiDiv, chunkQueue, 4);
                        } else {
                            aiDiv.textContent += data.message.content; // Fallback
                        }
                    }
                }
            } catch (e) { console.error('SSE error:', e); }
        };

        eventSource.onerror = function(event) {
            if (!sseEndedOrErrored) {
                if (aiDiv._typewriterStop) aiDiv._typewriterStop();
                chunkQueue.length = 0;
                aiDiv.innerHTML += "<br><span style='color:red'>AI connection error!</span>";
                sseEndedOrErrored = true;
                eventSource.close();
            }
        };

        eventSource.addEventListener('end', function() {
            if (!sseEndedOrErrored) {
                const aiText = chunkQueue.join('');
                
                // 5. AI Cevabını Hafızaya Ekle ve Kaydet
                chatHistory.push({ role: "assistant", content: aiText });
                saveCurrentChat(); // <-- KAYIT

                incrementQuestionCount();
                if (aiDiv._typewriterStop) aiDiv._typewriterStop();
                chunkQueue.length = 0;
                sseEndedOrErrored = true;
                eventSource.close();

                // Markdown varsa render et
                if (typeof markdownToHtml === 'function') {
                    aiDiv.innerHTML = '🤖 ' + markdownToHtml(aiText);
                } else {
                    aiDiv.innerHTML = '🤖 ' + aiText;
                }
            }
        });
    }

    // Input Events
    if (sendBtn && chatInput) {
        sendBtn.addEventListener('click', function () {
            var val = chatInput.value.trim();
            if (val) {
                sendAIChatMessage(val);
                chatInput.value = '';
            }
        });
        chatInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                sendBtn.click();
            }
        });
    }

    // --- BAŞLANGIÇ ---
    // Sayfa yüklendiğinde temiz bir sohbet başlat (veya sonuncuyu yükle - tercihine bağlı)
    // Şimdilik "New Chat" ile başlatıyoruz.
    startNewChat();
});