// ========== STYLES (Görsel Ayarlar) ==========
function injectDragStyles() {
    const styleId = 'tt-drag-styles';
    if (document.getElementById(styleId)) return;
    const css = `
        /* --- GHOST WRAPPER (EN DIŞ KUTU) --- */
        .drag-ghost {
            position: fixed !important;
            z-index: 999999 !important;
            pointer-events: none !important;
            background: transparent !important;
            box-shadow: none !important;
            border: none !important;
            
            /* Genişlik JS'den gelir, yükseklik içeriğe göre OTOMATİK artar */
            width: var(--ghost-width) !important;
            height: auto !important; 
            
            margin: 0 !important;
            will-change: left, top;
            transition: none !important;
            /* Okların dışarı taşmasına izin ver */
            overflow: visible !important; 
            
            /* İçindekileri alt alta diz */
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        /* --- SADECE ANA ITEM --- */
        .drag-ghost .travel-item:not(.note-item) {
            position: relative !important;
            top: auto !important;
            left: auto !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            box-shadow: 0 10px 20px rgba(0,0,0,0.15) !important;
            opacity: 0.95;
            background: #fff; 
            border: 2px dashed #87cdb5 !important;
            border-radius: 12px;
            list-style: none !important;
            height: auto !important;
            min-height: auto !important;
            width: 100% !important; 
        }

        /* --- NOTLAR (Girintili Tasarımın Aynısı) --- */
        .drag-ghost .note-item {
            /* Senin CSS dosyanındaki %83 ve %12 kurallarını koruyoruz */
            width: 83% !important;
            left: 12% !important;
            position: relative !important;
            margin-top: 16px !important;
            margin-bottom: 16px !important;
            
            box-sizing: border-box !important;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1) !important;
            border: 2px dashed #ffd54f !important;
            background: #fff !important;
            opacity: 0.95;
            border-radius: 12px;
            z-index: 2;
        }

        /* --- OKLAR (WRAPPER'IN KENARLARINA YAPIŞIK) --- */
        .drag-arrow-visual {
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            width: 28px;
            height: 28px;
            background: #8a4af3;
            color: #ffffff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            z-index: 1000;
            opacity: 0.9;
        }
        
        /* Üst Ok: Wrapper'ın tepesinden 36px yukarıda */
        .drag-arrow-top { 
            top: -36px !important; 
            bottom: auto !important;
        }
        
        /* Alt Ok: Wrapper'ın dibinden 36px aşağıda */
        .drag-arrow-bottom { 
            bottom: -36px !important; 
            top: auto !important;
        }

        /* Placeholder */
        .insertion-placeholder {
            height: 6px !important;
            background: linear-gradient(90deg, #8a4af3, #b388ff); 
            margin: 8px 0;
            border-radius: 4px;
            box-shadow: 0 0 10px rgba(138, 74, 243, 0.5); 
            pointer-events: none;
            display: block !important;
        }

        .travel-item.dragging-source {
            filter: grayscale(100%);
            opacity: 0.3;
        }

        @media (max-width: 768px) {
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
            body.hide-map-details .trip-share-section,
            body.hide-map-details .expanded-map-panel
            {
                display: none !important;
            }
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

// --- AUTO SCROLL AYARLARI ---
let autoScrollSpeed = 0;
let autoScrollFrame = null;
let scrollContainer = null;
let isDragging = false; 

const SCROLL_THRESHOLD_TOP = 100; 
const SCROLL_THRESHOLD_BOTTOM = 160; 
const MAX_SCROLL_SPEED = 28;  

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
    stopAutoScroll();

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
        item.style.removeProperty('filter'); 
    });
    if (placeholder && placeholder.parentNode) placeholder.remove();
    placeholder = null;
    draggedItem = null;
    
    document.body.classList.remove('dragging-active');
    if (longPressTimer) clearTimeout(longPressTimer);
}

// ========== RENDER LOOP (Performanslı Çizim) ==========
function dragRenderLoop() {
    if (!isDragging || !draggedItem) return;

    // 1. Scroll Hesapla ve Uygula
    handleAutoScroll(lastClientY);

    // 2. Ghost Pozisyonunu Güncelle (yalnızca cart/sidebar alanında kalsın)
    const ghost = document.querySelector('.drag-ghost');
    if (ghost) {
        // Kart alanını bul
        const cart = document.querySelector('.sidebar, #cart, .cart-items');
        if (cart) {
            const cartRect = cart.getBoundingClientRect();
            const ghostRect = ghost.getBoundingClientRect();
            const width = ghostRect.width || ghost.offsetWidth;
            const height = ghostRect.height || ghost.offsetHeight;

            // Mouse pozisyonunu, cart alanı dışına çıkmayacak şekilde sınırla
            let newLeft = lastClientX - dragShiftX;
            let newTop = lastClientY - dragShiftY;

            // Sol sınır
            if (newLeft < cartRect.left) newLeft = cartRect.left;
            // Sağ sınır
            if (newLeft + width > cartRect.right) newLeft = cartRect.right - width;
            // Üst sınır
            if (newTop < cartRect.top) newTop = cartRect.top;
            // Alt sınır
            if (newTop + height > cartRect.bottom) newTop = cartRect.bottom - height;

            ghost.style.left = newLeft + 'px';
            ghost.style.top = newTop + 'px';
        } else {
            // Cart bulunamazsa mevcut davranış
            ghost.style.left = (lastClientX - dragShiftX) + 'px';
            ghost.style.top = (lastClientY - dragShiftY) + 'px';
        }
    }

    // 3. Placeholder Güncelle
    updatePlaceholder(lastClientX, lastClientY);

    requestAnimationFrame(dragRenderLoop);
}

// ========== SCROLL LOGIC ==========
function handleAutoScroll(clientY) {
    let containerHeight, containerTop;
    
    if (!scrollContainer || scrollContainer === window) {
        containerHeight = window.innerHeight;
        containerTop = 0;
    } else {
        const rect = scrollContainer.getBoundingClientRect();
        containerHeight = rect.height;
        containerTop = rect.top;
    }

    const relativeY = clientY - containerTop;

    if (relativeY < SCROLL_THRESHOLD_TOP) {
        const intensity = (SCROLL_THRESHOLD_TOP - relativeY) / SCROLL_THRESHOLD_TOP;
        autoScrollSpeed = -MAX_SCROLL_SPEED * intensity;
    } 
    else if (relativeY > (containerHeight - SCROLL_THRESHOLD_BOTTOM)) {
        const intensity = (relativeY - (containerHeight - SCROLL_THRESHOLD_BOTTOM)) / SCROLL_THRESHOLD_BOTTOM;
        autoScrollSpeed = (MAX_SCROLL_SPEED * intensity) * 1.2;
    } 
    else {
        autoScrollSpeed = 0;
    }

    if (Math.abs(autoScrollSpeed) > 0.5) {
        if (!scrollContainer || scrollContainer === window) {
            window.scrollBy(0, autoScrollSpeed);
        } else {
            scrollContainer.scrollTop += autoScrollSpeed;
        }
    }
}

function stopAutoScroll() {
    autoScrollSpeed = 0;
}

// ========== GHOST & PLACEHOLDER ==========
function createDragGhost(item, clientX, clientY) {
    document.querySelectorAll('.drag-ghost').forEach(g => g.remove());
    
    const rect = item.getBoundingClientRect();
    const isNote = item.classList.contains('note-item'); // KONTROL BURADA

    // Wrapper
    const ghostWrapper = document.createElement('div');
    ghostWrapper.classList.add('drag-ghost'); 
    
    ghostWrapper.style.width = rect.width + "px";
    ghostWrapper.style.left = rect.left + "px";
    ghostWrapper.style.top = rect.top + "px";
    ghostWrapper.style.setProperty('--ghost-width', rect.width + 'px');
    
    // --- OKLARI EKLE ---
    const upArrow = document.createElement('div');
    upArrow.className = 'drag-arrow-visual drag-arrow-top';
    upArrow.innerHTML = '▲'; 
    ghostWrapper.appendChild(upArrow);

    // --- 1. ANA ITEM (SÜRÜKLENEN) ---
    const mainClone = item.cloneNode(true);
    mainClone.removeAttribute('id');
    
    mainClone.style.marginTop = '0';
    mainClone.style.marginBottom = '0';
    mainClone.style.left = 'auto';
    mainClone.style.top = 'auto';
    mainClone.style.position = 'relative';
    // Eğer not ise genişliği boş bırak (CSS halletsin), değilse %100 yap
    mainClone.style.width = isNote ? '' : '100%'; 

    ghostWrapper.appendChild(mainClone);

    // --- 2. ALTTAKİLERİ TOPLA (SADECE SÜRÜKLENEN BİR NOT DEĞİLSE) ---
    // Eğer biz zaten bir not sürüklüyorsak, altımızdaki notlar bize bağlı değildir.
    if (!isNote) {
        let nextSibling = item.nextElementSibling;
        
        while (nextSibling && nextSibling.classList.contains('note-item')) {
            const noteClone = nextSibling.cloneNode(true);
            noteClone.removeAttribute('id');
            
            noteClone.style.marginTop = ''; 
            noteClone.style.marginBottom = '';
            noteClone.style.left = ''; 
            noteClone.style.top = '';
            noteClone.style.position = ''; 
            noteClone.style.width = ''; 

            ghostWrapper.appendChild(noteClone);
            
            // Görsel olarak soluklaştır
            nextSibling.classList.add('dragging-source');
            nextSibling = nextSibling.nextElementSibling;
        }
    }

    // Alt Ok
    const downArrow = document.createElement('div');
    downArrow.className = 'drag-arrow-visual drag-arrow-bottom';
    downArrow.innerHTML = '▼'; 
    ghostWrapper.appendChild(downArrow);

    document.body.appendChild(ghostWrapper);
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

function updatePlaceholder(clientX, clientY) {
    const elementBelow = document.elementFromPoint(clientX, clientY);
    if (!elementBelow) return;

    const dropZone = elementBelow.closest('.day-list');
    if (!dropZone) return;

    if (!placeholder) {
        placeholder = document.createElement('div');
        placeholder.className = 'insertion-placeholder';
    }

    // Placeholder genişlik/margin ayarları (Dragged item'dan kopyala)
    if (draggedItem && placeholder) {
        const draggedRect = draggedItem.getBoundingClientRect();
        placeholder.style.width = draggedRect.width + "px";
        const style = getComputedStyle(draggedItem);
        placeholder.style.marginLeft = style.marginLeft;
        placeholder.style.marginRight = style.marginRight;
        
        // Varsayılan olarak göster (aşağıdaki logic gerekirse gizleyecek)
        placeholder.style.display = ''; 
        
        placeholder.style.boxSizing = style.boxSizing || 'border-box';
        placeholder.style.maxWidth = draggedRect.width + "px";
    }

    const allItems = Array.from(dropZone.querySelectorAll('.travel-item:not(.dragging-source)'));
    const isNote = draggedItem && draggedItem.classList.contains('note-item');

    // 1. Boş Gün Kontrolü
    if (allItems.length === 0) {
        // Eğer Note ise ve gün boşsa ekletme (Note'lar itemsız duramaz)
        if (isNote) {
            if (placeholder.parentNode) placeholder.remove();
            return; 
        }
        dropZone.insertBefore(placeholder, dropZone.firstChild);
        // Boş güne eklerken gizleme yapmaya gerek yok
        return;
    }

    // 2. Hedef Konumu Bul
    const afterElement = getDragAfterElement(dropZone, clientY);

    // --- KURAL: Note en başa gelemez ---
    if (isNote && afterElement === allItems[0]) {
        if (allItems[0].nextSibling) {
            dropZone.insertBefore(placeholder, allItems[0].nextSibling);
        } else {
            dropZone.appendChild(placeholder);
        }
    } 
    else if (afterElement == null) {
        // Sona ekle
        const lastItem = allItems[allItems.length - 1];
        if (lastItem.nextSibling) {
            dropZone.insertBefore(placeholder, lastItem.nextSibling);
        } else {
            dropZone.appendChild(placeholder);
        }
    } else {
        // Araya ekle
        dropZone.insertBefore(placeholder, afterElement);
    }

    // ============================================================
    // --- GEREKSİZ GÖRSELİ GİZLEME (FIX) ---
    // Eğer placeholder, sürüklenen öğenin tam üstüne veya tam altına
    // denk geliyorsa (yani pozisyon değişmeyecekse) GİZLE.
    // ============================================================
    
    // draggedItem DOM'da hala duruyor (sadece soluk). 
    // Placeholder'ın komşularına bakarak kontrol ediyoruz.
    
    if (placeholder.nextElementSibling === draggedItem || 
        placeholder.previousElementSibling === draggedItem) {
        placeholder.style.display = 'none';
    }
}

// ========== HANDLERS ==========
function handleTouchStart(e) {
    const item = e.target.closest('.travel-item');
    if (!item || e.target.closest('button') || e.target.closest('.map-content-wrap')) return;
    if (e.touches.length > 1) return;

    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    
    const rect = item.getBoundingClientRect();
    dragShiftX = startX - rect.left;
    dragShiftY = startY - rect.top;
    
    lastClientX = startX;
    lastClientY = startY;
    
    longPressTimer = setTimeout(() => startDrag(item, startX, startY), LONG_PRESS_MS);
}

function handleTouchMove(e) {
    lastClientX = e.touches[0].clientX;
    lastClientY = e.touches[0].clientY;

    if (!isDragging) {
        const dx = Math.abs(lastClientX - startX);
        const dy = Math.abs(lastClientY - startY);
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
            
            const rect = item.getBoundingClientRect();
            dragShiftX = startX - rect.left;
            dragShiftY = startY - rect.top;
            
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
    item.classList.add('dragging-source'); // <-- GRYSCALE BAŞLANGIÇ
    
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
        let newCart = [...window.cart];
        
        if (!newCart[fromIndex]) return;

        const mainItem = newCart[fromIndex];
        const isNote = (mainItem.category === 'Note'); // KONTROL BURADA
        const itemsToMove = [mainItem];
        
        // Sadece sürüklenen eleman NOT DEĞİLSE altındakileri topla
        if (!isNote) {
            let checkIndex = fromIndex + 1;
            while (checkIndex < newCart.length) {
                const nextItem = newCart[checkIndex];
                // Aynı günde olan ardışık notları al
                if (nextItem.category === 'Note' && nextItem.day === fromDay) {
                    itemsToMove.push(nextItem);
                    checkIndex++;
                } else {
                    break;
                }
            }
        }

        // 2. Silme
        newCart = newCart.filter(item => !itemsToMove.includes(item));

        // 3. Güncelleme
        if (fromDay !== toDay) {
            itemsToMove.forEach(item => item.day = toDay);
        }

        // 4. Ekleme
        const targetDayItems = newCart.filter(i => i.day === toDay);
        targetDayItems.splice(toIndex, 0, ...itemsToMove);

        // 5. Birleştirme
        const allDays = new Set([...window.cart.map(i => i.day), toDay, fromDay]);
        const sortedDays = [...allDays].sort((a, b) => a - b);
        
        let finalCart = [];
        sortedDays.forEach(d => {
            if (d === toDay) {
                finalCart = finalCart.concat(targetDayItems);
            } else {
                finalCart = finalCart.concat(newCart.filter(i => i.day === d));
            }
        });

        window.cart = finalCart;

        // === KAYDET ===
        if (typeof saveCurrentTripToStorage === "function") {
            saveCurrentTripToStorage();
        } else {
            localStorage.setItem('cart', JSON.stringify(window.cart));
        }

        // === RENDER ===
        if (typeof updateCart === "function") updateCart();

        // Harita güncellemesi
        setTimeout(() => {
            if (typeof calculateAllRoutes === "function") calculateAllRoutes();
            else if (typeof renderMapForDay === "function") {
                renderMapForDay(toDay);
                if (fromDay !== toDay) renderMapForDay(fromDay);
            }
        }, 50);

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