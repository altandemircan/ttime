// ========== DRAG.JS - TRELLO STİLİ & MOR ÇİZGİ (STABIL) ==========

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
const SCROLL_ZONE_HEIGHT = 80;   
const SCROLL_SPEED = 15;         

// 1. CSS (Sadece sürükleme efekti için - Tasarıma dokunmaz)
(function injectDragStyles() {
    if (document.getElementById('tt-drag-logic-style')) return;
    const style = document.createElement('style');
    style.id = 'tt-drag-logic-style';
    style.innerHTML = `
        /* Sürüklenen kopya (Hayalet) */
        .drag-clone {
            position: fixed; 
            z-index: 99999; 
            pointer-events: none; 
            opacity: 0.95; 
            box-shadow: 0 15px 35px rgba(0,0,0,0.3); 
            transform: scale(1.02) rotate(1deg); 
            background: #fff; 
            list-style: none; 
            border-radius: 8px;
            width: var(--drag-width);
            height: var(--drag-height);
        }
        
        /* Orijinal öğe yerinde kalsın ama görünmesin */
        .travel-item.is-dragging { 
            opacity: 0.0 !important; 
        }
        
        /* --- MOR KALIN ÇİZGİ PLACEHOLDER --- */
        .drag-placeholder {
            height: 4px !important;
            background: #8a4af3 !important;
            border-radius: 2px;
            margin: 6px 0;
            box-shadow: 0 0 8px rgba(138, 74, 243, 0.5);
            list-style: none;
            display: block;
        }
        
        /* Drag sırasında sayfa kaymasını engelle */
        body.dragging-active { 
            user-select: none; 
            touch-action: none;
            -webkit-user-select: none;
            overflow: hidden;
        }
    `;
    document.head.appendChild(style);
})();

// 2. Global Event Dinleyicileri
document.addEventListener('touchstart', onTouchStart, { passive: false });
document.addEventListener('touchmove', onTouchMove, { passive: false });
document.addEventListener('touchend', onTouchEnd);
document.addEventListener('touchcancel', onTouchEnd);

document.addEventListener('mousedown', onMouseDown);
document.addEventListener('mousemove', onMouseMove);
document.addEventListener('mouseup', onMouseUp);

// --- MOBİL (TOUCH) MANTIĞI ---
function onTouchStart(e) {
    if (e.touches.length !== 1) return;
    const target = e.target.closest('.travel-item');
    // Butonlara/Linklere basıldıysa iptal
    if (!target || e.target.closest('button') || e.target.closest('a') || e.target.closest('.action-menu')) return;

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    
    const rect = target.getBoundingClientRect();
    touchOffsetX = touchStartX - rect.left;
    touchOffsetY = touchStartY - rect.top;

    draggedItem = target;

    // Trello usulü: Basılı tutunca drag başlar
    longPressTimer = setTimeout(() => {
        startDrag(target, touchStartX, touchStartY);
    }, LONG_PRESS_DURATION);
}

function onTouchMove(e) {
    const touch = e.touches[0];

    // Henüz drag başlamadıysa
    if (!isDragging) {
        if (draggedItem) {
            const dx = Math.abs(touch.clientX - touchStartX);
            const dy = Math.abs(touch.clientY - touchStartY);
            // Parmak oynarsa iptal et (Scroll yapıyor)
            if (dx > 10 || dy > 10) {
                clearTimeout(longPressTimer);
                draggedItem = null;
            }
        }
        return; // Normal scroll
    }

    // Drag başladıysa
    if (e.cancelable) e.preventDefault();
    updateDragPosition(touch.clientX, touch.clientY);
    handleAutoScroll(touch.clientY);
    checkDropZone(touch.clientX, touch.clientY);
}

function onTouchEnd() {
    clearTimeout(longPressTimer);
    if (isDragging) finishDrag();
    resetState();
}

// --- DESKTOP (MOUSE) MANTIĞI ---
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

// --- CORE MANTIK ---
function startDrag(item, x, y) {
    isDragging = true;
    document.body.classList.add('dragging-active');
    if (navigator.vibrate) navigator.vibrate(40);

    // Placeholder (Mor Çizgi)
    placeholder = document.createElement('li');
    placeholder.className = 'drag-placeholder';
    item.parentNode.insertBefore(placeholder, item);

    // Clone (Hayalet)
    const rect = item.getBoundingClientRect();
    clone = item.cloneNode(true);
    clone.classList.add('drag-clone');
    clone.style.setProperty('--drag-width', `${rect.width}px`);
    clone.style.setProperty('--drag-height', `${rect.height}px`);
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    
    document.body.appendChild(clone);

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
    let amount = 0;
    if (y < SCROLL_ZONE_HEIGHT) amount = -SCROLL_SPEED;
    else if (y > h - SCROLL_ZONE_HEIGHT) amount = SCROLL_SPEED;

    if (amount !== 0) {
        autoScrollInterval = setInterval(() => window.scrollBy(0, amount), 16);
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
            
            if (y < midpoint) targetList.insertBefore(placeholder, targetItem);
            else targetList.insertBefore(placeholder, targetItem.nextSibling);
        } 
        else if (!targetItem && targetList.children.length === 0) {
            targetList.appendChild(placeholder);
        } 
        else if (!targetItem) {
            targetList.appendChild(placeholder);
        }
    }
}

function finishDrag() {
    if (placeholder && draggedItem) {
        placeholder.parentNode.insertBefore(draggedItem, placeholder);
        // Veriyi güncelle
        updateCartOrderData();
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