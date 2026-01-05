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
// insertTripAiInfo başına ek: global token
window.__aiInfoRequestToken = window.__aiInfoRequestToken || null;

window.insertTripAiInfo = async function(onFirstToken, aiStaticInfo = null, cityOverride = null) {
    document.querySelectorAll('.ai-info-section').forEach(el => el.remove());

    const tripTitleDiv = document.getElementById('trip_title');
    if (!tripTitleDiv) return;

    const currentTripKey = window.activeTripKey;           // aktif gezi
    const currentCity    = window.selectedCity;

    let city = cityOverride || (window.selectedCity || '').replace(/ trip plan.*$/i, '').trim();
    let country = (window.selectedLocation && window.selectedLocation.country) || "";
    if (!city && !aiStaticInfo) return;

    // Yeni istek için token üret
    const token = `${Date.now()}_${Math.random()}`;
    window.__aiInfoRequestToken = token;

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

    const aiSummary  = aiDiv.querySelector('#ai-summary');
    const aiTip      = aiDiv.querySelector('#ai-tip');
    const aiHighlight= aiDiv.querySelector('#ai-highlight');
    const aiTime     = aiDiv.querySelector('.ai-info-time');
    const aiSpinner  = aiDiv.querySelector('#ai-spinner');
    const aiContent  = aiDiv.querySelector('.ai-info-content');

    function cleanText(text) { return (text || "").replace(/🤖/g, '').replace(/AI:/g, '').trim(); }

    function populateAndShow(data, timeElapsed = null) {
        // Yanıt geldiğinde hâlâ aynı trip ve aynı token mı?
        if (token !== window.__aiInfoRequestToken) return;
        if (currentTripKey && window.activeTripKey !== currentTripKey) return;

        if (aiSpinner) aiSpinner.style.display = "none";

        // toggle butonu ekle (mevcut kod aynen)
        if (!aiDiv.querySelector('#ai-toggle-btn')) {
            const btn = document.createElement('button');
            btn.id = "ai-toggle-btn";
            btn.className = "arrow-btn";
            btn.style = "border:none;background:transparent;font-size:18px;cursor:pointer;padding:0 10px;";
            btn.innerHTML = `<img src="https://www.svgrepo.com/show/520912/right-arrow.svg" class="arrow-icon open" style="width:18px;vertical-align:middle;transition:transform 0.2s;">`;
            aiDiv.querySelector('#ai-toggle-header').appendChild(btn);
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
            if (aiIcon) aiIcon.classList.add('open');
        }

        aiContent.style.maxHeight = "1200px";
        aiContent.style.opacity   = "1";

        const txtSummary   = cleanText(data.summary)   || "Info not available.";
        const txtTip       = cleanText(data.tip)       || "Info not available.";
        const txtHighlight = cleanText(data.highlight) || "Info not available.";

        aiSummary.textContent   = txtSummary;
        aiTip.textContent       = txtTip;
        aiHighlight.textContent = txtHighlight;
        aiTime.textContent      = timeElapsed ? `⏱️ Generated in ${timeElapsed} ms` : "";

        // Sonuçları sadece doğru trip için kaydet
        if (currentTripKey && window.activeTripKey === currentTripKey) {
            window.cart = window.cart || [];
            window.cart.aiData = data;
            window.lastTripAIInfo = data;
            if (typeof saveCurrentTripToStorage === "function") saveCurrentTripToStorage({ withThumbnail: false, delayMs: 0 });
        }
    }

    // Statik veri varsa doğrudan bas
    if (aiStaticInfo) {
        populateAndShow(aiStaticInfo, null);
        return;
    }

    // API çağrısı
    const t0 = performance.now();
    try {
        const resp = await fetch('/llm-proxy/plan-summary', {
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
        // Hata olursa, token kontrolü yine de gerekli
        if (token === window.__aiInfoRequestToken && aiTime) {
            aiTime.innerHTML = "<span style='color:red'>AI info could not be retrieved.</span>";
            if (aiSpinner) aiSpinner.style.display = "none";
        }
        console.error("AI Error:", e);
    }
};

// === AI MAP INTERACTION START ===

// 1. Koordinattan sadece Şehir ve Ülke bilgisini çeker
// 1. Koordinattan Hiyerarşik Konum Bilgisi Çeker (Köy > İlçe > İl > Ülke)
async function getCityFromCoordinates(lat, lng) {
    try {
        const resp = await fetch(`/api/geoapify/reverse?lat=${lat}&lon=${lng}&limit=1`);
        if (!resp.ok) return null;
        
        const data = await resp.json();
        if (data.features && data.features.length > 0) {
            const props = data.features[0].properties;
            
            // --- HİYERARŞİ MANTIĞI ---
            // Geoapify'den gelen verileri güvenli bir zincire oturtuyoruz.
            
            let parts = [];

            // 1. ADIM: En alt birim (Köy, Mahalle veya Turistik Yer Adı)
            // Eğer 'name' varsa ve bu bir sokak adı değilse (bazen cadde adı gelebilir, bunu engellemek lazım ama basit tutalım)
            // Genelde 'suburb' (mahalle) veya 'village' daha güvenlidir.
            if (props.name && props.name !== props.county && props.name !== props.city) {
                 parts.push(props.name); 
            }

            // 2. ADIM: İlçe (County)
            if (props.county) {
                parts.push(props.county);
            } else if (props.city && props.city !== props.state) {
                // Bazen ilçe bilgisi 'city' içinde gelir
                parts.push(props.city);
            }

            // 3. ADIM: İl / Eyalet (State)
            if (props.state) {
                // Eğer İlçe ismi ile İl ismi aynıysa (Örn: Denizli Merkez), tekrar ekleme.
                const lastPart = parts[parts.length - 1];
                if (lastPart !== props.state) {
                    parts.push(props.state);
                }
            }

            // 4. ADIM: Ülke
            const country = props.country || "Turkey";
            // Ülkeyi string'e eklemiyoruz, onu ayrı parametre olarak tutacağız ama
            // AI'ya giden tam metinde kullanacağız.

            // Sonuç String'i Oluştur: "Merkezefendi, Denizli" veya "Aksu, Isparta"
            const fullLocationName = parts.join(", ");

            return { 
                name: fullLocationName, // Örn: "Şirince, Selçuk, İzmir"
                country: country 
            };
        }
    } catch (e) {
        console.error("City fetch error:", e);
    }
    return null;
}

// 2. Harita Tıklama Olayı (Expanded Map için)
// 2. Harita Tıklama Olayı (Güncellenmiş)
async function handleMapAIClick(e) {
    const map = e.target;
    const { lat, lng } = e.latlng;

    // A) Spinner Popup
    const popup = L.popup()
        .setLatLng([lat, lng])
        .setContent(`
            <div style="text-align:center; padding:10px; min-width:180px;">
                <div class="spinner" style="display:inline-block; width:12px; height:12px; border:2px solid #ccc; border-top-color:#8a4af3; border-radius:50%; animation:spin 1s linear infinite;"></div>
                <span style="margin-left:8px; font-weight:600; color:#555; font-size:0.9rem;">Konum Analiz Ediliyor...</span>
            </div>
        `)
        .openOn(map);

    // B) Hiyerarşik Konumu Bul
    const locationData = await getCityFromCoordinates(lat, lng);
    
    if (!locationData || !locationData.name) {
        popup.setContent('<div style="color:#d32f2f; padding:5px;">Konum bilgisi alınamadı.</div>');
        return;
    }

    console.log("📍 AI Sorulacak Konum:", locationData.name, locationData.country);

    // C) AI Servisine Sor
    // Backend'de kod değişikliği yapmamak için 'city' parametresine
    // "Merkezefendi, Denizli" gibi tam string'i gönderiyoruz.
    try {
        const response = await fetch('/llm-proxy/plan-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                city: locationData.name, // Örn: "Aksu, Antalya" gider
                country: locationData.country 
            })
        });
        
        if (!response.ok) throw new Error("AI Busy");
        const aiData = await response.json();

        // D) Popup İçeriği
        const aiContent = `
            <div class="ai-map-popup" style="max-width:300px; font-family:'Satoshi', sans-serif;">
                <h3 style="margin:0 0 10px 0; padding-bottom:8px; border-bottom:1px solid #eee; display:flex; align-items:center; gap:6px; color:#1e293b; font-size:1rem;">
                    📍 ${locationData.name}
                </h3>
                <div style="font-size:0.9rem; line-height:1.5; color:#475569;">
                    <p style="margin-bottom:8px;"><b>📝 Özet:</b> ${aiData.summary || 'Özet bulunamadı.'}</p>
                    <p style="margin-bottom:8px;"><b>💡 İpucu:</b> ${aiData.tip || 'İpucu yok.'}</p>
                    <p style="margin:0;"><b>✨ Öne Çıkan:</b> ${aiData.highlight || ''}</p>
                </div>
                <div style="margin-top:8px; font-size:0.7rem; color:#94a3b8; text-align:right;">
                    AI tarafından oluşturuldu
                </div>
            </div>
        `;
        popup.setContent(aiContent);

    } catch (err) {
        console.error(err);
        popup.setContent('<div style="color:#d32f2f; padding:5px;">AI yanıt vermedi. Tekrar deneyin.</div>');
    }
}
// === AI MAP INTERACTION END ===