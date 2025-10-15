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
function onCitySelected(city) {
    let planAktif = false;

    // AI yazısı başlasın, ilk karakter DOM'a yazılır yazılmaz plan aktifleşsin
    insertTripAiInfo(() => {
        if (!planAktif) {
            insertTripPlan(city); // Burada kendi plan oluşturma fonksiyonunu çağır
            planAktif = true;
        }
    });

    // Alternatif olarak, AI ve planı aynı anda da başlatabilirsin (isteğe bağlı):
    // insertTripPlan(city);
}

// Kullanıcı şehir seçince çağır:
document.getElementById('city-select').addEventListener('change', (e) => {
    const selected = e.target.value;
    onCitySelected(selected);
});
async function insertTripAiInfo(onFirstToken) {
    // Eski AI info bölümünü sil (başlık altında birden fazla olmasın)
    document.querySelectorAll('.ai-info-section').forEach(el => el.remove());

    // Başlık divini bul
    const tripTitleDiv = document.getElementById('trip_title');
    if (!tripTitleDiv) return;

    // Şehir adını başlıktan veya window.selectedCity'den al
    const city = (window.selectedCity || tripTitleDiv.textContent || '')
      .replace(/ trip plan.*$/i, '').trim();
    if (!city) return;

    // AI kutusunu ekle
    const aiDiv = document.createElement('div');
    aiDiv.className = 'ai-info-section';
    aiDiv.innerHTML = `
      <h3>AI Information</h3>
      <div class="ai-info-content">
        <p><b>🧳 Summary:</b> <span id="ai-summary"></span></p>
        <p><b>👉 Tip:</b> <span id="ai-tip"></span></p>
        <p><b>🔆 Highlight:</b> <span id="ai-highlight"></span></p>
      </div>
      <div class="ai-info-time" style="opacity:.6;font-size:13px;margin-top:8px;"></div>
    `;
    tripTitleDiv.insertAdjacentElement('afterend', aiDiv);

    const aiSummary = document.getElementById('ai-summary');
    const aiTip = document.getElementById('ai-tip');
    const aiHighlight = document.getElementById('ai-highlight');
    const aiTime = aiDiv.querySelector('.ai-info-time');
    let t0 = performance.now();

    // Streaming fetch
    let active = "summary";
    let fieldStarted = false;
    let summaryText = "", tipText = "", highlightText = "";
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
                        // Aktif alanı tespit et
                        if (obj.response.includes('"summary')) {
                            active = "summary"; fieldStarted = true; continue;
                        }
                        if (obj.response.includes('"tip')) {
                            active = "tip"; continue;
                        }
                        if (obj.response.includes('"highlight')) {
                            active = "highlight"; continue;
                        }
                        // Alanlara karakter ekle
                        if (!fieldStarted) continue;
                        if (active === "summary") {
                            summaryText += obj.response;
                            aiSummary.textContent = summaryText;
                        } else if (active === "tip") {
                            tipText += obj.response;
                            aiTip.textContent = tipText;
                        } else if (active === "highlight") {
                            highlightText += obj.response;
                            aiHighlight.textContent = highlightText;
                        }
                        // İlk chunk yazılırsa callback tetikle (plan aktifleşmesi için)
                        if (!firstChunkWritten && obj.response.trim()) {
                            firstChunkWritten = true;
                            if (typeof onFirstToken === "function") onFirstToken();
                        }
                    }
                } catch {}
            }
        }
        // Yanıt süresi
        let elapsed = Math.round(performance.now() - t0);
        aiTime.textContent = `⏱️ AI yanıt süresi: ${elapsed} ms`;
    } catch (e) {
        aiSummary.textContent = aiTip.textContent = aiHighlight.textContent = "";
        aiTime.innerHTML = "<span style='color:red'>AI bilgi alınamadı.</span>";
    }
}