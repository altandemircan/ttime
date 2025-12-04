// ========== DRAG & DROP STYLES (INJECTED) ==========
function injectDragStyles() {
    const styleId = 'tt-drag-drop-styles';
    if (document.getElementById(styleId)) return;

    const css = `
        .travel-item.dragging, #drag-clone {
            position: fixed !important;
            z-index: 10000 !important;
            pointer-events: none !important; 
            transform: scale(1.02) !important;
            box-shadow: 0 15px 35px rgba(0,0,0,0.25) !important;
            background-color: #fff !important;
            opacity: 0.98 !important;
            border-radius: 12px !important;
            border: 2px solid #8a4af3 !important;
            will-change: left, top;
            transition: none !important; 
            margin: 0 !important;
            box-sizing: border-box !important;
        }
        .travel-item.dragging-source {
            opacity: 0.2 !important;
            filter: grayscale(100%);
        }
        .insertion-placeholder {
            height: 6px !important;
            background: linear-gradient(90deg, #8a4af3, #b388ff) !important;
            margin: 8px 0 !important;
            border-radius: 4px !important;
            box-shadow: 0 0 10px rgba(138, 74, 243, 0.4);
            pointer-events: none !important;
        }
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
    const clones = document.querySelectorAll('#drag-clone');
    clones.forEach(c => c.remove());

    document.querySelectorAll('.travel-item.dragging').forEach(item => {
        item.classList.remove('dragging');
        item.style.cssText = ''; 
    });

    document.querySelectorAll('.travel-item.dragging-source').forEach(item => {
        item.classList.remove('dragging-source');
        item.style.cssText = '';
    });

    if (placeholder && placeholder.parentNode) {
        placeholder.remove();
    }
    placeholder = null;

    document.body.classList.remove('dragging-active');
    document.body.classList.remove('dragging-items');
    
    draggedItem = null;
    currentDropZone = null;
}

// ========== LOGIC CORE: GET NEXT ELEMENT ==========
// Bu fonksiyon imlecin Y koordinatına göre, placeholder'ın
// hangisinin ÜSTÜNE (BEFORE) konulması gerektiğini bulur.
function getDragAfterElement(container, y) {
    // Sürüklenen öğe hariç tüm elemanları al
    const draggableElements = [...container.querySelectorAll('.travel-item:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        // offset: mouse ile öğenin merkezi arasındaki mesafe
        // Negatifse: mouse öğenin üst yarısında veya üstünde
        const offset = y - box.top - box.height / 2;
        
        // Bizim için önemli olan: Mouse'un öğenin merkezinin ÜSTÜNDE olduğu (negatif offset)
        // ve bu negatifler içinde 0'a en yakın olanı (en büyük negatif sayı).
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
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
            forceCleanup(); 
            activateMobileDrag(touchTargetItem, e.touches[0]);
        }
    }, LONG_PRESS_MS);
}

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

    item.style.width = rect.width + 'px';
    item.style.height = rect.height + 'px';
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

    draggedItem.style.left = (touch.clientX - mobileDragOffsetX) + 'px';
    draggedItem.style.top = (touch.clientY - mobileDragOffsetY) + 'px';

    // Altındaki elementi bul
    draggedItem.style.visibility = 'hidden'; 
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    draggedItem.style.visibility = 'visible';

    if (!elementBelow) return;

    const dropZone = elementBelow.closest('.day-list');
    
    // Placeholder yoksa oluştur
    if (!placeholder) {
        placeholder = document.createElement("div");
        placeholder.classList.add("insertion-placeholder");
        placeholder.style.height = '6px';
        placeholder.style.margin = '8px 0';
        placeholder.style.borderRadius = '4px';
        placeholder.style.pointerEvents = 'none';
    }

    if (dropZone) {
        if (currentDropZone && currentDropZone !== dropZone) {
            currentDropZone.classList.remove('drop-hover');
        }
        currentDropZone = dropZone;
        currentDropZone.classList.add('drop-hover');

        // --- MATEMATİKSEL KONUMLANDIRMA ---
        // elementFromPoint yerine, dropZone içindeki tüm elemanlara göre konumu hesapla.
        const afterElement = getDragAfterElement(dropZone, touch.clientY);
        
        // Kendi üstüne veya kendi bir alt sırasına geliyorsa (yer değişmiyorsa)
        // Burada hassas bir kontrol yapmamız lazım.
        
        // Eğer afterElement null ise (yani listenin en altındaysak)
        if (afterElement == null) {
            // "Add Category" butonunu bul
            const addBtn = dropZone.querySelector('.add-more-btn');
            
            // Eğer draggedItem zaten listenin sonundaysa, placeholder gösterme
            if (draggedItem.parentNode === dropZone) {
                // Sondayız mı kontrolü: Benden sonra eleman yoksa veya sadece buton varsa
                let nextEl = draggedItem.nextElementSibling;
                // Separator/Placeholder atla
                while(nextEl && (nextEl === placeholder || nextEl.classList.contains('distance-separator'))) {
                    nextEl = nextEl.nextElementSibling;
                }
                if (!nextEl || nextEl.classList.contains('add-more-btn')) {
                    if (placeholder.parentNode) placeholder.remove();
                    return;
                }
            }

            // Değilse butondan önceye (sona) ekle
            if (addBtn) {
                dropZone.insertBefore(placeholder, addBtn);
            } else {
                dropZone.appendChild(placeholder);
            }
        } 
        // Eğer bir elementin üstüne geldiysek (afterElement bulundu)
        else {
            // Eğer hedef kendimizsek veya hemen altımızdaki elemansa (yerimiz değişmiyor)
            if (afterElement === draggedItem || afterElement === draggedItem.nextElementSibling) {
                 if (placeholder.parentNode) placeholder.remove();
                 return;
            }
            
            // Separator varsa, separator'ın da üstüne mi altına mı?
            // getDragAfterElement separator'ları görmez (sadece travel-item'ları sayar).
            // Dolayısıyla travel-item'ın önüne eklemek yeterli. 
            // Ancak, o travel-item'ın üstünde separator varsa, separator'ın üstüne eklemeliyiz.
            let insertionPoint = afterElement;
            // Eğer afterElement'in bir önceki kardeşi separator ise, onun önüne koy
            if (afterElement.previousElementSibling && afterElement.previousElementSibling.classList.contains('distance-separator')) {
                insertionPoint = afterElement.previousElementSibling;
            }

            dropZone.insertBefore(placeholder, insertionPoint);
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
        // İndeks hesaplama
        const fromIndex = parseInt(draggedItem.dataset.index);
        const fromItem = window.cart[fromIndex];
        const fromDay = fromItem ? fromItem.day : null;
        
        const toDayList = placeholder.closest('.day-list');
        const toDay = toDayList ? parseInt(toDayList.dataset.day) : null;

        const itemsInDay = Array.from(toDayList.querySelectorAll('.travel-item:not(.dragging)'));
        
        // Placeholder kimin önünde?
        let nextEl = placeholder.nextElementSibling;
        // Eğer separator varsa onu atla, gerçek item'ı bul
        if (nextEl && nextEl.classList.contains('distance-separator')) {
            nextEl = nextEl.nextElementSibling;
        }

        let toIndex;
        // Eğer nextEl yoksa veya buton ise sondayız demektir
        if (!nextEl || nextEl.classList.contains('add-more-btn')) {
            toIndex = itemsInDay.length;
        } else {
            toIndex = itemsInDay.indexOf(nextEl);
            if (toIndex === -1) toIndex = itemsInDay.length;
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
        clone.style.pointerEvents = 'none';
        
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
        placeholder.style.height = '6px';
        placeholder.style.margin = '8px 0';
        placeholder.style.borderRadius = '4px';
        placeholder.style.pointerEvents = 'none'; 
    }

    // --- MATH LOGIC FOR DESKTOP TOO ---
    const afterElement = getDragAfterElement(dropZone, event.clientY);
    const isSameList = draggedItem.parentNode === dropZone;

    if (afterElement == null) {
        const addBtn = dropZone.querySelector('.add-more-btn');
        // Sondayız kontrolü
        if (isSameList) {
            let nextEl = draggedItem.nextElementSibling;
            while(nextEl && (nextEl === placeholder || nextEl.classList.contains('distance-separator'))) {
                nextEl = nextEl.nextElementSibling;
            }
            if (!nextEl || nextEl.classList.contains('add-more-btn')) {
                if (placeholder.parentNode) placeholder.remove();
                return;
            }
        }

        if (addBtn) {
            dropZone.insertBefore(placeholder, addBtn);
        } else {
            dropZone.appendChild(placeholder);
        }
    } else {
        // Kendisi veya komşusu ise
        if (afterElement === draggedItem || afterElement === draggedItem.nextElementSibling) {
            if (placeholder.parentNode) placeholder.remove();
            return;
        }

        let insertionPoint = afterElement;
        if (afterElement.previousElementSibling && afterElement.previousElementSibling.classList.contains('distance-separator')) {
            insertionPoint = afterElement.previousElementSibling;
        }
        dropZone.insertBefore(placeholder, insertionPoint);
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
    
    // Placeholder kimin önünde?
    let nextEl = placeholder.nextElementSibling;
    if (nextEl && nextEl.classList.contains('distance-separator')) {
        nextEl = nextEl.nextElementSibling;
    }

    let toIndex;
    if (!nextEl || nextEl.classList.contains('add-more-btn')) {
        toIndex = itemsInDay.length;
    } else {
        toIndex = itemsInDay.indexOf(nextEl);
        if (toIndex === -1) toIndex = itemsInDay.length;
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