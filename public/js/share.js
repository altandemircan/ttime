/**
 * share.js - THE FINAL ULTIMATE VERSION
 * Created with triptime.ai!
 */

// --- 1. MODERN LOADING UI ---
function showGlobalLoading() {
    let loader = document.getElementById('trip-loader');
    if (!loader) {
        const messages = [
            "AI is crafting your perfect route...",
            "Checking local gems for you...",
            "Organizing your travel days...",
            "Almost ready for takeoff!"
        ];
        const randomMsg = messages[Math.floor(Math.random() * messages.length)];

        loader = document.createElement('div');
        loader.id = 'trip-loader';
        loader.innerHTML = `
            <div class="loader-card">
                <div class="loader-header">
                    <img src="/img/triptime_logo.svg" class="main-logo" alt="Triptime AI">
                </div>
                
                <div class="loader-body">
                    <div class="progress-container">
                        <div class="progress-bar-fill"></div>
                    </div>
                    <p class="loading-text">${randomMsg}</p>
                </div>
            </div>

            <style>
                #trip-loader {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: #f8f9fa; /* Arkadaki hizasızlığı kapatan solid fon */
                    z-index: 9999999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                }

                .loader-card {
                    background: #ffffff;
                    padding: 40px 30px;
                    border-radius: 24px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.05);
                    text-align: center;
                    width: 90%;
                    max-width: 360px;
                    animation: cardEntrance 0.5s ease-out;
                }

                .loader-header {
                    margin-bottom: 25px;
                }

                .main-logo {
                    width: 200px; 
                    height: auto;
                    display: block;
                    margin: 0 auto;
                }

                .progress-container {
                    width: 100%;
                    height: 6px;
                    background: #f0f0f2;
                    border-radius: 10px;
                    overflow: hidden;
                    margin-bottom: 15px;
                    position: relative;
                }

                .progress-bar-fill {
                    width: 40%;
                    height: 100%;
                    background: #8a4af3; /* İstediğin mor tonu */
                    border-radius: 10px;
                    position: absolute;
                    left: -40%;
                    animation: loading-slide 1.4s infinite cubic-bezier(0.45, 0, 0.55, 1);
                }

                .loading-text {
                    font-size: 14px;
                    color: #666;
                    margin: 0;
                    font-weight: 500;
                }

                @keyframes loading-slide {
                    0% { left: -40%; width: 30%; }
                    50% { width: 50%; }
                    100% { left: 100%; width: 30%; }
                }

                @keyframes cardEntrance {
                    from { opacity: 0; transform: translateY(15px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            </style>
        `;
        document.body.appendChild(loader);
    }
}
function hideGlobalLoading() {
    const loader = document.getElementById('trip-loader');
    if (loader) {
        loader.style.transition = "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)";
        loader.style.opacity = "0";
        loader.style.transform = "scale(1.1)";
        setTimeout(() => { if(loader) loader.remove(); }, 600);
    }
}

// --- 2. SAYFA YÜKLENDİĞİNDE VERİ ÇÖZÜCÜ ---
// --- PAYLAŞIM LİNKİNDEN TARİH PARSE ETME ---
// share.js'deki DOMContentLoaded event'inin içine ekle

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const v2Raw = params.get('v2');
    if (!v2Raw) return;

    showGlobalLoading();

    try {
        const decoded = decodeURIComponent(v2Raw);
        const parts = decoded.split('|');
        
        const title = parts[0];
        const itemsStr = parts[1];
        const aiStr = parts[2];
        const cityStr = parts[3];
        const dateStr = parts[4]; // YENİ: Tarih bilgisi

        // 1. Şehir Planı Verileri
        if (itemsStr) {
            const rawItems = itemsStr.split('*');
            window.cart = rawItems.map(str => {
                const p = str.split(',');
                if (p.length < 3) return null;
                return {
                    name: p[0], lat: parseFloat(p[1]), lng: parseFloat(p[2]),
                    location: { lat: parseFloat(p[1]), lng: parseFloat(p[2]) },
                    day: parseInt(p[3]) || 1, image: p[4] === '0' ? 'default' : p[4],
                    category: "Place"
                };
            }).filter(item => item !== null);
        }

        // 2. AI Verisi
        if (aiStr && aiStr !== "") {
            const [s, t, h] = aiStr.split('~');
            window.sharedAiStaticInfo = { summary: s, tip: t, highlight: h };
        }

        // 3. Şehir Verisi
        if (cityStr) {
            window.sharedCityForCollage = cityStr;
            window.selectedCity = cityStr;
        }

        // 4. TARİH PARSE ETME (YENİ)
        if (dateStr && dateStr.trim() !== "") {
            const startDateStr = dateStr.replace(/-/g, '/'); // 1-14-2026 -> 1/14/2026
            
            if (window.cart && window.cart.length > 0) {
                const maxDay = Math.max(...window.cart.map(i => i.day || 1));
                const startDate = new Date(startDateStr);
                const endDates = [];
                
                for (let i = 0; i < maxDay; i++) {
                    const d = new Date(startDate);
                    d.setDate(d.getDate() + i);
                    endDates.push(d.toLocaleDateString());
                }
                
                // Cart'a tarihleri ata
                window.cart.startDate = startDate.toLocaleDateString();
                window.cart.endDates = endDates;
            }
        }

        localStorage.setItem('cart', JSON.stringify(window.cart));
        if (document.getElementById('trip_title')) document.getElementById('trip_title').innerText = title;

        let attempts = 0;
        const checkReady = setInterval(() => {
            attempts++;
            const isCartReady = typeof updateCart === 'function';
            const isCollageReady = typeof window.renderDayCollage === 'function';

            if (isCartReady || attempts > 50) { 
                clearInterval(checkReady);
                try {
                    if (isCartReady) updateCart();

                    if (window.sharedAiStaticInfo && typeof insertTripAiInfo === 'function') {
                        insertTripAiInfo(null, window.sharedAiStaticInfo);
                    }

                    if (window.sharedCityForCollage && isCollageReady) {
                        const maxDay = Math.max(1, ...(window.cart || []).map(it => it.day || 1));
                        console.log("Slider tetikleniyor: ", window.sharedCityForCollage);
                        
                        for (let d = 1; d <= maxDay; d++) {
                            const dayContainer = document.querySelector(`.day-section[data-day="${d}"]`) || 
                                               document.querySelector(`#day-${d}`);
                            
                            if (dayContainer) {
                                const dayItems = window.cart.filter(item => item.day === d);
                                window.renderDayCollage(d, dayContainer, dayItems);
                            }
                        }
                    }

                    const overlay = document.getElementById('sidebar-overlay-trip');
                    if (overlay) overlay.classList.add('open');
                } catch(e) { console.error("Load Error:", e); }
                
                setTimeout(() => {
                    hideGlobalLoading();
                    if (window.map) window.map.invalidateSize();
                }, 800);
            }
        }, 300);

    } catch (e) { 
        console.error("Critical Load Error:", e);
        hideGlobalLoading();
    }
});
// --- 3. PAYLAŞIM FONKSİYONLARI ---
function createOptimizedLongLink() {
    const title = (document.getElementById('trip_title')?.innerText || "Trip").replace(/[|*~,]/g, '');
    const items = (window.cart || []).map(item => {
        const name = (item.name || "Place").replace(/[|*~,]/g, ''); 
        const lat = parseFloat(item.lat || item.location?.lat || 0).toFixed(4);
        const lng = parseFloat(item.lng || item.location?.lng || 0).toFixed(4);
        const imgPath = (item.image && item.image !== 'default') ? item.image : '0';
        return `${name},${lat},${lng},${item.day || 1},${imgPath}`;
    }).join('*');

    let aiPart = "";
    const aiSummaryText = window.lastTripAIInfo?.summary || document.getElementById('ai-summary')?.innerText;
    if (aiSummaryText) {
        const s = aiSummaryText.replace(/[|*~]/g, '').trim();
        const t = (window.lastTripAIInfo?.tip || document.getElementById('ai-tip')?.innerText || "").replace(/[|*~]/g, '').trim();
        const h = (window.lastTripAIInfo?.highlight || document.getElementById('ai-highlight')?.innerText || "").replace(/[|*~]/g, '').trim();
        aiPart = `|${s}~${t}~${h}`;
    } else { aiPart = "|"; }

    const targetCity = window.selectedCity || (window.cart && window.cart[0] ? window.cart[0].name : "");
    const collagePart = targetCity ? `|${targetCity.replace(/[|*~,]/g, '')}` : "";

    return `${window.location.origin}${window.location.pathname}?v2=${encodeURIComponent(title + '|' + items + aiPart + collagePart)}`;
}

// ... [shareOnWhatsApp fonksiyonu aynı kalsın, createOptimizedLongLink'i otomatik kullanacak zaten] ...
async function generateShareableText() {
    const longUrl = createOptimizedLongLink();
    let shortUrl = longUrl;
    try {
        const apiTarget = `https://tinyurl.com/api-create?url=${encodeURIComponent(longUrl)}`;
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(apiTarget)}`);
        const data = await res.json();
        if (data.contents && data.contents.startsWith('http')) shortUrl = data.contents;
    } catch(e) {}
    return `Check out my trip plan: ${shortUrl}\n\nCreated with triptime.ai!`;
}

// --- 3. PAYLAŞIM FONKSİYONLARI ---
async function shareOnWhatsApp() {
    console.log("WhatsApp tetiklendi...");
    
    let shareText = "Check out my trip plan!\n\n";
    const maxDay = Math.max(0, ...window.cart.map(item => item.day || 0));

    for (let day = 1; day <= maxDay; day++) {
        const dayItems = window.cart.filter(item => item.day == day && item.name);
        if (dayItems.length > 0) {
            shareText += `--- Day ${day} ---\n`;
            dayItems.forEach(item => { shareText += `• ${item.name}\n`; });
            shareText += "\n";
        }
    }

    const longUrl = createOptimizedLongLink();
    let shortUrl = longUrl;

    // KENDİ SERVİSİMİZİ KULLANIYORUZ
    try {
        const response = await fetch('/api/shorten', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ longUrl: longUrl })
        });
        
        if (response.ok) {
            const result = await response.json();
            shortUrl = result.shortUrl;
        }
    } catch (e) {
        console.warn("Kendi kısaltma servisimiz cevap vermedi, uzun linkle devam ediliyor.");
    }

    shareText += `View full plan: ${shortUrl}\n\nCreated with triptime.ai!`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
}

// ===== 1. MODAL - Share öncesi tarih seçimi =====
function showDatePickerBeforeShare() {
    const maxDay = Math.max(1, ...(window.cart.map(i => i.day || 1)));
    
    const modal = document.createElement('div');
    modal.id = 'date-picker-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 12px; padding: 30px; max-width: 400px; width: 90%; max-height: 80vh; overflow-y: auto;">
            <h3 style="margin-top: 0; color: #333;">When is your trip?</h3>
            <p style="color: #666; font-size: 14px;">Select start date for your ${maxDay}-day journey</p>
            
            <div id="modal-calendar-container" style="margin: 20px 0;"></div>
            
            <div style="display: flex; gap: 12px; margin-top: 20px;">
                <button onclick="closeShareModal()" style="flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; background: #f5f5f5; font-weight: 500;">
                    Cancel
                </button>
                <button id="modal-share-btn" onclick="confirmShareWithDates()" style="flex: 1; padding: 12px; border: none; border-radius: 8px; cursor: pointer; background: #d32f2f; color: white; font-weight: 600; opacity: 0.5;" disabled>
                    Share
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Mini takvim render et
    renderModalCalendar(maxDay);
}

// ===== 2. Modal takvimi render et =====
function renderModalCalendar(tripDuration) {
    const container = document.getElementById('modal-calendar-container');
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    let html = `
        <div style="margin-bottom: 15px; text-align: center; font-weight: 600; color: #333;">
            ${new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px;">
    `;
    
    // Boş günler
    for (let i = 0; i < startingDay; i++) {
        html += `<div></div>`;
    }
    
    // Ayın günleri
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentYear, currentMonth, day);
        const isToday = date.toDateString() === now.toDateString();
        const isPast = date < now;
        
        html += `
            <div onclick="${!isPast ? `selectModalDate(${day}, ${currentMonth}, ${currentYear}, ${tripDuration})` : ''}" 
                 style="
                    padding: 10px;
                    text-align: center;
                    border-radius: 6px;
                    cursor: ${isPast ? 'not-allowed' : 'pointer'};
                    background: ${isToday ? '#e8f5e9' : '#f5f5f5'};
                    opacity: ${isPast ? 0.4 : 1};
                    border: 2px solid transparent;
                    transition: all 0.2s;
                    font-weight: 500;
                 "
                 class="modal-date-btn"
                 data-date="${date.toISOString()}">
                ${day}
            </div>
        `;
    }
    
    html += `</div>`;
    container.innerHTML = html;
}

// ===== 3. Modal'da tarih seç =====
function selectModalDate(day, month, year, tripDuration) {
    const selectedDate = new Date(year, month, day);
    if (selectedDate < new Date()) return;
    
    // Eski seçimi kaldır
    document.querySelectorAll('.modal-date-btn').forEach(btn => {
        btn.style.borderColor = 'transparent';
        btn.style.background = '#f5f5f5';
    });
    
    // Yeni seçimi işaretle
    const selectedBtn = document.querySelector(`[data-date="${selectedDate.toISOString()}"]`);
    if (selectedBtn) {
        selectedBtn.style.borderColor = '#d32f2f';
        selectedBtn.style.background = '#fff5f5';
    }
    
    // Global variable'a kaydet
    window.modalSelectedStartDate = selectedDate.toLocaleDateString();
    window.modalSelectedEndDates = [];
    
    for (let i = 0; i < tripDuration; i++) {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + i);
        window.modalSelectedEndDates.push(d.toLocaleDateString());
    }
    
    // Share butonunu aktif et
    const shareBtn = document.getElementById('modal-share-btn');
    if (shareBtn) {
        shareBtn.disabled = false;
        shareBtn.style.opacity = '1';
    }
}

// ===== 4. Modal'ı kapat =====
function closeShareModal() {
    const modal = document.getElementById('date-picker-modal');
    if (modal) modal.remove();
    window.modalSelectedStartDate = null;
    window.modalSelectedEndDates = null;
}

// ===== 5. Tarihlerle birlikte share =====
async function confirmShareWithDates() {
    if (!window.modalSelectedStartDate) {
        alert('Please select a date');
        return;
    }
    
    // window.cart'a tarihleri kaydet
    window.cart.startDate = window.modalSelectedStartDate;
    window.cart.endDates = window.modalSelectedEndDates;
    
    // Modal'ı kapat
    closeShareModal();
    
    // Share linkini oluştur (tarihler dahil)
    const url = createOptimizedLongLink();
    
    // Share mekanizmasını başlat
    let shareText = `Check out my trip plan!\n`;
    shareText += `📅 ${window.modalSelectedStartDate} - ${window.modalSelectedEndDates[window.modalSelectedEndDates.length - 1]}\n\n`;
    
    const maxDay = Math.max(0, ...window.cart.map(item => item.day || 0));
    for (let day = 1; day <= maxDay; day++) {
        const dayItems = window.cart.filter(item => item.day == day && item.name);
        if (dayItems.length > 0) {
            shareText += `--- Day ${day} ---\n`;
            dayItems.forEach(item => { shareText += `• ${item.name}\n`; });
            shareText += "\n";
        }
    }
    
    let shortUrl = url;
    try {
        const response = await fetch('/api/shorten', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ longUrl: url })
        });
        if (response.ok) {
            const result = await response.json();
            shortUrl = result.shortUrl;
        }
    } catch (e) {
        console.warn("URL shortening failed, using long URL");
    }
    
    shareText += `View full plan: ${shortUrl}\n\nCreated with triptime.ai!`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
}

// ===== createOptimizedLongLink'i GÜNCELLE - Tarih ekle =====
// (Eski fonksiyonu şu şekilde güncelle:)
function createOptimizedLongLink() {
    const title = (document.getElementById('trip_title')?.innerText || "Trip").replace(/[|*~,]/g, '');
    const items = (window.cart || []).map(item => {
        const name = (item.name || "Place").replace(/[|*~,]/g, ''); 
        const lat = parseFloat(item.lat || item.location?.lat || 0).toFixed(4);
        const lng = parseFloat(item.lng || item.location?.lng || 0).toFixed(4);
        const imgPath = (item.image && item.image !== 'default') ? item.image : '0';
        return `${name},${lat},${lng},${item.day || 1},${imgPath}`;
    }).join('*');

    let aiPart = "";
    const aiSummaryText = window.lastTripAIInfo?.summary || document.getElementById('ai-summary')?.innerText;
    if (aiSummaryText) {
        const s = aiSummaryText.replace(/[|*~]/g, '').trim();
        const t = (window.lastTripAIInfo?.tip || document.getElementById('ai-tip')?.innerText || "").replace(/[|*~]/g, '').trim();
        const h = (window.lastTripAIInfo?.highlight || document.getElementById('ai-highlight')?.innerText || "").replace(/[|*~]/g, '').trim();
        aiPart = `|${s}~${t}~${h}`;
    } else { aiPart = "|"; }

    const targetCity = window.selectedCity || (window.cart && window.cart[0] ? window.cart[0].name : "");
    const collagePart = targetCity ? `|${targetCity.replace(/[|*~,]/g, '')}` : "";
    
    // TAR İH EKLE (Eğer varsa)
    let datePart = "";
    if (window.cart.startDate) {
        const encodedStartDate = window.cart.startDate.replace(/\//g, '-');
        datePart = `|${encodedStartDate}`;
    }

    return `${window.location.origin}${window.location.pathname}?v2=${encodeURIComponent(title + '|' + items + aiPart + collagePart + datePart)}`;
}