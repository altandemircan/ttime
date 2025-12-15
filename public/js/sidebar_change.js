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
        allSidebars.forEach(sidebar => {
            if (sidebar.id !== sidebarId) {
                sidebar.classList.remove('open');
            }
        });
        clickedSidebar.classList.toggle('open');
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
    window.toggleSidebar('sidebar-overlay-trip');

    // --- MOBİL HARİTA DÜZELTMESİ (Görünmeyen haritayı yeniden boyutlandır) ---
    // CSS transition süresi (0.3s) kadar bekleyip haritayı tazeliyoruz.
    setTimeout(() => {
        // 1. Tüm açık haritaların boyutunu güncelle
        if (window.leafletMaps) {
            Object.values(window.leafletMaps).forEach(map => {
                map.invalidateSize();
            });
        }
        
        // 2. Rotaları tekrar çizdir ki markerlar yerine otursun (Garanti Çözüm)
        if (window.cart && window.cart.length > 0 && typeof renderRouteForDay === 'function') {
             const days = [...new Set(window.cart.map(i => i.day))];
             days.forEach(d => renderRouteForDay(d));
        }
    }, 350);
};

window.toggleSidebarMyTrips = function() {
    window.toggleSidebar('sidebar-overlay-mytrips');
};

window.toggleSidebarPrivacyTerms = function() {
    window.toggleSidebar('sidebar-overlay-privacyterms');
};
});


// Ana Menü açma fonksiyonu (Sadece açma)
function toggleSidebarGallery() {
    const sidebarGallery = document.getElementById('sidebar-gallery');
    if (sidebarGallery && !sidebarGallery.classList.contains('open')) {
        sidebarGallery.classList.add('open');
        const sidebarOverlayGallery = document.getElementById('sidebar-overlay-gallery');
        if (sidebarOverlayGallery) sidebarOverlayGallery.classList.add('show');
    }
}

// Dil seçeneklerini açma fonksiyonu (Sadece açma)
function toggleSidebarUpdates() {
    const sidebarUpdates = document.getElementById('sidebar-updates');
    if (sidebarUpdates && !sidebarUpdates.classList.contains('open')) {
        sidebarUpdates.classList.add('open');
        const sidebarOverlayUpdates = document.getElementById('sidebar-overlay-updates');
        if (sidebarOverlayUpdates) sidebarOverlayUpdates.classList.add('show');
    }
}

function toggleSidebarLogin() {
    const sidebarLogin = document.getElementById('sidebar-login');
    if (sidebarLogin && !sidebarLogin.classList.contains('open')) {
        sidebarLogin.classList.add('open');
        const sidebarOverlayLogin = document.getElementById('sidebar-overlay-login');
        if (sidebarOverlayLogin) sidebarOverlayLogin.classList.add('show');
    }
}

function toggleSidebarFavoritePlaces() {
    const sidebarSettings = document.getElementById('sidebar-favorite-places');
    if (sidebarSettings && !sidebarSettings.classList.contains('open')) {
        sidebarSettings.classList.add('open');
        const sidebarOverlaySettings = document.getElementById('sidebar-overlay-favorite-places');
        if (sidebarOverlaySettings) sidebarOverlaySettings.classList.add('show');
    }
}

function toggleSidebarFeedback() {
    const sidebarFeedback = document.getElementById('sidebar-feedback');
    if (sidebarFeedback && !sidebarFeedback.classList.contains('open')) {
        sidebarFeedback.classList.add('open');
        const sidebarOverlayFeedback = document.getElementById('sidebar-overlay-feedback');
        if (sidebarOverlayFeedback) sidebarOverlayFeedback.classList.add('show');
    }
}

function toggleSidebarTrip() {
    const sidebarTrip = document.getElementById('sidebar-trip');
    if (sidebarTrip && !sidebarTrip.classList.contains('open')) {
        sidebarTrip.classList.add('open');
        const sidebarOverlayTrip = document.getElementById('sidebar-overlay-trip');
        if (sidebarOverlayTrip) sidebarOverlayTrip.classList.add('show');
    }
}

window.toggleSidebarFavoritePlaces = function() {
    window.toggleSidebar('sidebar-overlay-favorite-places');
    const favPanelOverlay = document.getElementById('sidebar-overlay-favorite-places');
    if (favPanelOverlay && favPanelOverlay.classList.contains('open')) {
        renderFavoritePlacesPanel();
    }
};

window.toggleSidebarMyTrips = function(event) {
    const sidebarMyTripsOverlay = document.getElementById('sidebar-overlay-mytrips');
    const sidebar = document.getElementById('sidebar-overlay-mytrips');
    if (sidebar) {
        sidebar.classList.toggle('show');
        if (sidebar.classList.contains('show')) {
            if (typeof updateMyTripsPanel === 'function') updateMyTripsPanel();
        }
    }
    const sidebarDefaultOverlay = document.getElementById('sidebar-overlay-default');

    if ((event && event.target.tagName === 'A' && event.target.href.includes('trip_details.php')) || (sidebarMyTripsOverlay && sidebarMyTripsOverlay.classList.contains('open') && event && event.target.closest('#sidebar-mytrips'))) {
        if (sidebarMyTripsOverlay) sidebarMyTripsOverlay.classList.add('open');
        if (sidebarDefaultOverlay) sidebarDefaultOverlay.classList.remove('open');
        if (event) event.stopPropagation();
        return;
    }

    if (sidebarMyTripsOverlay && sidebarMyTripsOverlay.classList.contains('open')) {
        sidebarMyTripsOverlay.classList.remove('open');
        if (sidebarDefaultOverlay) sidebarDefaultOverlay.classList.add('open');
    } else if (sidebarMyTripsOverlay) {
        sidebarMyTripsOverlay.classList.add('open');
        if (sidebarDefaultOverlay) sidebarDefaultOverlay.classList.remove('open');
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
    const sidebarPrivacyTerms = document.getElementById('sidebar-privacyterms');
    if (sidebarPrivacyTerms && !sidebarPrivacyTerms.classList.contains('open')) {
        sidebarPrivacyTerms.classList.add('open');
        const sidebarOverlayPrivacyTerms = document.getElementById('sidebar-overlay-privacyterms');
        if (sidebarOverlayPrivacyTerms) sidebarOverlayPrivacyTerms.classList.add('show');
    }
}


// mobile 

document.addEventListener("DOMContentLoaded", function () {
    const openSidebarBtn = document.getElementById('open-sidebar-btn');
    const closeSidebarBtn = document.getElementById('close-sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay-default');

    if (openSidebarBtn) {
        openSidebarBtn.addEventListener('click', () => {
            if (sidebarOverlay) {
                sidebarOverlay.style.display = 'block';
            }
        });
    }

    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', () => {
            if (sidebarOverlay) {
                sidebarOverlay.style.display = 'none';
            }
        });
    }
});

function openTripSidebar() {
    const tripSidebar = document.getElementById("sidebar-overlay-trip");
    if (tripSidebar && !tripSidebar.classList.contains("open")) {
        tripSidebar.classList.add("open");
    }
}

function closeSidebar() {
    const sidebar = document.querySelector(".sidebar-trip");
    if (sidebar && sidebar.classList.contains("open")) {
        sidebar.classList.remove("open");
    }
}


// Gallery items: only write caption into input (no auto send)
document.querySelectorAll(".gallery-item").forEach(item => {
    item.addEventListener("click", function () {
        const captionText = this.querySelector(".caption p")?.innerText || "";
        const input = document.getElementById("user-input");
        if (input) {
            input.value = captionText;
            input.focus();
        }

        // Close gallery/sidebar if present
        const sidebar = document.getElementById('sidebar');
        const gallery = document.getElementById('gallery');
        if (sidebar) sidebar.classList.remove('open');
        if (gallery) gallery.classList.remove('open');
    });
});


// Make the whole capsule (profile icon + hamburger) one trigger
document.addEventListener('DOMContentLoaded', function () {
    const menuBox = document.querySelector('.menuBox');
    const dropdown = document.getElementById('menuDropdown');
    const hamburger = document.querySelector('.menuBox .toggleMenu');

    // Avoid double toggle from inline onclick on the hamburger
    if (hamburger) {
        hamburger.removeAttribute('onclick');
    }

    if (menuBox && dropdown) {
        menuBox.addEventListener('click', function (e) {
            // Ignore clicks inside the dropdown
            if (e.target.closest('#menuDropdown')) return;
            if (typeof toggleMenu === 'function') toggleMenu();
        });
    }

    // Click outside closes the dropdown (kept for safety if not already defined elsewhere)
    document.addEventListener('click', function (event) {
        if (!event.target.closest('.menuBox')) {
            const dd = document.getElementById('menuDropdown');
            if (dd) dd.classList.remove('show');
        }
    });
});


// Triptime "About" ekranını her durumda en üste getirir
(function () {
  function ensureAboutOverlayStyles() {
    if (document.getElementById('tt-about-overlay-style')) return;
    const style = document.createElement('style');
    style.id = 'tt-about-overlay-style';
    style.textContent = `
      #tt-about-us.tt-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
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
    if (!about) return;

    about.classList.add('tt-overlay');
    about.style.display = 'block';
    about.removeAttribute('hidden');
    about.setAttribute('aria-hidden', 'false');

    try { about.scrollTop = 0; } catch (_) {}
    try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (_) { window.scrollTo(0, 0); }
  };
})();

/* === START WITH MAP -> TRIP SIDEBAR OPEN (EKLENDİ) ===
   Dinamik oluşturulan #start-map-btn butonuna tıklanınca
   #sidebar-overlay-trip elementine 'open' sınıfı eklenir ve diğer açık sidebarlar kapanır.
*/
document.addEventListener('click', function(e){
    if (e.target && e.target.id === 'start-map-btn') {
        const trip = document.getElementById('sidebar-overlay-trip');
        if (trip) {
            trip.classList.add('open');
            if (!trip.classList.contains('sidebar-trip')) {
                trip.classList.add('sidebar-trip');
            }
            // Diğer açık side-barları kapat
            document.querySelectorAll('.sidebar-overlay.open').forEach(el=>{
                if (el !== trip) el.classList.remove('open');
            });
        }
    }
});