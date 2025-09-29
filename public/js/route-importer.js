// route-importer.js
// Simplified: GPX + TCX only.
// - Parses route
// - Ensures Day 1
// - Adds two items: Start / Finish
// - Draws polyline on Leaflet map (global window.map assumed)

(function() {
  const fileInput = document.getElementById('route-import-input');
  const importButtons = document.querySelectorAll('.import-btn');
  if (!fileInput || !importButtons.length) return;

  let currentType = null;

  importButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      currentType = btn.getAttribute('data-import-type'); // gpx | tcx
      fileInput.accept = currentType === 'gpx' ? '.gpx' : '.tcx';
      fileInput.value = '';
      fileInput.click();
    });
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file || !currentType) return;

    try {
      const raw = await file.text();
      const parsed = currentType === 'gpx' ? parseGPX(raw) : parseTCX(raw);

      if (!parsed || !parsed.points || parsed.points.length < 2) {
        notify('Failed to parse route points.', 'error');
        return;
      }

      const name = parsed.name || inferName(parsed.points);
      const start = parsed.points[0];
      const finish = parsed.points[parsed.points.length - 1];

      ensureDay1();

      const startItem = buildTripItem({
        title: name ? `${name} (Start)` : 'Start',
        lat: start.lat,
        lon: start.lon,
        elevation: start.ele,
        tag: 'start'
      });

      const finishItem = buildTripItem({
        title: name ? `${name} (Finish)` : 'Finish',
        lat: finish.lat,
        lon: finish.lon,
        elevation: finish.ele,
        tag: 'finish'
      });

      appendItemToDay(0, startItem);
      appendItemToDay(0, finishItem);

      drawImportedRoute(parsed.points, name);

      persistRouteMeta({
        name,
        type: currentType.toUpperCase(),
        pointCount: parsed.points.length,
        distanceMeters: approximateDistance(parsed.points)
      });

      notify(`Imported ${currentType.toUpperCase()} route: ${name}`, 'success');
    } catch (e) {
      console.error('[import-route] ERROR', e);
      notify('Import failed: ' + e.message, 'error');
    }
  });

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

  function ensureDay1() {
    if (!window.tripPlan) window.tripPlan = { days: [] };
    if (!Array.isArray(window.tripPlan.days)) window.tripPlan.days = [];
    if (window.tripPlan.days.length === 0) {
      window.tripPlan.days.push({ title: 'Day 1', items: [] });
      if (typeof window.renderTripDays === 'function') {
        window.renderTripDays();
      }
    }
  }

  function buildTripItem({ title, lat, lon, elevation, tag }) {
    return {
      id: 'imp_' + Math.random().toString(36).slice(2, 9),
      title,
      lat,
      lon,
      elevation,
      kind: 'import-point',
      tag,
      createdAt: new Date().toISOString()
    };
  }

  function appendItemToDay(dayIndex, item) {
    if (!window.tripPlan || !window.tripPlan.days[dayIndex]) return;
    window.tripPlan.days[dayIndex].items.push(item);
    if (typeof window.renderDayItems === 'function') {
      window.renderDayItems(dayIndex);
    } else if (typeof window.renderTripDays === 'function') {
      window.renderTripDays();
    }
  }

  function drawImportedRoute(points, name) {
    if (typeof L === 'undefined' || !window.map) {
      console.warn('[import-route] Leaflet map not found.');
      return;
    }
    const latlngs = points.map(p => [p.lat, p.lon]);
    const poly = L.polyline(latlngs, {
      color: '#8a4af3',
      weight: 4,
      opacity: 0.9
    }).addTo(window.map);

    if (!window.__importLayers) window.__importLayers = [];
    window.__importLayers.push(poly);

    try {
      window.map.fitBounds(poly.getBounds(), { padding: [30, 30] });
    } catch {}

    // Markers
    const start = latlngs[0];
    const finish = latlngs[latlngs.length - 1];
    if (start) {
      L.circleMarker(start, { radius: 6, color:'#0f766e', fillColor:'#14b8a6', fillOpacity:0.9 })
        .addTo(window.map).bindTooltip('Start');
    }
    if (finish) {
      L.circleMarker(finish, { radius: 6, color:'#7f1d1d', fillColor:'#dc2626', fillOpacity:0.9 })
        .addTo(window.map).bindTooltip('Finish');
    }
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

})();