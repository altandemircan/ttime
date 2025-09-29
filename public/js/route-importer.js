// Robust GPX + TCX importer integrated with cart-based system
// - Event delegation (buttons dinamik olduğundan)
// - Tek seferlik gizli <input type=file> body'e eklenir
// - START / FINISH öğeleri window.cart içine "Place" kategorisiyle eklenir
// - Rota çizimini mevcut mekanizma (renderRouteForDay) üstlenir
// - Her import sonrası Day 1 varsa üzerine ekler; yoksa updateCart() çağırılır

(function() {
  const DEBUG = true;

  function log(...a){ if(DEBUG) console.log('[route-import]', ...a); }

  // 1) Gizli input oluştur (tek sefer)
  let fileInput = document.getElementById('__route_import_hidden_input');
  if (!fileInput) {
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = '__route_import_hidden_input';
    fileInput.accept = '.gpx,.tcx';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
  }

  let currentType = null;

  // 2) Event delegation: .import-btn yakala
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.import-btn[data-import-type]');
    if (!btn) return;
    e.preventDefault();

    currentType = btn.getAttribute('data-import-type'); // gpx / tcx
    if (!currentType) return;
    fileInput.accept = currentType === 'gpx' ? '.gpx' : '.tcx';
    fileInput.value = '';

    log('Opening file chooser for', currentType.toUpperCase());
    fileInput.click();
  });

  // 3) Dosya seçilince işle
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file || !currentType) return;
    try {
      const raw = await file.text();
      const parsed = currentType === 'gpx' ? parseGPX(raw) : parseTCX(raw);

      if (!parsed || !parsed.points || parsed.points.length < 2) {
        notify('Failed to parse route points (need at least 2 track points).', 'error');
        return;
      }

      const name = parsed.name || inferName(parsed.points);
      const start = parsed.points[0];
      const finish = parsed.points[parsed.points.length - 1];

      ensureCartExists(); // cart yapısı yoksa oluştur ve updateCart()

      // Aynı isimle ikinci kez eklersen çakışmayı önlemek için rastgele suffix
      const rand = Math.random().toString(36).slice(2,7);

      addStartFinishToCart({
        baseName: name,
        start,
        finish,
        suffix: rand
      });

      // UI güncelle ve rota çiz (updateCart içinde zaten renderRouteForDay tetikleniyor)
      if (typeof updateCart === 'function') {
        updateCart();
      }

      // Güvence: route çizimi kaçarsa küçük bir gecikmeyle çağır
      setTimeout(() => {
        if (typeof renderRouteForDay === 'function') renderRouteForDay(1);
      }, 150);

      persistRouteMeta({
        name,
        type: currentType.toUpperCase(),
        pointCount: parsed.points.length,
        distanceMeters: approximateDistance(parsed.points)
      });

      notify(`Imported ${currentType.toUpperCase()} route: ${name}`, 'success');
      log('Import done:', { name, points: parsed.points.length });

    } catch (err) {
      console.error(err);
      notify('Import failed: ' + err.message, 'error');
    } finally {
      currentType = null;
    }
  });

  /* ---------- Cart / Integration Helpers ---------- */

  function ensureCartExists() {
    if (!window.cart) window.cart = [];
    // Boşsa updateCart boş state'i oluşturacak (butonları tekrar DOM'a koyar)
    if (window.cart.length === 0 && typeof updateCart === 'function') {
      updateCart();
    }
  }

  function addStartFinishToCart({ baseName, start, finish, suffix }) {
    if (typeof addToCart !== 'function') {
      console.warn('addToCart fonksiyonu bulunamadı, cart entegrasyonu yapılamadı.');
      return;
    }
    const day = 1;

    const startName = `${baseName} (Start)`;
    const finishName = `${baseName} (Finish)`;

    // Görsel yoksa placeholder
    const placeholderImg = 'img/placeholder.png';

    addToCart(
      startName,
      placeholderImg,
      day,
      'Place',
      '', // address
      null,
      null,
      '', // opening_hours
      null,
      { lat: start.lat, lng: start.lon },
      ''
    );

    addToCart(
      finishName,
      placeholderImg,
      day,
      'Place',
      '',
      null,
      null,
      '',
      null,
      { lat: finish.lat, lng: finish.lon },
      ''
    );
  }

  /* ---------- Parsers ---------- */

  function parseGPX(xmlString) {
    const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
    const trkpts = Array.from(doc.getElementsByTagName('trkpt'));
    const nameNode = doc.querySelector('metadata > name, trk > name');
    const name = nameNode ? nameNode.textContent.trim() : null;

    const points = trkpts.map(p => {
      const lat = parseFloat(p.getAttribute('lat'));
      const lon = parseFloat(p.getAttribute('lon'));
      const eleNode = p.getElementsByTagName('ele')[0];
      const ele = eleNode ? parseFloat(eleNode.textContent) : null;
      return { lat, lon, ele };
    }).filter(pt => isFinite(pt.lat) && isFinite(pt.lon));

    return { name, points };
  }

  function parseTCX(xmlString) {
    const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
    const trackpoints = Array.from(doc.getElementsByTagName('Trackpoint'));
    const name = extractTCXName(doc);
    const points = [];

    trackpoints.forEach(tp => {
      const latNode = tp.getElementsByTagName('LatitudeDegrees')[0];
      const lonNode = tp.getElementsByTagName('LongitudeDegrees')[0];
      if (!latNode || !lonNode) return;
      const lat = parseFloat(latNode.textContent);
      const lon = parseFloat(lonNode.textContent);
      let ele = null;
      const eleNode = tp.getElementsByTagName('AltitudeMeters')[0];
      if (eleNode) ele = parseFloat(eleNode.textContent);
      if (isFinite(lat) && isFinite(lon)) {
        points.push({ lat, lon, ele });
      }
    });

    return { name, points };
  }

  function extractTCXName(doc) {
    const idNode = doc.querySelector('Activity > Id');
    return idNode ? idNode.textContent.trim() : null;
  }

  /* ---------- Helpers ---------- */

  function inferName(points) {
    if (!points.length) return 'Imported Route';
    const s = points[0];
    const f = points[points.length - 1];
    return `Route (${s.lat.toFixed(3)},${s.lon.toFixed(3)}) → (${f.lat.toFixed(3)},${f.lon.toFixed(3)})`;
  }

  function approximateDistance(points) {
    if (points.length < 2) return 0;
    let d = 0;
    for (let i = 1; i < points.length; i++) {
      d += haversine(points[i-1], points[i]);
    }
    return d;
  }

  function haversine(a, b) {
    const R = 6371000;
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const sLat1 = toRad(a.lat);
    const sLat2 = toRad(b.lat);
    const h = Math.sin(dLat/2)**2 + Math.cos(sLat1)*Math.cos(sLat2)*Math.sin(dLon/2)**2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function persistRouteMeta(meta) {
    window.lastImportedRoute = meta;
    try { localStorage.setItem('lastImportedRoute', JSON.stringify(meta)); } catch {}
  }

  function notify(msg, type='info') {
    console.log('[import-route]', type, msg);
    if (window.showToast) window.showToast(msg, type);
  }

  // Debug yardım komutu
  window.__debugRouteImport = () => ({
    buttonsNow: document.querySelectorAll('.import-btn').length,
    hiddenInput: !!document.getElementById('__route_import_hidden_input'),
    cartSize: window.cart ? window.cart.length : 0,
    lastImportedRoute: window.lastImportedRoute
  });

})();