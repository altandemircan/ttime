// ============================================================
// CART ROUTE MAP LOADING SKELETON - SADECE KÜÇÜK HARİTALAR
// Sadece cart içindeki günlük küçük route haritaları için
// Büyük expanded map'i ETKİLEMEZ
// ============================================================

(function() {
    'use strict';
    
    // SADECE cart içindeki küçük haritalar için CSS
    function injectRouteMapLoadingStyles() {
        if (document.getElementById('route-map-loading-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'route-map-loading-styles';
        style.textContent = `
            /* SADECE CART İÇİNDEKİ KÜÇÜK HARİTALAR - Expanded map hariç */
            .route-controls-bar .route-map,
            .map-content-wrap [id^="route-map-day"] {
                min-height: 285px !important;
                height: 285px !important;
                background-color: #eef0f5 !important;
                position: relative;
            }
            
            /* Route Map Loading Skeleton - SADECE KÜÇÜK HARİTALAR */
            .route-controls-bar .route-map-loading,
            .map-content-wrap .route-map-loading {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(
                    135deg,
                    #e8edf2 0%,
                    #f2f5f9 20%,
                    #e8edf2 40%,
                    #f2f5f9 60%,
                    #e8edf2 80%,
                    #f2f5f9 100%
                );
                background-size: 400% 400%;
                animation: route-map-shimmer 3s ease-in-out infinite;
                z-index: 1000;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 16px;
                border-radius: 4px;
            }
            
            @keyframes route-map-shimmer {
                0%, 100% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
            }
            
            /* Loading Content */
            .route-map-loading-content {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 12px;
                z-index: 1001;
            }
            
            /* Map Icon */
            .route-map-loading-icon {
                width: 56px;
                height: 56px;
                position: relative;
            }
            
            .route-map-loading-icon::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                border: 4px solid #cbd5e1;
                border-top-color: #1976d2;
                border-radius: 50%;
                animation: route-spin 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            }
            
            .route-map-loading-icon::after {
                content: '🗺️';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 24px;
                animation: route-pulse 2s ease-in-out infinite;
            }
            
            @keyframes route-spin {
                to { transform: rotate(360deg); }
            }
            
            @keyframes route-pulse {
                0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                50% { opacity: 0.7; transform: translate(-50%, -50%) scale(0.95); }
            }
            
            /* Loading Text */
            .route-map-loading-text {
                color: #475569;
                font-size: 14px;
                font-weight: 500;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            
            /* Placeholder Lines */
            .route-map-placeholder-lines {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                pointer-events: none;
                opacity: 0.15;
            }
            
            .route-map-placeholder-lines::before,
            .route-map-placeholder-lines::after {
                content: '';
                position: absolute;
                background: #1976d2;
                border-radius: 2px;
            }
            
            .route-map-placeholder-lines::before {
                top: 30%;
                left: 20%;
                width: 40%;
                height: 3px;
                transform: rotate(-25deg);
                animation: route-line-1 2s ease-in-out infinite;
            }
            
            .route-map-placeholder-lines::after {
                bottom: 35%;
                right: 25%;
                width: 35%;
                height: 3px;
                transform: rotate(15deg);
                animation: route-line-2 2s ease-in-out infinite;
            }
            
            @keyframes route-line-1 {
                0%, 100% { opacity: 0.15; }
                50% { opacity: 0.25; }
            }
            
            @keyframes route-line-2 {
                0%, 100% { opacity: 0.25; }
                50% { opacity: 0.15; }
            }
            
            /* Marker Placeholders */
            .route-map-markers {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                pointer-events: none;
            }
            
            .route-map-marker-placeholder {
                position: absolute;
                width: 24px;
                height: 24px;
                background: #cbd5e1;
                border: 2px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                animation: marker-pulse 1.5s ease-in-out infinite;
            }
            
            @keyframes marker-pulse {
                0%, 100% { transform: scale(1); opacity: 0.6; }
                50% { transform: scale(1.1); opacity: 0.8; }
            }
            
            /* Fade out */
            .route-map-loading.fade-out {
                opacity: 0;
                transition: opacity 0.5s ease;
            }
            
            /* Mobile */
            @media (max-width: 768px) {
                .route-controls-bar .route-map,
                .map-content-wrap [id^="route-map-day"] {
                    min-height: 240px !important;
                    height: 240px !important;
                }
                
                .route-map-loading-icon {
                    width: 48px;
                    height: 48px;
                }
                
                .route-map-loading-icon::after {
                    font-size: 20px;
                }
                
                .route-map-loading-text {
                    font-size: 13px;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Loading skeleton HTML
    function createRouteMapLoadingSkeleton(day) {
        const skeleton = document.createElement('div');
        skeleton.className = 'route-map-loading';
        skeleton.setAttribute('data-day', day);
        
        const markerPositions = [
            { top: '25%', left: '30%' },
            { top: '45%', left: '60%' },
            { top: '65%', left: '35%' },
            { top: '35%', left: '75%' }
        ];
        
        const markersHtml = markerPositions.map(pos => 
            `<div class="route-map-marker-placeholder" style="top:${pos.top}; left:${pos.left};"></div>`
        ).join('');
        
        skeleton.innerHTML = `
            <div class="route-map-placeholder-lines"></div>
            <div class="route-map-markers">${markersHtml}</div>
            <div class="route-map-loading-content">
                <div class="route-map-loading-icon"></div>
                <div class="route-map-loading-text">Loading route map...</div>
            </div>
        `;
        
        return skeleton;
    }
    
    // SADECE CART İÇİNDEKİ KÜÇÜK HARİTA MI KONTROL ET
    function isSmallRouteMap(mapElement) {
        if (!mapElement) return false;
        
        // 1. route-controls-bar içinde mi?
        if (mapElement.closest('.route-controls-bar')) return true;
        
        // 2. map-content-wrap içinde mi?
        if (mapElement.closest('.map-content-wrap')) return true;
        
        // 3. Expanded map değil mi?
        if (mapElement.closest('.expanded-map-overlay')) return false;
        if (mapElement.classList.contains('expanded-map')) return false;
        
        // 4. ID kontrolü - sadece route-map-day
        if (mapElement.id && mapElement.id.match(/^route-map-day\d+$/)) return true;
        
        return false;
    }
    
    // Loading ekle - SADECE KÜÇÜK HARİTALAR
    window.addRouteMapLoading = function(mapElement, day) {
        if (!mapElement || !isSmallRouteMap(mapElement)) {
            return null;
        }
        
        // Zaten varsa ekleme
        let skeleton = mapElement.querySelector('.route-map-loading');
        if (skeleton) return skeleton;
        
        skeleton = createRouteMapLoadingSkeleton(day);
        mapElement.appendChild(skeleton);
        
        console.log(`[Route Map Loading] Skeleton added for small map Day ${day}`);
        return skeleton;
    };
    
    // Loading kaldır
    window.removeRouteMapLoading = function(mapElement, delay = 400) {
        if (!mapElement || !isSmallRouteMap(mapElement)) {
            return;
        }
        
        const skeleton = mapElement.querySelector('.route-map-loading');
        if (!skeleton) return;
        
        skeleton.classList.add('fade-out');
        
        setTimeout(() => {
            if (skeleton && skeleton.parentNode) {
                skeleton.remove();
                console.log('[Route Map Loading] Skeleton removed from small map');
            }
        }, delay);
    };
    
    // renderRouteForDay wrap - SADECE KÜÇÜK HARİTALAR
    function wrapRenderRouteForDay() {
        if (typeof window.renderRouteForDay !== 'undefined' && !window.renderRouteForDay.__wrapped) {
            const originalRenderRouteForDay = window.renderRouteForDay;
            
            window.renderRouteForDay = function(day, ...args) {
                // ========================================
                // KRİTİK: CART BOŞ İSE HİÇBİR ŞEY YAPMA
                // ========================================
                const dayItems = window.cart ? window.cart.filter(item => item.day === day) : [];
                
                if (!dayItems || dayItems.length === 0) {
                    console.log(`[Route Map Loading] Skipping day ${day} - cart is empty`);
                    
                    // Harita varsa temizle
                    const mapId = `route-map-day${day}`;
                    const mapElement = document.getElementById(mapId);
                    const map = window.leafletMaps?.[mapId];
                    
                    if (map) {
                        map.eachLayer(l => {
                            if (!(l instanceof L.TileLayer)) {
                                map.removeLayer(l);
                            }
                        });
                    }
                    
                    // Loading skeleton varsa kaldır
                    if (mapElement) {
                        window.removeRouteMapLoading(mapElement);
                    }
                    
                    return; // 🛑 DURDUR
                }
                // ========================================
                
                const mapId = `route-map-day${day}`;
                const mapElement = document.getElementById(mapId);
                
                // SADECE küçük harita ise loading ekle
                if (mapElement && isSmallRouteMap(mapElement)) {
                    window.addRouteMapLoading(mapElement, day);
                }
                
                const result = originalRenderRouteForDay.call(this, day, ...args);
                
                if (result && typeof result.then === 'function') {
                    return result.then((res) => {
                        setTimeout(() => {
                            if (mapElement && isSmallRouteMap(mapElement)) {
                                window.removeRouteMapLoading(mapElement);
                            }
                        }, 500);
                        return res;
                    });
                }
                
                setTimeout(() => {
                    if (mapElement && isSmallRouteMap(mapElement)) {
                        window.removeRouteMapLoading(mapElement);
                    }
                }, 800);
                
                return result;
            };
            
            window.renderRouteForDay.__wrapped = true;
            console.log('[Route Map Loading] renderRouteForDay wrapped (small maps only)');
            return true;
        }
        return false;
    }
    
    // Hemen dene, yoksa bekle
    if (!wrapRenderRouteForDay()) {
        let attempts = 0;
        const maxAttempts = 50;
        
        const checkInterval = setInterval(() => {
            attempts++;
            if (wrapRenderRouteForDay()) {
                clearInterval(checkInterval);
            } else if (attempts >= maxAttempts) {
                console.warn('[Route Map Loading] renderRouteForDay not found');
                clearInterval(checkInterval);
            }
        }, 100);
    }
    
    // MutationObserver - SADECE KÜÇÜK HARİTALAR
    function observeRouteMapContainers() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        if (node.classList && node.classList.contains('route-map') && isSmallRouteMap(node)) {
                            const day = node.id ? node.id.replace('route-map-day', '') : '1';
                            if (!node.querySelector('.leaflet-map-pane')) {
                                window.addRouteMapLoading(node, day);
                            }
                        }
                        
                        const routeMaps = node.querySelectorAll('[id^="route-map-day"]');
                        routeMaps.forEach(map => {
                            if (isSmallRouteMap(map) && !map.querySelector('.leaflet-map-pane')) {
                                const day = map.id.replace('route-map-day', '');
                                window.addRouteMapLoading(map, day);
                            }
                        });
                    }
                });
            });
        });
        
        const tripSidebar = document.getElementById('sidebar-overlay-trip');
        if (tripSidebar) {
            observer.observe(tripSidebar, {
                childList: true,
                subtree: true
            });
        }
    }
    
    // Init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            injectRouteMapLoadingStyles();
            observeRouteMapContainers();
        });
    } else {
        injectRouteMapLoadingStyles();
        observeRouteMapContainers();
    }
    
    console.log('[Route Map Loading] System initialized - SMALL MAPS ONLY');
})();