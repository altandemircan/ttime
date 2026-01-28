// ==========================================
// MY LOCATION MODULE (GREEN STATIC MARKER)
// ==========================================

// 1. Initialize global variables and functions at the top
window.userLocationMarkersByDay = window.userLocationMarkersByDay || {};
window.isLocationActiveByDay = window.isLocationActiveByDay || {};

// Global location marker reference for 3D maps
window.userLocation3DMarker = null;

// [FIX] Main script calls this function
window.updateUserLocationMarker = function(arg1, arg2, arg3, arg4, arg5, arg6) {
    // Format 1: position object was passed
    if (arg1 && arg1.coords && typeof arg1.coords.latitude === 'number') {
        const position = arg1;
        const day = arg2;
        const expandedMap = arg3;
        showLocationOnMap(position, day, expandedMap);
    }
    // Format 2: map object + coordinates
    else if (arg1 && (arg1.getContainer || arg1.setView)) {
        const expandedMap = arg1;
        const day = arg2;
        const lat = arg3;
        const lng = arg4;
        const currentLayer = arg5;
        const shouldFetch = arg6;
        
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
                       window.expandedMaps[`route-map-day${day}`].expandedMap : null) ||
                      window._maplibre3DInstance;
        
        window.userLocationMarkersByDay[day].forEach(marker => {
            try {
                if (mapObj && mapObj.hasLayer && mapObj.hasLayer(marker)) {
                    mapObj.removeLayer(marker);
                }
                if (marker.remove) marker.remove();
            } catch(e) {}
        });
        window.userLocationMarkersByDay[day] = [];
    }
}

// 2. Listen for permission changes
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

// 3. Request Permission with visible dialog
async function requestLocationPermission() {
    if (!navigator.geolocation) {
        alert('Your browser does not support geolocation.');
        return false;
    }

    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                console.log("Location permission granted");
                resolve(true);
            },
            function(error) {
                if (error.code === 1) {
                    alert('Location permission denied. Please enable location access in your browser settings to use this feature.');
                    resolve(false);
                } else {
                    console.warn("Location error:", error);
                    resolve(false);
                }
            },
            {
                enableHighAccuracy: false,
                timeout: 5000,
                maximumAge: 0
            }
        );
    });
}

// 4. Reverse Geocoding
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

// 5. Create popup HTML content
function createLocationPopupContent(lat, lng, addressData) {
    let html = `<div class="location-popup">`;
    html += `<p class="loc-label">You are here</p>`;

    if (addressData && addressData.address) {
        const address = addressData.address || {};
        
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

// 6. Add popup styles as CSS - GREEN STATIC MARKER
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
            letter-spacing: 0.5px;
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

        /* Leaflet popup compatibility */
        .leaflet-popup-content .location-popup {
            padding: 2px;
        }

        /* GREEN LOCATION PIN MARKER (matching nearby_ai style) */
        .location-marker-green {
            position: relative;
            width: 40px;
            height: 50px;
            pointer-events: auto;
            z-index: 1000;
            filter: drop-shadow(0 2px 6px rgba(76, 175, 80, 0.4));
        }

        .location-marker-green::before {
            content: '';
            position: absolute;
            left: 50%;
            top: 0;
            width: 28px;
            height: 28px;
            transform: translate(-50%, 0);
            background: linear-gradient(135deg, #4caf50, #81c784);
            border-radius: 50% 50% 50% 0;
            border: 2px solid white;
            box-shadow: 
                0 0 12px rgba(76, 175, 80, 0.6),
                inset 0 2px 4px rgba(255, 255, 255, 0.5);
            z-index: 10;
            transform: translate(-50%, 0) rotate(-45deg);
        }

        .location-marker-green::after {
            content: '';
            position: absolute;
            left: 50%;
            top: 8px;
            width: 8px;
            height: 8px;
            background: white;
            border-radius: 50%;
            transform: translate(-50%, -50%);
            z-index: 11;
        }
    `;

    document.head.appendChild(style);
}

// 7. Get location function (triggered by button)
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
                alert("Location permission denied. Please enable location access in your browser settings.");
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

// 8. Main function to display location on map
async function showLocationOnMap(position, day, expandedMap) {
    // Validate parameters
    if (!position || !position.coords) {
        console.warn("[showLocationOnMap] Invalid position object:", position);
        return;
    }

    if (!day) day = window.currentDay || 1;
    
    // Try to find map if not provided
    if (!expandedMap) {
        if (window.expandedMaps && window.expandedMaps[`route-map-day${day}`]) {
            expandedMap = window.expandedMaps[`route-map-day${day}`].expandedMap;
        } else if (window.leafletMaps && window.leafletMaps[day]) {
            expandedMap = window.leafletMaps[day];
        } else if (window._currentMap) {
            expandedMap = window._currentMap;
        }
    }

    // Check for 3D map as fallback
    const is3DMapActive = document.getElementById('maplibre-3d-view') && 
                          document.getElementById('maplibre-3d-view').style.display !== 'none';
    
    if (!expandedMap && is3DMapActive && window._maplibre3DInstance) {
        expandedMap = window._maplibre3DInstance;
    }

    if (!expandedMap) {
        console.warn("[showLocationOnMap] No map found for day", day);
        return;
    }
    
    if (!window.isLocationActiveByDay[day]) window.isLocationActiveByDay[day] = true;

    // Clear old markers
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

    // Fetch address information
    const addressData = await getAddressFromCoordinates(lat, lng);
    const popupContent = createLocationPopupContent(lat, lng, addressData);

    // Determine map type
    const isMapLibre = !!(expandedMap && expandedMap.addSource);
    const is3DMap = !!(expandedMap && expandedMap.getStyle && expandedMap.getStyle().name === 'Liberty');

    if (isMapLibre || is3DMap) {
        // --- 3D Map (MapLibre) ---
        const el = document.createElement('div');
        el.className = 'location-marker-green';

        try {
            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([lng, lat])
                .setPopup(new maplibregl.Popup({ offset: 25, maxWidth: 'none' }).setHTML(popupContent))
                .addTo(expandedMap);
                
            window.userLocationMarkersByDay[day].push(marker);
            window.userLocation3DMarker = marker;
            marker.togglePopup();
            expandedMap.flyTo({ center: [lng, lat], zoom: 15, essential: true });
            
            console.log("[Location] 3D marker added successfully");
        } catch(e) {
            console.error("[Location] 3D marker error:", e);
        }

    } else if (expandedMap && expandedMap.setView) {
        // --- 2D Map (Leaflet) ---
        const userIcon = L.divIcon({
            className: 'location-marker-green', 
            iconSize: [40, 50],       
            iconAnchor: [20, 50],     
            popupAnchor: [0, -50]
        });

        const marker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(expandedMap);
        marker.bindPopup(popupContent, { maxWidth: 280, autoPan: true }).openPopup();
        window.userLocationMarkersByDay[day].push(marker);
        
        expandedMap.setView([lat, lng], 15);
        
        console.log("[Location] 2D marker added successfully");
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