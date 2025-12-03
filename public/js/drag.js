// drag.js - Tamamen Bağımsız ve Çakışmasız Sürüm

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

// 1. CSS'i Otomatik Ekle
(function injectStyles() {
    if (document.getElementById('tt-drag-styles')) return;
    const style = document.createElement('style');
    style.id = 'tt-drag-styles';
    style.innerHTML = `
        .drag-clone {
            position: fixed; z-index: 10000; pointer-events: none; opacity: 0.9;
            box-shadow: 0 15px 30px rgba(0,0,0,0.25); transform: scale(1.02) rotate(2deg);
            transition: none;
        }
        .travel-item.is-dragging { opacity: 0; }
        .drag-placeholder {
            background: rgba(0,0,0,0.04); border: 2px dashed rgba(0,0,0,0.1);
            border-radius: 8px; margin: 5px 0; pointer-events: none;
        }
        body.dragging-active { user-select: none; overflow: hidden; touch-action: none; }
    `;
    document.head.appendChild(style);
})();

// 2. Event Delegation (Global Dinleyiciler)
document.addEventListener('touchstart', onTouchStart, { passive: false });
document.addEventListener('touchmove', onTouchMove, { passive: false });
document.addEventListener('touchend', onTouchEnd);
document.addEventListener('touchcancel', onTouchEnd);

document.addEventListener('mousedown', onMouseDown);
document.addEventListener('mousemove', onMouseMove);
document.addEventListener('mouseup', onMouseUp);

// --- TOUCH EVENTS ---
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
    longPressTimer = setTimeout(() => startDrag(target, touchStartX, touchStartY), LONG_PRESS_DURATION);
}

function onTouchMove(e) {
    if (!draggedItem) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartX);
    const dy = Math.abs(touch.clientY - touchStartY);

    if (!isDragging) {
        if (dx > 10 || dy > 10) { clearTimeout(longPressTimer); draggedItem = null; }
        return;
    }

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

// --- MOUSE EVENTS ---
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
    if (navigator.vibrate) navigator.vibrate(30);

    placeholder = document.createElement('li');
    placeholder.className = 'drag-placeholder';
    placeholder.style.height = `${item.offsetHeight}px`;
    item.parentNode.insertBefore(placeholder, item);

    clone = item.cloneNode(true);
    clone.classList.add('drag-clone');
    clone.style.width = `${item.offsetWidth}px`;
    clone.style.height = `${item.offsetHeight}px`;
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
        if (targetItem && targetItem !== draggedItem && targetItem !== placeholder) {
            const rect = targetItem.getBoundingClientRect();
            if (y < rect.top + rect.height / 2) targetList.insertBefore(placeholder, targetItem);
            else targetList.insertBefore(placeholder, targetItem.nextSibling);
        } else if (!targetItem && targetList.children.length === 0) {
            targetList.appendChild(placeholder);
        } else if (!targetItem) {
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