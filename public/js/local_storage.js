const TRIP_STORAGE_KEY = "triptime_user_trips_v2";

// Helper: how many valid points does this day have?
function countPointsForDay(day) {
  try {
    return (window.cart || []).filter(
      it =>
        it.day == day &&
        it.location &&
        typeof it.location.lat === "number" &&
        typeof it.location.lng === "number" &&
        !Number.isNaN(it.location.lat) &&
        !Number.isNaN(it.location.lng)
    ).length;
  } catch {
    return 0;
  }
}

// Yardımcı: bir thumbnail URL'si placeholder mı?
function isPlaceholderThumb(u) {
  return !u || typeof u !== 'string' || u.includes('img/placeholder');
}

// Yardımcı: bir trip içinden belirli günün nokta listesini çıkar
function getPointsFromTrip(trip, day) {
  if (!trip || !Array.isArray(trip.cart)) return [];
  return trip.cart
    .filter(it =>
      it.day == day &&
      it.location &&
      (typeof it.location.lat === 'number' || typeof it.location.lat === 'string') &&
      (typeof it.location.lng === 'number' || typeof it.location.lng === 'string')
    )
    .map(it => ({
      lat: Number(it.location.lat),
      lng: Number(it.location.lng),
      name: it.name || ''
    }))
    .filter(p => !Number.isNaN(p.lat) && !Number.isNaN(p.lng));
}

// OFFSCREEN (tilesız) thumbnail üretimi: sadece polyline + nokta daireleri
async function generateTripThumbnailOffscreen(trip, day, width = 300, height = 180) {
  try {
    const pts = getPointsFromTrip(trip, day);
    if (pts.length < 2) return null;

    // Gizli konteyner
    const off = document.createElement('div');
    off.style.position = 'fixed';
    off.style.left = '-10000px';
    off.style.top = '0';
    off.style.width = width + 'px';
    off.style.height = height + 'px';
    off.style.pointerEvents = 'none';
    off.style.zIndex = '-1';
    document.body.appendChild(off);

    // Harita: tilesız, canvas tercihli
    const map = L.map(off, {
      preferCanvas: true,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
      zoomAnimation: false,
      fadeAnimation: false,
      inertia: false
    });

    // Polyline ve noktalar
    const latlngs = pts.map(p => [p.lat, p.lng]);
    const renderer = L.canvas();
    const poly = L.polyline(latlngs, {
      color: '#1976d2',
      weight: 6,
      opacity: 0.95,
      renderer
    }).addTo(map);

    // Noktaları küçük kırmızı daireler olarak ekle (canvas üzerinde çizilir)
    pts.forEach(p => {
      L.circleMarker([p.lat, p.lng], {
        radius: 4,
        color: '#d32f2f',
        fillColor: '#d32f2f',
        fillOpacity: 1,
        weight: 2,
        renderer
      }).addTo(map);
    });

    // Kapsama ayarla
    map.fitBounds(poly.getBounds(), { padding: [12, 12] });

    // Bir frame bekle
    await new Promise(r => requestAnimationFrame(r));

    // Görüntü al
    let dataUrl = null;
    if (typeof leafletImage === 'function') {
      await new Promise(resolve => {
        leafletImage(map, (err, canvas) => {
          if (!err && canvas) {
            try { dataUrl = canvas.toDataURL('image/png'); } catch(_) { dataUrl = null; }
          }
          resolve();
        });
      });
    }

    // Temizlik
    try { map.remove(); } catch(_) {}
    if (off && off.parentNode) off.parentNode.removeChild(off);

    return dataUrl;
  } catch {
    return null;
  }
}

// Sadece mevcut haritadan thumbnail al; olmazsa placeholder
async function saveCurrentTripToStorage() {
  let tripTitle = (window.lastUserQuery && window.lastUserQuery.trim().length > 0) ? window.lastUserQuery.trim() : "My Trip";
  if (!tripTitle && window.selectedCity && Array.isArray(window.cart) && window.cart.length > 0) {
    const maxDay = Math.max(...window.cart.map(item => item.day || 1));
    tripTitle = `${maxDay} days ${window.selectedCity}`;
  }
  let tripDate = (window.cart && window.cart.length > 0 && window.cart[0].date)
    ? window.cart[0].date
    : (new Date()).toISOString().slice(0, 10);
  let tripKey = tripTitle.replace(/\s+/g, "_") + "_" + tripDate.replace(/[^\d]/g, '');

  const tripObj = {
    title: tripTitle,
    date: tripDate,
    days: window.cart && window.cart.length > 0
      ? Math.max(...window.cart.map(item => item.day || 1))
      : 1,
    cart: JSON.parse(JSON.stringify(window.cart || [])),
    customDayNames: window.customDayNames ? { ...window.customDayNames } : {},
    lastUserQuery: window.lastUserQuery || "",
    selectedCity: window.selectedCity || "",
    updatedAt: Date.now(),
    key: tripKey,
  };

  const thumbnails = {};
  const days = tripObj.days;
  for (let day = 1; day <= days; day++) {
    if (countPointsForDay(day) >= 2) {
      const thumb = await generateMapThumbnail(day);
      thumbnails[day] = thumb || "img/placeholder.png";
    } else {
      thumbnails[day] = "img/placeholder.png";
    }
  }
  tripObj.thumbnails = thumbnails;

  let trips = {};
  try { trips = JSON.parse(localStorage.getItem(TRIP_STORAGE_KEY)) || {}; } catch (e) {}

  tripObj.favorite = (trips[tripKey] && typeof trips[tripKey].favorite === "boolean") ? trips[tripKey].favorite : false;

  trips[tripKey] = tripObj;
  localStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify(trips));
}


// saveCurrentTripToStorageWithThumbnail: same guard
async function saveCurrentTripToStorageWithThumbnail() {
  let tripTitle = (window.lastUserQuery && window.lastUserQuery.trim().length > 0) ? window.lastUserQuery.trim() : "My Trip";
  if (!tripTitle && window.selectedCity && window.cart.length > 0) {
    const maxDay = Math.max(...window.cart.map(item => item.day || 1));
    tripTitle = `${maxDay} days ${window.selectedCity}`;
  }
  let tripDate = (window.cart && window.cart.length > 0 && window.cart[0].date)
    ? window.cart[0].date
    : (new Date()).toISOString().slice(0, 10);
  let tripKey = tripTitle.replace(/\s+/g, "_") + "_" + tripDate.replace(/[^\d]/g, '');

  const tripObj = {
    title: tripTitle,
    date: tripDate,
    days: window.cart && window.cart.length > 0
      ? Math.max(...window.cart.map(item => item.day || 1))
      : 1,
    cart: JSON.parse(JSON.stringify(window.cart)),
    customDayNames: window.customDayNames ? { ...window.customDayNames } : {},
    lastUserQuery: window.lastUserQuery || "",
    selectedCity: window.selectedCity || "",
    updatedAt: Date.now(),
    key: tripKey,
  };

  const thumbnails = {};
  const days = tripObj.days;
  for (let day = 1; day <= days; day++) {
    if (countPointsForDay(day) >= 2) {
      thumbnails[day] = await generateMapThumbnail(day) || "img/placeholder.png";
    } else {
      thumbnails[day] = "img/placeholder.png";
    }
  }
  tripObj.thumbnails = thumbnails;

  let trips = {};
  try {
    trips = JSON.parse(localStorage.getItem(TRIP_STORAGE_KEY)) || {};
  } catch (e) {}

  tripObj.favorite = (trips[tripKey] && typeof trips[tripKey].favorite === "boolean") ? trips[tripKey].favorite : false;

  trips[tripKey] = tripObj;
  localStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify(trips));
}


async function saveCurrentTripToStorageWithThumbnailDelay() {
    // 500-1000ms gecikme ile harita oluşmuş olur
     setTimeout(() => {
        saveCurrentTripToStorage();
        renderMyTripsPanel();
    }, 1200);
 }

function patchCartLocations() {
    window.cart.forEach(function(item) {
        // Eğer item.location yok ama lat/lon var ise location ekle
        if (!item.location && (item.lat != null && item.lon != null)) {
            item.location = { lat: Number(item.lat), lng: Number(item.lon) };
        }
        // Eğer location varsa ama lat/lng string ise number'a çevir
        if (item.location) {
            if (typeof item.location.lat === "string") item.location.lat = Number(item.location.lat);
            if (typeof item.location.lng === "string") item.location.lng = Number(item.location.lng);
        }
    });
}


// 2. Tüm gezileri getir
function getAllSavedTrips() {
    try {
        const trips = JSON.parse(localStorage.getItem(TRIP_STORAGE_KEY));
        if (!trips || typeof trips !== "object") return {};
        return trips;
    } catch(e) {
        return {};
    }
}   

// 2. Planı localStorage'dan yüklerken location'ları number'a zorla!
function loadTripFromStorage(tripKey) {
    const trips = getAllSavedTrips();
    if (!trips[tripKey]) return false;
    const t = trips[tripKey];

    // window.cart doğrudan TÜM item’larıyla kopyalanmalı:
    window.cart = Array.isArray(t.cart) ? JSON.parse(JSON.stringify(t.cart)) : [];

    // (Ekstra: day ve location dönüşümleri)
    window.cart = window.cart.map(item => {
        if (typeof item.day === "string") item.day = Number(item.day);
        if (item.location && typeof item.location.lat === "string") {
            item.location.lat = Number(item.location.lat);
        }
        if (item.location && typeof item.location.lng === "string") {
            item.location.lng = Number(item.location.lng);
        }
        return item;
    });
    window.latestTripPlan = Array.isArray(t.cart) ? JSON.parse(JSON.stringify(t.cart)) : [];
    patchCartLocations();

    window.customDayNames = t.customDayNames ? { ...t.customDayNames } : {};
    window.lastUserQuery = t.lastUserQuery || t.title || "";
    window.selectedCity = t.selectedCity || "";

    // 2. Chat ve cart panel temizle
    const chatBox = document.getElementById("chat-box");
    if (chatBox) chatBox.innerHTML = "";
    let cartDiv = document.getElementById("cart-items");
    if (cartDiv) cartDiv.innerHTML = "";

    // 3. UI güncellemeleri
    if (typeof updateTripTitle === "function") updateTripTitle();
    if (typeof updateCart === "function") updateCart();
    if (typeof showResults === "function") showResults();
    if (typeof window.toggleSidebarTrip === "function") window.toggleSidebarTrip();

    // 4. Gün sayısını bul
    let maxDay = 0;
    window.cart.forEach(item => { if (item.day > maxDay) maxDay = item.day; });

    // 5. Route'ları çiz, sonra thumbnail üret ve paneli güncelle
    setTimeout(async () => {
        // Her gün için harita ve route çizimi
        for (let day = 1; day <= maxDay; day++) {
            await renderRouteForDay(day);
        }
        // Route/harita DOM'da iyice otursun diye biraz daha bekle
        setTimeout(async () => {
            await saveCurrentTripToStorageWithThumbnail();
            renderMyTripsPanel();
        }, 1200);
    }, 0);

    return true;
}   
// 8. Gezileri silme özelliği (isteğe bağlı)
function deleteTrip(tripKey) {
    let trips = getAllSavedTrips();
    if (!trips[tripKey]) return;
    delete trips[tripKey];
    localStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify(trips));
    renderMyTripsPanel();
}




function groupTripsByDate(trips) {
    const grouped = {};
    Object.values(trips).forEach(trip => {
        const date = trip.date;
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(trip);
    });
    return grouped;
}





function getTimeGroupLabel(updatedAt) {
    const now = Date.now();
    const diffMs = now - updatedAt;
    const diffMin = diffMs / (1000 * 60);
    const diffHour = diffMin / 60;
    const diffDay = diffHour / 24;
    const diffWeek = diffDay / 7;
    const diff15Days = diffDay / 15;
    const diffMonth = diffDay / 30;

    if (diffMin < 15) return "Last 15 minutes";
    if (diffHour < 1) return "Last 1 hour";
    if (diffDay < 1) return "Last 1 day";
    if (diffDay < 7) return "Last 1 week";
    if (diffDay < 15) return "Last 15 days";
    if (diffDay < 30) return "Last 1 month";
    return "Older";
}

function formatTime(date) {
    const d = new Date(date);
    return d.toLocaleTimeString('tr-TR', { hour12: false });
}

// Favori toggle
function toggleTripFavorite(tripKey) {
    const all = getAllSavedTrips();
    if (!all[tripKey]) return;
    const current = !!all[tripKey].favorite;
    all[tripKey].favorite = !current;
    all[tripKey].updatedAt = Date.now();
    localStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify(all));
    renderMyTripsPanel();
}

function renderMyTripsPanel() {
    const trips = getAllSavedTrips();
    const panel = document.getElementById("my-trips-panel");
    if (!panel) return;
    panel.innerHTML = "";

    if (!trips || Object.keys(trips).length === 0) {
        panel.innerHTML = `<div class="mytrips-empty">You have no saved trips yet.<br>Trips you create are saved automatically here!</div>`;
        return;
    }

    const allTrips = Object.values(trips).sort((a, b) => b.updatedAt - a.updatedAt);
    const favorites = allTrips.filter(t => !!t.favorite);
    const nonFavorites = allTrips.filter(t => !t.favorite);

    // === FAVORITES SECTION (always at top) ===
    const favSection = document.createElement("div");
    favSection.className = "mytrips-group";
    favSection.innerHTML = `<div class="mytrips-group-title">⭐ Favorites</div>`;
    if (favorites.length === 0) {
        const emptyFav = document.createElement("div");
        emptyFav.className = "mytrips-empty";
        emptyFav.textContent = "No favorites yet. Click the star to add trips here.";
        favSection.appendChild(emptyFav);
    } else {
        favorites.forEach(trip => {
            favSection.appendChild(buildTripRow(trip, true));
        });
    }
    panel.appendChild(favSection);

    // Separator
    const hrTop = document.createElement("hr");
    panel.appendChild(hrTop);

    // Trip'leri zaman gruplarına ayır (FAVORİ OLMAYANLAR)
    const groups = {};
    nonFavorites.forEach(trip => {
        const label = getTimeGroupLabel(trip.updatedAt || Date.now());
        if (!groups[label]) groups[label] = [];
        groups[label].push(trip);
    });

  // Groups to display, in English, in the requested order:
    const groupOrder = [
        "Last 15 minutes",
        "Last 1 hour",
        "Last 1 day",
        "Last 1 week",
        "Last 15 days",
        "Last 1 month",
        "Older"
    ];
    let firstGroup = true;
    groupOrder.forEach(label => {
        if (!groups[label] || groups[label].length === 0) return;

        if (!firstGroup) {
            const hr = document.createElement("hr");
            panel.appendChild(hr);
        }
        firstGroup = false;

        const groupDiv = document.createElement("div");
        groupDiv.className = "mytrips-group";
        groupDiv.innerHTML = `<div class="mytrips-group-title">${label}</div>`;
        groups[label].forEach(trip => {
            groupDiv.appendChild(buildTripRow(trip, false));
        });
        panel.appendChild(groupDiv);
    });

    tryUpdateTripThumbnailsDelayed(3500);

    // İç yardımcı: tek satırlık gezi kutusu
    function buildTripRow(trip, isFavoriteSection) {
    const tripDiv = document.createElement("div");
    tripDiv.className = "mytrips-tripbox";

    // === ANA DIV: Görsel, trip-info-box, fav buton, PDF butonu ===
    const mainBox = document.createElement("div");
    mainBox.className = "trip-main-box";
    mainBox.style.display = "flex";
    mainBox.style.alignItems = "center";
    mainBox.style.gap = "10px";

    // Thumbnail
    let thumb = (trip.thumbnails && trip.thumbnails[1]) ? trip.thumbnails[1] : "img/placeholder.png";
    const img = document.createElement("img");
    img.src = thumb || "img/placeholder.png";
    img.width = 60;
    img.height = 40;
    img.className = "mytrips-thumb";
    img.setAttribute("data-tripkey", trip.key);

    // Trip info box (tıklanabilir)
    const infoBox = document.createElement("div");
    infoBox.className = "trip-info-box";
    infoBox.style.cursor = "pointer";
    infoBox.style.flex = "1";

    // Başlık ve rename inputu
    const titleDiv = document.createElement("div");
    titleDiv.className = "trip-title";
    titleDiv.textContent = trip.title || `${trip.days} day${trip.days > 1 ? 's' : ''}${trip.selectedCity ? " " + trip.selectedCity : ""}`;

    // -- Başlığı düzenleme fonksiyonu
    function startRename() {
        const input = document.createElement("input");
        input.type = "text";
        input.value = titleDiv.textContent;
        input.className = "trip-rename-input";
        input.style.marginRight = "5px";
        input.style.maxWidth = "120px";
        input.addEventListener("keydown", function(e) {
            if (e.key === "Enter") doRename();
            if (e.key === "Escape") cancelRename();
        });

        const saveBtn = document.createElement("button");
        saveBtn.className = "trip-rename-save";
        saveBtn.textContent = "Save";
        saveBtn.title = "Save";
        saveBtn.onclick = doRename;

        const cancelBtn = document.createElement("button");
        cancelBtn.className = "trip-rename-cancel";
        cancelBtn.textContent = "Cancel";
        cancelBtn.title = "Cancel";
        cancelBtn.onclick = cancelRename;

        titleDiv.replaceWith(input, saveBtn, cancelBtn);
        input.focus();

        function doRename() {
            const newTitle = input.value.trim();
            if (!newTitle) return;
            const all = getAllSavedTrips();
            all[trip.key].title = newTitle;
            all[trip.key].updatedAt = Date.now();
            localStorage.setItem("triptime_user_trips_v2", JSON.stringify(all));
            renderMyTripsPanel();
        }
        function cancelRename() {
            renderMyTripsPanel();
        }
    }

    // Sadece butonlar (Rename, Delete)
    const buttonRow = document.createElement("div");
    buttonRow.style.display = "flex";
    buttonRow.style.alignItems = "center";
    buttonRow.style.gap = "8px";

    const renameBtn = document.createElement("button");
    renameBtn.className = "trip-rename-btn";
    renameBtn.type = "button";
    renameBtn.textContent = "Rename";
    renameBtn.title = "Rename trip";
    renameBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        startRename();
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "mytrips-delete-btn";
    deleteBtn.title = "Delete this trip";
    deleteBtn.textContent = "Delete";
    deleteBtn.onclick = function(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log("Silinecek trip key:", trip.key);
    if (confirm("Are you sure you want to delete this trip?")) {
        deleteTrip(trip.key);
        renderMyTripsPanel();
    }
};

    buttonRow.appendChild(renameBtn);
    buttonRow.appendChild(deleteBtn);

    infoBox.appendChild(titleDiv);
    infoBox.appendChild(buttonRow);

    infoBox.onclick = function(e) {
        if (e.target === renameBtn || e.target === deleteBtn) return;
        e.preventDefault();
        if (typeof window.toggleSidebarMyTrips === "function") window.toggleSidebarMyTrips();
        loadTripFromStorage(trip.key);
        setTimeout(function() {
            if (typeof openTripSidebar === "function") openTripSidebar();
        }, 400);
    };

    // PDF butonu (yıldızın solunda)
    const pdfBtn = document.createElement("button");
    pdfBtn.className = "mytrips-pdf-btn";
    pdfBtn.type = "button";
    pdfBtn.title = "Download PDF";
    pdfBtn.innerHTML = `<img src="/img/pdf-icon.svg" alt="Download PDF" style="width:22px;vertical-align:middle;">`;
    pdfBtn.style.border = "none";
    pdfBtn.style.background = "transparent";
    pdfBtn.style.cursor = "pointer";
    pdfBtn.style.fontSize = "20px";
    pdfBtn.style.marginRight = "0";
    pdfBtn.style.marginLeft = "6px";
    pdfBtn.style.padding = "0";
    pdfBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof downloadTripPlanPDF === "function") {
            downloadTripPlanPDF(trip.key); // Trip'in key'i ile çağır!
        }
    };

    // Favorite star (right side)
    const favBtn = document.createElement("button");
    favBtn.className = "mytrips-fav-btn";
    favBtn.type = "button";
    favBtn.title = trip.favorite ? "Remove from favorites" : "Add to favorites";
    favBtn.textContent = "★";
    favBtn.style.border = "none";
    favBtn.style.background = "transparent";
    favBtn.style.cursor = "pointer";
    favBtn.style.fontSize = "20px";
    favBtn.style.marginLeft = "0";
    favBtn.style.padding = "0";
    favBtn.style.color = trip.favorite ? "#ffcc00" : "#bdbdbd"; // yellow vs grey
    favBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleTripFavorite(trip.key);
    };

    mainBox.appendChild(img);
    mainBox.appendChild(infoBox);
    mainBox.appendChild(pdfBtn); // PDF butonu buraya!
    mainBox.appendChild(favBtn);

    tripDiv.appendChild(mainBox);

    return tripDiv;
}
tryUpdateTripThumbnailsDelayed(1500); // 1.5 sn sonra tekrar dene; istersen daha kısa yapabilirsin

}


if (!window.__trip_autosave_hooked) {
  const origUpdateCart = window.updateCart;
  window.updateCart = function() {
    if (typeof origUpdateCart === "function") origUpdateCart.apply(this, arguments);
    // Hemen kaydetmek yerine haritanın oturmasını bekle
    saveCurrentTripToStorageWithThumbnailDelay();
  };
  if (typeof window.showResults === "function") {
    const origShowResults = window.showResults;
    window.showResults = function() {
      if (typeof origShowResults === "function") origShowResults.apply(this, arguments);
      saveCurrentTripToStorageWithThumbnailDelay();
    };
  }
  if (typeof window.saveDayName === "function") {
    const origSaveDayName = window.saveDayName;
    window.saveDayName = function(day, newName) {
      if (typeof origSaveDayName === "function") origSaveDayName.apply(this, arguments);
      saveCurrentTripToStorageWithThumbnailDelay();
    };
  }
  window.__trip_autosave_hooked = true;
}


// 6. Sayfa açılışında My Trips panelini doldur
document.addEventListener("DOMContentLoaded", function() {
    renderMyTripsPanel();

});

// 7. Yeni plan başladığında eski trip state'i sıfırla (startNewChat fonksiyonu varsa!)
if (typeof window.startNewChat === "function") {
    const origStartNewChat = window.startNewChat;
    window.startNewChat = function() {
        origStartNewChat.apply(this, arguments);
        // Sıfırla
        window.cart = [];
        window.customDayNames = {};
        window.lastUserQuery = "";
        window.selectedCity = "";
        saveCurrentTripToStorage();
        renderMyTripsPanel();
    };
}



document.addEventListener("DOMContentLoaded", function () {
    // ... window.cart bir şekilde doluyorsa ...
    patchCartLocations();
    // ... devamı ...
});


// Sadece ekrandaki haritadan dene; olmazsa dokunma (placeholder kalsın)
async function tryUpdateTripThumbnailsDelayed(delay = 3500) {
  setTimeout(async function () {
    const trips = getAllSavedTrips();
    for (const tripKey in trips) {
      const trip = trips[tripKey];
      if (!trip.thumbnails || !trip.thumbnails[1] || trip.thumbnails[1].includes("placeholder")) {
        if (countPointsForDay(1) < 2) continue;
        const map = window.leafletMaps && window.leafletMaps[`route-map-day1`];
        const containerOk = !!(map && (map.getContainer?.() || map._container));
        if (containerOk) {
          const thumb = await generateMapThumbnail(1);
          if (thumb) {
            trip.thumbnails = trip.thumbnails || {};
            trip.thumbnails[1] = thumb;
            const all = getAllSavedTrips();
            all[trip.key] = trip;
            localStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify(all));
            const img = document.querySelector(`img.mytrips-thumb[data-tripkey="${trip.key}"]`);
            if (img) img.src = thumb;
          }
        }
      }
    }
  }, delay);
}
// Sadece haritadaki görüntüyü yakalar; tiles/ikon marker'ları geçici kaldırır, sonra geri ekler
async function generateMapThumbnail(day) {
  try {
    const containerId = `route-map-day${day}`;
    let el = document.getElementById(containerId);
    let map = window.leafletMaps && window.leafletMaps[containerId];

    // DOM veya harita yoksa önce oluştur
    if (!el) {
      if (typeof ensureDayMapContainer === 'function') {
        el = ensureDayMapContainer(day);
      }
    }
    if (!map || !el) {
      if (typeof renderRouteForDay === 'function') {
        await renderRouteForDay(day);
      }
      map = window.leafletMaps && window.leafletMaps[containerId];
      el = document.getElementById(containerId);
    }
    if (!map || !el) return null;

    const container = (typeof map.getContainer === 'function') ? map.getContainer() : map._container;
    if (!container || !document.body.contains(container)) return null;

    // Geçici kaldırılacak katmanlar
    const removedTileLayers = [];
    const removedImageMarkers = [];
    map.eachLayer(l => {
      if (l instanceof L.TileLayer) {
        removedTileLayers.push(l);
      } else if (l instanceof L.Marker) {
        const icon = l.options && l.options.icon;
        const iconUrl = icon && icon.options && icon.options.iconUrl;
        // DivIcon kalabilir; sadece gerçek resimli ikonları kaldır
        if (iconUrl) removedImageMarkers.push(l); 
      }
    });

    // Görünmez yapılacak paneller
    const panes = map._panes || {};
    const togglePanes = (display) => {
      if (panes.markerPane) panes.markerPane.style.display = display;
      if (panes.popupPane) panes.popupPane.style.display = display;
      if (panes.tooltipPane) panes.tooltipPane.style.display = display;
      if (panes.shadowPane) panes.shadowPane.style.display = display;
      if (panes.tilePane) panes.tilePane.style.display = display;
    };

    let dataUrl = null;

    await withTempVisible(el, 285, async () => {
      // 1) Tiles ve resimli marker’ları kaldır
      removedTileLayers.forEach(l => map.removeLayer(l));
      removedImageMarkers.forEach(m => map.removeLayer(m));

      // 2) Pane’leri gizle (rota canvas’ı kalır)
      togglePanes('none');

      // 3) Boyutu tazele ve hazır olmasını bekle
      map.invalidateSize({ pan: false });
      await waitForMapReady(map, 1200);
      await new Promise(r => requestAnimationFrame(r));

      // 4) Görüntüyü al
      if (typeof leafletImage === 'function') {
        await new Promise((resolve) => {
          leafletImage(map, function(err, canvas) {
            if (!err && canvas) {
              try { dataUrl = canvas.toDataURL('image/png'); } catch(_) { dataUrl = null; }
            }
            resolve();
          });
        });
      }

      // 5) Her şeyi geri yükle
      togglePanes('');
      removedTileLayers.forEach(l => map.addLayer(l));
      removedImageMarkers.forEach(m => map.addLayer(m));
    });

    return dataUrl;
  } catch (_) {
    return null;
  }
}
// Yardımcı: bir DOM elemanı render edilebilir mi?
function isRenderable(el) {
  if (!el) return false;
  const style = getComputedStyle(el);
  return el.offsetWidth > 0 && el.offsetHeight > 0 && style.visibility !== 'hidden' && style.display !== 'none';
}

// Yardımcı: el'i geçici görünür yapıp iş bittikten sonra geri al
async function withTempVisible(el, desiredHeightPx = 285, fn) {
  if (!el) return;
  const prev = {
    display: el.style.display,
    height: el.style.height,
    visibility: el.style.visibility
  };
  let mutated = false;

  if (!isRenderable(el)) {
    el.style.display = 'block';
    el.style.visibility = 'visible';
    if (!el.style.height || el.offsetHeight === 0) {
      el.style.height = `${desiredHeightPx}px`;
    }
    mutated = true;
  }

  // Bir frame bekle ki layout otursun
  await new Promise(r => requestAnimationFrame(r));

  try {
    return await fn();
  } finally {
    if (mutated) {
      el.style.display = prev.display || '';
      el.style.height = prev.height || '';
      el.style.visibility = prev.visibility || '';
    }
  }
}

// Yardımcı: harita gerçekten hazır mı?
function waitForMapReady(map, timeoutMs = 2000) {
  return new Promise(resolve => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(true); } };

    // Eğer zaten loaded ise kısa bekleme
    if (map && map._loaded) {
      setTimeout(finish, 50);
      return;
    }
    if (!map) { resolve(false); return; }

    const onLoad = () => { map.off('load', onLoad); finish(); };
    map.on('load', onLoad);

    setTimeout(() => {
      map && map.off('load', onLoad);
      finish();
    }, timeoutMs);
  });
}
