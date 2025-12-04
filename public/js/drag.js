// ========== STYLES (Görsel Ayarlar) ==========
function injectDragStyles() {
    const styleId = 'tt-drag-styles';
    if (document.getElementById(styleId)) return;
    const css = `
        /* Sürüklenen Görsel Kopya (Ghost) */
        .drag-ghost {
            position: fixed !important;
            z-index: 999999 !important;
            pointer-events: none !important;
            background: #fff !important;
            box-shadow: 0 15px 40px rgba(0,0,0,0.3) !important;
            border: 2px solid #8a4af3 !important;
            border-radius: 12px !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            width: var(--ghost-width);
            height: var(--ghost-height);
            
            /* DÜZELTME: Performans için GPU kullanımı */
            will-change: transform; 
            left: 0 !important; 
            top: 0 !important;
            transition: none !important; 
        }

        /* Orijinal Öğe (Listede kalan) */
        .travel-item.dragging-source {
            opacity: 0.2 !important; /* Biraz daha şeffaf yaptım */
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
            transition: all 0.1s ease; /* Hafif animasyon */
        }

        body.dragging-active {
            user-select: none !important;
            -webkit-user-select: none !important;
            touch-action: none !important;
            cursor: grabbing !important;
        }
        
        /* İmleç stilleri */
        .travel-item { cursor: grab; }
        .travel-item:active { cursor: grabbing; }
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

    // Temiz bir başlangıç
    cleanupDrag();

    if (isMobile) {
        document.body.addEventListener('touchstart', handleTouchStart, { passive: false });
        document.body.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.body.addEventListener('touchend', handleTouchEnd);
    } else {
        setupDesktopListeners();
    }
    
    // *** KRİTİK DÜZELTME *** // Tarayıcının native sürüklemesini engelle (Resimlerin yapışmasını önler)
    document.addEventListener('dragstart', (e) => {
        if (e.target.closest('.travel-item')) {
            e.preventDefault();
        }
    });

    // Pencere odağı kaybedilirse sürüklemeyi güvenle bitir
    window.addEventListener('blur', () => {
        if (draggedItem) finishDrag();
    });
}

// ========== AGRESSIVE CLEANUP ==========
function cleanupDrag() {
    // 1. Ghost elementleri
    document.querySelectorAll('.drag-ghost').forEach(g => g.remove());

    // 2. Orijinal öğe stilleri
    document.querySelectorAll('.travel-item').forEach(item => {
        item.classList.remove('dragging-source');
        item.style.opacity = '';
    });

    // 3. Placeholder
    if (placeholder && placeholder.parentNode) placeholder.remove();
    placeholder = null;

    // 4. Değişkenler
    draggedItem = null;
    document.body.classList.remove('dragging-active');
    
    if (longPressTimer) clearTimeout(longPressTimer);
}

// ========== HELPER: GHOST OLUŞTURMA ==========
function createDragGhost(item, clientX, clientY) {
    // Eskileri temizle
    document.querySelectorAll('.drag-ghost').forEach(g => g.remove());

    const rect = item.getBoundingClientRect();
    
    // Mouse'un öğenin sol üst köşesine uzaklığı
    dragOffsetX = clientX - rect.left;
    dragOffsetY = clientY - rect.top;

    const ghost = item.cloneNode(true);
    ghost.classList.add('drag-ghost');
    
    // İçeriği hafiflet
    const content = ghost.querySelector('.content');
    if(content) content.style.display = 'none'; // Sadece görsel kalsın diye

    // Boyutları sabitle
    ghost.style.setProperty('--ghost-width', rect.width + 'px');
    ghost.style.setProperty('--ghost-height', rect.height + 'px');

    // DÜZELTME: İlk pozisyonu transform ile veriyoruz
    ghost.style.transform = `translate(${rect.left}px, ${rect.top}px) scale(1.05)`;

    document.body.appendChild(ghost);
}

function updateDragGhost(clientX, clientY) {
    const ghost = document.querySelector('.drag-ghost');
    if (!ghost) return;

    // DÜZELTME: GPU Performansı için Translate kullanımı
    const x = clientX - dragOffsetX;
    const y = clientY - dragOffsetY;
    
    ghost.style.transform = `translate(${x}px, ${y}px) scale(1.05)`;
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
    // Ghost'un altındaki elementi bul (pointer-events:none sayesinde deler geçer)
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

    e.preventDefault(); // Kaydırmayı engelle
    const touch = e.touches[0];
    updateDragGhost(touch.clientX, touch.clientY);
    updatePlaceholder(touch.clientX, touch.clientY);
}

function handleTouchEnd(e) {
    clearTimeout(longPressTimer);
    if (draggedItem) finishDrag();
}

// ========== DESKTOP HANDLERS ==========
function setupDesktopListeners() {
    // 1. Mouse Down (Başlatma hazırlığı)
    document.addEventListener('mousedown', function(e) {
        // Sadece sol tık (button 0)
        if (e.button !== 0) return;

        const item = e.target.closest('.travel-item');
        // Buttonlara veya resimlere tıklanmadıysa
        if (item && !e.target.closest('button')) {
            
            draggedItem = item; // Aday öğe
            startX = e.clientX;
            startY = e.clientY;
            let isDragStarted = false;

            const onMouseMove = (moveEvent) => {
                if (!draggedItem) return;

                const dx = Math.abs(moveEvent.clientX - startX);
                const dy = Math.abs(moveEvent.clientY - startY);

                // 5px eşik değeri (titremeyi önlemek için)
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
                
                if (isDragStarted) {
                    finishDrag();
                } else {
                    // Sadece tıklandı, sürüklenmedi
                    draggedItem = null;
                }
            };

            // Eventleri document'a bağla ki mouse hızlıca dışarı çıksa bile yakalasın
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
        
        // Yeni sırayı hesapla
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
    
    // Her şeyi temizle
    cleanupDrag();
}

// ========== DATA UPDATE ==========
function reorderCart(fromIndex, toIndex, fromDay, toDay) {
    try {
        const newCart = [...window.cart];
        const [movedItem] = newCart.splice(fromIndex, 1);
        movedItem.day = toDay;

        let targetDayItems = newCart.filter(i => i.day === toDay);
        
        // Hedef güne yerleştir
        targetDayItems.splice(toIndex, 0, movedItem);
        
        // Tüm listeyi yeniden oluştur (gün sıralamasını koruyarak)
        const allDays = new Set([...window.cart.map(i=>i.day), toDay]); 
        const sortedDays = [...allDays].sort((a,b)=>a-b);
        
        let finalCart = [];
        sortedDays.forEach(d => {
            if (d === toDay) finalCart = finalCart.concat(targetDayItems);
            else finalCart = finalCart.concat(newCart.filter(i => i.day === d));
        });

        window.cart = finalCart;

        // Varsa dış fonksiyonları tetikle
        if (typeof updateCart === "function") updateCart();
        if (typeof saveCurrentTripToStorage === "function") saveCurrentTripToStorage();

    } catch (e) {
        console.error("Reorder Error", e);
    }
}

// ========== EXPORTS & INIT ==========
window.initDragDropSystem = initDragDropSystem;
// Mainscript uyumluluğu
window.dragStart = function(){}; 
window.drop = function(){};
window.allowDrop = function(){};

if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDragDropSystem);
} else {
    initDragDropSystem();
}