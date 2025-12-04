// ========== DRAG & DROP STYLES (INJECTED) ==========
function injectDragStyles() {
    const styleId = 'tt-drag-drop-styles';
    if (document.getElementById(styleId)) return;

    const css = `
        /* Sürüklenen Öğe (Mobil & Desktop Clone) */
        .travel-item.dragging, #drag-clone {
            position: fixed !important;
            z-index: 10000 !important;
            pointer-events: none !important; /* Altını görmesi için şart */
            
            /* Görsel Efektler */
            transform: scale(1.02) !important;
            box-shadow: 0 15px 35px rgba(0,0,0,0.25) !important;
            background-color: #fff !important;
            opacity: 0.98 !important;
            border-radius: 12px !important;
            border: 2px solid #8a4af3 !important;
            
            /* Performans */
            will-change: left, top;
            transition: none !important; /* Anlık takip için geçiş yok */
            margin: 0 !important;
            box-sizing: border-box !important;
        }

        /* Orijinal Öğe (Arkada kalan) */
        .travel-item.dragging-source {
            opacity: 0.2 !important;
            filter: grayscale(100%);
        }

        /* Yerleşim Çizgisi (Placeholder) */
        .insertion-placeholder {
            height: 6px !important;
            background: linear-gradient(90deg, #8a4af3, #b388ff) !important;
            margin: 8px 0 !important;
            border-radius: 4px !important;
            box-shadow: 0 0 10px rgba(138, 74, 243, 0.4);
            pointer-events: none !important;
        }

        /* Sayfa Kilidi */
        body.dragging-active {
            overflow: hidden !important;
            touch-action: none !important;
            user-select: none !important;
            -webkit-user-select: none !important;
        }
    `;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = css;
    document.head.appendChild(style);
}

// ========== GLOBAL VARIABLES ==========
if (!window.cart || !Array.isArray(window.cart)) window.cart = [];

let placeholder = null;
let isMobile = false;
let draggedItem = null;
let currentDropZone = null;
let touchStartX = 0;
let touchStartY = 0;

let mobileDragOffsetX = 0;
let mobileDragOffsetY = 0;
let desktopDragOffsetX = 0;
let desktopDragOffsetY = 0;

let longPressTimer = null;
let longPressTriggered = false;
let touchTargetItem = null;
const LONG_PRESS_MS = 250;        
const MOVE_CANCEL_PX = 10;        

// ========== INITIALIZATION ==========
function initDragDropSystem() {
    // Stilleri ekle
    injectDragStyles();

    isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    if (isMobile) {
        initTouchDragDrop();
    } else {
        setupDesktopDragDrop();
    }
    setupDropZones();
}

// ========== CLEANUP ==========
function forceCleanup() {
    // Desktop clone temizle
    const clones = document.querySelectorAll('#drag-clone');
    clones.forEach(c => c.remove());

    // Sınıfları ve stilleri temizle
    document.querySelectorAll('.travel-item.dragging').forEach(item => {
        item.classList.remove('dragging');
        item.style.cssText = ''; 
    });

    document.querySelectorAll('.travel-item.dragging-source').forEach(item => {
        item.classList.remove('dragging-source');
        item.style.cssText = '';
    });

    // Placeholder temizle
    if (placeholder && placeholder.parentNode) {
        placeholder.remove();
    }
    placeholder = null;

    // Body kilidini aç
    document.body.classList.remove('dragging-active');
    document.body.classList.remove('dragging-items');
    
    // Değişkenleri sıfırla
    draggedItem = null;
    currentDropZone = null;
}

// ========== MOBILE LOGIC ==========

function initTouchDragDrop() {
    document.body.removeEventListener('touchstart', handleBodyTouchStart);
    document.body.addEventListener('touchstart', handleBodyTouchStart, { passive: false });
}

function handleBodyTouchStart(e) {
    const item = e.target.closest('.travel-item');
    if (!item || e.target.closest('button') || e.target.closest('a') || e.target.closest('.visual img')) {
        return;
    }
    handleTouchStart(e, item);
}

function handleTouchStart(e, item) {
    if (e.touches.length !== 1) return;
    
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    
    longPressTriggered = false;
    touchTargetItem = item;

    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
        if (touchTargetItem) {
            forceCleanup(); // Önce temizle
            activateMobileDrag(touchTargetItem, e.touches[0]);
        }
    }, LONG_PRESS_MS);
}

// Scroll kontrolü
document.addEventListener('touchmove', function(e) {
    if (!longPressTriggered && touchTargetItem) {
        const t = e.touches[0];
        const dx = Math.abs(t.clientX - touchStartX);
        const dy = Math.abs(t.clientY - touchStartY);
        
        if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
            touchTargetItem = null;
        }
    }
}, { passive: false });

function activateMobileDrag(item, touch) {
    longPressTriggered = true;
    draggedItem = item;

    const rect = item.getBoundingClientRect();
    mobileDragOffsetX = touch.clientX - rect.left;
    mobileDragOffsetY = touch.clientY - rect.top;

    // Element boyutlarını sabitle
    item.style.width = rect.width + 'px';
    item.style.height = rect.height + 'px';
    
    // Fixed moda al
    item.style.position = 'fixed';
    item.style.left = (touch.clientX - mobileDragOffsetX) + 'px';
    item.style.top = (touch.clientY - mobileDragOffsetY) + 'px';
    item.style.zIndex = '9999';
    
    item.classList.add('dragging');

    document.body.classList.add('dragging-active');
    document.body.classList.add('dragging-items');

    if (navigator.vibrate) navigator.vibrate(70);

    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    document.addEventListener('touchend', handleGlobalTouchEnd, { passive: false });
    document.addEventListener('touchcancel', handleGlobalTouchEnd, { passive: false });
}

function handleGlobalTouchMove(e) {
    if (!longPressTriggered || !draggedItem) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const touch = e.touches[0];

    // Hareketi uygula
    draggedItem.style.left = (touch.clientX - mobileDragOffsetX) + 'px';
    draggedItem.style.top = (touch.clientY - mobileDragOffsetY) + 'px';

    // Altındaki elemanı bul
    draggedItem.style.visibility = 'hidden'; 
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    draggedItem.style.visibility = 'visible';

    if (!elementBelow) return;

    const dropZone = elementBelow.closest('.day-list');
    
    // Placeholder yönetimi
    if (!placeholder) {
        placeholder = document.createElement("div");
        placeholder.classList.add("insertion-placeholder");
    }

    if (dropZone) {
        if (currentDropZone && currentDropZone !== dropZone) {
            currentDropZone.classList.remove('drop-hover');
        }
        currentDropZone = dropZone;
        currentDropZone.classList.add('drop-hover');

        const targetItem = elementBelow.closest('.travel-item');
        
        // --- SENARYO 1: Bir Item'ın üzerindeyiz ---
        if (targetItem && targetItem !== draggedItem) {
            const rect = targetItem.getBoundingClientRect();
            const offset = touch.clientY - (rect.top + rect.height / 2);
            const isSameList = draggedItem.parentNode === dropZone;
            
            // ÜST YARI
            if (offset < 0) {
                if (isSameList && draggedItem.nextElementSibling === targetItem) {
                    if (placeholder.parentNode) placeholder.remove();
                    return;
                }
                // En üst kısıtlaması
                if (isSameList && !draggedItem.previousElementSibling && targetItem === dropZone.firstElementChild) {
                     if (placeholder.parentNode) placeholder.remove();
                     return;
                }
                dropZone.insertBefore(placeholder, targetItem);
            } 
            // ALT YARI
            else {
                let nextNode = targetItem.nextSibling;
                // Separator atlama
                if (nextNode && nextNode.classList.contains('distance-separator')) {
                    nextNode = nextNode.nextSibling;
                }
                if (isSameList && nextNode === draggedItem) {
                    if (placeholder.parentNode) placeholder.remove();
                    return;
                }
                dropZone.insertBefore(placeholder, nextNode);
            }
        } 
        // --- SENARYO 2: Boşluk ---
        else {
            const addBtn = dropZone.querySelector('.add-more-btn');
            
            // En alt kısıtlaması
            if (draggedItem.parentNode === dropZone) {
                let nextEl = draggedItem.nextElementSibling;
                while(nextEl && (nextEl === placeholder || nextEl.classList.contains('distance-separator'))) {
                    nextEl = nextEl.nextElementSibling;
                }
                if (!nextEl || nextEl.classList.contains('add-more-btn')) {
                    if (placeholder.parentNode) placeholder.remove();
                    return;
                }
            }
            
            if (targetItem === draggedItem) {
                if (placeholder.parentNode) placeholder.remove();
                return;
            }

            if (addBtn) {
                dropZone.insertBefore(placeholder, addBtn);
            } else {
                dropZone.appendChild(placeholder);
            }
        }
    }
}

function handleGlobalTouchEnd(e) {
    if (!longPressTriggered || !draggedItem) {
        cleanupTouchDrag();
        return;
    }
    
    e.preventDefault();

    if (currentDropZone && placeholder && placeholder.parentNode) {
        const fromIndex = parseInt(draggedItem.dataset.index);
        const fromItem = window.cart[fromIndex];
        const fromDay = fromItem ? fromItem.day : null;
        
        const toDayList = placeholder.closest('.day-list');
        const toDay = toDayList ? parseInt(toDayList.dataset.day) : null;

        const itemsInDay = Array.from(toDayList.querySelectorAll('.travel-item:not(.dragging)'));
        let toIndex = itemsInDay.indexOf(placeholder.nextSibling); 
        
        if (placeholder.nextSibling === null || placeholder.nextSibling.classList.contains('add-more-btn')) {
            toIndex = itemsInDay.length;
        } else if (toIndex === -1) {
            toIndex = itemsInDay.length; 
        }

        if (fromDay !== null && toDay !== null) {
            reorderCart(fromIndex, toIndex, fromDay, toDay);
        }
    }

    cleanupTouchDrag();
}

function cleanupTouchDrag() {
    clearTimeout(longPressTimer);
    longPressTimer = null;
    longPressTriggered = false;
    touchTargetItem = null;

    document.removeEventListener('touchmove', handleGlobalTouchMove);
    document.removeEventListener('touchend', handleGlobalTouchEnd);
    document.removeEventListener('touchcancel', handleGlobalTouchEnd);

    forceCleanup();
}

// ========== DESKTOP DRAG & DROP ==========

function setupDesktopDragDrop() {
    document.querySelectorAll('.travel-item').forEach(item => {
        item.setAttribute('draggable', true);
        item.removeEventListener('dragstart', desktopDragStart);
        item.removeEventListener('dragend', desktopDragEnd);
        item.addEventListener('dragstart', desktopDragStart);
        item.addEventListener('dragend', desktopDragEnd);
    });
}

function desktopDragStart(event) {
    const index = event.currentTarget.dataset.index;
    if (index !== undefined) {
        forceCleanup();

        draggedItem = event.currentTarget; 
        
        const rect = draggedItem.getBoundingClientRect();
        desktopDragOffsetX = event.clientX - rect.left;
        desktopDragOffsetY = event.clientY - rect.top;

        event.dataTransfer.setData("text/plain", index);
        event.dataTransfer.setData("source", "cart");
        event.dataTransfer.effectAllowed = "move";
        
        setTimeout(() => {
            if(draggedItem) draggedItem.classList.add('dragging-source');
        }, 0);

        // Klon oluştur
        const clone = draggedItem.cloneNode(true);
        clone.id = 'drag-clone';
        
        const content = clone.querySelector('.content');
        if(content) content.style.display = 'none'; 
        
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`; 
        clone.style.position = 'fixed';
        clone.style.left = `${rect.left}px`;
        clone.style.top = `${rect.top}px`;
        clone.style.zIndex = '99999';
        
        document.body.appendChild(clone);
        
        const emptyImg = new Image();
        emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        event.dataTransfer.setDragImage(emptyImg, 0, 0);

        document.addEventListener('dragover', updateDesktopClonePosition);
    }
    document.body.classList.add('dragging-items');
}

function updateDesktopClonePosition(event) {
    const clone = document.getElementById('drag-clone');
    if (clone && event.clientX) {
        clone.style.left = (event.clientX - desktopDragOffsetX) + 'px';
        clone.style.top = (event.clientY - desktopDragOffsetY) + 'px';
    }
}

function desktopDragEnd(event) {
    document.removeEventListener('dragover', updateDesktopClonePosition);
    forceCleanup();
}

function setupDropZones() {
    document.querySelectorAll('.day-list').forEach(list => {
        list.removeEventListener('dragover', desktopDragOver);
        list.removeEventListener('drop', desktopDrop);
        list.addEventListener('dragover', desktopDragOver);
        list.addEventListener('drop', desktopDrop);
    });
}

function desktopDragOver(event) {
    event.preventDefault();
    if (!draggedItem) return;

    const dropZone = event.target.closest('.day-list');
    if (!dropZone) return;

    if (!placeholder) {
        placeholder = document.createElement("div");
        placeholder.classList.add("insertion-placeholder");
    }

    const targetItem = event.target.closest('.travel-item');

    // --- SENARYO 1: Bir Item'ın üzerindeyiz ---
    if (targetItem && targetItem !== draggedItem) {
        const rect = targetItem.getBoundingClientRect();
        const offset = event.clientY - (rect.top + rect.height / 2);
        const isSameList = draggedItem.parentNode === dropZone;

        // ÜST YARI
        if (offset < 0) {
            if (isSameList && draggedItem.nextElementSibling === targetItem) {
                if (placeholder.parentNode) placeholder.remove();
                return;
            }
            if (isSameList && !draggedItem.previousElementSibling && targetItem === dropZone.firstElementChild) {
                if (placeholder.parentNode) placeholder.remove();
                return;
            }
            dropZone.insertBefore(placeholder, targetItem);
        } 
        // ALT YARI
        else {
            let nextNode = targetItem.nextSibling;
            if (nextNode && nextNode.classList.contains('distance-separator')) {
                nextNode = nextNode.nextSibling;
            }
            if (isSameList && nextNode === draggedItem) {
                if (placeholder.parentNode) placeholder.remove();
                return;
            }
            dropZone.insertBefore(placeholder, nextNode);
        }
    } 
    // --- SENARYO 2: Boşluk ---
    else if (!targetItem) {
        if (draggedItem.parentNode === dropZone) {
            let nextEl = draggedItem.nextElementSibling;
            while(nextEl && (nextEl === placeholder || nextEl.classList.contains('distance-separator'))) {
                nextEl = nextEl.nextElementSibling;
            }
            if (!nextEl || nextEl.classList.contains('add-more-btn')) {
                if (placeholder.parentNode) placeholder.remove();
                return;
            }
        }
        
        if (event.target === draggedItem) {
            if (placeholder.parentNode) placeholder.remove();
            return;
        }

        const addBtn = dropZone.querySelector('.add-more-btn');
        if (addBtn) {
            dropZone.insertBefore(placeholder, addBtn);
        } else {
            dropZone.appendChild(placeholder);
        }
    }
}

function desktopDrop(event) {
    event.preventDefault();
    
    if (!placeholder || !placeholder.parentNode) {
        forceCleanup();
        return;
    }

    const source = event.dataTransfer.getData("source") || event.dataTransfer.getData("text/plain");
    if (source !== "cart") return;

    const fromIndex = parseInt(event.dataTransfer.getData("text"));
    const placeholderParent = placeholder.parentNode;
    const toDayList = placeholderParent.closest(".day-list");
    
    if (!toDayList || !toDayList.dataset || !toDayList.dataset.day) {
        forceCleanup();
        return;
    }
    
    const toDay = parseInt(toDayList.dataset.day);
    const itemsInDay = Array.from(toDayList.querySelectorAll(".travel-item"));
    let toIndex = itemsInDay.indexOf(placeholder.nextSibling);
    
    if (placeholder.nextSibling === null || placeholder.nextSibling.classList.contains('add-more-btn')) {
        toIndex = itemsInDay.length;
    } else if (toIndex === -1) {
        toIndex = itemsInDay.length;
    }

    const fromDayList = document.querySelector(`.travel-item[data-index="${fromIndex}"]`)?.closest(".day-list");
    const fromDay = fromDayList && fromDayList.dataset && fromDayList.dataset.day
        ? parseInt(fromDayList.dataset.day)
        : null;

    if (fromIndex === toIndex && fromDay === toDay) {
        forceCleanup();
        return;
    }

    reorderCart(fromIndex, toIndex, fromDay, toDay);
    forceCleanup();
}

// ========== REORDER LOGIC ==========
function reorderCart(fromIndex, toIndex, fromDay, toDay) {
    try {
        if (fromIndex < 0 || fromIndex >= window.cart.length) throw new Error("Invalid fromIndex");

        const prevCart = JSON.parse(JSON.stringify(window.cart));
        const item = window.cart.splice(fromIndex, 1)[0];
        item.day = toDay;

        if (fromDay === toDay) {
            let dayItems = window.cart.filter(i => i.day === toDay);
            dayItems.splice(toIndex, 0, item);
            window.cart = window.cart.filter(i => i.day !== toDay).concat(dayItems);
        } else {
            let insertAt = window.cart.findIndex(it => it.day === toDay);
            if (insertAt === -1) insertAt = window.cart.length;

            let seen = 0;
            for (let i = 0; i < window.cart.length; ++i) {
                if (window.cart[i].day === toDay) {
                    if (seen === toIndex) {
                        insertAt = i;
                        break;
                    }
                    seen++;
                }
            }
            window.cart.splice(insertAt, 0, item);
        }

        if (typeof updateCart === "function") updateCart();
        if (typeof saveCurrentTripToStorage === "function") saveCurrentTripToStorage();

    } catch (error) {
        console.error("Reorder error:", error);
    }
}

// ========== HELPERS ==========
window.dragStart = desktopDragStart;
window.drop = desktopDrop;
window.allowDrop = desktopDragOver;

window.attachDragListeners = function() {
    setupDropZones();
    if (!isMobile) {
        setupDesktopDragDrop();
    } else {
        initTouchDragDrop();
    }
};

window.attachChatDropListeners = function() {};
window.initDragDropSystem = initDragDropSystem;

document.addEventListener('DOMContentLoaded', initDragDropSystem);