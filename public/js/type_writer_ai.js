// Typewriter efekti, her harf için delay uygular
function typeWriterEffect(element, text, speed = 18, callback) {
    let i = 0;
    element.innerHTML = ""; // Hatalı üst üste birikmeyi engelle!
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
        window.lastTripAIInfo = null;

    insertTripAiInfo(() => {
        if (!planAktif) {
            insertTripPlan(city);
            planAktif = true;
        }
    });
}

// JSON stringten sadece ilk {...} bloğunu çek, kapanış } yoksa sona kadar al
function extractFirstJson(str) {
    const start = str.indexOf('{');
    const end = str.lastIndexOf('}');
    if (start !== -1) {
        // Kapanış } yoksa sona kadar al
        return str.substring(start, (end !== -1 && end > start) ? end + 1 : undefined);
    }
    return "";
}
async function insertTripAiInfo(onFirstToken, aiStaticInfo = null) {
    document.querySelectorAll('.ai-info-section').forEach(el => el.remove());
    const tripTitleDiv = document.getElementById('trip_title');
    if (!tripTitleDiv) return;
    const city = (window.selectedCity || tripTitleDiv.textContent || '').replace(/ trip plan.*$/i, '').trim();
    if (!city && !aiStaticInfo) return;

    // AI kutusu
    const aiDiv = document.createElement('div');
    aiDiv.className = 'ai-info-section';
    aiDiv.innerHTML = `
      <h3 id="ai-toggle-header" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;">
        <span>AI Information</span>
        <button id="ai-toggle-btn" style="border:none;background:transparent;font-size:18px;cursor:pointer;padding:0 10px;">▼</button>
        <span id="ai-spinner" style="margin-left:10px;display:inline-block;">
          <svg width="22" height="22" viewBox="0 0 40 40" style="vertical-align:middle;"><circle cx="20" cy="20" r="16" fill="none" stroke="#888" stroke-width="4" stroke-linecap="round" stroke-dasharray="80" stroke-dashoffset="60"><animateTransform attributeName="transform" type="rotate" repeatCount="indefinite" dur="1s" keyTimes="0;1" values="0 20 20;360 20 20"/></circle></svg>
        </span>
      </h3>
      <div class="ai-info-content" style="max-height:1200px;overflow:hidden;transition:max-height 0.2s,opacity 0.2s;opacity:1;">
        <p><b>🧳 Summary:</b> <span id="ai-summary"></span></p>
        <p><b>👉 Tip:</b> <span id="ai-tip"></span></p>
        <p><b>🔆 Highlight:</b> <span id="ai-highlight"></span></p>
      </div>
      <div class="ai-info-time" style="opacity:.6;font-size:13px;margin-top:8px;"></div>
    `;
    tripTitleDiv.insertAdjacentElement('afterend', aiDiv);

    const aiSummary = aiDiv.querySelector('#ai-summary');
    const aiTip = aiDiv.querySelector('#ai-tip');
    const aiHighlight = aiDiv.querySelector('#ai-highlight');
    const aiTime = aiDiv.querySelector('.ai-info-time');
    const aiSpinner = aiDiv.querySelector('#ai-spinner');
    const aiInfoContent = aiDiv.querySelector('.ai-info-content');
    let t0 = performance.now();

    // COLLAPSIBLE LOGIC
   const aiHeader = aiDiv.querySelector('#ai-toggle-header');
const aiBtn = aiDiv.querySelector('#ai-toggle-btn');
const aiContent = aiDiv.querySelector('.ai-info-content');
let expanded = true;

// YALNIZCA BU
aiBtn.addEventListener('click', function(e) { e.stopPropagation(); toggleAI(); });

function toggleAI() {
  expanded = !expanded;
  if (expanded) {
    aiContent.style.maxHeight = "1200px";
    aiContent.style.opacity = "1";
    aiBtn.textContent = "▼";
  } else {
    aiContent.style.maxHeight = "0";
    aiContent.style.opacity = "0";
    aiBtn.textContent = "▲";
  }
}

    // Eğer localStorage'dan/parametreyle geldiyse API'ya gitmeden direkt göster!
    if (aiStaticInfo) {
        if (aiSpinner) aiSpinner.style.display = "none";
        aiSummary.textContent = aiStaticInfo.summary || "";
        aiTip.textContent = aiStaticInfo.tip || "";
        aiHighlight.textContent = aiStaticInfo.highlight || "";
        aiTime.textContent = "";
        return;
    }

    // API'dan AI içeriği çekilecek
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
                            if (typeof onFirstToken === "function") onFirstToken();
                        }
                    }
                } catch {}
            }
        }

        // JSON stringi al, kapanış } yoksa ekle
        let jsonStr = extractFirstJson(jsonText);
        if (jsonStr && jsonStr.trim().length > 0 && !jsonStr.trim().endsWith('}')) {
            jsonStr = jsonStr.trim() + '}';
        }
        try {
            const aiObj = JSON.parse(jsonStr);
            window.lastTripAIInfo = {
                summary: aiObj.summary || "",
                tip: aiObj.tip || "",
                highlight: aiObj.highlight || ""
            };
            if (typeof saveCurrentTripToStorage === "function") saveCurrentTripToStorage();

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