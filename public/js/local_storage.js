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
function generateTripThumbnailOffscreen(trip, day, width = 300, height = 180) {
  // ROTAYA KARIŞMA - İster noktaları, ister directions polyline'ı kullanırsın!
  const pts = getPointsFromTrip(trip, day);
  const polyline = (trip.directionsPolylines && trip.directionsPolylines[day] && Array.isArray(trip.directionsPolylines[day]))
    ? trip.directionsPolylines[day]
    : pts;
  if (!polyline || polyline.length < 2) return null;

  const lats = polyline.map(p => p.lat);
  const lngs = polyline.map(p => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

  function project(p) {
  // Koordinatların kapsadığı alan
  const ptsWidth = maxLng - minLng || 1;
  const ptsHeight = maxLat - minLat || 1;
  const pad = 12;

  // Canvas ve veri oranı
  const canvasRatio = width / height;
  const ptsRatio = ptsWidth / ptsHeight;

  let scale, offsetX, offsetY;
  if (ptsRatio > canvasRatio) {
    // En-boy oranı canvas'tan geniş → genişliği tam doldur, üst-alt boşluk bırak
    scale = (width - 2 * pad) / ptsWidth;
    const realHeight = ptsHeight * scale;
    offsetX = pad;
    offsetY = (height - realHeight) / 2;
  } else {
    // En-boy oranı canvas'tan dar → yüksekliği tam doldur, sağ-sol boşluk bırak
    scale = (height - 2 * pad) / ptsHeight;
    const realWidth = ptsWidth * scale;
    offsetX = (width - realWidth) / 2;
    offsetY = pad;
  }

  const x = offsetX + (p.lng - minLng) * scale;
  const y = offsetY + (maxLat - p.lat) * scale;
  return [x, y];
}

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  // ROTAYI ÇİZ (nasılsa polyline dizisi hazır, directions veya düz çizgi olabilir)
  ctx.save();
  ctx.strokeStyle = '#1976d2';
  ctx.lineWidth = 6;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  polyline.forEach((p, i) => {
    const [x, y] = project(p);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();

  // Nokta markerlar; ROTAYA yine karışmıyoruz!
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
  directionsPolylines: window.directionsPolylines ? { ...window.directionsPolylines } : undefined, // EKLEDİĞİN SATIR
};

  const thumbnails = {};
  const days = tripObj.days;
  for (let day = 1; day <= days; day++) {
    if (countPointsForDay(day) >= 2) {
      const thumb = await generateTripThumbnailOffscreen(tripObj, day);
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
  directionsPolylines: window.directionsPolylines ? { ...window.directionsPolylines } : undefined, // EKLEDİĞİN SATIR
};

  const thumbnails = {};
  const days = tripObj.days;
  for (let day = 1; day <= days; day++) {
    if (countPointsForDay(day) >= 2) {
      thumbnails[day] = await generateTripThumbnailOffscreen(tripObj, day) || "img/placeholder.png";
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

    if (diffMin < 10) return "Son 10 dakika";
    if (diffMin < 30) return "Son 30 dakika";
    if (diffHour < 1) return "Son 1 saat";
    if (diffHour < 24) return "Son 1 gün";
    return "Daha eski";
}

function formatTime(date) {
    const d = new Date(date);
    return d.toLocaleTimeString('tr-TR', { hour12: false });
}

// Favori toggle
async function toggleTripFavorite(tripKey) {
    const all = getAllSavedTrips();
    if (!all[tripKey]) return;
    const current = !!all[tripKey].favorite;
    all[tripKey].favorite = !current;
    all[tripKey].updatedAt = Date.now();
    localStorage.setItem("triptime_user_trips_v2", JSON.stringify(all));
    renderMyTripsPanel();

    // --- EKLE: Thumbnail'ı güncelle ---
    const trip = all[tripKey];
    if (trip) {
        const days = trip.days || 1;
        trip.thumbnails = trip.thumbnails || {};
        for (let day = 1; day <= days; day++) {
            if ((trip.directionsPolylines && trip.directionsPolylines[day]) ||
                (trip.cart || []).filter(it => it.day == day && it.location && typeof it.location.lat === "number" && typeof it.location.lng === "number").length >= 2
            ) {
                trip.thumbnails[day] = await generateTripThumbnailOffscreen(trip, day) || "img/placeholder.png";
            } else {
                trip.thumbnails[day] = "img/placeholder.png";
            }
        }
        all[tripKey] = trip;
        localStorage.setItem("triptime_user_trips_v2", JSON.stringify(all));
        renderMyTripsPanel();
    }
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

    // Grupları sırayla göster
    const groupOrder = ["Son 10 dakika", "Son 30 dakika", "Son 1 saat", "Son 1 gün", "Daha eski"];
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

    // Görsel ve info kutusu için kapsayıcı
    const thumbBox = document.createElement("div");
    thumbBox.style.position = "relative";
    thumbBox.style.display = "inline-block";
    // thumbBox'ın genişliği ve yüksekliği sadece görsele göre ayarlanır:
    thumbBox.style.width = "60px";
    thumbBox.style.height = "40px";
    thumbBox.style.cursor = "pointer";

    const thumbImg = document.createElement("img");
    thumbImg.className = "mytrips-thumb";
    thumbImg.src = trip.thumbnails && trip.thumbnails[1] ? trip.thumbnails[1] : "img/placeholder.png";
    thumbImg.width = 60;
    thumbImg.height = 40;
    thumbImg.dataset.tripkey = trip.key;

    const dayCount = trip.days || (trip.cart ? Math.max(1, ...trip.cart.map(i => i.day || 1)) : 1);
    const itemCount = trip.cart ? trip.cart.length : 0;

    const thumbInfo = document.createElement("div");
    thumbInfo.className = "mytrips-thumb-info";
    thumbInfo.innerHTML = `<div>${dayCount} day</div><div>${itemCount} item</div>`;
    thumbInfo.style.position = "absolute";
    thumbInfo.style.top = "0";
    thumbInfo.style.left = "0";
    thumbInfo.style.width = "100%";
    thumbInfo.style.height = "100%";
    thumbInfo.style.background = "#8a4af3";
    thumbInfo.style.color = "#fff";
    thumbInfo.style.fontSize = "13px";
    thumbInfo.style.display = "none";
    thumbInfo.style.flexDirection = "column";
    thumbInfo.style.alignItems = "center";
    thumbInfo.style.justifyContent = "center";
    thumbInfo.style.borderRadius = "7px";
    thumbInfo.style.zIndex = "2";
    thumbInfo.style.textShadow = "0 1px 3px #111";
    thumbInfo.style.pointerEvents = "none"; // info kutusu üstüne gelince hover kaybolmasın

    thumbBox.appendChild(thumbImg);
    thumbBox.appendChild(thumbInfo);

    // Sadece TRIPDIV'e event ekliyoruz
    tripDiv.addEventListener("mouseenter", () => {
        thumbInfo.style.display = "flex";
    });
    tripDiv.addEventListener("mouseleave", () => {
        thumbInfo.style.display = "none";
    });

    // Trip info box (tıklanabilir)
    const infoBox = document.createElement("div");
    infoBox.className = "trip-info-box";
    infoBox.style.cursor = "pointer";
    infoBox.style.flex = "1";

    // Başlık ve rename inputu
    const titleDiv = document.createElement("div");
    titleDiv.className = "trip-title";
    titleDiv.textContent = trip.title || `${trip.days} day${trip.days > 1 ? 's' : ''}${trip.selectedCity ? " " + trip.selectedCity : ""}`;

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

    // Buton satırı (Rename, Delete)
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

    // PDF butonu
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
            downloadTripPlanPDF(trip.key);
        }
    };

    // Favorite star
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
    favBtn.style.color = trip.favorite ? "#ffcc00" : "#bdbdbd";
    favBtn.onclick = async function(e) {
        e.preventDefault();
        e.stopPropagation();
        await toggleTripFavorite(trip.key);
        renderMyTripsPanel && renderMyTripsPanel();
    };

    // Sıralama
    mainBox.appendChild(thumbBox);
    mainBox.appendChild(infoBox);
    mainBox.appendChild(pdfBtn);
    mainBox.appendChild(favBtn);

    tripDiv.appendChild(mainBox);

    return tripDiv;
}
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
        if (
          !trip.thumbnails[day] ||
          (typeof trip.thumbnails[day] === "string" && trip.thumbnails[day].includes("placeholder"))
        ) {
          if (countPointsForDay(day, trip) < 2) continue;
          const thumb = await generateTripThumbnailOffscreen(trip, day);
          if (thumb) {
            trip.thumbnails[day] = thumb;
            const all = getAllSavedTrips();
            all[trip.key] = trip;
            localStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify(all));
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


async function updateAllTripThumbnailsWithPolyline() {
  const all = getAllSavedTrips();
  for (const [tripKey, trip] of Object.entries(all)) {
    if (!trip.directionsPolylines) trip.directionsPolylines = {};
    let updated = false;
    for (let day = 1; day <= (trip.days || 1); day++) {
      // Eğer directionsPolylines yoksa ve noktalar 2+ ise
      if (
        !trip.directionsPolylines[day] &&
        (trip.cart || []).filter(it => it.day == day && it.location && typeof it.location.lat === "number" && typeof it.location.lng === "number").length >= 2
      ) {
        // Burada noktaları al, Mapbox Directions API ile rota çek, polyline dizisi üret
        // NOT: Bu örnekte sadece noktaları düz çizgiyle birleştiriyor
        // Gerçek directions için backend veya API çağrısı gerek!
        const pts = getPointsFromTrip(trip, day);
        trip.directionsPolylines[day] = pts; // DÜZ ÇİZGİ (YAPILANDIĞI GİBİ)
        updated = true;
      }
    }
    if (updated) {
      // Thumbnail tekrar üret
      trip.thumbnails = trip.thumbnails || {};
      for (let day = 1; day <= (trip.days || 1); day++) {
        if ((trip.directionsPolylines[day] || []).length >= 2) {
          trip.thumbnails[day] = await generateTripThumbnailOffscreen(trip, day) || "img/placeholder.png";
        }
      }
      all[tripKey] = trip;
    }
  }
  localStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify(all));
}