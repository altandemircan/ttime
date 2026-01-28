// ==========================================
// MY LOCATION MODULE (CLEAN & MINIMAL DESIGN)
// ==========================================

// 1. Initialize global variables and functions at the top
window.userLocationMarkersByDay = window.userLocationMarkersByDay || {};
window.isLocationActiveByDay = window.isLocationActiveByDay || {};

// [FIX] Main script calls this function, so we place it at the top to prevent errors
window.updateUserLocationMarker = function(arg1, arg2, arg3, arg4, arg5, arg6) {
    // Format 1: position object was passed (called from my_location.js)
    if (arg1 && arg1.coords && typeof arg1.coords.latitude === 'number') {
        const position = arg1;
        const day = arg2;
        const expandedMap = arg3;
        showLocationOnMap(position, day, expandedMap);
    }
    // Format 2: map object + coordinates (called from mainscript.js)
    else if (arg1 && (arg1.getContainer || arg1.setView)) {
        const expandedMap = arg1;
        const day = arg2;
        const lat = arg3;
        const lng = arg4;
        const currentLayer = arg5;
        const shouldFetch = arg6;
        
        // If lat/lng provided, create position object and display
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
        // If only map provided, clear old markers
        else if (shouldFetch === false || lat === undefined) {
            clearLocationMarkers(day, expandedMap);
        }
    }
};

// Helper function to clear location markers
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

// 2. Listen for permission changes (prevents page reload)
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

// 3. Reverse Geocoding - Get address from coordinates using Nominatim
async function getAddressFromCoordinates(lat, lng) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
            {
                headers: {
                    'Accept-Language': 'en'
                }
            }
        );
        
        if (!response.ok) throw new Error('Geocoding failed');
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.warn("Geocoding error:", error);
        return null;
    }
}

// 4. Create popup HTML content - CLEAN & MINIMAL
function createLocationPopupContent(lat, lng, addressData) {
    let html = `<div class="location-popup">`;
    html += `<p class="loc-label">You are here</p>`;

    if (addressData && addressData.address) {
        const address = addressData.address || {};
        
        // Nearby place name
        let placeLabel = null;
        if (address.poi) {
            placeLabel = address.poi;
        } else if (address.building) {
            placeLabel = address.building;
        } else if (address.shop || address.amenity) {
            placeLabel = address.shop || address.amenity;
        } else if (address.road || address.street) {
            placeLabel = address.road || address.street;
        } else if (address.neighbourhood) {
            placeLabel = address.neighbourhood;
        } else if (address.suburb) {
            placeLabel = address.suburb;
        }

        // Nearby areas
        const nearbyItems = [];
        if (address.road || address.street) nearbyItems.push(address.road || address.street);
        if (address.neighbourhood) nearbyItems.push(address.neighbourhood);
        if (address.suburb) nearbyItems.push(address.suburb);
        if (address.city) nearbyItems.push(address.city);

        if (placeLabel) {
            html += `<p class="loc-place"><strong>${placeLabel}</strong></p>`;
        }

        if (nearbyItems.length > 0) {
            html += `<p class="loc-area">${nearbyItems.slice(0, 2).join(', ')}</p>`;
        }
    }

    html += `</div>`;

    return html;
}

// 5. Add popup styles as CSS - CLEAN & MINIMAL
function ensureLocationPopupStyles() {
    if (document.getElementById('location-popup-styles')) return;

    const style = document.createElement('style');
    style.id = 'location-popup-styles';
    style.innerHTML = `
        .location-popup {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            padding: 0;
            margin: 0;
            font-size: 13px;
            line-height: 1.5;
            color: #333;
        }

        .location-popup p {
            margin: 4px 0;
            padding: 0;
        }

        .location-popup .loc-label {
            font-size: 12px;
            font-weight: 500;
            color: #999;
            text-transform: uppercase;
           
            margin-bottom: 6px;
        }

        .location-popup .loc-place {
            font-size: 14px;
            font-weight: 600;
            color: #1a1a1a;
            margin-bottom: 6px;
        }

        .location-popup .loc-area {
            font-size: 12px;
            color: #666;
            margin-bottom: 4px;
        }

        .location-popup .loc-country {
            font-size: 12px;
            color: #999;
            border-top: 1px solid #e5e5e5;
            padding-top: 4px;
            margin-top: 6px;
        }

        .location-popup .loc-coords {
            font-size: 11px;
            color: #999;
            font-family: 'Monaco', 'Courier New', monospace;
            margin-top: 6px;
        }

        /* Leaflet popup compatibility */
        .leaflet-popup-content .location-popup {
            padding: 2px;
        }
    `;

    document.head.appendChild(style);
}

// 6. Get location function (triggered by button)
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

    // Second attempt with higher accuracy (in background)
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

// 7. Main function to display location on map
async function showLocationOnMap(position, day, expandedMap) {
    // A. Validate parameters
    if (!position || !position.coords) {
        console.warn("[showLocationOnMap] Invalid position object:", position);
        return;
    }

    if (!day) day = window.currentDay || 1;
    
    // B. Try to find map if not provided
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

    // C. Clear old markers
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

    // Ensure popup styles are loaded
    ensureLocationPopupStyles();

    // Fetch address information (async)
    const addressData = await getAddressFromCoordinates(lat, lng);
    const popupContent = createLocationPopupContent(lat, lng, addressData);

    // D. Add marker based on map type
    const isMapLibre = !!(expandedMap && expandedMap.addSource); // MapLibre check

    if (isMapLibre) {
        // --- 3D Map (MapLibre) ---
        const el = document.createElement('div');
        el.className = 'custom-lds-ripple-marker';
        el.innerHTML = '<div class="lds-ripple"><div></div><div></div></div>';
        el.style.width = '44px';
        el.style.height = '44px';

        const marker = new maplibregl.Marker({ element: el })
            .setLngLat([lng, lat])
            .setPopup(new maplibregl.Popup({ offset: 25, maxWidth: 'none' }).setHTML(popupContent))
            .addTo(expandedMap);
            
        window.userLocationMarkersByDay[day].push(marker);
        marker.togglePopup();
        expandedMap.flyTo({ center: [lng, lat], zoom: 15, essential: true });

    } else if (expandedMap && expandedMap.setView) {
        // --- 2D Map (Leaflet) ---
        const userIcon = L.divIcon({
            className: 'custom-lds-ripple-marker', 
            html: '<div class="lds-ripple"><div></div><div></div></div>',
            iconSize: [44, 44],       
            iconAnchor: [22, 44],     
            popupAnchor: [0, -36]
        });

        const marker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(expandedMap);
        marker.bindPopup(popupContent, { maxWidth: 280, autoPan: true }).openPopup();
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