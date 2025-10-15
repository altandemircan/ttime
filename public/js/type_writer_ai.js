// Typewriter efekti, her harf için delay uygular
function typeWriterEffect(element, text, speed = 18, callback) {
    let i = 0;
    function type() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, speed);
        } else if (callback) {
            callback();
        }
    }
    type();
}

// JSON stringten sadece ilk {...} bloğunu çek:
function extractFirstJson(str) {
    const start = str.indexOf('{');
    const end = str.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
        return str.substring(start, end + 1);
    }
    return "";
}

// Gün başlığı sağında AI Info butonu ile toggle'lı açılır AI kutusu ekle
async function insertTripAiInfo(onFirstToken, day = 1) {
    // Öncekileri sil
    document.querySelectorAll(`.day-container[data-day="${day}"] .ai-info-section`).forEach(el => el.remove());

    // Gün başlığı container'ını bul
    const dayHeader = document.querySelector(`#day-container-${day} .day-header .title-container`);
    if (!dayHeader) return;

    // AI Toggle butonu ekle (varsa tekrar ekleme)
    let aiToggleBtn = dayHeader.querySelector('.ai-toggle-btn');
    if (!aiToggleBtn) {
        aiToggleBtn = document.createElement('button');
        aiToggleBtn.className = 'ai-toggle-btn';
        aiToggleBtn.type = 'button';
        aiToggleBtn.setAttribute('aria-expanded', 'true');
        aiToggleBtn.innerHTML = '🤖 AI Info';
        aiToggleBtn.style.marginLeft = '10px';
        dayHeader.appendChild(aiToggleBtn);
    }

    // AI kutusunu oluştur
    const aiDiv = document.createElement('div');
    aiDiv.className = 'ai-info-section visible';
    aiDiv.style.transition = "max-height 0.3s, opacity 0.3s";
    aiDiv.innerHTML = `
      <h3 style="display:flex;align-items:center;justify-content:space-between;">
        AI Information
        <span id="ai-spinner" style="margin-left:10px;display:inline-block;">
          <svg width="22" height="22" viewBox="0 0 40 40" style="vertical-align:middle;"><circle cx="20" cy="20" r="16" fill="none" stroke="#888" stroke-width="4" stroke-linecap="round" stroke-dasharray="80" stroke-dashoffset="60"><animateTransform attributeName="transform" type="rotate" repeatCount="indefinite" dur="1s" keyTimes="0;1" values="0 20 20;360 20 20"/></circle></svg>
        </span>
      </h3>
      <div class="ai-info-content" style="display:none;">
        <p><b>🧳 Summary:</b> <span id="ai-summary"></span></p>
        <p><b>👉 Tip:</b> <span id="ai-tip"></span></p>
        <p><b>🔆 Highlight:</b> <span id="ai-highlight"></span></p>
      </div>
      <div class="ai-info-time" style="opacity:.6;font-size:13px;margin-top:8px;"></div>
    `;

    // Başlangıçta açık (görünsün)
    aiDiv.classList.add('visible');
    aiDiv.classList.remove('hidden');
    // Gün başlığının hemen altına ekle
    dayHeader.parentNode.insertAdjacentElement('afterend', aiDiv);

    // Toggle davranışı
    aiToggleBtn.onclick = function () {
        const isOpen = aiDiv.classList.contains('visible');
        aiDiv.classList.toggle('hidden', isOpen);
        aiDiv.classList.toggle('visible', !isOpen);
        aiToggleBtn.setAttribute('aria-expanded', !isOpen ? 'true' : 'false');
        // Yumuşak animasyon için:
        aiDiv.style.maxHeight = isOpen ? '0' : '500px';
        aiDiv.style.opacity = isOpen ? '0' : '1';
    };

    // ---- AI içerik yükleme ----
    const aiSummary = aiDiv.querySelector('#ai-summary');
    const aiTip = aiDiv.querySelector('#ai-tip');
    const aiHighlight = aiDiv.querySelector('#ai-highlight');
    const aiTime = aiDiv.querySelector('.ai-info-time');
    const aiSpinner = aiDiv.querySelector('#ai-spinner');
    const aiInfoContent = aiDiv.querySelector('.ai-info-content');
    let t0 = performance.now();

    // City bilgisi
    const tripTitleDiv = document.getElementById('trip_title');
    if (!tripTitleDiv) return;
    const city = (window.selectedCity || tripTitleDiv.textContent || '').replace(/ trip plan.*$/i, '').trim();
    if (!city) return;

    let jsonText = "";
    let firstChunkWritten = false;
    try {
        const resp = await fetch('/llm-proxy/plan-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ city })
        });
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const obj = JSON.parse(line);
                    if (obj.response) {
                        jsonText += obj.response;
                        // İlk chunk ile loading gizle, içerik göster, callback tetikle
                        if (!firstChunkWritten && obj.response.trim()) {
                            firstChunkWritten = true;
                            if (aiSpinner) aiSpinner.style.display = "none";
                            if (aiInfoContent) aiInfoContent.style.display = "";
                            if (typeof onFirstToken === "function") onFirstToken();
                        }
                    }
                } catch {}
            }
        }
        const jsonStr = extractFirstJson(jsonText);
        try {
            const aiObj = JSON.parse(jsonStr);

            // Zincirli typewriter: summary → tip → highlight
            typeWriterEffect(aiSummary, aiObj.summary || "", 18, function() {
                typeWriterEffect(aiTip, aiObj.tip || "", 18, function() {
                    typeWriterEffect(aiHighlight, aiObj.highlight || "", 18);
                });
            });
        } catch (e) {
            aiSummary.textContent = aiTip.textContent = aiHighlight.textContent = "AI çıktısı çözülemedi!";
        }
        let elapsed = Math.round(performance.now() - t0);
        aiTime.textContent = `⏱️ AI yanıt süresi: ${elapsed} ms`;
    } catch (e) {
        aiSummary.textContent = aiTip.textContent = aiHighlight.textContent = "";
        aiTime.innerHTML = "<span style='color:red'>AI bilgi alınamadı.</span>";
    }
}