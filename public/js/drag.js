// ========== GLOBAL ==========
if (!window.cart || !Array.isArray(window.cart)) window.cart = [];

let placeholder = null;
let isMobile = false;
let draggedItem = null;
let currentDropZone = null;
let touchStartX = 0;
let touchStartY = 0;

// Long-press state
let longPressTimer = null;
let longPressTriggered = false;
let touchTargetItem = null;
const LONG_PRESS_MS = 350;       // 300-500ms arası önerilir
const MOVE_CANCEL_PX = 12;       // Long press başlamadan önce bu kadar hareket iptal eder

// ========== DEVICE DETECTION ==========
function isTouchDevice() {
    return 'ontouchstart' in window || 
           navigator.maxTouchPoints > 0 || 
           navigator.msMaxTouchPoints > 0;
}

// ========== INITIALIZATION ==========
function initDragDropSystem() {
    isMobile = isTouchDevice();
    
    if (isMobile) {
        initTouchDragDrop();
    } else {
        setupDesktopDragDrop();
    }
    
    setupDropZones();
   
}

function initTouchDragDrop() {
    document.querySelectorAll('.travel-item').forEach(item => {
        // Önceki listener’ları temizle (tekrarı önlemek için)
        item.removeEventListener('touchstart', handleTouchStart);
        item.removeEventListener('touchmove', handleTouchMove);
        item.removeEventListener('touchend', handleTouchEnd);
        item.removeEventListener('touchcancel', handleTouchCancel);

        item.addEventListener('touchstart', handleTouchStart, { passive: false });
        item.addEventListener('touchmove', handleTouchMove, { passive: false });
        item.addEventListener('touchend', handleTouchEnd);
        item.addEventListener('touchcancel', handleTouchCancel);
    });
}

// ========== DESKTOP DRAG & DROP ==========
function setupDesktopDragDrop() {
    document.querySelectorAll('.travel-item').forEach(item => {
        item.setAttribute('draggable', true);
        item.addEventListener('dragstart', desktopDragStart);
        item.addEventListener('dragend', desktopDragEnd);
    });
}

function dragStart(event) {
    const index = event.currentTarget.dataset.index;
    if (index !== undefined) {
        event.dataTransfer.setData("text/plain", index);
        event.dataTransfer.setData("source", "cart");
        event.dataTransfer.effectAllowed = "move";
        event.currentTarget.classList.add('dragging');
    }
}


function allowDrop(event) {
    event.preventDefault();
    if (!placeholder) {
        placeholder = document.createElement("div");
        placeholder.classList.add("insertion-placeholder");
    }

    const target = event.target.closest("li.travel-item, .day-list");
    if (!target) return;

    const parent = target.closest(".day-list");
    if (!parent) return;

    if (target.classList.contains("travel-item")) {
        if (placeholder.parentNode !== parent || placeholder.nextSibling !== target) {
            parent.insertBefore(placeholder, target);
        }
    } else if (target.classList.contains("day-list")) {
        if (placeholder.parentNode !== parent || placeholder !== parent.lastChild) {
            parent.appendChild(placeholder);
        }
    }
}

function drop(event) {
    event.preventDefault();
    if (!placeholder) return;
    
    const source = event.dataTransfer.getData("source") || event.dataTransfer.getData("text/plain");
    if (source !== "cart") return;

    const fromIndex = parseInt(event.dataTransfer.getData("text"));
    const placeholderParent = placeholder.parentNode;
    const toDayList = placeholderParent.closest(".day-list");
    
    if (!toDayList || !toDayList.dataset?.day) {
        placeholder.remove();
        placeholder = null;
        return;
    }
    
    const toDay = parseInt(toDayList.dataset.day);
    const itemsInDay = Array.from(toDayList.querySelectorAll(".travel-item"));
    let toIndex = itemsInDay.indexOf(placeholder.nextSibling);
    if (toIndex === -1) toIndex = itemsInDay.length;

    const fromDayList = document.querySelector(`.travel-item[data-index="${fromIndex}"]`)?.closest(".day-list");
    const fromDay = fromDayList?.dataset?.day ? parseInt(fromDayList.dataset.day) : null;

    if (fromIndex === toIndex && fromDay === toDay) {
        placeholder.remove();
        placeholder = null;
        return;
    }

    reorderCart(fromIndex, toIndex, fromDay, toDay);
    placeholder.remove();
    placeholder = null;
}

function dragEnd(event) {
    event.target.classList.remove('dragging');
    if (placeholder) {
        placeholder.remove();
        placeholder = null;
    }
}


// ========== DESKTOP HANDLERS ==========
function desktopDragStart(event) {
    const index = event.target.dataset.index;
    if (index !== undefined) {
        event.dataTransfer.setData("text/plain", index);
        event.dataTransfer.setData("source", "cart");
        event.dataTransfer.effectAllowed = "move";
        event.target.classList.add('dragging');

        const rect = event.target.getBoundingClientRect();
        const clone = event.target.cloneNode(true);
        clone.id = 'drag-clone';
        clone.style.position = 'fixed';
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`;
        clone.style.left = `${rect.left}px`;
        clone.style.top = `${rect.top}px`;
        clone.style.zIndex = '10000';
        clone.style.opacity = '0.8';
        clone.style.pointerEvents = 'none';
        clone.style.boxShadow = '0 10px 20px rgba(0,0,0,0.2)';
        document.body.appendChild(clone);
    }
    document.body.classList.add('dragging-items');  // EKLE
}

function desktopDragEnd(event) {
    event.target.classList.remove('dragging');
    event.target.style.visibility = 'visible';
    
    const clone = document.getElementById('drag-clone');
    if (clone) clone.remove();
    
    if (placeholder) {
        placeholder.remove();
        placeholder = null;
    }
    document.body.classList.remove('dragging-items');  // EKLE
}

// ========== IMPROVED PLACEHOLDER SYSTEM ==========
function createPlaceholder(target) {
    if (!placeholder) {
        placeholder = document.createElement("div");
        placeholder.classList.add("insertion-placeholder");
        placeholder.style.height = '4px';
        placeholder.style.backgroundColor = '#4CAF50';
        placeholder.style.margin = '8px 0';
        placeholder.style.borderRadius = '2px';
        placeholder.style.position = 'relative';
        placeholder.innerHTML = `
            <div class="placeholder-arrow left"></div>
            <div class="placeholder-arrow right"></div>
        `;
    }

    const parent = target.closest(".day-list");
    if (!parent) return;

    if (target.classList.contains("travel-item")) {
        if (placeholder.parentNode !== parent || placeholder.nextSibling !== target) {
            parent.insertBefore(placeholder, target);
        }
    } else if (target.classList.contains("day-list")) {
        if (placeholder.parentNode !== parent || placeholder !== parent.lastChild) {
            parent.appendChild(placeholder);
        }
    }
}

function setupDropZones() {
    document.querySelectorAll('.day-list').forEach(list => {
        list.removeEventListener('dragover', desktopDragOver);
        list.removeEventListener('drop', desktopDrop);
        list.addEventListener('dragover', desktopDragOver);
        list.addEventListener('drop', desktopDrop);
        
        if (isMobile) {
            list.removeEventListener('touchmove', handleTouchMoveOver);
            list.removeEventListener('touchend', handleTouchDrop);
            list.addEventListener('touchmove', handleTouchMoveOver, { passive: false });
            list.addEventListener('touchend', handleTouchDrop);
        }
    });
}

function desktopDragOver(event) {
    event.preventDefault();

    const target = event.target.closest("li.travel-item, .day-list");
    if (!target) return;

    createPlaceholder(target);

    const dayList = target.closest('.day-list');
    if (dayList) {
        dayList.classList.add('drop-possible');
    }
}

function desktopDrop(event) {
    event.preventDefault();
    document.querySelectorAll('.day-list').forEach(list => {
        list.classList.remove('drop-possible');
    });
    
    if (!placeholder) return;
    const source = event.dataTransfer.getData("source") || event.dataTransfer.getData("text/plain");
    if (source !== "cart") return;

    const fromIndex = parseInt(event.dataTransfer.getData("text"));
    const placeholderParent = placeholder.parentNode;
    const toDayList = placeholderParent.closest(".day-list");
    
    if (!toDayList || !toDayList.dataset || !toDayList.dataset.day) {
        placeholder.remove();
        placeholder = null;
        return;
    }
    
    const toDay = parseInt(toDayList.dataset.day);
    const itemsInDay = Array.from(toDayList.querySelectorAll(".travel-item"));
    let toIndex = itemsInDay.indexOf(placeholder.nextSibling);
    if (toIndex === -1) toIndex = itemsInDay.length;

    const fromDayList = document.querySelector(`.travel-item[data-index="${fromIndex}"]`)?.closest(".day-list");
    const fromDay = fromDayList && fromDayList.dataset && fromDayList.dataset.day
        ? parseInt(fromDayList.dataset.day)
        : null;

    if (fromIndex === toIndex && fromDay === toDay) {
        placeholder.remove();
        placeholder = null;
        return;
    }

    reorderCart(fromIndex, toIndex, fromDay, toDay);
    placeholder.remove();
    placeholder = null;
}

// ========== MOBILE DRAG & DROP with LONG PRESS ==========

// Long press tetiklendiğinde gerçek sürüklemeyi başlat
function activateMobileDrag(item) {
    longPressTriggered = true;
    draggedItem = item;

    // Görsel geri bildirim
    item.classList.add('dragging');
    item.style.transition = 'none';
    item.style.zIndex = '1000';
    item.style.position = 'relative';
    item.style.boxShadow = '0 10px 20px rgba(0,0,0,0.2)';
    item.style.opacity = '0.8';

    // Placeholder oluştur
    createPlaceholder(item);

    // Hafif titreşim (destekleniyorsa)
    if ('vibrate' in navigator) {
        navigator.vibrate(30);
    }
    document.body.classList.add('dragging-items');  // EKLE
}

function handleTouchStart(e) {
    if (e.touches.length !== 1) return;
    
    const item = e.target.closest('.travel-item');
    if (!item) return;

    // Başlangıç değerlerini kaydet
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;

    // Long press kurulumu
    longPressTriggered = false;
    touchTargetItem = item;

    // Long-press zamanlayıcısı: Süre dolunca gerçek drag’i başlat
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
        if (touchTargetItem) {
            activateMobileDrag(touchTargetItem);
        }
    }, LONG_PRESS_MS);

    // ÖNEMLİ: Burada preventDefault çağırmıyoruz; böylece kullanıcı kaydırmaya devam edebilir.
}

function handleTouchMove(e) {
    // Long press daha tetiklenmediyse ve hareket eşik üstüyse iptal et (scroll'a izin ver)
    if (!longPressTriggered) {
        if (!touchTargetItem || e.touches.length !== 1) return;
        const t = e.touches[0];
        const dx = Math.abs(t.clientX - touchStartX);
        const dy = Math.abs(t.clientY - touchStartY);
        if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) {
            // Kullanıcı kaydırıyor, long press iptal
            clearTimeout(longPressTimer);
            longPressTimer = null;
            touchTargetItem = null;
        }
        // Not: preventDefault yok -> sayfa kayar
        return;
    }

    // Drag aktifse, mevcut sürükleme davranışı
    if (!draggedItem || e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    const x = touch.clientX - touchStartX;
    const y = touch.clientY - touchStartY;
    
    draggedItem.style.transform = `translate(${x}px, ${y}px)`;
    
    const elements = document.elementsFromPoint(touch.clientX, touch.clientY);
    const dropZone = elements.find(el => el.classList && el.classList.contains('day-list'));
    
    if (dropZone) {
        if (currentDropZone && currentDropZone !== dropZone) {
            currentDropZone.classList.remove('drop-hover');
        }
        currentDropZone = dropZone;
        currentDropZone.classList.add('drop-hover');
        
        const items = Array.from(dropZone.querySelectorAll('.travel-item:not(.dragging)'));
        let closestItem = null;
        let closestDistance = Infinity;
        
        items.forEach(item => {
            const rect = item.getBoundingClientRect();
            const distance = Math.abs(touch.clientY - (rect.top + rect.height/2));
            if (distance < closestDistance) {
                closestDistance = distance;
                closestItem = item;
            }
        });
        
        if (closestItem) {
            if (touch.clientY < closestItem.getBoundingClientRect().top + closestItem.offsetHeight/2) {
                dropZone.insertBefore(placeholder, closestItem);
            } else {
                dropZone.insertBefore(placeholder, closestItem.nextSibling);
            }
        } else {
            dropZone.appendChild(placeholder);
        }
    } else if (currentDropZone) {
        currentDropZone.classList.remove('drop-hover');
        currentDropZone = null;
    }

    // Drag sırasında kaydırmayı engelle
    e.preventDefault();
}

function handleTouchMoveOver(e) {
    if (!longPressTriggered || !draggedItem) return;
    e.preventDefault();
}

function handleTouchDrop(e) {
    // Sadece gerçekten drag başlamışsa bırakma işlemi yap
    if (!longPressTriggered || !draggedItem || !currentDropZone) {
        cleanupTouchDrag();
        return;
    }
    
    const fromIndex = parseInt(draggedItem.dataset.index);
    const fromDayList = draggedItem.closest('.day-list');
    const fromDay = fromDayList ? parseInt(fromDayList.dataset.day) : null;
    const toDay = parseInt(currentDropZone.dataset.day);
    
    const items = Array.from(currentDropZone.querySelectorAll('.travel-item:not(.dragging)'));
    const touch = e.changedTouches[0];
    let toIndex = items.length;
    for (let i = 0; i < items.length; i++) {
        const rect = items[i].getBoundingClientRect();
        if (touch.clientY < rect.top + rect.height / 2) {
            toIndex = i;
            break;
        }
    }
    
    reorderCart(fromIndex, toIndex, fromDay, toDay);
    cleanupTouchDrag();
}

function handleTouchEnd(e) {
    // Long press süresi dolmadan bırakıldıysa: sadece zamanlayıcıyı iptal et, hiçbir şey yapma
    if (!longPressTriggered) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
        touchTargetItem = null;
        return;
    }

    // Drag aktifti ama hedef bölge yoksa: yerine geri koy ve temizle
    if (draggedItem && !currentDropZone) {
        draggedItem.style.transition = 'transform 0.3s ease';
        draggedItem.style.transform = 'translate(0, 0)';
        setTimeout(() => {
            cleanupTouchDrag();
        }, 300);
    }
}

function handleTouchCancel() {
    cleanupTouchDrag();
}

function cleanupTouchDrag() {
    clearTimeout(longPressTimer);
    longPressTimer = null;
    longPressTriggered = false;
    touchTargetItem = null;

    if (draggedItem) {
        draggedItem.classList.remove('dragging');
        draggedItem.style.transition = '';
        draggedItem.style.transform = '';
        draggedItem.style.zIndex = '';
        draggedItem.style.position = '';
        draggedItem.style.boxShadow = '';
        draggedItem.style.opacity = '';
        draggedItem = null;
    }
    
    if (currentDropZone) {
        currentDropZone.classList.remove('drop-hover');
        currentDropZone = null;
    }
    
    if (placeholder) {
        placeholder.remove();
        placeholder = null;
    }
    document.body.classList.remove('dragging-items');  // EKLE
}

// ========== CART REORDERING ==========
function dayRouteIsValid(day) {
    const routeItems = window.cart
        .filter(i => Number(i.day) === Number(day) && i.location && typeof i.location.lat === "number" && typeof i.location.lng === "number")
        .map(i => i.location);
    let totalKm = 0;
    for (let i = 1; i < routeItems.length; i++) {
        totalKm += haversine(routeItems[i - 1].lat, routeItems[i - 1].lng, routeItems[i].lat, routeItems[i].lng) / 1000;
    }
    return totalKm <= 300;
}

// --- REORDER PATCH ---
// Bu fonksiyonu doğrudan değiştir!
function reorderCart(fromIndex, toIndex, fromDay, toDay) {
    try {
        if (fromIndex < 0 || fromIndex >= window.cart.length) {
            throw new Error("Invalid fromIndex");
        }

        // Geri alma için window.cart'ın eski halini sakla:
        const prevCart = window.cart.map(item => ({ ...item }));

        const item = window.cart.splice(fromIndex, 1)[0];
        item.day = toDay;

        if (fromDay === toDay) {
            let dayItems = window.cart.filter(i => i.day === toDay);
            dayItems.splice(toIndex, 0, item);
            window.cart = window.cart.filter(i => i.day !== toDay).concat(dayItems);
        } else {
            let insertAt = window.cart.findIndex(it => it.day === toDay);
            if (insertAt === -1) insertAt = window.cart.length;

            let seen = 0;
            for (let i = 0; i < window.cart.length; ++i) {
                if (window.cart[i].day === toDay) {
                    if (seen === toIndex) {
                        insertAt = i;
                        break;
                    }
                    seen++;
                }
            }
            window.cart.splice(insertAt, 0, item);
        }

        // --- 300 KM limit patch ---
        // Sıra değişince ilgili günler için km limitini kontrol et
        const affectedDays = new Set([fromDay, toDay].map(Number));
        let errorKm = false;
        for (const day of affectedDays) {
            if (!dayRouteIsValid(day)) {
                errorKm = true;
                break;
            }
        }
        if (errorKm) {
            // Geri al: window.cart'ı eski haline döndür
            window.cart = prevCart.map(item => ({ ...item }));
            window.showToast?.('Max route length for this day is 300 km.', 'error');
            updateCart();
            attachChatDropListeners();
            return;
        }

        if (window.expandedMaps) {
            clearRouteSegmentHighlight(fromDay);
            clearRouteSegmentHighlight(toDay);
            window._lastSegmentDay = undefined;
            window._lastSegmentStartKm = undefined;
            window._lastSegmentEndKm = undefined;
        }

        updateCart();
        attachChatDropListeners();
        if (typeof saveCurrentTripToStorage === "function") saveCurrentTripToStorage();

    } catch (error) {
        console.error("Reorder error:", error);
        showWarning && showWarning("Reorder error. Please try again.");
    }
}

function attachDragListeners() {
    document.querySelectorAll('.travel-item').forEach(item => {
        item.removeEventListener('dragstart', dragStart);
        item.removeEventListener('dragend', dragEnd);
    });

    document.querySelectorAll('.day-list').forEach(list => {
        list.removeEventListener('dragover', allowDrop);
        list.removeEventListener('drop', drop);
    });

    document.querySelectorAll('.travel-item').forEach(item => {
        item.setAttribute('draggable', true);
        item.addEventListener('dragstart', dragStart);
        item.addEventListener('dragend', dragEnd);
    });

    document.querySelectorAll('.day-list').forEach(list => {
        list.addEventListener('dragover', allowDrop);
        list.addEventListener('drop', drop);
    });
}

function attachChatDropListeners() {
    document.querySelectorAll('.day-list').forEach(list => {

     
   
    });

    document.querySelectorAll('.day-list').forEach(list => {
   
      
       
    });
}

function handleStepDragStart(e) {
    const stepsDiv = e.currentTarget;
    const data = {
        name: stepsDiv.querySelector('.title')?.textContent?.trim() || '',
        image: stepsDiv.querySelector('img.check')?.src || '',
        category: stepsDiv.getAttribute('data-category') || '',
        address: stepsDiv.querySelector('.address')?.textContent.replace(/^[^:]*:\s*/, '').trim() || '',
        opening_hours: stepsDiv.querySelector('.opening_hours')?.textContent.replace(/^[^:]*:\s*/, '').trim() || '',
        lat: stepsDiv.getAttribute('data-lat'),
        lon: stepsDiv.getAttribute('data-lon'),
        website: (stepsDiv.querySelector('[onclick*="openWebsite"]')?.getAttribute('onclick')?.match(/'([^']+)'/) || [])[1] || ''
    };

    if (data.lat && data.lon) {
        data.lat = Number(data.lat);
        data.lon = Number(data.lon);
    }

    e.dataTransfer.setData('application/json', JSON.stringify(data));
    e.dataTransfer.setData('text/plain', 'chat');
    e.dataTransfer.setData('source', 'chat');
    e.dataTransfer.effectAllowed = 'copyMove';
    stepsDiv.classList.add('dragging');
}

// ========== EVENT LISTENERS ==========
document.addEventListener('DOMContentLoaded', function() {
    initDragDropSystem();
});

document.addEventListener('dragend', function(e) {
    document.querySelectorAll('.steps.dragging').forEach(el => el.classList.remove('dragging'));
});