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
    // Eski AI info bölümünü sil (başlık altında birden fazla olmasın)
    document.querySelectorAll('.ai-info-section').forEach(el => el.remove());

    // Başlık divini bul
    const tripTitleDiv = document.getElementById('trip_title');
    if (!tripTitleDiv) return;

    // Şehir adını başlıktan veya window.selectedCity'den al
    const city = (window.selectedCity || tripTitleDiv.textContent || '')
      .replace(/ trip plan.*$/i, '').trim();
    if (!city) return;

    // Loading göstergesi ekle
    const aiDiv = document.createElement('div');
    aiDiv.className = 'ai-info-section';
    aiDiv.innerHTML = `
      <h3>AI Information</h3>
      <div class="ai-info-content"><span style="opacity:.6">Loading...</span></div>
    `;
    tripTitleDiv.insertAdjacentElement('afterend', aiDiv);

    // API çağrısı
    let aiInfo = { summary: '', tip: '', highlight: '' };
    let elapsed = 0;
    const t0 = performance.now();
    try {
        const resp = await fetch('/llm-proxy/plan-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ city })
        });
        aiInfo = await resp.json();
        // Backend süreyi dönüyorsa onu kullan, yoksa hesapla
        elapsed = aiInfo.elapsedMs || Math.round(performance.now() - t0);
    } catch {
        elapsed = Math.round(performance.now() - t0);
    }

    aiDiv.innerHTML = `
      <h3>AI Information</h3>
      <div class="ai-info-content">
        <p><b>🧳 Summary:</b> ${aiInfo.summary || "—"}</p>
        <p><b>👉 Tip:</b> ${aiInfo.tip || "—"}</p>
        <p><b>🔆 Highlight:</b> ${aiInfo.highlight || "—"}</p>
        <p style="opacity:.6;font-size:13px;margin-top:8px;">⏱️ AI yanıt süresi: ${elapsed} ms</p>
      </div>
    `;

    // (İsteğe bağlı) Typewriter efekti uygula
    const aiContent = aiDiv.querySelector('.ai-info-content');
    if (aiContent && typeof typeWriterEffect === "function") {
        const html = aiContent.innerHTML;
        aiContent.innerHTML = "";
        typeWriterEffect(aiContent, html, 18);
    }
}