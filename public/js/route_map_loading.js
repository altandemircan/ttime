// ============================================================
// CART ROUTE MAP LOADING SKELETON
// Cart içindeki günlük route haritaları için loading state
// ============================================================

(function() {
    'use strict';
    
    // Route Map için özel CSS
    function injectRouteMapLoadingStyles() {
        if (document.getElementById('route-map-loading-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'route-map-loading-styles';
        style.textContent = `
            /* Route Map Container - SABİT YÜKSEKLİK */
            .route-map,
            [id^="route-map-day"] {
                min-height: 285px !important;
                height: 285px !important;
                background-color: #eef0f5 !important;
                position: relative;
                transition: opacity 0.15s ease;
            }
            
            /* Route Map Loading Skeleton */
            .route-map-loading {
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
            
            /* Loading Icon Container */
            .route-map-loading-content {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 12px;
                z-index: 1001;
            }
            
            /* Map Icon Animation */
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
                text-align: center;
            }
            
            /* Route Placeholder Lines */
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
            
            /* Map görünür olduğunda */
            .route-map.loaded {
                opacity: 1 !important;
            }
            
            /* Mobile */
            @media (max-width: 768px) {
                .route-map,
                [id^="route-map-day"] {
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
    
    // Route Map Loading Skeleton HTML
    function createRouteMapLoadingSkeleton(day) {
        const skeleton = document.createElement('div');
        skeleton.className = 'route-map-loading';
        skeleton.setAttribute('data-day', day);
        
        // Random marker pozisyonları
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
    
    // Route Map'e loading ekle
    window.addRouteMapLoading = function(mapElement, day) {
        if (!mapElement) return null;
        
        // Zaten varsa ekleme
        let skeleton = mapElement.querySelector('.route-map-loading');
        if (skeleton) return skeleton;
        
        // Map'i önce gizle (opacity)
        mapElement.style.opacity = '0';
        
        skeleton = createRouteMapLoadingSkeleton(day);
        mapElement.appendChild(skeleton);
        
        console.log(`[Route Map Loading] Skeleton added for Day ${day}`);
        return skeleton;
    };
    
    // Route Map loading'i kaldır
    window.removeRouteMapLoading = function(mapElement, delay = 400) {
        if (!mapElement) return;
        
        const skeleton = mapElement.querySelector('.route-map-loading');
        if (!skeleton) return;
        
        // Map'i görünür yap
        mapElement.style.opacity = '1';
        mapElement.classList.add('loaded');
        
        // Skeleton fade out
        skeleton.classList.add('fade-out');
        
        setTimeout(() => {
            if (skeleton && skeleton.parentNode) {
                skeleton.remove();
                console.log('[Route Map Loading] Skeleton removed');
            }
        }, delay);
    };
    
    // renderRouteForDay fonksiyonunu wrap et
    function wrapRenderRouteForDay() {
        if (typeof window.renderRouteForDay !== 'undefined' && !window.renderRouteForDay.__wrapped) {
            const originalRenderRouteForDay = window.renderRouteForDay;
            
            window.renderRouteForDay = function(day, ...args) {
                const mapId = `route-map-day${day}`;
                const mapElement = document.getElementById(mapId);
                
                // Loading ekle
                if (mapElement && window.addRouteMapLoading) {
                    window.addRouteMapLoading(mapElement, day);
                }
                
                // Orijinal fonksiyonu çağır
                const result = originalRenderRouteForDay.call(this, day, ...args);
                
                // Promise ise
                if (result && typeof result.then === 'function') {
                    return result.then((res) => {
                        setTimeout(() => {
                            if (mapElement && window.removeRouteMapLoading) {
                                window.removeRouteMapLoading(mapElement);
                            }
                        }, 500);
                        return res;
                    });
                }
                
                // Promise değilse timeout ile kaldır
                setTimeout(() => {
                    if (mapElement && window.removeRouteMapLoading) {
                        window.removeRouteMapLoading(mapElement);
                    }
                }, 800);
                
                return result;
            };
            
            // Wrap işaretini ekle (tekrar wrap'i önle)
            window.renderRouteForDay.__wrapped = true;
            
            console.log('[Route Map Loading] renderRouteForDay wrapped successfully');
            return true;
        }
        return false;
    }
    
    // Hemen dene
    if (!wrapRenderRouteForDay()) {
        // Yoksa bekle ve tekrar dene
        let attempts = 0;
        const maxAttempts = 50; // 5 saniye
        
        const checkInterval = setInterval(() => {
            attempts++;
            
            if (wrapRenderRouteForDay()) {
                clearInterval(checkInterval);
            } else if (attempts >= maxAttempts) {
                console.warn('[Route Map Loading] renderRouteForDay not found after 5 seconds');
                clearInterval(checkInterval);
            }
        }, 100);
    }
    
    // MutationObserver ile yeni route map'leri yakala
    function observeRouteMapContainers() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        // Route map kontrolü
                        if (node.classList && node.classList.contains('route-map')) {
                            const day = node.id ? node.id.replace('route-map-day', '') : '1';
                            
                            // Henüz yüklenmemişse loading ekle
                            if (!node.querySelector('.leaflet-map-pane')) {
                                window.addRouteMapLoading(node, day);
                            }
                        }
                        
                        // Alt elementlerde route map ara
                        const routeMaps = node.querySelectorAll('[id^="route-map-day"]');
                        routeMaps.forEach(map => {
                            if (!map.querySelector('.leaflet-map-pane')) {
                                const day = map.id.replace('route-map-day', '');
                                window.addRouteMapLoading(map, day);
                            }
                        });
                    }
                });
            });
        });
        
        // Sidebar'ı gözlemle
        const tripSidebar = document.getElementById('sidebar-overlay-trip');
        if (tripSidebar) {
            observer.observe(tripSidebar, {
                childList: true,
                subtree: true
            });
        }
    }
    
    // Sayfa yüklendiğinde başlat
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            injectRouteMapLoadingStyles();
            observeRouteMapContainers();
        });
    } else {
        injectRouteMapLoadingStyles();
        observeRouteMapContainers();
    }
    
    console.log('[Route Map Loading] System initialized');
})();