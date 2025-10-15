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
      <div class="ai-info-content"><span style="opacity:.6">Loading...</span></div>
    `;
    tripTitleDiv.insertAdjacentElement('afterend', aiDiv);

    const aiContent = aiDiv.querySelector('.ai-info-content');
    aiContent.innerHTML = "";

    let fullText = "";
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
                        fullText += obj.response;
                    }
                } catch {}
            }
        }
        if (buffer.trim()) {
            try {
                const obj = JSON.parse(buffer);
                if (obj.response) {
                    fullText += obj.response;
                }
            } catch {}
        }

        // Şimdi typewriter ile alanları ekrana yaz
        let summary = "", tip = "", highlight = "";
        try {
            const resObj = JSON.parse(fullText);
            summary = resObj.summary || "";
            tip = resObj.tip || "";
            highlight = resObj.highlight || "";
        } catch {
            summary = (fullText.match(/"summary"\s*:\s*"([^"]+)"/) || [])[1] || "";
            tip = (fullText.match(/"tip"\s*:\s*"([^"]+)"/) || [])[1] || "";
            highlight = (fullText.match(/"highlight"\s*:\s*"([^"]+)"/) || [])[1] || "";
        }

        aiContent.innerHTML = `
          <p><b>🧳 Summary:</b> <span id="ai-summary"></span></p>
          <p><b>👉 Tip:</b> <span id="ai-tip"></span></p>
          <p><b>🔆 Highlight:</b> <span id="ai-highlight"></span></p>
        `;

        // Typewriter ile tek tek yaz
        typeWriterEffect(document.getElementById('ai-summary'), summary, 18, function() {
            typeWriterEffect(document.getElementById('ai-tip'), tip, 18, function() {
                typeWriterEffect(document.getElementById('ai-highlight'), highlight, 18);
            });
        });
    } catch (e) {
        aiContent.innerHTML = "<span style='color:red'>AI bilgi alınamadı.</span>";
    }
}