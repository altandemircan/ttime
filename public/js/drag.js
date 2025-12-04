// ========== STYLES (Görsel Ayarlar) ==========
function injectDragStyles() {
    const styleId = 'tt-drag-styles';
    if (document.getElementById(styleId)) return;
    const css = `
        /* Sürüklenen Görsel Kopya (Ghost) */
        .drag-ghost {
            position: fixed !important;
            z-index: 999999 !important; /* En üstte */
            pointer-events: none !important; /* Altını görmesi için şart */
            opacity: 0.95 !important;
            background: #fff !important;
            box-shadow: 0 15px 40px rgba(0,0,0,0.3) !important;
            transform: scale(1.05) !important;
            border: 2px solid #8a4af3 !important;
            border-radius: 12px !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            width: var(--ghost-width);
            height: var(--ghost-height);
            /* Yumuşaklık için */
            transition: transform 0.1s;
        }

        /* Orijinal Öğe (Listede kalan) */
        .travel-item.dragging-source {
            opacity: 0.3 !important;
            filter: grayscale(100%);
            border: 2px dashed #ccc;
        }

        /* Mor Yerleşim Çizgisi */
        .insertion-placeholder {
            height: 6px !important;
            background: linear-gradient(90deg, #8a4af3, #b388ff);
            margin: 8px 0;
            border-radius: 4px;
            box-shadow: 0 0 10px rgba(138, 74, 243, 0.5);
            pointer-events: none;
        }

        body.dragging-active {
            user-select: none !important;
            -webkit-user-select: none !important;
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

let draggedItem = null;      // Orijinal öğe
let dragGhost = null;        // Sürüklenen görsel kopya
let placeholder = null;
let sourceIndex = -1;
let isMobile = false;

// Koordinatlar
let touchStartX, touchStartY;
let dragOffsetX, dragOffsetY;
let longPressTimer;
const LONG_PRESS_MS = 250;
const MOVE_CANCEL_PX = 10;

// ========== INITIALIZATION ==========
function initDragDropSystem() {
    injectDragStyles();
    isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (isMobile) {
        document.body.addEventListener('touchstart', handleTouchStart, { passive: false });
        document.body.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.body.addEventListener('touchend', handleTouchEnd);
    } else {
        setupDesktopListeners();
    }
}

// ========== HELPER: GHOST OLUŞTURMA ==========
function createDragGhost(item, clientX, clientY) {
    const rect = item.getBoundingClientRect();
    dragOffsetX = clientX - rect.left;
    dragOffsetY = clientY - rect.top;

    dragGhost = item.cloneNode(true);
    dragGhost.classList.add('drag-ghost');
    
    // İçeriği temizle (sadece başlık ve resim kalsın, harita vs kasmasın)
    const content = dragGhost.querySelector('.content');
    if(content) content.style.display = 'none';

    // Boyutları sabitle
    dragGhost.style.setProperty('--ghost-width', rect.width + 'px');
    dragGhost.style.setProperty('--ghost-height', rect.height + 'px');

    // İlk pozisyon
    dragGhost.style.left = (rect.left) + 'px';
    dragGhost.style.top = (rect.top) + 'px';

    document.body.appendChild(dragGhost);
}

function updateDragGhost(clientX, clientY) {
    if (!dragGhost) return;
    dragGhost.style.left = (clientX - dragOffsetX) + 'px';
    dragGhost.style.top = (clientY - dragOffsetY) + 'px';
}

// ========== HELPER: EN YAKIN ELEMAN ==========
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

// ========== PLACEHOLDER MANTIĞI ==========
function updatePlaceholder(clientX, clientY) {
    // Ghost pointer-events:none olduğu için altını görürüz
    const elementBelow = document.elementFromPoint(clientX, clientY);
    if (!elementBelow) return;

    const dropZone = elementBelow.closest('.day-list');
    if (!dropZone) return;

    if (!placeholder) {
        placeholder = document.createElement('div');
        placeholder.className = 'insertion-placeholder';
    }

    const afterElement = getDragAfterElement(dropZone, clientY);
    const addBtn = dropZone.querySelector('.add-more-btn');

    if (afterElement == null) {
        if (addBtn) dropZone.insertBefore(placeholder, addBtn);
        else dropZone.appendChild(placeholder);
    } else {
        dropZone.insertBefore(placeholder, afterElement);
    }
}

// ========== MOBILE HANDLERS ==========
function handleTouchStart(e) {
    const item = e.target.closest('.travel-item');
    if (!item || e.target.closest('button') || e.target.closest('.visual img')) return;

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    
    longPressTimer = setTimeout(() => {
        startDrag(item, e.touches[0].clientX, e.touches[0].clientY);
    }, LONG_PRESS_MS);
}

function handleTouchMove(e) {
    if (!draggedItem) {
        // Scroll kontrolü
        const dx = Math.abs(e.touches[0].clientX - touchStartX);
        const dy = Math.abs(e.touches[0].clientY - touchStartY);
        if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) clearTimeout(longPressTimer);
        return;
    }

    e.preventDefault();
    const touch = e.touches[0];
    
    updateDragGhost(touch.clientX, touch.clientY);
    updatePlaceholder(touch.clientX, touch.clientY);
}

function handleTouchEnd(e) {
    clearTimeout(longPressTimer);
    if (!draggedItem) return;
    finishDrag();
}

// ========== DESKTOP HANDLERS ==========
function setupDesktopListeners() {
    document.addEventListener('dragstart', function(e) {
        const item = e.target.closest('.travel-item');
        if (item) {
            e.preventDefault(); // Native drag'i iptal et, kendi sistemimizi kullan
            startDrag(item, e.clientX, e.clientY);
        }
    });

    document.addEventListener('mousemove', function(e) {
        if (draggedItem) {
            e.preventDefault();
            updateDragGhost(e.clientX, e.clientY);
            updatePlaceholder(e.clientX, e.clientY);
        }
    });

    document.addEventListener('mouseup', function(e) {
        if (draggedItem) finishDrag();
    });
}

// ========== SHARED DRAG LOGIC ==========
function startDrag(item, x, y) {
    draggedItem = item;
    sourceIndex = parseInt(item.dataset.index);
    
    // Titreşim
    if (navigator.vibrate) navigator.vibrate(50);

    // Ghost oluştur
    createDragGhost(item, x, y);

    // Orijinali silikleştir
    item.classList.add('dragging-source');
    document.body.classList.add('dragging-active');
}

function finishDrag() {
    if (placeholder && placeholder.parentNode) {
        // İndeks hesaplama
        const dropList = placeholder.parentNode;
        const toDay = parseInt(dropList.dataset.day);
        
        let newIndex = 0;
        const children = Array.from(dropList.children);
        
        for (let child of children) {
            if (child === placeholder) break;
            if (child.classList.contains('travel-item') && !child.classList.contains('dragging-source')) {
                newIndex++;
            }
        }

        const fromIndex = sourceIndex;
        const fromItem = window.cart[fromIndex];
        
        if (fromItem) {
            reorderCart(fromIndex, newIndex, fromItem.day, toDay);
        }
    }

    cleanupDrag();
}

function cleanupDrag() {
    if (dragGhost) dragGhost.remove();
    dragGhost = null;

    if (draggedItem) {
        draggedItem.classList.remove('dragging-source');
        draggedItem = null;
    }

    if (placeholder) placeholder.remove();
    placeholder = null;

    document.body.classList.remove('dragging-active');
    clearTimeout(longPressTimer);
}

// ========== DATA UPDATE ==========
function reorderCart(fromIndex, toIndex, fromDay, toDay) {
    try {
        const newCart = [...window.cart];
        const [movedItem] = newCart.splice(fromIndex, 1);
        movedItem.day = toDay;

        let targetDayItems = newCart.filter(i => i.day === toDay);
        let otherItems = newCart.filter(i => i.day !== toDay);
        
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
        if (typeof saveCurrentTripToStorage === "function") saveCurrentTripToStorage();

    } catch (e) {
        console.error("Reorder Error", e);
    }
}

// ========== EXPORTS & INIT ==========
window.initDragDropSystem = initDragDropSystem;
window.attachDragListeners = function() {
    if (!isMobile) setupDesktopListeners();
};
// Mainscript hatalarını önlemek için
window.dragStart = function(){}; 
window.drop = function(){};
window.allowDrop = function(){};
window.attachChatDropListeners = function(){};

document.addEventListener('DOMContentLoaded', initDragDropSystem);