// ==========================================
// MY LOCATION MODULE (FIXED v2)
// ==========================================

// 1. Global değişkenleri ve fonksiyonları EN BAŞTA tanımla
window.userLocationMarkersByDay = window.userLocationMarkersByDay || {};
window.isLocationActiveByDay = window.isLocationActiveByDay || {};

// [FIX] Mainscript bu fonksiyonu arıyor, en başa koyduk ki hata vermesin.
// Artık iki overload destekliyor:
// - updateUserLocationMarker(position, day, expandedMap)  ← Eski format
// - updateUserLocationMarker(expandedMap, day, lat, lng, layer, shouldFetch)  ← mainscript.js format
window.updateUserLocationMarker = function(arg1, arg2, arg3, arg4, arg5, arg6) {
    // Format 1: position objesi gönderildi (my_location.js arayan)
    if (arg1 && arg1.coords && typeof arg1.coords.latitude === 'number') {
        const position = arg1;
        const day = arg2;
        const expandedMap = arg3;
        showLocationOnMap(position, day, expandedMap);
    }
    // Format 2: Harita objesi + koordinatlar (mainscript.js arayan)
    else if (arg1 && (arg1.getContainer || arg1.setView)) {
        const expandedMap = arg1;
        const day = arg2;
        const lat = arg3;
        const lng = arg4;
        const currentLayer = arg5;
        const shouldFetch = arg6;
        
        // Eğer lat/lng varsa, position objesi oluştur ve çiz
        if (typeof lat === 'number' && typeof lng === 'number') {
            const fakePosition = {
                coords: {
                    latitude: lat,
                    longitude: lng,
                    accuracy: 50
                }
            };
            showLocationOnMap(fakePosition, day, expandedMap);
        }
        // Eğer sadece harita varsa, eski markerları temizle
        else if (shouldFetch === false || lat === undefined) {
            clearLocationMarkers(day, expandedMap);
        }
    }
};

// Markerları temizleyen yardımcı fonksiyon
function clearLocationMarkers(day, expandedMap) {
    if (window.userLocationMarkersByDay[day]) {
        const mapObj = expandedMap || 
                      (window.expandedMaps && window.expandedMaps[`route-map-day${day}`] ? 
                       window.expandedMaps[`route-map-day${day}`].expandedMap : null);
        
        window.userLocationMarkersByDay[day].forEach(marker => {
            try {
                if (mapObj && mapObj.hasLayer && mapObj.hasLayer(marker)) {
                    mapObj.removeLayer(marker);
                } else if (marker.remove) {
                    marker.remove();
                }
            } catch(e) {}
        });
        window.userLocationMarkersByDay[day] = [];
    }
}

// 2. İzin Değişikliklerini Dinle (Sayfa yenilemeyi önler)
if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'geolocation' }).then(function(result) {
        result.onchange = function() {
            console.log("Geolocation permission state changed to:", result.state);
            if (result.state === 'granted') {
                const currentDay = window.currentDay || 1;
                const btn = document.getElementById(`use-my-location-btn-day${currentDay}`);
                if (btn && window.isLocationActiveByDay[currentDay]) {
                    getMyLocation(currentDay, null);
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

    window.isLocationActiveByDay[day] = true;

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
                    showLocationOnMap(position, day, expandedMap);
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
    if (!position || !position.coords) {
        console.warn("[showLocationOnMap] Invalid position object:", position);
        return;
    }

    if (!day) day = window.currentDay || 1;
    
    // B. Harita nesnesi yoksa bulmaya çalış
    if (!expandedMap) {
        if (window.expandedMaps && window.expandedMaps[`route-map-day${day}`]) {
            expandedMap = window.expandedMaps[`route-map-day${day}`].expandedMap;
        } else if (window.leafletMaps && window.leafletMaps[day]) {
            expandedMap = window.leafletMaps[day];
        } else if (window._currentMap) {
            expandedMap = window._currentMap;
        }
    }

    if (!expandedMap) {
        console.warn("[showLocationOnMap] No map found for day", day);
        return;
    }
    
    if (!window.isLocationActiveByDay[day]) window.isLocationActiveByDay[day] = true;

    // C. Eski markerları temizle
    if (window.userLocationMarkersByDay[day]) {
        window.userLocationMarkersByDay[day].forEach(marker => {
            try {
                if (expandedMap.hasLayer && expandedMap.hasLayer(marker)) {
                    expandedMap.removeLayer(marker);
                }
                if (marker.remove) marker.remove(); 
            } catch(e) {}
        });
    }
    window.userLocationMarkersByDay[day] = [];

    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    // D. Harita Tipine Göre Marker Ekleme
    const isMapLibre = !!(expandedMap && expandedMap.addSource); // MapLibre kontrolü

    if (isMapLibre) {
        // --- 3D Harita (MapLibre) ---
        const el = document.createElement('div');
        el.className = 'custom-lds-ripple-marker';
        el.innerHTML = '<div class="lds-ripple"><div></div><div></div></div>';
        el.style.width = '44px';
        el.style.height = '44px';

        const marker = new maplibregl.Marker({ element: el })
            .setLngLat([lng, lat])
            .setPopup(new maplibregl.Popup({ offset: 25 }).setText("You are here!"))
            .addTo(expandedMap);
            
        window.userLocationMarkersByDay[day].push(marker);
        expandedMap.flyTo({ center: [lng, lat], zoom: 15, essential: true });

    } else if (expandedMap && expandedMap.setView) {
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
        
        expandedMap.setView([lat, lng], 15);
    } else {
        console.warn("[showLocationOnMap] Map object type not recognized");
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