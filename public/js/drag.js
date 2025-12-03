// ========== GLOBAL ==========
if (!window.cart || !Array.isArray(window.cart)) window.cart = [];

let placeholder = null;
let isMobile = false;
let draggedItem = null;
let dragClone = null; // Mobilde sürüklenen hayalet kopya

// Koordinat ve Offsetlar
let touchStartX = 0;
let touchStartY = 0;
let touchOffsetX = 0; // Dokunulan noktanın öğe sol üst köşesine uzaklığı
let touchOffsetY = 0;

// Long-press state
let longPressTimer = null;
let longPressTriggered = false;
const LONG_PRESS_MS = 300; // Trello hissi için biraz kısalttık
const MOVE_CANCEL_PX = 10; // Bu kadar piksel oynarsa long-press iptal (scroll sayılır)

// Auto-Scroll değişkenleri
let autoScrollInterval = null;
const SCROLL_ZONE_SIZE = 60; // Ekranın alt/üstünden kaç pikselde scroll başlasın
const SCROLL_SPEED = 12; // Kaydırma hızı

function dayRouteIsValidStrict(day) {
    const routeItems = window.cart
        .filter(i => Number(i.day) === Number(day) && i.location && typeof i.location.lat === "number" && typeof i.location.lng === "number")
        .map(i => i.location);

    if (routeItems.length < 2) return true;

    const isTurkey = routeItems.every(pt =>
        pt.lat >= 35.81 && pt.lat <= 42.11 &&
        pt.lng >= 25.87 && pt.lng <= 44.57
    );

    let haversineKm = 0;
    for (let i = 1; i < routeItems.length; i++) {
        haversineKm += haversine(routeItems[i - 1].lat, routeItems[i - 1].lng, routeItems[i].lat, routeItems[i].lng) / 1000;
    }

    if (isTurkey) {
        const key = `route-map-day${day}`;
        if (window.lastRouteSummaries && window.lastRouteSummaries[key] && typeof window.lastRouteSummaries[key].distance === "number") {
            const routeKm = window.lastRouteSummaries[key].distance / 1000;
            return routeKm <= 300;
        }
        return haversineKm <= 300;
    }
    return haversineKm <= 300;
}

// ========== DEVICE DETECTION ==========
function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// ========== INITIALIZATION ==========
function initDragDropSystem() {
    isMobile = isTouchDevice();
    
    // Her durumda eventleri temizleyip yeniden bağla
    cleanupDragEvents();
    
    if (isMobile) {
        initTouchDragDrop();
    } else {
        setupDesktopDragDrop();
    }
    
    setupDropZones();
}

function cleanupDragEvents() {
    document.querySelectorAll('.travel-item').forEach(item => {
        item.removeEventListener('touchstart', handleTouchStart);
        item.removeEventListener('touchmove', handleTouchMove);
        item.removeEventListener('touchend', handleTouchEnd);
        item.removeEventListener('touchcancel', handleTouchCancel);
        item.removeEventListener('dragstart', desktopDragStart);
        item.removeEventListener('dragend', desktopDragEnd);
        item.removeAttribute('draggable');
    });
}

// ========== MOBILE (TOUCH) DRAG & DROP ==========
function initTouchDragDrop() {
    document.querySelectorAll('.travel-item').forEach(item => {
        // Pasif: false önemli, preventDefault çalışması için
        item.addEventListener('touchstart', handleTouchStart, { passive: false });
        item.addEventListener('touchmove', handleTouchMove, { passive: false });
        item.addEventListener('touchend', handleTouchEnd);
        item.addEventListener('touchcancel', handleTouchCancel);
    });
}

function handleTouchStart(e) {
    // Sadece tek parmak
    if (e.touches.length !== 1) return;
    
    const item = e.target.closest('.travel-item');
    // Eğer butonlara veya linklere basıldıysa drag başlatma
    if (!item || e.target.closest('button') || e.target.closest('a')) return;

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;

    // Öğenin içindeki dokunma noktasını hesapla (Offset)
    const rect = item.getBoundingClientRect();
    touchOffsetX = touchStartX - rect.left;
    touchOffsetY = touchStartY - rect.top;

    longPressTriggered = false;
    draggedItem = item;

    // Timer başlat
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
        startMobileDrag(e.touches[0]);
    }, LONG_PRESS_MS);
}

function startMobileDrag(touch) {
    if (!draggedItem) return;
    longPressTriggered = true;

    // 1. Placeholder oluştur (Listenin kaymasını önler)
    createPlaceholder(draggedItem);
    
    // 2. Clone (Hayalet) oluştur - Trello stili
    const rect = draggedItem.getBoundingClientRect();
    dragClone = draggedItem.cloneNode(true);
    
    // Clone stilleri
    dragClone.style.position = 'fixed';
    dragClone.style.width = `${rect.width}px`;
    dragClone.style.height = `${rect.height}px`;
    dragClone.style.left = `${rect.left}px`;
    dragClone.style.top = `${rect.top}px`;
    dragClone.style.zIndex = '9999';
    dragClone.style.opacity = '0.9';
    dragClone.style.pointerEvents = 'none'; // Dokunmayı engellemesin, altını görelim
    dragClone.style.boxShadow = '0 15px 30px rgba(0,0,0,0.3)';
    dragClone.style.transform = 'scale(1.02)'; // Hafif büyüt
    dragClone.classList.add('dragging-clone');
    
    document.body.appendChild(dragClone);

    // 3. Orijinal öğeyi gizle (ama yer kaplamaya devam etsin diye placeholder var)
    draggedItem.style.opacity = '0';
    draggedItem.classList.add('dragging-original');

    // Titreşim
    if (navigator.vibrate) navigator.vibrate(30);
    document.body.classList.add('dragging-active');
}

function handleTouchMove(e) {
    if (!draggedItem) return;

    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartX);
    const dy = Math.abs(touch.clientY - touchStartY);

    // Henüz drag başlamadıysa (Long press bekleniyor)
    if (!longPressTriggered) {
        // Eğer parmak çok oynadıysa (scroll yapıyor olabilir), drag iptal
        if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) {
            clearTimeout(longPressTimer);
            draggedItem = null;
        }
        return; // Scroll'a izin ver
    }

    // --- DRAG BAŞLADIYSA ---
    e.preventDefault(); // Sayfa scrollunu engelle (Biz yöneteceğiz)

    // 1. Clone'u taşı (Parmağın olduğu yere, offseti koruyarak)
    if (dragClone) {
        const x = touch.clientX - touchOffsetX;
        const y = touch.clientY - touchOffsetY;
        dragClone.style.left = `${x}px`;
        dragClone.style.top = `${y}px`;
    }

    // 2. Auto-Scroll Kontrolü
    handleAutoScroll(touch.clientY);

    // 3. Altındaki öğeyi bul ve yer değiştir
    // pointerEvents='none' olduğu için clone'un altındaki elemanı bulabiliriz
    const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);
    const dropTarget = elementUnder ? elementUnder.closest('.travel-item') : null;
    const dropList = elementUnder ? elementUnder.closest('.day-list') : null;

    if (dropList) {
        if (dropTarget && dropTarget !== draggedItem && dropTarget !== placeholder) {
            // Hedefin üst yarısında mı alt yarısında mı?
            const targetRect = dropTarget.getBoundingClientRect();
            const offset = touch.clientY - targetRect.top;
            
            if (offset < targetRect.height / 2) {
                dropList.insertBefore(placeholder, dropTarget);
            } else {
                dropList.insertBefore(placeholder, dropTarget.nextSibling);
            }
        } else if (!dropTarget) {
            // Liste boşsa veya boşluğa gelindiyse sona ekle
            dropList.appendChild(placeholder);
        }
    }
}

function handleAutoScroll(clientY) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;

    const viewportHeight = window.innerHeight;
    
    // Aşağı kaydır
    if (viewportHeight - clientY < SCROLL_ZONE_SIZE) {
        autoScrollInterval = setInterval(() => {
            window.scrollBy(0, SCROLL_SPEED);
        }, 16);
    } 
    // Yukarı kaydır
    else if (clientY < SCROLL_ZONE_SIZE) {
        autoScrollInterval = setInterval(() => {
            window.scrollBy(0, -SCROLL_SPEED);
        }, 16);
    }
}

function handleTouchEnd(e) {
    clearTimeout(longPressTimer);
    clearInterval(autoScrollInterval);

    if (!longPressTriggered) {
        draggedItem = null;
        return;
    }

    finalizeDrag();
}

function handleTouchCancel() {
    clearTimeout(longPressTimer);
    clearInterval(autoScrollInterval);
    if (longPressTriggered) {
        // İptal durumunda eski yerine döndür
        if (placeholder && placeholder.parentNode) {
            placeholder.parentNode.removeChild(placeholder);
        }
        if (draggedItem) {
            draggedItem.style.opacity = '';
            draggedItem.classList.remove('dragging-original');
        }
        if (dragClone) dragClone.remove();
        placeholder = null;
        draggedItem = null;
        dragClone = null;
        document.body.classList.remove('dragging-active');
    }
}

// ========== DESKTOP DRAG & DROP ==========
function setupDesktopDragDrop() {
    document.querySelectorAll('.travel-item').forEach(item => {
        item.setAttribute('draggable', true);
        item.addEventListener('dragstart', desktopDragStart);
        item.addEventListener('dragend', desktopDragEnd);
    });
}

function desktopDragStart(event) {
    const item = event.target.closest('.travel-item');
    if (!item) return;
    
    draggedItem = item;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", item.dataset.index); // Firefox gereksinimi
    
    // Placeholder hemen oluştur
    setTimeout(() => {
        item.classList.add('dragging-original');
        createPlaceholder(item);
    }, 0);
}

function desktopDragEnd(event) {
    finalizeDrag();
}

// ========== SHARED LOGIC ==========

function setupDropZones() {
    document.querySelectorAll('.day-list').forEach(list => {
        // Desktop events
        list.addEventListener('dragover', (e) => {
            e.preventDefault(); // Drop'a izin ver
            
            if (!placeholder) return;
            
            const target = e.target.closest('.travel-item');
            if (target && target !== draggedItem) {
                const rect = target.getBoundingClientRect();
                const offset = e.clientY - rect.top;
                if (offset < rect.height / 2) {
                    list.insertBefore(placeholder, target);
                } else {
                    list.insertBefore(placeholder, target.nextSibling);
                }
            } else if (!target && e.target === list) {
                list.appendChild(placeholder);
            }
        });
        
        list.addEventListener('drop', (e) => {
            e.preventDefault();
            // Logic handled in dragEnd/finalize
        });
    });
}

function createPlaceholder(item) {
    if (!placeholder) {
        placeholder = document.createElement('li');
        placeholder.className = 'travel-item placeholder-item';
        // Trello benzeri hafif gri alan
        placeholder.style.height = `${item.offsetHeight}px`;
        placeholder.style.backgroundColor = 'rgba(0,0,0,0.05)';
        placeholder.style.border = '2px dashed rgba(0,0,0,0.1)';
        placeholder.style.borderRadius = '8px';
        placeholder.style.margin = '5px 0';
    }
    // Mevcut öğenin hemen arkasına veya yerine koy
    if (item.parentNode) {
        item.parentNode.insertBefore(placeholder, item.nextSibling);
    }
}

function finalizeDrag() {
    if (!draggedItem || !placeholder || !placeholder.parentNode) {
        // Hata veya iptal durumu temizliği
        if (draggedItem) {
            draggedItem.style.opacity = '';
            draggedItem.classList.remove('dragging-original');
        }
        if (dragClone) dragClone.remove();
        if (placeholder) placeholder.remove();
        draggedItem = null;
        dragClone = null;
        placeholder = null;
        document.body.classList.remove('dragging-active');
        return;
    }

    // 1. DOM'da öğeyi placeholder'ın yerine taşı
    const newParent = placeholder.parentNode;
    newParent.insertBefore(draggedItem, placeholder);
    
    // 2. Görsel temizlik
    placeholder.remove();
    if (dragClone) dragClone.remove();
    draggedItem.style.opacity = '';
    draggedItem.classList.remove('dragging-original');
    document.body.classList.remove('dragging-active');

    // 3. Veri Güncellemesi (Window.cart)
    updateCartOrderFromDOM();

    // Reset
    placeholder = null;
    draggedItem = null;
    dragClone = null;
}

function updateCartOrderFromDOM() {
    // Tüm günleri gez ve DOM sırasına göre cart'ı yeniden oluştur
    const newCart = [];
    
    document.querySelectorAll('.day-container').forEach(dayContainer => {
        const day = parseInt(dayContainer.dataset.day);
        
        // Bu günün öğelerini DOM sırasıyla al
        const items = dayContainer.querySelectorAll('.travel-item');
        items.forEach(item => {
            const oldIndex = parseInt(item.dataset.index);
            const cartItem = window.cart[oldIndex];
            
            if (cartItem) {
                // Gün değiştiyse güncelle
                if (cartItem.day !== day) {
                    cartItem.day = day;
                }
                newCart.push(cartItem);
            }
        });
    });

    // Cart'ı güncelle
    window.cart = newCart;

    // UI ve Rota güncelle
    if (typeof updateCart === 'function') updateCart();
    if (typeof attachChatDropListeners === 'function') attachChatDropListeners();
    if (typeof saveCurrentTripToStorage === 'function') saveCurrentTripToStorage();
    
    // Rota çizimi güncelle
    const affectedDays = [...new Set(window.cart.map(i => i.day))];
    if (typeof renderRouteForDay === 'function') {
        affectedDays.forEach(d => renderRouteForDay(d));
    }
}

// ========== REORDER HELPER (Eski kod uyumluluğu için) ==========
function reorderCart(fromIndex, toIndex, fromDay, toDay) {
    // Bu fonksiyonu manuel çağırmıyoruz artık, DOM okuyarak yapıyoruz.
    // Ancak dışarıdan çağrılırsa diye bırakıldı.
    console.warn("reorderCart deprecated in favor of DOM-based reorder");
}

// Başlangıç
document.addEventListener('DOMContentLoaded', initDragDropSystem);