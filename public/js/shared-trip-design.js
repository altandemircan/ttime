function showSharedTripDesign(tripData) {
    const chatScreen = document.getElementById("chat-screen");
    if (!chatScreen) return;
    
    chatScreen.innerHTML = '';
    
    // CSS ekle
    const style = document.createElement('style');
    style.textContent = `
        .shared-trip-page {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .trip-header-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 15px;
            padding: 30px;
            margin-bottom: 30px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
        }
        
        .trip-title {
            font-size: 2.5rem;
            margin-bottom: 10px;
        }
        
        .trip-stats {
            display: flex;
            justify-content: center;
            gap: 40px;
            margin-top: 20px;
            flex-wrap: wrap;
        }
        
        .stat-box {
            background: rgba(255, 255, 255, 0.2);
            padding: 15px 25px;
            border-radius: 10px;
            backdrop-filter: blur(10px);
        }
        
        .stat-number {
            font-size: 2rem;
            font-weight: bold;
            display: block;
        }
        
        .day-section-shared {
            background: white;
            border-radius: 15px;
            margin-bottom: 25px;
            overflow: hidden;
            box-shadow: 0 5px 15px rgba(0,0,0,0.08);
            border: 1px solid #eaeaea;
        }
        
        .day-header-shared {
            background: #f8f9fa;
            padding: 20px;
            border-bottom: 1px solid #eaeaea;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .day-title-shared {
            font-size: 1.4rem;
            font-weight: 600;
            color: #333;
        }
        
        .day-places-shared {
            padding: 20px;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 20px;
        }
        
        .shared-place-card {
            background: white;
            border-radius: 10px;
            overflow: hidden;
            border: 1px solid #eaeaea;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .shared-place-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }
        
        .place-image-container {
            height: 180px;
            overflow: hidden;
            position: relative;
        }
        
        .place-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.3s;
        }
        
        .shared-place-card:hover .place-image {
            transform: scale(1.05);
        }
        
        .place-number {
            position: absolute;
            top: 15px;
            left: 15px;
            background: #667eea;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 14px;
        }
        
        .place-content {
            padding: 20px;
        }
        
        .place-category {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: #f0f7ff;
            color: #4facfe;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 500;
            margin-bottom: 12px;
        }
        
        .place-name {
            font-size: 1.2rem;
            font-weight: 600;
            color: #333;
            margin-bottom: 10px;
            line-height: 1.3;
        }
        
        .place-address {
            color: #666;
            font-size: 0.9rem;
            display: flex;
            align-items: flex-start;
            gap: 8px;
            margin-top: 10px;
        }
        
        .cta-footer {
            text-align: center;
            padding: 40px 20px;
            margin-top: 40px;
        }
        
        .cta-button {
            background: linear-gradient(to right, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 15px 40px;
            border-radius: 50px;
            font-size: 1.1rem;
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 10px;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .cta-button:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
        }
        
        @media (max-width: 768px) {
            .day-places-shared {
                grid-template-columns: 1fr;
            }
            
            .trip-stats {
                gap: 20px;
            }
            
            .trip-title {
                font-size: 2rem;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Günleri grupla
    const days = {};
    tripData.cart.forEach(item => {
        if (!days[item.day]) days[item.day] = [];
        days[item.day].push({...item});
    });
    
    // İstatistikler
    const totalPlaces = tripData.cart.length;
    const totalDays = Object.keys(days).length;
    
    // HTML oluştur
    const html = `
        <div class="shared-trip-page">
            <div class="trip-header-card">
                <h1 class="trip-title">📍 Trip Plan Shared</h1>
                <p style="opacity: 0.9; max-width: 600px; margin: 0 auto;">
                    Discover this amazing travel itinerary with ${totalPlaces} carefully selected places
                </p>
                
                <div class="trip-stats">
                    <div class="stat-box">
                        <span class="stat-number">${totalDays}</span>
                        <span>Days</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-number">${totalPlaces}</span>
                        <span>Places</span>
                    </div>
                </div>
            </div>
            
            ${Object.entries(days).map(([day, places]) => {
                const dayName = tripData.customDayNames?.[day] || `Day ${day}`;
                let dateStr = '';
                if (tripData.tripDates?.startDate) {
                    const startDate = new Date(tripData.tripDates.startDate);
                    const currentDate = new Date(startDate);
                    currentDate.setDate(startDate.getDate() + (parseInt(day) - 1));
                    dateStr = currentDate.toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric' 
                    });
                }
                
                return `
                <div class="day-section-shared">
                    <div class="day-header-shared">
                        <div>
                            <div class="day-title-shared">${dayName}</div>
                            ${dateStr ? `<div style="color: #666; font-size: 0.9rem; margin-top: 5px;">${dateStr}</div>` : ''}
                        </div>
                        <div style="color: #667eea; font-weight: 600;">
                            ${places.length} ${places.length === 1 ? 'place' : 'places'}
                        </div>
                    </div>
                    
                    <div class="day-places-shared">
                        ${places.map((place, idx) => `
                            <div class="shared-place-card">
                                <div class="place-image-container">
                                    <div class="place-number">${idx + 1}</div>
                                    <img class="place-image" src="${place.image || 'https://images.pexels.com/photos/3462098/pexels-photo-3462098.jpeg?auto=compress&cs=tinysrgb&h=350'}" 
                                         alt="${place.name}" 
                                         onerror="this.src='img/placeholder.png'">
                                </div>
                                
                                <div class="place-content">
                                    <div class="place-category">
                                        <img src="${getCategoryIcon(place.category)}" alt="${place.category}" style="width: 16px; height: 16px;">
                                        ${place.category}
                                    </div>
                                    
                                    <h3 class="place-name">${place.name}</h3>
                                    
                                    ${place.address ? `
                                    <div class="place-address">
                                        <img src="img/address_icon.svg" alt="Address" style="width: 14px; height: 14px; opacity: 0.7;">
                                        <span>${place.address.substring(0, 60)}${place.address.length > 60 ? '...' : ''}</span>
                                    </div>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                `;
            }).join('')}
            
            <div class="cta-footer">
                <button class="cta-button" onclick="useThisSharedTrip()">
                    <img src="img/addtotrip-icon.svg" style="width: 20px; height: 20px;">
                    Use This Trip Plan
                </button>
                <p style="color: #666; margin-top: 20px;">
                    This trip was shared with you via Triptime.ai
                </p>
            </div>
        </div>
    `;
    
    chatScreen.innerHTML = html;
    
    // Global fonksiyon
    window.useThisSharedTrip = function() {
        window.cart = tripData.cart;
        window.customDayNames = tripData.customDayNames || {};
        window.tripDates = tripData.tripDates || {};
        localStorage.setItem('cart', JSON.stringify(window.cart));
        
        // Normal gezi görünümüne dön
        if (typeof showTripDetails === 'function') {
            showTripDetails(tripData.tripDates?.startDate);
        }
    };
}