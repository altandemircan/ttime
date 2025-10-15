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
async function insertTripAiInfo() {
    document.querySelectorAll('.ai-info-section').forEach(el => el.remove());

    const tripTitleDiv = document.getElementById('trip_title');
    if (!tripTitleDiv) return;

    const city = (window.selectedCity || tripTitleDiv.textContent || '')
      .replace(/ trip plan.*$/i, '').trim();
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
    `;
    tripTitleDiv.insertAdjacentElement('afterend', aiDiv);

    const aiSummary = document.getElementById('ai-summary');
    const aiTip = document.getElementById('ai-tip');
    const aiHighlight = document.getElementById('ai-highlight');

    let active = "summary";
    let firstFieldStarted = false;

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
                            active = "summary";
                            firstFieldStarted = true;
                            continue;
                        }
                        if (obj.response.includes('"tip')) {
                            active = "tip";
                            continue;
                        }
                        if (obj.response.includes('"highlight')) {
                            active = "highlight";
                            continue;
                        }
                        // İlk alanın başındaki gereksiz karakterleri atla
                        if (!firstFieldStarted) continue;
                        // Alanlara karakter ekle
                        if (active === "summary") aiSummary.textContent += obj.response;
                        else if (active === "tip") aiTip.textContent += obj.response;
                        else if (active === "highlight") aiHighlight.textContent += obj.response;
                    }
                } catch {}
            }
        }
    } catch (e) {
        const aiContent = aiDiv.querySelector('.ai-info-content');
        if (aiContent)
            aiContent.innerHTML = "<span style='color:red'>AI bilgi alınamadı.</span>";
    }
}