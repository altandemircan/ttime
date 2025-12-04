// ========== STYLES (Görsel Ayarlar) ==========
function injectDragStyles() {
    const styleId = 'tt-drag-styles';
    if (document.getElementById(styleId)) return;
    const css = `
        /* GHOST */
        .drag-ghost {
            position: fixed !important;
            z-index: 999999 !important;
            pointer-events: none !important;
            background: rgba(255, 255, 255, 0.96) !important;
            border: 2px dashed #87cdb5 !important; 
            box-shadow: 0 15px 40px rgba(0,0,0,0.4) !important;
            border-radius: 12px !important;
            width: var(--ghost-width);
            height: var(--ghost-height);
            margin: 0 !important;
            will-change: left, top; 
            transform: scale(1.02);
        }

        /* PLACEHOLDER */
        .insertion-placeholder {
            height: 6px !important;
            background: linear-gradient(90deg, #8a4af3, #b388ff); 
            margin: 8px 0;
            border-radius: 4px;
            box-shadow: 0 0 10px rgba(138, 74, 243, 0.5); 
            pointer-events: none;
        }

        /* MOBİLDE GİZLEME */
        /* Masaüstünde gizlemiyoruz, sadece mobilde yer açmak için */
        @media (max-width: 768px) {
            body.mobile-drag-active .route-controls-bar,
            body.mobile-drag-active .tt-travel-mode-set,
            body.mobile-drag-active [id^="map-bottom-controls-wrapper"], 
            body.mobile-drag-active .add-more-btn {
                display: none !important;
            }
        }

        body.dragging-active {
            user-select: none !important;
            cursor: grabbing !important;
            /* Mobilde tarayıcının native scroll'unu durdur, biz yöneteceğiz */
            touch-action: none !important; 
            overflow: hidden !important; /* Kaydırmayı JS ile yapacağız */
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
let dragShiftX = 0, dragShiftY = 0;
let startX = 0, startY = 0;
let longPressTimer;
const LONG_PRESS_MS = 250;

// Auto Scroll Değişkenleri
let autoScrollInterval = null;
let currentClientY = 0;
const SCROLL_ZONE = 100; // Ekranın alt/üst 100px'i tetikler
const SCROLL_SPEED_BASE = 15;

// ========== INITIALIZATION ==========
function initDragDropSystem() {
    injectDragStyles();
    
    isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    cleanupDrag();
    nukeConflicts(); // Diğer scriptlerin bozmasını engelle

    if (isMobile) {
        document.body.addEventListener('touchstart', handleTouchStart, { passive: false });
        document.body.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.body.addEventListener('touchend', handleTouchEnd);
    } else {
        setupDesktopListeners();
    }
    
    // Sürekli kontrol: Yeni item eklenirse draggable="true" özelliğini kapat
    setInterval(nukeConflicts, 2000);
}

// --- CONFLICT KILLER ---
// Mainscript.js'in eklediği draggable=true'yu zorla kapatır.
function nukeConflicts() {
    document.querySelectorAll('.travel-item').forEach(el => {
        if (el.getAttribute('draggable') === 'true') {
            el.setAttribute('draggable', 'false'); // Native drag'i öldür
            el.style.touchAction = 'pan-y'; // Bizim koda izin ver
        }
    });
}

// ========== CLEANUP ==========
function cleanupDrag() {
    stopAutoScroll();

    // Scroll Düzeltme (Mobil)
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

// ========== AUTO SCROLL ENGINE ==========
function startAutoScroll() {
    if (autoScrollInterval) return;
    
    autoScrollInterval = setInterval(() => {
        if (!draggedItem) return;

        const h = window.innerHeight;
        let scrollAmount = 0;

        // Üst Kenar
        if (currentClientY < SCROLL_ZONE) {
            // Kenara yaklaştıkça hızlan
            const intensity = (SCROLL_ZONE - currentClientY) / SCROLL_ZONE;
            scrollAmount = -SCROLL_SPEED_BASE * intensity;
        } 
        // Alt Kenar
        else if (currentClientY > (h - SCROLL_ZONE)) {
            const intensity = (currentClientY - (h - SCROLL_ZONE)) / SCROLL_ZONE;
            scrollAmount = SCROLL_SPEED_BASE * intensity;
        }

        if (scrollAmount !== 0) {
            window.scrollBy(0, scrollAmount);
            // Kayarken placeholder yerini güncelle (önemli!)
            // Ancak X koordinatı sabit olmadığı için son bilinen X'i kullanmamız lazım.
            // Bu basit versiyonda sadece scroll ediyoruz, touchmove olayı tetiklenince placeholder güncellenir.
            // Daha pürüzsüz olması için manuel trigger:
            if (window.lastKnownTouch) {
                // Hayaleti de güncelle ki titremesin (scroll ile kaysa bile)
                // (Ghost fixed olduğu için scroll'dan etkilenmez ama placeholder etkilenir)
                updatePlaceholder(window.lastKnownTouch.clientX, window.lastKnownTouch.clientY);
            }
        }
    }, 16); // 60 FPS
}

function stopAutoScroll() {
    if (autoScrollInterval) clearInterval(autoScrollInterval);
    autoScrollInterval = null;
}

// ========== GHOST & PLACEHOLDER ==========
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

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.travel-item:not(.dragging-source)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        return (offset < 0 && offset > closest.offset) ? { offset: offset, element: child } : closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function updatePlaceholder(clientX, clientY) {
    // Ekranda o noktadaki elemanı bul
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
        // display:none olsa bile DOM'da var, insertBefore çalışır
        if (addBtn) dropZone.insertBefore(placeholder, addBtn);
        else dropZone.appendChild(placeholder);
    } else {
        dropZone.insertBefore(placeholder, afterElement);
    }
}

// ========== HANDLERS ==========
function handleTouchStart(e) {
    const item = e.target.closest('.travel-item');
    // Buttonlara basılıyorsa sürükleme başlatma
    if (!item || e.target.closest('button') || e.target.closest('.map-content-wrap')) return;
    
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    
    // Offset hesapla
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
    
    // Sürükleme başladıysa sayfanın native scrollunu iptal et (Bizim autoscroll çalışacak)
    if (e.cancelable) e.preventDefault();
    
    const touch = e.touches[0];
    currentClientY = touch.clientY; // Auto scroll için güncelle
    window.lastKnownTouch = touch;

    updateDragGhost(touch.clientX, touch.clientY);
    updatePlaceholder(touch.clientX, touch.clientY);
}

function handleTouchEnd() {
    clearTimeout(longPressTimer);
    if (draggedItem) finishDrag();
}

// ========== DESKTOP (DEĞİŞTİRMEDİM) ==========
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
                
                if (!isDragStarted) {
                    const dx = Math.abs(moveEvent.clientX - startX);
                    const dy = Math.abs(moveEvent.clientY - startY);
                    if (dx > 5 || dy > 5) {
                        isDragStarted = true;
                        // Desktop'ta haritayı gizleme (ikinci argüman false olsun mantıken ama startDrag mobil kontrolü yapıyor zaten)
                        startDrag(draggedItem, moveEvent.clientX, moveEvent.clientY);
                    }
                }
                
                if (isDragStarted) {
                    currentClientY = moveEvent.clientY;
                    window.lastKnownTouch = { clientX: moveEvent.clientX, clientY: moveEvent.clientY }; // Reuse for autoscroll logic
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
    
    // --- 1. HEIGHT LOCK (MOBİL) ---
    const currentDocHeight = document.documentElement.scrollHeight;
    document.body.style.minHeight = currentDocHeight + 'px';

    // --- 2. SCROLL COMPENSATION (MOBİL) ---
    if (isMobile) {
        const rectBefore = item.getBoundingClientRect();
        const originalTop = rectBefore.top;

        // Haritaları gizle
        document.body.classList.add('mobile-drag-active');
        void document.body.offsetHeight; // Reflow

        const rectAfter = item.getBoundingClientRect();
        const diff = rectAfter.top - originalTop;

        if (diff !== 0) window.scrollBy(0, diff);
    }

    createDragGhost(item, x, y);
    item.classList.add('dragging-source');
    document.body.classList.add('dragging-active');
    
    // AUTO SCROLL BAŞLAT
    startAutoScroll();
}

// ========== FINISH ==========
function finishDrag() {
    stopAutoScroll();

    if (placeholder && placeholder.parentNode) {
        const dropList = placeholder.parentNode;
        const toDay = parseInt(dropList.dataset.day);
        const sourceItemData = window.cart[sourceIndex];
        
        // Basitçe index bul
        let newIndex = 0;
        const siblings = dropList.querySelectorAll('.travel-item:not(.dragging-source), .insertion-placeholder');
        for(let i=0; i<siblings.length; i++) {
            if(siblings[i].classList.contains('insertion-placeholder')) {
                newIndex = i;
                break;
            }
        }

        // Çakışma kontrolü (Bilgilendirme)
        // Burada basit bir kontrol yapalım, komşuya bakmaya gerek yok, sıralama önemli
        // Ama kullanıcı deneyimi için alerti sessize alabiliriz veya basit bırakabiliriz.
        // Şimdilik alert'i kaldırıyorum ki akış bozulmasın.

        const fromIndex = sourceIndex;
        if (window.cart && window.cart[fromIndex]) {
            reorderCart(fromIndex, newIndex, window.cart[fromIndex].day, toDay);
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