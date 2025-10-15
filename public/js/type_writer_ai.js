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

    try {
        const resp = await fetch('/llm-proxy/plan-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ city })
        });

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            aiContent.textContent += decoder.decode(value, { stream: true });
        }
    } catch (e) {
        aiContent.innerHTML = "<span style='color:red'>AI bilgi alınamadı.</span>";
    }
}