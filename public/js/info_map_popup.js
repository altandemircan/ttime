function showRouteInfoBanner(day) {
  const expandedContainer = document.getElementById(`expanded-map-${day}`);
  if (!expandedContainer) return;

  let banner = expandedContainer.querySelector('#route-info-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'route-info-banner';
    banner.className = 'route-info-banner';
    banner.innerHTML = `
      <span>Click the map to list nearby restaurants, cafes and bars.</span>
      <button id="close-route-info" class="route-info-close">✕</button>
    `;
    expandedContainer.prepend(banner);
  }
  
  banner.style.display = 'flex';
  
  // Tıklanabilir olduğunu göstermek için imleci değiştir
  banner.style.cursor = 'pointer';

  // --- TÜM KUTUYA TIKLAYINCA KAPAT ---
  banner.onclick = function() {
    banner.style.display = 'none';
  };

  // X butonuna basılınca da kapansın (Bubble etkisini beklemeden)
  const closeBtn = banner.querySelector('#close-route-info');
  if (closeBtn) {
    closeBtn.onclick = function(e) {
      e.stopPropagation(); // Banner click'ini tetiklemesin, direkt kapatsın
      banner.style.display = 'none';
    };
  }

  // Otomatik kapanma (5 saniye)
  setTimeout(function() {
    if (banner.style.display !== 'none') {
      banner.style.display = 'none';
    }
  }, 5000);
}