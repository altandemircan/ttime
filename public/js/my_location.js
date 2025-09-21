

// 1. Konum markerları için global değişken (gün bazlı)
window.userLocationMarkersByDay = window.userLocationMarkersByDay || {};
window.isLocationActiveByDay = window.isLocationActiveByDay || {};

// 2. Konum alma fonksiyonu (sadece butonla tetiklenir)
function getMyLocation(day, expandedMap) {
    if (!navigator.geolocation) {
        alert('Tarayıcınız konum özelliğini desteklemiyor.');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        function(position) {
            showLocationOnMap(position, day, expandedMap);
        },
        function(error) {},
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


function showLocationOnMap(position, day, expandedMap) {
    if (!window.isLocationActiveByDay[day]) return;

    // Eski markerları temizle
    if (window.userLocationMarkersByDay[day]) {
        window.userLocationMarkersByDay[day].forEach(marker => {
            if (expandedMap.hasLayer(marker)) expandedMap.removeLayer(marker);
        });
    }
    window.userLocationMarkersByDay[day] = [];

    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    // *** ÖNEMLİ: L.divIcon ile animasyonlu kalp marker ***
    const userIcon = L.divIcon({
        className: 'custom-lds-ripple-marker', // Ekstra class (CSS için)
        html: '<div class="lds-ripple"><div></div><div></div></div>',
        iconSize: [44, 44],       // isteğe göre boyut
        iconAnchor: [22, 44],     // alt ucu harita noktasına gelsin diye
        popupAnchor: [0, -36]
    });

    const marker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(expandedMap);
    marker.bindPopup("You are here!").openPopup();
    window.userLocationMarkersByDay[day].push(marker);
}

function disableUseMyLocationBtn(day) {
    const btn = document.getElementById(`use-my-location-btn-day${day}`);
    if (btn) btn.disabled = true;
}
function enableUseMyLocationBtn(day) {
    const btn = document.getElementById(`use-my-location-btn-day${day}`);
    if (btn) btn.disabled = false;
}

