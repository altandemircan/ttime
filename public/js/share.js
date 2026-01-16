/**
 * share.js - Logo Animation + Modern Loading + WhatsApp Protection
 */

// --- 1. LOGOLU MODERN LOADING UI ---
function showGlobalLoading() {
    let loader = document.getElementById('trip-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'trip-loader';
        loader.innerHTML = `
            <div class="loader-content">
                <div class="logo-wrapper">
                    <div class="modern-spinner"></div>
                    <img src="https://triptime.ai/img/for_favicon.png" class="loader-logo" alt="Triptime Logo">
                </div>
                <p class="loading-text">Triptime AI Trip Planner is loading</p>
            </div>
            <style>
                #trip-loader {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(255, 255, 255, 0.98); z-index: 99999; 
                    display: flex; align-items: center; justify-content: center; 
                    font-family: 'Inter', sans-serif; backdrop-filter: blur(8px);
                }
                .loader-content { 
                    display: flex; flex-direction: column; align-items: center; justify-content: center; 
                }
                .logo-wrapper {
                    position: relative; 
                    width: 80px; height: 80px; 
                    margin-bottom: 20px;
                    display: flex; align-items: center; justify-content: center;
                }
                .loader-logo {
                    width: 54px; height: 54px; 
                    z-index: 2;
                    display: block;
                    filter: drop-shadow(0 0 8px rgba(138, 74, 243, 0.15));
                }
                .modern-spinner {
                    position: absolute; 
                    /* Spinner wrapper'ı tam kaplar */
                    top: 0; left: 0; right: 0; bottom: 0;
                    border: 3px solid rgba(138, 74, 243, 0.1);
                    border-left-color: #8a4af3; 
                    border-radius: 50%;
                    animation: modern-spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                    z-index: 1;
                }
                .loading-text {
                    color: #1a1a1a; 
                    font-size: 14px; 
                    margin: 0;
                    font-weight: 500;
                    animation: pulse 1.8s ease-in-out infinite;
                }
                @keyframes modern-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
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

// --- 2. PAYLAŞIM FONKSİYONLARI ---
async function generateShareableText() {
    let shareText = "Check out my trip plan!\n\n";
    const maxDay = Math.max(0, ...window.cart.map(item => item.day || 0));

    // Günlük plan listesini oluştur
    for (let day = 1; day <= maxDay; day++) {
        const dayItems = window.cart.filter(item => item.day == day && item.name);
        if (dayItems.length > 0) {
            shareText += `--- Day ${day} ---\n`;
            dayItems.forEach(item => {
                shareText += `* ${item.name}\n`;
            });
            shareText += "\n";
        }
    }

    const longUrl = createShortTripLink(); // O devasa link
    
    try {
        // ÜCRETSİZ ALTIN VURUŞ: TinyURL API ile linki küçült
        const response = await fetch(`https://tinyurl.com/api-create?url=${encodeURIComponent(longUrl)}`);
        if (!response.ok) throw new Error('Shortener error');
        const shortUrl = await response.text();
        shareText += `View full plan: ${shortUrl}`;
    } catch (err) {
        // API'de sorun olursa (internet kesikse vb.) eski uzun linki bas, sistem durmasın
        shareText += `View full plan: ${longUrl}`;
    }

    shareText += "\n\nCreated with triptime.ai!"; 
    return shareText;
}

function createShortTripLink() {
    const title = document.getElementById('trip_title')?.innerText || "My Trip Plan";
    const aiInfo = localStorage.getItem('ai_information') || "";
    const items = (window.cart || []).map(item => {
        const lat = item.lat || (item.location && item.location.lat) || 0;
        const lng = item.lng || (item.location && item.location.lng) || 0;
        const imgUrl = (item.image && item.image.length > 5) ? encodeURIComponent(item.image) : "no-img";
        return `${item.name}|${lat}|${lng}|${item.day || 1}|${imgUrl}`;
    }).join('*');
    const payload = { n: title, ai: aiInfo, items: items };
    return `${window.location.origin}${window.location.pathname}?v1=${encodeURIComponent(JSON.stringify(payload))}`;
}

// --- 3. ANA KARŞILAYICI VE BAŞLATICI ---
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const v1Raw = params.get('v1');
    const v2Raw = params.get('v2'); // Yeni kısa format
    
    if (!v1Raw && !v2Raw) return;

    showGlobalLoading();

    try {
        let tripData = { n: "Trip Plan", items: "", ai: "" };

        if (v2Raw) {
            // ALTIN VURUŞ: v2 Formatını Çöz (Sıkıştırılmış Metin)
            const decoded = decodeURIComponent(v2Raw);
            const [title, itemsStr] = decoded.split('|');
            tripData.n = title;
            // v2'de öğeler virgülle ayrılmıştı: Isim,Lat,Lng,Gün,Resim
            const rawItems = itemsStr.split('*');
            window.cart = rawItems.map(str => {
                const p = str.split(',');
                const lat = parseFloat(p[1]);
                const lng = parseFloat(p[2]);
                return {
                    name: p[0], lat: lat, lng: lng,
                    location: { lat: lat, lng: lng },
                    day: parseInt(p[3]) || 1, 
                    image: p[4] === "1" ? "default" : "", // 1 ise resim var işareti
                    category: "Place"
                };
            });
        } else if (v1Raw) {
            // ESKİ FORMAT: v1 (JSON)
            const decodedV1 = JSON.parse(decodeURIComponent(v1Raw));
            tripData = decodedV1;
            const rawItems = tripData.items.split('*');
            window.cart = rawItems.map(str => {
                const parts = str.split('|');
                const [name, latStr, lonStr, dayStr, imgStr] = parts;
                const finalImg = (imgStr === "no-img" || !imgStr) ? "" : decodeURIComponent(decodeURIComponent(imgStr));
                return {
                    name: name, lat: parseFloat(latStr), lng: parseFloat(lonStr),
                    location: { lat: parseFloat(latStr), lng: parseFloat(lonStr) },
                    day: parseInt(dayStr) || 1, image: finalImg, category: "Place"
                };
            });
        }

        // --- Ortak İşlemler (Senin Kodun) ---
        localStorage.setItem('cart', JSON.stringify(window.cart));
        if (tripData.ai) localStorage.setItem('ai_information', tripData.ai);
        if (document.getElementById('trip_title')) document.getElementById('trip_title').innerText = tripData.n;
        
        const welcomeSection = document.getElementById('tt-welcome');
        if (welcomeSection) {
            welcomeSection.style.display = 'block';
            welcomeSection.classList.add('active');
        }

        let attempts = 0;
        const checkEverything = setInterval(() => {
            attempts++;
            const isFunctionsReady = typeof updateCart === 'function'; 
            // insertTripAiInfo opsiyonel olabilir, v2'de AI yoksa bile updateCart çalışmalı

            if (isFunctionsReady || attempts > 35) {
                clearInterval(checkEverything);
                try {
                    if (typeof updateCart === 'function') updateCart();
                    
                    // AI Bilgisini Enjekte Et (Sadece veri varsa)
                    if (tripData.ai && typeof insertTripAiInfo === "function") {
                        const parts = tripData.ai.split('\n\n');
                        const staticAi = {
                            summary: parts[0]?.replace(/Summary:\s*/i, '').trim() || "",
                            tip: parts[1]?.replace(/Tip:\s*/i, '').trim() || "",
                            highlight: parts[2]?.replace(/Highlight:\s*/i, '').trim() || ""
                        };
                        insertTripAiInfo(null, staticAi, null);
                    }
                    
                    const overlay = document.getElementById('sidebar-overlay-trip');
                    if (overlay) overlay.classList.add('open');
                } catch (err) {}

                setTimeout(() => {
                    hideGlobalLoading();
                    try {
                        if (window.map && typeof window.map.invalidateSize === 'function') {
                            window.map.invalidateSize();
                            if (typeof fitMapToCart === 'function') fitMapToCart();
                        }
                    } catch (e) {}
                }, 1000);
            }
        }, 300);
    } catch (e) {
        console.error("Yükleme hatası:", e);
        hideGlobalLoading();
    }
});


// --- 1. VERİYİ JSON OLMADAN, DÜMDÜZ VE EN KISA HALİYLE PAKETLE ---
function createOptimizedLongLink() {
    const title = document.getElementById('trip_title')?.innerText || "Trip";
    
    // JSON'daki tırnak, parantez ve anahtar kelimeleri (n, items) tamamen siliyoruz.
    // Format: Başlık | İsim,Lat,Lng,Gün,Resim * İsim,Lat,Lng,Gün,Resim
    const items = (window.cart || []).map(item => {
        const name = item.name.replace(/[|*,]/g, ''); // Ayırıcı karakterleri temizle
        const lat = parseFloat(item.lat || 0).toFixed(4);
        const lng = parseFloat(item.lng || 0).toFixed(4);
        const img = item.image ? "1" : "0";
        return `${name},${lat},${lng},${item.day || 1},${img}`;
    }).join('*');

    const rawData = `${title}|${items}`; // En saf hali
    const baseUrl = window.location.origin + window.location.pathname;
    
    // v1 yerine v2 diyelim ki yeni sıkıştırma formatını anlasın (Opsiyonel: v1 de kalabilir)
    return `${baseUrl}?v2=${encodeURIComponent(rawData)}`;
}

// --- 2. WHATSAPP PAYLAŞIM (HTTPS VE TİNYURL FIX) ---
async function shareOnWhatsApp() {
    if (typeof showGlobalLoading === 'function') showGlobalLoading();
    
    try {
        // 1. WHATSAPP METNİ (DOKUNULMAZ FORMATIN)
        let shareText = "Check out my trip plan!\n\n";
        const maxDay = Math.max(0, ...window.cart.map(item => item.day || 0));

        for (let day = 1; day <= maxDay; day++) {
            const dayItems = window.cart.filter(item => item.day == day && item.name);
            if (dayItems.length > 0) {
                shareText += `--- Day ${day} ---\n`;
                dayItems.forEach(item => {
                    shareText += `• ${item.name}\n`;
                });
                shareText += "\n";
            }
        }

        // 2. ÖNCE v2 LİNKİNİ OLUŞTUR (SENİN YUKARIDA ATTIĞIN O LİNK)
        const longV2Url = createOptimizedLongLink(); 
        
        let shortUrl = longV2Url;

        // 3. ŞİMDİ BU v2 LİNKİNİ TİNYURL'E GÖNDER
        try {
            // Encode edilmemiş halini değil, tam URL'yi gönderiyoruz
            const tinyUrlApi = `https://tinyurl.com/api-create?url=${encodeURIComponent(longV2Url)}`;
            
            const response = await fetch(tinyUrlApi);
            if (response.ok) {
                const result = await response.text();
                // Eğer dönen sonuç gerçek bir linkse onu kullan
                if (result && result.startsWith('http')) {
                    shortUrl = result;
                }
            }
        } catch (apiErr) {
            console.error("TinyURL API hatası:", apiErr);
        }

        // 4. METNİ BİRLEŞTİR VE İMZAYI ÇAK
        shareText += `View full plan: ${shortUrl}`;
        shareText += "\n\nCreated with triptime.ai!";

        // 5. WHATSAPP'I AÇ
        const finalWaUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
        window.open(finalWaUrl, '_blank');

    } catch (e) {
        console.error("Genel hata:", e);
    } finally {
        if (typeof hideGlobalLoading === 'function') hideGlobalLoading();
    }
}

function shareOnInstagram() {
    // Instagram için de kısa linkli versiyonu kopyalayalım
    if (typeof showGlobalLoading === 'function') showGlobalLoading();
    generateShareableText().then(textToShare => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(textToShare).then(() => {
                alert("Trip plan with short link copied to clipboard!");
            });
        }
        if (typeof hideGlobalLoading === 'function') hideGlobalLoading();
    });
}