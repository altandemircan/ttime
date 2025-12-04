// ========== STYLES (Görsel Ayarlar) ==========
function injectDragStyles() {
    const styleId = 'tt-drag-styles';
    if (document.getElementById(styleId)) return;
    const css = `
        /* SÜRÜKLENEN HAYALET (GHOST) */
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

        /* YERLEŞECEĞİ ÇİZGİ (MOR) */
        .insertion-placeholder {
            height: 6px !important;
            background: linear-gradient(90deg, #8a4af3, #b388ff); 
            margin: 8px 0;
            border-radius: 4px;
            box-shadow: 0 0 10px rgba(138, 74, 243, 0.5); 
            pointer-events: none;
        }

        /* UYARI EFEKTİ */
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

        /* MOBİLDE GİZLEME (DESKTOP ETKİLENMEZ) */
        @media (max-width: 768px) {
            body.hide-map-details .route-controls-bar,
            body.hide-map-details .tt-travel-mode-set,
            body.hide-map-details [id^="map-bottom-controls-wrapper"], 
            body.hide-map-details .add-more-btn {
                display: none !important;
            }
        }

        .route-controls-bar, .map-content-wrap, .tt-travel-mode-set {
            pointer-events: auto;
        }
        
        body.dragging-active {
            user-select: none !important;
            cursor: grabbing !important;
            /* Auto-scroll çalışırken tarayıcının kendi scroll'uyla çakışmasın */
            touch-action: none; 
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
let autoScrollFrame = null;
// Kenarlara ne kadar yaklaşınca kaymaya başlasın (px)
const SCROLL_THRESHOLD = 80; 
// Maksimum kayma hızı
const MAX_SCROLL_SPEED = 15; 

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
    // Auto Scroll Durdur
    stopAutoScroll();

    // Scroll Düzeltme (Mobil İçin Geri Yükleme)
    if (isMobile && document.body.classList.contains('hide-map-details')) {
        const currentItem = document.querySelector('.travel-item.dragging-source');
        if (currentItem) {
            const rectBefore = currentItem.getBoundingClientRect();
            document.body.classList.remove('hide-map-details');
            const rectAfter = currentItem.getBoundingClientRect();
            const diff = rectAfter.top - rectBefore.top;
            if (diff !== 0) window.scrollBy(0, diff);
        } else {
            document.body.classList.remove('hide-map-details');
        }
    } else {
        document.body.classList.remove('hide-map-details');
    }

    // Min-height kaldır
    document.body.style.minHeight = '';

    // Temizlik
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

// ========== AUTO SCROLL LOGIC (YENİ EKLENEN KISIM) ==========
function handleAutoScroll(clientY) {
    const viewportHeight = window.innerHeight;
    
    // Üst kenara yakın mı?
    if (clientY < SCROLL_THRESHOLD) {
        // Yukarı kaydır (Hız, kenara yakınlığa göre artar)
        autoScrollSpeed = -MAX_SCROLL_SPEED * ((SCROLL_THRESHOLD - clientY) / SCROLL_THRESHOLD);
    } 
    // Alt kenara yakın mı?
    else if (clientY > (viewportHeight - SCROLL_THRESHOLD)) {
        // Aşağı kaydır
        autoScrollSpeed = MAX_SCROLL_SPEED * ((clientY - (viewportHeight - SCROLL_THRESHOLD)) / SCROLL_THRESHOLD);
    } 
    else {
        autoScrollSpeed = 0;
    }

    if (autoScrollSpeed !== 0 && !autoScrollFrame) {
        startAutoScrollLoop(clientY); // clientY'yi pass ediyoruz çünkü placeholder güncellemesi için lazım olabilir
    }
}

function startAutoScrollLoop() {
    if (autoScrollSpeed === 0) {
        cancelAnimationFrame(autoScrollFrame);
        autoScrollFrame = null;
        return;
    }

    window.scrollBy(0, autoScrollSpeed);
    
    // Scroll olurken placeholder'ın yerini güncellememiz lazım
    // Çünkü sayfa kaydıkça parmağın altındaki eleman değişiyor.
    // Ancak touch/mouse eventindeki son X/Y değerlerini global tutmalıyız.
    if (window.lastClientX && window.lastClientY) {
        updatePlaceholder(window.lastClientX, window.lastClientY);
    }

    autoScrollFrame = requestAnimationFrame(startAutoScrollLoop);
}

function stopAutoScroll() {
    if (autoScrollFrame) {
        cancelAnimationFrame(autoScrollFrame);
        autoScrollFrame = null;
    }
    autoScrollSpeed = 0;
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
    
    e.preventDefault(); // Sayfanın native scrollunu kapat, biz yöneteceğiz
    
    const touch = e.touches[0];
    const clientX = touch.clientX;
    const clientY = touch.clientY;

    // Auto Scroll Koordinatları İçin Global Kayıt
    window.lastClientX = clientX;
    window.lastClientY = clientY;

    updateDragGhost(clientX, clientY);
    updatePlaceholder(clientX, clientY);
    
    // AUTO SCROLL TETİKLE
    handleAutoScroll(clientY);
}

function handleTouchEnd() {
    clearTimeout(longPressTimer);
    if (draggedItem) finishDrag();
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

            const rect = item.getBoundingClientRect();
            dragShiftX = startX - rect.left;
            dragShiftY = startY - rect.top;

            let isDragStarted = false;

            const onMouseMove = (moveEvent) => {
                if (!draggedItem) return;
                const clientX = moveEvent.clientX;
                const clientY = moveEvent.clientY;

                if (!isDragStarted) {
                    const dx = Math.abs(clientX - startX);
                    const dy = Math.abs(clientY - startY);
                    if (dx > 5 || dy > 5) {
                        isDragStarted = true;
                        startDrag(draggedItem, clientX, clientY);
                    }
                }
                
                if (isDragStarted) {
                    // Global koordinatları güncelle
                    window.lastClientX = clientX;
                    window.lastClientY = clientY;

                    updateDragGhost(clientX, clientY);
                    updatePlaceholder(clientX, clientY);
                    
                    // AUTO SCROLL TETİKLE (Desktop için de geçerli)
                    handleAutoScroll(clientY);
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
    
    // --- HEIGHT LOCK ---
    const currentDocHeight = document.documentElement.scrollHeight;
    document.body.style.minHeight = currentDocHeight + 'px';

    // --- SCROLL COMPENSATION (SADECE MOBİL) ---
    if (isMobile) {
        const rectBefore = item.getBoundingClientRect();
        const originalTop = rectBefore.top;

        document.body.classList.add('hide-map-details'); // Gizle
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
    stopAutoScroll(); // Scroll durdur

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