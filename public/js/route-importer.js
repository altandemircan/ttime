// route-importer.js
// Handles importing GPX / TCX / FIT, extracting first & last points, creating Day 1 if empty,
// adding two itinerary items (Start / Finish) and drawing a route polyline.

(function() {
  const fileInput = document.getElementById('route-import-input');
  const importButtons = document.querySelectorAll('.import-btn');

  if (!fileInput || importButtons.length === 0) return;

  let currentType = null;

  importButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      currentType = btn.getAttribute('data-import-type'); // gpx / tcx / fit
      switch (currentType) {
        case 'gpx':
          fileInput.accept = '.gpx';
          break;
        case 'tcx':
          fileInput.accept = '.tcx';
          break;
        case 'fit':
          fileInput.accept = '.fit';
          break;
      }
      fileInput.value = '';
      fileInput.click();
    });
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file || !currentType) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      let parsed;

      if (currentType === 'gpx') {
        parsed = parseGPX(new TextDecoder().decode(arrayBuffer));
      } else if (currentType === 'tcx') {
        parsed = parseTCX(new TextDecoder().decode(arrayBuffer));
      } else if (currentType === 'fit') {
        parsed = await parseFIT(arrayBuffer); // placeholder
      }

      if (!parsed || !parsed.points || parsed.points.length < 2) {
        notify('Failed to parse route points.', 'error');
        return;
      }

      const name = parsed.name || inferName(parsed.points);
      const start = parsed.points[0];
      const finish = parsed.points[parsed.points.length - 1];

      // 1) Ensure trip context / Day 1 exists
      ensureDay1();

      // 2) Add Start & Finish as itinerary items
      const dayIndex = 0; // Day 1
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

      appendItemToDay(dayIndex, startItem);
      appendItemToDay(dayIndex, finishItem);

      // 3) Draw route polyline
      drawImportedRoute(parsed.points, name);

      // 4) Optional: store geometry in trip state
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

  /* --------- Parsers --------- */

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
    // Basic TCX (Training Center XML) parsing: Trackpoint > Position > LatitudeDegrees / LongitudeDegrees
    const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
    const tp = Array.from(doc.getElementsByTagName('Trackpoint'));
    const name = extractTCXName(doc);

    const points = [];
    tp.forEach(t => {
      const latNode = t.getElementsByTagName('LatitudeDegrees')[0];
      const lonNode = t.getElementsByTagName('LongitudeDegrees')[0];
      if (!latNode || !lonNode) return;
      const lat = parseFloat(latNode.textContent);
      const lon = parseFloat(lonNode.textContent);
      let ele = null;
      const eleNode = t.getElementsByTagName('AltitudeMeters')[0];
      if (eleNode) ele = parseFloat(eleNode.textContent);
      if (isFinite(lat) && isFinite(lon)) {
        points.push({ lat, lon, ele });
      }
    });

    return { name, points };
  }

  function extractTCXName(doc) {
    // Optional heuristics for Activity > Lap > Notes or Name – often not present
    const activity = doc.querySelector('Activity');
    if (!activity) return null;
    const id = activity.querySelector('Id');
    return id ? id.textContent.trim() : null;
  }

  async function parseFIT(arrayBuffer) {
    // Placeholder: Real FIT decode needs a lib (e.g. https://github.com/iskoel/fitsdk or fit-file-parser)
    // You can include a small parser and map messages of type 'record' with position_lat / position_long.
    // For now, we reject to signal not implemented.
    throw new Error('FIT parser not implemented. Add a FIT decoding library.');
  }

  /* --------- Helpers --------- */

  function inferName(points) {
    if (!points.length) return 'Imported Route';
    const s = points[0];
    const f = points[points.length - 1];
    return `Route (${s.lat.toFixed(3)},${s.lon.toFixed(3)}) → (${f.lat.toFixed(3)},${f.lon.toFixed(3)})`;
  }

  function ensureDay1() {
    // Implement based on existing app state. Placeholder:
    if (!window.tripPlan) {
      window.tripPlan = { days: [] };
    }
    if (!Array.isArray(window.tripPlan.days)) window.tripPlan.days = [];
    if (window.tripPlan.days.length === 0) {
      window.tripPlan.days.push({
        title: 'Day 1',
        items: []
      });
      // If you have a UI render function:
      if (typeof window.renderTripDays === 'function') {
        window.renderTripDays();
      } else {
        // Or trigger a lightweight refresh if needed.
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
    } else {
      // fallback: if you have a generic rerender
      if (typeof window.renderTripDays === 'function') window.renderTripDays();
    }
  }

  function drawImportedRoute(points, name) {
    if (typeof L === 'undefined') {
      console.warn('[import-route] Leaflet not found, skipping map polyline.');
      return;
    }
    if (!window.__importLayers) window.__importLayers = [];

    const latlngs = points.map(p => [p.lat, p.lon]);
    const poly = L.polyline(latlngs, {
      color: '#8a4af3',
      weight: 4,
      opacity: 0.85
    });

    poly.addTo(window.map); // assume global Leaflet map is "map"
    window.__importLayers.push(poly);
    try {
      window.map.fitBounds(poly.getBounds(), { padding: [30, 30] });
    } catch (e) { /* ignore */ }

    // Optional start/finish markers
    const start = latlngs[0];
    const finish = latlngs[latlngs.length - 1];
    if (start) {
      L.circleMarker(start, {
        radius: 6, color: '#0f766e', fillColor:'#14b8a6', fillOpacity: 0.9
      }).addTo(window.map).bindTooltip('Start', {permanent:false});
    }
    if (finish) {
      L.circleMarker(finish, {
        radius: 6, color: '#7f1d1d', fillColor:'#dc2626', fillOpacity: 0.9
      }).addTo(window.map).bindTooltip('Finish', {permanent:false});
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
    // Optional: store last import metadata
    window.lastImportedRoute = meta;
    // If you have localStorage logic:
    try {
      localStorage.setItem('lastImportedRoute', JSON.stringify(meta));
    } catch {}
  }

  function notify(msg, type='info') {
    console.log('[import-route]', type, msg);
    // If you have a toast system, call it here
    if (window.showToast) window.showToast(msg, type);
  }

})();