// ==========================================
// MY LOCATION MODULE (ENHANCED WITH GEOCODING)
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

// 4. Create popup HTML content
function createLocationPopupContent(lat, lng, addressData) {
    let html = `
        <div class="location-popup-container">
            <div class="location-popup-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>Your Location</span>
            </div>
            <div class="location-popup-content">
    `;

    if (addressData) {
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
            html += `
                <div class="location-place-name">
                    <strong>${placeLabel}</strong>
                </div>
            `;
        }

        if (nearbyItems.length > 0) {
            html += `
                <div class="location-nearby">
                    <p class="location-nearby-label">📍 <strong>Near you</strong></p>
                    <p class="location-nearby-text">${nearbyItems.slice(0, 2).join(', ')}</p>
                </div>
            `;
        }

        // Country/Region
        if (address.country) {
            html += `
                <div class="location-country">
                    <small>🌍 ${address.country}</small>
                </div>
            `;
        }
    }

    // Coordinates
    html += `
        <div class="location-coords">
            <small>
                <code>${lat.toFixed(5)}, ${lng.toFixed(5)}</code>
            </small>
        </div>
    `;

    html += `
        <div class="location-accuracy">
            <small>📡 GPS accuracy: ~50m</small>
        </div>
    `;

    html += `
            </div>
        </div>
    `;

    return html;
}

// 5. Add popup styles as CSS
function ensureLocationPopupStyles() {
    if (document.getElementById('location-popup-styles')) return;

    const style = document.createElement('style');
    style.id = 'location-popup-styles';
    style.innerHTML = `
        .location-popup-container {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            padding: 0;
            min-width: 220px;
        }

        .location-popup-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 12px 8px 12px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 8px 8px 0 0;
            font-weight: 600;
            font-size: 14px;
        }

        .location-popup-header svg {
            flex-shrink: 0;
            animation: locationPulse 2s ease-in-out infinite;
        }

        @keyframes locationPulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.1); }
        }

        .location-popup-content {
            padding: 12px;
            background: white;
            border-radius: 0 0 8px 8px;
            border: 1px solid #e0e0e0;
            border-top: none;
        }

        .location-place-name {
            margin-bottom: 10px;
            padding-bottom: 10px;
            border-bottom: 2px solid #f0f0f0;
        }

        .location-place-name strong {
            color: #333;
            font-size: 15px;
            display: block;
            word-break: break-word;
        }

        .location-nearby {
            margin: 10px 0;
            padding: 8px;
            background: #f5f9ff;
            border-left: 3px solid #667eea;
            border-radius: 4px;
        }

        .location-nearby-label {
            margin: 0 0 4px 0;
            font-size: 13px;
            font-weight: 600;
            color: #667eea;
        }

        .location-nearby-text {
            margin: 0;
            font-size: 13px;
            color: #555;
            line-height: 1.4;
            word-break: break-word;
        }

        .location-country {
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid #f0f0f0;
            text-align: center;
        }

        .location-country small {
            color: #888;
            font-size: 12px;
        }

        .location-coords {
            margin-top: 8px;
            text-align: center;
        }

        .location-coords code {
            background: #f5f5f5;
            padding: 4px 6px;
            border-radius: 3px;
            font-size: 11px;
            color: #555;
            font-family: 'Courier New', monospace;
            word-break: break-all;
        }

        .location-accuracy {
            margin-top: 6px;
            text-align: center;
            color: #aaa;
            font-size: 11px;
        }

        /* Leaflet popup compatibility */
        .leaflet-popup-content .location-popup-container {
            margin: -2px -6px -6px -6px;
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