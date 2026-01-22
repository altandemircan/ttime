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

        setTimeout(() => {
            if (window.leafletMaps) {
                Object.values(window.leafletMaps).forEach(map => {
                    map.invalidateSize();
                });
            }
            
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

// --- ABOUT DIŞARI TIKLAYINCA KAPATMA ---
document.addEventListener('click', function(event) {
    const aboutUsSection = document.getElementById('tt-about-us');
    if (aboutUsSection && aboutUsSection.style.display === 'block') {
        if (!aboutUsSection.contains(event.target) && 
            !event.target.closest('.updates-btn') && 
            !event.target.closest('#about-icon')) {
            
            aboutUsSection.style.display = 'none';
            aboutUsSection.classList.remove('active', 'tt-overlay');

            if (document.getElementById('main-chat')) document.getElementById('main-chat').style.display = 'flex';
            if (document.getElementById('chat-box')) document.getElementById('chat-box').style.display = 'block';
            if (document.getElementById('tt-welcome')) {
                document.getElementById('tt-welcome').style.display = 'block';
                document.getElementById('tt-welcome').classList.add('active');
            }
        }
    }
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
    window.toggleSidebar('sidebar-overlay-favorite-places');
    const favPanel = document.getElementById('sidebar-overlay-favorite-places');
    if (favPanel && favPanel.classList.contains('open') && typeof renderFavoritePlacesPanel === 'function') {
        renderFavoritePlacesPanel();
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

    if (sidebarMyTripsOverlay && sidebarMyTripsOverlay.classList.contains('open')) {
        sidebarMyTripsOverlay.classList.remove('open');
        if (sidebarDefaultOverlay) sidebarDefaultOverlay.classList.add('open');
    } else if (sidebarMyTripsOverlay) {
        sidebarMyTripsOverlay.classList.add('open');
        if (sidebarDefaultOverlay) sidebarDefaultOverlay.classList.remove('open');
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
            aboutUsSection.style.display = 'none';
            aboutUsSection.classList.remove('active', 'tt-overlay');

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