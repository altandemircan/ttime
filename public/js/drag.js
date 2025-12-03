// ========== DRAG.JS - STABIL MOBİL & MOR ÇİZGİ ==========

if (!window.cart || !Array.isArray(window.cart)) window.cart = [];

// Durumlar
let draggedItem = null;
let clone = null;
let placeholder = null;
let isDragging = false;

// Koordinatlar
let touchStartX = 0;
let touchStartY = 0;
let touchOffsetX = 0;
let touchOffsetY = 0;

// Zamanlayıcılar
let longPressTimer = null;
let autoScrollInterval = null;

// Ayarlar
const LONG_PRESS_DURATION = 250; // 250ms basılı tutunca başlar
const MOVE_THRESHOLD = 10;       // 10px oynarsa iptal (scroll sayılır)
const SCROLL_ZONE_HEIGHT = 80;   
const SCROLL_SPEED = 15;         

// 1. CSS Enjeksiyonu (Mor Çizgi & Clone Stili)
(function injectDragStyles() {
    if (document.getElementById('tt-drag-logic-style')) return;
    const style = document.createElement('style');
    style.id = 'tt-drag-logic-style';
    style.innerHTML = `
        /* Sürüklenen kopya (Hayalet) */
        .drag-clone {
            position: fixed; 
            z-index: 99999; 
            pointer-events: none; /* Tıklamayı engelleme, altını gör */
            opacity: 0.95; 
            box-shadow: 0 15px 35px rgba(0,0,0,0.3);
            transform: scale(1.03) rotate(2deg); 
            background: #fff; 
            list-style: none; 
            border-radius: 8px;
            width: var(--drag-width);
            height: var(--drag-height);
        }
        
        /* Orijinal öğe yerinde kalsın ama görünmesin */
        .travel-item.is-dragging { 
            opacity: 0.0 !important; 
        }
        
        /* --- MOR KALIN ÇİZGİ PLACEHOLDER --- */
        .drag-placeholder {
            height: 4px !important;
            background: #8a4af3 !important;
            border-radius: 2px;
            margin: 6px 0;
            box-shadow: 0 0 8px rgba(138, 74, 243, 0.5);
            list-style: none;
            display: block;
        }
        
        /* Drag sırasında sayfa kaymasını engelle */
        body.dragging-active { 
            user-select: none; 
            touch-action: none; /* Mobilde sayfa kaymasını kilitler */
            -webkit-user-select: none;
        }
    `;
    document.head.appendChild(style);
})();

// 2. Global Event Dinleyicileri
// { passive: false } -> preventDefault kullanabilmek için şart!
document.addEventListener('touchstart', onTouchStart, { passive: false });
document.addEventListener('touchmove', onTouchMove, { passive: false });
document.addEventListener('touchend', onTouchEnd);
document.addEventListener('touchcancel', onTouchEnd);

// Desktop Mouse
document.addEventListener('mousedown', onMouseDown);
document.addEventListener('mousemove', onMouseMove);
document.addEventListener('mouseup', onMouseUp);

// --- MOBİL (TOUCH) MANTIĞI ---
function onTouchStart(e) {
    if (e.touches.length !== 1) return; // Çoklu parmak yok
    const target = e.target.closest('.travel-item');
    
    // Butonlara veya linklere basıldıysa drag başlatma
    if (!target || e.target.closest('button') || e.target.closest('a') || e.target.closest('.action-menu')) return;

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    
    // Offset: Parmağın öğenin neresine dokunduğu
    const rect = target.getBoundingClientRect();
    touchOffsetX = touchStartX - rect.left;
    touchOffsetY = touchStartY - rect.top;

    draggedItem = target;

    // Zamanlayıcı başlat (Trello mantığı)
    longPressTimer = setTimeout(() => {
        startDrag(target, touchStartX, touchStartY);
    }, LONG_PRESS_DURATION);
}

function onTouchMove(e) {
    const touch = e.touches[0];

    // 1. Henüz Drag Başlamadıysa (Basılı tutuyor ama süre dolmadı)
    if (!isDragging) {
        if (draggedItem) {
            const dx = Math.abs(touch.clientX - touchStartX);
            const dy = Math.abs(touch.clientY - touchStartY);
            
            // Eğer parmak çok oynadıysa (Kullanıcı scroll yapmak istiyor)
            if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
                clearTimeout(longPressTimer);
                draggedItem = null;
                longPressTimer = null;
            }
        }
        return; // Sayfa normal şekilde kayabilir (scroll)
    }

    // 2. Drag Başladıysa (Süre doldu, mod aktif)
    if (e.cancelable) e.preventDefault(); // Sayfa kaymasını engelle!
    
    updateDragPosition(touch.clientX, touch.clientY);
    handleAutoScroll(touch.clientY);
    checkDropZone(touch.clientX, touch.clientY);
}

function onTouchEnd() {
    clearTimeout(longPressTimer); // Erken bıraktıysa iptal
    if (isDragging) finishDrag();
    resetState();
}

// --- DESKTOP (MOUSE) MANTIĞI ---
function onMouseDown(e) {
    if (e.button !== 0) return;
    const target = e.target.closest('.travel-item');
    if (!target || e.target.closest('button') || e.target.closest('a')) return;

    touchStartX = e.clientX;
    touchStartY = e.clientY;
    const rect = target.getBoundingClientRect();
    touchOffsetX = touchStartX - rect.left;
    touchOffsetY = touchStartY - rect.top;

    draggedItem = target;
    // Desktopta bekleme süresi yok, hareket edince başlar
}

function onMouseMove(e) {
    if (!draggedItem) return;
    
    if (!isDragging) {
        // 5px hareket edince başlat (yanlış tıklamayı önler)
        if (Math.abs(e.clientX - touchStartX) > 5 || Math.abs(e.clientY - touchStartY) > 5) {
            startDrag(draggedItem, e.clientX, e.clientY);
        }
        return;
    }

    e.preventDefault();
    updateDragPosition(e.clientX, e.clientY);
    handleAutoScroll(e.clientY);
    checkDropZone(e.clientX, e.clientY);
}

function onMouseUp() {
    if (isDragging) finishDrag();
    resetState();
}

// --- ÇEKİRDEK FONKSİYONLAR ---

function startDrag(item, x, y) {
    if (!item) return;
    isDragging = true;
    document.body.classList.add('dragging-active');
    
    // Mobil titreşim
    if (navigator.vibrate) navigator.vibrate(40);

    // 1. Placeholder (Mor Çizgi)
    placeholder = document.createElement('li');
    placeholder.className = 'drag-placeholder';
    item.parentNode.insertBefore(placeholder, item);

    // 2. Clone (Hayalet)
    const rect = item.getBoundingClientRect();
    clone = item.cloneNode(true);
    clone.classList.add('drag-clone');
    
    // Boyutları sabitle
    clone.style.setProperty('--drag-width', `${rect.width}px`);
    clone.style.setProperty('--drag-height', `${rect.height}px`);
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    
    document.body.appendChild(clone);

    // 3. Orijinali gizle
    item.classList.add('is-dragging');
    
    updateDragPosition(x, y);
}

function updateDragPosition(x, y) {
    if (clone) {
        clone.style.left = `${x - touchOffsetX}px`;
        clone.style.top = `${y - touchOffsetY}px`;
    }
}

function checkDropZone(x, y) {
    // Clone, pointer-events:none olduğu için elementFromPoint altındaki öğeyi görür
    const elemBelow = document.elementFromPoint(x, y);
    if (!elemBelow) return;

    const targetItem = elemBelow.closest('.travel-item');
    const targetList = elemBelow.closest('.day-list');

    // Eğer bir liste üzerindeysek
    if (targetList) {
        // Hedef bir item ise
        if (targetItem && targetItem !== draggedItem && targetItem !== placeholder) {
            const rect = targetItem.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            
            if (y < midpoint) {
                targetList.insertBefore(placeholder, targetItem);
            } else {
                targetList.insertBefore(placeholder, targetItem.nextSibling);
            }
        } 
        // Liste boşsa veya item yoksa
        else if (!targetItem) {
            targetList.appendChild(placeholder);
        }
    }
}

function handleAutoScroll(y) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
    
    const h = window.innerHeight;
    let scrollAmount = 0;

    // Üst sınır
    if (y < SCROLL_ZONE_HEIGHT) {
        // Ne kadar yukarıdaysa o kadar hızlı
        const intensity = (SCROLL_ZONE_HEIGHT - y) / SCROLL_ZONE_HEIGHT;
        scrollAmount = -(SCROLL_SPEED + (intensity * 10)); 
    } 
    // Alt sınır
    else if (y > h - SCROLL_ZONE_HEIGHT) {
        const intensity = (y - (h - SCROLL_ZONE_HEIGHT)) / SCROLL_ZONE_HEIGHT;
        scrollAmount = SCROLL_SPEED + (intensity * 10);
    }

    if (scrollAmount !== 0) {
        autoScrollInterval = setInterval(() => {
            window.scrollBy(0, scrollAmount);
        }, 16);
    }
}

function finishDrag() {
    if (placeholder && draggedItem) {
        // DOM'da yer değiştir
        placeholder.parentNode.insertBefore(draggedItem, placeholder);
        
        // Animasyonlu bitiş (Opsiyonel ama şık durur)
        draggedItem.style.opacity = '1';
        draggedItem.classList.remove('is-dragging');
        
        // Veriyi güncelle
        updateCartOrderData();
    }
}

function resetState() {
    isDragging = false;
    draggedItem = null;
    
    if (clone) clone.remove();
    if (placeholder) placeholder.remove();
    
    clone = null; 
    placeholder = null;
    
    clearInterval(autoScrollInterval);
    clearTimeout(longPressTimer);
    
    document.body.classList.remove('dragging-active');
    document.querySelectorAll('.is-dragging').forEach(el => el.classList.remove('is-dragging'));
}

function updateCartOrderData() {
    const newCart = [];
    // Sayfadaki tüm gün listelerini tara ve sırayı al
    document.querySelectorAll('.day-container').forEach(container => {
        const day = parseInt(container.dataset.day);
        container.querySelectorAll('.travel-item').forEach(item => {
            const oldIndex = parseInt(item.dataset.index);
            const cartItem = window.cart[oldIndex];
            if (cartItem) {
                cartItem.day = day; // Günü güncelle (başka güne taşındıysa)
                newCart.push(cartItem);
            }
        });
    });
    
    // window.cart'ı güncelle
    window.cart = newCart;
    
    // updateCart'ı çağır (UI ve Rota yenilensin)
    if (typeof updateCart === 'function') updateCart();
}