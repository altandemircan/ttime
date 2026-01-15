function showTripDesign(tripData) {
    const chatScreen = document.getElementById("chat-screen");
    if (!chatScreen) return;
    
    // Basit CSS
    const style = document.createElement('style');
    style.textContent = `
        .trip-design {
            padding: 20px;
            font-family: Arial, sans-serif;
        }
        .trip-header {
            background: #4CAF50;
            color: white;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            margin-bottom: 30px;
        }
        .day-box {
            background: white;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .place-row {
            display: flex;
            align-items: center;
            padding: 10px;
            border-bottom: 1px solid #eee;
        }
        .place-num {
            background: #4CAF50;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 15px;
            font-weight: bold;
        }
        .place-name {
            font-weight: bold;
            color: #333;
        }
        .place-cat {
            color: #666;
            font-size: 0.9em;
        }
        .use-btn {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 15px 30px;
            font-size: 16px;
            border-radius: 5px;
            cursor: pointer;
            margin-top: 20px;
            display: block;
            width: 100%;
        }
    `;
    document.head.appendChild(style);
    
    // Günleri grupla
    const days = {};
    tripData.cart.forEach(item => {
        if (!days[item.day]) days[item.day] = [];
        days[item.day].push(item);
    });
    
    // HTML
    chatScreen.innerHTML = `
        <div class="trip-design">
            <div class="trip-header">
                <h1>🌍 Paylaşılan Gezi Planı</h1>
                <p>${tripData.cart.length} mekan, ${Object.keys(days).length} gün</p>
            </div>
            
            ${Object.entries(days).map(([day, places]) => `
                <div class="day-box">
                    <h3>Gün ${day}</h3>
                    ${places.map((place, idx) => `
                        <div class="place-row">
                            <div class="place-num">${idx + 1}</div>
                            <div>
                                <div class="place-name">${place.name}</div>
                                <div class="place-cat">${place.category}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `).join('')}
            
            <button class="use-btn" onclick="useThisTrip()">
                ✅ Bu Geziyi Kullan
            </button>
        </div>
    `;
    
    window.useThisTrip = function() {
    window.cart = tripData.cart;
    localStorage.setItem('cart', JSON.stringify(window.cart));
    
    // Chat ekranını temizle
    const chatScreen = document.getElementById("chat-screen");
    if (chatScreen) chatScreen.innerHTML = '';
    
    // showTripDetails'i MANUEL ÇAĞIR
    if (typeof showTripDetails === 'function') {
        showTripDetails();
        
        // Slider'ları da manuel oluştur
        setTimeout(() => {
            if (typeof Splide !== 'undefined') {
                document.querySelectorAll('.splide').forEach(el => {
                    if (!el._splideInstance) {
                        new Splide(el, {
                            perPage: 5,
                            gap: '18px',
                            arrows: true,
                            pagination: false,
                            drag: true
                        }).mount();
                    }
                });
            }
        }, 500);
    } else {
        // Fonksiyon yoksa sayfayı yenile
        window.location.reload();
    }
};
}