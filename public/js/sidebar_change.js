document.addEventListener("DOMContentLoaded", function () {
    // Open sidebar-default by default
    const def = document.getElementById('sidebar-overlay-default');
    if (def) def.classList.add('open');
});

document.addEventListener('DOMContentLoaded', function() {
    const allSidebars = document.querySelectorAll('.sidebar-overlay');
    
    window.toggleSidebar = function(sidebarId) {
        const allSidebars = document.querySelectorAll('.sidebar-overlay');
        const clickedSidebar = document.getElementById(sidebarId);
        
        if (clickedSidebar) {
            const wasOpen = clickedSidebar.classList.contains('open');
            const willBeOpen = !wasOpen;
            
            allSidebars.forEach(sidebar => {
                if (sidebar.id !== sidebarId) {
                    sidebar.classList.remove('open');
                }
            });
            clickedSidebar.classList.toggle('open');
            
            // SCROLL TO TOP: Sidebar açılırken en üste git
            if (willBeOpen) {
                setTimeout(() => {
                    clickedSidebar.scrollTop = 0;
                    // İçindeki content varsa onu da en üste al
                    const sidebarContent = clickedSidebar.querySelector('.sidebar-content, [class*="sidebar-"]');
                    if (sidebarContent) {
                        sidebarContent.scrollTop = 0;
                    }
                }, 50);
            }
            
            // HARITA FIX: Eğer bir sidebar açılıyorsa ve içinde harita varsa
            if (willBeOpen) {
                const miniMapContainer = document.querySelector('.mini-map-container, #mini-map, .leaflet-container');
                if (miniMapContainer) {
                    miniMapContainer.style.opacity = '0';
                    miniMapContainer.style.transition = 'opacity 0.15s ease';
                }
                
                setTimeout(() => {
                    // Tüm harita tiplerini yenile
                    if (window.miniMap && typeof window.miniMap.invalidateSize === 'function') {
                        window.miniMap.invalidateSize();
                    }
                    if (window.map && typeof window.map.invalidateSize === 'function') {
                        window.map.invalidateSize();
                    }
                    if (window.leafletMaps) {
                        Object.values(window.leafletMaps).forEach(map => {
                            if (map && typeof map.invalidateSize === 'function') {
                                map.invalidateSize();
                            }
                        });
                    }
                    
                    // Haritayı tekrar göster
                    setTimeout(() => {
                        if (miniMapContainer) {
                            miniMapContainer.style.opacity = '1';
                        }
                    }, 50);
                }, 300);
            }
        }
    };
    
    window.toggleSidebarUpdates = function() {
        window.toggleSidebar('sidebar-overlay-updates');
    };

    window.toggleSidebarGallery = function() {
        window.toggleSidebar('sidebar-overlay-gallery');
    };

    window.toggleSidebarLogin = function() {
        window.toggleSidebar('sidebar-overlay-login');
    };  

    window.toggleSidebarFeedback = function() {
        window.toggleSidebar('sidebar-overlay-feedback');
    };

  window.toggleSidebarTrip = function() {
        const tripPanel = document.getElementById('sidebar-overlay-trip');
        const isOpening = tripPanel && !tripPanel.classList.contains('open');
        
        window.toggleSidebar('sidebar-overlay-trip');

        // Eğer panel AÇILIYORSA (kapalıyken açılıyor), harita fix'i uygula
        if (isOpening) {
            // Sidebar'ı en üste scroll et
            setTimeout(() => {
                if (tripPanel) {
                    tripPanel.scrollTop = 0;
                    const sidebarContent = tripPanel.querySelector('.sidebar-trip, .sidebar-content, [class*="sidebar"]');
                    if (sidebarContent) {
                        sidebarContent.scrollTop = 0;
                    }
                }
            }, 50);
            
            // Harita container'ını bul ve geçici olarak gizle
            const miniMapContainer = document.querySelector('.mini-map-container, #mini-map, .leaflet-container');
            if (miniMapContainer) {
                miniMapContainer.style.opacity = '0';
                miniMapContainer.style.transition = 'opacity 0.15s ease';
            }
            
            setTimeout(() => {
                // Küçük harita
                if (window.miniMap && typeof window.miniMap.invalidateSize === 'function') {
                    window.miniMap.invalidateSize();
                }
                
                // Ana harita
                if (window.map && typeof window.map.invalidateSize === 'function') {
                    window.map.invalidateSize();
                }
                
                // Leaflet haritalar
                if (window.leafletMaps) {
                    Object.values(window.leafletMaps).forEach(map => {
                        if (map && typeof map.invalidateSize === 'function') {
                            map.invalidateSize();
                        }
                    });
                }
                
                // ========================================
                // KRİTİK FİX: SADECE CART DOLUYSA ROTA ÇİZ
                // ========================================
                // Rotaları yeniden çiz - AMA SADECE cart dolu ve polyline data varsa
                if (window.cart && window.cart.length > 0 && 
                    window.directionsPolylines && Object.keys(window.directionsPolylines).length > 0 &&
                    typeof renderRouteForDay === 'function') {
                    const days = [...new Set(window.cart.map(i => i.day))];
                    days.forEach(d => renderRouteForDay(d));
                } else {
                    console.log('[toggleSidebarTrip] Skipping route render - cart is empty or no polyline data');
                }
                // ========================================
                
                // Haritayı tekrar göster (smooth fade-in)
                setTimeout(() => {
                    if (miniMapContainer) {
                        miniMapContainer.style.opacity = '1';
                    }
                }, 50);
            }, 300);
        }
    };

    window.toggleSidebarMyTrips = function() {
        window.toggleSidebar('sidebar-overlay-mytrips');
    };

    window.toggleSidebarPrivacyTerms = function() {
        window.toggleSidebar('sidebar-overlay-privacyterms');
    };
});


// Sidebar açma fonksiyonları (kısa versiyonlar)
function toggleSidebarGallery() {
    const sidebar = document.getElementById('sidebar-gallery');
    if (sidebar && !sidebar.classList.contains('open')) sidebar.classList.add('open');
}

function toggleSidebarUpdates() {
    const sidebar = document.getElementById('sidebar-updates');
    if (sidebar && !sidebar.classList.contains('open')) sidebar.classList.add('open');
}

function toggleSidebarLogin() {
    const sidebar = document.getElementById('sidebar-login');
    if (sidebar && !sidebar.classList.contains('open')) sidebar.classList.add('open');
}

function toggleSidebarFavoritePlaces() {
    const sidebar = document.getElementById('sidebar-favorite-places');
    if (sidebar && !sidebar.classList.contains('open')) sidebar.classList.add('open');
}

function toggleSidebarFeedback() {
    const sidebar = document.getElementById('sidebar-feedback');
    if (sidebar && !sidebar.classList.contains('open')) sidebar.classList.add('open');
}

function toggleSidebarTrip() {
    const sidebar = document.getElementById('sidebar-trip');
    if (sidebar && !sidebar.classList.contains('open')) sidebar.classList.add('open');
}

window.toggleSidebarFavoritePlaces = function() {
    const favPanel = document.getElementById('sidebar-overlay-favorite-places');
    
    // DURUM 1: Panel şu an AÇIKSA (Demek ki kullanıcı X butonuna bastı ve kapatmak istiyor)
    if (favPanel && favPanel.classList.contains('open')) {
        // 1. My Places'i kapat
        favPanel.classList.remove('open');
        
        // 2. "Gezi" Sidebar'ını (Trip Planını) geri aç
        const tripPanel = document.getElementById('sidebar-overlay-trip');
        if (tripPanel) {
            tripPanel.classList.add('open');
            
            // SCROLL POZİSYONU RESTORE: Kaydedilmiş pozisyona dön
            setTimeout(() => {
                if (window.sidebarScrollPositions && typeof window.sidebarScrollPositions.trip !== 'undefined') {
                    tripPanel.scrollTop = window.sidebarScrollPositions.trip;
                    console.log('[Scroll Restore] Trip position restored after closing My Places:', window.sidebarScrollPositions.trip);
                } else {
                    // Kaydedilmiş pozisyon yoksa en üste git
                    tripPanel.scrollTop = 0;
                }
                
                const sidebarContent = tripPanel.querySelector('.sidebar-trip, .sidebar-content, [class*="sidebar"]');
                if (sidebarContent && window.sidebarScrollPositions && typeof window.sidebarScrollPositions.trip !== 'undefined') {
                    sidebarContent.scrollTop = 0;
                }
            }, 350); // Harita ve rota animasyonlarından sonra
        }
        
        // 3. MOBİL HARİTA FİXİ: Panel kapandıktan sonra haritayı yenile
        // Harita container'ını bul ve geçici olarak gizle
        const miniMapContainer = document.querySelector('.mini-map-container, #mini-map, .leaflet-container');
        if (miniMapContainer) {
            miniMapContainer.style.opacity = '0';
            miniMapContainer.style.transition = 'opacity 0.15s ease';
        }
        
        setTimeout(() => {
            // Küçük harita (mini map)
            if (window.miniMap && typeof window.miniMap.invalidateSize === 'function') {
                window.miniMap.invalidateSize();
                console.log('[Fix] Mini map invalidated after closing My Places');
            }
            
            // Ana harita
            if (window.map && typeof window.map.invalidateSize === 'function') {
                window.map.invalidateSize();
                console.log('[Fix] Main map invalidated after closing My Places');
            }
            
            // Leaflet haritalar
            if (window.leafletMaps) {
                Object.values(window.leafletMaps).forEach(map => {
                    if (map && typeof map.invalidateSize === 'function') {
                        map.invalidateSize();
                    }
                });
            }
            
            // Rotaları yeniden çiz (varsa)
            if (window.cart && window.cart.length > 0 && typeof renderRouteForDay === 'function') {
                const days = [...new Set(window.cart.map(i => i.day))];
                days.forEach(d => renderRouteForDay(d));
            }
            
            // Haritayı tekrar göster (smooth fade-in)
            setTimeout(() => {
                if (miniMapContainer) {
                    miniMapContainer.style.opacity = '1';
                }
            }, 50);
        }, 300); // Panel kapanma animasyonu için bekle
    } 
    // DURUM 2: Panel KAPALIYSA (Demek ki kullanıcı "My Places" butonuna bastı ve açmak istiyor)
    else {
        // Standart açma işlemi (diğerlerini kapatır, bunu açar)
        window.toggleSidebar('sidebar-overlay-favorite-places');
        
        // My Places panelini en üste scroll et
        setTimeout(() => {
            if (favPanel) {
                favPanel.scrollTop = 0;
                const sidebarContent = favPanel.querySelector('.sidebar-content, [class*="sidebar"]');
                if (sidebarContent) {
                    sidebarContent.scrollTop = 0;
                }
            }
        }, 50);
        
        // İçeriği yükle/yenile
        if (typeof renderFavoritePlacesPanel === 'function') {
            renderFavoritePlacesPanel();
        }
    }
};

window.toggleSidebarMyTrips = function(event) {
    const sidebarMyTripsOverlay = document.getElementById('sidebar-overlay-mytrips');
    const sidebarDefaultOverlay = document.getElementById('sidebar-overlay-default');

    if ((event && event.target.tagName === 'A' && event.target.href.includes('trip_details.php')) || 
        (sidebarMyTripsOverlay && sidebarMyTripsOverlay.classList.contains('open') && event && event.target.closest('#sidebar-mytrips'))) {
        if (sidebarMyTripsOverlay) sidebarMyTripsOverlay.classList.add('open');
        if (sidebarDefaultOverlay) sidebarDefaultOverlay.classList.remove('open');
        if (event) event.stopPropagation();
        return;
    }

    const wasOpen = sidebarMyTripsOverlay && sidebarMyTripsOverlay.classList.contains('open');
    
    if (wasOpen) {
        sidebarMyTripsOverlay.classList.remove('open');
        if (sidebarDefaultOverlay) sidebarDefaultOverlay.classList.add('open');
    } else if (sidebarMyTripsOverlay) {
        sidebarMyTripsOverlay.classList.add('open');
        if (sidebarDefaultOverlay) sidebarDefaultOverlay.classList.remove('open');
        
        // Sidebar'ı en üste scroll et
        setTimeout(() => {
            sidebarMyTripsOverlay.scrollTop = 0;
            const sidebarContent = sidebarMyTripsOverlay.querySelector('.sidebar-content, [class*="sidebar"]');
            if (sidebarContent) {
                sidebarContent.scrollTop = 0;
            }
        }, 50);
        
        // HARITA FIX: My Trips açılırken
        const miniMapContainer = document.querySelector('.mini-map-container, #mini-map, .leaflet-container');
        if (miniMapContainer) {
            miniMapContainer.style.opacity = '0';
            miniMapContainer.style.transition = 'opacity 0.15s ease';
        }
        
        setTimeout(() => {
            if (window.miniMap && typeof window.miniMap.invalidateSize === 'function') {
                window.miniMap.invalidateSize();
            }
            if (window.map && typeof window.map.invalidateSize === 'function') {
                window.map.invalidateSize();
            }
            if (window.leafletMaps) {
                Object.values(window.leafletMaps).forEach(map => {
                    if (map && typeof map.invalidateSize === 'function') {
                        map.invalidateSize();
                    }
                });
            }
            
            setTimeout(() => {
                if (miniMapContainer) {
                    miniMapContainer.style.opacity = '1';
                }
            }, 50);
        }, 300);
    }
    
    if (sidebarMyTripsOverlay && sidebarMyTripsOverlay.classList.contains('open') && typeof updateMyTripsPanel === 'function') {
        updateMyTripsPanel();
    }
};

function openMyTripsSidebar() {
    const sidebarMyTripsOverlay = document.getElementById('sidebar-overlay-mytrips');
    const sidebarDefaultOverlay = document.getElementById('sidebar-overlay-default');
    if (sidebarMyTripsOverlay) sidebarMyTripsOverlay.classList.add('open');
    if (sidebarDefaultOverlay) sidebarDefaultOverlay.classList.remove('open');
}

document.addEventListener('DOMContentLoaded', function() {
    if (window.location.href.includes('trip_details.php')) {
        openMyTripsSidebar();
    }
});

function toggleSidebarPrivacyTerms() {
    const sidebar = document.getElementById('sidebar-privacyterms');
    if (sidebar && !sidebar.classList.contains('open')) sidebar.classList.add('open');
}

// Mobile sidebar controls
document.addEventListener("DOMContentLoaded", function () {
    const openSidebarBtn = document.getElementById('open-sidebar-btn');
    const closeSidebarBtn = document.getElementById('close-sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay-default');

    if (openSidebarBtn) {
        openSidebarBtn.addEventListener('click', () => {
            if (sidebarOverlay) sidebarOverlay.style.display = 'block';
        });
    }

    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', () => {
            if (sidebarOverlay) sidebarOverlay.style.display = 'none';
        });
    }
    
    // SCROLL POZİSYONU KAYDETME SİSTEMİ
    window.sidebarScrollPositions = window.sidebarScrollPositions || {};
    
    // Trip sidebar scroll pozisyonunu kaydet
    function saveTripScrollPosition() {
        const tripSidebar = document.getElementById('sidebar-overlay-trip');
        if (tripSidebar) {
            window.sidebarScrollPositions.trip = tripSidebar.scrollTop;
            console.log('[Scroll Save] Trip scroll position saved:', tripSidebar.scrollTop);
        }
    }
    
    // Trip sidebar scroll pozisyonunu geri yükle
    function restoreTripScrollPosition() {
        const tripSidebar = document.getElementById('sidebar-overlay-trip');
        if (tripSidebar && typeof window.sidebarScrollPositions.trip !== 'undefined') {
            setTimeout(() => {
                tripSidebar.scrollTop = window.sidebarScrollPositions.trip;
                console.log('[Scroll Restore] Trip scroll position restored:', window.sidebarScrollPositions.trip);
            }, 100);
        }
    }
    
    // ADD ITEM BUTONU İÇİN SCROLL TO TOP
    // Event delegation kullanarak dinamik butonları da yakala
    document.addEventListener('click', function(e) {
        const addMoreBtn = e.target.closest('.add-more-btn, .add-category-btn, [class*="add-item"], [class*="add-cat"]');
        
        if (addMoreBtn) {
            console.log('[Scroll Fix] Add Item button clicked, scrolling to top');
            
            // Önce mevcut pozisyonu kaydet
            saveTripScrollPosition();
            
            // Trip sidebar'ını bul ve en üste scroll et
            setTimeout(() => {
                const tripSidebar = document.getElementById('sidebar-overlay-trip');
                if (tripSidebar && tripSidebar.classList.contains('open')) {
                    tripSidebar.scrollTop = 0;
                    
                    // İçindeki content'i de scroll et
                    const sidebarContent = tripSidebar.querySelector('.sidebar-trip, .sidebar-content, [class*="sidebar"]');
                    if (sidebarContent) {
                        sidebarContent.scrollTop = 0;
                    }
                    
                    console.log('[Scroll Fix] Scrolled to top after Add Item click');
                }
            }, 100); // Kategori listesi açılsın diye biraz bekle
        }
    });
    
    // MY PLACES BUTONU İÇİN SCROLL TO TOP VE POZİSYON KAYDETME
    document.addEventListener('click', function(e) {
        const myPlacesBtn = e.target.closest('.my-places-btn, .add-favorite-place-btn, [data-role="my-places-btn"]');
        
        if (myPlacesBtn) {
            console.log('[Scroll Fix] My Places button clicked, saving position');
            
            // Mevcut Trip pozisyonunu kaydet
            saveTripScrollPosition();
            
            setTimeout(() => {
                const favSidebar = document.getElementById('sidebar-overlay-favorite-places');
                if (favSidebar && favSidebar.classList.contains('open')) {
                    favSidebar.scrollTop = 0;
                    
                    const sidebarContent = favSidebar.querySelector('.sidebar-content, [class*="sidebar"]');
                    if (sidebarContent) {
                        sidebarContent.scrollTop = 0;
                    }
                    
                    console.log('[Scroll Fix] Scrolled My Places to top');
                }
            }, 150);
        }
    });
    
    // KATEGORİ LİSTESİ VEYA DİĞER OVERLAY KAPANIRKEN POZİSYONU GERİ YÜKLE
    // Global olarak ESC tuşu ve overlay kapatma işlemlerini dinle
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            setTimeout(restoreTripScrollPosition, 200);
        }
    });
    
    // Overlay kapatma butonlarını dinle (X, Cancel, Close vb.)
    document.addEventListener('click', function(e) {
        const closeBtn = e.target.closest('.close-btn, .cancel-btn, [class*="close"], [class*="cancel"], .overlay-close');
        if (closeBtn) {
            setTimeout(restoreTripScrollPosition, 200);
        }
    });

});

function openTripSidebar() {
    // toggleSidebarTrip kullanarak aç - böylece harita fix'i otomatik çalışır
    const tripSidebar = document.getElementById("sidebar-overlay-trip");
    if (tripSidebar && !tripSidebar.classList.contains("open")) {
        if (typeof window.toggleSidebarTrip === 'function') {
            window.toggleSidebarTrip();
        } else {
            tripSidebar.classList.add("open");
        }
    }
}

function closeSidebar() {
    const sidebar = document.querySelector(".sidebar-trip");
    if (sidebar && sidebar.classList.contains("open")) {
        sidebar.classList.remove("open");
    }
}

// Gallery items
document.querySelectorAll(".gallery-item").forEach(item => {
    item.addEventListener("click", function () {
        const captionText = this.querySelector(".caption p")?.innerText || "";
        const input = document.getElementById("user-input");
        if (input) {
            input.value = captionText;
            input.focus();
        }

        const sidebar = document.getElementById('sidebar');
        const gallery = document.getElementById('gallery');
        if (sidebar) sidebar.classList.remove('open');
        if (gallery) gallery.classList.remove('open');
    });
});

// Menu box trigger
document.addEventListener('DOMContentLoaded', function () {
    const menuBox = document.querySelector('.menuBox');
    const dropdown = document.getElementById('menuDropdown');
    const hamburger = document.querySelector('.menuBox .toggleMenu');

    if (hamburger) {
        hamburger.removeAttribute('onclick');
    }

    if (menuBox && dropdown) {
        menuBox.addEventListener('click', function (e) {
            if (e.target.closest('#menuDropdown')) return;
            if (typeof toggleMenu === 'function') toggleMenu();
        });
    }

    document.addEventListener('click', function (event) {
        if (!event.target.closest('.menuBox')) {
            const dd = document.getElementById('menuDropdown');
            if (dd) dd.classList.remove('show');
        }
    });
});

// About Triptime overlay
(function () {
    function ensureAboutOverlayStyles() {
        if (document.getElementById('tt-about-overlay-style')) return;
        const style = document.createElement('style');
        style.id = 'tt-about-overlay-style';
        style.textContent = `
            #tt-about-us.tt-overlay {
                z-index: 150;
                background: #fff;
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
                display: block !important;
            }
        `;
        document.head.appendChild(style);
    }

    window.showAboutTriptime = function () {
        ensureAboutOverlayStyles();
        const about = document.getElementById('tt-about-us');
        const welcome = document.getElementById('tt-welcome');
        const mainChat = document.getElementById('main-chat');
        
        if (!about) return;

        if (welcome) welcome.style.display = 'none';
        
        about.classList.add('tt-overlay', 'active');
        about.style.display = 'block';
        about.style.zIndex = '150';
        about.style.background = '#fff';
        about.style.overflowY = 'auto';
        
        if (mainChat) mainChat.style.display = 'none';

        try { about.scrollTop = 0; } catch (_) {}
        try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (_) { window.scrollTo(0, 0); }
    };
})();

// Start map button
document.addEventListener('click', function(e){
    if (e.target && e.target.id === 'start-map-btn') {
        const trip = document.getElementById('sidebar-overlay-trip');
        if (trip) {
            trip.classList.add('open');
            if (!trip.classList.contains('sidebar-trip')) {
                trip.classList.add('sidebar-trip');
            }
            document.querySelectorAll('.sidebar-overlay.open').forEach(el => {
                if (el !== trip) el.classList.remove('open');
            });
        }
    }
});


// Basitleştirilmiş changeContent
function changeContent(option) {
    const welcomeSection = document.getElementById('tt-welcome');
    const aboutUsSection = document.getElementById('tt-about-us');
    const mainChat = document.getElementById('main-chat');
    const chatBox = document.getElementById('chat-box');
    
    if (option === 1) {
        // Welcome ekranına dön
        if (aboutUsSection) {
            aboutUsSection.style.display = 'none';
            aboutUsSection.classList.remove('active', 'tt-overlay');
        }
        if (welcomeSection) {
            welcomeSection.style.display = 'block';
            welcomeSection.classList.add('active');
        }
        if (mainChat) mainChat.style.display = 'flex';
        if (chatBox) chatBox.style.display = 'block';

        // URL'den #about-triptime hash'ini kaldır (YENİ EKLENDİ)
        if (window.location.hash === "#about-triptime") {
            window.history.pushState("", document.title, window.location.pathname + window.location.search);
        }
    } else if (option === 2) {
        // About ekranını göster
        if (typeof window.showAboutTriptime === 'function') {
            window.showAboutTriptime();
        }
    }
}

// About dışına tıklayınca kapatma
document.addEventListener('click', function(event) {
    const aboutUsSection = document.getElementById('tt-about-us');
    const chatBox = document.getElementById('chat-box');
    const ttIcon = document.getElementById("about-icon");
    
    if (aboutUsSection && aboutUsSection.classList.contains('tt-overlay')) {
        const clickedInsideAboutUs = aboutUsSection.contains(event.target);
        const clickedOnTtIcon = ttIcon && ttIcon.contains(event.target);
        const clickedOnUpdates = event.target.closest('.updates-btn');

        if (!clickedInsideAboutUs && !clickedOnTtIcon && !clickedOnUpdates) {
            // 1. About'u gizle
            aboutUsSection.style.display = 'none';
            aboutUsSection.classList.remove('active', 'tt-overlay');

            // 2. URL'den #about-triptime hash'ini kaldır (YENİ EKLENDİ)
            if (window.location.hash === "#about-triptime") {
                window.history.pushState("", document.title, window.location.pathname + window.location.search);
            }

            // 3. Diğer ekranları göster
            if (chatBox) chatBox.style.display = 'block';
            if (document.getElementById('main-chat')) document.getElementById('main-chat').style.display = 'flex';
            
            const welcome = document.getElementById('tt-welcome');
            if (welcome) {
                welcome.style.display = 'block';
                welcome.classList.add('active');
            }
        }
    }
});