
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

// JSON stringten sadece ilk {...} bloğunu çek, kapanış } yoksa sona kadar alf
function extractFirstJson(str) {
    const start = str.indexOf('{');
    const end = str.lastIndexOf('}');
    if (start !== -1) {
        // Kapanış } yoksa sona kadar al
        return str.substring(start, (end !== -1 && end > start) ? end + 1 : undefined);
    }
    return "";
}
// insertTripAiInfo başına ek: global token
window.__aiInfoRequestToken = window.__aiInfoRequestToken || null;

window.insertTripAiInfo = async function(onFirstToken, aiStaticInfo = null, cityOverride = null) {
    // 1. Temizlik: Eski panelleri kaldır
    document.querySelectorAll('.ai-info-section').forEach(el => el.remove());

    const tripTitleDiv = document.getElementById('trip_title');
    if (!tripTitleDiv) return;

    const currentTripKey = window.activeTripKey;            // aktif gezi
    const currentCity    = window.selectedCity;

    let city = cityOverride || (window.selectedCity || '').replace(/ trip plan.*$/i, '').trim();
    let country = (window.selectedLocation && window.selectedLocation.country) || "";
    if (!city && !aiStaticInfo) return;

    // 2. Token Yönetimi
    const token = `${Date.now()}_${Math.random()}`;
    window.__aiInfoRequestToken = token;

    // 3. HTML İskeletini Oluştur
    const aiDiv = document.createElement('div');
    aiDiv.className = 'ai-info-section';
    aiDiv.innerHTML = `
      <h3 id="ai-toggle-header" style="display:flex;align-items:center;justify-content:space-between;">
        <span>AI Information</span>
        <span id="ai-spinner" style="margin-left:10px;display:inline-block;">
          <svg width="22" height="22" viewBox="0 0 40 40" style="vertical-align:middle;">
            <circle cx="20" cy="20" r="16" fill="none" stroke="#888" stroke-width="4" stroke-linecap="round" stroke-dasharray="80" stroke-dashoffset="60">
              <animateTransform attributeName="transform" type="rotate" repeatCount="indefinite" dur="1s" keyTimes="0;1" values="0 20 20;360 20 20"/>
            </circle>
          </svg>
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

    // Element Referansları
    const aiSummary   = aiDiv.querySelector('#ai-summary');
    const aiTip       = aiDiv.querySelector('#ai-tip');
    const aiHighlight = aiDiv.querySelector('#ai-highlight');
    const aiTime      = aiDiv.querySelector('.ai-info-time');
    const aiSpinner   = aiDiv.querySelector('#ai-spinner');
    const aiContent   = aiDiv.querySelector('.ai-info-content');

    // Yardımcı temizleme
    function cleanText(text) { return (text || "").replace(/🤖/g, '').replace(/AI:/g, '').trim(); }

    // --- İÇ FONKSİYON: POPULATE AND SHOW ---
    function populateAndShow(data, timeElapsed = null) {
        // Güvenlik kontrolleri
        if (token !== window.__aiInfoRequestToken) return;
        if (currentTripKey && window.activeTripKey !== currentTripKey) return;

        if (aiSpinner) aiSpinner.style.display = "none";

        // Veriyi kaydet
        const aiFullText = `Summary: ${data.summary || ""} \n\nTip: ${data.tip || ""} \n\nHighlight: ${data.highlight || ""}`;
        localStorage.setItem('ai_information', aiFullText);
        
        window.cart = window.cart || [];
        window.cart.aiData = data;
        window.lastTripAIInfo = data;

        // --- CSS EKLEME (OK İŞARETİ İÇİN) ---
        if (!document.getElementById('ai-arrow-style')) {
            const style = document.createElement('style');
            style.id = 'ai-arrow-style';
            style.innerHTML = `
                .arrow-icon {
                    transform: rotate(0deg); /* Kapalıyken SAĞA */
                    transition: transform 0.2s ease;
                    display: inline-block;
                }
                .arrow-icon.open {
                    transform: rotate(90deg); /* Açıkken AŞAĞI */
                }
            `;
            document.head.appendChild(style);
        }

        // --- BUTON OLUŞTURMA VE MANTIK ---
        if (!aiDiv.querySelector('#ai-toggle-btn')) {
            const btn = document.createElement('button');
            btn.id = "ai-toggle-btn";
            btn.className = "arrow-btn";
            btn.style = "border:none;background:transparent;font-size:18px;cursor:pointer;padding:0;display:flex;align-items:center;";
            // Varsayılan olarak 'open' class'ı ekliyoruz çünkü panel açık geliyor
            btn.innerHTML = `<img src="https://www.svgrepo.com/show/520912/right-arrow.svg" class="arrow-icon open" style="width:18px;">`;
            
            aiDiv.querySelector('#ai-toggle-header').appendChild(btn);
            
            const aiIcon = btn.querySelector('.arrow-icon');
            let expanded = true; // Başlangıç durumu açık

            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                expanded = !expanded;
                
                // Paneli aç/kapa
                aiContent.style.maxHeight = expanded ? "1200px" : "0";
                aiContent.style.opacity = expanded ? "1" : "0";
                
                // İkonu döndür
                if (expanded) {
                    aiIcon.classList.add('open'); // Aşağı
                } else {
                    aiIcon.classList.remove('open'); // Sağa
                }
            });
        }

        // İçeriği göster
        aiContent.style.maxHeight = "1200px";
        aiContent.style.opacity   = "1";

        // Metinleri bas
        aiSummary.textContent   = (data.summary || "").replace(/🤖/g, '').trim();
        aiTip.textContent       = (data.tip || "").replace(/🤖/g, '').trim();
        aiHighlight.textContent = (data.highlight || "").replace(/🤖/g, '').trim();
        aiTime.textContent      = timeElapsed ? `⏱️ Generated in ${timeElapsed} ms` : "";

        if (typeof saveCurrentTripToStorage === "function") {
            saveCurrentTripToStorage({ withThumbnail: false, delayMs: 0 });
        }
    }

    // 4. Veri Akışı (Statik veya Fetch)
    if (aiStaticInfo) {
        populateAndShow(aiStaticInfo, null);
        return;
    }

    const t0 = performance.now();
    try {
        const resp = await fetch('/plan-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ city, country })
        });
        const ollamaData = await resp.json();
        const elapsed = Math.round(performance.now() - t0);

        const aiData = {
            city,
            summary: ollamaData.summary,
            tip: ollamaData.tip,
            highlight: ollamaData.highlight,
            time: elapsed
        };

        populateAndShow(aiData, elapsed);
    } catch (e) {
        if (token === window.__aiInfoRequestToken && aiTime) {
            aiTime.innerHTML = "<span style='color:red'>AI info could not be retrieved.</span>";
            if (aiSpinner) aiSpinner.style.display = "none";
        }
        console.error("AI Error:", e);
    }
};