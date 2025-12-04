// ========== STYLES (Görsel Ayarlar) ==========
function injectDragStyles() {
    const styleId = 'tt-drag-styles';
    if (document.getElementById(styleId)) return;
    const css = `
        .drag-ghost {
            position: fixed !important;
            z-index: 999999 !important;
            pointer-events: none !important;
            background: #fff !important;
            box-shadow: 0 15px 40px rgba(0,0,0,0.3) !important;
            border: 2px solid #8a4af3 !important;
            border-radius: 12px !important;
            width: var(--ghost-width);
            height: var(--ghost-height);
            will-change: transform; 
            left: 0 !important; 
            top: 0 !important;
            transition: none !important; 
        }
        .travel-item.dragging-source {
            opacity: 0.2 !important;
            filter: grayscale(100%);
            border: 2px dashed #ccc;
        }
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
        .travel-item { cursor: grab; }
        .travel-item:active { cursor: grabbing; }
    `;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = css;
    document.head.appendChild(style);
}

// ========== GLOBAL VARIABLES ==========
// window.cart'a dokunmuyoruz, varsa kullanıyoruz
if (!window.cart) window.cart = [];

let draggedItem = null;      
let placeholder = null;
let sourceIndex = -1;
let isMobile = false;

let dragOffsetX, dragOffsetY;
let longPressTimer;
const LONG_PRESS_MS = 200;
let startX = 0, startY = 0;

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
    
    // NATIVE DRAG ENGELLEME (YAPIŞMA SORUNU ÇÖZÜMÜ)
    // Sadece .travel-item içindeyse engelliyoruz, haritayı bozmuyoruz
    document.addEventListener('dragstart', (e) => {
        if (e.target.closest('.travel-item')) {
            e.preventDefault();
        }
    });

    // Pencere odağı kaybedilirse (Alt-Tab) sürüklemeyi bitir
    window.addEventListener('blur', () => {
        if (draggedItem) finishDrag();
    });
}

// ========== CLEANUP ==========
function cleanupDrag() {
    document.querySelectorAll('.drag-ghost').forEach(g => g.remove());
    document.querySelectorAll('.travel-item').forEach(item => {
        item.classList.remove('dragging-source');
        item.style.opacity = '';
    });
    if (placeholder && placeholder.parentNode) placeholder.remove();
    placeholder = null;
    draggedItem = null;
    document.body.classList.remove('dragging-active');
    if (longPressTimer) clearTimeout(longPressTimer);
}

// ========== GHOST LOGIC ==========
function createDragGhost(item, clientX, clientY) {
    document.querySelectorAll('.drag-ghost').forEach(g => g.remove());
    const rect = item.getBoundingClientRect();
    dragOffsetX = clientX - rect.left;
    dragOffsetY = clientY - rect.top;

    const ghost = item.cloneNode(true);
    ghost.classList.add('drag-ghost');
    const content = ghost.querySelector('.content');
    if(content) content.style.display = 'none';

    ghost.style.setProperty('--ghost-width', rect.width + 'px');
    ghost.style.setProperty('--ghost-height', rect.height + 'px');
    ghost.style.transform = `translate(${rect.left}px, ${rect.top}px) scale(1.05)`;
    
    document.body.appendChild(ghost);
}

function updateDragGhost(clientX, clientY) {
    const ghost = document.querySelector('.drag-ghost');
    if (!ghost) return;
    const x = clientX - dragOffsetX;
    const y = clientY - dragOffsetY;
    ghost.style.transform = `translate(${x}px, ${y}px) scale(1.05)`;
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
    const addBtn = dropZone.querySelector('.add-more-btn');
    if (afterElement == null) {
        if (addBtn) dropZone.insertBefore(placeholder, addBtn);
        else dropZone.appendChild(placeholder);
    } else {
        dropZone.insertBefore(placeholder, afterElement);
    }
}

// ========== HANDLERS ==========
function handleTouchStart(e) {
    const item = e.target.closest('.travel-item');
    if (!item || e.target.closest('button') || e.target.closest('.visual img')) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    longPressTimer = setTimeout(() => startDrag(item, startX, startY), LONG_PRESS_MS);
}

function handleTouchMove(e) {
    if (!draggedItem) {
        const dx = Math.abs(e.touches[0].clientX - startX);
        const dy = Math.abs(e.touches[0].clientY - startY);
        if (dx > 10 || dy > 10) clearTimeout(longPressTimer);
        return;
    }
    e.preventDefault();
    updateDragGhost(e.touches[0].clientX, e.touches[0].clientY);
    updatePlaceholder(e.touches[0].clientX, e.touches[0].clientY);
}

function handleTouchEnd() {
    clearTimeout(longPressTimer);
    if (draggedItem) finishDrag();
}

function setupDesktopListeners() {
    document.addEventListener('mousedown', function(e) {
        if (e.button !== 0) return;
        const item = e.target.closest('.travel-item');
        
        // DÜZELTME: Eğer tıklanan yer bir harita kontrolü ise (Leaflet butonları vs) karışma
        if (e.target.closest('.leaflet-control') || e.target.closest('.mapboxgl-ctrl')) return;

        if (item && !e.target.closest('button')) {
            draggedItem = item;
            startX = e.clientX;
            startY = e.clientY;
            let isDragStarted = false;

            const onMouseMove = (moveEvent) => {
                if (!draggedItem) return;
                const dx = Math.abs(moveEvent.clientX - startX);
                const dy = Math.abs(moveEvent.clientY - startY);
                if (!isDragStarted && (dx > 5 || dy > 5)) {
                    isDragStarted = true;
                    startDrag(draggedItem, startX, startY);
                }
                if (isDragStarted) {
                    updateDragGhost(moveEvent.clientX, moveEvent.clientY);
                    updatePlaceholder(moveEvent.clientX, moveEvent.clientY);
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
    createDragGhost(item, x, y);
    item.classList.add('dragging-source');
    document.body.classList.add('dragging-active');
}

function finishDrag() {
    if (placeholder && placeholder.parentNode) {
        const dropList = placeholder.parentNode;
        const toDay = parseInt(dropList.dataset.day);
        
        // Yeni sıra hesabı
        let newIndex = 0;
        Array.from(dropList.children).forEach(child => {
            if (child === placeholder) return; // döngüyü kırma, sadece geç
            if (child === placeholder.nextSibling) return; // placeholder'ın kendisi sayılmaz
            
            // Eğer placeholder'dan önceyse ve item ise say
            if (child.classList.contains('travel-item') && !child.classList.contains('dragging-source')) {
                 // Placeholder'ın yerine bakarak index belirleme
                 if (placeholder.compareDocumentPosition(child) & Node.DOCUMENT_POSITION_PRECEDING) {
                     newIndex++;
                 }
            }
        });
        
        // Daha basit index hesabı: Placeholder listenin kaçıncı 'travel-item'ı?
        let realIndex = 0;
        const siblings = dropList.querySelectorAll('.travel-item:not(.dragging-source), .insertion-placeholder');
        for(let i=0; i<siblings.length; i++) {
            if(siblings[i].classList.contains('insertion-placeholder')) {
                realIndex = i;
                break;
            }
        }

        const fromIndex = sourceIndex;
        // DÜZELTME: Veri kontrolü yapıyoruz
        if (window.cart && window.cart[fromIndex]) {
            reorderCart(fromIndex, realIndex, window.cart[fromIndex].day, toDay);
        }
    }
    cleanupDrag();
}

function reorderCart(fromIndex, toIndex, fromDay, toDay) {
    try {
        const newCart = [...window.cart];
        
        // Güvenlik kontrolü
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

        // Harita fonksiyonunu tetikle
        if (typeof updateCart === "function") {
            updateCart();
        } else {
            console.warn("updateCart fonksiyonu bulunamadı, harita güncellenmedi.");
        }
        
        if (typeof saveCurrentTripToStorage === "function") saveCurrentTripToStorage();

    } catch (e) {
        console.error("Sıralama hatası:", e);
    }
}

// ========== BAŞLATMA ==========
window.initDragDropSystem = initDragDropSystem;

// DİKKAT: Eski kodundaki window.dragStart vs fonksiyonlarını EZMİYORUZ.
// Onları sildim.

if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDragDropSystem);
} else {
    initDragDropSystem();
}