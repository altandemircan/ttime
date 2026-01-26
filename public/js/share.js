/**
 * share.js - COMPLETE VERSION WITH DATE PICKER MODAL
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
                    background: #f8f9fa;
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
                    background: #8a4af3;
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

// --- 2. PAYLAŞIM LİNKİNDEN TARİH PARSE ETME ---
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
        const dateStr = parts[4];

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

        // 4. TARİH PARSE ETME
       if (dateStr && dateStr.trim() !== "") {
            const startDateStr = dateStr.replace(/-/g, '/');
            
            if (window.cart && window.cart.length > 0) {
                const maxDay = Math.max(...window.cart.map(i => i.day || 1));
                const startDate = new Date(startDateStr);
                const endDates = [];
                
                for (let i = 0; i < maxDay; i++) {
                    const d = new Date(startDate);
                    d.setDate(d.getDate() + i);
                    endDates.push(d.toLocaleDateString());
                }
                
              window.cart.startDate = startDate.toLocaleDateString();
                window.cart.endDates = endDates;

                // EKLEMEN GEREKEN SATIR:
                localStorage.setItem('tripStartDate', window.cart.startDate);
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

// --- 3. SHARE LINK OLUŞTURMA ---
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
    
    let datePart = "";
    if (window.cart && window.cart.startDate) {
        const encodedStartDate = window.cart.startDate.replace(/\//g, '-');
        datePart = `|${encodedStartDate}`;
    }

    return `${window.location.origin}${window.location.pathname}?v2=${encodeURIComponent(title + '|' + items + aiPart + collagePart + datePart)}`;
}

// --- 4. MODAL - İki Aşamalı Share ---
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
        padding: 20px;
    `;
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 16px; padding: 32px 24px; max-width: 360px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.15);">
            <div id="share-step-1" style="display: block;">
                <h3 style="margin: 0 0 12px 0; color: #1a1a1a; font-size: 20px; font-weight: 700;">Share your plan</h3>
                <p style="margin: 0 0 24px 0; color: #666; font-size: 14px; line-height: 1.5;">Help others discover amazing places</p>
                
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <button onclick="shareWithoutDates()" style="padding: 10px;
    margin-top: 0px;
    font-weight: 600;
    align-items: center;
    justify-content: center;
    border: 1px solid #ffffff;
    border-radius: 8px;
    background: #8a4af3;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 0.9rem;
    color: #ffffff;
    cursor: default;
    width: -webkit-fill-available;">
                        Just share
                    </button>
                    <button onclick="showDateStep()" style="    border: 1px solid #e0e0e0;
    background: white;
    color: #1a1a1a;
    padding: 10px;
    margin-top: 0px;
    font-weight: 600;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    transition: all 0.3s ease;
    font-size: 0.9rem;
    cursor: default;
    width: -webkit-fill-available;">
                        Add dates
                    </button>
                </div>
                
                <button onclick="closeShareModal()" style="margin-top: 12px;
    border: none;
    background: #faf8ff;
    color: #1a1a1a;
    padding: 10px;
    font-weight: 600;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    transition: all 0.3s ease;
    font-size: 0.9rem;
    cursor: default;
    width: -webkit-fill-available;">
                    Cancel
                </button>
            </div>
            
            <div id="share-step-2" style="display: none;">
                <button onclick="backToStep1()" style="background: none; border: none; color: #8a4af3; font-weight: 600; font-size: 14px; cursor: pointer; padding: 0 0 16px 0; display: flex; align-items: center; gap: 6px;">
                    ← Back
                </button>
                
                <h3 style="margin: 0 0 12px 0; color: #1a1a1a; font-size: 18px; font-weight: 700;">When is your trip?</h3>
                <p style="margin: 0 0 20px 0; color: #666; font-size: 13px;">Select start date for your ${maxDay}-day journey</p>
                
                <div id="modal-calendar-container" style="margin: 0 0 24px 0;"></div>
                
                <button id="modal-share-btn" onclick="confirmShareWithDates()" style="padding: 10px;
    margin-top: 0px;
    font-weight: 600;
    align-items: center;
    justify-content: center;
    border: 1px solid #ffffff;
    border-radius: 8px;
    background: #8a4af3;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 0.9rem;
    color: #ffffff;
    cursor: default;
    width: -webkit-fill-available;">
                    Share with dates
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function showDateStep() {
    document.getElementById('share-step-1').style.display = 'none';
    document.getElementById('share-step-2').style.display = 'block';
    const maxDay = Math.max(1, ...(window.cart.map(i => i.day || 1)));
    renderModalCalendar(maxDay);
}

function backToStep1() {
    document.getElementById('share-step-1').style.display = 'block';
    document.getElementById('share-step-2').style.display = 'none';
}

// --- 5. Modal takvimi render et (Geçmiş tarihler seçilebilir) ---
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
        <div style="margin-bottom: 15px; text-align: center; font-weight: 600; color: #1a1a1a; font-size: 15px;">
            ${new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px;">
    `;
    
    for (let i = 0; i < startingDay; i++) {
        html += `<div></div>`;
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentYear, currentMonth, day);
        const isToday = date.toDateString() === now.toDateString();
        
        html += `
            <button onclick="selectModalDate(${day}, ${currentMonth}, ${currentYear}, ${tripDuration})" 
                 style="
                    padding: 10px;
                    text-align: center;
                    border-radius: 8px;
                    cursor: pointer;
                    background: ${isToday ? '#e8f5e9' : '#fafafa'};
                    opacity: 1;
                    border: 2px solid transparent;
                    transition: all 0.2s;
                    font-weight: 500;
                    font-size: 14px;
                    color: #1a1a1a;
                 "
                 class="modal-date-btn"
                 data-day="${day}">
                ${day}
            </button>
        `;
    }
    
    html += `</div>`;
    container.innerHTML = html;
}

// --- 6. Modal'da tarih seç ---
function selectModalDate(day, month, year, tripDuration) {
    const selectedDate = new Date(year, month, day);
    
    console.log('Seçilen:', day, month, year, 'Gün sayısı:', tripDuration);
    
    // Eski seçimi kaldır
    document.querySelectorAll('.modal-date-btn').forEach(btn => {
        btn.style.borderColor = 'transparent';
        btn.style.background = '#fafafa';
    });
    
    // Yeni seçimi işaretle - TÜM GÜNLERI RENKLENDIR
    document.querySelectorAll('.modal-date-btn').forEach(btn => {
        const btnDay = parseInt(btn.getAttribute('data-day'));
        let shouldHighlight = false;
        
        // Seçilen gün ve sonraki tripDuration günleri renklendir
        for (let i = 0; i < tripDuration; i++) {
            const checkDate = new Date(year, month, day + i);
            const btnDate = new Date(year, month, btnDay);
            if (checkDate.toDateString() === btnDate.toDateString()) {
                shouldHighlight = true;
                break;
            }
        }
        
        if (shouldHighlight) {
            btn.style.borderColor = '#8a4af3';
            btn.style.background = '#faf8ff';
        }
    });
    
    // Global variable'a kaydet
    window.modalSelectedStartDate = selectedDate.toLocaleDateString();
    window.modalSelectedEndDates = [];
    
    for (let i = 0; i < tripDuration; i++) {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + i);
        window.modalSelectedEndDates.push(d.toLocaleDateString());
    }
    
    console.log('Kaydedilen tarihler:', window.modalSelectedStartDate, window.modalSelectedEndDates);
}

// --- 7. Modal'ı kapat ---
function closeShareModal() {
    const modal = document.getElementById('date-picker-modal');
    if (modal) modal.remove();
    window.modalSelectedStartDate = null;
    window.modalSelectedEndDates = null;
}

// --- 8. Tarihlerle birlikte share ---
// --- 8. Tarihlerle birlikte share ---
async function confirmShareWithDates() {
    if (!window.modalSelectedStartDate) {
        alert('Please select a date');
        return;
    }
    
    // 1. window.cart'a ve PERSISTENCE İÇİN LOCALSTORAGE'A KAYDET (Düzeltme: Dizi property'si kaybolacağı için)
    window.cart.startDate = window.modalSelectedStartDate;
    window.cart.endDates = window.modalSelectedEndDates;
    localStorage.setItem('tripStartDate', window.modalSelectedStartDate); 
    
    // 2. Share linkini oluştur
    const url = createOptimizedLongLink();
    
    // 3. Share text'i hazırla (HENÜZ MODAL'I KAPATMA, DEĞİŞKENLER LAZIM)
    let shareText = `Check out my trip plan!\n`;
    const endDate = (window.modalSelectedEndDates && window.modalSelectedEndDates.length > 0)
        ? window.modalSelectedEndDates[window.modalSelectedEndDates.length - 1]
        : window.modalSelectedStartDate;
        
    // (Düzeltme: Değişkenler silinmeden kullanılıyor)
    shareText += `${window.modalSelectedStartDate} - ${endDate}\n\n`;
    
    const maxDay = Math.max(0, ...window.cart.map(item => item.day || 0));
    for (let day = 1; day <= maxDay; day++) {
        const dayItems = window.cart.filter(item => item.day == day && item.name);
        if (dayItems.length > 0) {
            shareText += `--- Day ${day} ---\n`;
            dayItems.forEach(item => { shareText += `• ${item.name}\n`; });
            shareText += "\n";
        }
    }
    
    // 4. ŞİMDİ MODAL'I KAPATABİLİRSİN (Değişkenler null oluyor)
    closeShareModal();
    
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
        console.warn("URL shortening failed");
    }
    
    shareText += `View full plan: ${shortUrl}\n\nCreated with triptime.ai!`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
}

// --- 9. Tarih seçmeden share ---
async function shareWithoutDates() {
    // Tarihleri temizle
    window.modalSelectedStartDate = null;
    window.modalSelectedEndDates = null;
    
    // Modal'ı kapat
    closeShareModal();
    
    // Share linkini oluştur (tarih olmadan)
    const url = createOptimizedLongLink();
    
    // Share mekanizmasını başlat
    let shareText = `Check out my trip plan!\n\n`;
    
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
        console.warn("URL shortening failed");
    }
    
    shareText += `View full plan: ${shortUrl}\n\nCreated with triptime.ai!`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
}