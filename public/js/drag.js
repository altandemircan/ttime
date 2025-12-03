// ========== DRAG.JS - ROBUST MOBILE & DESKTOP HANDLING ==========

if (!window.cart || !Array.isArray(window.cart)) window.cart = [];

// Durum Değişkenleri
let draggedItem = null;
let clone = null;
let placeholder = null;
let isDragging = false;

// Dokunma Koordinatları
let touchStartX = 0;
let touchStartY = 0;
let touchOffsetX = 0;
let touchOffsetY = 0;

// Zamanlayıcılar
let longPressTimer = null;
let autoScrollInterval = null;

// Ayarlar
const LONG_PRESS_DURATION = 250; // ms (Trello hissi için ideal)
const SCROLL_ZONE_HEIGHT = 80;   // Auto-scroll bölgesi (px)
const SCROLL_SPEED = 15;         // Auto-scroll hızı

// Başlangıç
document.addEventListener('DOMContentLoaded', initDragSystem);

function initDragSystem() {
    // Gerekli CSS'i enjekte et (Tasarım dosyana dokunmadan)
    injectDragStyles();
    
    // Eventleri bağla
    attachGlobalListeners();
}

function injectDragStyles() {
    if (document.getElementById('tt-drag-styles')) return;
    const style = document.createElement('style');
    style.id = 'tt-drag-styles';
    style.innerHTML = `
        /* Sürüklenen öğenin hayaleti (Clone) */
        .drag-clone {
            position: fixed;
            z-index: 10000;
            pointer-events: none; /* Altındaki öğeyi görebilmek için */
            opacity: 0.9;
            box-shadow: 0 15px 30px rgba(0,0,0,0.25);
            transform: scale(1.02) rotate(2deg); /* Trello efekti */
            transition: none; /* Anlık takip için */
        }
        
        /* Orijinal öğe sürüklenirken */
        .travel-item.is-dragging {
            opacity: 0;
        }

        /* Yer tutucu (Placeholder) */
        .drag-placeholder {
            background: rgba(0, 0, 0, 0.04);
            border: 2px dashed rgba(0, 0, 0, 0.1);
            border-radius: 8px;
            margin: 5px 0;
            pointer-events: none;
        }

        /* Drag sırasında body kilitleme */
        body.dragging-active {
            user-select: none;
            -webkit-user-select: none;
            overflow: hidden; /* Scrollu kapat */
            touch-action: none;
        }
    `;
    document.head.appendChild(style);
}

function attachGlobalListeners() {
    const container = document.body;

    // --- MOBILE TOUCH EVENTS ---
    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('touchcancel', onTouchEnd);

    // --- DESKTOP MOUSE EVENTS ---
    // Desktop için native HTML5 Drag&Drop yerine Mouse eventleri kullanıyoruz 
    // çünkü hibrit (dokunmatik laptop) cihazlarda daha stabil çalışır.
    container.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

// ==========================================
//              MOBILE LOGIC
// ==========================================

function onTouchStart(e) {
    if (e.touches.length !== 1) return; // Sadece tek parmak

    const target = e.target.closest('.travel-item');
    // Butonlara (sil, edit vb.) basıldıysa iptal
    if (!target || e.target.closest('button') || e.target.closest('a') || e.target.closest('.action-menu')) {
        return;
    }

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;

    // Offset hesapla (Öğenin neresinden tutuldu?)
    const rect = target.getBoundingClientRect();
    touchOffsetX = touchStartX - rect.left;
    touchOffsetY = touchStartY - rect.top;

    // Zamanlayıcıyı başlat
    draggedItem = target;
    longPressTimer = setTimeout(() => {
        startDrag(target, touchStartX, touchStartY);
    }, LONG_PRESS_DURATION);
}

function onTouchMove(e) {
    if (!draggedItem) return;

    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartX);
    const dy = Math.abs(touch.clientY - touchStartY);

    // 1. HENÜZ DRAG BAŞLAMADIYSA
    if (!isDragging) {
        // Eğer parmak 10px'den fazla oynarsa -> Kullanıcı scroll yapmak istiyor
        if (dx > 10 || dy > 10) {
            clearTimeout(longPressTimer);
            draggedItem = null;
        }
        return; // Scroll'a izin ver
    }

    // 2. DRAG BAŞLADIYSA
    if (e.cancelable) e.preventDefault(); // Sayfa scrollunu engelle

    updateDragPosition(touch.clientX, touch.clientY);
    handleAutoScroll(touch.clientY);
    checkDropZone(touch.clientX, touch.clientY);
}

function onTouchEnd(e) {
    clearTimeout(longPressTimer);
    if (isDragging) {
        finishDrag();
    }
    resetState();
}

// ==========================================
//              DESKTOP LOGIC
// ==========================================

function onMouseDown(e) {
    if (e.button !== 0) return; // Sadece sol tık

    const target = e.target.closest('.travel-item');
    if (!target || e.target.closest('button') || e.target.closest('a')) return;

    touchStartX = e.clientX;
    touchStartY = e.clientY;

    const rect = target.getBoundingClientRect();
    touchOffsetX = touchStartX - rect.left;
    touchOffsetY = touchStartY - rect.top;

    draggedItem = target;
    
    // Desktop'ta long-press gerekmez, hemen başlasın ama azıcık hareket bekleyelim
    // (Yanlış tıklamaları önlemek için)
}

function onMouseMove(e) {
    if (!draggedItem) return;

    // Drag henüz başlamadıysa ve hareket varsa başlat
    if (!isDragging) {
        const dx = Math.abs(e.clientX - touchStartX);
        const dy = Math.abs(e.clientY - touchStartY);
        if (dx > 5 || dy > 5) {
            startDrag(draggedItem, e.clientX, e.clientY);
        }
        return;
    }

    e.preventDefault();
    updateDragPosition(e.clientX, e.clientY);
    handleAutoScroll(e.clientY);
    checkDropZone(e.clientX, e.clientY);
}

function onMouseUp(e) {
    if (isDragging) {
        finishDrag();
    }
    resetState();
}

// ==========================================
//              CORE LOGIC
// ==========================================

function startDrag(item, x, y) {
    isDragging = true;
    document.body.classList.add('dragging-active');

    // Titreşim (Mobil hissi)
    if (navigator.vibrate) navigator.vibrate(30);

    // 1. Placeholder oluştur (Listenin çökmesini engellemek için)
    placeholder = document.createElement('li');
    placeholder.className = 'drag-placeholder';
    placeholder.style.height = `${item.offsetHeight}px`;
    item.parentNode.insertBefore(placeholder, item);

    // 2. Clone oluştur (Sürüklenecek görsel)
    clone = item.cloneNode(true);
    clone.classList.add('drag-clone');
    // Genişliği sabitle
    clone.style.width = `${item.offsetWidth}px`;
    clone.style.height = `${item.offsetHeight}px`;
    document.body.appendChild(clone);

    // 3. Orijinal öğeyi gizle
    item.classList.add('is-dragging');

    // İlk pozisyon
    updateDragPosition(x, y);
}

function updateDragPosition(x, y) {
    if (!clone) return;
    clone.style.left = `${x - touchOffsetX}px`;
    clone.style.top = `${y - touchOffsetY}px`;
}

function checkDropZone(x, y) {
    // Clone'u geçici olarak görünmez yap ki altındaki elemanı bulabilelim
    clone.style.display = 'none';
    const elemBelow = document.elementFromPoint(x, y);
    clone.style.display = 'block';

    if (!elemBelow) return;

    // Hedef bir travel-item mı?
    const targetItem = elemBelow.closest('.travel-item');
    const targetList = elemBelow.closest('.day-list');

    // Eğer bir listenin üzerindeysek
    if (targetList) {
        // Eğer bir item'ın üzerindeysek
        if (targetItem && targetItem !== draggedItem && targetItem !== placeholder) {
            const rect = targetItem.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            
            if (y < midpoint) {
                targetList.insertBefore(placeholder, targetItem);
            } else {
                targetList.insertBefore(placeholder, targetItem.nextSibling);
            }
        } 
        // Liste boşsa veya item yoksa ama listenin içindeysek
        else if (!targetItem && targetList.children.length === 0) {
            targetList.appendChild(placeholder);
        }
        // Listenin sonuna geldiysek
        else if (!targetItem) {
             targetList.appendChild(placeholder);
        }
    }
}

function handleAutoScroll(y) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;

    const windowHeight = window.innerHeight;
    let scrollAmount = 0;

    if (y < SCROLL_ZONE_SIZE) {
        scrollAmount = -SCROLL_SPEED; // Yukarı
    } else if (y > windowHeight - SCROLL_ZONE_SIZE) {
        scrollAmount = SCROLL_SPEED; // Aşağı
    }

    if (scrollAmount !== 0) {
        autoScrollInterval = setInterval(() => {
            window.scrollBy(0, scrollAmount);
        }, 16);
    }
}

function finishDrag() {
    if (!placeholder || !draggedItem) return;

    // 1. Öğeyi yeni yerine taşı
    placeholder.parentNode.insertBefore(draggedItem, placeholder);
    
    // 2. Görsel temizlik
    draggedItem.classList.remove('is-dragging');
    if (clone) clone.remove();
    if (placeholder) placeholder.remove();

    // 3. Veri Güncellemesi (Window.cart)
    updateCartData();
}

function resetState() {
    isDragging = false;
    draggedItem = null;
    clone = null;
    placeholder = null;
    clearInterval(autoScrollInterval);
    clearTimeout(longPressTimer);
    document.body.classList.remove('dragging-active');
}

// ==========================================
//              DATA UPDATE
// ==========================================

function updateCartData() {
    // DOM sırasına göre Window.cart'ı yeniden oluştur
    const newCart = [];
    
    // Tüm gün containerlarını gez
    const dayContainers = document.querySelectorAll('.day-container');
    
    dayContainers.forEach(container => {
        const day = parseInt(container.dataset.day);
        const items = container.querySelectorAll('.travel-item');
        
        items.forEach(item => {
            const oldIndex = parseInt(item.dataset.index);
            const cartItem = window.cart[oldIndex];
            
            if (cartItem) {
                // Gün değiştiyse güncelle
                if (cartItem.day !== day) {
                    cartItem.day = day;
                }
                newCart.push(cartItem);
            }
        });
    });

    // Ana cart'ı güncelle
    window.cart = newCart;

    // UI'ı güncelle (ama drag bitiminde tüm listeyi repaint etmemek daha yumuşak olur)
    // Sadece gerekli fonksiyonları çağır
    if (typeof updateCart === 'function') {
        // Tam repaint yerine sadece indeksleri ve haritaları güncellemek daha iyi olabilir
        // Ama şimdilik garanti olması için updateCart çağırıyoruz.
        updateCart(); 
    }
    
    if (typeof saveCurrentTripToStorage === 'function') saveCurrentTripToStorage();
    
    // Rotaları tekrar çiz (sıra değiştiği için)
    const uniqueDays = [...new Set(window.cart.map(i => i.day))];
    if (typeof renderRouteForDay === 'function') {
        uniqueDays.forEach(d => renderRouteForDay(d));
    }
}