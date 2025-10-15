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

// Şehir seçince çağrılır: AI başlasın, ilk karakter gelince plan aktifleşsin
function onCitySelected(city) {
    let planAktif = false;
    insertTripAiInfo(() => {
        if (!planAktif) {
            insertTripPlan(city);
            planAktif = true;
        }
    });
}

// ... city-select event kısmı değişmiyor ...

async function insertTripAiInfo(onFirstToken) {
    document.querySelectorAll('.ai-info-section').forEach(el => el.remove());
    const tripTitleDiv = document.getElementById('trip_title');
    if (!tripTitleDiv) return;
    const city = (window.selectedCity || tripTitleDiv.textContent || '').replace(/ trip plan.*$/i, '').trim();
    if (!city) return;
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
                        // İlk chunk ile callback tetiklenir
                        if (!firstChunkWritten && obj.response.trim()) {
                            firstChunkWritten = true;
                            if (typeof onFirstToken === "function") onFirstToken();
                        }
                    }
                } catch {}
            }
        }
        // Model bazen başa/sona fazladan karakter koyabilir, düzelt:
        const fixedJson = jsonText.replace(/^[^{]*({)/, '$1').replace(/}[^}]*$/, '}');
      
        try {
            const aiObj = JSON.parse(fixedJson);

            // Zincirli typewriter: önce summary, bitince tip, sonra highlight
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