// ========== STYLES (Görsel Hissiyat) ==========
function injectDragStyles() {
    const styleId = 'tt-drag-styles';
    if (document.getElementById(styleId)) return;
    const css = `
        /* Sürüklenen Öğe */
        .travel-item.dragging, #drag-clone {
            opacity: 0.98;
            background: #fff;
            box-shadow: 0 15px 40px rgba(0,0,0,0.3);
            transform: scale(1.02);
            z-index: 10000;
            pointer-events: none; /* Altını görmesi için şart */
            position: fixed;
            border: 2px solid #8a4af3;
            border-radius: 12px;
            margin: 0;
            will-change: top, left;
            box-sizing: border-box;
        }
        /* Orijinal Öğe Silikleşsin */
        .travel-item.dragging-source {
            opacity: 0.05 !important;
            filter: grayscale(100%);
        }
        /* Mor Çizgi (Placeholder) */
        .insertion-placeholder {
            height: 6px;
            background: linear-gradient(90deg, #8a4af3, #b388ff);
            margin: 8px 0;
            border-radius: 4px;
            box-shadow: 0 0 10px rgba(138, 74, 243, 0.5);
            pointer-events: none;
            position: relative;
            z-index: 50;
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
if (!window.cart) window.cart = [];

let draggedItem = null;
let placeholder = null;
let sourceIndex = -1;
let isMobile = false;

// Mobil Koordinatlar
let touchStartX, touchStartY;
let mobileOffsetX, mobileOffsetY;
let desktopDragOffsetX = 0, desktopDragOffsetY = 0;
let longPressTimer;

// ========== INITIALIZATION ==========
function initDragDropSystem() {
    injectDragStyles();
    isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (isMobile) {
        document.body.addEventListener('touchstart', handleTouchStart, { passive: false });
        document.body.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.body.addEventListener('touchend', handleTouchEnd);
    } else {
        setupDesktopListeners();
    }
}

// ========== HELPER: EN YAKIN ELEMAN (GEOMETRİ) ==========
// Bu fonksiyon boşlukta olsanız bile en yakın öğeyi bulur.
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.travel-item:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        // Mouse elemanın üst yarısında mı?
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// ========== PLACEHOLDER MANTIĞI ==========
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

    // Nereye gireceğini bul
    const afterElement = getDragAfterElement(dropZone, clientY);
    const addBtn = dropZone.querySelector('.add-more-btn');

    if (afterElement == null) {
        // Listenin sonuna
        if (addBtn) {
            dropZone.insertBefore(placeholder, addBtn);
        } else {
            dropZone.appendChild(placeholder);
        }
    } else {
        // Araya
        dropZone.insertBefore(placeholder, afterElement);
    }
}

// ========== CORE LOGIC: APPLY DROP (KESİN ÇÖZÜM) ==========
function finalizeDrop() {
    // 1. Güvenlik Kontrolleri
    if (!placeholder || !placeholder.parentNode || !draggedItem) {
        cleanupDrag();
        return;
    }

    const dropList = placeholder.parentNode; // Bırakılan Gün Listesi
    const toDay = parseInt(dropList.dataset.day);
    
    // 2. İndeks Hesaplama (Gördüğüne İnan Metodu)
    // Mor çizgiden (placeholder) ÖNCE gelen gerçek 'travel-item' sayısını buluyoruz.
    // Bu bize tam olarak yeni index'i verir.
    let newIndex = 0;
    const children = Array.from(dropList.children);
    
    for (let child of children) {
        // Placeholder'a geldiysek dur, buraya kadar kaç tane saydık?
        if (child === placeholder) break;
        
        // Sadece gerçek item'ları say (dragging olanı ve diğer çöpleri sayma)
        if (child.classList.contains('travel-item') && !child.classList.contains('dragging') && !child.classList.contains('dragging-source')) {
            newIndex++;
        }
    }

    // 3. Veri Kaynakları
    const fromIndex = sourceIndex;
    const fromItem = window.cart[fromIndex];
    if (!fromItem) {
        cleanupDrag();
        return;
    }
    const fromDay = fromItem.day;

    // 4. Veriyi Güncelle
    reorderCart(fromIndex, newIndex, fromDay, toDay);
    
    // 5. Temizlik
    cleanupDrag();
}

// ========== DATA UPDATE ==========
function reorderCart(fromIndex, toIndex, fromDay, toDay) {
    try {
        const newCart = [...window.cart];
        
        // 1. Öğeyi diziden kopar
        const [movedItem] = newCart.splice(fromIndex, 1);
        movedItem.day = toDay;

        // 2. Hedef günün elemanlarını ve diğerlerini ayır
        let targetDayItems = newCart.filter(i => i.day === toDay);
        let otherItems = newCart.filter(i => i.day !== toDay);
        
        // 3. Hesapladığımız "newIndex" noktasına yerleştir
        // Splice mantığı: (index, silinecek, eklenecek)
        // newIndex, "placeholder'ın üstündeki eleman sayısı" olduğu için
        // eleman silinmiş array'de tam olarak o konuma oturur.
        targetDayItems.splice(toIndex, 0, movedItem);
        
        // 4. Diziyi tekrar birleştir
        const allDays = new Set([...window.cart.map(i=>i.day), toDay]); 
        const sortedDays = [...allDays].sort((a,b)=>a-b);
        
        let finalCart = [];
        sortedDays.forEach(d => {
            if (d === toDay) {
                finalCart = finalCart.concat(targetDayItems);
            } else {
                finalCart = finalCart.concat(newCart.filter(i => i.day === d));
            }
        });

        window.cart = finalCart;

        // UI Güncelle
        if (typeof updateCart === "function") updateCart();
        if (typeof saveCurrentTripToStorage === "function") saveCurrentTripToStorage();

    } catch (e) {
        console.error("Reorder Error", e);
    }
}

// ========== CLEANUP ==========
function cleanupDrag() {
    // Mobil Temizlik
    if (draggedItem) {
        draggedItem.style = '';
        draggedItem.classList.remove('dragging');
        // Source temizliği
        const original = document.querySelector('.travel-item.dragging-source');
        if (original) original.classList.remove('dragging-source');
    }
    draggedItem = null;

    // Masaüstü Temizlik
    const clone = document.getElementById('drag-clone');
    if (clone) clone.remove();

    // Placeholder Temizlik
    if (placeholder && placeholder.parentNode) placeholder.remove();
    placeholder = null;

    document.body.classList.remove('dragging-active');
    
    // Timerlar
    clearTimeout(longPressTimer);
    longPressTimer = null;
}

// ========== MOBILE HANDLERS ==========
function handleTouchStart(e) {
    const item = e.target.closest('.travel-item');
    if (!item || e.target.closest('button') || e.target.closest('.visual img')) return;

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    
    longPressTimer = setTimeout(() => {
        startMobileDrag(item, e.touches[0]);
    }, 250);
}

function startMobileDrag(item, touch) {
    draggedItem = item;
    sourceIndex = parseInt(item.dataset.index);
    
    const rect = item.getBoundingClientRect();
    mobileOffsetX = touch.clientX - rect.left;
    mobileOffsetY = touch.clientY - rect.top;

    // Item'ı fixed yapıp parmağa yapıştır
    item.style.width = rect.width + 'px';
    item.style.height = rect.height + 'px';
    item.style.left = (touch.clientX - mobileOffsetX) + 'px';
    item.style.top = (touch.clientY - mobileOffsetY) + 'px';
    
    item.classList.add('dragging');
    document.body.classList.add('dragging-active');
    
    // Hemen placeholder oluştur
    updatePlaceholder(touch.clientX, touch.clientY);
    
    if (navigator.vibrate) navigator.vibrate(50);
}

function handleTouchMove(e) {
    if (!draggedItem) {
        const dx = Math.abs(e.touches[0].clientX - touchStartX);
        const dy = Math.abs(e.touches[0].clientY - touchStartY);
        if (dx > 10 || dy > 10) clearTimeout(longPressTimer);
        return;
    }

    e.preventDefault();
    const touch = e.touches[0];

    draggedItem.style.left = (touch.clientX - mobileOffsetX) + 'px';
    draggedItem.style.top = (touch.clientY - mobileOffsetY) + 'px';

    // Kendisini gizle ki altındaki drop zone görünsün
    draggedItem.style.display = 'none';
    updatePlaceholder(touch.clientX, touch.clientY);
    draggedItem.style.display = 'block';
}

function handleTouchEnd(e) {
    clearTimeout(longPressTimer);
    if (!draggedItem) return;
    finalizeDrop();
}

// ========== DESKTOP HANDLERS ==========
function setupDesktopListeners() {
    const items = document.querySelectorAll('.travel-item');
    items.forEach(item => {
        item.setAttribute('draggable', true);
        item.removeEventListener('dragstart', onDesktopDragStart);
        item.removeEventListener('dragend', onDesktopDragEnd);
        item.addEventListener('dragstart', onDesktopDragStart);
        item.addEventListener('dragend', onDesktopDragEnd);
    });

    const lists = document.querySelectorAll('.day-list');
    lists.forEach(list => {
        list.removeEventListener('dragover', onDesktopDragOver);
        list.removeEventListener('drop', onDesktopDrop);
        list.addEventListener('dragover', onDesktopDragOver);
        list.addEventListener('drop', onDesktopDrop);
    });
}

function onDesktopDragStart(e) {
    draggedItem = e.currentTarget;
    sourceIndex = parseInt(draggedItem.dataset.index);
    
    // Klon yerine hayalet sınıfı kullanıyoruz
    setTimeout(() => draggedItem.classList.add('dragging-source'), 0);
    
    // Klon oluştur (Görsel takip için)
    const rect = draggedItem.getBoundingClientRect();
    desktopDragOffsetX = e.clientX - rect.left;
    desktopDragOffsetY = e.clientY - rect.top;
    
    const clone = draggedItem.cloneNode(true);
    clone.id = 'drag-clone';
    clone.style.width = rect.width + 'px';
    clone.style.height = rect.height + 'px';
    // İçeriği temizle (performans)
    const content = clone.querySelector('.content');
    if(content) content.style.display = 'none';
    
    document.body.appendChild(clone);
    updateDesktopClone(e.clientX, e.clientY);

    // Tarayıcı hayaletini gizle
    const emptyImg = new Image();
    emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(emptyImg, 0, 0);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', sourceIndex);

    document.addEventListener('dragover', onDesktopDragMove);
    document.body.classList.add('dragging-active');
}

function onDesktopDragMove(e) {
    updateDesktopClone(e.clientX, e.clientY);
}

function updateDesktopClone(x, y) {
    const clone = document.getElementById('drag-clone');
    if (clone) {
        clone.style.left = (x - desktopDragOffsetX) + 'px';
        clone.style.top = (y - desktopDragOffsetY) + 'px';
    }
}

function onDesktopDragOver(e) {
    e.preventDefault();
    updatePlaceholder(e.clientX, e.clientY);
}

function onDesktopDrop(e) {
    e.preventDefault();
    finalizeDrop();
}

function onDesktopDragEnd(e) {
    document.removeEventListener('dragover', onDesktopDragMove);
    cleanupDrag();
}

// ========== EXPORTS & INIT ==========
window.dragStart = onDesktopDragStart; 
window.initDragDropSystem = initDragDropSystem;
window.attachDragListeners = function() {
    setupDropZones(); // Desktop için tekrar bağla
    if (!isMobile) setupDesktopListeners();
};
window.attachChatDropListeners = function(){}; 

// Helper setup
function setupDropZones() {
    if (!isMobile) setupDesktopListeners();
}

document.addEventListener('DOMContentLoaded', initDragDropSystem);