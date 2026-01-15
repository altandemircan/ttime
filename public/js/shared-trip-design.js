function showSimpleSharedDesign(tripData) {
    const chatScreen = document.getElementById("chat-screen");
    if (!chatScreen) return;
    
    // Basit CSS
    const style = document.createElement('style');
    style.textContent = `
        .shared-container {
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
        }
        
        .shared-header {
            text-align: center;
            margin-bottom: 40px;
        }
        
        .shared-header h1 {
            color: #667eea;
            font-size: 2.5rem;
            margin-bottom: 10px;
        }
        
        .day-card {
            background: white;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 3px 10px rgba(0,0,0,0.1);
        }
        
        .day-title {
            color: #333;
            font-size: 1.3rem;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #667eea;
        }
        
        .place-item {
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 12px;
            border-bottom: 1px solid #eee;
        }
        
        .place-item:last-child {
            border-bottom: none;
        }
        
        .place-number {
            background: #667eea;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
        }
        
        .place-info h4 {
            margin: 0 0 5px 0;
            color: #333;
        }
        
        .place-category {
            color: #666;
            font-size: 0.9rem;
        }
        
        .cta-area {
            text-align: center;
            margin-top: 40px;
            padding: 30px;
            background: #f8f9fa;
            border-radius: 10px;
        }
        
        .use-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 50px;
            font-size: 1.1rem;
            cursor: pointer;
            font-weight: 600;
        }
    `;
    document.head.appendChild(style);
    
    // HTML
    const days = {};
    tripData.cart.forEach(item => {
        if (!days[item.day]) days[item.day] = [];
        days[item.day].push(item);
    });
    
    chatScreen.innerHTML = `
        <div class="shared-container">
            <div class="shared-header">
                <h1>🌍 Shared Trip Plan</h1>
                <p>${tripData.cart.length} amazing places to discover</p>
            </div>
            
            ${Object.entries(days).map(([day, places]) => `
                <div class="day-card">
                    <div class="day-title">Day ${day}</div>
                    ${places.map((place, idx) => `
                        <div class="place-item">
                            <div class="place-number">${idx + 1}</div>
                            <div class="place-info">
                                <h4>${place.name}</h4>
                                <div class="place-category">${place.category}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `).join('')}
            
            <div class="cta-area">
                <button class="use-btn" onclick="useThisTrip()">
                    ✨ Use This Trip
                </button>
                <p style="margin-top: 15px; color: #666;">
                    Shared via Triptime.ai
                </p>
            </div>
        </div>
    `;
    
    window.useThisTrip = function() {
        window.cart = tripData.cart;
        localStorage.setItem('cart', JSON.stringify(window.cart));
        
        // Normal görünüme dön
        if (typeof showTripDetails === 'function') {
            showTripDetails();
        }
    };
}