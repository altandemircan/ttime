// ========== STYLES (Görsel Hissiyat) ==========
function injectDragStyles() {
    const styleId = 'tt-drag-styles';
    if (document.getElementById(styleId)) return;
    const css = `
        .travel-item.dragging, #drag-clone {
            opacity: 0.9;
            background: #fff;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            transform: scale(1.02);
            z-index: 10000;
            pointer-events: none; /* Altını görmesi için şart */
            position: fixed;
            border: 2px solid #8a4af3;
            border-radius: 8px;
            margin: 0;
            will-change: top, left;
        }
        .travel-item.dragging-source {
            opacity: 0.2;
            background: #f0f0f0;
            border: 1px dashed #ccc;
        }
        .insertion-placeholder {
            height: 6px;
            background: linear-gradient(90deg, #8a4af3, #b388ff);
            margin: 8px 0;
            border-radius: 4px;
            box-shadow: 0 0 8px rgba(138, 74, 243, 0.4);
            pointer-events: none;
        }
        body.dragging-active {
            overflow: hidden;
            touch-action: none;
            user-select: none;
        }
    `;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = css;
    document.head.appendChild(style);
}

// ========== GLOBAL VARIABLES ==========
if (!window.cart) window.cart = [];

let draggedItem = null;         // Şu an sürüklenen DOM elemanı
let placeholder = null;         // Araya giren mor çizgi
let sourceIndex = -1;           // Başlangıç indeksi
let isMobile = false;

// Mobil için koordinat takibi
let touchStartX, touchStartY;
let mobileOffsetX, mobileOffsetY;
let longPressTimer;

// ========== INITIALIZATION ==========
function initDragDropSystem() {
    injectDragStyles();
    isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (isMobile) {
        // Mobil: Global touch listener
        document.body.addEventListener('touchstart', handleTouchStart, { passive: false });
        document.body.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.body.addEventListener('touchend', handleTouchEnd);
    } else {
        // Desktop: Item'lara listener ekle
        setupDesktopListeners();
    }
}

// ========== CORE LOGIC: EN YAKIN ELEMANI BUL (Klasik Yöntem) ==========
/**
 * Verilen Y koordinatına (mouseY) göre, placeholder'ın
 * HANGİ elemandan ÖNCE (before) gelmesi gerektiğini bulur.
 */
function getDragAfterElement(container, y) {
    // Sürüklenen hariç diğer item'ları al
    const draggableElements = [...container.querySelectorAll('.travel-item:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        // offset: Mouse ile elemanın merkezi arasındaki mesafe
        const offset = y - box.top - box.height / 2;
        
        // Mouse elemanın üst yarısındaysa (offset < 0) ve 
        // şu ana kadar bulduğumuz en yakın elemansa (offset > closest.offset)
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// ========== LOGIC: PLACEHOLDER YERLEŞTİRME ==========
function updatePlaceholderPosition(clientX, clientY) {
    // Mouse'un altındaki listeyi bul
    // pointer-events: none olduğu için draggedItem delinip geçilir.
    const elementBelow = document.elementFromPoint(clientX, clientY);
    if (!elementBelow) return;

    const dropZone = elementBelow.closest('.day-list');
    if (!dropZone) return;

    // Placeholder henüz yoksa oluştur
    if (!placeholder) {
        placeholder = document.createElement('div');
        placeholder.className = 'insertion-placeholder';
    }

    // Matematiksel olarak arasına girmemiz gereken elemanı bul
    const afterElement = getDragAfterElement(dropZone, clientY);
    const addBtn = dropZone.querySelector('.add-more-btn');

    if (afterElement == null) {
        // Eğer bizden sonra eleman yoksa (listenin sonundaysak)
        if (addBtn) {
            dropZone.insertBefore(placeholder, addBtn); // Butonun önüne koy
        } else {
            dropZone.appendChild(placeholder); // Buton yoksa en sona koy
        }
    } else {
        // Bulunan elemanın önüne koy
        dropZone.insertBefore(placeholder, afterElement);
    }
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
    
    // Hayalet görüntüyü özelleştir veya tarayıcıya bırak
    // Burada basitlik adına tarayıcı defaultunu kullanıyoruz ama class ekliyoruz
    setTimeout(() => draggedItem.classList.add('dragging-source'), 0);
    
    e.dataTransfer.effectAllowed = 'move';
    // Firefox için gerekli
    e.dataTransfer.setData('text/plain', sourceIndex);
    
    document.body.classList.add('dragging-active');
}

function onDesktopDragOver(e) {
    e.preventDefault(); // Drop'a izin ver
    updatePlaceholderPosition(e.clientX, e.clientY);
}

function onDesktopDrop(e) {
    e.preventDefault();
    finalizeDrag();
}

function onDesktopDragEnd(e) {
    draggedItem.classList.remove('dragging-source');
    draggedItem = null;
    if (placeholder) placeholder.remove();
    placeholder = null;
    document.body.classList.remove('dragging-active');
}

// ========== MOBILE HANDLERS ==========
function handleTouchStart(e) {
    const item = e.target.closest('.travel-item');
    // Buton vs engelle
    if (!item || e.target.closest('button') || e.target.closest('.visual img')) return;

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    
    // Long press bekle
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

    // Görsel kopyayı ayarla (Item'ın kendisini fixed yapıyoruz)
    item.style.width = rect.width + 'px';
    item.style.height = rect.height + 'px';
    item.style.left = (touch.clientX - mobileOffsetX) + 'px';
    item.style.top = (touch.clientY - mobileOffsetY) + 'px';
    
    item.classList.add('dragging');
    document.body.classList.add('dragging-active');
    
    // Placeholder hemen oluşturulup eski yerine konmalı ki liste çökmesin
    if (!placeholder) {
        placeholder = document.createElement('div');
        placeholder.className = 'insertion-placeholder';
    }
    item.parentNode.insertBefore(placeholder, item.nextSibling);

    if (navigator.vibrate) navigator.vibrate(50);
}

function handleTouchMove(e) {
    // Drag başlamadıysa ve hareket varsa timer iptal (scroll)
    if (!draggedItem) {
        const dx = Math.abs(e.touches[0].clientX - touchStartX);
        const dy = Math.abs(e.touches[0].clientY - touchStartY);
        if (dx > 10 || dy > 10) clearTimeout(longPressTimer);
        return;
    }

    e.preventDefault(); // Scroll engelle
    const touch = e.touches[0];

    // Kutuyu hareket ettir
    draggedItem.style.left = (touch.clientX - mobileOffsetX) + 'px';
    draggedItem.style.top = (touch.clientY - mobileOffsetY) + 'px';

    // Placeholder'ı güncelle
    updatePlaceholderPosition(touch.clientX, touch.clientY);
}

function handleTouchEnd(e) {
    clearTimeout(longPressTimer);
    if (!draggedItem) return;

    finalizeDrag();
    
    // Temizlik
    draggedItem.style = '';
    draggedItem.classList.remove('dragging');
    draggedItem = null;
    
    if (placeholder) placeholder.remove();
    placeholder = null;
    
    document.body.classList.remove('dragging-active');
}

// ========== SHARED FINALIZATION ==========
function finalizeDrag() {
    if (!placeholder || !placeholder.parentNode || !draggedItem) return;

    const dropList = placeholder.parentNode; // Bırakılan gün listesi
    const toDay = parseInt(dropList.dataset.day);
    
    // Placeholder'ın indexini bul (Yeni pozisyon)
    // Sadece .travel-item'ları sayarak indeks bulmalıyız
    const siblings = [...dropList.children].filter(c => c.classList.contains('travel-item') && c !== draggedItem);
    
    // Placeholder'dan sonraki elemanı bul
    let nextItem = placeholder.nextElementSibling;
    while(nextItem && !nextItem.classList.contains('travel-item')) {
        nextItem = nextItem.nextElementSibling;
    }

    let toIndex;
    if (nextItem) {
        toIndex = siblings.indexOf(nextItem);
        if (toIndex === -1) toIndex = siblings.length;
    } else {
        toIndex = siblings.length;
    }

    // Kaynak verileri
    const fromIndex = sourceIndex;
    const fromItem = window.cart[fromIndex];
    if (!fromItem) return;
    const fromDay = fromItem.day;

    // Aynı yere bırakıldıysa iptal
    // (Aynı gün ve indeks değişmediyse)
    // Not: Bu kontrolü basitleştirmek için direkt reorder çağırıp, reorder içinde kontrol edebiliriz
    // ama performans için burada kesmek iyidir. Ancak "sıra kayması" hesabını burada yapmak karışık olabilir.
    // O yüzden direkt reorderCart'a gönderelim, o halletsin.

    reorderCart(fromIndex, toIndex, fromDay, toDay);
}

function reorderCart(fromIndex, toIndex, fromDay, toDay) {
    try {
        // Array kopyala
        const newCart = [...window.cart];
        
        // Öğeyi çıkar
        const [movedItem] = newCart.splice(fromIndex, 1);
        movedItem.day = toDay;

        // Hedef listeye ekle
        // Hedef listedeki elemanları bulmamız lazım global cart içinde
        // Bu kısım biraz trikli çünkü global cart karışık günlerden oluşuyor.
        
        // 1. Hedef günün elemanlarını ayır
        let targetDayItems = newCart.filter(i => i.day === toDay);
        // 2. Diğer elemanları ayır
        let otherItems = newCart.filter(i => i.day !== toDay);
        
        // 3. Hedef gün içine doğru indekse yerleştir
        // NOT: fromDay === toDay ise, splice işlemi indeksleri kaydırmış olabilir.
        // Ama yukarıdaki `toIndex` placeholder'a göre görsel indeks.
        targetDayItems.splice(toIndex, 0, movedItem);
        
        // 4. Cart'ı birleştir (Sıralamayı koruyarak veya gün bazlı yeniden oluşturarak)
        // Günleri sırayla birleştirmek en temizidir.
        const allDays = new Set([...otherItems.map(i=>i.day), toDay]);
        const sortedDays = [...allDays].sort((a,b)=>a-b);
        
        let finalCart = [];
        sortedDays.forEach(d => {
            if (d === toDay) {
                finalCart = finalCart.concat(targetDayItems);
            } else {
                finalCart = finalCart.concat(otherItems.filter(i => i.day === d));
            }
        });

        window.cart = finalCart;

        if (typeof updateCart === "function") updateCart();
        if (typeof saveCurrentTripToStorage === "function") saveCurrentTripToStorage();

    } catch (e) {
        console.error("Reorder Error", e);
    }
}

// ========== EXPORTS & INIT ==========
window.dragStart = onDesktopDragStart; // mainscript uyumluluğu için
window.initDragDropSystem = initDragDropSystem;
window.attachDragListeners = function() {
    setupDropZones(); // Desktop için tekrar bağla
    // Mobil zaten body delegate kullandığı için gerekmez
    if (!isMobile) setupDesktopListeners();
};
window.attachChatDropListeners = function(){}; // Boş fonksiyon (hata önlemek için)

// Helper setup function for updateCart re-renders
function setupDropZones() {
    // Sadece Desktop eventlerini yenilemek yeterli
    if (!isMobile) setupDesktopListeners();
}

document.addEventListener('DOMContentLoaded', initDragDropSystem);