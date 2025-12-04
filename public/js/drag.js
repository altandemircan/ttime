// ========== STYLES (Visual Settings) ==========
function injectDragStyles() {
    const styleId = 'tt-drag-styles';
    if (document.getElementById(styleId)) return;
    const css = `
        /* DRAGGING GHOST */
        .drag-ghost {
            position: fixed !important;
            z-index: 999999 !important;
            pointer-events: none !important;
            background: rgba(255, 255, 255, 0.95) !important;
            border: 2px dashed #87cdb5 !important; 
            box-shadow: 0 12px 30px rgba(16, 185, 129, 0.25) !important;
            border-radius: 12px !important;
            width: var(--ghost-width);
            height: var(--ghost-height);
            margin: 0 !important;
            will-change: left, top; 
            transition: none !important;
        }

        /* PLACEHOLDER (PURPLE LINE) */
        .insertion-placeholder {
            height: 6px !important;
            background: linear-gradient(90deg, #8a4af3, #b388ff); 
            margin: 8px 0;
            border-radius: 4px;
            box-shadow: 0 0 10px rgba(138, 74, 243, 0.5); 
            pointer-events: none;
        }

        /* ALERT SHAKE */
        @keyframes shakeError {
            0% { transform: translateX(0); border-color: #ffa000; }
            25% { transform: translateX(-5px); }
            50% { transform: translateX(5px); }
            75% { transform: translateX(-5px); }
            100% { transform: translateX(0); border-color: #ffa000; }
        }
        .shake-error {
            animation: shakeError 0.4s ease-in-out;
            border: 2px solid #ffa000 !important;
            background-color: #fffdf0 !important;
        }

        /* HIDE ELEMENTS ON MOBILE ONLY */
        body.mobile-drag-active .route-controls-bar,
        body.mobile-drag-active .tt-travel-mode-set,
        body.mobile-drag-active [id^="map-bottom-controls-wrapper"], 
        body.mobile-drag-active .add-more-btn {
            display: none !important;
        }

        .route-controls-bar, .map-content-wrap, .tt-travel-mode-set {
            pointer-events: auto;
        }
        
        body.dragging-active {
            user-select: none !important;
            cursor: grabbing !important;
            /* Disable browser native scroll while dragging to allow auto-scroll */
            touch-action: none !important;
        }
    `;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = css;
    document.head.appendChild(style);
}

// ========== GLOBAL VARIABLES ==========
if (!window.cart) window.cart = [];

let draggedItem = null;      
let placeholder = null;
let sourceIndex = -1;
let isMobile = false;

// Offset Variables
let dragShiftX = 0;
let dragShiftY = 0;

let startX = 0, startY = 0;
let longPressTimer;
const LONG_PRESS_MS = 200;

// --- AUTO SCROLL VARIABLES ---
let autoScrollSpeed = 0;
let autoScrollAnimation = null;
const SCROLL_ZONE_SIZE = 100; // px from top/bottom
const MAX_SCROLL_SPEED = 20;  // px per frame

// To track cursor position for auto-scroll updates
let lastClientX = 0;
let lastClientY = 0;

// ========== INITIALIZATION ==========
function initDragDropSystem() {
    injectDragStyles();
    isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    cleanupDrag();

    if (isMobile) {
        document.body.addEventListener('touchstart', handleTouchStart, { passive: false });
        document.body.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.body.addEventListener('touchend', handleTouchEnd);
    } else {
        setupDesktopListeners();
    }
    
    document.addEventListener('dragstart', (e) => {
        if (e.target.closest('.travel-item')) e.preventDefault();
    });

    window.addEventListener('blur', () => {
        if (draggedItem) finishDrag();
    });
}

// ========== CLEANUP ==========
function cleanupDrag() {
    // STOP AUTO SCROLL
    if (autoScrollAnimation) {
        cancelAnimationFrame(autoScrollAnimation);
        autoScrollAnimation = null;
    }
    autoScrollSpeed = 0;

    // RESTORE SCROLL POSITION (MOBILE FIX)
    if (isMobile && document.body.classList.contains('mobile-drag-active')) {
        const currentItem = document.querySelector('.travel-item.dragging-source');
        if (currentItem) {
            const rectBefore = currentItem.getBoundingClientRect();
            document.body.classList.remove('mobile-drag-active');
            const rectAfter = currentItem.getBoundingClientRect();
            const diff = rectAfter.top - rectBefore.top;
            if (diff !== 0) window.scrollBy(0, diff);
        } else {
            document.body.classList.remove('mobile-drag-active');
        }
    } else {
        document.body.classList.remove('mobile-drag-active');
    }

    document.body.style.minHeight = '';

    document.querySelectorAll('.drag-ghost').forEach(g => g.remove());
    document.querySelectorAll('.travel-item').forEach(item => {
        item.classList.remove('dragging-source');
        item.classList.remove('shake-error');
        item.style.opacity = '';
    });
    if (placeholder && placeholder.parentNode) placeholder.remove();
    placeholder = null;
    draggedItem = null;
    
    document.body.classList.remove('dragging-active');
    if (longPressTimer) clearTimeout(longPressTimer);
}

// ========== AUTO SCROLL ENGINE ==========
function updateAutoScroll(y) {
    const h = window.innerHeight;
    
    if (y < SCROLL_ZONE_SIZE) {
        // Scroll Up (Negative speed)
        // Closer to edge = faster
        autoScrollSpeed = -MAX_SCROLL_SPEED * (1 - (y / SCROLL_ZONE_SIZE));
    } else if (y > (h - SCROLL_ZONE_SIZE)) {
        // Scroll Down (Positive speed)
        autoScrollSpeed = MAX_SCROLL_SPEED * (1 - ((h - y) / SCROLL_ZONE_SIZE));
    } else {
        autoScrollSpeed = 0;
    }

    if (autoScrollSpeed !== 0 && !autoScrollAnimation) {
        autoScrollLoop();
    }
}

function autoScrollLoop() {
    if (!draggedItem || autoScrollSpeed === 0) {
        autoScrollAnimation = null;
        return;
    }

    // Perform Scroll
    window.scrollBy(0, autoScrollSpeed);

    // Update Placeholder while scrolling (Critical!)
    // Even if finger doesn't move, the list moves under it.
    if (lastClientX && lastClientY) {
        updatePlaceholder(lastClientX, lastClientY);
    }

    autoScrollAnimation = requestAnimationFrame(autoScrollLoop);
}

// ========== GHOST LOGIC ==========
function createDragGhost(item, clientX, clientY) {
    document.querySelectorAll('.drag-ghost').forEach(g => g.remove());
    const rect = item.getBoundingClientRect();
    
    const ghost = item.cloneNode(true);
    ghost.classList.add('drag-ghost');
    
    const mapContent = ghost.querySelector('.map-content-wrap');
    if(mapContent) mapContent.style.display = 'none';

    ghost.style.setProperty('--ghost-width', rect.width + 'px');
    ghost.style.setProperty('--ghost-height', rect.height + 'px');
    
    ghost.style.left = (clientX - dragShiftX) + 'px';
    ghost.style.top = (clientY - dragShiftY) + 'px';
    
    document.body.appendChild(ghost);
}

function updateDragGhost(clientX, clientY) {
    const ghost = document.querySelector('.drag-ghost');
    if (!ghost) return;
    
    ghost.style.left = (clientX - dragShiftX) + 'px';
    ghost.style.top = (clientY - dragShiftY) + 'px';
}

// ========== PLACEHOLDER LOGIC ==========
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.travel-item:not(.dragging-source)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        return (offset < 0 && offset > closest.offset) ? { offset: offset, element: child } : closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function updatePlaceholder(clientX, clientY) {
    const elementBelow = document.elementFromPoint(clientX, clientY);
    if (!elementBelow) return;
    
    const dropZone = elementBelow.closest('.day-list');
    if (!dropZone) return;

    if (!placeholder) {
        placeholder = document.createElement('div');
        placeholder.className = 'insertion-placeholder';
    }
    
    const afterElement = getDragAfterElement(dropZone, clientY);
    
    if (afterElement == null) {
        const addBtn = dropZone.querySelector('.add-more-btn');
        if (addBtn && getComputedStyle(addBtn).display !== 'none') {
             dropZone.insertBefore(placeholder, addBtn);
        } else {
             dropZone.appendChild(placeholder);
        }
    } else {
        dropZone.insertBefore(placeholder, afterElement);
    }
}

// ========== HANDLERS ==========
function handleTouchStart(e) {
    const item = e.target.closest('.travel-item');
    if (!item || e.target.closest('button') || e.target.closest('.map-content-wrap')) return;
    
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;

    const rect = item.getBoundingClientRect();
    dragShiftX = startX - rect.left;
    dragShiftY = startY - rect.top;
    
    longPressTimer = setTimeout(() => startDrag(item, startX, startY), LONG_PRESS_MS);
}

function handleTouchMove(e) {
    if (!draggedItem) {
        const dx = Math.abs(e.touches[0].clientX - startX);
        const dy = Math.abs(e.touches[0].clientY - startY);
        if (dx > 10 || dy > 10) clearTimeout(longPressTimer);
        return;
    }
    
    e.preventDefault(); // Browser scroll off
    
    const touch = e.touches[0];
    lastClientX = touch.clientX;
    lastClientY = touch.clientY;

    updateDragGhost(lastClientX, lastClientY);
    updatePlaceholder(lastClientX, lastClientY);
    
    // TRIGGER AUTO SCROLL
    updateAutoScroll(lastClientY);
}

function handleTouchEnd() {
    clearTimeout(longPressTimer);
    if (draggedItem) finishDrag();
}

// --- DESKTOP LOGIC (UNCHANGED / ORIGINAL) ---
function setupDesktopListeners() {
    document.addEventListener('mousedown', function(e) {
        if (e.button !== 0) return;
        if (e.target.closest('.leaflet-control') || e.target.closest('.map-functions')) return;

        const item = e.target.closest('.travel-item');
        if (item && !e.target.closest('button')) {
            draggedItem = item;
            startX = e.clientX;
            startY = e.clientY;

            const rect = item.getBoundingClientRect();
            dragShiftX = startX - rect.left;
            dragShiftY = startY - rect.top;

            let isDragStarted = false;

            const onMouseMove = (moveEvent) => {
                if (!draggedItem) return;
                const dx = Math.abs(moveEvent.clientX - startX);
                const dy = Math.abs(moveEvent.clientY - startY);
                if (!isDragStarted && (dx > 5 || dy > 5)) {
                    isDragStarted = true;
                    // Desktop starts directly (no hiding maps)
                    startDrag(draggedItem, moveEvent.clientX, moveEvent.clientY);
                }
                if (isDragStarted) {
                    lastClientX = moveEvent.clientX;
                    lastClientY = moveEvent.clientY;
                    updateDragGhost(lastClientX, lastClientY);
                    updatePlaceholder(lastClientX, lastClientY);
                    // Desktop also benefits from auto-scroll
                    updateAutoScroll(lastClientY);
                }
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                if (isDragStarted) finishDrag();
                else draggedItem = null;
            };
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }
    });
}

function startDrag(item, x, y) {
    draggedItem = item;
    sourceIndex = parseInt(item.dataset.index);
    if (navigator.vibrate) navigator.vibrate(50);
    
    const currentDocHeight = document.documentElement.scrollHeight;
    document.body.style.minHeight = currentDocHeight + 'px';

    // --- MOBILE SPECIFIC LOGIC ---
    if (isMobile) {
        const rectBefore = item.getBoundingClientRect();
        const originalTop = rectBefore.top;

        // Hide maps ONLY on mobile
        document.body.classList.add('mobile-drag-active');
        
        void document.body.offsetHeight; // Reflow

        const rectAfter = item.getBoundingClientRect();
        const newTop = rectAfter.top;
        const diff = newTop - originalTop;

        if (diff !== 0) window.scrollBy(0, diff);
    }

    createDragGhost(item, x, y);
    item.classList.add('dragging-source');
    document.body.classList.add('dragging-active');
}

// ========== FINISH ==========
function finishDrag() {
    // Kill auto scroll
    if (autoScrollAnimation) {
        cancelAnimationFrame(autoScrollAnimation);
        autoScrollAnimation = null;
    }
    autoScrollSpeed = 0;

    if (placeholder && placeholder.parentNode) {
        const dropList = placeholder.parentNode;
        const sourceItemData = window.cart[sourceIndex];
        
        const getValidNeighbor = (startNode, direction) => {
            let sibling = direction === 'prev' ? startNode.previousElementSibling : startNode.nextElementSibling;
            while (sibling) {
                if (sibling.classList.contains('dragging-source') || !sibling.classList.contains('travel-item')) {
                    sibling = direction === 'prev' ? sibling.previousElementSibling : sibling.nextElementSibling;
                } else {
                    return sibling;
                }
            }
            return null;
        };

        let prev = getValidNeighbor(placeholder, 'prev');
        let next = getValidNeighbor(placeholder, 'next');

        const isDuplicate = (element) => {
            if (!element) return false;
            const idx = parseInt(element.dataset.index);
            const itemData = window.cart[idx];
            if (!itemData || idx === sourceIndex) return false;
            const name1 = (itemData.title || itemData.name || "").trim().toLowerCase();
            const name2 = (sourceItemData.title || sourceItemData.name || "").trim().toLowerCase();
            return name1 === name2 && name1 !== "";
        };

        if (isDuplicate(prev) || isDuplicate(next)) {
            const conflictItem = isDuplicate(prev) ? prev : next;
            conflictItem.classList.add('shake-error');
            setTimeout(() => alert("ℹ️ Note: You added the same place consecutively."), 10);
        }

        const toDay = parseInt(dropList.dataset.day);
        
        let realIndex = 0;
        const siblings = dropList.querySelectorAll('.travel-item:not(.dragging-source), .insertion-placeholder');
        for(let i=0; i<siblings.length; i++) {
            if(siblings[i].classList.contains('insertion-placeholder')) {
                realIndex = i;
                break;
            }
        }

        const fromIndex = sourceIndex;
        if (window.cart && window.cart[fromIndex]) {
            reorderCart(fromIndex, realIndex, window.cart[fromIndex].day, toDay);
        }
    }
    cleanupDrag();
}

function reorderCart(fromIndex, toIndex, fromDay, toDay) {
    try {
        const newCart = [...window.cart];
        if (!newCart[fromIndex]) return;

        const [movedItem] = newCart.splice(fromIndex, 1);
        movedItem.day = toDay;

        let targetDayItems = newCart.filter(i => i.day === toDay);
        targetDayItems.splice(toIndex, 0, movedItem);
        
        const allDays = new Set([...window.cart.map(i=>i.day), toDay]); 
        const sortedDays = [...allDays].sort((a,b)=>a-b);
        
        let finalCart = [];
        sortedDays.forEach(d => {
            if (d === toDay) finalCart = finalCart.concat(targetDayItems);
            else finalCart = finalCart.concat(newCart.filter(i => i.day === d));
        });

        window.cart = finalCart;

        if (typeof updateCart === "function") updateCart();

        setTimeout(() => {
            if (typeof calculateAllRoutes === "function") calculateAllRoutes();
            else if (typeof renderMapForDay === "function") {
                renderMapForDay(toDay);
                if(fromDay !== toDay) renderMapForDay(fromDay);
            }
            else {
                window.dispatchEvent(new CustomEvent('cartUpdated', { 
                    detail: { fromDay, toDay } 
                }));
            }
        }, 50);

        if (typeof saveCurrentTripToStorage === "function") saveCurrentTripToStorage();

    } catch (e) {
        console.error("Reorder error:", e);
    }
}

// ========== BAŞLATMA ==========
window.initDragDropSystem = initDragDropSystem;
if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDragDropSystem);
} else {
    initDragDropSystem();
}