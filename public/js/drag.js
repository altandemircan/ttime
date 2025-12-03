// ========== DRAG.JS - AKILLI GRUPLAMA (ITEM + MESAFE) ==========

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
const LONG_PRESS_DURATION = 250; 
const SCROLL_ZONE_HEIGHT = 80;   
const SCROLL_SPEED = 15;         

// 1. CSS Enjeksiyonu
(function injectDragStyles() {
    if (document.getElementById('tt-drag-logic-style')) return;
    const style = document.createElement('style');
    style.id = 'tt-drag-logic-style';
    style.innerHTML = `
        /* Sürüklenen kopya (Hayalet) */
        .drag-clone {
            position: fixed; z-index: 99999; pointer-events: none;
            opacity: 0.95; box-shadow: 0 15px 35px rgba(0,0,0,0.3);
            transform: scale(1.02) rotate(1deg); 
            background: #fff; list-style: none; border-radius: 8px;
            width: var(--drag-width);
            height: var(--drag-height);
        }
        
        /* Orijinal öğe yerinde kalsın ama görünmesin */
        .travel-item.is-dragging { opacity: 0.0 !important; }
        
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
        
        body.dragging-active { 
            user-select: none; touch-action: none; -webkit-user-select: none; overflow: hidden;
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
    if (!target || e.target.closest('button') || e.target.closest('a') || e.target.closest('.action-menu')) return;

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    const rect = target.getBoundingClientRect();
    touchOffsetX = touchStartX - rect.left;
    touchOffsetY = touchStartY - rect.top;

    draggedItem = target;

    longPressTimer = setTimeout(() => {
        startDrag(target, touchStartX, touchStartY);
    }, LONG_PRESS_DURATION);
}

function onTouchMove(e) {
    if (!isDragging) {
        if (draggedItem) {
            const dx = Math.abs(e.touches[0].clientX - touchStartX);
            const dy = Math.abs(e.touches[0].clientY - touchStartY);
            if (dx > 10 || dy > 10) {
                clearTimeout(longPressTimer);
                draggedItem = null;
            }
        }
        return; 
    }
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

    placeholder = document.createElement('li');
    placeholder.className = 'drag-placeholder';
    
    // Başlangıçta hemen arkasına koy (varsa separatörü de atla)
    let insertPoint = item.nextSibling;
    if (insertPoint && insertPoint.classList && insertPoint.classList.contains('distance-separator')) {
        insertPoint = insertPoint.nextSibling;
    }
    item.parentNode.insertBefore(placeholder, insertPoint);

    // Clone
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

// --- KRİTİK DÜZELTME: SEPARATOR ATLAYARAK HEDEF BELİRLEME ---
function checkDropZone(x, y) {
    if(clone) clone.style.display = 'none';
    const elemBelow = document.elementFromPoint(x, y);
    if(clone) clone.style.display = 'block';
    
    if (!elemBelow) return;

    // Hedef öğeyi bul (Travel Item veya Separator olabilir)
    let targetItem = elemBelow.closest('.travel-item');
    let targetSeparator = elemBelow.closest('.distance-separator');
    const targetList = elemBelow.closest('.day-list');

    if (targetList) {
        // Eğer separator üzerindeysek, hedef olarak ondan önceki travel-item'ı al
        if (targetSeparator && !targetItem) {
            targetItem = targetSeparator.previousElementSibling;
            // Eğer önceki eleman travel-item değilse (örn. placeholder ise), null kalsın
            if (!targetItem || !targetItem.classList.contains('travel-item')) {
                targetItem = null;
            }
        }

        if (targetItem && targetItem !== draggedItem) {
            const rect = targetItem.getBoundingClientRect();
            // Separator varsa onun yüksekliğini de hesaba kat (paket mantığı)
            let totalHeight = rect.height;
            let nextEl = targetItem.nextElementSibling;
            if (nextEl && nextEl.classList.contains('distance-separator')) {
                totalHeight += nextEl.getBoundingClientRect().height;
            }

            const midpoint = rect.top + (totalHeight / 2);
            
            if (y < midpoint) {
                // Üstüne ekle
                targetList.insertBefore(placeholder, targetItem);
            } else {
                // Altına ekle (Varsa separatörü de geç)
                let insertPoint = targetItem.nextSibling;
                if (insertPoint && insertPoint.classList.contains('distance-separator')) {
                    insertPoint = insertPoint.nextSibling;
                }
                targetList.insertBefore(placeholder, insertPoint);
            }
        } 
        // Liste boşsa veya en alttaki boşluğa geldiysek
        else if (!targetItem && !targetSeparator) {
            targetList.appendChild(placeholder);
        }
    }
}

function finishDrag() {
    if (placeholder && draggedItem) {
        placeholder.parentNode.insertBefore(draggedItem, placeholder);
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