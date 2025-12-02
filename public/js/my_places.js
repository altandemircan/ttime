function attachFavEvents() {
    // Kalp tıklama (slider için)
    document.querySelectorAll('.fav-heart').forEach(function(el){
        el.onclick = async function(e){
            e.stopPropagation();
            const item = {
                name: el.getAttribute('data-name'),
                category: el.getAttribute('data-category'),
                lat: el.getAttribute('data-lat'),
                lon: el.getAttribute('data-lon'),
                image: el.getAttribute('data-image') || ""
            };
            await toggleFavTrip(item, el);
            updateFavoriteBtnText(el);
        };
    });

    // Buton tıklama (sidebar için, tamamı)
    document.querySelectorAll('.add-favorite-btn').forEach(function(btn){
        btn.onclick = async function(e){
            e.stopPropagation();
            const el = btn.querySelector('.fav-heart');
            if (!el) return;
            const item = {
                name: el.getAttribute('data-name'),
                category: el.getAttribute('data-category'),
                lat: el.getAttribute('data-lat'),
                lon: el.getAttribute('data-lon'),
                image: el.getAttribute('data-image') || ""
            };
            await toggleFavTrip(item, el);
            updateFavoriteBtnText(el);
        };
    });
}

// Buton textini güncelleyen fonksiyon
function updateFavoriteBtnText(favHeartEl) {
    const btn = favHeartEl.closest('.add-favorite-btn');
    if (!btn) return;
    const item = {
        name: favHeartEl.getAttribute('data-name'),
        category: favHeartEl.getAttribute('data-category'),
        lat: favHeartEl.getAttribute('data-lat'),
        lon: favHeartEl.getAttribute('data-lon'),
    };
    const btnText = btn.querySelector('.fav-btn-text');
    if (btnText) {
        if (isTripFav(item)) {
            btnText.textContent = "Delete from My Places";
        } else {
            btnText.textContent = "Add to My Places";
        }
    }
}


// Favori listesi (localStorage ile kalıcı)
window.favTrips = JSON.parse(localStorage.getItem('favTrips') || '[]');
function saveFavTrips() {
    localStorage.setItem('favTrips', JSON.stringify(window.favTrips));
}

async function toggleFavTrip(item, heartEl) {
    // Liste yoksa oluştur
    window.favTrips = window.favTrips || [];

    // Şehir/ülke eksikse, doldur
    if (!item.city || !item.country) {
        if (item.address) {
            const addrParts = item.address.split(",");
            item.city = addrParts.length >= 2 ? addrParts[addrParts.length-2].trim() : window.selectedCity || "Unknown City";
            item.country = addrParts.length >= 1 ? addrParts[addrParts.length-1].trim() : "Unknown Country";
        } else {
            item.city = window.selectedCity || "Unknown City";
            item.country = "Unknown Country";
        }
    }

    // image yoksa otomatik doldur
    if (!item.image || item.image === "" || item.image === "img/placeholder.png") {
        if (typeof getImageForPlace === "function") {
            item.image = await getImageForPlace(item.name, item.category, window.selectedCity || "");
        } else {
            item.image = "img/placeholder.png";
        }
    }

    // Favoride mi kontrol et
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

    // LocalStorage veya API ile kaydet
    if (typeof saveFavTrips === "function") {
        saveFavTrips();
    } else {
        localStorage.setItem("favTrips", JSON.stringify(window.favTrips));
    }
    // Konsol debug:
    console.log("FavTrips:", window.favTrips);
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
