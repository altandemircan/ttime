// ========== DRAG.JS - MOR ÇİZGİ & STABIL MOBİL VERSİYON ==========

if (!window.cart || !Array.isArray(window.cart)) window.cart = [];

// Durumlar
let draggedItem = null;
let clone = null;
let placeholder = null;
let isDragging = false;

// Koordinatlar
let touchStartX = 0;
let touchStartY = 0;
let touchOffsetX = 0;
let touchOffsetY = 0;

// Zamanlayıcılar
let longPressTimer = null;
let autoScrollInterval = null;

// Ayarlar
const LONG_PRESS_DURATION = 250; // Mobilde basılı tutma süresi (ms)
const SCROLL_ZONE_HEIGHT = 100;  // Auto-scroll bölgesi genişletildi
const SCROLL_SPEED = 20;         // Scroll hızı artırıldı

// 1. CSS'i Otomatik Ekle (MOR ÇİZGİ TASARIMI BURADA)
(function injectStyles() {
    if (document.getElementById('tt-drag-styles')) return;
    const style = document.createElement('style');
    style.id = 'tt-drag-styles';
    style.innerHTML = `
        /* Sürüklenen öğe (Clone) */
        .drag-clone {
            position: fixed; 
            z-index: 10000; 
            pointer-events: none; 
            opacity: 0.95;
            box-shadow: 0 15px 35px rgba(0,0,0,0.3); 
            transform: scale(1.02) rotate(1deg);
            transition: none; 
            background: #fff; 
            list-style: none;
            border-radius: 8px;
        }
        
        /* Orijinal öğe gizlenir */
        .travel-item.is-dragging { 
            opacity: 0.0; 
        }

        /* --- MOR KALIN ÇİZGİ PLACEHOLDER --- */
        .drag-placeholder {
            height: 4px; /* İnce çizgi yüksekliği */
            background: #8a4af3; /* Mor renk */
            border-radius: 4px;
            margin: 8px 0; /* Öğeler arası boşluk */
            box-shadow: 0 0 10px rgba(138, 74, 243, 0.6); /* Mor parıltı */
            pointer-events: none;
            flex-shrink: 0;
            list-style: none;
        }

        /* Sürükleme sırasında sayfa kontrolü */
        body.dragging-active { 
            user-select: none; 
            overflow: hidden; /* Sayfa scrollunu kilitle */
            touch-action: none;
        }
    `;
    document.head.appendChild(style);
})();

// 2. Global Event Listeners
document.addEventListener('touchstart', onTouchStart, { passive: false });
document.addEventListener('touchmove', onTouchMove, { passive: false });
document.addEventListener('touchend', onTouchEnd);
document.addEventListener('touchcancel', onTouchEnd);

document.addEventListener('mousedown', onMouseDown);
document.addEventListener('mousemove', onMouseMove);
document.addEventListener('mouseup', onMouseUp);

// --- TOUCH EVENTS (MOBİL) ---
function onTouchStart(e) {
    if (e.touches.length !== 1) return;
    const target = e.target.closest('.travel-item');
    if (!target || e.target.closest('button') || e.target.closest('a') || e.target.closest('.action-menu')) return;

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    const rect = target.getBoundingClientRect();
    touchOffsetX = touchStartX - rect.left;
    touchOffsetY = touchStartY - rect.top;

    draggedItem = target;
    
    // Basılı tutunca başlat
    longPressTimer = setTimeout(() => {
        startDrag(target, touchStartX, touchStartY);
    }, LONG_PRESS_DURATION);
}

function onTouchMove(e) {
    if (!isDragging) {
        if (draggedItem) {
            const dx = Math.abs(e.touches[0].clientX - touchStartX);
            const dy = Math.abs(e.touches[0].clientY - touchStartY);
            // Parmak oynarsa iptal et (Scroll yapıyor olabilir)
            if (dx > 10 || dy > 10) {
                clearTimeout(longPressTimer);
                draggedItem = null;
            }
        }
        return; // Normal scrolla izin ver
    }

    // Drag başladıysa
    if (e.cancelable) e.preventDefault();
    const touch = e.touches[0];
    updateDragPosition(touch.clientX, touch.clientY);
    handleAutoScroll(touch.clientY);
    checkDropZone(touch.clientX, touch.clientY);
}

function onTouchEnd() {
    clearTimeout(longPressTimer);
    if (isDragging) finishDrag();
    resetState();
}

// --- MOUSE EVENTS (DESKTOP) ---
function onMouseDown(e) {
    if (e.button !== 0) return;
    const target = e.target.closest('.travel-item');
    if (!target || e.target.closest('button') || e.target.closest('a')) return;

    touchStartX = e.clientX;
    touchStartY = e.clientY;
    const rect = target.getBoundingClientRect();
    touchOffsetX = touchStartX - rect.left;
    touchOffsetY = touchStartY - rect.top;

    draggedItem = target;
}

function onMouseMove(e) {
    if (!draggedItem) return;
    
    if (!isDragging) {
        if (Math.abs(e.clientX - touchStartX) > 5 || Math.abs(e.clientY - touchStartY) > 5) {
            startDrag(draggedItem, e.clientX, e.clientY);
        }
        return;
    }

    e.preventDefault();
    updateDragPosition(e.clientX, e.clientY);
    handleAutoScroll(e.clientY);
    checkDropZone(e.clientX, e.clientY);
}

function onMouseUp() {
    if (isDragging) finishDrag();
    resetState();
}

// --- CORE LOGIC ---
function startDrag(item, x, y) {
    isDragging = true;
    document.body.classList.add('dragging-active');
    if (navigator.vibrate) navigator.vibrate(40);

    // 1. Placeholder (Mor Çizgi) Oluştur
    placeholder = document.createElement('li');
    placeholder.className = 'drag-placeholder';
    // NOT: Yükseklik vermiyoruz, CSS'deki 4px'i kullanacak
    item.parentNode.insertBefore(placeholder, item);

    // 2. Clone (Hayalet) Oluştur
    clone = item.cloneNode(true);
    clone.classList.add('drag-clone');
    clone.style.width = `${item.offsetWidth}px`;
    clone.style.height = `${item.offsetHeight}px`;
    document.body.appendChild(clone);

    // 3. Orijinali gizle
    item.classList.add('is-dragging');
    updateDragPosition(x, y);
}

function updateDragPosition(x, y) {
    if (clone) {
        clone.style.left = `${x - touchOffsetX}px`;
        clone.style.top = `${y - touchOffsetY}px`;
    }
}

function handleAutoScroll(y) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
    const h = window.innerHeight;
    let scrollAmount = 0;

    if (y < SCROLL_ZONE_HEIGHT) scrollAmount = -SCROLL_SPEED;
    else if (y > h - SCROLL_ZONE_HEIGHT) scrollAmount = SCROLL_SPEED;

    if (scrollAmount !== 0) {
        autoScrollInterval = setInterval(() => window.scrollBy(0, scrollAmount), 16);
    }
}

function checkDropZone(x, y) {
    if(clone) clone.style.display = 'none';
    const elemBelow = document.elementFromPoint(x, y);
    if(clone) clone.style.display = 'block';
    
    if (!elemBelow) return;

    const targetItem = elemBelow.closest('.travel-item');
    const targetList = elemBelow.closest('.day-list');

    if (targetList) {
        // Liste üstünde hareket ediyoruz
        if (targetItem && targetItem !== draggedItem && targetItem !== placeholder) {
            const rect = targetItem.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            
            // Mor çizgiyi hedef öğenin üstüne veya altına taşı
            if (y < midpoint) {
                targetList.insertBefore(placeholder, targetItem);
            } else {
                targetList.insertBefore(placeholder, targetItem.nextSibling);
            }
        } 
        else if (!targetItem && targetList.children.length === 0) {
            // Boş listeye taşıma
            targetList.appendChild(placeholder);
        } 
        else if (!targetItem) {
            // Listenin en altına taşıma (boşluğa gelince)
            targetList.appendChild(placeholder);
        }
    }
}

function finishDrag() {
    if (placeholder && draggedItem) {
        placeholder.parentNode.insertBefore(draggedItem, placeholder);
        updateCartData();
    }
}

function resetState() {
    isDragging = false;
    draggedItem = null;
    if (clone) clone.remove();
    if (placeholder) placeholder.remove();
    clone = null; 
    placeholder = null;
    clearInterval(autoScrollInterval);
    clearTimeout(longPressTimer);
    document.body.classList.remove('dragging-active');
    document.querySelectorAll('.is-dragging').forEach(el => el.classList.remove('is-dragging'));
}

function updateCartData() {
    const newCart = [];
    document.querySelectorAll('.day-container').forEach(container => {
        const day = parseInt(container.dataset.day);
        container.querySelectorAll('.travel-item').forEach(item => {
            const oldIndex = parseInt(item.dataset.index);
            const cartItem = window.cart[oldIndex];
            if (cartItem) {
                cartItem.day = day;
                newCart.push(cartItem);
            }
        });
    });
    window.cart = newCart;
    if (typeof updateCart === 'function') updateCart();
}