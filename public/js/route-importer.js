// route-importer.js (Enhanced with per-day import)
// - GPX + TCX + FIT import
// - Route Title => "<StartShort> → <FinishShort>"
// - Start item  => "<StartShort> (Start)"
// - Finish item => "<FinishShort> (Finish)"
// - Per-day import support

(function() {
  const DEBUG = false;
  function log(...a){ if(DEBUG) console.log('[route-import]', ...a); }

  /* ---------------- File input + delegation ---------------- */
  let fileInput = document.getElementById('__route_import_hidden_input');
  if (!fileInput) {
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = '__route_import_hidden_input';
    fileInput.accept = '.gpx,.tcx,.fit';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
  }

  let currentType = null;
  let currentImportDay = 1;  // Hangi güne import edilecek

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.import-btn[data-import-type]');
    if (!btn) return;
    e.preventDefault();

    currentType = btn.getAttribute('data-import-type'); // 'gpx' | 'tcx' | 'fit'
    if (!currentType) return;

    // Gün bağlamı
    const group = btn.closest('.import-route-group');
    if (group && group.dataset.day) {
      const d = parseInt(group.dataset.day, 10);
      if (!isNaN(d) && d > 0) currentImportDay = d;
    } else {
      const dayContainer = btn.closest('.day-container');
      if (dayContainer && dayContainer.dataset.day) {
        const d2 = parseInt(dayContainer.dataset.day, 10);
        if (!isNaN(d2) && d2 > 0) currentImportDay = d2;
      } else {
        currentImportDay = 1;
      }
    }

    // Doğru accept
    if (currentType === 'gpx') fileInput.accept = '.gpx';
    else if (currentType === 'tcx') fileInput.accept = '.tcx';
    else if (currentType === 'fit') fileInput.accept = '.fit';
    else fileInput.accept = '.gpx,.tcx,.fit';

    fileInput.value = '';
    log('Opening picker for', currentType, 'day=', currentImportDay);
    fileInput.click();
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file || !currentType) return;
    const day = currentImportDay || 1;
    log('Selected file:', file.name, 'type=', currentType, 'day=', day);

    try {
      let parsed;
      if (currentType === 'fit') {
        parsed = await parseFITFile(file);
      } else {
        const raw = await file.text();
        parsed = currentType === 'gpx'
          ? parseGPX(raw)
          : parseTCX(raw);
      }

      if (!parsed || !parsed.points || parsed.points.length < 2) {
        notify('Failed to parse route points (need at least 2 track points).', 'error');
        return;
      }

      const startPt = parsed.points[0];
      const finishPt = parsed.points[parsed.points.length - 1];

      const rawRouteName = parsed.name || null;
      const { startNameRaw, finishNameRaw } = deriveEndpointNames(rawRouteName);

      const shortStart = normalizePlaceName(startNameRaw) || 'Start';
      const shortFinish = normalizePlaceName(finishNameRaw) || 'Finish';

      const routeTitle = `${shortStart} → ${shortFinish}`;
      const startItemTitle = `${shortStart} (Start)`;
      const finishItemTitle = `${shortFinish} (Finish)`;

      ensureCartExists();

      addStartFinishToCart({
        day,
        startTitle: startItemTitle,
        finishTitle: finishItemTitle,
        start: startPt,
        finish: finishPt
      });

      if (typeof updateCart === 'function') updateCart();
      setTimeout(() => {
        if (typeof renderRouteForDay === 'function') renderRouteForDay(day);
      }, 120);

      persistRouteMeta({
        name: routeTitle,
        type: currentType.toUpperCase(),
        pointCount: parsed.points.length,
        distanceMeters: approximateDistance(parsed.points),
        day
      });

      notify(`Imported ${currentType.toUpperCase()} route (Day ${day}): ${routeTitle}`, 'success');
    } catch (err) {
      console.error('[route-import] ERROR', err);
      notify('Import failed: ' + err.message, 'error');
    } finally {
      currentType = null;
    }
  });

  /* ---------------- Normalization & Name Derivation ---------------- */

  const TRAILING_TOKENS = [
    'mah','mahallesi','neighborhood','neighbourhood','district','quarter','quartier','barrio','bairro','arrondissement','colonia','ward','locality','suburb','area','zone','zona',
    'village','köyü','koyu','town','city','municipality','kommune','gemeinde','parish',
    'street','st','st.','road','rd','rd.','avenue','ave','ave.','boulevard','blvd','blvd.','lane','ln','ln.','drive','dr','dr.','way','place','pl','pl.','square','sq','sq.',
    'court','ct','ct.','circle','cir','cir.','trail','trl','trl.','highway','hwy','hwy.','expressway','expwy','parkway','pkwy','pkwy.',
    'mevkii','yolu','yol','path','pathway','route','rte','rte.'
  ];

  function stripDiacritics(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function normalizePlaceName(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let s = raw.trim();

    if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(s)) {
      const [la, lo] = s.split(',');
      return `${parseFloat(la).toFixed(3)},${parseFloat(lo).toFixed(3)}`;
    }

    s = s.replace(/[|]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

    let parts = s.split(/\s+/);
    if (parts.length > 1) {
      const last = parts[parts.length - 1];
      const baseLast = stripDiacritics(last.toLowerCase());
      if (TRAILING_TOKENS.includes(baseLast)) {
        parts.pop();
        s = parts.join(' ');
      }
    }

    if (parts.length > 3) {
      s = parts.slice(0, 3).join(' ');
    }

    const MAX_LEN = 20;
    if (s.length > MAX_LEN) {
      s = s.slice(0, MAX_LEN - 1).trim() + '…';
    }

    if (!s) s = 'Point';
    return s;
  }

  function deriveEndpointNames(rawRouteName) {
    if (!rawRouteName || typeof rawRouteName !== 'string') {
      return { startNameRaw: 'Start', finishNameRaw: 'Finish' };
    }
    let name = rawRouteName.trim();
    const lower = name.toLowerCase();

    let m = lower.match(/\bfrom\s+(.+?)\s+to\s+(.+)$/i);
    if (m && m.length >= 3) {
      return {
        startNameRaw: cleanupSplitPiece(name.substring(m.index).replace(/^from/i,'').split(/to/i)[0].trim()),
        finishNameRaw: cleanupSplitPiece(name.substring(m.index).split(/to/i).slice(1).join('to').trim())
      };
    }

    m = lower.match(/(.+)\s+to\s+(.+)/i);
    if (m && m.length >= 3) {
      const idx = lower.indexOf(' to ');
      return {
        startNameRaw: cleanupSplitPiece(name.slice(0, idx).trim()),
        finishNameRaw: cleanupSplitPiece(name.slice(idx + 4).trim())
      };
    }

    const arrowIdx = name.indexOf('→');
    if (arrowIdx !== -1) {
      return {
        startNameRaw: cleanupSplitPiece(name.slice(0, arrowIdx).trim()),
        finishNameRaw: cleanupSplitPiece(name.slice(arrowIdx + 1).trim())
      };
    }
    const arrow2 = name.indexOf('->');
    if (arrow2 !== -1) {
      return {
        startNameRaw: cleanupSplitPiece(name.slice(0, arrow2).trim()),
        finishNameRaw: cleanupSplitPiece(name.slice(arrow2 + 2).trim())
      };
    }

    let dashMatch = name.match(/(.+)\s[-—]\s(.+)/);
    if (dashMatch && dashMatch[1] && dashMatch[2]) {
      return {
        startNameRaw: cleanupSplitPiece(dashMatch[1].trim()),
        finishNameRaw: cleanupSplitPiece(dashMatch[2].trim())
      };
    }

    return {
      startNameRaw: name,
      finishNameRaw: 'Finish'
    };
  }

  function cleanupSplitPiece(piece) {
    return piece.replace(/^[,-]+/, '').replace(/[,-]+$/, '').trim();
  }

  /* ---------------- Cart Integration ---------------- */

  function ensureCartExists() {
    if (!window.cart) window.cart = [];
    if (window.cart.length === 0 && typeof updateCart === 'function') {
      updateCart();
    }
  }

  function addStartFinishToCart({ day, startTitle, finishTitle, start, finish }) {
    if (typeof addToCart !== 'function') {
      console.warn('[route-import] addToCart not found.');
      return;
    }
    const img = 'img/placeholder.png';
    addToCart(startTitle, img, day, 'Place', '', null, null, '', null, { lat: start.lat, lng: start.lon }, '');
    addToCart(finishTitle, img, day, 'Place', '', null, null, '', null, { lat: finish.lat, lng: finish.lon }, '');
  }

  /* ---------------- FIT LOADER + PARSER ---------------- */
// --- NEW ENSURE FIT PARSER (multi-source + ESM dynamic import fallback) ---
async function ensureFitParser() {
  if (window.FitParser) return true;
  if (ensureFitParser.__inflight) return ensureFitParser.__inflight;

  // 1) DENECEK SIRALAR
  // İlk sıraya yerel (lokal dosyayı sen eklemezsen 404 alır -> diğerlerine geçilir)
  const UMD_SOURCES = [
    '/js/libs/fit-file-parser.js', // <-- yerel kopyayı buraya koy (isteğe bağlı)
    'https://cdn.jsdelivr.net/npm/fit-file-parser@1.10.0/dist/fit-file-parser.js',
    'https://unpkg.com/fit-file-parser@1.10.0/dist/fit-file-parser.js'
  ];

  // 2) UMD loader
  function loadUMD(src) {
    return new Promise((resolve, reject) => {
      if (window.FitParser) return resolve(true);
      // Aynı src zaten eklenmişse tekrar ekleme
      if (document.querySelector(`script[data-fit-src="${src}"]`)) {
        setTimeout(() => {
          if (window.FitParser) resolve(true);
          else reject(new Error('Already injected but FitParser still missing: ' + src));
        }, 50);
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.dataset.fitSrc = src;
      const timeout = setTimeout(() => {
        s.remove();
        reject(new Error('Timeout: ' + src));
      }, 8000);
      s.onload = () => {
        clearTimeout(timeout);
        setTimeout(() => {
          if (window.FitParser) resolve(true);
          else reject(new Error('Loaded but global FitParser not found: ' + src));
        }, 30);
      };
      s.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Network load failed: ' + src));
      };
      document.head.appendChild(s);
    });
  }

  // 3) ESM dynamic import fallback (esm.sh veya skypack gibi)
  async function loadESM() {
    const ESM_URLS = [
      'https://esm.sh/fit-file-parser@1.10.0',
      'https://cdn.jsdelivr.net/npm/fit-file-parser@1.10.0/dist/fit-file-parser.esm.js' // (Varsa, yoksa atlanır)
    ];
    const errors = [];
    for (const url of ESM_URLS) {
      try {
        const mod = await import(/* @vite-ignore */ url);
        const FP = mod.default || mod.FitParser || mod.fitFileParser || null;
        if (!FP) {
          errors.push('ESM okundu ama sınıf yok: ' + url);
          continue;
        }
        window.FitParser = FP;
        return true;
      } catch (e) {
        errors.push(`${url} -> ${e.message}`);
      }
    }
    throw new Error('ESM dynamic import başarısız: ' + errors.join(' | '));
  }

  const attempt = (async () => {
    const umdErrors = [];
    for (const src of UMD_SOURCES) {
      try {
        await loadUMD(src);
        if (window.FitParser) {
          console.log('[fit-import] UMD loaded from', src);
          return true;
        }
      } catch (e) {
        console.warn('[fit-import] UMD source failed:', src, e.message);
        umdErrors.push(e.message);
      }
    }

    // ESM fallback
    try {
      await loadESM();
      if (window.FitParser) {
        console.log('[fit-import] ESM loaded via dynamic import');
        return true;
      }
    } catch (esmErr) {
      umdErrors.push(esmErr.message);
    }

    throw new Error('FIT parser yüklenemedi: ' + umdErrors.join(' || '));
  })();

  ensureFitParser.__inflight = attempt;
  try {
    await attempt;
    return true;
  } finally {
    ensureFitParser.__inflight = null;
  }
}

  async function parseFITFile(file) {
    await ensureFitParser();
    const buffer = await file.arrayBuffer();
    return new Promise((resolve, reject) => {
      const parser = new FitParser({
        force: true,
        speedUnit: 'm/s',
        lengthUnit: 'm',
        temperatureUnit: 'celsius'
      });
      parser.parse(buffer, (err, data) => {
        if (err) return reject(err);
        const recs = (data.records || [])
          .filter(r => r.position_lat != null && r.position_long != null);

        if (!recs.length) {
          return reject(new Error('FIT file has no positional records.'));
        }

        let step = 1;
        if (recs.length > 12000) step = 15;
        else if (recs.length > 8000) step = 10;
        else if (recs.length > 4000) step = 5;
        else if (recs.length > 2000) step = 3;

        const points = [];
        for (let i = 0; i < recs.length; i += step) {
          const r = recs[i];
          points.push({
            lat: r.position_lat,
            lon: r.position_long,
            ele: (typeof r.altitude === 'number') ? r.altitude : null
          });
        }
        const last = recs[recs.length - 1];
        if (points.length &&
            (points[points.length - 1].lat !== last.position_lat ||
             points[points.length - 1].lon !== last.position_long)) {
          points.push({
            lat: last.position_lat,
            lon: last.position_long,
            ele: (typeof last.altitude === 'number') ? last.altitude : null
          });
        }

        const nameGuess =
          (data.sessions && data.sessions[0] && data.sessions[0].sport) ||
          file.name.replace(/\.fit$/i, '');

        resolve({ name: nameGuess, points });
      });
    });
  }

  /* ---------------- Parsers (GPX / TCX) ---------------- */

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
      if (isFinite(lat) && isFinite(lon)) points.push({ lat, lon, ele });
    });
    return { name, points };
  }

  function extractTCXName(doc) {
    const idNode = doc.querySelector('Activity > Id');
    return idNode ? idNode.textContent.trim() : null;
  }

  /* ---------------- Distance + Meta ---------------- */

  function approximateDistance(points) {
    if (points.length < 2) return 0;
    let d = 0;
    for (let i = 1; i < points.length; i++) d += haversine(points[i - 1], points[i]);
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

  /* ---------------- Notify ---------------- */

  function notify(msg, type='info') {
    console.log('[import-route]', type, msg);
    if (window.showToast) window.showToast(msg, type);
  }

  /* ---------------- Debug helper ---------------- */
  window.__debugRouteImport = () => ({
    buttonsNow: document.querySelectorAll('.import-btn').length,
    hiddenInput: !!document.getElementById('__route_import_hidden_input'),
    cartSize: window.cart ? window.cart.length : 0,
    lastImportedRoute: window.lastImportedRoute
  });

})();