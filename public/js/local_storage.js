const TRIP_STORAGE_KEY = "triptime_user_trips_v2";
function toLatin(str) {
  if (!str) return '';
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^A-Za-z0-9_ ]/g, "")
    .trim();
}
async function saveTripAfterRoutes() {
  const maxDay = Math.max(1, ...(window.cart || []).map(it => it.day || 1));
  for (let day = 1; day <= maxDay; day++) {
    if (typeof renderRouteForDay === "function") {
      await renderRouteForDay(day);
    }
  }

  // 2. directionsPolylines'ın dolu olduğundan %100 emin ol!
  let retry = 0;
  while (
    Object.values(window.directionsPolylines || {}).some(arr => !Array.isArray(arr) || arr.length < 2) &&
    retry < 10
  ) {
    await new Promise(res => setTimeout(res, 120));
    retry++;
  }

  await saveCurrentTripToStorage({ withThumbnail: true, delayMs: 0 });
  if (typeof renderMyTripsPanel === "function") renderMyTripsPanel();
}
// Helper: how many valid points does this day have?
function countPointsForDay(day, trip = null) {
  const useTrip = trip || { cart: window.cart || [] };
  return (useTrip.cart || []).filter(
    it =>
      it.day == day &&
      it.location &&
      typeof it.location.lat === "number" &&
      typeof it.location.lng === "number" &&
      !Number.isNaN(it.location.lat) &&
      !Number.isNaN(it.location.lng)
  ).length;
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

// Thumbnail fonksiyonunu DÜZELT:
async function generateTripThumbnailOffscreen(trip, day, width = 120, height = 80) {
    const pts = getPointsFromTrip(trip, day);
    if (!pts || pts.length < 2) return null;
    const lats = pts.map(p => p.lat);
    const lngs = pts.map(p => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const bounds = [[minLng, minLat], [maxLng, maxLat]];
    const center = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];

    const mapDiv = document.createElement('div');
    mapDiv.style.width = width + 'px';
    mapDiv.style.height = height + 'px';
    mapDiv.style.position = 'fixed';
    mapDiv.style.left = '-10000px';
    mapDiv.style.top = '-10000px';
    document.body.appendChild(mapDiv);

    const map = new maplibregl.Map({
        container: mapDiv,
        style: 'https://tiles.openfreemap.org/styles/positron',
        center: center,
        zoom: 13,
        preserveDrawingBuffer: true,
        interactive: false,
        attributionControl: false
    });

    await new Promise(resolve => {
        map.on('load', () => {
            map.fitBounds(bounds, { padding: 18, maxZoom: 15, minZoom: 12 });
            setTimeout(resolve, 700);
        });
    });

    const mapCanvas = map.getCanvas();

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(mapCanvas, 0, 0, width, height);

    ctx.save();
    ctx.strokeStyle = '#1976d2';
    ctx.lineWidth = 4;
    ctx.beginPath();

    function project(lng, lat) {
        const p = map.project([lng, lat]);
        return [p.x, p.y];
    }
    const polyline = (trip.directionsPolylines && Array.isArray(trip.directionsPolylines[day]) && trip.directionsPolylines[day].length >= 2)
        ? trip.directionsPolylines[day]
        : pts;
    const flyMode = !areAllPointsInTurkey(polyline); // areAllPointsInTurkey fonksiyonun yukarıda olacak

if (flyMode) {
    // markerlar arasında yay (Bezier/kavis) ile çiz
    for (let i = 0; i < polyline.length - 1; i++) {
        const getCurvedArcCoords = window.getCurvedArcCoords || function(start, end, strength = 0.33, segments = 22) {
            // Bezier arc generator
            const sx = start[0], sy = start[1];
            const ex = end[0], ey = end[1];
            const mx = (sx + ex) / 2 + strength * (ey - sy);
            const my = (sy + ey) / 2 - strength * (ex - sx);
            const coords = [];
            for (let t = 0; t <= 1; t += 1 / segments) {
                const x = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * mx + t * t * ex;
                const y = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * my + t * t * ey;
                coords.push([x, y]);
            }
            return coords;
        };
        const arc = getCurvedArcCoords(
            [polyline[i].lng, polyline[i].lat],
            [polyline[i + 1].lng, polyline[i + 1].lat],
            0.33, 18
        );
        arc.forEach((pt, j) => {
            const [x, y] = project(pt[0], pt[1]);
            if (i === 0 && j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
    }
} else {
    // Türkiye ise, gerçek polyline (düz çizgi) kalsın
    polyline.forEach((p, i) => {
        const [x, y] = project(p.lng, p.lat);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
}
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#d32f2f';
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    pts.forEach((p) => {
        const [x, y] = project(p.lng, p.lat);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
    });
    ctx.restore();

    map.remove();
    document.body.removeChild(mapDiv);

    return canvas.toDataURL('image/png');
}

function safeParse(jsonStr) {
  if (!jsonStr || jsonStr === "undefined" || jsonStr === undefined || jsonStr === null) return null;
  try { return JSON.parse(jsonStr); } catch { return null; }
}
async function saveCurrentTripToStorage({ withThumbnail = true, delayMs = 0 } = {}) {
  window.directionsPolylines = window.directionsPolylines || {};
  if (delayMs && delayMs > 0) {
    await new Promise(res => setTimeout(res, delayMs));
  }

  let tripTitle;
  if (window.__startedWithMapFlag) {
    tripTitle = getNextTripTitle();
    window.__startedWithMapFlag = false; // Sıfırla (sadece ilk kayıtta çalışacak)
    window.activeTripKey = null; // Kritik: yeni trip başlatılırken key sıfırlansın
  } else {
    tripTitle = (
      (window.activeTripKey && getAllSavedTrips()[window.activeTripKey] && getAllSavedTrips()[window.activeTripKey].title)
        ? getAllSavedTrips()[window.activeTripKey].title
        : (window.lastUserQuery && window.lastUserQuery.trim().length > 0)
          ? window.lastUserQuery.trim()
          : (window.cart && window.cart.length > 0 && window.cart[0].title)
            ? window.cart[0].title
            : getNextTripTitle()
    );
  }
  // TRIP TITLE HER ZAMAN LATIN OLSUN
tripTitle = toLatin(tripTitle);

  if (!tripTitle && window.selectedCity && Array.isArray(window.cart) && window.cart.length > 0) {
    tripTitle = `${window.selectedCity} trip plan`;
  }

  let tripDate = (window.cart && window.cart.length > 0 && window.cart[0].date)
    ? window.cart[0].date
    : (new Date()).toISOString().slice(0, 10);

  let trips = safeParse(localStorage.getItem(TRIP_STORAGE_KEY)) || {};
  let tripKey;
  // --- En önemli blok ---
  if (window.activeTripKey) {
    // Zaten aktif bir trip varsa, ona ekle
    tripKey = window.activeTripKey;
  } else {
    // Yeni bir trip başlatılıyorsa (ör: Start with map veya yeni chat)
    let timestamp = Date.now();
tripKey = toLatin(tripTitle.replace(/\s+/g, "_")) + "_" + tripDate.replace(/[^\d]/g, '') + "_" + timestamp;
    window.activeTripKey = tripKey; // Sadece ilk defa trip oluşturulurken atanır
  }
  // --------------------------------

  const tripObj = {
    title: tripTitle,
    date: tripDate,
    days: window.cart && window.cart.length > 0
      ? Math.max(...window.cart.map(item => item.day || 1))
      : 1,
    cart: window.cart ? JSON.parse(JSON.stringify(window.cart)) : [],
    customDayNames: window.customDayNames ? { ...window.customDayNames } : {},
    lastUserQuery: window.lastUserQuery || "",
    selectedCity: window.selectedCity || "",
    updatedAt: Date.now(),
    key: tripKey,
    directionsPolylines: window.directionsPolylines ? JSON.parse(JSON.stringify(window.directionsPolylines)) : {},
    aiInfo: window.lastTripAIInfo || null // <-- EKLE
  };

  // Thumbnail üretimi
  const thumbnails = {};
  const days = tripObj.days;
  for (let day = 1; day <= days; day++) {
    if (withThumbnail && tripObj.directionsPolylines[day] && tripObj.directionsPolylines[day].length > 2) {
      thumbnails[day] = await generateTripThumbnailOffscreen(tripObj, day) || "img/placeholder.png";
    } else {
      thumbnails[day] = "img/placeholder.png";
    }
  }
  tripObj.thumbnails = thumbnails;

  tripObj.favorite =
    (trips[tripKey] && typeof trips[tripKey].favorite === "boolean")
      ? trips[tripKey].favorite : false;

  trips[tripKey] = tripObj;
  localStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify(trips));
}
async function saveCurrentTripToStorageWithThumbnailDelay() {
    // 500-1000ms gecikme ile harita oluşmuş olur
    saveTripAfterRoutes();
 }
function getNextTripTitle() {
  const trips = getAllSavedTrips();
  let maxNum = 0;
  Object.values(trips).forEach(t => {
    const m = String(t.title || '').match(/^My Trip(?: #(\d+))?$/);
    if (m) {
      const num = m[1] ? parseInt(m[1], 10) : 1;
      if (num > maxNum) maxNum = num;
    }
  });
  const nextNum = maxNum + 1;
  return `My Trip #${nextNum}`;
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
    const trips = safeParse(localStorage.getItem(TRIP_STORAGE_KEY));
    if (!trips || typeof trips !== "object") return {};
    return trips;
}  

function showTripAiInfo(aiInfo) {
  const aiSummary = document.getElementById('ai-summary');
  const aiTip = document.getElementById('ai-tip');
  const aiHighlight = document.getElementById('ai-highlight');
  if (aiSummary) aiSummary.textContent = aiInfo.summary || "";
  if (aiTip) aiTip.textContent = aiInfo.tip || "";
  if (aiHighlight) aiHighlight.textContent = aiInfo.highlight || "";
}

function loadTripFromStorage(tripKey) {
    window.activeTripKey = tripKey;

    const trips = getAllSavedTrips();
    if (!trips[tripKey]) return false;
    const t = trips[tripKey];

    // --- AI kutusu işlemleri ---
    if (t.aiInfo) {
        window.lastTripAIInfo = t.aiInfo;
        let aiDiv = document.querySelector('.ai-info-section');
        if (!aiDiv) {
            insertTripAiInfo(null, t.aiInfo); // Sadece kutuyu oluşturup localStorage bilgisini dolduracak
        } else {
            showTripAiInfo(t.aiInfo); // Kutuyu yeniden doldur
        }
    }

    // window.cart doğrudan TÜM item’larıyla kopyalanmalı:
    window.cart = Array.isArray(t.cart) && t.cart ? JSON.parse(JSON.stringify(t.cart)) : [];
    window.latestTripPlan = Array.isArray(t.cart) && t.cart ? JSON.parse(JSON.stringify(t.cart)) : [];
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
        for (let day = 1; day <= maxDay; day++) {
            await renderRouteForDay(day);
        }
        saveTripAfterRoutes();
    }, 0);


    return true;
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

    if (diffMin < 15) return "Last 15 minutes";
    if (diffHour < 1) return "Last 1 hour";
    if (diffDay < 1) return "Last 1 day";
    if (diffDay < 7) return "Last 1 week";
    if (diffDay < 15) return "Last 15 days";
    if (diffDay < 31) return "Last 1 month";
    return "Older";
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
const groupOrder = [
    "Last 15 minutes",
    "Last 1 hour",
    "Last 1 day",
    "Last 1 week",
    "Last 15 days",
    "Last 1 month",
    "Older"
];    let firstGroup = true;
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
    thumbImg.style.borderRadius = "8px";


    const dayCount = trip.days || (trip.cart ? Math.max(1, ...trip.cart.map(i => i.day || 1)) : 1);
    const itemCount = (trip.cart || []).filter(it =>
        (it.name && it.name.trim() !== '') || (it.location && typeof it.location.lat === "number")
    ).length;

    const thumbInfo = document.createElement("div");
thumbInfo.className = "mytrips-thumb-info";
    thumbInfo.innerHTML = `<div>${dayCount} day</div><div>${itemCount} place</div>`;
thumbInfo.style.position = "absolute";
thumbInfo.style.top = "0";
thumbInfo.style.left = "0";
thumbInfo.style.width = "100%";
thumbInfo.style.height = "100%";
thumbInfo.style.background = "rgb(152, 104, 232)";
thumbInfo.style.color = "#fff";
thumbInfo.style.fontSize = "13px";
thumbInfo.style.opacity = "0";
thumbInfo.style.pointerEvents = "none"; // hover kutusu hover'ı engellemesin
thumbInfo.style.transition = "opacity 0.25s";
thumbInfo.style.flexDirection = "column";
thumbInfo.style.display = "flex";
thumbInfo.style.alignItems = "center";
thumbInfo.style.justifyContent = "center";
thumbInfo.style.borderRadius = "8px";
thumbInfo.style.zIndex = "2";

tripDiv.addEventListener("mouseenter", () => {
  thumbInfo.style.opacity = "1";
});
tripDiv.addEventListener("mouseleave", () => {
  thumbInfo.style.opacity = "0";
});

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
    input.addEventListener("blur", function() {
        doRename();
    });

    titleDiv.replaceWith(input);
    input.focus();

                function doRename() {
                    const newTitle = input.value.trim();
                    if (!newTitle) return cancelRename();
                    const all = getAllSavedTrips();
                    const oldKey = trip.key;
const newKey = toLatin(newTitle.replace(/\s+/g, "_")) + "_" + trip.date.replace(/[^\d]/g, '');

                    if (newKey === oldKey) return cancelRename();

                    trip.title = newTitle;
                    trip.key = newKey;
                    trip.updatedAt = Date.now();

                    delete all[oldKey];
                    all[newKey] = trip;

                    // EN KRİTİK: lastUserQuery'yi de güncelle
                    if (window.activeTripKey === oldKey) {
                        window.activeTripKey = newKey;
                        window.cart = JSON.parse(JSON.stringify(trip.cart));
                        window.customDayNames = trip.customDayNames ? { ...trip.customDayNames } : {};
                        window.lastUserQuery = newTitle; // <-- Burası!
                        window.selectedCity = trip.selectedCity || "";
                        window.latestTripPlan = Array.isArray(trip.cart) ? JSON.parse(JSON.stringify(trip.cart)) : [];
                    }

                    localStorage.setItem("triptime_user_trips_v2", JSON.stringify(all));
                    setTimeout(() => { renderMyTripsPanel(); }, 0);
                }
    function cancelRename() {
        setTimeout(() => { renderMyTripsPanel(); }, 0);
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
        if (
      e.target === renameBtn ||
      e.target === deleteBtn ||
      (e.target.classList && e.target.classList.contains('trip-rename-save')) ||
      (e.target.tagName === "INPUT")
    ) return;

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


// 6. Sayfa açılışında My Trips panelini doldur
document.addEventListener("DOMContentLoaded", function() {
    renderMyTripsPanel();

});

// 7. Yeni plan başladığında eski trip state'i sıfırla (startNewChat fonksiyonu varsa!)
window.startNewChat = function() {
    window.cart = [];
    window.customDayNames = {};
    window.lastUserQuery = "";
    window.selectedCity = "";
    window.activeTripKey = null;
    saveTripAfterRoutes();
};



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
      // Şu an sadece düz çizgi: getPointsFromTrip(trip, day)
      // YERİNE, GERÇEK Polyline'ı Directions API'den çekmelisin:
      if (
        !trip.directionsPolylines[day] &&
        (trip.cart || []).filter(it => it.day == day && it.location && typeof it.location.lat === "number" && typeof it.location.lng === "number").length >= 2
      ) {
        // DÜZELTME: Directions API'ye istek at, polyline'ı bul
        // const polyline = await fetchDirectionsPolyline(trip, day);  // <--- Senin Directions fonksiyonun
        // trip.directionsPolylines[day] = polyline;
        // updated = true;

        // Şu anda Directions API yoksa, sadece düz çizgi çizer!
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


// Debounce fonksiyonu (her gün için ayrı)
let lastRouteRequest = {};
function debounceRoute(day, points, cb, delay = 600) {
  if (lastRouteRequest[day]) clearTimeout(lastRouteRequest[day]);
  lastRouteRequest[day] = setTimeout(() => cb(day, points), delay);
}

// Polyline çizim fonksiyonu
function updatePolylineForDay(day, points) {
  // 2'den az nokta varsa polyline yok
  if (points.length < 2) return;
  // Hemen düz çizgi ile göster
  window.directionsPolylines = window.directionsPolylines || {};
  window.directionsPolylines[day] = points.map(p => ({ lat: p.lat, lng: p.lng }));
  // API'dan gerçek polyline alınacaksa:
  fetchDirectionsPolylineAPI(points).then(apiPolyline => {
    window.directionsPolylines[day] = apiPolyline;
    // Harita & thumbnail güncelle
    renderRouteForDay(day);
  });
}

function fetchDirectionsPolylineAPI(points) {
  // Directions API yoksa, sadece düz çizgi döndür
  return Promise.resolve(points.map(p => ({ lat: p.lat, lng: p.lng })));
}
function deleteTrip(tripKey) {
    const trips = JSON.parse(localStorage.getItem("triptime_user_trips_v2") || "{}");
    if (trips[tripKey]) {
        delete trips[tripKey];
        localStorage.setItem("triptime_user_trips_v2", JSON.stringify(trips));
    }
    if (typeof renderMyTripsPanel === "function") renderMyTripsPanel();
}


// Favori listesi (localStorage ile kalıcı)
window.favTrips = JSON.parse(localStorage.getItem('favTrips') || '[]');
function saveFavTrips() {
    localStorage.setItem('favTrips', JSON.stringify(window.favTrips));
}

async function toggleFavTrip(item, heartEl) {
     // Şehir/ülke eksikse, doldur
    if (!item.city || !item.country) {
        if (item.address) {
            // Adresten şehir ve ülkeyi tahmin et
            const addrParts = item.address.split(",");
            item.city = addrParts.length >= 2 ? addrParts[addrParts.length-2].trim() : window.selectedCity || "Unknown City";
            item.country = addrParts.length >= 1 ? addrParts[addrParts.length-1].trim() : "Unknown Country";
        } else {
            item.city = window.selectedCity || "Unknown City";
            item.country = "Unknown Country";
        }
    }
    // Eğer item.image yoksa, otomatik olarak doldur
    if (!item.image || item.image === "" || item.image === "img/placeholder.png") {
        // Fotoğrafı AI veya API'dan çek
        if (typeof getImageForPlace === "function") {
            item.image = await getImageForPlace(item.name, item.category, window.selectedCity || "");
        } else {
            item.image = "img/placeholder.png";
        }
    }
    const idx = window.favTrips.findIndex(f =>
        f.name === item.name &&
        f.category === item.category &&
        String(f.lat) === String(item.lat) &&
        String(f.lon) === String(item.lon)
    );
    if (idx >= 0) {
        window.favTrips.splice(idx, 1);
        heartEl.innerHTML = '<img class="fav-icon" src="img/like_off.svg" alt="notfav">';
        heartEl.classList.remove("is-fav");
    } else {
        window.favTrips.push(item);
        heartEl.innerHTML = '<img class="fav-icon" src="img/like_on.svg" alt="fav">';
        heartEl.classList.add("is-fav");
    }
    saveFavTrips();
}
function getFavoriteTrips() {
    return window.favTrips || [];
}

function groupFavoritesByCountryCity(favList) {
    const grouped = {};
    favList.forEach(place => {
        const country = place.country || place.properties?.country || "Unknown Country";
        const city = place.city || place.properties?.city || place.properties?.name || "Unknown City";
        const key = `${city}, ${country}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(place);
    });
    return grouped;
}
async function renderFavoritePlacesPanel() {
    const favPanel = document.getElementById("favorite-places-panel");
    if (!favPanel) return;
    favPanel.innerHTML = "";

    const favList = window.favTrips || [];
    if (favList.length === 0) {
        favPanel.innerHTML = `<div class="mytrips-empty">No favorite places yet.<br>Add places to favorites to see them here!</div>`;
        return;
    }

    for (let place of favList) {
        // Şehir
        if (!place.city || place.city === "Unknown City") {
            if (place.address) {
                const addrParts = place.address.split(",");
                place.city = addrParts.length >= 2 ? addrParts[addrParts.length - 2].trim() : place.address.trim();
            } else if (place.properties?.city) {
                place.city = place.properties.city;
            } else {
                place.city = window.selectedCity || "Unknown City";
            }
        }
        // Ülke
        if (!place.country || place.country === "Unknown Country") {
            if (place.address) {
                const addrParts = place.address.split(",");
                place.country = addrParts.length > 1 ? addrParts[addrParts.length - 1].trim() : "Unknown Country";
            } else if (place.properties?.country) {
                place.country = place.properties.country;
            } else {
                place.country = "Unknown Country";
            }
        }
        // Görsel
        if (!place.image || place.image === "img/placeholder.png") {
            if (typeof getImageForPlace === "function") {
                try {
                    place.image = await getImageForPlace(place.name, place.category, place.city || window.selectedCity || "");
                } catch {
                    place.image = "img/placeholder.png";
                }
            } else {
                place.image = "img/placeholder.png";
            }
        }
    }

    // Gruplama ve render - senin kodun ile aynı
    function groupFavoritesByCountryCity(list) {
    const grouped = {};
    list.forEach(place => {
        const city = place.city && place.city !== "Unknown City" ? place.city : "";
        const country = place.country && place.country !== "Unknown Country" ? place.country : "";
        let key = "";
        if (city && country) key = `${city}, ${country}`;
        else if (city) key = city;
        else if (country) key = country;
        else key = "Unknown";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(place);
    });
    return grouped;
}
    const grouped = groupFavoritesByCountryCity(favList);

    Object.entries(grouped).forEach(([locationKey, places]) => {
        const section = document.createElement("div");
        section.className = "fav-place-group";
        section.innerHTML = `<h3 style="margin-bottom:10px; color:#6c3fc2;">${locationKey}</h3>`;

        const ul = document.createElement("ul");
        ul.style = "list-style:none;padding:0;margin:0;";

        places.forEach((place, i) => {
            const li = document.createElement("li");
            li.className = "fav-item";
            li.style = "margin-bottom:12px;background:#f8f9fa;border-radius:12px;box-shadow:0 1px 6px #e3e3e3;padding:9px 12px;display:flex;align-items:center;gap:16px;min-width:0;";

            const imgDiv = document.createElement("div");
            imgDiv.style = "width:42px;height:42px;";
            const img = document.createElement("img");
            img.src = place.image || "img/placeholder.png";
            img.alt = place.name || "";
            img.style = "width:100%;height:100%;object-fit:cover;border-radius:8px;";
            imgDiv.appendChild(img);

            const infoDiv = document.createElement("div");
            infoDiv.style = "flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;";
            infoDiv.innerHTML = `
                <span style="font-weight:500;font-size:15px;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${place.name}</span>
                <span style="font-size:12px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${place.address || ""}</span>
                <span style="font-size:11px;color:#1976d2;background:#e3e8ff;border-radius:6px;padding:1px 7px;display:inline-block;margin-top:2px;width:max-content;text-overflow:ellipsis;overflow:hidden;">${place.category || ""}</span>
            `;

            const btnDiv = document.createElement("div");
            btnDiv.style = "display:flex;flex-direction:row;align-items:center;gap:7px;";

            const addBtn = document.createElement("button");
            addBtn.className = "add-fav-to-trip-btn";
            addBtn.setAttribute("data-index", i);
            addBtn.title = "Add to trip";
            addBtn.style = "width:32px;height:32px;background:#1976d2;color:#fff;border:none;border-radius:50%;font-size:18px;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center;";
            addBtn.textContent = "+";
            addBtn.onclick = function() {
                addToCart(
                    place.name,
                    place.image,
                    window.currentDay || 1,
                    place.category,
                    place.address || "",
                    null, null, place.opening_hours || "",
                    null,
                    place.lat && place.lon ? { lat: Number(place.lat), lng: Number(place.lon) } : null,
                    place.website || ""
                );
                if (typeof updateCart === "function") updateCart();
                const overlay = document.getElementById('sidebar-overlay-favorite-places');
                if (overlay) overlay.classList.remove('open');
                window.toggleSidebar && window.toggleSidebar('sidebar-overlay-trip');
            };

            const removeBtn = document.createElement("button");
            removeBtn.className = "remove-fav-btn";
            removeBtn.setAttribute("data-name", place.name);
            removeBtn.setAttribute("data-category", place.category);
            removeBtn.setAttribute("data-lat", place.lat || "");
            removeBtn.setAttribute("data-lon", place.lon || "");
            removeBtn.title = "Remove from favorites";
            removeBtn.style = "width:32px;height:32px;background:#ffecec;color:#d32f2f;border:none;border-radius:50%;font-size:20px;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center;";
            removeBtn.textContent = "–";
            removeBtn.onclick = function() {
                window.favTrips.splice(i, 1);
                localStorage.setItem('favTrips', JSON.stringify(window.favTrips));
                renderFavoritePlacesPanel();
            };

            btnDiv.appendChild(addBtn);
            btnDiv.appendChild(removeBtn);

            li.appendChild(imgDiv);
            li.appendChild(infoDiv);
            li.appendChild(btnDiv);

            ul.appendChild(li);
        });

        section.appendChild(ul);
        favPanel.appendChild(section);
    });
}