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

// Sadece rota ve noktalarla canvas PNG thumbnail üretir (arka plan haritasız)
async function generateTripThumbnailWithRoute(trip, day, width = 300, height = 180) {
  const pts = getPointsFromTrip(trip, day);
  if (pts.length < 2) return null;

  // 1. Mapbox Directions API'den rota alın
  const coords = pts.map(p => `${p.lng},${p.lat}`).join(';');
  const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coords}?geometries=geojson&overview=full&access_token=YOUR_MAPBOX_TOKEN`;

  let routeCoords = [];
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    if (
      data.routes &&
      data.routes[0] &&
      data.routes[0].geometry &&
      data.routes[0].geometry.coordinates
    ) {
      routeCoords = data.routes[0].geometry.coordinates.map(([lng, lat]) => ({lat, lng}));
    }
  } catch (e) {
    // fallback: düz çizgi
    routeCoords = pts.map(p => ({lat: p.lat, lng: p.lng}));
  }

  if (routeCoords.length < 2) return null;

  // Projeksiyon
  const lats = routeCoords.map(p => p.lat);
  const lngs = routeCoords.map(p => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

  function project(p) {
    const x = 12 + ((p.lng - minLng) / (maxLng - minLng || 1)) * (width - 24);
    const y = 12 + ((maxLat - p.lat) / (maxLat - minLat || 1)) * (height - 24);
    return [x, y];
  }

  // Canvas çizimi
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Rota (polyline)
  ctx.save();
  ctx.strokeStyle = '#1976d2';
  ctx.lineWidth = 6;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  routeCoords.forEach((p, i) => {
    const [x, y] = project(p);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();

  // Nokta markerlar (waypoints)
  ctx.save();
  ctx.fillStyle = '#d32f2f';
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  pts.forEach((p) => {
    const [x, y] = project(p);
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();

  return canvas.toDataURL('image/png');
}

function saveCurrentTripToStorage() {
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
      const thumb = generateTripThumbnailOffscreen(tripObj, day);
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

function saveCurrentTripToStorageWithThumbnail() {
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
      thumbnails[day] = generateTripThumbnailOffscreen(tripObj, day) || "img/placeholder.png";
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

function saveCurrentTripToStorageWithThumbnailDelay() {
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


async function tryUpdateTripThumbnailsDelayed(delay = 3500) {
  setTimeout(async function () {
    const trips = getAllSavedTrips();
    for (const tripKey in trips) {
      const trip = trips[tripKey];
      const maxDay = trip.days || 1;
      for (let day = 1; day <= maxDay; day++) {
        if (!trip.thumbnails) trip.thumbnails = {};
        if (!trip.thumbnails[day] || trip.thumbnails[day].includes("placeholder")) {
          const pts = getPointsFromTrip(trip, day);
          if (pts.length < 2) continue;

          // Thumbnail/grafik oluştur
          const thumb = await generateTripThumbnailOffscreen(trip, day);
          if (thumb) {
            trip.thumbnails[day] = thumb;
            const all = getAllSavedTrips();
            all[trip.key] = trip;
            localStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify(all));
            // Sadece day=1 görselini panelde güncelle
            if (day === 1) {
              const img = document.querySelector(`img.mytrips-thumb[data-tripkey="${trip.key}"]`);
              if (img) img.src = thumb;
            }
          }
        }
      }
    }
  }, delay);
}


