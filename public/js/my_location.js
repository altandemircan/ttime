// ==========================================
// MY LOCATION MODULE (FIXED)
// ==========================================

// 1. Global değişkenleri ve fonksiyonları EN BAŞTA tanımla
window.userLocationMarkersByDay = window.userLocationMarkersByDay || {};
window.isLocationActiveByDay = window.isLocationActiveByDay || {};

// [FIX] Mainscript bu fonksiyonu arıyor, en başa koyduk ki hata vermesin.
window.updateUserLocationMarker = function(position, day, expandedMap) {
    showLocationOnMap(position, day, expandedMap);
};

// 2. İzin Değişikliklerini Dinle (Sayfa yenilemeyi önler)
// Kullanıcı tarayıcıdan "İzin Ver" dediği an bu kod devreye girer.
if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'geolocation' }).then(function(result) {
        result.onchange = function() {
            console.log("Geolocation permission state changed to:", result.state);
            // Eğer izin verildiyse ve o an aktif bir gün varsa, konumu hemen güncelle
            if (result.state === 'granted') {
                const currentDay = window.currentDay || 1;
                const btn = document.getElementById(`use-my-location-btn-day${currentDay}`);
                // Sadece buton aktifse veya tıklanmışsa işlem yap
                if (btn && window.isLocationActiveByDay[currentDay]) {
                    getMyLocation(currentDay, null); // Map'i içeride bulacak
                }
            }
        };
    });
}

// 3. Konum alma fonksiyonu (Buton tetikler)
function getMyLocation(day, expandedMap) {
    if (!navigator.geolocation) {
        alert('Your browser does not support geolocation.');
        return;
    }

    // Aktiflik durumunu işaretle
    window.isLocationActiveByDay[day] = true;

    // Loading hissi vermek için butona opacity ekleyebilirsin (isteğe bağlı)
    const btn = document.getElementById(`use-my-location-btn-day${day}`);
    if(btn) btn.style.opacity = "0.5";

    navigator.geolocation.getCurrentPosition(
        function(position) {
            if(btn) btn.style.opacity = "1";
            showLocationOnMap(position, day, expandedMap);
        },
        function(error) { 
            console.warn("Location error:", error); 
            if(btn) btn.style.opacity = "1";
            
            // Eğer hata izin reddi ise (Code 1)
            if (error.code === 1) {
                alert("Please allow location access in your browser settings to use this feature.");
            }
        },
        {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 600000
        }
    );

    // Daha hassas konum için ikinci deneme (arka planda)
    setTimeout(() => {
        if(window.isLocationActiveByDay[day]) {
            navigator.geolocation.getCurrentPosition(
                function(position) {
                    showLocationOnMap(position, day, expandedMap, true);
                },
                function(error) {},
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        }
    }, 2000);
}

// 4. Harita üzerinde konumu gösteren ana fonksiyon
function showLocationOnMap(position, day, expandedMap) {
    // A. Eksik parametre kontrolü (Otomatik tamamlama)
    if (!day) day = window.currentDay || 1;
    
    // B. Harita nesnesi yoksa bulmaya çalış
    if (!expandedMap) {
        // Global expandedMaps dizisinden o güne ait haritayı bul
        if (window.expandedMaps && window.expandedMaps[`route-map-day${day}`]) {
            expandedMap = window.expandedMaps[`route-map-day${day}`].expandedMap;
        } else if (window.leafletMaps && window.leafletMaps[day]) {
            // Küçük harita yedeği
            expandedMap = window.leafletMaps[day];
        } else if (window._currentMap) {
            // Hiçbiri yoksa son aktif harita
            expandedMap = window._currentMap;
        }
    }

    // Harita hala yoksa çık
    if (!expandedMap) return;
    
    // Konum takibi kapalıysa işlem yapma (Ancak butonla çağrıldıysa zorla aç)
    if (!window.isLocationActiveByDay[day]) window.isLocationActiveByDay[day] = true;

    // C. Eski markerları temizle
    if (window.userLocationMarkersByDay[day]) {
        window.userLocationMarkersByDay[day].forEach(marker => {
            try {
                if (expandedMap.hasLayer(marker)) expandedMap.removeLayer(marker);
                // Eğer 3D haritaysa ve marker bir DOM elementiyse
                if (marker.remove) marker.remove(); 
            } catch(e) {}
        });
    }
    window.userLocationMarkersByDay[day] = [];

    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    // D. Harita Tipine Göre Marker Ekleme
    const isMapLibre = !!expandedMap.addSource; // MapLibre kontrolü

    if (isMapLibre) {
        // --- 3D Harita (MapLibre) ---
        const el = document.createElement('div');
        el.className = 'custom-lds-ripple-marker';
        el.innerHTML = '<div class="lds-ripple"><div></div><div></div></div>';
        // CSS ile boyutlandırma yapılmalı, inline style da verilebilir
        el.style.width = '44px';
        el.style.height = '44px';

        const marker = new maplibregl.Marker({ element: el })
            .setLngLat([lng, lat])
            .setPopup(new maplibregl.Popup({ offset: 25 }).setText("You are here!"))
            .addTo(expandedMap);
            
        window.userLocationMarkersByDay[day].push(marker);
        
        // İlk açılışta hafifçe oraya uç
        expandedMap.flyTo({ center: [lng, lat], zoom: 15, essential: true });

    } else {
        // --- 2D Harita (Leaflet) ---
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
        
        // Ortala
        expandedMap.setView([lat, lng], 15);
    }
}

function disableUseMyLocationBtn(day) {
    const btn = document.getElementById(`use-my-location-btn-day${day}`);
    if (btn) btn.disabled = true;
}
function enableUseMyLocationBtn(day) {
    const btn = document.getElementById(`use-my-location-btn-day${day}`);
    if (btn) btn.disabled = false;
}