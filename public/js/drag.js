// ========== STYLES (Görsel Ayarlar) ==========
function injectDragStyles() {
    const styleId = 'tt-drag-styles';
    if (document.getElementById(styleId)) return;
    const css = `
        .drag-ghost {
            position: fixed !important;
            z-index: 999999 !important;
            pointer-events: none !important;
            background: rgba(255, 255, 255, 0.95) !important;
            border: 2px dashed #87cdb5 !important; 
            box-shadow: 0 15px 35px rgba(0,0,0,0.2) !important;
            border-radius: 12px !important;
            
            /* JS boyutları ayarlayacak */
            width: var(--ghost-width);
            height: var(--ghost-height);
            
            /* Sabit başlangıç, hareket transform ile olacak */
            top: 0; 
            left: 0;
            margin: 0 !important;
            
            /* GPU Hızlandırma ve Performans */
            will-change: transform; 
            transition: none !important; /* Gecikme olmasın */
            transform-origin: center center;
            /* İlk başta ekran dışında oluştur, JS anında yerine çekecek */
            transform: translate3d(-9999px, -9999px, 0) scale(1.02);
        }
        .insertion-placeholder {
            height: 6px !important;
            background: linear-gradient(90deg, #8a4af3, #b388ff); 
            margin: 8px 0;
            border-radius: 4px;
            box-shadow: 0 0 10px rgba(138, 74, 243, 0.5); 
            pointer-events: none;
        }
        @keyframes shakeError {
            0% { transform: translateX(0); border-color: #ffa000; }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
            100% { transform: translateX(0); border-color: #ffa000; }
        }
        .shake-error {
            animation: shakeError 0.4s ease-in-out;
            border: 2px solid #ffa000 !important;
            background-color: #fffdf0 !important;
        }
        
        /* Gizleme Sınıfları */
        body.hide-map-details .route-controls-bar,
        body.hide-map-details .tt-travel-mode-set,
        body.hide-map-details [id^="map-bottom-controls-wrapper"], 
        body.hide-map-details .add-more-btn,
        body.hide-map-details .add-new-day-btn,
        body.hide-map-details #add-new-day-button,
        body.hide-map-details .add-new-day-separator, 
        body.hide-map-details .route-info, 
        body.hide-map-details [id^="route-info-day"], 
        body.hide-map-details .route-scale-bar,
        body.hide-map-details .ai-info-section,
        body.hide-map-details .ai-trip-info-box,
        body.hide-map-details #generate-ai-info-btn,
        body.hide-map-details .add-to-calendar-btn,
        body.hide-map-details .date-range,
        body.hide-map-details #newchat,
        body.hide-map-details .trip-share-section
        {
            display: none !important;
        }

        .route-controls-bar, .map-content-wrap, .tt-travel-mode-set {
            pointer-events: auto;
        }
        body.dragging-active {
            user-select: none !important;
            cursor: grabbing !important;
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

// Offset değerleri
let dragShiftX = 0, dragShiftY = 0;

let startX = 0, startY = 0;
let longPressTimer;
const LONG_PRESS_MS = 200;

// --- RENDER LOOP & SCROLL VARIABLES ---
let isDragging = false; 
let renderFrameId = null;
let autoScrollSpeed = 0;
let scrollContainer = null;

const SCROLL_THRESHOLD = 140; 
const MAX_SCROLL_SPEED = 35;  

let lastClientX = 0, lastClientY = 0;

// ========== INITIALIZATION ==========
function initDragDropSystem() {
    injectDragStyles();
    isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    cleanupDrag();

    if (isMobile) {
        document.body.addEventListener('touchstart', handleTouchStart, { passive: false });
        document.body.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.body.addEventListener('touchend', handleTouchEnd);
        document.body.addEventListener('touchcancel', handleTouchEnd);
    } else {
        setupDesktopListeners();
    }
    
    document.addEventListener('dragstart', (e) => {
        if (e.target.closest('.travel-item')) e.preventDefault();
    });

    window.addEventListener('blur', () => { if (draggedItem) finishDrag(); });
    window.addEventListener('pointerup', () => { if (draggedItem && isMobile) finishDrag(); });
}

// ========== HELPER: FIND SCROLL PARENT ==========
function getScrollParent(node) {
    if (!node) return window;
    if (node === document.body || node === document.documentElement) return window;

    const style = getComputedStyle(node);
    const overflowY = style.overflowY;
    const isScrollable = overflowY === 'auto' || overflowY === 'scroll';

    if (isScrollable && node.scrollHeight > node.clientHeight) {
        return node;
    }
    return getScrollParent(node.parentNode);
}

// ========== CLEANUP ==========
function cleanupDrag() {
    isDragging = false;
    if (renderFrameId) {
        cancelAnimationFrame(renderFrameId);
        renderFrameId = null;
    }
    autoScrollSpeed = 0;

    if (document.body.classList.contains('hide-map-details')) {
        const currentItem = document.querySelector('.travel-item.dragging-source');
        if (currentItem) {
            const rectBefore = currentItem.getBoundingClientRect();
            document.body.classList.remove('hide-map-details'); 
            const rectAfter = currentItem.getBoundingClientRect();
            
            if (scrollContainer && scrollContainer !== window) {
                const diff = rectAfter.top - rectBefore.top;
                scrollContainer.scrollTop += diff; 
            } else {
                const diff = rectAfter.top - rectBefore.top;
                if (diff !== 0) window.scrollBy(0, diff);
            }
        } else {
            document.body.classList.remove('hide-map-details');
        }
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
    scrollContainer = null;
    
    document.body.classList.remove('dragging-active');
    if (longPressTimer) clearTimeout(longPressTimer);
}

// ========== THE RENDER LOOP (GPU ACCELERATED) ==========
function dragRenderLoop() {
    if (!isDragging || !draggedItem) {
        renderFrameId = null;
        return;
    }

    // 1. Scroll Hesapla ve Uygula
    calculateScrollSpeed();

    if (Math.abs(autoScrollSpeed) > 0.5) {
        if (!scrollContainer || scrollContainer === window) {
            window.scrollBy(0, autoScrollSpeed);
        } else {
            scrollContainer.scrollTop += autoScrollSpeed;
        }
    }

    // 2. Ghost Pozisyonunu Güncelle (TRANSFORM İLE)
    updateDragGhostVisuals();

    // 3. Placeholder Güncelle
    updatePlaceholderLogic();

    renderFrameId = requestAnimationFrame(dragRenderLoop);
}

// ========== LOGIC HELPERS ==========

function calculateScrollSpeed() {
    let containerHeight, containerTop;
    
    if (!scrollContainer || scrollContainer === window) {
        containerHeight = window.innerHeight;
        containerTop = 0;
    } else {
        const rect = scrollContainer.getBoundingClientRect();
        containerHeight = rect.height;
        containerTop = rect.top;
    }

    const relativeY = lastClientY - containerTop;

    // YUKARI
    if (relativeY < SCROLL_THRESHOLD) {
        const ratio = (SCROLL_THRESHOLD - relativeY) / SCROLL_THRESHOLD; 
        const intensity = ratio * ratio; 
        autoScrollSpeed = -MAX_SCROLL_SPEED * intensity;
    } 
    // AŞAĞI
    else if (relativeY > (containerHeight - SCROLL_THRESHOLD)) {
        const ratio = (relativeY - (containerHeight - SCROLL_THRESHOLD)) / SCROLL_THRESHOLD;
        const intensity = ratio * ratio;
        autoScrollSpeed = (MAX_SCROLL_SPEED * intensity) * 1.3; 
    } 
    else {
        autoScrollSpeed = 0;
    }
}

function updateDragGhostVisuals() {
    const ghost = document.querySelector('.drag-ghost');
    if (!ghost) return;
    
    if (lastClientX === 0 && lastClientY === 0) return;

    // Koordinat hesabı (Pixel Perfect)
    const targetX = lastClientX - dragShiftX;
    const targetY = lastClientY - dragShiftY;

    // GPU Hızlandırma: translate3d kullanarak pürüzsüz hareket
    ghost.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) scale(1.02)`;
}

function updatePlaceholderLogic() {
    if (!draggedItem) return;
    
    // Ghost'un sol üst köşesini referans alıyoruz (daha doğal hissetmesi için)
    // Eğer mouse ortadaysa lastClientX kullanabiliriz ama bu logic en sağlamıdır.
    const currentX = lastClientX; 
    const currentY = lastClientY;

    const elementBelow = document.elementFromPoint(currentX, currentY);
    if (!elementBelow) return;
    
    const dropZone = elementBelow.closest('.day-list');
    if (!dropZone) return;

    if (!placeholder) {
        placeholder = document.createElement('div');
        placeholder.className = 'insertion-placeholder';
    }
    
    const afterElement = getDragAfterElement(dropZone, currentY);
    
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

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.travel-item:not(.dragging-source)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// ========== INITIAL GHOST ==========
function createDragGhost(item, clientX, clientY) {
    document.querySelectorAll('.drag-ghost').forEach(g => g.remove());
    
    const rect = item.getBoundingClientRect();
    
    // Ofsetleri hesapla
    dragShiftX = clientX - rect.left;
    dragShiftY = clientY - rect.top;

    const ghost = item.cloneNode(true);
    ghost.classList.add('drag-ghost');
    
    const mapContent = ghost.querySelector('.map-content-wrap');
    if(mapContent) mapContent.style.display = 'none';
    const routeInfo = ghost.querySelector('.route-info');
    if(routeInfo) routeInfo.style.display = 'none';

    ghost.style.setProperty('--ghost-width', rect.width + 'px');
    ghost.style.setProperty('--ghost-height', rect.height + 'px');
    
    // --- BAŞLANGIÇ KONUMU (Zıplamayı Önler) ---
    // Oluşturulduğu an, CSS beklemeden doğru konuma oturtuyoruz.
    // translate3d ile GPU katmanına alıyoruz.
    const initialX = rect.left;
    const initialY = rect.top;
    
    ghost.style.transform = `translate3d(${initialX}px, ${initialY}px, 0) scale(1.02)`;
    
    document.body.appendChild(ghost);
}

// ========== HANDLERS ==========
function handleTouchStart(e) {
    const item = e.target.closest('.travel-item');
    if (!item || e.target.closest('button') || e.target.closest('.map-content-wrap')) return;
    if (e.touches.length > 1) return;

    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    
    // Anında kaydet
    lastClientX = startX;
    lastClientY = startY;
    
    longPressTimer = setTimeout(() => startDrag(item, startX, startY), LONG_PRESS_MS);
}

function handleTouchMove(e) {
    // Koordinatları sürekli güncelle
    lastClientX = e.touches[0].clientX;
    lastClientY = e.touches[0].clientY;

    if (!isDragging) {
        const dx = Math.abs(lastClientX - startX);
        const dy = Math.abs(lastClientY - startY);
        // Hassasiyet eşiği
        if (dx > 10 || dy > 10) clearTimeout(longPressTimer);
        return;
    }
    
    if (e.cancelable) e.preventDefault();
}

function handleTouchEnd() {
    clearTimeout(longPressTimer);
    if (isDragging) finishDrag();
}

function setupDesktopListeners() {
    document.addEventListener('mousedown', function(e) {
        if (e.button !== 0) return;
        if (e.target.closest('.leaflet-control') || e.target.closest('.map-functions')) return;

        const item = e.target.closest('.travel-item');
        if (item && !e.target.closest('button')) {
            draggedItem = item;
            startX = e.clientX;
            startY = e.clientY;
            
            lastClientX = startX;
            lastClientY = startY;

            let isDragStarted = false;

            const onMouseMove = (moveEvent) => {
                if ((moveEvent.buttons & 1) === 0) {
                    onMouseUp();
                    return;
                }

                lastClientX = moveEvent.clientX;
                lastClientY = moveEvent.clientY;

                if (!isDragStarted) {
                    const dx = Math.abs(lastClientX - startX);
                    const dy = Math.abs(lastClientY - startY);
                    if (dx > 5 || dy > 5) {
                        isDragStarted = true;
                        startDrag(item, lastClientX, lastClientY);
                    }
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
    scrollContainer = getScrollParent(item);
    
    lastClientX = x;
    lastClientY = y;

    if (navigator.vibrate) navigator.vibrate(50);
    
    const currentDocHeight = document.documentElement.scrollHeight;
    document.body.style.minHeight = currentDocHeight + 'px';

    createDragGhost(item, x, y);
    item.classList.add('dragging-source');
    
    document.body.classList.add('hide-map-details');
    document.body.classList.add('dragging-active');

    isDragging = true;
    dragRenderLoop();
}

function finishDrag() {
    isDragging = false; 

    if (placeholder && placeholder.parentNode) {
        const dropList = placeholder.parentNode;
        
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
            const name2 = (window.cart[sourceIndex].name || "").trim().toLowerCase();
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

window.initDragDropSystem = initDragDropSystem;
if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDragDropSystem);
} else {
    initDragDropSystem();
}