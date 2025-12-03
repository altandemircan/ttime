async function updateCart() {
  window.pairwiseRouteSummaries = window.pairwiseRouteSummaries || {};
  
  const oldStartDate = window.cart.startDate;
  const oldEndDates  = window.cart.endDates;
  window.cart = window.cart.filter(it => it && (it.day || it.name)); 
  if (oldStartDate) window.cart.startDate = oldStartDate;
  if (oldEndDates)  window.cart.endDates  = oldEndDates;

  const days = [...new Set(window.cart.map(i => i.day))].sort((a, b) => a - b);
  const totalDays = Math.max(1, ...window.cart.map(i => i.day || 1));

  // Rotaları Çiz
  for (const d of days) {
    try { renderRouteForDay(d); } catch(e) {}
  }

  document.querySelectorAll('.route-scale-bar[id^="route-scale-bar-day"]').forEach(el => el.remove());
  if (window.expandedMaps) {
    days.forEach(day => {
        if(typeof clearRouteSegmentHighlight === 'function') clearRouteSegmentHighlight(day);
    });
    window._lastSegmentDay = undefined;
  }

  const cartDiv = document.getElementById("cart-items");
  const menuCount = document.getElementById("menu-count");
  if (!cartDiv) return;

  // --- BOŞ CART KONTROLÜ ---
  if (!window.cart || window.cart.length === 0) {
    cartDiv.innerHTML = `
      <div class="day-container" id="day-container-1" data-day="1">
        <h4 class="day-header"><div class="title-container"><span class="day-title">Day 1</span></div></h4>
        <ul class="day-list" data-day="1">
          <div class="empty-day-block">
            <p class="empty-day-message">No item has been added yet.</p>
            <div><button id="start-map-btn" type="button" class="start-map-btn" data-day="1">Start with map</button></div>
          </div>
        </ul>
      </div>
      <hr class="add-new-day-separator">
    `;
    if (menuCount) { menuCount.textContent = 0; menuCount.style.display = "none"; }
    const addNewDayButton = document.getElementById("add-new-day-button");
    if (addNewDayButton) addNewDayButton.onclick = function () { addNewDay(this); };
    return;
  }

  cartDiv.innerHTML = "";

  for (let day = 1; day <= totalDays; day++) {
    const dayItemsArr = window.cart.filter(i => Number(i.day) === Number(day) && !i._starter && !i._placeholder);
    
    const dayContainer = document.createElement("div");
    dayContainer.className = "day-container";
    dayContainer.id = `day-container-${day}`;
    dayContainer.dataset.day = day;

    const dayHeader = document.createElement("h4");
    dayHeader.className = "day-header";
    dayHeader.innerHTML = `<div class="title-container"><span class="day-title">${window.customDayNames?.[day] || `Day ${day}`}</span></div>`;
    if(typeof createDayActionMenu === 'function') dayHeader.appendChild(createDayActionMenu(day));
    dayContainer.appendChild(dayHeader);

    const confCont = document.createElement("div");
    confCont.className = "confirmation-container";
    confCont.id = `confirmation-container-${day}`;
    confCont.style.display = "none";
    dayContainer.appendChild(confCont);

    const dayList = document.createElement("ul");
    dayList.className = "day-list";
    dayList.dataset.day = day;

    for (let idx = 0; idx < dayItemsArr.length; idx++) {
      const item = dayItemsArr[idx];
      const currIdx = window.cart.indexOf(item);

      const li = document.createElement("li");
      li.className = "travel-item";
      // DİKKAT: Draggable false, drag.js yönetecek
      li.dataset.index = currIdx;
      
      if (item.location?.lat) {
        li.setAttribute("data-lat", item.location.lat);
        li.setAttribute("data-lon", item.location.lng);
      }

      const listMarkerHtml = `<div class="custom-marker-outer red" style="flex-shrink:0; transform:scale(0.70); position:absolute; left:30px; top:0px;"><span class="custom-marker-label" style="font-size:14px;">${idx + 1}</span></div>`;

      if (item.category === "Note") {
         li.innerHTML = `
          <div class="cart-item">
             <div style="display:flex; align-items:center; justify-content:space-between; width:100%">
              <div style="display:flex; align-items:center; gap:10px;">
                ${listMarkerHtml} 
                <img src="${item.image || 'img/added-note.png'}" class="cart-image">
                <div class="item-info"><p class="toggle-title">${item.name}</p></div>
              </div>
              <div style="display:flex; align-items:center; gap:5px;">
                <button class="remove-btn" onclick="removeFromCart(${currIdx})"><img src="img/remove-icon.svg"></button>
                <span class="arrow"><img src="https://www.svgrepo.com/show/520912/right-arrow.svg" class="arrow-icon" onclick="toggleContent(this)"></span>
              </div>
            </div>
            <div class="content">
              <div class="info-section"><div class="note-details"><p>${item.noteDetails || ""}</p></div></div>
            </div>
          </div>`;
      } else {
         const leafletMapId = "leaflet-map-" + currIdx;
         const mapHtml = item.location ? `<div class="map-container"><div class="leaflet-map" id="${leafletMapId}" style="width:100%;height:250px;"></div></div>` : '';
         
         li.innerHTML = `
          <div class="cart-item">
            <div style="display:flex; align-items:center; justify-content:space-between; width:100%">
              <div style="display:flex; align-items:center; gap:10px;">
                <img src="https://www.svgrepo.com/show/458813/move-1.svg" class="drag-icon">
                <div class="item-position">${listMarkerHtml}<img src="${item.image}" class="cart-image"></div>
                <img src="${categoryIcons[item.category] || ''}" class="category-icon">
                <div class="item-info"><p class="toggle-title">${item.name}</p></div>
              </div>
              <span class="arrow"><img src="https://www.svgrepo.com/show/520912/right-arrow.svg" class="arrow-icon" onclick="toggleContent(this)"></span>
            </div>
            <div class="content">
              <div class="info-section">
                <div class="place-rating">${mapHtml}</div>
                <div class="contact"><p>📌 ${item.address || ''}</p></div>
                <p class="working-hours-title">🕔 <span class="working-hours-value">${item.opening_hours || ''}</span></p>
              </div>
              <button class="add-favorite-btn" data-name="${item.name}" onclick=""><span class="fav-heart">❤️</span> Add to My Places</button>
              <button class="remove-btn" onclick="showRemoveItemConfirmation(${currIdx}, this)">Remove place</button>
              <div class="confirmation-container" id="confirmation-item-${currIdx}" style="display:none;">
                 <p>Remove?</p>
                 <button class="confirm-remove-btn" onclick="confirmRemoveItem(${currIdx})">OK</button>
                 <button class="cancel-action-btn" onclick="hideItemConfirmation('confirmation-item-${currIdx}')">Cancel</button>
              </div>
            </div>
          </div>`;
      }
      dayList.appendChild(li);
      
      const nextItem = dayItemsArr[idx + 1];
      if (item.location && nextItem && nextItem.location) {
          const sep = document.createElement('div');
          sep.className = 'distance-separator';
          sep.innerHTML = `<div class="separator-line"></div><div class="distance-label">...</div><div class="separator-line"></div>`;
          dayList.appendChild(sep);
      }
    }
    
    const addMoreBtn = document.createElement("button");
    addMoreBtn.className = "add-more-btn";
    addMoreBtn.textContent = "+ Add Category";
    addMoreBtn.onclick = function() { showCategoryList(day); };
    if (!window.__hideAddCatBtnByDay?.[day]) {
       dayList.appendChild(addMoreBtn);
    }

    dayContainer.appendChild(dayList);
    
    if(typeof ensureDayMapContainer === 'function') ensureDayMapContainer(day);
    if(typeof initEmptyDayMap === 'function') initEmptyDayMap(day);
    if(typeof wrapRouteControls === 'function') wrapRouteControls(day);

    cartDiv.appendChild(dayContainer);
  }

  const hr = document.createElement('hr'); hr.className = 'add-new-day-separator'; cartDiv.appendChild(hr);
  const addDayBtn = document.createElement("button");
  addDayBtn.className = "add-new-day-btn";
  addDayBtn.textContent = "+ Add New Day";
  addDayBtn.onclick = function () { addNewDay(this); };
  cartDiv.appendChild(addDayBtn);

  if (menuCount) {
      const count = window.cart.filter(i => i.name && !i._starter).length;
      menuCount.textContent = count;
      menuCount.style.display = count > 0 ? "inline-block" : "none";
  }

  // --- TEMİZLİK: Sadece aktif fonksiyonları çağır ---
  days.forEach(d => initPlaceSearch(d));
  if(typeof addCoordinatesToContent === 'function') addCoordinatesToContent();
  
  days.forEach(d => {
    const suppressing = window.__suppressMiniUntilFirstPoint && window.__suppressMiniUntilFirstPoint[d];
    const realPoints = getDayPoints ? getDayPoints(d) : [];
    if (suppressing && realPoints.length === 0) return;
    renderRouteForDay(d);
  });

  setTimeout(() => { if(typeof wrapRouteControlsForAllDays === 'function') wrapRouteControlsForAllDays(); }, 0);
  
  if (window.expandedMaps) {
    Object.values(window.expandedMaps).forEach(({ expandedMap, day }) => {
      if (expandedMap && typeof updateExpandedMap === 'function') updateExpandedMap(expandedMap, day);
    });
  }

  if(typeof setupSidebarAccordion === 'function') setupSidebarAccordion();
  if(typeof renderTravelModeControlsForAllDays === 'function') renderTravelModeControlsForAllDays();
}