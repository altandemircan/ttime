// route-importer.js (Enhanced with per-day import)
// - GPX + TCX + FIT + KML import (tek "Import GPS File" butonu - multi)
// - Start/Finish otomatik ekler, ham track polyline saklar (rawPoints)
// - Süre: FIT zaman damgaları varsa gerçek, yoksa hız tahmini (renderRouteForDay içinde)
// - Per-day import destekli

(function() {
  const DEBUG = false;
  function log(...a){ if(DEBUG) console.log('[route-import]', ...a); }

  /* ---------------- File input + delegation ---------------- */
  let fileInput = document.getElementById('__route_import_hidden_input');
  if (!fileInput) {
  fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.id = '__route_import_hidden_input';
  fileInput.accept = '.gpx,.tcx,.fit,.kml';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);
}

  let currentType = null;        // 'multi' veya geçmiş uyumluluk
  let currentImportDay = 1;      // Import edilecek gün

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.import-btn[data-import-type]');
    if (!btn) return;
    e.preventDefault();

    // GÜN tespiti (hangi day container içindeyse)
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

    currentType = btn.getAttribute('data-import-type'); // 'multi'
    fileInput.accept = '.gpx,.tcx,.fit,.kml';
    fileInput.value = '';
    log('Opening picker (multi) day=', currentImportDay);
    fileInput.click();
  });

fileInput.addEventListener('change', async (event) => {
  if (event) {
    event.preventDefault && event.preventDefault();
    event.stopPropagation && event.stopPropagation();
  }

  const file = fileInput.files && fileInput.files[0];
  if (!file || !currentType) return;;
    const day = currentImportDay || 1;
    log('Selected file:', file.name, 'multi-type=', currentType, 'day=', day);

    try {
      // currentType 'multi' ise dosya adına göre gerçek türü bul
      let detectedType;
      if (currentType === 'multi') {
        const lower = file.name.toLowerCase();
        if (lower.endsWith('.gpx')) detectedType = 'gpx';
        else if (lower.endsWith('.tcx')) detectedType = 'tcx';
        else if (lower.endsWith('.fit')) detectedType = 'fit';
        else if (lower.endsWith('.kml')) detectedType = 'kml';
        else {
          notify('Unsupported file type. Use .gpx / .tcx / .fit / .kml', 'error');
          return;
        }
      } else {
        detectedType = currentType; // eski kullanım kalırsa
      }

      let parsed;
      if (detectedType === 'fit') {
        parsed = await parseFITFile(file);
      } else if (detectedType === 'kml') {
        const raw = await file.text();
        parsed = parseKML(raw);
      } else {
        const raw = await file.text();
        parsed = detectedType === 'gpx'
          ? parseGPX(raw)
          : parseTCX(raw);
      }

      currentType = detectedType; // devamda meta / log için

      if (!parsed || !parsed.points || parsed.points.length < 2) {
        notify('Failed to parse route points (need at least 2 track points).', 'error');
        return;
      }

      // === RAW TRACK KAYDET (Start/Finish dışında ham çizgi) ===
      window.importedTrackByDay = window.importedTrackByDay || {};
      window.importedTrackByDay[day] = {
        rawPoints: parsed.points.map(p => ({
          lat: p.lat,
          lng: p.lon,
          ele: p.ele,
          time: p.time || null
        })),
        source: currentType,
        drawRaw: true
      };

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
       fileInput.value = "";
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
async function ensureFitParser() {
  if (window.FitParser) return true;
  if (ensureFitParser.__inflight) return ensureFitParser.__inflight;

  const DEBUG = false; // Debug logunu aç-kapat
  function log(...a){ if(DEBUG) console.log('[fit-import]', ...a); }

  const ESM_URLS = [
    'https://esm.sh/fit-file-parser@1.10.0',
    'https://cdn.jsdelivr.net/npm/fit-file-parser@1.10.0/dist/fit-file-parser.esm.js'
  ];
  const UMD_SOURCES = [
    'https://cdn.jsdelivr.net/npm/fit-file-parser@1.10.0/dist/fit-file-parser.js',
    'https://unpkg.com/fit-file-parser@1.10.0/dist/fit-file-parser.js'
  ];

  async function loadESM() {
    const errors = [];
    for (const url of ESM_URLS) {
      try {
        const mod = await import(/* @vite-ignore */ url);
        const FP = mod.default || mod.FitParser || mod.fitFileParser || null;
        if (FP) {
          window.FitParser = FP;
          log('ESM loaded via dynamic import', url);
          return true;
        }
        errors.push('ESM loaded but no class: ' + url);
      } catch (e) {
        errors.push(`${url} -> ${e.message}`);
      }
    }
    throw new Error('ESM dynamic import failed: ' + errors.join(' | '));
  }

  function loadUMD(src) {
    return new Promise((resolve, reject) => {
      if (window.FitParser) return resolve(true);
      if (document.querySelector(`script[data-fit-src="${src}"]`)) {
        setTimeout(() => {
          if (window.FitParser) resolve(true);
          else reject(new Error('Script injected but FitParser missing: ' + src));
        }, 80);
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

  const attempt = (async () => {
    // 1. ESM import dene (modern browser, daha hızlı)
    try {
      await loadESM();
      if (window.FitParser) return true;
    } catch (esmErr) {
      log('ESM import failed', esmErr.message);
    }

    // 2. UMD fallback (eski browser/CDN)
    const umdErrors = [];
    for (const src of UMD_SOURCES) {
      try {
        await loadUMD(src);
        if (window.FitParser) {
          log('UMD loaded from', src);
          return true;
        }
      } catch (e) {
        log('UMD source failed:', src, e.message);
        umdErrors.push(e.message);
      }
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
            ele: (typeof r.altitude === 'number') ? r.altitude : null,
            time: r.timestamp instanceof Date ? r.timestamp.getTime() : (
              (typeof r.timestamp === 'number' ? r.timestamp * 1000 : null)
            )
          });
        }
        const last = recs[recs.length - 1];
        if (points.length &&
            (points[points.length - 1].lat !== last.position_lat ||
             points[points.length - 1].lon !== last.position_long)) {
          points.push({
            lat: last.position_lat,
            lon: last.position_long,
            ele: (typeof last.altitude === 'number') ? last.altitude : null,
            time: last.timestamp instanceof Date ? last.timestamp.getTime() : (
              (typeof last.timestamp === 'number' ? last.timestamp * 1000 : null)
            )
          });
        }

        const nameGuess =
          (data.sessions && data.sessions[0] && data.sessions[0].sport) ||
          file.name.replace(/\.fit$/i, '');

        resolve({ name: nameGuess, points });
      });
    });
  }

  /* ---------------- KML PARSER ---------------- */
  function parseKML(xmlString) {
    const clean = xmlString.trim();
    const doc = new DOMParser().parseFromString(clean, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) {
      return { name: 'KML Route', points: [] };
    }

    let nameNode = doc.querySelector('Document > name, Folder > name, Placemark > name');
    const name = nameNode ? nameNode.textContent.trim() : 'KML Route';

    let allCandidatePointSets = [];

    const trackElems = doc.getElementsByTagNameNS('*', 'Track');
    if (trackElems && trackElems.length) {
      for (const trk of trackElems) {
        const coordsTags = trk.getElementsByTagNameNS('*', 'coord');
        const whenTags = trk.getElementsByTagName('when');
        const pts = [];
        for (let i = 0; i < coordsTags.length; i++) {
          const raw = coordsTags[i].textContent.trim().split(/\s+/);
          if (raw.length >= 2) {
            const lon = parseFloat(raw[0]);
            const lat = parseFloat(raw[1]);
            const ele = raw[2] ? parseFloat(raw[2]) : null;
            let time = null;
            if (whenTags[i]) {
              const t = Date.parse(whenTags[i].textContent.trim());
              if (!isNaN(t)) time = t;
            }
            if (isFinite(lat) && isFinite(lon)) {
              pts.push({ lat, lon, ele, time });
            }
          }
        }
        if (pts.length > 1) allCandidatePointSets.push(pts);
      }
    }

    const lineStrings = doc.getElementsByTagName('LineString');
    for (const ls of lineStrings) {
      const coordNode = ls.getElementsByTagName('coordinates')[0];
      if (!coordNode) continue;
      const tuples = coordNode.textContent.trim().split(/\s+/);
      const pts = [];
      tuples.forEach(t => {
        const parts = t.split(',');
        if (parts.length >= 2) {
          const lon = parseFloat(parts[0]);
          const lat = parseFloat(parts[1]);
          const ele = parts[2] ? parseFloat(parts[2]) : null;
          if (isFinite(lat) && isFinite(lon)) {
            pts.push({ lat, lon, ele, time: null });
          }
        }
      });
      if (pts.length > 1) allCandidatePointSets.push(pts);
    }

    if (!allCandidatePointSets.length) {
      return { name, points: [] };
    }

    allCandidatePointSets.sort((a,b) => b.length - a.length);
    let chosen = allCandidatePointSets[0];

    if (chosen.length > 12000) {
      chosen = chosen.filter((_,i)=> i % 15 === 0);
    } else if (chosen.length > 8000) {
      chosen = chosen.filter((_,i)=> i % 10 === 0);
    } else if (chosen.length > 4000) {
      chosen = chosen.filter((_,i)=> i % 5 === 0);
    } else if (chosen.length > 2000) {
      chosen = chosen.filter((_,i)=> i % 3 === 0);
    }

    return { name, points: chosen };
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


/* Ana import fonksiyonu */
async function importGpsFileForDay(file, day){
  console.log('[GPS] import start', file.name, '→ day', day);
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const text = await file.text();


            let points = [];
            if (ext === 'gpx') points = parseGpxToLatLng(text);
            else if (ext === 'kml') points = parseKmlToLatLng(text);
            else if (ext === 'tcx') points = parseTcxToLatLng(text);
            else if (ext === 'fit') points = await parseFitToLatLng(file); // FIT dosyası binary, async fonksiyon gerekir
            else throw new Error('Unsupported file type: ' + ext);


  if (!points.length) throw new Error('No coordinates found in file.');

  if (!__dayIsEmpty(day)) {
    console.warn('[GPS] Day not empty, aborting.');
    return;
  }

  // Starter & placeholder temizle
  window.cart = window.cart.filter(it => !it._starter && !it._placeholder);

  // Track meta kaydet (ham çizim modu)
  window.importedTrackByDay = window.importedTrackByDay || {};
  window.importedTrackByDay[day] = {
    rawPoints: points.map(p => ({ lat: p.lat, lng: p.lng, time: p.time || null })),
    drawRaw: true,
    fileName: file.name
  };

  const start = points[0];
  const finish = points[points.length - 1];

  // Aynı koordinatsa tek item ekle
  const baseName = file.name.replace(/\.[^.]+$/, '');
  addToCart(
    baseName + ' Start',
    'img/placeholder.png',
    day,
    'Track',
    null,null,null,null,null,
    { lat: start.lat, lng: start.lng },
    null,
    { forceDay: day }
  );

  if (points.length > 1 &&
      (Math.abs(finish.lat - start.lat) > 1e-6 || Math.abs(finish.lng - start.lng) > 1e-6)) {
    addToCart(
      baseName + ' Finish',
      'img/placeholder.png',
      day,
      'Track',
      null,null,null,null,null,
      { lat: finish.lat, lng: finish.lng },
      null,
      { forceDay: day }
    );
  }

  // UI yenile (addToCart zaten çağırdı ama garanti olsun)
  if (typeof updateCart === 'function') updateCart();
  if (typeof renderRouteForDay === 'function') renderRouteForDay(day);

  console.log('[GPS] imported → points:', points.length);

   // --- BURAYA EKLE ---
  window.lastRouteGeojsons = window.lastRouteGeojsons || {};
  window.lastRouteGeojsons['route-map-day' + day] = {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: points.map(p => [p.lng, p.lat])
      },
      properties: {}
    }]
  };
}



function parseTcxToLatLng(tcxText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(tcxText, 'application/xml');
  const pts = [];
  xml.querySelectorAll('Trackpoint').forEach(tp => {
    const latNode = tp.querySelector('LatitudeDegrees');
    const lonNode = tp.querySelector('LongitudeDegrees');
    if (!latNode || !lonNode) return;
    const lat = parseFloat(latNode.textContent);
    const lng = parseFloat(lonNode.textContent);
    if (!isNaN(lat) && !isNaN(lng)) pts.push({ lat, lng });
  });
  return pts;
}