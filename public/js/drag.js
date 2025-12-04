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
            background: rgba(255, 255, 255, 0.98) !important;
            border: 2px solid #8a4af3 !important; 
            box-shadow: 0 15px 40px rgba(0,0,0,0.3) !important;
            border-radius: 12px !important;
            width: var(--ghost-width);
            height: var(--ghost-height);
            margin: 0 !important;
            will-change: left, top, transform; 
            transition: none !important;
            transform: scale(1.02);
        }

        /* ORİJİNAL ÖĞE (SÜRÜKLENENİN YERİNDEKİ BOŞLUK) */
        .travel-item.dragging-source {
            opacity: 0 !important; /* Görünmez ama yer kaplar */
            visibility: hidden;
        }

        /* DİĞER ÖĞELERİN ANİMASYONU */
        .travel-item {
            transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1);
            will-change: transform;
        }

        /* HATA EFEKTİ */
        @keyframes shakeError {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
        }
        .shake-error {
            animation: shakeError 0.3s ease-in-out;
            border: 2px solid #ffa000 !important;
        }

        /* GİZLENECEK ELEMANLAR */
        body.hide-map-details .route-controls-bar,
        body.hide-map-details .tt-travel-mode-set,
        body.hide-map-details [id^="map-bottom-controls-wrapper"], 
        body.hide-map-details .add-more-btn {
            display: none !important;
        }

        /* GENEL AYARLAR */
        body.dragging-active {
            user-select: none !important;
            cursor: grabbing !important;
            overflow-x: hidden; /* Yan taşmayı engelle */
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
let sourceIndex = -1;
let initialIndex = -1; // Sürükleme başladığındaki index
let currentIndex = -1; // Şu anki sanal index
let listItems = []; // O anki listedeki tüm öğeler (önbellek)
let itemHeight = 0; // Standart öğe yüksekliği (varsayım)

// Offset Variables
let dragShiftX = 0;
let dragShiftY = 0;

let startX = 0, startY = 0;
let longPressTimer;
const LONG_PRESS_MS = 200;

// ========== INITIALIZATION ==========
function initDragDropSystem() {
    injectDragStyles();
    // Cleanup on load
    cleanupDrag();

    document.body.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.body.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.body.addEventListener('touchend', handleTouchEnd);
    
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Native Drag Engelleme
    document.addEventListener('dragstart', (e) => {
        if (e.target.closest('.travel-item')) e.preventDefault();
    });

    window.addEventListener('blur', () => {
        if (draggedItem) finishDrag();
    });
}

// ========== CLEANUP ==========
function cleanupDrag() {
    // Scroll ve Map Geri Yükleme
    if (document.body.classList.contains('hide-map-details')) {
        const currentSource = document.querySelector('.travel-item.dragging-source');
        let rectBefore = null;
        if(currentSource) rectBefore = currentSource.getBoundingClientRect();

        document.body.classList.remove('hide-map-details'); 
        
        if (currentSource && rectBefore) {
            const rectAfter = currentSource.getBoundingClientRect();
            const diff = rectAfter.top - rectBefore.top;
            if (diff !== 0) window.scrollBy(0, diff);
        }
    }
    
    document.body.style.minHeight = '';
    document.body.classList.remove('dragging-active');

    // Ghost Sil
    document.querySelectorAll('.drag-ghost').forEach(g => g.remove());

    // Tüm transformları sıfırla
    document.querySelectorAll('.travel-item').forEach(item => {
        item.classList.remove('dragging-source');
        item.classList.remove('shake-error');
        item.style.transform = '';
        item.style.opacity = '';
        item.style.visibility = '';
    });

    draggedItem = null;
    listItems = [];
    
    if (longPressTimer) clearTimeout(longPressTimer);
}

// ========== START DRAG ==========
function startDrag(item, clientX, clientY) {
    if (navigator.vibrate) navigator.vibrate(50);
    
    draggedItem = item;
    sourceIndex = parseInt(item.dataset.index);
    initialIndex = -1;
    currentIndex = -1;

    // 1. Height Lock
    const currentDocHeight = document.documentElement.scrollHeight;
    document.body.style.minHeight = currentDocHeight + 'px';

    // 2. Scroll Compensation
    const rectBefore = item.getBoundingClientRect();
    const originalTop = rectBefore.top;

    // 3. Create Ghost (Kopyayı oluştur)
    const rect = item.getBoundingClientRect();
    dragShiftX = clientX - rect.left;
    dragShiftY = clientY - rect.top;
    
    const ghost = item.cloneNode(true);
    ghost.classList.add('drag-ghost');
    
    // Ghost içindeki map/detayları gizle (Hafiflet)
    const mapContent = ghost.querySelector('.map-content-wrap');
    if(mapContent) mapContent.style.display = 'none';

    ghost.style.setProperty('--ghost-width', rect.width + 'px');
    ghost.style.setProperty('--ghost-height', rect.height + 'px');
    ghost.style.left = (clientX - dragShiftX) + 'px';
    ghost.style.top = (clientY - dragShiftY) + 'px';
    document.body.appendChild(ghost);

    // 4. Hide Maps (DOM değişimi)
    document.body.classList.add('hide-map-details');
    
    // 5. Scroll Fix
    void document.body.offsetHeight; // Reflow
    const rectAfter = item.getBoundingClientRect();
    const diff = rectAfter.top - originalTop;
    if (diff !== 0) window.scrollBy(0, diff);

    // 6. Orijinal öğeyi gizle (yer tutucu olarak kalacak)
    item.classList.add('dragging-source');
    document.body.classList.add('dragging-active');

    // 7. Liste hesaplamaları için hazırlık
    const container = item.closest('.day-list');
    if (container) {
        // Sadece görünür itemları al
        listItems = Array.from(container.querySelectorAll('.travel-item'));
        initialIndex = listItems.indexOf(item);
        currentIndex = initialIndex;
        itemHeight = rect.height + 10; // Margin dahil yaklaşık yükseklik
    }
}

// ========== MOVE LOGIC (TRELLO STYLE) ==========
function handleMove(clientX, clientY) {
    if (!draggedItem) return;

    // Ghost'u taşı
    const ghost = document.querySelector('.drag-ghost');
    if (ghost) {
        ghost.style.left = (clientX - dragShiftX) + 'px';
        ghost.style.top = (clientY - dragShiftY) + 'px';
    }

    // Trello Mantığı:
    // Ghost'un orta noktası hangi item'ın üzerindeyse değişim yap
    const ghostRect = ghost.getBoundingClientRect();
    const ghostMidY = ghostRect.top + (ghostRect.height / 2);

    let newIndex = initialIndex;

    // Listeyi tara
    listItems.forEach((targetItem, idx) => {
        if (targetItem === draggedItem) return;

        const rect = targetItem.getBoundingClientRect();
        const targetMidY = rect.top + (rect.height / 2);
        
        // Eğer sürüklenen öğe (source) bu öğenin (target) yukarısındaysa
        // ve ghost bu öğeyi aşağı geçmişse -> Target yukarı kaymalı
        if (idx > initialIndex && ghostMidY > targetMidY) {
            newIndex = idx;
        }
        
        // Eğer sürüklenen öğe bu öğenin aşağısındaysa
        // ve ghost bu öğeyi yukarı geçmişse -> Target aşağı kaymalı
        else if (idx < initialIndex && ghostMidY < targetMidY) {
            if (newIndex === initialIndex) newIndex = idx; // İlk bulduğumuz yer
        }
    });

    if (newIndex !== currentIndex) {
        currentIndex = newIndex;
        updateTransforms();
    }
}

function updateTransforms() {
    listItems.forEach((item, idx) => {
        if (item === draggedItem) return;

        // Varsayılan: Yerinde dur
        let transformY = 0;

        // Eğer item başlangıçta yukarıdaysa ve şimdi aşağısına inildiyse
        if (idx > initialIndex && idx <= currentIndex) {
            transformY = -itemHeight; // Yukarı kay
        }
        // Eğer item başlangıçta aşağıdaysa ve şimdi yukarısına çıkıldıysa
        else if (idx < initialIndex && idx >= currentIndex) {
            transformY = itemHeight; // Aşağı kay
        }

        item.style.transform = `translate3d(0, ${transformY}px, 0)`;
    });
}

// ========== FINISH DRAG ==========
function finishDrag() {
    if (!draggedItem) return;

    // Eğer sıra değişmişse
    if (currentIndex !== -1 && currentIndex !== initialIndex) {
        
        // --- DUPLICATE CHECK (INFO) ---
        const targetDay = parseInt(draggedItem.closest('.day-list').dataset.day);
        const sourceItemData = window.cart[sourceIndex];
        
        // Yeni listede komşuları bulmak biraz karmaşık çünkü DOM henüz değişmedi.
        // Array manipülasyonu ile kontrol edelim:
        const tempCart = [...window.cart];
        const [moved] = tempCart.splice(sourceIndex, 1);
        
        // Hedef güne ait itemları bul
        let dayItems = tempCart.filter(i => i.day === targetDay);
        // Yeni pozisyona yerleştir (Basitleştirilmiş index hesabı)
        // Not: Gerçek reorderCart daha sağlam, burada sadece uyarı için basit bakıyoruz.
        
        // Uyarı: Basitçe, eğer listede aynı isimde başka bir item varsa ve çok yakınsa uyaralım.
        const isDuplicateName = dayItems.some(i => i.name === sourceItemData.name);
        if (isDuplicateName) {
             setTimeout(() => alert("ℹ️ Note: This place is already in the list."), 10);
        }

        // --- REORDER ---
        reorderCart(sourceIndex, currentIndex, targetDay, targetDay);
    }

    cleanupDrag();
}

// ========== EVENT HANDLERS (TOUCH & MOUSE) ==========
function handleTouchStart(e) {
    const item = e.target.closest('.travel-item');
    if (!item || e.target.closest('button') || e.target.closest('.map-content-wrap')) return;
    
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    
    longPressTimer = setTimeout(() => startDrag(item, startX, startY), LONG_PRESS_MS);
}

function handleTouchMove(e) {
    if (draggedItem) {
        e.preventDefault(); // Scrollu engelle
        const touch = e.touches[0];
        handleMove(touch.clientX, touch.clientY);
    } else {
        const dx = Math.abs(e.touches[0].clientX - startX);
        const dy = Math.abs(e.touches[0].clientY - startY);
        if (dx > 10 || dy > 10) clearTimeout(longPressTimer);
    }
}

function handleTouchEnd() {
    clearTimeout(longPressTimer);
    if (draggedItem) finishDrag();
}

function handleMouseDown(e) {
    if (e.button !== 0) return;
    const item = e.target.closest('.travel-item');
    if (!item || e.target.closest('button') || e.target.closest('.map-content-wrap')) return;

    startX = e.clientX;
    startY = e.clientY;
    
    // Desktop'ta long press beklemeden sürükle başlasın mı? 
    // Kullanıcı deneyimi için hafif bir eşik (threshold) koyalım.
    document.addEventListener('mousemove', checkThreshold);
    document.addEventListener('mouseup', cancelMouse);
    
    function checkThreshold(mv) {
        const dx = Math.abs(mv.clientX - startX);
        const dy = Math.abs(mv.clientY - startY);
        if (dx > 5 || dy > 5) {
            startDrag(item, startX, startY);
            removeListeners();
        }
    }
    function cancelMouse() {
        removeListeners();
    }
    function removeListeners() {
        document.removeEventListener('mousemove', checkThreshold);
        document.removeEventListener('mouseup', cancelMouse);
    }
}

function handleMouseMove(e) {
    if (draggedItem) {
        e.preventDefault();
        handleMove(e.clientX, e.clientY);
    }
}

function handleMouseUp() {
    if (draggedItem) finishDrag();
}

// ========== DATA UPDATE ==========
function reorderCart(fromIndex, toNewPosInDayList, fromDay, toDay) {
    try {
        const newCart = [...window.cart];
        if (!newCart[fromIndex]) return;

        const [movedItem] = newCart.splice(fromIndex, 1);
        
        // Hedef günün itemlarını bul
        let targetDayItems = newCart.filter(i => i.day === toDay);
        
        // Yeni pozisyona ekle
        // Not: toNewPosInDayList, DOM üzerindeki index'tir (0, 1, 2...).
        // Bu index, o güne ait öğeler içindeki sırasıdır.
        if (toNewPosInDayList >= targetDayItems.length) {
            targetDayItems.push(movedItem);
        } else {
            targetDayItems.splice(toNewPosInDayList, 0, movedItem);
        }

        // Global listeyi tekrar birleştir (Gün sırasını koruyarak)
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

// ========== EXPORTS ==========
window.initDragDropSystem = initDragDropSystem;
if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDragDropSystem);
} else {
    initDragDropSystem();
}