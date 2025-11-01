// Typewriter efekti, her harf için delay uygular
function typeWriterEffect(element, text, speed = 18, callback) {
    let i = 0;
    element.innerHTML = "🤖 "; // Emoji sabit başta!
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
async function insertTripAiInfo(onFirstToken, aiStaticInfo = null, cityOverride = null) {
    // Önce eski kutuları temizle
    document.querySelectorAll('.ai-info-section').forEach(el => el.remove());
    const tripTitleDiv = document.getElementById('trip_title');
    if (!tripTitleDiv) return;

    let city = cityOverride || (window.selectedCity || '').replace(/ trip plan.*$/i, '').trim();
    let country = (window.selectedLocation && window.selectedLocation.country) || "";
    if (!city && !aiStaticInfo) return;

    // --- 1) İlk başta sadece spinner ve başlık var, ok YOK ---
    const aiDiv = document.createElement('div');
    aiDiv.className = 'ai-info-section';
    aiDiv.innerHTML = `
<h3 id="ai-toggle-header" style="display:flex;align-items:center;justify-content:space-between;">
  <span>AI Information</span>
  <span id="ai-spinner" style="margin-left:10px;display:inline-block;">
    <svg width="22" height="22" viewBox="0 0 40 40" style="vertical-align:middle;"><circle cx="20" cy="20" r="16" fill="none" stroke="#888" stroke-width="4" stroke-linecap="round" stroke-dasharray="80" stroke-dashoffset="60"><animateTransform attributeName="transform" type="rotate" repeatCount="indefinite" dur="1s" keyTimes="0;1" values="0 20 20;360 20 20"/></circle></svg>
  </span>
</h3>
<div class="ai-info-content" style="max-height:0;opacity:0;overflow:hidden;transition:max-height 0.2s,opacity 0.2s;">
  <p><b>🧳 Summary:</b> <span id="ai-summary"></span></p>
  <p><b>👉 Tip:</b> <span id="ai-tip"></span></p>
  <p><b>🔆 Highlight:</b> <span id="ai-highlight"></span></p>
</div>
<div class="ai-info-time" style="opacity:.6;font-size:13px;"></div>
`;
    tripTitleDiv.insertAdjacentElement('afterend', aiDiv);

    // Seçiciler
    const aiSummary = aiDiv.querySelector('#ai-summary');
    const aiTip = aiDiv.querySelector('#ai-tip');
    const aiHighlight = aiDiv.querySelector('#ai-highlight');
    const aiTime = aiDiv.querySelector('.ai-info-time');
    const aiSpinner = aiDiv.querySelector('#ai-spinner');
    const aiContent = aiDiv.querySelector('.ai-info-content');
    let t0 = performance.now();

    // === 2) EĞER LOCALSTORAGE'DAN GELİYORSA: Spinnerı gizle, ok ekle, içerik aç ===
    if (aiStaticInfo) {
        if (aiSpinner) aiSpinner.style.display = "none";
        // OK'u ekle
        const header = aiDiv.querySelector('#ai-toggle-header');
        const btn = document.createElement('button');
        btn.id = "ai-toggle-btn";
        btn.className = "arrow-btn";
        btn.style = "border:none;background:transparent;font-size:18px;cursor:pointer;padding:0 10px;";
        btn.innerHTML = `<img src="https://www.svgrepo.com/show/520912/right-arrow.svg" class="arrow-icon open" style="width:18px;vertical-align:middle;transition:transform 0.2s;">`;
        header.appendChild(btn);

        // COLLAPSE LOGIC
        const aiIcon = btn.querySelector('.arrow-icon');
        let expanded = true;
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            expanded = !expanded;
            if (expanded) {
                aiContent.style.maxHeight = "1200px";
                aiContent.style.opacity = "1";
                aiIcon.classList.add('open');
            } else {
                aiContent.style.maxHeight = "0";
                aiContent.style.opacity = "0";
                aiIcon.classList.remove('open');
            }
        });

        aiContent.style.maxHeight = "1200px";
        aiContent.style.opacity = "1";
        if (aiIcon) aiIcon.classList.add('open');
        aiSummary.textContent = aiStaticInfo.summary || "";
        aiTip.textContent = aiStaticInfo.tip || "";
        aiHighlight.textContent = aiStaticInfo.highlight || "";
        aiTime.textContent = "";
        return;
    }

    // === 3) API'dan veri çekiliyor: loading anında sadece spinner var ===
    let jsonText = "";
    let firstChunkWritten = false;
   try {
        const resp = await fetch('/llm-proxy/plan-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ city, country })
        });

        // Streaming yok, direkt JSON oku:
        const ollamaData = await resp.json();

        // DOĞRU: JSON alanlarını doğrudan kullan!
        let aiObj = ollamaData; // Artık JSON.parse gerek yok!

        window.lastTripAIInfo = {
            summary: aiObj.summary || "Bilgi yok.",
            tip: aiObj.tip || "Bilgi yok.",
            highlight: aiObj.highlight || "Bilgi yok."
        };

        // Spinnerı gizle, kutuya yaz!
        if (aiSpinner) aiSpinner.style.display = "none";
        aiContent.style.maxHeight = "1200px";
        aiContent.style.opacity = "1";

        typeWriterEffect(aiSummary, aiObj.summary || "Bilgi yok.", 18, function() {
            typeWriterEffect(aiTip, aiObj.tip || "Bilgi yok.", 18, function() {
                typeWriterEffect(aiHighlight, aiObj.highlight || "Bilgi yok.", 18);
            });
        });

        let elapsed = Math.round(performance.now() - t0);
        if (aiTime) aiTime.textContent = `⏱️ AI yanıt süresi: ${elapsed} ms`;
    } catch (e) {
        if (aiTime) aiTime.innerHTML = "<span style='color:red'>AI bilgi alınamadı.</span>";
        // Kutuda hata göster
        aiSummary.textContent = aiTip.textContent = aiHighlight.textContent = "AI çıktısı çözülemedi!";
    }
}