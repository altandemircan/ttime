// ========== MOBILE DRAG & DROP (STABILIZED) ==========

// Global değişkenler (Mevcut olanları güncelle/ekle)
let mobileDragOffsetX = 0;
let mobileDragOffsetY = 0;

// Long press tetiklendiğinde çalışır
function activateMobileDrag(item, touch) {
    longPressTriggered = true;
    draggedItem = item;

    // 1. Koordinat hesaplama (Parmağın öğe içindeki konumu)
    const rect = item.getBoundingClientRect();
    mobileDragOffsetX = touch.clientX - rect.left;
    mobileDragOffsetY = touch.clientY - rect.top;

    // 2. Öğeyi "Fixed" moda alıp parmağın altına yapıştırıyoruz
    // Orijinal genişliğini koruması için width atıyoruz
    item.style.width = rect.width + 'px';
    item.style.height = rect.height + 'px'; // Yükseklik çökmesin
    item.style.position = 'fixed';
    item.style.left = (touch.clientX - mobileDragOffsetX) + 'px';
    item.style.top = (touch.clientY - mobileDragOffsetY) + 'px';
    item.style.zIndex = '9999';
    item.style.opacity = '0.9';
    item.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
    item.classList.add('dragging');

    // 3. Placeholder oluştur (Listenin kaymasını önler)
    createPlaceholder(item);

    // 4. Sayfa kaydırmayı kilitle (ÇOK ÖNEMLİ)
    document.body.classList.add('dragging-active');
    document.body.classList.add('dragging-items');

    // 5. Titreşim (Haptic Feedback)
    if (navigator.vibrate) navigator.vibrate(50);

    // 6. Global event listener'ları ekle (Parmağı kaçırmamak için document'a ekliyoruz)
    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    document.addEventListener('touchend', handleGlobalTouchEnd, { passive: false });
    document.addEventListener('touchcancel', handleGlobalTouchEnd, { passive: false });
}

function handleTouchStart(e) {
    // Sadece tek parmak dokunuşlarını kabul et
    if (e.touches.length !== 1) return;
    
    // Eğer zaten bir sürükleme varsa ikincisine izin verme
    if (draggedItem) return;

    const item = e.target.closest('.travel-item');
    // Butonlara veya resimlere basıldıysa sürüklemeyi başlatma (Opsiyonel)
    if (!item || e.target.closest('button') || e.target.closest('.visual img')) return;

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    
    longPressTriggered = false;
    touchTargetItem = item;

    // Long press zamanlayıcısını başlat
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
        if (touchTargetItem) {
            activateMobileDrag(touchTargetItem, e.touches[0]);
        }
    }, LONG_PRESS_MS);
}

function handleTouchMove(e) {
    // Bu fonksiyon sadece long-press HENÜZ tetiklenmediyse çalışır (Scroll iptali için)
    if (!longPressTriggered && touchTargetItem) {
        const t = e.touches[0];
        const dx = Math.abs(t.clientX - touchStartX);
        const dy = Math.abs(t.clientY - touchStartY);
        
        // Eğer kullanıcı parmağını çok hareket ettirdiyse (scroll yapıyordur), long-press'i iptal et
        if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
            touchTargetItem = null;
        }
    }
}

// Global Move Handler (Sürükleme aktifken çalışır)
function handleGlobalTouchMove(e) {
    if (!longPressTriggered || !draggedItem) return;

    // Sayfa kaydırmayı engelle
    e.preventDefault(); 
    e.stopImmediatePropagation();

    const touch = e.touches[0];

    // 1. Öğeyi hareket ettir (Transform yerine left/top daha stabil fixed için)
    draggedItem.style.left = (touch.clientX - mobileDragOffsetX) + 'px';
    draggedItem.style.top = (touch.clientY - mobileDragOffsetY) + 'px';

    // 2. Parmağın altındaki hedefi bul
    // pointer-events: none olduğu için draggedItem'ı görmez, altındakini görür
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!elementBelow) return;

    const dropZone = elementBelow.closest('.day-list');
    
    // Dropzone değişimi ve placeholder mantığı
    if (dropZone) {
        if (currentDropZone && currentDropZone !== dropZone) {
            currentDropZone.classList.remove('drop-hover');
        }
        currentDropZone = dropZone;
        currentDropZone.classList.add('drop-hover');
        
        // En yakın öğeyi bulma mantığı (Mevcut kodunuzdaki mantık)
        const items = Array.from(dropZone.querySelectorAll('.travel-item:not(.dragging)'));
        let closestItem = null;
        let closestDistance = Infinity;
        
        items.forEach(item => {
            const rect = item.getBoundingClientRect();
            // Y eksenine göre orta nokta kontrolü
            const offset = touch.clientY - (rect.top + rect.height / 2);
            const distance = Math.abs(offset);
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestItem = item;
            }
        });

        // Placeholder'ı yerleştir
        if (closestItem) {
            const rect = closestItem.getBoundingClientRect();
            if (touch.clientY < rect.top + rect.height / 2) {
                dropZone.insertBefore(placeholder, closestItem);
            } else {
                dropZone.insertBefore(placeholder, closestItem.nextSibling);
            }
        } else {
            // Liste boşsa veya en alttaysa
            dropZone.appendChild(placeholder);
        }
    }
}

function handleTouchEnd(e) {
    // Bu normal touch end (henüz drag başlamadıysa timer'ı temizler)
    if (!longPressTriggered) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
        touchTargetItem = null;
    }
}

function handleGlobalTouchEnd(e) {
    // Sürükleme bitişi
    if (!longPressTriggered || !draggedItem) {
        cleanupTouchDrag();
        return;
    }

    e.preventDefault(); // Click tetiklenmesini engelle

    // Bırakma işlemi
    if (currentDropZone && placeholder && placeholder.parentNode) {
        const fromIndex = parseInt(draggedItem.dataset.index);
        const fromDayList = document.querySelector(`.travel-item[data-index="${fromIndex}"]`)?.closest('.day-list');
        const fromDay = fromDayList ? parseInt(fromDayList.dataset.day) : null;
        
        const toDayList = placeholder.closest('.day-list');
        const toDay = toDayList ? parseInt(toDayList.dataset.day) : null;

        // Hedef indeksi placeholder'a göre bul
        const itemsInDay = Array.from(toDayList.querySelectorAll('.travel-item:not(.dragging)'));
        let toIndex = itemsInDay.indexOf(placeholder.nextSibling); 
        
        // Eğer nextSibling null ise (sona eklendiyse) veya placeholder listede tekse
        if (placeholder.nextSibling === null) {
            toIndex = itemsInDay.length;
        } else if (toIndex === -1) {
             // itemsInDay, draggedItem'ı içermediği için indexler kayabilir, placeholder'ın indexini domdan alalım
             toIndex = Array.from(toDayList.children).indexOf(placeholder);
             // Children içinde placeholder var, travel-item olmayanları filtrelemek gerekebilir ama
             // basitçe listenin sonuna mı başına mı ona bakalım.
        }
        
        // Sıralama fonksiyonunu çağır
        reorderCart(fromIndex, toIndex, fromDay, toDay);
    }

    cleanupTouchDrag();
}

function cleanupTouchDrag() {
    clearTimeout(longPressTimer);
    longPressTimer = null;
    longPressTriggered = false;
    touchTargetItem = null;

    // Event listener'ları temizle
    document.removeEventListener('touchmove', handleGlobalTouchMove);
    document.removeEventListener('touchend', handleGlobalTouchEnd);
    document.removeEventListener('touchcancel', handleGlobalTouchEnd);

    // Scroll kilidini kaldır
    document.body.classList.remove('dragging-active');
    document.body.classList.remove('dragging-items');

    if (draggedItem) {
        // Stilleri sıfırla
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