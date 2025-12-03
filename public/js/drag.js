// ========== GLOBAL VARIABLES ==========
if (!window.cart || !Array.isArray(window.cart)) window.cart = [];

let placeholder = null;
let isMobile = false;
let draggedItem = null;
let currentDropZone = null;
let touchStartX = 0;
let touchStartY = 0;

// Mobil Sürükleme için Global Değişkenler
let mobileDragOffsetX = 0;
let mobileDragOffsetY = 0;

// Long-press state
let longPressTimer = null;
let longPressTriggered = false;
let touchTargetItem = null;
const LONG_PRESS_MS = 250;       
const MOVE_CANCEL_PX = 10;       

// ========== INITIALIZATION ==========
function initDragDropSystem() {
    isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    if (isMobile) {
        initTouchDragDrop();
    } else {
        setupDesktopDragDrop();
    }
    setupDropZones();
}

// ========== MOBILE (TOUCH) LOGIC ==========

function initTouchDragDrop() {
    // Tüm document üzerinde dinle, dinamik elemanlar için
    document.body.removeEventListener('touchstart', handleBodyTouchStart);
    document.body.addEventListener('touchstart', handleBodyTouchStart, { passive: false });
}

function handleBodyTouchStart(e) {
    const item = e.target.closest('.travel-item');
    // Butonlara, linklere veya resimlere basıldıysa sürükleme başlatma
    if (!item || e.target.closest('button') || e.target.closest('a') || e.target.closest('.visual img')) {
        return;
    }
    handleTouchStart(e, item);
}

function handleTouchStart(e, item) {
    if (e.touches.length !== 1) return;
    if (draggedItem) return;

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    
    longPressTriggered = false;
    touchTargetItem = item;

    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
        // Eğer hala aynı öğedeysek ve parmak kalkmadıysa
        if (touchTargetItem) {
            activateMobileDrag(touchTargetItem, e.touches[0]);
        }
    }, LONG_PRESS_MS);
}

// Normal kaydırma kontrolü (Henüz drag başlamadıysa scroll'a izin ver)
document.addEventListener('touchmove', function(e) {
    if (!longPressTriggered && touchTargetItem) {
        const t = e.touches[0];
        const dx = Math.abs(t.clientX - touchStartX);
        const dy = Math.abs(t.clientY - touchStartY);
        
        // Kullanıcı parmağını hareket ettiriyorsa (scroll), long-press iptal
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

    // 1. Ölçüleri al
    const rect = item.getBoundingClientRect();
    mobileDragOffsetX = touch.clientX - rect.left;
    mobileDragOffsetY = touch.clientY - rect.top;

    // 2. Öğeyi Fixed moda al (Havada süzülme efekti için)
    item.style.width = rect.width + 'px';
    item.style.height = rect.height + 'px';
    item.style.position = 'fixed';
    item.style.left = (touch.clientX - mobileDragOffsetX) + 'px';
    item.style.top = (touch.clientY - mobileDragOffsetY) + 'px';
    item.style.zIndex = '9999';
    
    item.classList.add('dragging');

    // 3. Placeholder oluştur (İlk başta kendi yerinde kalsın)
    // createPlaceholder'ı manuel değil, hareket başlayınca handleGlobalTouchMove yönetecek.
    // Ancak boşluk oluşmaması için hemen bir tane oluşturabiliriz.
    // Şimdilik boş geçiyoruz, ilk move eventinde oluşacak.

    // 4. Scroll kilidi
    document.body.classList.add('dragging-active');
    document.body.classList.add('dragging-items');

    // 5. Titreşim
    if (navigator.vibrate) navigator.vibrate(70);

    // 6. Global listenerları başlat
    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    document.addEventListener('touchend', handleGlobalTouchEnd, { passive: false });
    document.addEventListener('touchcancel', handleGlobalTouchEnd, { passive: false });
}

function handleGlobalTouchMove(e) {
    if (!longPressTriggered || !draggedItem) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const touch = e.touches[0];

    // Sürüklenen öğeyi hareket ettir
    draggedItem.style.left = (touch.clientX - mobileDragOffsetX) + 'px';
    draggedItem.style.top = (touch.clientY - mobileDragOffsetY) + 'px';

    // Altındaki öğeyi bul
    draggedItem.style.visibility = 'hidden';
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    draggedItem.style.visibility = 'visible';

    if (!elementBelow) return;

    const dropZone = elementBelow.closest('.day-list');
    
    // Placeholder yönetimi (Oluştur veya taşı)
    if (!placeholder) {
        placeholder = document.createElement("div");
        placeholder.classList.add("insertion-placeholder");
        // CSS ile stil veriliyor ama JS ile de garantiye alalım
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

        const targetItem = elementBelow.closest('.travel-item');
        
        // --- SENARYO 1: Bir Item'ın üzerindeyiz ---
        if (targetItem && targetItem !== draggedItem) {
            const rect = targetItem.getBoundingClientRect();
            const offset = touch.clientY - (rect.top + rect.height / 2);
            const isSameList = draggedItem.parentNode === dropZone;
            
            // ÜST YARI (Insert Before)
            if (offset < 0) {
                // Kendi altımızdakinin üstüne geldiysek (yer değişmiyor)
                if (isSameList && draggedItem.nextElementSibling === targetItem) {
                    if (placeholder.parentNode) placeholder.remove();
                    return;
                }
                // En baştayız ve en başa koymaya çalışıyorsak
                if (isSameList && !draggedItem.previousElementSibling && targetItem === dropZone.firstElementChild) {
                     if (placeholder.parentNode) placeholder.remove();
                     return;
                }
                dropZone.insertBefore(placeholder, targetItem);
            } 
            // ALT YARI (Insert After)
            else {
                // Separator (km/süre) kontrolü
                let nextNode = targetItem.nextSibling;
                if (nextNode && nextNode.classList.contains('distance-separator')) {
                    nextNode = nextNode.nextSibling;
                }

                // Kendi üstümüzdekinin altına geldiysek (yer değişmiyor)
                if (isSameList && nextNode === draggedItem) {
                    if (placeholder.parentNode) placeholder.remove();
                    return;
                }

                dropZone.insertBefore(placeholder, nextNode);
            }
        } 
        // --- SENARYO 2: Boşluk veya Buton üzerindeyiz ---
        else {
            const addBtn = dropZone.querySelector('.add-more-btn');
            
            // Eğer kendi listemizdeysek ve zaten son öğeysek
            if (draggedItem.parentNode === dropZone) {
                let nextEl = draggedItem.nextElementSibling;
                while(nextEl && (nextEl === placeholder || nextEl.classList.contains('distance-separator'))) {
                    nextEl = nextEl.nextElementSibling;
                }
                // Bizden sonra sadece buton varsa veya hiçbir şey yoksa
                if (!nextEl || nextEl.classList.contains('add-more-btn')) {
                    if (placeholder.parentNode) placeholder.remove();
                    return;
                }
            }
            
            // Kendi üzerindeysek
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

    // Bırakma İşlemi
    if (currentDropZone && placeholder && placeholder.parentNode) {
        const fromIndex = parseInt(draggedItem.dataset.index);
        const fromItem = window.cart[fromIndex];
        const fromDay = fromItem ? fromItem.day : null;
        
        const toDayList = placeholder.closest('.day-list');
        const toDay = toDayList ? parseInt(toDayList.dataset.day) : null;

        // Hedef indeksi bul
        const itemsInDay = Array.from(toDayList.querySelectorAll('.travel-item:not(.dragging)'));
        let toIndex = itemsInDay.indexOf(placeholder.nextSibling); 
        
        // Eğer nextSibling null ise veya Add buton ise sona ekle
        if (placeholder.nextSibling === null || placeholder.nextSibling.classList.contains('add-more-btn')) {
            toIndex = itemsInDay.length;
        } else if (toIndex === -1) {
            // Garanti olsun diye children içindeki sıraya bak
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

    document.body.classList.remove('dragging-active');
    document.body.classList.remove('dragging-items');

    if (draggedItem) {
        draggedItem.style.width = '';
        draggedItem.style.height = '';
        draggedItem.style.position = '';
        draggedItem.style.left = '';
        draggedItem.style.top = '';
        draggedItem.style.zIndex = '';
        draggedItem.style.opacity = '';
        draggedItem.style.boxShadow = '';
        draggedItem.classList.remove('dragging');
        draggedItem = null;
    }
    
    if (currentDropZone) {
        currentDropZone.classList.remove('drop-hover');
        currentDropZone = null;
    }
    
    if (placeholder) {
        placeholder.remove();
        placeholder = null;
    }
}

// ========== DESKTOP DRAG & DROP ==========

function setupDesktopDragDrop() {
    document.querySelectorAll('.travel-item').forEach(item => {
        item.setAttribute('draggable', true);
        // Öncekileri temizle
        item.removeEventListener('dragstart', desktopDragStart);
        item.removeEventListener('dragend', desktopDragEnd);
        // Yenileri ekle
        item.addEventListener('dragstart', desktopDragStart);
        item.addEventListener('dragend', desktopDragEnd);
    });
}

function desktopDragStart(event) {
    const index = event.currentTarget.dataset.index;
    if (index !== undefined) {
        draggedItem = event.currentTarget; // GLOBAL DEĞİŞKENİ SET ET
        
        event.dataTransfer.setData("text/plain", index);
        event.dataTransfer.setData("source", "cart");
        event.dataTransfer.effectAllowed = "move";
        event.currentTarget.classList.add('dragging');

        // Hayalet görüntü
        const rect = event.target.getBoundingClientRect();
        const clone = event.target.cloneNode(true);
        clone.id = 'drag-clone';
        clone.style.position = 'fixed';
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`;
        clone.style.left = `${rect.left}px`;
        clone.style.top = `${rect.top}px`;
        clone.style.zIndex = '10000';
        clone.style.opacity = '0.8';
        clone.style.pointerEvents = 'none';
        document.body.appendChild(clone);
        
        event.dataTransfer.setDragImage(new Image(), 0, 0);
    }
    document.body.classList.add('dragging-items');
}

function desktopDragEnd(event) {
    event.target.classList.remove('dragging');
    
    const clone = document.getElementById('drag-clone');
    if (clone) clone.remove();
    
    if (placeholder) {
        placeholder.remove();
        placeholder = null;
    }
    draggedItem = null; // TEMİZLE
    document.body.classList.remove('dragging-items');
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
    // --- SENARYO 2: Listenin En Altı ---
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
        if (placeholder) placeholder.remove();
        placeholder = null;
        return;
    }

    const source = event.dataTransfer.getData("source") || event.dataTransfer.getData("text/plain");
    if (source !== "cart") return;

    const fromIndex = parseInt(event.dataTransfer.getData("text"));
    const placeholderParent = placeholder.parentNode;
    const toDayList = placeholderParent.closest(".day-list");
    
    if (!toDayList || !toDayList.dataset || !toDayList.dataset.day) {
        placeholder.remove();
        placeholder = null;
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
        placeholder.remove();
        placeholder = null;
        return;
    }

    reorderCart(fromIndex, toIndex, fromDay, toDay);
    placeholder.remove();
    placeholder = null;
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

        // Güncelleme
        if (typeof updateCart === "function") updateCart();
        if (typeof saveCurrentTripToStorage === "function") saveCurrentTripToStorage();

    } catch (error) {
        console.error("Reorder error:", error);
    }
}

// ========== HELPERS FOR MAINSCRIPT.JS (CRITICAL) ==========

// 1. Desktop için drag start (mainscript kullanıyor)
window.dragStart = desktopDragStart;

// 2. Drop handler
window.drop = desktopDrop;

// 3. Drop over handler
window.allowDrop = desktopDragOver;

// 4. UpdateCart sonrası listenerları yeniden yüklemek için
window.attachDragListeners = function() {
    setupDropZones();
    if (!isMobile) {
        setupDesktopDragDrop();
    } else {
        // Mobil listenerlar body'de olduğu için tekrar eklemeye gerek yok
        // ama touchstart'ı tazelemek gerekebilir
        initTouchDragDrop();
    }
};

// 5. Boş fonksiyon (Hata vermemesi için)
window.attachChatDropListeners = function() {};

// 6. Init
window.initDragDropSystem = initDragDropSystem;

// Sayfa yüklendiğinde başlat
document.addEventListener('DOMContentLoaded', initDragDropSystem);