// ========== DRAG.JS - PROD VERSİYON (STABIL & MOR ÇİZGİ) ==========

if (!window.cart || !Array.isArray(window.cart)) window.cart = [];

// --- State ---
let dragItem = null;       // Sürüklenen gerçek DOM elemanı
let dragClone = null;      // Ekranda gezen kopya
let dragPlaceholder = null;// Mor çizgi
let isDragActive = false;  // Mod aktif mi?

// --- Touch Tracking ---
let startX = 0;
let startY = 0;
let initialTouchY = 0;     // Auto-scroll için referans
let longPressTimer = null;

// --- Config ---
const HOLD_DELAY = 250;    // Ms cinsinden basılı tutma süresi (Trello hissi)
const SCROLL_SPEED = 20;   // Auto-scroll hızı
const SCROLL_ZONE = 80;    // Ekran kenar hassasiyeti

// 1. CSS Enjeksiyonu (Sadece drag mantığı için)
(function injectStyles() {
    if (document.getElementById('tt-drag-core-css')) return;
    const style = document.createElement('style');
    style.id = 'tt-drag-core-css';
    style.innerHTML = `
        /* Sürüklenen Kopya */
        .drag-clone-el {
            position: fixed; z-index: 99999; pointer-events: none;
            opacity: 0.95; box-shadow: 0 15px 35px rgba(0,0,0,0.3);
            transform: scale(1.02) rotate(2deg); 
            background: #fff; list-style: none; border-radius: 8px;
            box-sizing: border-box;
        }
        /* Orijinal öğe gizlensin */
        .travel-item.is-dragging-source { opacity: 0 !important; }
        
        /* --- MOR ÇİZGİ PLACEHOLDER --- */
        .drag-placeholder-el {
            height: 4px !important;
            background: #8a4af3 !important; /* Mor Renk */
            border-radius: 2px;
            margin: 10px 0;
            box-shadow: 0 0 8px rgba(138, 74, 243, 0.6);
            list-style: none;
            display: block;
        }
        
        /* Drag aktifken seçimi ve scrollu kilitle */
        body.drag-mode-active { 
            user-select: none; -webkit-user-select: none; 
            overflow: hidden !important; touch-action: none; 
        }
    `;
    document.head.appendChild(style);
})();

// 2. Global Listeners (Delegation)
// Mobilde 'passive: false' çok önemli, yoksa preventDefault çalışmaz.
document.addEventListener('touchstart', onTouchStart, { passive: false });
document.addEventListener('touchmove', onTouchMove, { passive: false });
document.addEventListener('touchend', onTouchEnd);
document.addEventListener('touchcancel', onTouchEnd);

// Desktop
document.addEventListener('mousedown', onMouseDown);
document.addEventListener('mousemove', onMouseMove);
document.addEventListener('mouseup', onMouseUp);

// --- TOUCH EVENTS ---

function onTouchStart(e) {
    if (e.touches.length !== 1) return;
    const target = e.target.closest('.travel-item');
    
    // Buton, link veya menüye dokunduysa drag başlatma
    if (!target || e.target.closest('button') || e.target.closest('a') || e.target.closest('.action-menu')) return;

    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    dragItem = target;

    // Zamanlayıcı başlat: Parmağını kıpırdatmadan tutarsa drag başlar
    longPressTimer = setTimeout(() => {
        initDrag(t.clientX, t.clientY);
    }, HOLD_DELAY);
}

function onTouchMove(e) {
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - startX);
    const dy = Math.abs(t.clientY - startY);

    // A) Henüz drag başlamadı (Bekleme süresi)
    if (!isDragActive) {
        // Kullanıcı parmağını kaydırıyorsa (Scroll niyeti)
        if (dy > 8 || dx > 8) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
            dragItem = null;
        }
        return; // Scroll'a izin ver
    }

    // B) Drag Başladı -> Scrollu engelle, öğeyi taşı
    if (e.cancelable) e.preventDefault();
    moveDrag(t.clientX, t.clientY);
}

function onTouchEnd(e) {
    clearTimeout(longPressTimer);
    if (isDragActive) {
        endDrag();
    }
    resetDrag();
}

// --- MOUSE EVENTS ---

function onMouseDown(e) {
    if (e.button !== 0) return; 
    const target = e.target.closest('.travel-item');
    if (!target || e.target.closest('button') || e.target.closest('a')) return;

    startX = e.clientX;
    startY = e.clientY;
    dragItem = target;
}

function onMouseMove(e) {
    if (!dragItem) return;

    if (!isDragActive) {
        // Desktopta hemen başla ama küçük bir eşik koy (yanlış tıklamayı önle)
        if (Math.abs(e.clientY - startY) > 5 || Math.abs(e.clientX - startX) > 5) {
            initDrag(e.clientX, e.clientY);
        }
        return;
    }
    e.preventDefault();
    moveDrag(e.clientX, e.clientY);
}

function onMouseUp(e) {
    if (isDragActive) endDrag();
    resetDrag();
}

// --- DRAG LOGIC ---

function initDrag(x, y) {
    if (!dragItem) return;
    isDragActive = true;
    document.body.classList.add('drag-mode-active');
    
    // Titreşim (Mobil hissi)
    if (navigator.vibrate) navigator.vibrate(40);

    // 1. Placeholder Oluştur (Mor Çizgi)
    dragPlaceholder = document.createElement('li');
    dragPlaceholder.className = 'drag-placeholder-el';
    
    // "Paket" mantığı: Eğer altında separator varsa, onu da atla
    let nextSib = dragItem.nextElementSibling;
    if (nextSib && nextSib.classList.contains('distance-separator')) {
        // Separator'ı geçici olarak gizle veya placeholder'ı onun altına koy
        // En temiz yöntem: Placeholder'ı item'ın olduğu yere koymak
    }
    dragItem.parentNode.insertBefore(dragPlaceholder, dragItem);

    // 2. Clone Oluştur (Görsel)
    const rect = dragItem.getBoundingClientRect();
    dragClone = dragItem.cloneNode(true);
    dragClone.className = 'travel-item drag-clone-el'; // Orijinal classları koru + drag class
    dragClone.style.width = rect.width + 'px';
    dragClone.style.height = rect.height + 'px';
    // Offseti ayarla ki parmak item'ın tuttuğu yerinde kalsın
    dragClone.dataset.offsetX = x - rect.left;
    dragClone.dataset.offsetY = y - rect.top;
    
    document.body.appendChild(dragClone);

    // 3. Orijinali Gizle
    dragItem.classList.add('is-dragging-source');
    
    // İlk konumlandırma
    moveDrag(x, y);
}

function moveDrag(x, y) {
    if (!dragClone) return;
    
    // Clone'u taşı
    const offX = parseFloat(dragClone.dataset.offsetX) || 0;
    const offY = parseFloat(dragClone.dataset.offsetY) || 0;
    dragClone.style.left = (x - offX) + 'px';
    dragClone.style.top  = (y - offY) + 'px';

    // Auto Scroll
    handleAutoScroll(y);

    // Drop Hedefi Bul
    findDropTarget(x, y);
}

function findDropTarget(x, y) {
    // Clone'u gizle ki altındakini görelim
    dragClone.style.display = 'none';
    let el = document.elementFromPoint(x, y);
    dragClone.style.display = 'block';

    if (!el) return;

    const targetItem = el.closest('.travel-item');
    const targetList = el.closest('.day-list');

    if (targetList) {
        // Eğer bir item üzerindeysek
        if (targetItem && targetItem !== dragItem && targetItem !== dragPlaceholder) {
            const rect = targetItem.getBoundingClientRect();
            const mid = rect.top + (rect.height / 2);
            
            // "Paket" Mantığı:
            // Eğer hedef item'ın altında bir separator varsa, o separator'ı da o item'ın parçası saymalıyız.
            // Bu yüzden "after" eklemesi yaparken separator'ın sonrasına eklemeliyiz.
            
            if (y < mid) {
                // Üstüne ekle
                targetList.insertBefore(dragPlaceholder, targetItem);
            } else {
                // Altına ekle -> Eğer separator varsa, onun da altına ekle
                let insertRef = targetItem.nextElementSibling;
                if (insertRef && insertRef.classList.contains('distance-separator')) {
                    insertRef = insertRef.nextElementSibling;
                }
                targetList.insertBefore(dragPlaceholder, insertRef);
            }
        }
        // Liste boşsa veya aralardaysa
        else if (!targetItem && targetList.children.length === 0) {
            targetList.appendChild(dragPlaceholder);
        }
    }
}

// Auto Scroll Logic
let scrollVel = 0;
function handleAutoScroll(y) {
    const h = window.innerHeight;
    if (y < SCROLL_ZONE) scrollVel = -SCROLL_SPEED;
    else if (y > h - SCROLL_ZONE) scrollVel = SCROLL_SPEED;
    else scrollVel = 0;

    if (scrollVel !== 0 && !autoScrollInterval) {
        autoScrollInterval = setInterval(() => {
            window.scrollBy(0, scrollVel);
        }, 16);
    } else if (scrollVel === 0 && autoScrollInterval) {
        clearInterval(autoScrollInterval);
        autoScrollInterval = null;
    }
}

function endDrag() {
    if (dragItem && dragPlaceholder && dragPlaceholder.parentNode) {
        // DOM'da yer değiştir
        dragPlaceholder.parentNode.insertBefore(dragItem, dragPlaceholder);
        updateDataModel();
    }
}

function resetDrag() {
    isDragActive = false;
    dragItem = null;
    if (dragClone) dragClone.remove();
    if (dragPlaceholder) dragPlaceholder.remove();
    dragClone = null;
    dragPlaceholder = null;
    
    document.querySelectorAll('.is-dragging-source').forEach(el => el.classList.remove('is-dragging-source'));
    document.body.classList.remove('drag-mode-active');
    
    if (autoScrollInterval) clearInterval(autoScrollInterval);
    autoScrollInterval = null;
    if (longPressTimer) clearTimeout(longPressTimer);
}

// --- VERİ GÜNCELLEME ---
function updateDataModel() {
    // DOM sırasını oku, window.cart'ı güncelle
    const newCart = [];
    document.querySelectorAll('.day-container').forEach(dc => {
        const day = parseInt(dc.dataset.day);
        dc.querySelectorAll('.travel-item').forEach(item => {
            const idx = parseInt(item.dataset.index);
            if (window.cart[idx]) {
                const obj = window.cart[idx];
                obj.day = day; // Günü güncelle
                newCart.push(obj);
            }
        });
    });
    
    window.cart = newCart;
    
    // UI Yenile (Separatorler vs yeniden hesaplansın)
    if (typeof updateCart === 'function') updateCart();
}