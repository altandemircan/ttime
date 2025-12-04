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

        /* GİZLENECEK ELEMANLAR (HEM DESKTOP HEM MOBİL) */
        /* display: none kullanarak listeyi sıkıştırıyoruz ki uzun mesafeler (1. gün -> 3. gün) kısalsın */
        body.hide-map-details .route-controls-bar,
        body.hide-map-details .tt-travel-mode-set,
        body.hide-map-details [id^="map-bottom-controls-wrapper"], 
        body.hide-map-details .add-more-btn {
            display: none !important;
        }

        .route-controls-bar, .map-content-wrap, .tt-travel-mode-set {
            pointer-events: auto;
        }
        
        body.dragging-active {
            user-select: none !important;
            cursor: grabbing !important;
            /* Mobilde tarayıcının kendi scroll davranışını durdur, biz yöneteceğiz */
            overflow-anchor: none !important; 
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
    // --- SCROLL DÜZELTME (GERİ YÜKLEME) ---
    // Haritalar geri geldiğinde (display:block) sayfa uzayacak.
    // Kullanıcının baktığı yerin kaymaması için scroll'u tekrar ayarlıyoruz.
    if (document.body.classList.contains('hide-map-details')) {
        const currentItem = document.querySelector('.travel-item.dragging-source');
        if (currentItem) {
            // Şu an (haritalar gizliyken) öğe nerede?
            const rectBefore = currentItem.getBoundingClientRect();
            
            // Gizlemeyi kaldır (Harita geri gelsin, liste uzasın)
            document.body.classList.remove('hide-map-details');
            
            // Şimdi öğe nerede? (Muhtemelen çok daha aşağı indi)
            const rectAfter = currentItem.getBoundingClientRect();
            
            // Farkı hesapla (Örn: 500px aşağı indi)
            const diff = rectAfter.top - rectBefore.top;
            
            // Sayfayı o kadar aşağı kaydır ki kullanıcı aynı hizayı görsün
            if (diff !== 0) window.scrollBy(0, diff);
        } else {
            document.body.classList.remove('hide-map-details');
        }
    }

    document.body.style.minHeight = ''; // Height lock kaldır
    document.body.style.overflowAnchor = ''; // Tarayıcı ayarını sıfırla

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
    e.preventDefault(); // Scrollu engelle
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
                    startDrag(draggedItem, moveEvent.clientX, moveEvent.clientY);
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

// ========== START DRAG (THE SCROLL FIX) ==========
function startDrag(item, x, y) {
    draggedItem = item;
    sourceIndex = parseInt(item.dataset.index);
    if (navigator.vibrate) navigator.vibrate(50);
    
    // --- 1. HESAPLAMA: PARMAK ÖĞENİN NERESİNDE? ---
    // Öğe şu an sayfada nerede? (Sayfa başından itibaren absolute değer)
    const rectBefore = item.getBoundingClientRect();
    const itemAbsoluteTopBefore = window.scrollY + rectBefore.top;
    
    // Parmak öğenin üstünden kaç piksel aşağıda? (Bu bizim korumak istediğimiz offset)
    const touchOffsetFromItemTop = y - rectBefore.top;

    // Sayfa boyunu kilitle (Browser zıplamasın diye)
    const currentDocHeight = document.documentElement.scrollHeight;
    document.body.style.minHeight = currentDocHeight + 'px';

    // --- 2. GİZLEME VE GHOST ---
    createDragGhost(item, x, y);
    document.body.classList.add('hide-map-details'); // Şimdi gizle!
    item.classList.add('dragging-source');
    document.body.classList.add('dragging-active');

    // --- 3. SCROLL TELAFİSİ (THE FIX) ---
    // Tarayıcı reflow yapsın
    void document.body.offsetHeight;

    // Gizleme sonrası öğenin yeni yerini bul
    // Not: getBoundingClientRect() viewport'a göredir. window.scrollY ile toplayıp sayfa koordinatını buluyoruz.
    const rectAfter = item.getBoundingClientRect();
    const itemAbsoluteTopAfter = window.scrollY + rectAfter.top;

    // HEDEF: Öğenin tepesi, parmağın (y) olduğu yerin (offset) kadar yukarısında olmalı.
    // Yani görsel olarak parmak ile öğe hizası bozulmamalı.
    // Scroll nereye gitmeli? -> (Yeni Öğe Sayfa Yeri) - (Parmak Ekran Yeri - Offset) değil.
    // Basit mantık: Öğe yukarı kaydıysa, biz de scroll'u yukarı çekmeliyiz.
    
    // Eski Top: 1500px. Yeni Top (haritalar gidince): 500px.
    // Aradaki fark: 1000px yukarı kaydı.
    // O zaman Scroll'u da 1000px yukarı (azaltarak) çekmeliyiz ki içerik aşağı insin? 
    // Hayır, scroll azalırsa viewport yukarı çıkar, içerik aşağı inmiş gibi olur.
    
    // En garantisi: Elementin yeni top noktası ile parmak arasındaki farkı korumak.
    // Şu anki Item Yeri (Viewport): rectAfter.top
    // Olması Gereken Item Yeri (Viewport): y - touchOffsetFromItemTop
    // Fark: rectAfter.top - (y - touchOffsetFromItemTop)
    
    const targetViewportTop = y - touchOffsetFromItemTop; // Öğe burada görünmeli
    const currentViewportTop = rectAfter.top; // Ama burada görünüyor (muhtemelen negatif veya çok yukarıda)
    
    const scrollCorrection = currentViewportTop - targetViewportTop;
    
    // Scroll'u düzelt
    if (scrollCorrection !== 0) {
        window.scrollBy(0, scrollCorrection);
    }
}

// ========== DUPLICATE CHECK & FINISH ==========
function finishDrag() {
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