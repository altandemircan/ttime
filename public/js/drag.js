(function() { // <--- KAPSÜL BAŞLANGICI (Değişkenleri izole eder)

    // ========== STYLES (Görsel Ayarlar) ==========
    function injectDragStyles() {
        const styleId = 'tt-drag-styles';
        if (document.getElementById(styleId)) return;
        const css = `
            /* SÜRÜKLENEN HAYALET (GHOST) */
            .drag-ghost {
                position: fixed !important;
                z-index: 9999999 !important;
                pointer-events: none !important;
                background: rgba(255, 255, 255, 0.96) !important;
                border: 2px dashed #87cdb5 !important;
                box-shadow: 0 15px 40px rgba(0,0,0,0.4) !important;
                border-radius: 12px !important;
                width: var(--ghost-width);
                height: var(--ghost-height);
                margin: 0 !important;
                transform: scale(1.02);
                will-change: left, top;
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

            /* MOBİLDE GİZLEME (Desktop Etkilenmez) */
            @media (max-width: 768px) {
                body.mobile-drag-active .route-controls-bar,
                body.mobile-drag-active .tt-travel-mode-set,
                body.mobile-drag-active [id^="map-bottom-controls-wrapper"], 
                body.mobile-drag-active .add-more-btn {
                    display: none !important;
                }
            }

            /* SÜRÜKLEME MODU */
            body.dragging-active {
                user-select: none !important;
                cursor: grabbing !important;
                touch-action: none !important; /* Native scroll kapatılır */
            }

            /* KAYNAK ÖĞE GÖRÜNÜMÜ */
            .travel-item.dragging-source {
                opacity: 0.2 !important;
                filter: grayscale(100%);
            }
            
            /* UYARI EFEKTİ */
            @keyframes shakeError {
                0% { transform: translateX(0); border-color: #ffa000; }
                25% { transform: translateX(-5px); }
                75% { transform: translateX(5px); }
                100% { transform: translateX(0); border-color: #ffa000; }
            }
            .shake-error {
                animation: shakeError 0.4s ease-in-out;
                border: 2px solid #ffa000 !important;
                background-color: #fffdf0 !important;
            }
        `;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ========== GLOBAL VARIABLES (Artık Kapsül İçinde Güvende) ==========
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

    // AUTO SCROLL AYARLARI
    let autoScrollInterval = null;
    let lastClientY = 0; // Son mouse/touch Y pozisyonu
    const SCROLL_ZONE_SIZE = 100; // Kenarlara 100px kala kaydırma başlar
    const MAX_SCROLL_SPEED = 25;  // Maksimum kaydırma hızı

    // ========== INITIALIZATION ==========
    function initDragDropSystem() {
        injectDragStyles();
        isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        cleanupDrag();
        forceKillConflicts();

        const options = { passive: false };
        
        // Mobil Eventleri
        document.body.addEventListener('touchstart', handleTouchStart, options);
        document.body.addEventListener('touchmove', handleTouchMove, options);
        document.body.addEventListener('touchend', handleTouchEnd, options);
        
        // Desktop Eventleri
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        // Conflict Killer Loop
        setInterval(forceKillConflicts, 1500);
    }

    // --- CONFLICT KILLER: Diğer drag kodlarını ezer ---
    function forceKillConflicts() {
        const items = document.querySelectorAll('.travel-item');
        items.forEach(el => {
            if (el.getAttribute('draggable') !== 'false') {
                el.setAttribute('draggable', 'false');
                el.style.userSelect = 'none';
                el.classList.remove('sortable-chosen', 'sortable-ghost', 'sortable-drag');
            }
        });
    }

    // ========== AUTO SCROLL ENGINE ==========
    function startAutoScroll() {
        if (autoScrollInterval) return;

        autoScrollInterval = setInterval(() => {
            if (!draggedItem) return;

            const h = window.innerHeight;
            let scrollAmount = 0;

            // Üst Kenar (Yukarı Kaydır)
            if (lastClientY < SCROLL_ZONE_SIZE) {
                const intensity = (SCROLL_ZONE_SIZE - lastClientY) / SCROLL_ZONE_SIZE;
                scrollAmount = -MAX_SCROLL_SPEED * intensity;
            } 
            // Alt Kenar (Aşağı Kaydır)
            else if (lastClientY > (h - SCROLL_ZONE_SIZE)) {
                const intensity = (lastClientY - (h - SCROLL_ZONE_SIZE)) / SCROLL_ZONE_SIZE;
                scrollAmount = MAX_SCROLL_SPEED * intensity;
            }

            if (scrollAmount !== 0) {
                window.scrollBy(0, scrollAmount);
                
                // Kaydırma sırasında Placeholder'ı güncelle (Çünkü parmak sabit dursa bile liste kayıyor)
                if (window.lastClientX && window.lastClientY) {
                    updatePlaceholder(window.lastClientX, window.lastClientY);
                }
            }
        }, 16); // ~60 FPS
    }

    function stopAutoScroll() {
        if (autoScrollInterval) {
            clearInterval(autoScrollInterval);
            autoScrollInterval = null;
        }
    }

    // ========== CORE LOGIC ==========

    function startDrag(item, x, y) {
        draggedItem = item;
        sourceIndex = parseInt(item.dataset.index);
        if (navigator.vibrate) navigator.vibrate(50);

        // --- MOBIL FIX: Harita gizlenince zıplamayı önle ---
        if (isMobile) {
            const currentDocHeight = document.documentElement.scrollHeight;
            document.body.style.minHeight = currentDocHeight + 'px';

            const rectBefore = item.getBoundingClientRect();
            const originalTop = rectBefore.top;

            // Haritayı gizle
            document.body.classList.add('mobile-drag-active');
            void document.body.offsetHeight; // Reflow

            const rectAfter = item.getBoundingClientRect();
            const diff = rectAfter.top - originalTop;
            
            if (diff !== 0) window.scrollBy(0, diff);
        }

        createDragGhost(item, x, y);
        item.classList.add('dragging-source');
        document.body.classList.add('dragging-active');

        // Auto Scroll Başlat
        startAutoScroll();
    }

    function handleDragMove(x, y) {
        if (!draggedItem) return;

        window.lastClientX = x;
        window.lastClientY = y;
        lastClientY = y; // Motor için güncelle

        updateDragGhost(x, y);
        updatePlaceholder(x, y);
    }

    function finishDrag() {
        stopAutoScroll();

        if (placeholder && placeholder.parentNode) {
            const dropList = placeholder.parentNode;
            const toDay = parseInt(dropList.dataset.day);
            
            let newIndex = 0;
            const siblings = dropList.querySelectorAll('.travel-item:not(.dragging-source), .insertion-placeholder');
            for (let i = 0; i < siblings.length; i++) {
                if (siblings[i].classList.contains('insertion-placeholder')) {
                    newIndex = i;
                    break;
                }
            }

            const fromIndex = sourceIndex;
            if (window.cart && window.cart[fromIndex]) {
                reorderCart(fromIndex, newIndex, window.cart[fromIndex].day, toDay);
            }
        }

        cleanupDrag();
    }

    function cleanupDrag() {
        stopAutoScroll();

        // Mobil Scroll Geri Yükleme
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
        }
        
        document.body.style.minHeight = '';
        document.body.classList.remove('dragging-active');

        document.querySelectorAll('.drag-ghost').forEach(g => g.remove());
        if (placeholder && placeholder.parentNode) placeholder.remove();
        placeholder = null;
        
        document.querySelectorAll('.travel-item').forEach(item => {
            item.classList.remove('dragging-source');
            item.style.opacity = '';
        });

        draggedItem = null;
        if (longPressTimer) clearTimeout(longPressTimer);
    }

    // ========== HELPERS ==========

    function createDragGhost(item, x, y) {
        document.querySelectorAll('.drag-ghost').forEach(g => g.remove());
        const rect = item.getBoundingClientRect();
        
        const ghost = item.cloneNode(true);
        ghost.classList.add('drag-ghost');
        
        const mapContent = ghost.querySelector('.map-content-wrap');
        if(mapContent) mapContent.style.display = 'none';

        ghost.style.setProperty('--ghost-width', rect.width + 'px');
        ghost.style.setProperty('--ghost-height', rect.height + 'px');
        
        dragShiftX = x - rect.left;
        dragShiftY = y - rect.top;

        ghost.style.left = (x - dragShiftX) + 'px';
        ghost.style.top = (y - dragShiftY) + 'px';
        
        document.body.appendChild(ghost);
    }

    function updateDragGhost(x, y) {
        const ghost = document.querySelector('.drag-ghost');
        if (!ghost) return;
        ghost.style.left = (x - dragShiftX) + 'px';
        ghost.style.top = (y - dragShiftY) + 'px';
    }

    function updatePlaceholder(x, y) {
        const elementBelow = document.elementFromPoint(x, y);
        if (!elementBelow) return;
        
        const dropZone = elementBelow.closest('.day-list');
        if (!dropZone) return;

        if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.className = 'insertion-placeholder';
        }
        
        const draggableElements = [...dropZone.querySelectorAll('.travel-item:not(.dragging-source)')];
        const afterElement = draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;

        if (afterElement == null) {
            const addBtn = dropZone.querySelector('.add-more-btn');
            // Mobilde addBtn gizli olsa bile DOM'da vardır
            if (addBtn) dropZone.insertBefore(placeholder, addBtn);
            else dropZone.appendChild(placeholder);
        } else {
            dropZone.insertBefore(placeholder, afterElement);
        }
    }

    // ========== EVENT HANDLERS ==========

    // MOBİL (TOUCH)
    function handleTouchStart(e) {
        const item = e.target.closest('.travel-item');
        if (!item || e.target.closest('button') || e.target.closest('.map-content-wrap')) return;
        
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        
        const rect = item.getBoundingClientRect();
        dragShiftX = startX - rect.left;
        dragShiftY = startY - rect.top;

        longPressTimer = setTimeout(() => {
            startDrag(item, startX, startY);
        }, LONG_PRESS_MS);
    }

    function handleTouchMove(e) {
        const touch = e.touches[0];
        
        if (draggedItem) {
            if (e.cancelable) e.preventDefault();
            handleDragMove(touch.clientX, touch.clientY);
        } else {
            const dx = Math.abs(touch.clientX - startX);
            const dy = Math.abs(touch.clientY - startY);
            if (dx > 10 || dy > 10) clearTimeout(longPressTimer);
        }
    }

    function handleTouchEnd() {
        clearTimeout(longPressTimer);
        if (draggedItem) finishDrag();
    }

    // DESKTOP (MOUSE)
    function handleMouseDown(e) {
        if (e.button !== 0) return;
        const item = e.target.closest('.travel-item');
        if (!item || e.target.closest('button') || e.target.closest('.map-content-wrap')) return;

        startX = e.clientX;
        startY = e.clientY;
        
        let isDragStarted = false;

        const onMove = (ev) => {
            if (draggedItem) {
                handleDragMove(ev.clientX, ev.clientY);
                return;
            }

            const dx = Math.abs(ev.clientX - startX);
            const dy = Math.abs(ev.clientY - startY);
            if (dx > 5 || dy > 5) {
                isDragStarted = true;
                // Desktop'ta da aynı mantıkla başla (Harita gizleme CSS ile kontrol ediliyor)
                startDrag(item, startX, startY);
            }
        };

        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            if (draggedItem) finishDrag();
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    function handleMouseMove(e) {
        // Global mouse takibi (gerekirse)
    }

    function handleMouseUp() {
        // Global bırakma
    }

    // ========== DATA UPDATE ==========
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
                window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { fromDay, toDay } }));
            }, 50);

            if (typeof saveCurrentTripToStorage === "function") saveCurrentTripToStorage();

        } catch (e) {
            console.error("Reorder error:", e);
        }
    }

    // ========== EXPOSE INIT FUNCTION ==========
    window.initDragDropSystem = initDragDropSystem;

    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDragDropSystem);
    } else {
        initDragDropSystem();
    }

})(); // <--- KAPSÜL SONU