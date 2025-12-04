// ========== STYLES (Görsel Hissiyat) ==========
function injectDragStyles() {
    const styleId = 'tt-drag-styles';
    if (document.getElementById(styleId)) return;
    const css = `
        /* Sürüklenen Öğe */
        .travel-item.dragging, #drag-clone {
            opacity: 0.95;
            background: #fff;
            box-shadow: 0 15px 35px rgba(0,0,0,0.3);
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
            opacity: 0.1 !important;
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
// Y koordinatına göre, item'ın HANGİSİNİN ÜSTÜNE gelmesi gerektiğini bulur.
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.travel-item:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        // Mouse elemanın üst yarısındaysa ve en yakınsa
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// ========== PLACEHOLDER MANTIĞI (ORTAK) ==========
function updatePlaceholder(clientX, clientY) {
    // 1. Mouse'un altındaki listeyi bul
    const elementBelow = document.elementFromPoint(clientX, clientY);
    if (!elementBelow) return;

    const dropZone = elementBelow.closest('.day-list');
    if (!dropZone) return;

    // 2. Placeholder yoksa oluştur
    if (!placeholder) {
        placeholder = document.createElement('div');
        placeholder.className = 'insertion-placeholder';
    }

    // 3. Nereye gireceğini matematiksel olarak bul
    const afterElement = getDragAfterElement(dropZone, clientY);
    const addBtn = dropZone.querySelector('.add-more-btn');

    // 4. DOM'a yerleştir (Görsel Tepki)
    if (afterElement == null) {
        // Listenin sonuna (Add butonunun üstüne)
        if (addBtn) {
            dropZone.insertBefore(placeholder, addBtn);
        } else {
            dropZone.appendChild(placeholder);
        }
    } else {
        // Bulunan elemanın üstüne
        dropZone.insertBefore(placeholder, afterElement);
    }
}

// ========== MOBILE HANDLERS ==========
function handleTouchStart(e) {
    const item = e.target.closest('.travel-item');
    if (!item || e.target.closest('button') || e.target.closest('.visual img')) return;

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    
    // Uzun basma bekle (Scroll ile karışmasın diye)
    longPressTimer = setTimeout(() => {
        startMobileDrag(item, e.touches[0]);
    }, 250);
}

function startMobileDrag(item, touch) {
    draggedItem = item;
    sourceIndex = parseInt(item.dataset.index);
    
    // Offset hesapla ki parmak item'ın neresinden tuttuysa oradan taşısın
    const rect = item.getBoundingClientRect();
    mobileOffsetX = touch.clientX - rect.left;
    mobileOffsetY = touch.clientY - rect.top;

    // Görsel ayarlar (Fixed yapıp parmağa yapıştır)
    item.style.width = rect.width + 'px';
    item.style.height = rect.height + 'px';
    item.style.left = (touch.clientX - mobileOffsetX) + 'px';
    item.style.top = (touch.clientY - mobileOffsetY) + 'px';
    
    item.classList.add('dragging');
    document.body.classList.add('dragging-active');
    
    // Titreşim
    if (navigator.vibrate) navigator.vibrate(50);
}

function handleTouchMove(e) {
    // Drag başlamadıysa scroll kontrolü
    if (!draggedItem) {
        const dx = Math.abs(e.touches[0].clientX - touchStartX);
        const dy = Math.abs(e.touches[0].clientY - touchStartY);
        if (dx > 10 || dy > 10) clearTimeout(longPressTimer);
        return;
    }

    e.preventDefault(); // Sayfa kaymasını engelle
    const touch = e.touches[0];

    // 1. Kutuyu hareket ettir
    draggedItem.style.left = (touch.clientX - mobileOffsetX) + 'px';
    draggedItem.style.top = (touch.clientY - mobileOffsetY) + 'px';

    // 2. Placeholder'ı güncelle (Görsel olarak nereye gireceğini göster)
    // draggedItem'ı geçici gizle ki elementFromPoint altını görsün
    draggedItem.style.display = 'none';
    updatePlaceholder(touch.clientX, touch.clientY);
    draggedItem.style.display = 'block';
}

function handleTouchEnd(e) {
    clearTimeout(longPressTimer);
    if (!draggedItem) return;

    // Sürükleme bitti, işlemi uygula
    applyDrop();
    
    // Temizlik
    draggedItem.style = '';
    draggedItem.classList.remove('dragging');
    draggedItem = null;
    document.body.classList.remove('dragging-active');
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
    setTimeout(() => draggedItem.classList.add('dragging-source'), 0);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', sourceIndex);
    document.body.classList.add('dragging-active');
}

function onDesktopDragOver(e) {
    e.preventDefault();
    updatePlaceholder(e.clientX, e.clientY);
}

function onDesktopDrop(e) {
    e.preventDefault();
    applyDrop();
}

function onDesktopDragEnd(e) {
    draggedItem.classList.remove('dragging-source');
    draggedItem = null;
    if (placeholder) placeholder.remove();
    placeholder = null;
    document.body.classList.remove('dragging-active');
}

// ========== CORE LOGIC: APPLY DROP (TRUST THE PLACEHOLDER) ==========
function applyDrop() {
    // Eğer placeholder yoksa veya bir yere takılı değilse iptal
    if (!placeholder || !placeholder.parentNode) {
        if (placeholder) placeholder.remove();
        placeholder = null;
        return;
    }

    const dropList = placeholder.parentNode; // Bırakılan Gün Listesi
    const toDay = parseInt(dropList.dataset.day);
    
    // --- KRİTİK NOKTA: İNDEKSİ PLACEHOLDER'A GÖRE BUL ---
    // Placeholder şu an listede görsel olarak duruyor. 
    // Onun hemen sonrasındaki elemanı (nextSibling) bulursak,
    // bizim elemanımız da array'de onun önüne gelmelidir.
    
    // Listede sadece gerçek "travel-item"ları dikkate alacağız.
    const siblings = [...dropList.children].filter(c => c.classList.contains('travel-item') && c !== draggedItem);
    
    // Placeholder'dan sonraki ilk "travel-item"ı bul
    let nextItem = placeholder.nextElementSibling;
    while(nextItem && !nextItem.classList.contains('travel-item')) {
        nextItem = nextItem.nextElementSibling;
    }

    let toIndex;
    if (nextItem) {
        // Eğer bir elemanın önüne geldiyse, o elemanın indeksini al
        toIndex = siblings.indexOf(nextItem);
        // Güvenlik: Eğer bulunamazsa sona at
        if (toIndex === -1) toIndex = siblings.length;
    } else {
        // Eğer sonrasında eleman yoksa (listenin sonu), length kadar indeks ver
        toIndex = siblings.length;
    }

    // Kaynak verisi
    const fromIndex = sourceIndex;
    const fromItem = window.cart[fromIndex];
    if (!fromItem) {
        if (placeholder) placeholder.remove();
        return;
    }
    const fromDay = fromItem.day;

    // Placeholder'ı DOM'dan temizle
    placeholder.remove();
    placeholder = null;

    // Veriyi güncelle
    reorderCart(fromIndex, toIndex, fromDay, toDay);
}

// ========== DATA UPDATE ==========
function reorderCart(fromIndex, toIndex, fromDay, toDay) {
    try {
        const newCart = [...window.cart];
        
        // 1. Öğeyi eski yerinden sök
        const [movedItem] = newCart.splice(fromIndex, 1);
        movedItem.day = toDay;

        // 2. Hedef gün ve diğer günleri ayır
        let targetDayItems = newCart.filter(i => i.day === toDay);
        let otherItems = newCart.filter(i => i.day !== toDay);
        
        // 3. Hedef gün içine, HESAPLANAN "toIndex" konumuna yerleştir
        // Splice: (index, silinecekSayısı, eklenecekÖğe)
        targetDayItems.splice(toIndex, 0, movedItem);
        
        // 4. Tekrar birleştir (Gün sırasını koruyarak)
        const allDays = new Set([...window.cart.map(i=>i.day), toDay]); // Mevcut günler + hedef gün
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

// ========== EXPORTS & HELPERS ==========
window.dragStart = onDesktopDragStart; 
window.initDragDropSystem = initDragDropSystem;
window.attachDragListeners = function() {
    // UpdateCart sonrası listenerları yenile
    if (isMobile) {
        // Mobilde body delegate olduğu için bir şey yapmaya gerek yok
    } else {
        setupDesktopListeners();
    }
};
// Mainscript hatasını önlemek için boş fonksiyon
window.attachChatDropListeners = function(){}; 

document.addEventListener('DOMContentLoaded', initDragDropSystem);