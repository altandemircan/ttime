(function() {
  function safeStartMap() {
    if (typeof startMapPlanning === 'function') {
      startMapPlanning();
    } else {
      console.warn('[start-map] startMapPlanning fonksiyonu bulunamadı.');
    }
  }

  function bindStartMapButtons() {
    // Hem class hem legacy ID desteği
    const btns = Array.from(document.querySelectorAll('.start-map-btn, #start-map-btn'));
    btns.forEach(btn => {
      if (btn.__startMapBound) return;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        safeStartMap();
      });
      btn.__startMapBound = true;
    });
  }

  // İlk yükle
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindStartMapButtons);
  } else {
    bindStartMapButtons();
  }

  // Eğer updateCart veya başka renderlar DOM'u değiştiriyorsa MutationObserver ile yeniden bağla
  const mo = new MutationObserver(() => bindStartMapButtons());
  mo.observe(document.body, { childList: true, subtree: true });

  // Idempotent startMapPlanning değilse bir koruma ekle (override değil, sarmalıyorsun)
  if (typeof startMapPlanning === 'function' && !startMapPlanning.__wrapped) {
    const original = startMapPlanning;
    window.startMapPlanning = function() {
      if (window.__mapPlanningStarted) {
        // Zaten başlatıldıysa yeniden kurcalama
        return original();
      }
      window.__mapPlanningStarted = true;
      return original();
    };
    window.startMapPlanning.__wrapped = true;
  }
})();