// ========== STYLES (Görsel Ayarlar) ==========
function injectDragStyles() {
    const styleId = 'tt-drag-styles';
    if (document.getElementById(styleId)) return;
    const css = `
        /* Sürüklenen Görsel Kopya (Ghost) */
        .drag-ghost {
            position: fixed !important;
            z-index: 999999 !important;
            pointer-events: none !important; /* Altını görmesi için şart */
            background: #fff !important;
            box-shadow: 0 15px 40px rgba(0,0,0,0.3) !important;
            transform: scale(1.05) !important;
            border: 2px solid #8a4af3 !important;
            border-radius: 12px !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            width: var(--ghost-width);
            height: var(--ghost-height);
            transition: none !important; /* Anlık takip için */
        }

        /* Orijinal Öğe (Listede kalan) */
        .travel-item.dragging-source {
            opacity: 0.1 !important;
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
            cursor: grabbing !important;
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

// Koordinatlar
let dragOffsetX, dragOffsetY;
let longPressTimer;
const LONG_PRESS_MS = 200;
const MOVE_CANCEL_PX = 10;
let startX = 0, startY = 0;

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
    
    // Sayfa yüklendiğinde kalıntı varsa temizle
    cleanupDrag();
}

// ========== AGRESSIVE CLEANUP ==========
function cleanupDrag() {
    // 1. Tüm Ghost elemanlarını bul ve yok et
    const ghosts = document.querySelectorAll('.drag-ghost');
    ghosts.forEach(g => g.remove());

    // 2. Tüm Orijinal öğelerin stillerini sıfırla
    document.querySelectorAll('.travel-item').forEach(item => {
        item.classList.remove('dragging-source');
        item.style.opacity = '';
    });

    // 3. Placeholder'ı kaldır
    if (placeholder && placeholder.parentNode) placeholder.remove();
    placeholder = null;

    // 4. Global değişkenleri sıfırla
    draggedItem = null;
    document.body.classList.remove('dragging-active');
    
    if (longPressTimer) clearTimeout(longPressTimer);
}

// ========== HELPER: GHOST OLUŞTURMA ==========
function createDragGhost(item, clientX, clientY) {
    // Önceki kalıntıları temizle
    document.querySelectorAll('.drag-ghost').forEach(g => g.remove());

    const rect = item.getBoundingClientRect();
    dragOffsetX = clientX - rect.left;
    dragOffsetY = clientY - rect.top;

    const ghost = item.cloneNode(true);
    ghost.classList.add('drag-ghost');
    
    // İçeriği temizle (performans)
    const content = ghost.querySelector('.content');
    if(content) content.style.display = 'none';

    // Boyutları sabitle
    ghost.style.setProperty('--ghost-width', rect.width + 'px');
    ghost.style.setProperty('--ghost-height', rect.height + 'px');

    // İlk pozisyon
    ghost.style.left = (rect.left) + 'px';
    ghost.style.top = (rect.top) + 'px';

    document.body.appendChild(ghost);
}

function updateDragGhost(clientX, clientY) {
    const ghost = document.querySelector('.drag-ghost');
    if (!ghost) return;
    ghost.style.left = (clientX - dragOffsetX) + 'px';
    ghost.style.top = (clientY - dragOffsetY) + 'px';
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
    // Ghost'un altındaki elementi bul
    // pointer-events:none olduğu için ghost delinip geçilir
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

    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    
    longPressTimer = setTimeout(() => {
        startDrag(item, e.touches[0].clientX, e.touches[0].clientY);
    }, LONG_PRESS_MS);
}

function handleTouchMove(e) {
    if (!draggedItem) {
        const dx = Math.abs(e.touches[0].clientX - startX);
        const dy = Math.abs(e.touches[0].clientY - startY);
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
    // Listener'ları document üzerine ekleyelim ki dinamik elemanlarda sorun olmasın
    document.addEventListener('mousedown', function(e) {
        const item = e.target.closest('.travel-item');
        // Sol tık sadece
        if (item && e.button === 0 && !e.target.closest('button') && !e.target.closest('.visual img')) {
            // Desktop'ta anında başlatmayalım, hafif hareket bekleyelim veya direkt başlatalım.
            // Native drag'i engellemek için:
            // e.preventDefault(); // Bunu yaparsak click çalışmaz.
            
            // Hibrit çözüm:
            draggedItem = item;
            startX = e.clientX;
            startY = e.clientY;
            
            const onMouseMove = (moveEvent) => {
                const dx = Math.abs(moveEvent.clientX - startX);
                const dy = Math.abs(moveEvent.clientY - startY);
                // 5px hareket varsa sürüklemeyi başlat
                if (!document.querySelector('.drag-ghost') && (dx > 5 || dy > 5)) {
                    startDrag(item, startX, startY);
                }
                
                if (document.querySelector('.drag-ghost')) {
                    updateDragGhost(moveEvent.clientX, moveEvent.clientY);
                    updatePlaceholder(moveEvent.clientX, moveEvent.clientY);
                }
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                if (document.querySelector('.drag-ghost')) {
                    finishDrag();
                } else {
                    draggedItem = null;
                }
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }
    });
}

// ========== SHARED DRAG LOGIC ==========
function startDrag(item, x, y) {
    draggedItem = item;
    sourceIndex = parseInt(item.dataset.index);
    
    if (navigator.vibrate) navigator.vibrate(50);

    createDragGhost(item, x, y);

    item.classList.add('dragging-source');
    document.body.classList.add('dragging-active');
}

function finishDrag() {
    if (placeholder && placeholder.parentNode) {
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
            // Temizlik yapmadan önce veriyi güncelle
            reorderCart(fromIndex, newIndex, fromItem.day, toDay);
        }
    }
    
    // En son temizlik
    cleanupDrag();
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
// Mainscript uyumluluğu için boş fonksiyonlar
window.dragStart = function(){}; 
window.drop = function(){};
window.allowDrop = function(){};
window.attachDragListeners = function(){};
window.attachChatDropListeners = function(){};

document.addEventListener('DOMContentLoaded', initDragDropSystem);