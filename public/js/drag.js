// ========== DRAG.JS - TRELLO STİLİ MOBİL & MOR ÇİZGİ ==========

if (!window.cart || !Array.isArray(window.cart)) window.cart = [];

// Durum Değişkenleri
let draggedItem = null;
let clone = null;
let placeholder = null;
let isDragging = false;

// Koordinatlar
let touchStartX = 0;
let touchStartY = 0;
let touchOffsetX = 0;
let touchOffsetY = 0;

// Zamanlayıcılar (Mobil Long Press için)
let longPressTimer = null;
let autoScrollInterval = null;

const LONG_PRESS_DURATION = 250; // Mobilde basılı tutma süresi (ms)
const SCROLL_ZONE = 80;          // Ekran kenarlarına yaklaşınca kaydırma alanı
const SCROLL_SPEED = 15;

// 1. Gerekli CSS'i JS ile ekliyoruz (Senin CSS dosyana dokunmadan)
(function injectDragStyles() {
    if (document.getElementById('tt-drag-logic-style')) return;
    const style = document.createElement('style');
    style.id = 'tt-drag-logic-style';
    style.innerHTML = `
        /* Sürüklenen kopya (Hayalet) */
        .drag-clone {
            position: fixed; z-index: 99999; pointer-events: none;
            opacity: 0.95; box-shadow: 0 15px 30px rgba(0,0,0,0.3);
            transform: scale(1.02) rotate(1deg); transition: none;
            background: #fff; list-style: none; border-radius: 8px;
        }
        /* Orijinal öğe sürüklenirken gizlenir */
        .travel-item.is-dragging { opacity: 0.0; }
        
        /* --- İSTEDİĞİN MOR ÇİZGİ TASARIMI --- */
        .drag-placeholder {
            height: 4px !important;
            background: #8a4af3 !important; /* Mor Renk */
            border-radius: 2px;
            margin: 6px 0;
            box-shadow: 0 0 8px rgba(138, 74, 243, 0.5);
            list-style: none;
        }
        
        /* Drag sırasında sayfa kaymasını engelle */
        body.dragging-active { user-select: none; touch-action: none; }
    `;
    document.head.appendChild(style);
})();

// 2. Global Event Dinleyicileri (Otomatik Başlar)
document.addEventListener('touchstart', onTouchStart, { passive: false });
document.addEventListener('touchmove', onTouchMove, { passive: false });
document.addEventListener('touchend', onTouchEnd);
document.addEventListener('touchcancel', onTouchEnd);

document.addEventListener('mousedown', onMouseDown);
document.addEventListener('mousemove', onMouseMove);
document.addEventListener('mouseup', onMouseUp);

// --- DOKUNMATİK (MOBİL) MANTIĞI ---
function onTouchStart(e) {
    if (e.touches.length !== 1) return;
    const target = e.target.closest('.travel-item');
    // Butonlara basıldıysa drag başlatma
    if (!target || e.target.closest('button') || e.target.closest('a') || e.target.closest('.action-menu')) return;

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    const rect = target.getBoundingClientRect();
    touchOffsetX = touchStartX - rect.left;
    touchOffsetY = touchStartY - rect.top;

    draggedItem = target;

    // Trello Mantığı: Basılı tutunca drag başlar
    longPressTimer = setTimeout(() => {
        startDrag(target, touchStartX, touchStartY);
    }, LONG_PRESS_DURATION);
}

function onTouchMove(e) {
    if (!isDragging) {
        if (draggedItem) {
            const dx = Math.abs(e.touches[0].clientX - touchStartX);
            const dy = Math.abs(e.touches[0].clientY - touchStartY);
            // Parmak 10px'den fazla oynarsa drag iptal, scroll yapıyordur
            if (dx > 10 || dy > 10) {
                clearTimeout(longPressTimer);
                draggedItem = null;
            }
        }
        return; // Sayfa scrolluna izin ver
    }

    // Drag başladıysa sayfa scrollunu engelle ve manuel yönet
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

// --- MOUSE (DESKTOP) MANTIĞI ---
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
        // Fare biraz hareket edince başlat
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

// --- ORTAK FONKSİYONLAR ---
function startDrag(item, x, y) {
    isDragging = true;
    document.body.classList.add('dragging-active');
    if (navigator.vibrate) navigator.vibrate(40);

    // Placeholder (Mor Çizgi)
    placeholder = document.createElement('li');
    placeholder.className = 'drag-placeholder'; // CSS yukarıda tanımlı
    item.parentNode.insertBefore(placeholder, item);

    // Clone (Hayalet)
    clone = item.cloneNode(true);
    clone.classList.add('drag-clone');
    clone.style.width = `${item.offsetWidth}px`;
    clone.style.height = `${item.offsetHeight}px`;
    document.body.appendChild(clone);

    item.classList.add('is-dragging'); // Orijinali gizle
    updateDragPosition(x, y);
}

function updateDragPosition(x, y) {
    if (clone) {
        clone.style.left = `${x - touchOffsetX}px`;
        clone.style.top = `${y - touchOffsetY}px`;
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
        if (targetItem && targetItem !== draggedItem && targetItem !== placeholder) {
            const rect = targetItem.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            
            // Mor çizgiyi araya sok
            if (y < midpoint) {
                targetList.insertBefore(placeholder, targetItem);
            } else {
                targetList.insertBefore(placeholder, targetItem.nextSibling);
            }
        } 
        else if (!targetItem && targetList.children.length === 0) {
            targetList.appendChild(placeholder);
        } 
        else if (!targetItem) {
            targetList.appendChild(placeholder); // Listenin sonuna
        }
    }
}

function handleAutoScroll(y) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
    const h = window.innerHeight;
    let amount = 0;
    if (y < SCROLL_ZONE) amount = -SCROLL_SPEED;
    else if (y > h - SCROLL_ZONE) amount = SCROLL_SPEED;

    if (amount !== 0) {
        autoScrollInterval = setInterval(() => window.scrollBy(0, amount), 16);
    }
}

function finishDrag() {
    if (placeholder && draggedItem) {
        placeholder.parentNode.insertBefore(draggedItem, placeholder);
        updateCartOrderData(); // Veriyi güncelle
    }
}

function resetState() {
    isDragging = false;
    draggedItem = null;
    if (clone) clone.remove();
    if (placeholder) placeholder.remove();
    clone = null; placeholder = null;
    clearInterval(autoScrollInterval);
    clearTimeout(longPressTimer);
    document.body.classList.remove('dragging-active');
    document.querySelectorAll('.is-dragging').forEach(el => el.classList.remove('is-dragging'));
}

// Data Güncelleme (updateCart'ı tetikler)
function updateCartOrderData() {
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