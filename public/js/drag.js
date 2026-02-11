// ========== STYLES (Görsel Ayarlar) ==========
function injectDragStyles() {
    const styleId = 'tt-drag-styles';
    if (document.getElementById(styleId)) return;
    const css = `
        /* --- GHOST WRAPPER --- */
        .drag-ghost {
            position: fixed !important;
            z-index: 999999 !important;
            pointer-events: none !important;
            background: transparent !important;
            box-shadow: none !important;
            border: none !important;
            width: var(--ghost-width) !important;
            height: auto !important; 
            margin: 0 !important;
            will-change: left, top;
            transition: none !important;
            overflow: visible !important; 
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

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

        .drag-ghost .note-item {
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
        .drag-arrow-top { top: -36px !important; bottom: auto !important; }
        .drag-arrow-bottom { bottom: -36px !important; top: auto !important; }

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

        /* ============================================================ */
        /* === SÜRÜKLEME ANINDA GİZLENECEKLER === */
        /* ============================================================ */
        
        /* 1. FOTOĞRAFLAR (HEM MOBİL HEM DESKTOP) */
        /* İsteğin üzerine: Fotoğraflar kesinlikle gizlensin */
        body.dragging-active .day-collage,
        body.hide-map-details .day-collage {
            display: none !important;
        }

        /* 2. BUTONLAR VE KALABALIK (MOBİLDE) */
        /* Harita (.expanded-map-panel) ve AI (.ai-info-section) BURADAN ÇIKARILDI. */
        /* Onlar artık görünür kalacak. Sadece butonları gizliyoruz. */
        @media (max-width: 768px) {
            body.hide-map-details .add-more-btn,
            body.hide-map-details .add-new-day-btn,
            body.hide-map-details #add-new-day-button,
            body.hide-map-details .add-new-day-separator, 
            body.hide-map-details .add-to-calendar-btn,
            body.hide-map-details #newchat,
            body.hide-map-details .trip-share-section,
            body.hide-map-details .date-range,
            /* YENİ EKLENENLER: My Places ve Add Note */
            body.hide-map-details .add-favorite-place-btn,
            body.hide-map-details .add-custom-note-btn
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

    // Placeholder yoksa oluştur
    if (!placeholder) {
        placeholder = document.createElement('div');
        placeholder.className = 'insertion-placeholder';
    }

    // Görsel ayarlar
    if (draggedItem && placeholder) {
        const draggedRect = draggedItem.getBoundingClientRect();
        placeholder.style.width = draggedRect.width + "px";
        
        const style = getComputedStyle(draggedItem);
        placeholder.style.marginLeft = style.marginLeft;
        placeholder.style.marginRight = style.marginRight;
        placeholder.style.display = 'block';
        placeholder.style.boxSizing = style.boxSizing || 'border-box';
        placeholder.style.maxWidth = draggedRect.width + "px";
    }

    const allItems = Array.from(dropZone.querySelectorAll('.travel-item:not(.dragging-source)'));
    const isDraggingNote = draggedItem && draggedItem.classList.contains('note-item');

    // 1. BOŞ GÜN KONTROLÜ
    if (allItems.length === 0) {
        if (isDraggingNote) {
            if (placeholder.parentNode) placeholder.remove();
            return;
        }
        dropZone.insertBefore(placeholder, dropZone.firstChild);
        return;
    }

    // 2. HEDEF KONUMU BUL
    let afterElement = getDragAfterElement(dropZone, clientY);

    // --- KURAL: ITEM, NOTLARIN ARASINA GİREMEZ ---
    if (!isDraggingNote) {
        while (afterElement && afterElement.classList.contains('note-item')) {
            afterElement = afterElement.nextElementSibling;
        }
    }

    // --- KURAL: Note en başa gelemez ---
    if (isDraggingNote && afterElement === allItems[0]) {
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
    } 
    else {
        // Araya ekle
        dropZone.insertBefore(placeholder, afterElement);
    }

    // ============================================================
    // --- KOMŞU KONTROLÜ (SEPARATORLARI ATLAYARAK) ---
    // ============================================================
    // Helper: Bir eleman bizim sürüklendiğimiz kaynak grubun parçası mı?
    // Eğer sürüklüyorsak .dragging-source ekledik. Placeholder, dragging-source'un hemen altına veya üstüne gelmemeli.
    // Ancak DOM'da dragging-source gizlenmiş olabilir, görsel olarak.
    // Mantık: Placeholder'ın previousSibling veya nextSibling'i "dragging-source" ise, yer değişimi yok demektir.
    // Ancak arada separator divler olabilir (.distance-separator). Onları atlayarak bakmalıyız.

    let prevEl = placeholder.previousElementSibling;
    while (prevEl && (prevEl.classList.contains('distance-separator') || prevEl.classList.contains('auto-copy-info'))) {
        prevEl = prevEl.previousElementSibling;
    }

    let nextEl = placeholder.nextElementSibling;
    while (nextEl && (nextEl.classList.contains('distance-separator') || nextEl.classList.contains('auto-copy-info'))) {
        nextEl = nextEl.nextElementSibling;
    }

    // Eğer placeholder, kendi orijinal yerindeyse (yani üstünde veya altında orijinal öğe varsa)
    // Görsel olarak gizle (gereksiz titreşimi önler)
    /* Bu kontrol biraz riskli, çünkü sürüklenen öğe zaten 'dragging-source' classına sahip.
       Eğer placeholder'ın hemen yanıbaşında 'dragging-source' varsa, demek ki aynı yerdeyiz.
    */
    if ((prevEl && prevEl.classList.contains('dragging-source')) || 
        (nextEl && nextEl.classList.contains('dragging-source'))) {
        // Aynı yerdesin, placeholder'ı gösterme veya soluklaştır
        placeholder.style.opacity = '0.3';
    } else {
        placeholder.style.opacity = '1';
    }
}

// ========== TOUCH HANDLERS (Mobile) ==========
function handleTouchStart(e) {
    const handle = e.target.closest('.drag-icon');
    if (!handle) return;

    const item = handle.closest('.travel-item');
    if (!item) return;

    // Sadece header'da basılı tutulursa (opsiyonel, şu an ikon zorunlu zaten)
    e.preventDefault();
    
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    
    draggedItem = item;
    
    // Timer başlat
    longPressTimer = setTimeout(() => {
        startDrag(e.touches[0]);
    }, LONG_PRESS_MS);
}

function handleTouchMove(e) {
    if (!draggedItem) return;

    if (!isDragging) {
        // Henüz drag başlamadı, parmak hareket ettiyse iptal et
        const moveX = Math.abs(e.touches[0].clientX - startX);
        const moveY = Math.abs(e.touches[0].clientY - startY);
        if (moveX > 10 || moveY > 10) {
            clearTimeout(longPressTimer);
            draggedItem = null;
        }
    } else {
        // Drag aktif
        e.preventDefault(); 
        lastClientX = e.touches[0].clientX;
        lastClientY = e.touches[0].clientY;
    }
}

function handleTouchEnd(e) {
    if (longPressTimer) clearTimeout(longPressTimer);
    if (isDragging) {
        finishDrag();
    }
    draggedItem = null;
    isDragging = false;
}

// ========== DESKTOP LISTENERS ==========
function setupDesktopListeners() {
    document.addEventListener('mousedown', (e) => {
        const handle = e.target.closest('.drag-icon');
        if (!handle) return;
        const item = handle.closest('.travel-item');
        if (!item) return;

        e.preventDefault();
        draggedItem = item;
        startDrag(e); // Desktopta bekleme yok
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging || !draggedItem) return;
        e.preventDefault();
        lastClientX = e.clientX;
        lastClientY = e.clientY;
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) finishDrag();
    });
}

// ========== START DRAG ==========
function startDrag(inputEvent) {
    if (!draggedItem) return;
    
    isDragging = true;
    document.body.classList.add('dragging-active');
    
    // Scroll parent bul
    scrollContainer = getScrollParent(draggedItem);

    // Kaynak index'i sakla
    sourceIndex = parseInt(draggedItem.dataset.index);

    // Body'ye class ekle (Diğerlerini gizlemek için)
    document.body.classList.add('hide-map-details');

    // Ghost oluştur
    const rect = draggedItem.getBoundingClientRect();
    dragShiftX = inputEvent.clientX - rect.left;
    dragShiftY = inputEvent.clientY - rect.top;
    
    createDragGhost(draggedItem, inputEvent.clientX, inputEvent.clientY);

    // Orijinal öğeyi soluklaştır
    draggedItem.classList.add('dragging-source');
    
    // Eğer place ise, altındaki notları da soluklaştır
    if (!draggedItem.classList.contains('note-item')) {
        let next = draggedItem.nextElementSibling;
        while(next && next.classList.contains('note-item')) {
            next.classList.add('dragging-source');
            next = next.nextElementSibling;
        }
    }

    // İlk koordinatlar
    lastClientX = inputEvent.clientX;
    lastClientY = inputEvent.clientY;

    // Loop başlat
    dragRenderLoop();

    // Titreşim (Mobil)
    if (navigator.vibrate) navigator.vibrate(50);
}

// ========== FINISH DRAG ==========
function finishDrag() {
    if (!isDragging || !draggedItem) {
        cleanupDrag();
        return;
    }

    // Hedef günü ve sırayı bul
    if (placeholder && placeholder.parentNode) {
        const dropDayList = placeholder.parentNode;
        const targetDay = parseInt(dropDayList.dataset.day);
        
        // Sıralama
        const allItemsInTarget = Array.from(dropDayList.querySelectorAll('.travel-item:not(.dragging-source)'));
        let targetIndex = allItemsInTarget.indexOf(placeholder.nextElementSibling);
        
        if (targetIndex === -1) targetIndex = allItemsInTarget.length;

        // Kendi günümüzde miyiz?
        const sourceDay = parseInt(draggedItem.closest('.day-list').dataset.day);
        
        // İşlemi yap
        reorderItems(sourceDay, targetDay, draggedItem, targetIndex);
    }

    cleanupDrag();
}

// ========== REORDER LOGIC (DATA) ==========
function reorderItems(fromDay, toDay, itemElement, targetIndex) {
    try {
        const fromIndex = parseInt(itemElement.dataset.index);
        
        // Eğer aynı gün ve aynı yer ise iptal (Görsel titreme olmasın diye yapılan check)
        // Ancak bu mantık biraz karmaşık, basitçe array manipülasyonuna geçelim.

        // 1. Taşınacakları belirle (Item + Altındaki Notlar)
        let itemsToMove = [];
        // window.cart'tan bul
        let sourceCartIndex = -1;
        // Global cart içindeki gerçek indexi bulmamız lazım.
        // itemElement.dataset.index window.cart indexidir.
        
        // GÜVENLİK: DOM indexi ile Cart indexi senkron olmayabilir.
        // En doğrusu: window.cart'ı filtreleyip, o günün itemlarını bulup, oradan index almak.
        
        // Basit Yöntem: dataset.index'e güveniyoruz (render sırasında güncelleniyor)
        // Ancak, notları da peşine takmamız lazım.
        
        const mainItem = window.cart[fromIndex];
        if (!mainItem) return; // Hata

        itemsToMove.push(mainItem);
        
        // Altındaki notları bul (Cart içinde, mainItem'dan sonra gelenler)
        // Notlar, mainItem ile aynı günde ve araya başka 'Place' girmemiş olmalı.
        let lookAhead = fromIndex + 1;
        while (lookAhead < window.cart.length) {
            const candidate = window.cart[lookAhead];
            if (candidate.day === fromDay && candidate.category === 'Note') {
                itemsToMove.push(candidate);
                lookAhead++;
            } else {
                break;
            }
        }

        // 2. Cart'tan çıkar
        // Dikkat: Splice yaparken indexler kayar. O yüzden tersten veya dikkatli silmeliyiz.
        // itemsToMove zaten sıralı (blok halinde).
        // fromIndex'ten başlayarak itemsToMove.length kadar sil.
        
        const removedItems = window.cart.splice(fromIndex, itemsToMove.length);
        
        // Eğer gün değiştiyse, itemların gününü güncelle
        if (fromDay !== toDay) {
            removedItems.forEach(it => it.day = toDay);
        }

        // 3. Hedef Konumu Bul (Global Cart Index)
        // targetIndex: o günün listesindeki (DOM) sıra numarası.
        // Bunu global cart indexine çevirmeliyiz.
        
        const targetDayItems = window.cart.filter(i => i.day === toDay);
        
        let insertGlobalIndex = 0;
        
        if (targetDayItems.length === 0) {
            // Gün boşsa, diğer günlerin sonuna veya başına... 
            // Basitçe: O günden önceki günlerin item sayısını bul.
            const prevItems = window.cart.filter(i => i.day < toDay);
            insertGlobalIndex = prevItems.length; 
        } 
        else if (targetIndex >= targetDayItems.length) {
            // O günün sonuna ekle
            // O günün son itemını bul, onun global indexini al + 1
            const lastItem = targetDayItems[targetDayItems.length - 1];
            insertGlobalIndex = window.cart.indexOf(lastItem) + 1;
        } 
        else {
            // Araya ekle
            const targetItem = targetDayItems[targetIndex];
            insertGlobalIndex = window.cart.indexOf(targetItem);
        }

        // 4. Araya Ekle
        window.cart.splice(insertGlobalIndex, 0, ...removedItems);

        // 5. Kaydet ve Çiz
        if (typeof saveCurrentTripToStorage === "function") {
            saveCurrentTripToStorage();
        } else {
            localStorage.setItem('cart', JSON.stringify(window.cart));
        }

        if (typeof updateCart === "function") updateCart();

        // Harita güncellemesi
        setTimeout(() => {
            if (typeof renderRouteForDay === "function") {
                renderRouteForDay(toDay);
                if (fromDay !== toDay) renderRouteForDay(fromDay);
            }
        }, 50);

    } catch (e) {
        console.error("Reorder error:", e);
    }
}