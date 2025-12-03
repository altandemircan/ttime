// ========== GLOBAL ==========
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
const LONG_PRESS_MS = 300;       
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

// ========== MOBILE (TOUCH) LOGIC - STABILIZED VERSION ==========

function initTouchDragDrop() {
    // Sadece "travel-item"lara olay dinleyicisi ekle
    document.body.addEventListener('touchstart', function(e) {
        const item = e.target.closest('.travel-item');
        if (item) handleTouchStart(e, item);
    }, { passive: false });
}

function handleTouchStart(e, item) {
    if (e.touches.length !== 1) return;
    if (draggedItem) return; // Zaten sürüklenen bir şey varsa işlem yapma
    
    // Butonlara basıldıysa sürükleme başlatma
    if (e.target.closest('button') || e.target.closest('.visual img')) return;

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    
    longPressTriggered = false;
    touchTargetItem = item;

    // Timer başlat
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
        if (touchTargetItem) {
            activateMobileDrag(touchTargetItem, e.touches[0]);
        }
    }, LONG_PRESS_MS);
}

// Long press tetiklendiğinde çalışır
function activateMobileDrag(item, touch) {
    longPressTriggered = true;
    draggedItem = item;

    // 1. Koordinat hesaplama (Parmağın öğe içindeki konumu)
    const rect = item.getBoundingClientRect();
    mobileDragOffsetX = touch.clientX - rect.left;
    mobileDragOffsetY = touch.clientY - rect.top;

    // 2. Öğeyi "Fixed" moda al (En stabil yöntem)
    item.style.width = rect.width + 'px';
    item.style.height = rect.height + 'px';
    item.style.position = 'fixed';
    item.style.left = (touch.clientX - mobileDragOffsetX) + 'px';
    item.style.top = (touch.clientY - mobileDragOffsetY) + 'px';
    item.style.zIndex = '9999';
    item.style.opacity = '0.9';
    item.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
    item.classList.add('dragging');

    // 3. Placeholder oluştur
    createPlaceholder(item);

    // 4. Sayfa kaydırmayı kilitle
    document.body.classList.add('dragging-active');
    document.body.classList.add('dragging-items');

    // 5. Titreşim
    if (navigator.vibrate) navigator.vibrate(50);

    // 6. Global event listener'ları ekle (Document üzerine)
    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    document.addEventListener('touchend', handleGlobalTouchEnd, { passive: false });
    document.addEventListener('touchcancel', handleGlobalTouchEnd, { passive: false });
}

// Normal kaydırma kontrolü (Henüz drag başlamadıysa)
document.addEventListener('touchmove', function(e) {
    if (!longPressTriggered && touchTargetItem) {
        const t = e.touches[0];
        const dx = Math.abs(t.clientX - touchStartX);
        const dy = Math.abs(t.clientY - touchStartY);
        
        // Kullanıcı parmağını çok hareket ettirdiyse (scroll yapıyor), long-press iptal
        if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
            touchTargetItem = null;
        }
    }
}, { passive: false });

// Global Sürükleme Hareketi
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
            
            // Eğer aynı listedeysek komşuluk ve sıra kontrolü yap
            const isSameList = draggedItem.parentNode === dropZone;
            
            // ÜST YARI (Insert Before)
            if (offset < 0) {
                // Eğer aynı listede bir sonraki öğenin üstüne geldiysek (yerimiz değişmiyor)
                if (isSameList && draggedItem.nextElementSibling === targetItem) {
                    if (placeholder && placeholder.parentNode) placeholder.remove();
                    return;
                }
                // EXTRA FIX: Eğer ilk öğeyi sürükleyip, yine ilk sıraya (kendisi veya placeholder üstü) geliyorsak
                if (isSameList && !draggedItem.previousElementSibling && targetItem === dropZone.firstElementChild) {
                     if (placeholder && placeholder.parentNode) placeholder.remove();
                     return;
                }

                dropZone.insertBefore(placeholder, targetItem);
            } 
            // ALT YARI (Insert After)
            else {
                // Separator varsa atla
                let nextNode = targetItem.nextSibling;
                if (nextNode && nextNode.classList.contains('distance-separator')) {
                    nextNode = nextNode.nextSibling;
                }

                // Eğer bir önceki öğenin altına geldiysek (yerimiz değişmiyor)
                // Separator varsa nextNode, yoksa targetItem.nextSibling referans alınır.
                // Eğer nextNode bizim draggedItem ise, demek ki zaten oradayız.
                if (isSameList && nextNode === draggedItem) {
                    if (placeholder && placeholder.parentNode) placeholder.remove();
                    return;
                }

                dropZone.insertBefore(placeholder, nextNode);
            }
        } 
        // --- SENARYO 2: Boşluk veya Buton üzerindeyiz ---
        else {
            const addBtn = dropZone.querySelector('.add-more-btn');
            
            // Eğer kendi listemizdeysek
            if (draggedItem.parentNode === dropZone) {
                // Listede bizden sonra eleman yoksa (zaten sondayız) -> GÖSTERME
                // Not: Separator, placeholder veya addBtn harici gerçek bir item var mı?
                let nextEl = draggedItem.nextElementSibling;
                while(nextEl && (nextEl === placeholder || nextEl.classList.contains('distance-separator'))) {
                    nextEl = nextEl.nextElementSibling;
                }
                
                if (!nextEl || nextEl.classList.contains('add-more-btn')) {
                    if (placeholder && placeholder.parentNode) placeholder.remove();
                    return;
                }
            }
            
            // Kendi üzerindeysek
            if (targetItem === draggedItem) {
                if (placeholder && placeholder.parentNode) placeholder.remove();
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
function handleTouchDrop(e) {
    if (!longPressTriggered || !draggedItem || !currentDropZone) {
        cleanupTouchDrag();
        return;
    }
    
    const fromIndex = parseInt(draggedItem.dataset.index);
    const fromDayList = draggedItem.closest('.day-list');
    const fromDay = fromDayList ? parseInt(fromDayList.dataset.day) : null;
    const toDay = parseInt(currentDropZone.dataset.day);
    
    const items = Array.from(currentDropZone.querySelectorAll('.travel-item:not(.dragging)'));
    
    // --- İNDEKS HESAPLAMA DÜZELTMESİ ---
    let toIndex;
    
    // Eğer placeholder'ın bir sonraki kardeşi yoksa VEYA bir sonraki kardeşi Add butonu ise
    if (placeholder.nextSibling === null || placeholder.nextSibling.classList.contains('add-more-btn')) {
        toIndex = items.length; // Listenin sonu demektir
    } else {
        // Normal item'lar arasındaysa
        toIndex = items.indexOf(placeholder.nextSibling);
        if (toIndex === -1) toIndex = items.length; // Güvenlik önlemi
    }
    
    reorderCart(fromIndex, toIndex, fromDay, toDay);
    cleanupTouchDrag();
}

function handleGlobalTouchEnd(e) {
    // Sürükleme bitişi
    if (longPressTriggered && draggedItem) {
        e.preventDefault();
        
        if (currentDropZone && placeholder && placeholder.parentNode) {
            const fromIndex = parseInt(draggedItem.dataset.index);
            
            // From Day'i placeholder'ın eski yerinden değil, draggedItem'ın orijinal yerinden bulmak gerekebilir
            // Ancak window.cart üzerinden index ile gitmek daha güvenli.
            const fromItem = window.cart[fromIndex];
            const fromDay = fromItem ? fromItem.day : null;
            
            const toDayList = placeholder.closest('.day-list');
            const toDay = toDayList ? parseInt(toDayList.dataset.day) : null;

            // Hedef indeksi bul
            const itemsInDay = Array.from(toDayList.querySelectorAll('.travel-item:not(.dragging)'));
            let toIndex = itemsInDay.indexOf(placeholder.nextSibling); 
            if (placeholder.nextSibling === null) toIndex = itemsInDay.length;
            else if (toIndex === -1) toIndex = Array.from(toDayList.children).indexOf(placeholder);

            if (fromDay !== null && toDay !== null) {
                reorderCart(fromIndex, toIndex, fromDay, toDay);
            }
        }
    }

    // Temizlik
    clearTimeout(longPressTimer);
    longPressTimer = null;
    longPressTriggered = false;
    touchTargetItem = null;
    cleanupTouchDrag();
}

function cleanupTouchDrag() {
    // Global listener'ları kaldır
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
        item.addEventListener('dragstart', desktopDragStart);
        item.addEventListener('dragend', desktopDragEnd);
    });
}

function desktopDragStart(event) {
    const index = event.currentTarget.dataset.index;
    if (index !== undefined) {
        // --- FIX: Global değişkeni set et ---
        draggedItem = event.currentTarget;
        
        event.dataTransfer.setData("text/plain", index);
        event.dataTransfer.setData("source", "cart");
        event.dataTransfer.effectAllowed = "move";
        event.currentTarget.classList.add('dragging');

        // Clone (hayalet görüntü) oluşturma
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
        clone.style.boxShadow = '0 10px 20px rgba(0,0,0,0.2)';
        document.body.appendChild(clone);
        
        // Browser'ın varsayılan hayalet görüntüsünü gizle
        event.dataTransfer.setDragImage(new Image(), 0, 0);
    }
    document.body.classList.add('dragging-items');
}
function desktopDragEnd(event) {
    event.target.classList.remove('dragging');
    event.target.style.visibility = 'visible';
    
    const clone = document.getElementById('drag-clone');
    if (clone) clone.remove();
    
    if (placeholder) {
        placeholder.remove();
        placeholder = null;
    }
    
    // --- FIX: Global değişkeni temizle ---
    draggedItem = null;
    
    document.body.classList.remove('dragging-items');
}

// Masaüstü için DragStart (mainscript.js kullanıyor)
function dragStart(event) {
    desktopDragStart(event);
}

// ========== SHARED HELPERS ==========
function createPlaceholder(target) {
    // --- SAFETY CHECK ---
    if (!target) return;
    
    // Eğer hedef sürüklenen öğenin kendisiyse placeholder'ı kaldır ve çık
    if (draggedItem && target === draggedItem) {
        if (placeholder && placeholder.parentNode) placeholder.remove();
        return;
    }

    if (!placeholder) {
        placeholder = document.createElement("div");
        placeholder.classList.add("insertion-placeholder");
        placeholder.style.height = '4px';
        placeholder.style.backgroundColor = '#8a4af3';
        placeholder.style.margin = '8px 0';
        placeholder.style.borderRadius = '2px';
        placeholder.style.pointerEvents = 'none';
    }

    const parent = target.closest(".day-list");
    if (!parent) return;

    if (target.classList.contains("travel-item")) {
        parent.insertBefore(placeholder, target);
    } else if (target.classList.contains("day-list")) {
        const addBtn = parent.querySelector('.add-more-btn');
        // Eğer zaten sondayız kontrolü
        if (draggedItem && draggedItem.parentNode === parent) {
            const next = draggedItem.nextElementSibling;
            if (!next || (addBtn && next === addBtn)) {
                if (placeholder.parentNode) placeholder.remove();
                return;
            }
        }

        if (addBtn) {
            parent.insertBefore(placeholder, addBtn);
        } else {
            parent.appendChild(placeholder);
        }
    }
}function setupDropZones() {
    // Masaüstü drop zone dinleyicileri
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
        placeholder.style.height = '4px';
        placeholder.style.backgroundColor = '#8a4af3';
        placeholder.style.margin = '8px 0';
        placeholder.style.borderRadius = '2px';
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
            // Bir sonraki elemanın üstüne geldiysek (aslında yerimiz değişmiyor)
            if (isSameList && draggedItem.nextElementSibling === targetItem) {
                if (placeholder.parentNode) placeholder.remove();
                return;
            }
            // Listenin başındayız ve en başa koymaya çalışıyoruz (zaten baştayız)
            if (isSameList && !draggedItem.previousElementSibling && targetItem === dropZone.firstElementChild) {
                if (placeholder.parentNode) placeholder.remove();
                return;
            }

            dropZone.insertBefore(placeholder, targetItem);
        } 
        // ALT YARI
        else {
            // Separator kontrolü
            let nextNode = targetItem.nextSibling;
            if (nextNode && nextNode.classList.contains('distance-separator')) {
                nextNode = nextNode.nextSibling;
            }

            // Bir önceki elemanın altına geldiysek (yerimiz değişmiyor)
            if (isSameList && nextNode === draggedItem) {
                if (placeholder.parentNode) placeholder.remove();
                return;
            }

            dropZone.insertBefore(placeholder, nextNode);
        }
    } 
    // --- SENARYO 2: Listenin En Altı veya Boşluk ---
    else if (!targetItem) {
        // Eğer zaten bu listenin son elemanıysak
        if (draggedItem.parentNode === dropZone) {
            let nextEl = draggedItem.nextElementSibling;
            // Araya giren separator/placeholder varsa atla, gerçek item ara
            while(nextEl && (nextEl === placeholder || nextEl.classList.contains('distance-separator'))) {
                nextEl = nextEl.nextElementSibling;
            }

            // Eğer bizden sonra sadece buton varsa veya hiçbir şey yoksa -> GÖSTERME
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
    
    // --- GÜVENLİK KONTROLÜ (CRITICAL FIX) ---
    // Eğer placeholder yoksa veya bir listeye bağlı değilse işlemi durdur.
    // Bu, "Cannot read properties of null" hatasını önler.
    if (!placeholder || !placeholder.parentNode) {
        if (placeholder) placeholder.remove();
        placeholder = null;
        // Drop zone highlight'ları temizle
        document.querySelectorAll('.day-list').forEach(list => list.classList.remove('drop-possible'));
        return;
    }

    document.querySelectorAll('.day-list').forEach(list => {
        list.classList.remove('drop-possible');
    });
    
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
    if (toIndex === -1) toIndex = itemsInDay.length;

    const fromDayList = document.querySelector(`.travel-item[data-index="${fromIndex}"]`)?.closest(".day-list");
    const fromDay = fromDayList && fromDayList.dataset && fromDayList.dataset.day
        ? parseInt(fromDayList.dataset.day)
        : null;

    // Aynı yere bırakıldıysa işlem yapma
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
    console.log("[REORDER] Moving idx:", fromIndex, "to idx:", toIndex, "Day:", fromDay, "->", toDay);

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

// ========== EXPORTS (CRITICAL FOR MAINSCRIPT.JS) ==========
// Bu satırlar mainscript.js'in bu fonksiyonları görmesini sağlar
window.dragStart = dragStart;
window.allowDrop = desktopDragOver; // allowDrop yerine desktopDragOver kullanılıyor
window.drop = desktopDrop;
window.initDragDropSystem = initDragDropSystem;

// Sayfa yüklendiğinde başlat
document.addEventListener('DOMContentLoaded', initDragDropSystem);
// ========== MISSING FUNCTION FIX ==========

// mainscript.js'in updateCart fonksiyonu bu ismi arıyor.
// Bu fonksiyon, HTML yenilendiğinde eventleri tekrar bağlar.
function attachDragListeners() {
    // Drop zone'ları (gün listeleri) tekrar tanımla
    setupDropZones();

    // Mobil için global listener kullanıyoruz, o yüzden tekrar bağlamaya gerek yok.
    // Ancak Desktop için her öğeye event listener eklemeliyiz.
    if (!isMobile) {
        setupDesktopDragDrop();
    }
}

// Fonksiyonu global (window) nesnesine ekle ki mainscript.js görebilsin
window.attachDragListeners = attachDragListeners;