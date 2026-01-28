// 1. Konum markerları için global değişken (gün bazlı)
window.userLocationMarkersByDay = window.userLocationMarkersByDay || {};
window.isLocationActiveByDay = window.isLocationActiveByDay || {};

// 2. Konum alma fonksiyonu (sadece butonla tetiklenir)
function getMyLocation(day, expandedMap) {
    if (!navigator.geolocation) {
        alert('Your browser does not support geolocation.');
        return;
    }

    // Aktiflik durumunu işaretle
    window.isLocationActiveByDay[day] = true;

    navigator.geolocation.getCurrentPosition(
        function(position) {
            showLocationOnMap(position, day, expandedMap);
        },
        function(error) { console.warn("Location error:", error); },
        {
            enableHighAccuracy: false,
            timeout: 3000,
            maximumAge: 600000
        }
    );

    setTimeout(() => {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                showLocationOnMap(position, day, expandedMap, true);
            },
            function(error) {},
            {
                enableHighAccuracy: true,
                timeout: 8000,
                maximumAge: 0
            }
        );
    }, 1000);
}

// [FIX] Mainscript uyumluluğu için fonksiyonu global window nesnesine ata
window.updateUserLocationMarker = function(position, day, expandedMap) {
    showLocationOnMap(position, day, expandedMap);
};

// Harita üzerinde konumu gösteren ana fonksiyon
function showLocationOnMap(position, day, expandedMap) {
    // 1. Eksik parametre kontrolü (Mainscript bazen sadece position gönderebilir)
    if (!day) day = window.currentDay || 1;
    
    // 2. Harita nesnesi yoksa bulmaya çalış
    if (!expandedMap) {
        // Global expandedMaps dizisinden o güne ait haritayı bul
        if (window.expandedMaps && window.expandedMaps[`route-map-day${day}`]) {
            expandedMap = window.expandedMaps[`route-map-day${day}`].expandedMap;
        } else if (window.leafletMaps && window.leafletMaps[day]) {
            // Küçük harita yedeği
            expandedMap = window.leafletMaps[day];
        }
    }

    // Harita hala yoksa veya konum aktif değilse çık
    if (!expandedMap) return;
    
    // Butona basıldığında aktiflik bayrağını zorla aç (Eğer kapalıysa)
    if (!window.isLocationActiveByDay[day]) window.isLocationActiveByDay[day] = true;

    // Eski markerları temizle
    if (window.userLocationMarkersByDay[day]) {
        window.userLocationMarkersByDay[day].forEach(marker => {
            try {
                if (expandedMap.hasLayer(marker)) expandedMap.removeLayer(marker);
            } catch(e) {}
        });
    }
    window.userLocationMarkersByDay[day] = [];

    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    // *** L.divIcon ile animasyonlu kalp marker ***
    const userIcon = L.divIcon({
        className: 'custom-lds-ripple-marker', 
        html: '<div class="lds-ripple"><div></div><div></div></div>',
        iconSize: [44, 44],       
        iconAnchor: [22, 44],     
        popupAnchor: [0, -36]
    });

    const marker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(expandedMap);
    marker.bindPopup("You are here!").openPopup();
    window.userLocationMarkersByDay[day].push(marker);
    
    // Haritayı konuma ortala (İsteğe bağlı, konumu bulduğunu hissettirir)
    // expandedMap.setView([lat, lng], 15);
}

function disableUseMyLocationBtn(day) {
    const btn = document.getElementById(`use-my-location-btn-day${day}`);
    if (btn) btn.disabled = true;
}
function enableUseMyLocationBtn(day) {
    const btn = document.getElementById(`use-my-location-btn-day${day}`);
    if (btn) btn.disabled = false;
}