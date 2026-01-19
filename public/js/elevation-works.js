window.__scaleBarDrag = null;
window.__scaleBarDragTrack = null;
window.__scaleBarDragSelDiv = null;




function fmt(distanceMeters, durationSeconds, ascentM, descentM) {
    const distStr = (typeof distanceMeters === 'number')
      ? (distanceMeters / 1000).toFixed(2) + ' km' : '';
    const duraStr = (typeof durationSeconds === 'number')
      ? Math.round(durationSeconds / 60) + ' min' : '';
    const ascStr = (typeof ascentM === 'number')
      ? Math.round(ascentM) + ' m' : '';
    const descStr = (typeof descentM === 'number')
      ? Math.round(descentM) + ' m' : '';
    return { distStr, duraStr, ascStr, descStr };
  }

function buildBadgesHTML(strings) {
    const parts = [];
    if (strings.distStr) {
      parts.push(`
        <span class="stat stat-distance">
          <img class="icon" src="${window.TT_SVG_ICONS.distance}" alt="Distance" loading="lazy" decoding="async">
          <span class="badge">${strings.distStr}</span>
        </span>
      `);
    }
    if (strings.duraStr) {
      parts.push(`
        <span class="stat stat-duration">
          <img class="icon" src="${window.TT_SVG_ICONS.duration}" alt="Duration" loading="lazy" decoding="async">
          <span class="badge">${strings.duraStr}</span>
        </span>
      `);
    }
    if (strings.ascStr) {
      parts.push(`
        <span class="stat stat-ascent">
          <img class="icon" src="${window.TT_SVG_ICONS.ascent}" alt="Ascent" loading="lazy" decoding="async">
          <span class="badge">${strings.ascStr}</span>
        </span>
      `);
    }
    if (strings.descStr) {
      parts.push(`
        <span class="stat stat-descent">
          <img class="icon" src="${window.TT_SVG_ICONS.descent}" alt="Descent" loading="lazy" decoding="async">
          <span class="badge">${strings.descStr}</span>
        </span>
      `);
    }
    return parts.join(' ');
  }




        // Nice tick helpers
function niceStep(total, target) {
  const raw = total / Math.max(1, target);
  const p10 = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p10;
  const f = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return f * p10;
}

function movingAverage(arr, win = 5) {
  return arr.map((v, i, a) => {
    const start = Math.max(0, i - Math.floor(win/2));
    const end = Math.min(a.length, i + Math.ceil(win/2));
    const slice = a.slice(start, end);
    return slice.reduce((sum, val) => sum + val, 0) / slice.length;
  });
}

function getSlopeColor(slope) {
  // Dengeli (orta doygunluk) tonlar
  if (slope < 2)  return "#9CCC65"; // medium-soft green
  if (slope < 6)  return "#E6C15A"; // mellow mustard
  if (slope < 10) return "#F2994A"; // balanced orange
  if (slope < 15) return "#EF5350"; // medium soft red
  return "#9575CD";                 // soft purple
}

// Window'a elevation data kontrol fonksiyonu ekle
window.ensureElevationDataLoaded = function(day) {
    return new Promise((resolve) => {
        let attempts = 0;
        const checkInterval = setInterval(() => {
            attempts++;
            const elevData = window.routeElevStatsByDay && window.routeElevStatsByDay[day];
            
            if (elevData || attempts > 10) {
                clearInterval(checkInterval);
                resolve(elevData || null);
            }
        }, 200);
    });
};


function clearRouteSegmentHighlight(day) {
  if (window._segmentHighlight && window._segmentHighlight[day]) {
    Object.values(window._segmentHighlight[day]).forEach(poly => {
      try { poly.remove(); } catch(_) {}
    });
    delete window._segmentHighlight[day];
  }
  // MUTLAKA global state’i temizle:
  window._lastSegmentDay = undefined;
  window._lastSegmentStartKm = undefined;
  window._lastSegmentEndKm = undefined;

  // Segment overlay DOM’u da temizle (isteğe bağlı)
  const bar = document.getElementById(`expanded-route-scale-bar-day${day}`);
  if (bar) {
    bar.querySelectorAll('svg[data-role="elev-segment"]').forEach(el => el.remove());
bar.querySelectorAll('.elev-segment-toolbar').forEach(el => el.remove());
    const sel = bar.querySelector('.scale-bar-selection');
    if (sel) sel.style.display = 'none';
  }
}



function createScaleElements(track, widthPx, spanKm, startKmDom, markers = [], customElevData = null, retryCount = 0) {
    // 1. KONTROL: Element yoksa veya DOM'dan tamamen silinmişse işlemi durdur.
    if (!track || !track.isConnected) {
        return;
    }

    // 2. KONTROL: Element var ama görünür değilse (örn: display:none), sonsuz döngüye girme.
    // Sadece 5 kere (yaklaşık 1.5 saniye) dene, sonra vazgeç.
    if (track.offsetParent === null) {
        if (retryCount < 5) {
            setTimeout(() => {
                createScaleElements(track, widthPx, spanKm, startKmDom, markers, customElevData, retryCount + 1);
            }, 300);
        }
        return;
    }

    // --- Mevcut Temizlik İşlemleri ---
    if (track) {
        track.querySelectorAll('.marker-badge').forEach(el => el.remove());
    }

    const container = track?.parentElement;
    
    // SpanKm hesaplama mantığı
    if ((!spanKm || spanKm < 0.01) && !customElevData) {
        if (Array.isArray(markers) && markers.length > 1) {
            spanKm = getTotalKmFromMarkers(markers);
        }
    }
   
    if (!spanKm || spanKm < 0.01) {
        track.querySelectorAll('.marker-badge').forEach(el => el.remove());
        return;
    }

    // Eski elementleri temizle
    track.querySelectorAll('.scale-bar-tick, .scale-bar-label, .marker-badge, .elevation-labels-container').forEach(el => el.remove());

    // --- Ticks & Labels ---
    const targetCount = Math.max(6, Math.min(14, Math.round(widthPx / 100)));
    let stepKm = niceStep(spanKm, targetCount);
    let majors = Math.max(1, Math.round(spanKm / Math.max(stepKm, 1e-6)));
    
    if (majors < 6) { stepKm = niceStep(spanKm, 6); majors = Math.round(spanKm / stepKm); }
    if (majors > 14) { stepKm = niceStep(spanKm, 14); majors = Math.round(spanKm / stepKm); }

    for (let i = 0; i <= majors; i++) {
        const curKm = Math.min(spanKm, i * stepKm);
        const leftPct = (curKm / spanKm) * 100;

        const tick = document.createElement('div');
        tick.className = 'scale-bar-tick';
        tick.style.left = `${leftPct}%`;
        tick.style.position = 'absolute';
        tick.style.top = '10px';
        tick.style.width = '1px';
        tick.style.height = '16px';
        tick.style.background = '#cfd8dc';
        track.appendChild(tick);

        const label = document.createElement('div');
        label.className = 'scale-bar-label';
        label.style.left = `${leftPct}%`;
        label.style.position = 'absolute';
        label.style.top = '30px';
     
        if (i === 0) {
            label.style.transform = 'translateX(0%)'; 
            label.style.textAlign = 'left';
        } else if (i === majors) {
            label.style.transform = 'translateX(-100%)';
            label.style.textAlign = 'right';
        } else {
            label.style.transform = 'translateX(-50%)'; 
            label.style.textAlign = 'center';
        }

        label.style.fontSize = '11px';
        label.style.color = '#607d8b';
        label.textContent = `${(startKmDom + curKm).toFixed(spanKm > 20 ? 0 : 1)} km`;
        track.appendChild(label);
    }

    // --- MARKER POSITIONING ---
    let activeData = null;
   
    // Container üzerinden elevation verisi al
    if (container && container._elevationData) {
        const { smooth, min, max } = container._elevationData;
        let vizMin = min, vizMax = max;
        const eSpan = max - min;
        // Padding: yukarıya %10, aşağıya %5
        if (eSpan > 0) { 
          vizMin = min - eSpan * 0.05; 
          vizMax = max + eSpan * 0.10; 
        }
        else { 
          vizMin = min - 1; 
          vizMax = max + 1; 
        }
        activeData = { smooth, vizMin, vizMax };
    }

    if (Array.isArray(markers)) {
        markers.forEach((m, idx) => {
            let dist = typeof m.distance === "number" ? m.distance : 0;
           
            // Segment dışındakileri çizme
            if (dist < startKmDom - 0.05 || dist > startKmDom + spanKm + 0.05) {
                return;
            }

            const relKm = dist - startKmDom;
            let left = spanKm > 0 ? (relKm / spanKm) * 100 : 0;
            left = Math.max(0, Math.min(100, left));

            let bottomStyle = "2px"; 

            if (activeData && activeData.smooth && activeData.smooth.length > 0) {
                const { smooth, vizMin, vizMax } = activeData;
                const pct = Math.max(0, Math.min(1, left / 100));
                const sampleIdx = Math.floor(pct * (smooth.length - 1));
                const val = smooth[sampleIdx];
               
                if (typeof val === 'number') {
                    const heightPct = ((val - vizMin) / (vizMax - vizMin)) * 100;
                    bottomStyle = `calc(${heightPct}% - 7px)`;
                }
            }

            let transformX = '-50%';
            if (left < 1) transformX = '0%';
            else if (left > 99) transformX = '-100%';

            const displayNum = m.originalIndex ? m.originalIndex : (idx + 1);

            const wrap = document.createElement('div');
            wrap.className = 'marker-badge';
            wrap.style.cssText = `position:absolute;left:${left}%;bottom:${bottomStyle};width:18px;height:18px;transform:translateX(${transformX});z-index:5;`;
            wrap.title = m.name || '';
            wrap.innerHTML = `<div style="width:18px;height:18px;border-radius:50%;background:#d32f2f;border:1px solid #fff;box-shadow:0 2px 6px #888;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;font-weight:700;">${displayNum}</div>`;
            track.appendChild(wrap);
        });
    }

    // --- Grid Labels ---
    let gridLabels = [];
    if (customElevData) {
        const { vizMin, vizMax } = customElevData;
        for(let i=0; i<=4; i++) {
            const val = vizMin + (i/4)*(vizMax - vizMin);
            const pct = (i/4) * 100; 
            gridLabels.push({ value: Math.round(val) + ' m', pct: pct });
        }
    } else {
        const svg = track.querySelector('svg.tt-elev-svg');
        if (svg) {
            gridLabels = Array.from(svg.querySelectorAll('text'))
                .map(t => ({
                    value: t.textContent.trim(),
                    y: Number(t.getAttribute('y')),
                    svgHeight: Number(svg.getAttribute('height')) || 180
                }))
                .filter(obj => /-?\d+\s*m$/.test(obj.value));
        }
    }

    const elevationLabels = document.createElement('div');
    elevationLabels.className = 'elevation-labels-container';

    gridLabels.forEach((obj, index) => { 
        let topStyle = '';
        if (typeof obj.pct !== 'undefined') {
            topStyle = `top: ${100 - obj.pct}%; transform: translateY(-50%);`;
        } else {
            const trackHeight = track.clientHeight || 180;
            const correctedY = (obj.y / obj.svgHeight) * trackHeight;
            topStyle = `top: ${correctedY}px;`;
        }

        const wrapper = document.createElement('div');
        wrapper.style.cssText = `position: absolute; right: 0; ${topStyle}`;

        const tick = document.createElement('div');
        tick.style.cssText = `width: 35px; border-bottom: 1px dashed #cfd8dc; opacity: 0.7; display: block; margin-left: 0px; margin-top: 0px;`;

        const label = document.createElement('div');
        label.className = 'elevation-label';
        label.style.cssText = `font-size: 11px; color: #607d8b; background: none; line-height: 1.5; text-align: right; padding-right: 0px; white-space: nowrap;`;
        label.textContent = obj.value;
        label.style.display = 'block';

        wrapper.appendChild(tick);
        wrapper.appendChild(label);
        elevationLabels.appendChild(wrapper);
    });

    track.style.position = 'relative';
    track.appendChild(elevationLabels);
}

function renderRouteScaleBar(container, totalKm, markers) {
  // 1. CSS GÜVENLİK KİLİDİ
  if (!document.getElementById('tt-scale-bar-css')) {
    const style = document.createElement('style');
    style.id = 'tt-scale-bar-css';
    style.innerHTML = `
        .scale-bar-track.loading > *:not(.tt-scale-loader):not(.elevation-labels-container) { opacity: 1; pointer-events: none; transition: opacity 0.2s ease; }
        .scale-bar-track.loading .tt-scale-loader { opacity: 1 !important; }
        .scale-bar-track.loading .elevation-labels-container { opacity: 1 !important; pointer-events: auto !important; }
        .scale-bar-track.loading { min-height: 200px; width: 100%; position: relative; }
        .tt-elev-tooltip { z-index: 9999 !important; }
        .scale-bar-vertical-line { z-index: 9998 !important; }
        .scale-bar-selection { z-index: 9000 !important; }
        .dots { display: inline-block; width: 30px; text-align: left; color: #1976d2; }
        .dots::after { content: '...'; animation: gentlePulse 1.8s infinite ease-in-out; }
        @keyframes gentlePulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
    `;
    document.head.appendChild(style);
  }

  const spinner = container.querySelector('.spinner');
  if (spinner) spinner.remove();
  
  const dayMatch = container.id && container.id.match(/day(\d+)/);
  const day = dayMatch ? parseInt(dayMatch[1], 10) : null;
  const gjKey = day ? (window.lastRouteGeojsons && window.lastRouteGeojsons[`route-map-day${day}`]) : null;
  
  // 1. Önce resmi rotayı (OSRM) almaya çalış
  let coords = gjKey && gjKey.features && gjKey.features[0]?.geometry?.coordinates;

  // 2. FALLBACK (B PLAN): Eğer resmi rota yoksa, markerları düz çizgiyle bağla.
  if (!Array.isArray(coords) || coords.length < 2) {
      if (typeof getDayPoints === 'function' && day) {
          const rawPoints = getDayPoints(day);
          const validPoints = rawPoints.filter(p => p.lat && p.lng && !isNaN(parseFloat(p.lat)) && !isNaN(parseFloat(p.lng)));
          
          if (validPoints.length >= 2) {
              coords = validPoints.map(p => [parseFloat(p.lng), parseFloat(p.lat)]);
              
              if (!totalKm || totalKm <= 0 || isNaN(totalKm)) {
                  let distCalc = 0;
                  const R = 6371000; const toRad = x => x * Math.PI / 180;
                  for(let k=1; k<validPoints.length; k++) {
                      const lat1 = parseFloat(validPoints[k-1].lat); const lon1 = parseFloat(validPoints[k-1].lng);
                      const lat2 = parseFloat(validPoints[k].lat); const lon2 = parseFloat(validPoints[k].lng);
                      const dLat = toRad(lat2 - lat1); const dLon = toRad(lon2 - lon1);
                      const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
                      distCalc += 2 * R * Math.asin(Math.sqrt(a));
                  }
                  if (distCalc > 0) totalKm = distCalc / 1000;
                  else totalKm = 1;
              }
          }
      }
  }

  // Güvenlik çıkışı
  if (!container || (isNaN(totalKm) && (!coords || coords.length < 2))) {
    if (container) { container.innerHTML = ""; container.style.display = 'block'; }
    return;
  }
  
  if (isNaN(totalKm) || totalKm <= 0) totalKm = 10;

  delete container._elevationData;
  delete container._elevationDataFull;

  if (/^route-scale-bar-day\d+$/.test(container.id || '')) {
    container.innerHTML = '<div class="spinner"></div>';
    return;
  }

  // Koordinat kontrolü (Tekrar)
  if (!Array.isArray(coords) || coords.length < 2) {
    container.innerHTML = `<div class="scale-bar-track"><div style="text-align:center;padding:12px;font-size:13px;color:#c62828;">Route points not found</div></div>`;
    container.style.display = 'block';
    return;
  }
  
  const mid = coords[Math.floor(coords.length / 2)];
  const routeKey = `${coords.length}|${coords[0]?.join(',')}|${mid?.join(',')}|${coords[coords.length - 1]?.join(',')}`;
  
  // Rate limit kontrolü
  if (Date.now() < (window.__elevCooldownUntil || 0)) {
    if (!container.__elevRetryTimer && typeof planElevationRetry === 'function') {
      const waitMs = Math.max(5000, (window.__elevCooldownUntil || 0) - Date.now());
      planElevationRetry(container, routeKey, waitMs, () => renderRouteScaleBar(container, totalKm, markers));
    }
    return;
  }

  // Loading UI
  let track = container.querySelector('.scale-bar-track');
  if (!track) {
    container.innerHTML = `
      <div class="scale-bar-track">
        <div class="elevation-placeholder" style="
          width: 100%;
          height: 220px;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #6c757d;
          font-size: 14px;
        ">
          <div class="elev-animation" style="display: flex; align-items: center; gap: 10px;">
            <div class="spinner"></div>
            <div>Loading elevation</div>
          </div>
        </div>
      </div>
    `;
    track = container.querySelector('.scale-bar-track');
  }

  track.classList.add('loading');
  container.dataset.totalKm = String(totalKm);

  //km'de nokta sayısı: 2'den 5'e
  // const N = Math.max(40, Math.round(totalKm * 2));

  const N = Math.max(80, Math.round(totalKm * 2));
  
  function hv(lat1, lon1, lat2, lon2) {
    const R = 6371000, toRad = x => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }
  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1];
    const [lon2, lat2] = coords[i];
    cum[i] = cum[i - 1] + hv(lat1, lon1, lat2, lon2);
  }
  const totalM = cum[cum.length - 1] || 1;

  const samples = [];
  for (let i = 0; i < N; i++) {
    const target = (i / (N - 1)) * totalM;
    let idx = 0;
    while (idx < cum.length && cum[idx] < target) idx++;
    if (idx === 0) {
      const [lon, lat] = coords[0];
      samples.push({ lat, lng: lon, distM: 0 });
    } else if (idx >= cum.length) {
      const [lon, lat] = coords[cum.length - 1];
      samples.push({ lat, lng: lon, distM: totalM });
    } else {
      const p = idx - 1, segLen = (cum[idx] - cum[p]) || 1, t = (target - cum[p]) / segLen;
      const [lon1, lat1] = coords[p], [lon2, lat2] = coords[idx];
      samples.push({ lat: lat1 + (lat2 - lat1) * t, lng: lon1 + (lon2 - lon1) * t, distM: target });
    }
  }

  container._elevFullSamples = samples.slice();
  container._elevSamples = samples.slice();
  container._elevStartKm = 0;
  container._elevKmSpan = totalKm;

  (async () => {
    try {
      let elevations = [];

try {
const locations = samples.map(s => `${s.lat},${s.lng}`);
const response = await fetch('/api/elevation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locations })
});;
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    
    // Backend'den gelen formatı client formatına çevir
    if (data && Array.isArray(data.results)) {
        elevations = data.results.map(r => r.elevation || 0);
    }
    
} catch (error) {
    console.error('Elevation fetch failed:', error);
    // Fallback elevation
    elevations = samples.map((_, i) => 60 + Math.sin(i * 0.1) * 20);
}      
      // --- ROBUST DATA REPAIR (VERİ TAMİRİ) ---
      // Veri null gelirse boş dizi yap, hata vermesin.
      if (!elevations) {
          console.warn("Elevation data is null, using empty array fallback.");
          elevations = [];
      }

      // 1. Uzunluk Eşitleme (Padding/Truncating)
      // API bazen 1-2 nokta eksik veya fazla dönebilir.
      if (elevations.length !== samples.length) {
          if (elevations.length > samples.length) {
              elevations = elevations.slice(0, samples.length);
          } else {
              // Eksik kalanları son geçerli değerle (veya 0) doldur
              const diff = samples.length - elevations.length;
              const lastVal = (elevations.length > 0) ? elevations[elevations.length - 1] : 0;
              for(let k=0; k<diff; k++) elevations.push(lastVal);
          }
      }

      // 2. Değer Temizleme (Fix Null/NaN/Types)
      // İçindeki null, undefined, string vs. hepsini sayıya çevir.
      elevations = elevations.map((val, idx, arr) => {
          if (val !== null && typeof val === 'number' && isFinite(val)) return val;
          
          // Bozuksa: Öncekini bul
          let prev = null;
          for(let k=idx-1; k>=0; k--) {
              if (arr[k] !== null && typeof arr[k] === 'number' && isFinite(arr[k])) {
                  prev = arr[k]; break;
              }
          }
          if (prev !== null) return prev;

          // Önceki yoksa sonrakini bul
          let next = null;
          for(let k=idx+1; k<arr.length; k++) {
              if (arr[k] !== null && typeof arr[k] === 'number' && isFinite(arr[k])) {
                  next = arr[k]; break;
              }
          }
          if (next !== null) return next;

          return 0; // Hiçbiri yoksa 0
      });
      // ----------------------------------------

      const placeholder = track.querySelector('.elevation-placeholder');
      if (placeholder) placeholder.remove(); 
      const oldLoader = track.querySelector('.tt-scale-loader');
      if (oldLoader) oldLoader.remove(); 
      
      const selDiv = document.createElement('div');
      selDiv.className = 'scale-bar-selection';
      selDiv.style.cssText = `position:absolute; top:0; bottom:0; background: rgba(138,74,243,0.16); border: 1px solid rgba(138,74,243,0.45); display:none; z-index: 9000;`;
      track.appendChild(selDiv);;
      window.__scaleBarDragTrack = track;
      window.__scaleBarDragSelDiv = selDiv;

      setupScaleBarEvents(track, selDiv); 

      const width = Math.max(200, Math.round(track.getBoundingClientRect().width)) || 400;
      const svgNS = 'http://www.w3.org/2000/svg';
      const SVG_TOP = 48;
      const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      let SVG_H = isMobile
        ? Math.max(180, Math.min(240, Math.round(track.getBoundingClientRect().height - SVG_TOP - 12)))
        : Math.max(180, Math.min(320, Math.round(track.getBoundingClientRect().height - SVG_TOP - 16)));
      if (isNaN(SVG_H)) SVG_H = isMobile ? 160 : 220;

      const svgElem = document.createElementNS(svgNS, 'svg');
      svgElem.setAttribute('class', 'tt-elev-svg');
      svgElem.setAttribute('data-role', 'elev-base');
      svgElem.setAttribute('viewBox', `0 0 ${width} ${SVG_H}`);
      svgElem.setAttribute('preserveAspectRatio', 'none');
      svgElem.setAttribute('width', '100%');
      svgElem.setAttribute('height', SVG_H);
      track.appendChild(svgElem);
      console.log("[SCALEBAR][SVG]", {svgElem, width, height: SVG_H, track});

      const gridG = document.createElementNS(svgNS, 'g');
      gridG.setAttribute('class', 'tt-elev-grid');
      svgElem.appendChild(gridG);

      const areaPath = document.createElementNS(svgNS, 'path');
      areaPath.setAttribute('class', 'tt-elev-area');
      svgElem.appendChild(areaPath);

      const segG = document.createElementNS(svgNS, 'g');
      segG.setAttribute('class', 'tt-elev-segments');
      svgElem.appendChild(segG);

      const verticalLine = document.createElement('div');
      verticalLine.className = 'scale-bar-vertical-line';
      verticalLine.style.cssText = `position:absolute;top:0;bottom:0;width:2px;background:#111;opacity:0.5;pointer-events:none;z-index:9998;display:block;`;
      verticalLine.style.left = '0px'; 
      track.appendChild(verticalLine);

      const tooltip = document.createElement('div');
      tooltip.className = 'tt-elev-tooltip';
      tooltip.style.left = '0px';
      tooltip.style.display = 'none';
      tooltip.style.zIndex = '9999';
      track.appendChild(tooltip);

      const onMoveTooltip = function(e) {
        const ed = container._elevationData;
        if (!ed || !Array.isArray(ed.smooth)) return;
        tooltip.style.display = 'block';
        const s = container._elevSamples || [];
        const startKmDom = Number(container._elevStartKm || 0);
        const spanKm = Number(container._elevKmSpan || totalKm) || 1;
        const rect = track.getBoundingClientRect();
        const ptX = (e.touches && e.touches[0]) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
        let x = ptX;
        let percent = Math.max(0, Math.min(1, ptX / rect.width));
        let foundKmAbs, foundSlope = 0, foundElev = null;
        if (typeof track._segmentStartPx === "number" && typeof track._segmentWidthPx === "number" && track._segmentWidthPx > 0) {
          let segPercent = percent;
          const segStartKm = startKmDom;
          const segEndKm = startKmDom + spanKm;
          foundKmAbs = segStartKm + segPercent * (segEndKm - segStartKm);
        } else {
          foundKmAbs = startKmDom + percent * spanKm;
        }
let minDist = Infinity;
let bestIndex = 0;
for (let i = 0; i < s.length; i++) {
  const kmAbs = s[i].distM / 1000;
  const dist = Math.abs(foundKmAbs - kmAbs);
  if (dist < minDist) {
    minDist = dist;
    bestIndex = i;
    if (i > 0) {
      const dx = s[i].distM - s[i - 1].distM;
      const dy = ed.smooth[i] - ed.smooth[i - 1];
      foundSlope = dx > 0 ? (dy / dx) * 100 : 0;
    }
  }
}
if (bestIndex < ed.smooth.length) {
  foundElev = Math.round(ed.smooth[bestIndex]);
} else {
  foundElev = Math.round(ed.smooth[ed.smooth.length - 1]);
}

        tooltip.style.opacity = '1';
        tooltip.textContent = `${foundKmAbs.toFixed(2)} km • ${foundElev ?? ''} m • %${foundSlope.toFixed(1)} slope`;
        
        const tooltipWidth = tooltip.offsetWidth || 140;
        const scaleBarRight = rect.right;
        const mouseScreenX = (e.touches && e.touches.length) ? e.touches[0].clientX : e.clientX;
        let tooltipLeft;
        if ((mouseScreenX + tooltipWidth + 8) > scaleBarRight) {
          tooltipLeft = Math.max(0, x - tooltipWidth - 12);
          tooltip.style.left = `${tooltipLeft}px`;
        } else {
          tooltipLeft = x + 14;
          tooltip.style.left = `${tooltipLeft}px`;
        }
        verticalLine.style.left = `${x}px`;
        verticalLine.style.display = 'block';
      };

      track.removeEventListener('mousemove', onMoveTooltip);
      track.removeEventListener('touchmove', onMoveTooltip);
      track.addEventListener('mousemove', onMoveTooltip);
      track.addEventListener('touchmove', onMoveTooltip);

       // ARTIK KESÄ°N GEÃ‡ERLÄ°DÄ°R
      console.log("[ELEV RAW]", {
        totalPoints: elevations.length,
        min: Math.min(...elevations.filter(e => e != null)),
        max: Math.max(...elevations.filter(e => e != null)),
        first5: elevations.slice(0, 5)
      });
      
      const smooth = elevations; // Yumuşatma kaldırıldı - veri olduğu gibi
      const min = Math.min(...smooth);
      const max = Math.max(...smooth, min + 1);
      
      console.log("[ELEV SMOOTH]", {
        min: Math.round(min),
        max: Math.round(max),
        range: Math.round(max - min)
      });



      container._elevationData = { smooth, min, max };
      container._elevationDataFull = { smooth: smooth.slice(), min, max };
      container.dataset.elevLoadedKey = routeKey;

     container._redrawElevation = function(elevationData) {
        if (!elevationData) return;
        const { smooth, min, max } = elevationData;
        const s = container._elevSamples || [];
        const startKmDom = Number(container._elevStartKm || 0);
        const spanKm = Number(container._elevKmSpan || totalKm) || 1;

       
        let vizMin, vizMax;
        const eSpan = max - min;  // ← ADD THIS LINE
        if (eSpan > 0) {
          vizMin = min - eSpan * 0.05; 
          vizMax = max + eSpan * 0.10; 
        } 
        else { 
          vizMin = min - 1; 
          vizMax = max + 1; 
        }

        const X = kmRel => (kmRel / spanKm) * width;
        const Y = e => (isNaN(e) || vizMin === vizMax) ? (SVG_H / 2) : ((SVG_H - 1) - ((e - vizMin) / (vizMax - vizMin)) * (SVG_H - 2));

        console.log("[Y_CALC]", {
  vizMin: Math.round(vizMin),
  vizMax: Math.round(vizMax),
  SVG_H: SVG_H,
  sample_Y_values: [
    Y(vizMin),
    Y(vizMin + 500),
    Y(vizMin + 1000),
    Y(vizMax)
  ]
});

        while (gridG.firstChild) gridG.removeChild(gridG.firstChild);
        while (segG.firstChild) segG.removeChild(segG.firstChild);

        for (let i = 0; i <= 4; i++) {
            const ev = vizMin + (i / 4) * (vizMax - vizMin);
            const y = Y(ev);
            if (isNaN(y)) continue;
            const ln = document.createElementNS(svgNS, 'line');
            ln.setAttribute('x1', '0'); ln.setAttribute('x2', String(width));
            ln.setAttribute('y1', String(y)); ln.setAttribute('y2', String(y));
            ln.setAttribute('stroke', '#d7dde2'); ln.setAttribute('stroke-dasharray', '4 4'); ln.setAttribute('opacity', '.8');
            gridG.appendChild(ln);

            const tx = document.createElementNS(svgNS, 'text');
            tx.setAttribute('x', '6'); tx.setAttribute('y', String(y - 4));
            tx.setAttribute('fill', '#90a4ae'); tx.setAttribute('font-size', '11');
            tx.textContent = `${Math.round(ev)} m`;
            gridG.appendChild(tx);
        }

        let topD = '';
        const n = Math.min(smooth.length, s.length);
        for (let i = 0; i < n; i++) {
          const kmAbs = s[i].distM / 1000;
          const x = Math.max(0, Math.min(width, X(kmAbs - startKmDom)));
          const y = Y(smooth[i]);
          if (isNaN(x) || isNaN(y)) continue;
          topD += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
        }
        if (topD) {
          const areaD = `${topD} L ${width} ${SVG_H} L 0 ${SVG_H} Z`;
          areaPath.setAttribute('d', areaD);
          areaPath.setAttribute('fill', '#263445');
        }

        for (let i = 1; i < n; i++) {
          const kmAbs1 = s[i - 1].distM / 1000;
          const kmAbs2 = s[i].distM / 1000;
          const x1 = Math.max(0, Math.min(width, X(kmAbs1 - startKmDom)));
          const y1 = Y(smooth[i - 1]);
          const x2 = Math.max(0, Math.min(width, X(kmAbs2 - startKmDom)));
          const y2 = Y(smooth[i]);

          const dx = s[i].distM - s[i - 1].distM;
          const dy = smooth[i] - smooth[i - 1];
          let slope = 0, color = '#72c100';
          if (i > 1 && dx > 50) {
            slope = (dy / dx) * 100;
            color = (slope < 0) ? '#72c100' : getSlopeColor(slope);
          }

          const seg = document.createElementNS(svgNS, 'line');
          seg.setAttribute('x1', String(x1));
          seg.setAttribute('y1', String(y1));
          seg.setAttribute('x2', String(x2));
          seg.setAttribute('y2', String(y2));
          seg.setAttribute('stroke', color);
          seg.setAttribute('stroke-width', '3');
          seg.setAttribute('stroke-linecap', 'round');
          seg.setAttribute('fill', 'none');
          segG.appendChild(seg);
        }
        
        const customElevData = { vizMin: vizMin, vizMax: vizMax };
        requestAnimationFrame(() => {
            createScaleElements(track, width, spanKm, startKmDom, markers, customElevData);
        });
      };

      function handleResize() {
        if (!container._elevationData) return;
        const newW = Math.max(200, Math.round(track.getBoundingClientRect().width));
        const spanKm = container._elevKmSpan || 1;
        const startKmDom = container._elevStartKm || 0;
        const markers = (typeof getRouteMarkerPositionsOrdered === 'function') ? getRouteMarkerPositionsOrdered(day) : [];
        createScaleElements(track, newW, spanKm, startKmDom, markers);
      }
      if (container._elevResizeObserver) {
        try { container._elevResizeObserver.disconnect(); } catch(_) {}
      }
      const ro = new ResizeObserver(() => { handleResize(); });
      ro.observe(track);
      container._elevResizeObserver = ro;

      requestAnimationFrame(() => {
          container._redrawElevation(container._elevationData);
          window.hideScaleBarLoading?.(container);
          track.classList.remove('loading');
      });

      if (typeof day !== "undefined") {
        let ascent = 0, descent = 0;
        for (let i = 1; i < elevations.length; i++) {
          const d = elevations[i] - elevations[i - 1];
          if (d > 0) ascent += d;
          else descent -= d;
        }
        window.routeElevStatsByDay = window.routeElevStatsByDay || {};
        window.routeElevStatsByDay[day] = { ascent: Math.round(ascent), descent: Math.round(descent) };
        if (typeof updateRouteStatsUI === "function") updateRouteStatsUI(day);
      }
     } catch (err) {
      console.warn("Elevation fetch error:", err);
      window.updateScaleBarLoadingText?.(container, 'Elevation temporarily unavailable');
      
      const placeholder = track.querySelector('.elevation-placeholder');
      if (placeholder) {
        placeholder.innerHTML = `
          <div style="text-align:center;padding:20px;color:#dc3545;">
            <div>⚠️ Elevation unavailable</div>
            <small style="font-size:12px;">Using approximate profile</small>
          </div>
        `;
      }
      track.classList.remove('loading');
      
      // HATA OLSA BİLE MARKERLARI ÇİZ
      const width = Math.max(200, Math.round(track.getBoundingClientRect().width)) || 400;
      const customElevData = { vizMin: 0, vizMax: 100 };
      setTimeout(() => {
          createScaleElements(track, width, totalKm, 0, markers, customElevData);
      }, 50);
    }
  })();
}

// === SCALE BAR DRAG GLOBAL HANDLERLARI (DEBUG MODU) ===
// ============================================================
// SCALE BAR DRAG GLOBAL HANDLERLARI (MOBİL FIX)
// ============================================================
function setupScaleBarInteraction(day, map) {
    // Mobilde Expanded Map içindeki scale barı hedefle
    let scaleBar = document.getElementById(`expanded-route-scale-bar-day${day}`);
    
    // Bulamazsa normal (küçük) haritadakini dene
    if (!scaleBar) {
        scaleBar = document.getElementById(`route-scale-bar-day${day}`);
    }
    
    if (!scaleBar || !map) return;

    // --- 1. Rota Verisini (Geometriyi) Canlı Al ---
    function getRouteGeometry() {
        const containerId = `route-map-day${day}`;
        let coordinates = [];
        let source = "none";

        // A) Fly Mode (Kavisli)
        if (window._curvedArcPointsByDay && window._curvedArcPointsByDay[day] && window._curvedArcPointsByDay[day].length > 0) {
             const arcPts = window._curvedArcPointsByDay[day];
             coordinates = arcPts.map(p => [p[1], p[0]]); // [Lat, Lng]
             source = "fly_arc";
        }

        // B) GeoJSON (OSRM/VPS)
        if (coordinates.length === 0) {
            const geojson = window.lastRouteGeojsons && window.lastRouteGeojsons[containerId];
            if (geojson && geojson.features && geojson.features[0]?.geometry?.coordinates) {
                const coords = geojson.features[0].geometry.coordinates;
                if (coords.length > 2) {
                    coordinates = coords.map(c => [c[1], c[0]]); // [Lat, Lng]
                    source = "geojson";
                }
            }
        }

        // C) Düz Çizgi (Fallback)
        if (coordinates.length === 0 && window.cart) {
            const rawPts = window.cart
                .filter(i => i.day == day && i.location && !isNaN(i.location.lat))
                .map(i => [i.location.lat, i.location.lng]);
            if (rawPts.length > 1) {
                coordinates = rawPts;
                source = "straight";
            }
        }
        return { coordinates, source };
    }

    // --- 2. Mesafe Cache'i Oluştur ---
    function buildGeomCache() {
        const { coordinates, source } = getRouteGeometry();
        if (!coordinates || coordinates.length < 2) return null;
        let totalDist = 0;
        const distIndex = [0];
        for (let i = 1; i < coordinates.length; i++) {
            const prev = coordinates[i - 1];
            const curr = coordinates[i];
            const d = haversine(prev[0], prev[1], curr[0], curr[1]);
            totalDist += d;
            distIndex.push(totalDist);
        }
        return { coords: coordinates, dists: distIndex, totalLen: totalDist, source: source };
    }

    // --- 3. Marker Güncelleme ---
    const updateMarkerPosition = (lat, lng) => {
        // 3D Kontrolü
        const is3DMode = document.getElementById('maplibre-3d-view') && document.getElementById('maplibre-3d-view').style.display !== 'none';
        
        if (is3DMode && window._maplibre3DInstance) {
           if (!window._hoverMarker3D) {
                const el = document.createElement('div');
                el.className = 'hover-marker-3d';
                el.style.cssText = 'background: #8a4af3; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(138, 74, 243, 0.8); pointer-events: none;';
                window._hoverMarker3D = new maplibregl.Marker({ element: el })
                    .setLngLat([lng, lat])
                    .addTo(window._maplibre3DInstance);
            } else {
                window._hoverMarker3D.setLngLat([lng, lat]);
            }
        } else {
            // 2D Marker (Expanded veya Normal harita ayrımı için map ID kullanıyoruz)
            const markerKey = map._container.id || `map_day_${day}`; 
            
            window._hoverMarkersMap = window._hoverMarkersMap || {}; 
            
            let marker = window._hoverMarkersMap[markerKey];

            if (!marker || !map.hasLayer(marker)) {
                const iconHtml = `<div style="background:#8a4af3;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>`;
                const icon = L.divIcon({ className: 'tt-hover-marker-icon', html: iconHtml, iconSize: [18, 18], iconAnchor: [9, 9] });
                marker = L.marker([lat, lng], { icon: icon, zIndexOffset: 9999, interactive: false }).addTo(map);
                window._hoverMarkersMap[markerKey] = marker;
            }
            marker.setLatLng([lat, lng]);
        }
    };

    // --- 4. Hareket Handler (DÜZELTİLDİ: Her harekette cache yenile) ---
    const handleMove = (e) => {
        // [MOBİL FIX]: Her 'move' olayında rotayı yeniden alıyoruz.
        // Bu sayede rota değiştiyse anında yansır, "eski rota" sorunu çözülür.
        scaleBar._routeCache = buildGeomCache();
        
        const cache = scaleBar._routeCache;
        if (!cache) return;

        const rect = scaleBar.getBoundingClientRect();
        const clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
        
        let percent = (clientX - rect.left) / rect.width;
        percent = Math.max(0, Math.min(1, percent));
        
        let targetMetre = 0;
        
        // Ratio ve Segment hesabı
        let geometryRatio = 1.0;
        const containerId = `route-map-day${day}`;
        const summary = window.lastRouteSummaries && window.lastRouteSummaries[containerId];
        
        if (cache.source === 'fly_arc' && summary && summary.distance > 0) {
            geometryRatio = cache.totalLen / summary.distance;
        }

        if ( window._lastSegmentDay === day && typeof window._lastSegmentStartKm === 'number' && typeof window._lastSegmentEndKm === 'number' ) {
            const startKm = window._lastSegmentStartKm;
            const endKm = window._lastSegmentEndKm;
            const currentKm = startKm + (percent * (endKm - startKm));
            targetMetre = (currentKm * 1000) * geometryRatio;
        } else {
            targetMetre = percent * cache.totalLen;
        }

        if (targetMetre > cache.totalLen) targetMetre = cache.totalLen;
        if (targetMetre < 0) targetMetre = 0;

        // Koordinat bulma
        let idx = 0;
        for (let i = 0; i < cache.dists.length; i++) {
            if (cache.dists[i] >= targetMetre) { idx = i; break; }
        }

        let lat, lng;
        if (idx === 0) {
            [lat, lng] = cache.coords[0];
        } else {
            const d1 = cache.dists[idx - 1];
            const d2 = cache.dists[idx];
            const segmentDist = d2 - d1;
            const segmentRatio = (segmentDist > 0.0001) ? (targetMetre - d1) / segmentDist : 0;
            
            const p1 = cache.coords[idx - 1];
            const p2 = cache.coords[idx];
            lat = p1[0] + (p2[0] - p1[0]) * segmentRatio;
            lng = p1[1] + (p2[1] - p1[1]) * segmentRatio;
        }

        if (!isNaN(lat) && !isNaN(lng)) {
            updateMarkerPosition(lat, lng);
        }
    };

    // Temizlik
    const cleanup = () => {
        const markerKey = map._container.id || `map_day_${day}`;
        if (window._hoverMarkersMap && window._hoverMarkersMap[markerKey]) {
            try { map.removeLayer(window._hoverMarkersMap[markerKey]); } catch(e){}
            delete window._hoverMarkersMap[markerKey];
        }
        if (window._hoverMarker3D) {
            try { window._hoverMarker3D.remove(); } catch(e){}
            window._hoverMarker3D = null;
        }
    };

    // Event Listener Yönetimi
    if (scaleBar._activeHandler) {
        scaleBar.removeEventListener('mousemove', scaleBar._activeHandler);
        scaleBar.removeEventListener('touchmove', scaleBar._activeHandler);
        scaleBar.removeEventListener('mouseleave', scaleBar._activeCleanup);
        scaleBar.removeEventListener('touchend', scaleBar._activeCleanup);
    }

    scaleBar.addEventListener('mousemove', handleMove);
    scaleBar.addEventListener('touchmove', handleMove, { passive: true });
    
    scaleBar.addEventListener('mouseleave', cleanup);
    scaleBar.addEventListener('touchend', cleanup);

    scaleBar._activeHandler = handleMove;
    scaleBar._activeCleanup = cleanup;
}


// Helper: Selection eventlerini bağla
function setupScaleBarEvents(track, selDiv) {
  // Önceki eventleri temizle
  window.removeEventListener('mousemove', window.__sb_onMouseMove);
  window.removeEventListener('mouseup', window.__sb_onMouseUp);
  window.removeEventListener('touchmove', window.__sb_onMouseMove); 
  window.removeEventListener('touchend', window.__sb_onMouseUp);   

  // Yeni eventleri ekle
  window.addEventListener('mousemove', window.__sb_onMouseMove);
  window.addEventListener('mouseup', window.__sb_onMouseUp);
  window.addEventListener('touchmove', window.__sb_onMouseMove, { passive: false }); 
  window.addEventListener('touchend', window.__sb_onMouseUp);     

  // Mouse Down
  track.addEventListener('mousedown', function(e) {
    const rect = track.getBoundingClientRect();
    window.__scaleBarDrag = { startX: e.clientX - rect.left, lastX: e.clientX - rect.left };
    window.__scaleBarDragTrack = track;
    window.__scaleBarDragSelDiv = selDiv;
    selDiv.style.left = `${window.__scaleBarDrag.startX}px`;
    selDiv.style.width = `0px`;
    selDiv.style.display = 'block';
  });

  // Mobil Long Press
  let longPressTimer = null;
  track.addEventListener('touchstart', function(e) {
    const rect = track.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    longPressTimer = setTimeout(() => {
        window.__scaleBarDrag = { startX: x, lastX: x };
        window.__scaleBarDragTrack = track;
        window.__scaleBarDragSelDiv = selDiv;
        selDiv.style.left = `${x}px`;
        selDiv.style.width = `0px`;
        selDiv.style.display = 'block';
        if (navigator.vibrate) navigator.vibrate(40);
    }, 600);
  }, { passive: true });

  track.addEventListener('touchmove', function(e) {
      if (longPressTimer && !window.__scaleBarDrag) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
      }
  }, { passive: true });

  track.addEventListener('touchend', function() {
      if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
      }
  });
}


  // 3) Override updateRouteStatsUI to also include ascent/descent and new icons
window.updateRouteStatsUI = function(day) {
    const key = `route-map-day${day}`;
    const summary = window.lastRouteSummaries?.[key] || null;
    const expandedContainer = document.getElementById(`expanded-map-${day}`);
    
    // NOT: Eski .route-stats'ı (varsa) kaldır
    expandedContainer?.querySelector('.route-stats')?.remove();

    // Mevcut segment toolbar'ı bul
    const existingToolbar = expandedContainer?.querySelector('.elev-segment-toolbar');
    
    // 1. Segment seçili mi kontrol et
    const isSegmentSelected = window._lastSegmentDay === day && 
                              typeof window._lastSegmentStartKm === 'number' &&
                              typeof window._lastSegmentEndKm === 'number';

    // 2. Küçük harita kontrol çubuğunda (map-bottom-controls) normal istatistikleri göster
    const smallSpan = document.querySelector(`#map-bottom-controls-day${day} .route-summary-control`);
    if (smallSpan && summary) {
        const elev = window.routeElevStatsByDay?.[day] || {};
        const strings = fmt(summary.distance, summary.duration, elev.ascent, elev.descent);
        smallSpan.innerHTML = buildBadgesHTML(strings);
    }

    if (!expandedContainer) return; // Genişletilmiş harita yoksa çık

    // 3. Segment seçiliyse: drawSegmentProfile zaten ilgili toolbar'ı oluşturdu/bıraktı. Çık.
    if (isSegmentSelected) {
        if (existingToolbar) existingToolbar.style.display = 'flex';
        return;
    } 
    
    // 4. Segment seçili değilse: TAM ROTA istatistiklerini Segment Toolbar formunda yaz
    
    // Önce eski segment toolbar'ı kaldır
    if (existingToolbar) existingToolbar.remove();

    if (summary) {
        const elev = window.routeElevStatsByDay?.[day] || {};
        const totalKm = (summary.distance / 1000).toFixed(1);
        const up = Math.round(elev.ascent || 0);
        const down = Math.round(elev.descent || 0);
        const durationMin = Math.round(summary.duration / 60);

        // Avg Grade bilgisi Road için **KULLANILMAYACAK**. Sadece mesafeler gösterilecek.
        
        const tb = document.createElement('div');
        tb.className = 'elev-segment-toolbar';
        tb.style.display = 'flex';
        
        // Rota bilgileri "pill" formunda (Avg pill'i ÇIKARILDI)
        tb.innerHTML = `
            <span class="pill">${totalKm} km</span>
            <span class="pill">${durationMin} min</span>
            <span class="pill">↑ ${up} m</span>
            <span class="pill">↓ ${down} m</span>
            <button type="button" class="elev-segment-reset" style="background:#1976d2; cursor: default;">Route</button>
        `;
        
        // Toolbar'ı panel içine, harita ve diğer panellerin hemen üstüne ekle
        const panelDiv = expandedContainer.querySelector('.expanded-map-panel');

        if (panelDiv && panelDiv.firstChild) {
            panelDiv.insertBefore(tb, panelDiv.firstChild);
        } else if (panelDiv) {
            panelDiv.appendChild(tb);
        }
    }
};

(function routeSummaryAscentDescentPatch(){
  // 1) Configure icons
  window.TT_SVG_ICONS = Object.assign(window.TT_SVG_ICONS || {}, {
    // distance/time switched to local svgs (you said you'll place them)
    distance: '/img/way_distance.svg',
    duration: '/img/way_time.svg',
    // new ascent/descent icons
    ascent: '/img/way_ascent.svg',
    descent: '/img/way_descent.svg'
  });

  // 2) Keep per-day elevation stats here when ready
  window.routeElevStatsByDay = window.routeElevStatsByDay || {};

 
  function setSummaryForDay(day, distanceM, durationS) {
    const elev = window.routeElevStatsByDay?.[day] || {};
    const strings = fmt(distanceM, durationS, elev.ascent, elev.descent);

    // Small map control bar
    const smallSpan = document.querySelector(`#map-bottom-controls-day${day} .route-summary-control`);
    if (smallSpan) {
      smallSpan.innerHTML = buildBadgesHTML(strings);
    }

    // Expanded map header
    const expandedContainer = document.getElementById(`expanded-map-${day}`);
    const headerStats = expandedContainer?.querySelector('.route-stats');
    if (headerStats) {
      headerStats.innerHTML = buildBadgesHTML(strings);
    }
  }



  // 4) Compute ascent/descent from elevation profile (when available) and refresh UI
  function computeAscDesc(profile) {
    if (!profile || !Array.isArray(profile.points) || profile.points.length < 2) return { ascent: 0, descent: 0 };
    let up = 0, down = 0;
    for (let i = 1; i < profile.points.length; i++) {
      const d = profile.points[i].elev - profile.points[i - 1].elev;
      if (d > 0) up += d;
      else down += -d;
    }
    return { ascent: Math.round(up), descent: Math.round(down) };
  }

  function refreshAscentDescentForDay(day) {
    const cache = window.__ttElevDayCache?.[day];
    const profile = cache?.profile;
    if (!profile) return false;
    window.routeElevStatsByDay[day] = computeAscDesc(profile);

    // Also refresh distance/time with new elevation info
    const key = `route-map-day${day}`;
    const summary = window.lastRouteSummaries?.[key] || null;
    if (summary) setSummaryForDay(day, summary.distance, summary.duration);
    return true;
  }
  window.refreshAscentDescentForDay = refreshAscentDescentForDay;

  // 5) After scale bar render (where elevation is fetched), try to update ascent/descent
  const origRenderRouteScaleBar = window.renderRouteScaleBar;
  if (typeof origRenderRouteScaleBar === 'function') {
    window.renderRouteScaleBar = function(container, totalKm, markers) {
      const res = origRenderRouteScaleBar.apply(this, arguments);
      try {
        const id = container?.id || '';
        const m = id.match(/day(\d+)/);
        const day = m ? parseInt(m[1], 10) : null;
        if (day) {
          // Try now, then retry shortly if the elevation fetch is still in-flight
          setTimeout(() => {
            if (!refreshAscentDescentForDay(day)) {
              setTimeout(() => refreshAscentDescentForDay(day), 1200);
            }
          }, 200);
        }
      } catch (_) {}
      return res;
    };
  }
})();


function ensureRouteStatsUI(day) {
  const holder = document.getElementById(`map-bottom-controls-day${day}`);
  if (!holder) return null;
  const control = holder.querySelector('.route-summary-control');
  if (!control) return null;

  // Distance & Duration icons -> switch to svgrepo URLs
  const distIcon = control.querySelector('.stat-distance .icon');
  if (distIcon && !/svgrepo\.com/.test(distIcon.src)) {
    distIcon.src = 'https://www.svgrepo.com/show/532583/distance.svg';
    distIcon.alt = 'Distance';
    distIcon.loading = 'lazy';
    distIcon.decoding = 'async';
  }
  const timeIcon = control.querySelector('.stat-duration .icon');
  if (timeIcon && !/svgrepo\.com/.test(timeIcon.src)) {
    timeIcon.src = 'https://www.svgrepo.com/show/530514/time.svg';
    timeIcon.alt = 'Duration';
    timeIcon.loading = 'lazy';
    timeIcon.decoding = 'async';
  }

  // Ensure Ascent stat
  if (!control.querySelector('.stat-ascent')) {
    const asc = document.createElement('span');
    asc.className = 'stat stat-ascent';
    asc.innerHTML = `
      <img class="icon" src="   " alt="Ascent" loading="lazy" decoding="async">
      <span class="badge">— m</span>
    `;
    control.appendChild(asc);
  }

  // Ensure Descent stat
  if (!control.querySelector('.stat-descent')) {
    const dsc = document.createElement('span');
    dsc.className = 'stat stat-descent';
    dsc.innerHTML = `
      <img class="icon" src="https://www.svgrepo.com/show/530912/arrow-down.svg" alt="Descent" loading="lazy" decoding="async">
      <span class="badge">— m</span>
    `;
    control.appendChild(dsc);
  }

  return control;
}

function updateRouteAscentDescentUI(day, ascentM, descentM) {
  const control = ensureRouteStatsUI(day);
  if (!control) return;

  const ascBadge = control.querySelector('.stat-ascent .badge');
  if (ascBadge) {
    ascBadge.textContent = `${Math.round(ascentM)} m`;
ascBadge.title = `${Math.round(ascentM)} m ascent`;
  }
  const dscBadge = control.querySelector('.stat-descent .badge');
  if (dscBadge) {
    dscBadge.textContent = `${Math.round(descentM)} m`;
dscBadge.title = `${Math.round(descentM)} m descent`;
  }
}


function highlightSegmentOnMap(day, startKm, endKm) {
  // --- 1. TEMİZLİK ---
  if (window._segment3DMarkers) {
      window._segment3DMarkers.forEach(m => m.remove());
      window._segment3DMarkers = [];
  }

  if (typeof startKm !== "number" || typeof endKm !== "number" || typeof day !== "number") {
      // 2D Temizlik
      if (window._segmentHighlight && window._segmentHighlight[day]) {
          Object.values(window._segmentHighlight[day]).forEach(layer => { try { layer.remove(); } catch(_) {} });
          delete window._segmentHighlight[day];
      }
      // 3D Temizlik
      if (window._maplibre3DInstance) {
          if (window._maplibre3DInstance.getLayer('segment-highlight-layer')) window._maplibre3DInstance.removeLayer('segment-highlight-layer');
          if (window._maplibre3DInstance.getSource('segment-highlight-source')) window._maplibre3DInstance.removeSource('segment-highlight-source');
      }
      return;
  }

  const cid = `route-map-day${day}`;
  let coords = null;
  
  // Fly Mode vs Normal Mode
  if (window._curvedArcPointsByDay && window._curvedArcPointsByDay[day] && window._curvedArcPointsByDay[day].length > 1) {
      coords = window._curvedArcPointsByDay[day]; 
  } else {
      const gj = window.lastRouteGeojsons?.[cid];
      if (gj && gj.features && gj.features[0]?.geometry?.coordinates) {
          coords = gj.features[0].geometry.coordinates; 
      }
  }

  if (!coords || coords.length < 2) return;

  // --- 2. HESAPLAMA ---
  function hv(lat1, lon1, lat2, lon2) {
    const R=6371000, toRad=x=>x*Math.PI/180;
    const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
    const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(a));
  }

  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i-1];
    const [lon2, lat2] = coords[i];
    cum[i] = cum[i-1] + hv(lat1, lon1, lat2, lon2);
  }

  const segStartM = startKm * 1000;
  const segEndM = endKm * 1000;
  let iStart = 0, iEnd = coords.length - 1;

  for (let i = 0; i < cum.length; i++) {
      if (cum[i] >= segStartM) { iStart = i > 0 ? i - 1 : i; break; }
  }
  for (let i = iStart; i < cum.length; i++) {
      if (cum[i] >= segEndM) { iEnd = i; break; }
  }

  const subCoordsLeaflet = coords.slice(iStart, iEnd + 1).map(c => [c[1], c[0]]);
  if (subCoordsLeaflet.length < 2) return;

  // --- 3. 2D ÇİZİM VE ZOOM ---
  // --- 3. 2D ÇİZİM VE ZOOM ---
  window._segmentHighlight = window._segmentHighlight || {};
  if (!window._segmentHighlight[day]) window._segmentHighlight[day] = {};

  const maps2D = [];
  if (window.leafletMaps && window.leafletMaps[cid]) maps2D.push(window.leafletMaps[cid]);
  const expandedObj = Object.values(window.expandedMaps || {}).find(obj => obj.day === day);
  const is3DActive = document.getElementById('maplibre-3d-view') && document.getElementById('maplibre-3d-view').style.display !== 'none';
  if (expandedObj && expandedObj.expandedMap && !is3DActive) {
      maps2D.push(expandedObj.expandedMap);
  }

  Object.values(window._segmentHighlight[day]).forEach(layer => { try { layer.remove(); } catch(_) {} });
  window._segmentHighlight[day] = {};

  const markerOptions = { radius: 6, color: '#8a4af3', fillColor: '#ffffff', fillOpacity: 1, weight: 2, opacity: 1, interactive: false, pane: 'segmentPane' };

  maps2D.forEach(m => {
    if (!m.getPane('segmentPane')) {
        m.createPane('segmentPane');
        m.getPane('segmentPane').style.zIndex = 650; 
        m.getPane('segmentPane').style.pointerEvents = 'none';
    }
    const svgRenderer = L.svg({ pane: 'segmentPane' });

    const poly = L.polyline(subCoordsLeaflet, {
        color: '#8a4af3', weight: 8, opacity: 1.0, lineCap: 'round', lineJoin: 'round', dashArray: null, pane: 'segmentPane', renderer: svgRenderer 
    }).addTo(m);
    
    window._segmentHighlight[day][`poly_${m._leaflet_id}`] = poly;
    const startPt = subCoordsLeaflet[0];
    const endPt = subCoordsLeaflet[subCoordsLeaflet.length - 1];
    window._segmentHighlight[day][`start_${m._leaflet_id}`] = L.circleMarker(startPt, { ...markerOptions, renderer: svgRenderer }).addTo(m);
    window._segmentHighlight[day][`end_${m._leaflet_id}`] = L.circleMarker(endPt, { ...markerOptions, renderer: svgRenderer }).addTo(m);
    
    // --- ZOOM KISMI (FIX: Manuel zoom + setView kullan) ---
    try {
        if (poly.getBounds().isValid()) {
            const bounds = poly.getBounds();
            const center = bounds.getCenter();
            
            // Mevcut zoom seviyesini al
            const currentZoom = m.getZoom();
            console.log('[SEGMENT ZOOM] Mevcut zoom:', currentZoom, 'Center:', center);
            
            // Segment uzunluğuna göre hedef zoom belirle
            const segmentKm = endKm - startKm;
            let targetZoom = 15; // Varsayılan
            
            if (segmentKm < 0.5) targetZoom = 16;      // 500m altı
            else if (segmentKm < 1) targetZoom = 15;   // 1km altı
            else if (segmentKm < 3) targetZoom = 14;   // 3km altı
            else if (segmentKm < 5) targetZoom = 13;   // 5km altı
            else if (segmentKm < 10) targetZoom = 12;  // 10km altı
            else targetZoom = 11;                       // 10km üstü
            
            console.log('[SEGMENT ZOOM] Segment uzunluğu:', segmentKm.toFixed(2), 'km → Hedef zoom:', targetZoom);
            
            // FIX: fitBounds yerine setView kullan (tam sayı zoom garantisi)
            m.setView(center, targetZoom, {
                animate: true,
                duration: 0.8,
                easeLinearity: 0.25
            });
            
            // Zoom sonrası kontrol ve invalidate
            setTimeout(() => {
                const finalZoom = m.getZoom();
                console.log('[SEGMENT ZOOM] Son zoom seviyesi:', finalZoom);
                
                // FIX: Eğer zoom hala ondalıklıysa (örn 15.3), tam sayıya çek
                if (finalZoom !== Math.round(finalZoom)) {
                    console.warn('[SEGMENT ZOOM] Zoom ondalıklı! Düzeltiliyor:', finalZoom, '→', Math.round(finalZoom));
                    m.setZoom(Math.round(finalZoom), { animate: false });
                }
                
                try { 
                    m.invalidateSize(); 
                    // Canvas renderer'ı varsa yenile
                    if (m._renderer && m._renderer._update) {
                        m._renderer._update();
                    }
                } catch(e) {}
            }, 900);
        }
    } catch(e) {
        console.error('[SEGMENT ZOOM] Hata:', e);
    }
  });

  // --- 4. 3D ÇİZİM VE ZOOM ---
  if (is3DActive && window._maplibre3DInstance) {
      const map3d = window._maplibre3DInstance;
      const subCoordsGeoJSON = coords.slice(iStart, iEnd + 1);
      const sourceId = 'segment-highlight-source';
      const layerId = 'segment-highlight-layer';

      if (map3d.getSource(sourceId)) {
          map3d.getSource(sourceId).setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: subCoordsGeoJSON } });
      } else {
          map3d.addSource(sourceId, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: subCoordsGeoJSON } } });
          map3d.addLayer({
              id: layerId, type: 'line', source: sourceId,
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: { 'line-color': '#8a4af3', 'line-width': 8, 'line-opacity': 1.0 }
          });
      }
      if (map3d.getLayer(layerId)) map3d.moveLayer(layerId); // En üste

      window._segment3DMarkers = window._segment3DMarkers || [];
      const create3DMarker = (lngLat) => {
          const el = document.createElement('div');
          el.className = 'segment-marker-3d';
          el.style.cssText = `width: 14px; height: 14px; background-color: #ffffff; border: 3px solid #8a4af3; border-radius: 50%; box-shadow: 0 1px 4px rgba(0,0,0,0.4); z-index: 9999;`;
          const marker = new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map3d);
          window._segment3DMarkers.push(marker);
      };
      if (subCoordsGeoJSON.length > 0) {
          create3DMarker(subCoordsGeoJSON[0]);
          create3DMarker(subCoordsGeoJSON[subCoordsGeoJSON.length - 1]);
      }

      // --- 3D ZOOM ---
      const bounds = new maplibregl.LngLatBounds();
      subCoordsGeoJSON.forEach(c => bounds.extend(c));
      map3d.fitBounds(bounds, {
          padding: { top: 80, bottom: 240, left: 80, right: 80 }, 
          maxZoom: 19, // FIX: 3D için de limit artırıldı
          duration: 1200
      });
  }
}

function ensureExpandedScaleBar(day, raw) {
  let expandedMapDiv =
    document.getElementById(`expanded-map-${day}`) ||
    document.getElementById(`expanded-route-map-day${day}`);
  if (!expandedMapDiv) return; // DOM yoksa ekleme!

  let expandedScaleBar = document.getElementById(`expanded-route-scale-bar-day${day}`);
  if (!expandedScaleBar) {
    expandedScaleBar = document.createElement('div');
    expandedScaleBar.id = `expanded-route-scale-bar-day${day}`;
    expandedScaleBar.className = 'route-scale-bar expanded';
    expandedMapDiv.parentNode.insertBefore(expandedScaleBar, expandedMapDiv.nextSibling);
  }
  if (typeof renderRouteScaleBar === 'function') {
    let samples = raw;
    if (samples.length > 600) {
      const step = Math.ceil(samples.length / 600);
      samples = samples.filter((_,i)=>i%step===0);
    }
    let dist = 0, dists = [0];
    for (let i=1; i<samples.length; i++) {
      dist += haversine(
        samples[i-1].lat, samples[i-1].lng,
        samples[i].lat, samples[i].lng
      );
      dists.push(dist);
    }
    expandedScaleBar.innerHTML = "";
    // GPS import track varsa, tüm noktaları marker gibi ver
const imported = window.importedTrackByDay && window.importedTrackByDay[day] && window.importedTrackByDay[day].drawRaw;
if (imported) {
  renderRouteScaleBar(
    expandedScaleBar,
    dist/1000,
    samples.map((p, i) => ({
  name: (i === 0 ? "Start" : (i === samples.length - 1 ? "Finish" : "")),
  distance: dists[i]/1000,
  snapped: true
}))
  );
} else {
  // Eski haliyle devam et
  renderRouteScaleBar(
    expandedScaleBar,
    dist/1000,
    samples.map((p,i)=>({
      name: '',
      distance: dists[i]/1000,
      snapped: true
    }))
  );
}
  }
}


function drawSegmentProfile(container, day, startKm, endKm, samples, elevSmooth) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  window._lastSegmentDay = day;
  window._lastSegmentStartKm = startKm;
  window._lastSegmentEndKm = endKm;

  const track = container.querySelector('.scale-bar-track'); 
  if (!track) return;

  const selDiv = container.querySelector('.scale-bar-selection');
  if (selDiv) { selDiv.style.display = 'none'; selDiv.style.width = '0px'; selDiv.style.left = '0px'; }

  // Temizlik
  track.querySelectorAll('svg[data-role="elev-segment"]').forEach(el => el.remove());
  track.querySelectorAll('svg[data-role="elev-base"]').forEach(el => el.style.display = 'none'); 
  track.querySelectorAll('.elev-segment-toolbar').forEach(el => el.remove());
  track.querySelectorAll('.elevation-labels-container').forEach(el => el.remove());
  
  const expandedContainer = container.closest('.expanded-map-container');
  expandedContainer?.querySelector('.elev-segment-toolbar')?.remove(); 

  const widthPx = Math.max(200, Math.round(track.getBoundingClientRect().width));
  const totalKm = Number(container.dataset.totalKm) || 0;
  
  const allMarkers = (typeof getRouteMarkerPositionsOrdered === 'function') ? getRouteMarkerPositionsOrdered(day) : [];
  // Sadece segment içindeki markerlar
  const segmentMarkers = allMarkers.filter(m => m.distance >= startKm && m.distance <= endKm);

  const min = Math.min(...elevSmooth);
const max = Math.max(...elevSmooth, min + 1);
const span = max - min;

let vizMin, vizMax;
if (span > 0) { 
  vizMin = min - span * 0.05; 
  vizMax = max + span * 0.10; 
} 
else { 
  vizMin = min - 1; 
  vizMax = max + 1; 
}

  container._elevationData = { smooth: elevSmooth, vizMin, vizMax, min, max };
  container._elevSamples = samples; 
  container._elevStartKm = startKm;
  container._elevKmSpan  = endKm - startKm;

  // Segment Markerlarını Çiz
  createScaleElements(track, widthPx, endKm - startKm, startKm, segmentMarkers, { smooth: elevSmooth, vizMin, vizMax });

  const rect = track.getBoundingClientRect();
  track._segmentStartPx = 0; 
  track._segmentWidthPx = rect.width;

  // SVG Çizimi
  const widthNow = widthPx || 400;
  const SVG_TOP = 48;
  let heightNow = isMobile
    ? Math.max(180, Math.min(240, Math.round(track.getBoundingClientRect().height - SVG_TOP - 12)))
    : Math.max(180, Math.min(320, Math.round(track.getBoundingClientRect().height - SVG_TOP - 16)));
  if (isNaN(heightNow)) heightNow = isMobile ? 160 : 220;

  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'tt-elev-svg');
  svg.setAttribute('data-role', 'elev-segment');
  svg.setAttribute('viewBox', `0 0 ${widthNow} ${heightNow}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', String(heightNow));
  track.appendChild(svg);

  const existingTooltip = track.querySelector('.tt-elev-tooltip');
  const existingLine = track.querySelector('.scale-bar-vertical-line');
  if (existingLine) track.appendChild(existingLine);
  if (existingTooltip) track.appendChild(existingTooltip);

  const gridG = document.createElementNS(svgNS, 'g');
  gridG.setAttribute('class','tt-elev-grid');
  svg.appendChild(gridG);
  const areaPath = document.createElementNS(svgNS, 'path');
  areaPath.setAttribute('class','tt-elev-area');
  svg.appendChild(areaPath);
  const segG = document.createElementNS(svgNS, 'g');
  segG.setAttribute('class','tt-elev-segments');
  svg.appendChild(segG);

  const X = (kmRel) => (kmRel / (endKm - startKm)) * widthNow;
  const Y = (e) => (isNaN(e) || vizMax === vizMin) ? (heightNow/2) : ((heightNow - 1) - ((e - vizMin) / (vizMax - vizMin)) * (heightNow - 2));

  // Grid
  for (let i = 0; i <= 4; i++) {
    const ev = vizMin + (i / 4) * (vizMax - vizMin);
    const y = Y(ev);
    const ln = document.createElementNS(svgNS, 'line');
    ln.setAttribute('x1', '0'); ln.setAttribute('x2', String(widthNow));
    ln.setAttribute('y1', String(y)); ln.setAttribute('y2', String(y));
    ln.setAttribute('stroke', '#d7dde2'); ln.setAttribute('stroke-dasharray', '4 4'); ln.setAttribute('opacity', '.8');
    gridG.appendChild(ln);
  }
  
  // Area
  let topD = '';
  for (let i = 0; i < elevSmooth.length; i++) {
    const kmRel = (samples[i].distM / 1000) - startKm;
    const x = Math.max(0, Math.min(widthNow, X(kmRel)));
    const y = Y(elevSmooth[i]);
    topD += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
  }
  if (topD) {
    const floorY = heightNow; 
    const areaD = `${topD} L ${widthNow} ${floorY} L 0 ${floorY} Z`;
    areaPath.setAttribute('d', areaD);
    areaPath.setAttribute('fill', '#263445');
  }

  // Segments
  for (let i = 1; i < elevSmooth.length; i++) {
    const kmRel1 = (samples[i-1].distM / 1000) - startKm;
    const kmRel2 = (samples[i].distM / 1000) - startKm;
    const x1 = Math.max(0, Math.min(widthNow, X(kmRel1)));
    const y1 = Y(elevSmooth[i-1]);
    const x2 = Math.max(0, Math.min(widthNow, X(kmRel2)));
    const y2 = Y(elevSmooth[i]);

    const dx = samples[i].distM - samples[i-1].distM;
    const dy = elevSmooth[i] - elevSmooth[i-1];
    let slope = 0, color = '#72c100';
    if (dx !== 0) {
      slope = (dy / dx) * 100;
      color = (slope < 0) ? '#72c100' : getSlopeColor(slope);
    }
    const seg = document.createElementNS(svgNS, 'line');
    seg.setAttribute('x1', String(x1));
    seg.setAttribute('y1', String(y1));
    seg.setAttribute('x2', String(x2));
    seg.setAttribute('y2', String(y2));
    seg.setAttribute('stroke', color);
    seg.setAttribute('stroke-width', '3');
    seg.setAttribute('stroke-linecap', 'round');
    seg.setAttribute('fill', 'none');
    segG.appendChild(seg);
  }

  // Toolbar
  let up = 0, down = 0;
  for (let i = 1; i < elevSmooth.length; i++) {
    const d = elevSmooth[i] - elevSmooth[i-1];
    if (d > 1.5) up += d; else if (d < -1.5) down += -d;
  }
  const distKm = (endKm - startKm);
  const avgGrade = distKm > 0 ? ((elevSmooth[elevSmooth.length - 1] - elevSmooth[0]) / (distKm * 1000)) * 100 : 0;

  const tb = document.createElement('div');
  tb.className = 'elev-segment-toolbar';
  
  // Mobil veya Masaüstü için kısa metin (İkon olduğu için '✕' metnini kaldırdık)
  const buttonLabel = isMobile ? 'Seg' : 'Segment';
  
  tb.innerHTML = `
    <span class="pill">${startKm.toFixed(1)}–${endKm.toFixed(1)} km</span>
    <span class="pill">↑ ${Math.round(up)} m</span>
    <span class="pill">↓ ${Math.round(down)} m</span>
    <span class="pill">Avg %${avgGrade.toFixed(1)}</span>
    <button type="button" class="elev-segment-reset" style="background:#8a4af3; display: inline-flex; align-items: center; gap: 4px; padding: 2px 4px;">
        ${buttonLabel}
        <img src="https://www.svgrepo.com/show/446847/close-circle-filled.svg" style="width: 12px; height: 12px; filter: brightness(0) invert(1);" alt="kapat">
    </button>
  `;
  
  const expandedContainerChildren = expandedContainer.querySelector('.expanded-map-panel');
  if (expandedContainerChildren && expandedContainerChildren.firstChild) {
      expandedContainerChildren.insertBefore(tb, expandedContainerChildren.firstChild);
  } else if (expandedContainerChildren) {
      expandedContainerChildren.appendChild(tb);
  }
  
  const resetBtn = tb.querySelector('.elev-segment-reset');
  if (resetBtn) {
      const stopProp = (e) => e.stopPropagation();
      resetBtn.addEventListener('touchstart', stopProp, { passive: true });
      resetBtn.addEventListener('mousedown', stopProp);

      // --- RESET (UNZOOM) MANTIĞI ---
      resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // 1. DOM Temizliği
        track.querySelectorAll('svg[data-role="elev-segment"]').forEach(el => el.remove());
        track.querySelectorAll('svg[data-role="elev-base"]').forEach(el => el.style.display = 'block'); 
        track.querySelectorAll('.elev-segment-toolbar').forEach(el => el.remove());
        track.querySelectorAll('.elevation-labels-container').forEach(el => el.remove());

        if (typeof highlightSegmentOnMap === 'function') {
          highlightSegmentOnMap(day); 
        }

        window._lastSegmentDay = undefined;
        window._lastSegmentStartKm = undefined;
        window._lastSegmentEndKm = undefined;

        const selection = container.querySelector('.scale-bar-selection');
        if (selection) selection.style.display = 'none';

        // 2. Map Unzoom
        const cid = `route-map-day${day}`;
        const gj = window.lastRouteGeojsons?.[cid];
        let bounds = null;
        let bounds3d = null;

        if (gj && gj.features && gj.features[0]?.geometry?.coordinates) {
            const coords = gj.features[0].geometry.coordinates; 
            bounds = L.latLngBounds(coords.map(c => [c[1], c[0]]));
            if (window.maplibregl) {
                bounds3d = new maplibregl.LngLatBounds();
                coords.forEach(c => bounds3d.extend(c));
            }
        } else {
            const allPoints = typeof getDayPoints === 'function' ? getDayPoints(day) : [];
            const validPoints = allPoints.filter(p => isFinite(p.lat) && isFinite(p.lng));
            if (validPoints.length > 0) {
                bounds = L.latLngBounds(validPoints.map(p => [p.lat, p.lng]));
                if (window.maplibregl) {
                    bounds3d = new maplibregl.LngLatBounds();
                    validPoints.forEach(p => bounds3d.extend([p.lng, p.lat]));
                }
            }
        }

        const expObj = window.expandedMaps && window.expandedMaps[cid];
        if (expObj && expObj.expandedMap && bounds && bounds.isValid()) {
            expObj.expandedMap.fitBounds(bounds, { padding: [50, 50], animate: true, duration: 1.0 });
        }

        const is3DActive = document.getElementById('maplibre-3d-view') && document.getElementById('maplibre-3d-view').style.display !== 'none';
        if (is3DActive && window._maplibre3DInstance && bounds3d) {
            window._maplibre3DInstance.fitBounds(bounds3d, {
                padding: { top: 80, bottom: 240, left: 60, right: 60 },
                duration: 1200
            });
        }

        // --- 3. Scale Bar Reset (FIX: SIRALAMA DÜZELTİLDİ) ---
        
        // A) Önce veriyi FULL moda geri yükle
        if (container._elevationDataFull) {
          container._elevationData = {
            min: container._elevationDataFull.min,
            max: container._elevationDataFull.max,
            smooth: container._elevationDataFull.smooth.slice()
          };
        }
        
        container._elevStartKm = 0;
        container._elevKmSpan  = totalKm;
        
        // Full Samples'ı geri yükle
        if (Array.isArray(container._elevFullSamples)) {
          container._elevSamples = container._elevFullSamples.slice();
        }

        // B) SVG Çizgilerini Yenile (Bu fonksiyon eski closure verisi ile marker çizebilir, sorun değil, aşağıda ezeceğiz)
        if (typeof container._redrawElevation === 'function') {
          container._redrawElevation(container._elevationData);
        } 
        
        // C) Markerları TEMİZ, GÜNCEL VERİLERLE Yeniden Çiz (Öncekileri siler ve doğrusunu koyar)
        // Güncel genişliği al (Sidebar açılıp kapanmış olabilir)
        const currentWidth = Math.max(200, Math.round(track.getBoundingClientRect().width));
        // Güncel marker listesini al
        const freshMarkers = (typeof getRouteMarkerPositionsOrdered === 'function') ? getRouteMarkerPositionsOrdered(day) : [];
        
        // Markerları "activeData: null" göndererek oluştur ki container._elevationData'yı (Full olanı) kullansın
        createScaleElements(track, currentWidth, totalKm, 0, freshMarkers, null);
        
        updateRouteStatsUI(day);
      });
  }
}


async function fetchAndRenderSegmentElevation(container, day, startKm, endKm) {
  const containerId = container.id;
  
  // Gereksiz temizlikleri kaldır (DOM yapısını bozmamak için)
  // document.querySelectorAll... kısmını sildik.

  const key = `route-map-day${day}`;
  const gj = window.lastRouteGeojsons?.[key];
  const coords = gj?.features?.[0]?.geometry?.coordinates;
  if (!coords || coords.length < 2) return;

  function hv(lat1, lon1, lat2, lon2) {
    const R = 6371000, toRad = x => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1];
    const [lon2, lat2] = coords[i];
    cum[i] = cum[i - 1] + hv(lat1, lon1, lat2, lon2);
  }
  const totalM = cum[cum.length - 1] || 1;

  const segStartM = Math.max(0, Math.min(totalM, startKm * 1000));
  const segEndM   = Math.max(0, Math.min(totalM, endKm * 1000));
  
  if (segEndM - segStartM < 100) return; 

  const segKm = (segEndM - segStartM) / 1000;

  // Örnekleme sayısını artırdık ki grafik kırık görünmesin
  /* segment noktları */
  // const N = Math.min(300, Math.max(80, Math.round(segKm * 20)));
  // Limiti 800'e çıkar, km başına 50 nokta al
  const N = Math.min(500, Math.max(120, Math.round(segKm * 50)));

  const samples = [];
  for (let i = 0; i < N; i++) {
    const target = segStartM + (i / (N - 1)) * (segEndM - segStartM);
    let idx = 0; while (idx < cum.length && cum[idx] < target) idx++;
    if (idx === 0) {
      const [lon, lat] = coords[0];
      samples.push({ lat, lng: lon, distM: 0 });
    } else if (idx >= cum.length) {
      const [lon, lat] = coords[cum.length - 1];
      samples.push({ lat, lng: lon, distM: totalM });
    } else {
      const p = idx - 1, segLen = (cum[idx] - cum[p]) || 1, t = (target - cum[p]) / segLen;
      const [lon1, lat1] = coords[p], [lon2, lat2] = coords[idx];
      samples.push({ lat: lat1 + (lat2 - lat1) * t, lng: lon1 + (lon2 - lon1) * t, distM: target });
    }
  }

window.showScaleBarLoading?.(container, 'Loading segment elevation...', day, startKm, endKm);

  const routeKey = `seg:${coords.length}|${samples[0].lat.toFixed(4)},${samples[0].lng.toFixed(4)}|${samples[samples.length - 1].lat.toFixed(4)},${samples[samples.length - 1].lng.toFixed(4)}|${N}`;
   try {
    const elev = await window.getElevationsForRoute(samples, container, routeKey);
    
    // Veri gelmezse veya hata olursa çıkma, çizmeye çalış
    if (!elev || elev.length !== N || elev.some(Number.isNaN)) {
        console.warn("Segment elevation data incomplete, skipping profile update.");
        return;
    }

    const smooth = movingAverage(elev, 3);
    
    // --- ÇİZİM FONKSİYONUNU ÇAĞIR ---
    drawSegmentProfile(container, day, startKm, endKm, samples, smooth);

  } finally {
    requestAnimationFrame(() => {
        setTimeout(() => {
            window.hideScaleBarLoading?.(container);
        }, 60);
    });
  }

  setTimeout(function() {
    highlightSegmentOnMap(day, startKm, endKm);
  }, 200);
}



(function ensureScaleBarLoadingHelpers(){
  if (window.__tt_scaleBarLoaderReady) return;

  function trackOf(c){ return c?.querySelector?.('.scale-bar-track')||null; }

  // Geometri üzerinde mesafe bazlı nokta bulma
  function getPointAtDistance(coords, targetM) {
    if (!coords || coords.length < 2) return null;
    let dist = 0;
    const R = 6371000, toRad = x => x * Math.PI / 180;
    
    for (let i = 1; i < coords.length; i++) {
      const [lon1, lat1] = coords[i-1];
      const [lon2, lat2] = coords[i];
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2)**2;
      const stepM = 2 * R * Math.asin(Math.sqrt(a));
      
      if (dist + stepM >= targetM) {
        const ratio = (targetM - dist) / stepM;
        const lat = lat1 + (lat2 - lat1) * ratio;
        const lng = lon1 + (lon2 - lon1) * ratio;
        return { lat, lng };
      }
      dist += stepM;
    }
    const last = coords[coords.length-1];
    return { lat: last[1], lng: last[0] };
  }

  window.showScaleBarLoading = function(c, t='Loading elevation…', day=null, sKm=null, eKm=null){
    const tr = trackOf(c); 
    if (!tr) return;

    // 1. Alttaki eski grafiğin olaylarını kapat (Pointer events)
    tr.style.pointerEvents = 'none';

    // 2. Eski tooltip ve çizgiyi gizle
    const oldTooltip = tr.querySelector('.tt-elev-tooltip');
    const oldLine = tr.querySelector('.scale-bar-vertical-line');
    if (oldTooltip) oldTooltip.style.display = 'none';
    if (oldLine) oldLine.style.display = 'none';

    let placeholder = tr.querySelector('.elevation-placeholder');
    if (!placeholder) {
      placeholder = document.createElement('div');
      placeholder.className = 'elevation-placeholder';
      
      placeholder.style.cssText = `
          width: 100%; height: 220px; border-radius: 8px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          color: #6c757d; font-size: 14px;
          position: absolute; top: 0; left: 0;
          background: rgba(255, 255, 255, 0.95); z-index: 1000;
          pointer-events: auto; cursor: crosshair;
      `;
      
      placeholder.innerHTML = `
        <div class="tt-scale-loader" style="display: flex; align-items: center; gap: 10px;">
            <div class="spinner"></div><div class="txt"></div>
        </div>
        <div class="loader-vertical-line" style="position:absolute; top:0; bottom:0; width:2px; background:#8a4af3; opacity:0.5; display:none; pointer-events:none;"></div>
      `;
      tr.appendChild(placeholder);
    }
    
    const txt = placeholder.querySelector('.txt');
    if (txt) txt.textContent = t;
    placeholder.style.display = 'flex';

    // --- MOUSE HAREKET MANTIĞI ---
    const handleMove = function(e) {
        e.stopPropagation(); // KRİTİK: Olayın alta geçmesini engelle (Tam rota sorununu çözer)

        // Sadece segment bilgileri varsa marker oynat
        if (day !== null && sKm !== null && eKm !== null) {
            const gjKey = `route-map-day${day}`;
            const gj = window.lastRouteGeojsons && window.lastRouteGeojsons[gjKey];
            const coords = gj?.features?.[0]?.geometry?.coordinates;
            const lineEl = placeholder.querySelector('.loader-vertical-line');
            
            if (!coords) return;

            const rect = placeholder.getBoundingClientRect();
            let clientX = e.clientX;
            if (e.touches && e.touches.length) clientX = e.touches[0].clientX;

            let x = clientX - rect.left;
            x = Math.max(0, Math.min(x, rect.width));
            
            const ratio = x / rect.width;
            
            // Seçilen segment aralığında (sKm - eKm) orantıla
            const currentKm = sKm + ratio * (eKm - sKm); 
            
            const pt = getPointAtDistance(coords, currentKm * 1000);
            
            if (pt) {
                const markerMap = window.routeHoverMarkers && window.routeHoverMarkers[day];
                if (markerMap) {
                   markerMap.setLatLng([pt.lat, pt.lng]);
                   if (!markerMap._map) { 
                       const mapContainer = window.expandedMaps?.[gjKey]?.expandedMap || window.leafletMaps?.[gjKey];
                       if(mapContainer) markerMap.addTo(mapContainer);
                   }
                   markerMap.setOpacity(1);
                }
                if (window.move3DMarker) window.move3DMarker(day, pt.lat, pt.lng);
            }

            if (lineEl) {
                lineEl.style.display = 'block';
                lineEl.style.left = x + 'px';
            }
        }
    };

    placeholder.onmousemove = handleMove;
    placeholder.ontouchmove = handleMove;

    // Tıklamaların da alta geçmesini engelle
    const stopOnly = (e) => e.stopPropagation();
    placeholder.onmousedown = stopOnly;
    placeholder.onmouseup = stopOnly;
    placeholder.onclick = stopOnly;
    
    placeholder.onmouseleave = function(e) {
         e.stopPropagation();
         const lineEl = placeholder.querySelector('.loader-vertical-line');
         if (lineEl) lineEl.style.display = 'none';
    };
  };

  window.updateScaleBarLoadingText = function(c, t){
    const tr = trackOf(c); 
    const box = tr?.querySelector('.elevation-placeholder .tt-scale-loader'); 
    const txt = box?.querySelector('.txt'); 
    if (txt) txt.textContent = t;
  };

  window.hideScaleBarLoading = function(c){
    const tr = trackOf(c); 
    if (tr) tr.style.pointerEvents = 'auto'; // Kilidi aç
    const placeholder = tr?.querySelector('.elevation-placeholder'); 
    if (placeholder) {
        placeholder.onmousemove = null; 
        placeholder.ontouchmove = null;
        placeholder.remove();
    }
  };

  window.__tt_scaleBarLoaderReady = true;
})();

(function ensureElev429Planner(){
  if (window.__tt_elev429PlannerReady) return;
  window.planElevationRetry = function(container, routeKey, waitMs, retryFn){
    if (!container) return;
    const now = Date.now(), until = now + Math.max(2000, waitMs|0);
    if (container.__elevRetryTimer){ clearTimeout(container.__elevRetryTimer); container.__elevRetryTimer=null; }
    const tick = ()=> {
      const left = Math.max(0, Math.ceil((until - Date.now())/1000));
      updateScaleBarLoadingText(container, left>0 ? `Waiting ${left}s due to rate limit…` : `Retrying…`);
      if (left>0){ container.__elevRetryTicker = setTimeout(tick, 1000); }
    };
    if (container.__elevRetryTicker){ clearTimeout(container.__elevRetryTicker); }
    tick();
    container.__elevRetryTimer = setTimeout(()=>{ container.__elevRetryTimer=null; if (container.__elevRetryTicker) clearTimeout(container.__elevRetryTicker); retryFn && retryFn(); }, until-now);
  };
  window.__tt_elev429PlannerReady = true;
})();


(function ensureElevationMux(){
  // Global değişkenler ve Rate Limit koruması burada kalmalı
  const TTL_MS = 48 * 60 * 60 * 1000;
  const LS_PREFIX = 'tt_elev_cache_v1:';

  const providers = [
    { key: 'myApi', fn: viaMyApi, chunk: 80, minInterval: 1200 },
  ];

  const cooldownUntil = { myApi: 0 };
  const lastTs        = { myApi: 0 };

  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  function loadCache(routeKey, n) {
    try {
      const raw = localStorage.getItem(LS_PREFIX + routeKey + ':' + n);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || !obj.ts || !Array.isArray(obj.elev)) return null;
      if (Date.now() - obj.ts > TTL_MS) return null;
      return obj.elev;
    } catch { return null; }
  }

  function saveCache(routeKey, n, elev) {
    try {
      localStorage.setItem(LS_PREFIX + routeKey + ':' + n, JSON.stringify({ ts: Date.now(), elev }));
    } catch {}
  }

  async function viaMyApi(samples) {
    const CHUNK = 120;
    const res = [];
    for (let i=0;i<samples.length;i+=CHUNK){
      const chunk = samples.slice(i,i+CHUNK);
      const loc = chunk.map(p=>`${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join('|');
      const resp = await fetch('/api/elevation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locations: loc.split('|') })
});
      if (resp.status === 429) {
        cooldownUntil.myApi = Date.now() + 10*60*1000;
        throw new Error('429');
      }
      if (!resp.ok) throw new Error('HTTP '+resp.status);
      const j = await resp.json();
      if (j.results && j.results.length === chunk.length) {
        res.push(...j.results.map(r => r && typeof r.elevation==='number' ? r.elevation : null));
      } else if (Array.isArray(j.elevations) && j.elevations.length === chunk.length) {
        res.push(...j.elevations);
      } else if (j.data && Array.isArray(j.data)) {
        res.push(...j.data);
      } else {
        throw new Error('bad response');
      }
      if (samples.length > CHUNK) await sleep(400);
    }
    if (res.some(v => typeof v !== 'number')) throw new Error('missing values');
    return res;
  }

  window.getElevationsForRoute = async function(samples, container, routeKey) {
    // Cache kontrolü
    const cached = loadCache(routeKey, samples.length);
    if (cached && cached.length === samples.length) {
      // Not: Buradan loader kapatma komutunu kaldırdık, çağıran fonksiyon kapatacak.
      return cached;
    }

    for (const p of providers) {
      try {
        if (Date.now() < cooldownUntil[p.key]) continue;
        
        // --- DEĞİŞİKLİK: Burada artık yazı güncelleme YOK ---
        // Sadece veri çekmeye odaklansın.
        
        const elev = await p.fn(samples);
        if (Array.isArray(elev) && elev.length === samples.length) {
          saveCache(routeKey, samples.length, elev);
          return elev;
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  };

  window.__tt_elevMuxReady = true;
})();

// YOKSA EKLE: (varsa atla)
function ensureCanvasRenderer(m){ if(!m._ttCanvasRenderer) m._ttCanvasRenderer=L.canvas(); return m._ttCanvasRenderer; }
// SEGMENT SEÇİMİ SONRASI ZOOM VE HIGHLIGHT (ZOOM FIX)

window.__sb_onMouseMove = function(e) {
  if (!window.__scaleBarDrag || !window.__scaleBarDragTrack || !window.__scaleBarDragSelDiv) return;
  
  // Mobilde sayfa kaymasını engelle (Scroll Lock)
  if (e.type === 'touchmove' && e.cancelable) {
      e.preventDefault(); 
  }

  const rect = window.__scaleBarDragTrack.getBoundingClientRect();
  const clientX = (e.touches && e.touches.length) ? e.touches[0].clientX : e.clientX;
  
  window.__scaleBarDrag.lastX = Math.max(0, Math.min(rect.width, clientX - rect.left));
  
  const left = Math.min(window.__scaleBarDrag.startX, window.__scaleBarDrag.lastX);
  const right = Math.max(window.__scaleBarDrag.startX, window.__scaleBarDrag.lastX);
  
  window.__scaleBarDragSelDiv.style.left = `${left}px`;
  window.__scaleBarDragSelDiv.style.width = `${right - left}px`;
};

window.__sb_onMouseUp = function() {
  if (!window.__scaleBarDrag || !window.__scaleBarDragTrack || !window.__scaleBarDragSelDiv) return;
  const rect = window.__scaleBarDragTrack.getBoundingClientRect();
  const leftPx = Math.min(window.__scaleBarDrag.startX, window.__scaleBarDrag.lastX);
  const rightPx = Math.max(window.__scaleBarDrag.startX, window.__scaleBarDrag.lastX);
  
  // Seçim bitti, div'i gizleyelim ki ekranda asılı kalmasın
  window.__scaleBarDragSelDiv.style.display = 'none';

  if (rightPx - leftPx < 8) { 
      window.__scaleBarDrag = null; 
      return; 
  }

  const container = window.__scaleBarDragTrack.closest('.route-scale-bar');
  if (!container) { window.__scaleBarDrag = null; return; }
  
  const dayMatch = container.id && container.id.match(/day(\d+)/);
  const day = dayMatch ? parseInt(dayMatch[1], 10) : null;

  window.__scaleBarDrag = null;

  if (day != null) {
    // --- NESTED SEGMENT MANTIĞI ---
    
    // Varsayılan: Ana grafik (0'dan Toplam KM'ye)
    let baseStartKm = 0;
    let visibleSpanKm = Number(container.dataset.totalKm) || 0;

    // Eğer zaten bir segmentin içindeysek (Zoomlu görünüm)
    if (
        typeof window._lastSegmentDay === 'number' &&
        window._lastSegmentDay === day &&
        typeof window._lastSegmentStartKm === 'number' &&
        typeof window._lastSegmentEndKm === 'number'
    ) {
        // Hesaplamayı mevcut segmentin üzerine kur
        baseStartKm = window._lastSegmentStartKm;
        visibleSpanKm = window._lastSegmentEndKm - window._lastSegmentStartKm;
    }

    // Mouse'un bar üzerindeki oranını hesapla (0.0 - 1.0)
    const ratioStart = leftPx / rect.width;
    const ratioEnd   = rightPx / rect.width;

    // Yeni başlangıç ve bitiş km'lerini hesapla
    // Formül: (Mevcut Başlangıç) + (Oran * Mevcut Genişlik)
    const newStartKm = baseStartKm + (ratioStart * visibleSpanKm);
    const newEndKm   = baseStartKm + (ratioEnd * visibleSpanKm);

    // Yeni segmenti çiz
    fetchAndRenderSegmentElevation(container, day, newStartKm, newEndKm);
    
    // Haritadaki çizgiyi de hemen güncelle (Gecikmeyi önlemek için buraya da ekledim)
    if (typeof highlightSegmentOnMap === 'function') {
        highlightSegmentOnMap(day, newStartKm, newEndKm);
    }
  }
};

window.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    // Tüm leaflet harita ve expanded maplerde invalidateSize çağır
    if (window.leafletMaps) {
      Object.values(window.leafletMaps).forEach(map => {
        try { map.invalidateSize(); } catch(_) {}
      });
    }
    if (window.expandedMaps) {
      Object.values(window.expandedMaps).forEach(ex => {
        if (ex?.expandedMap && typeof ex.expandedMap.invalidateSize === 'function') {
          ex.expandedMap.invalidateSize();
        }
      });
    }
    // Tüm scale barlar için handleResize tetikle!
    document.querySelectorAll('.scale-bar-track').forEach(track => {
      if (typeof track.handleResize === "function") track.handleResize();
    });
    // Sliderları da refresh et!
    document.querySelectorAll('.splide').forEach(sliderElem => {
      if (sliderElem._splideInstance && typeof sliderElem._splideInstance.refresh === 'function') {
        sliderElem._splideInstance.refresh();
      }
    });
    // Bir de window event -- 2. kez güvenlik
    setTimeout(function() {
      window.dispatchEvent(new Event('resize'));
    }, 220);
  }, 360);
});

/**
 * elevation-works.js içine eklenecek kod
 * 
 * renderRouteScaleBar fonksiyonunda elevation verileri gelip 
 * movingAverage yapılmadan HEMEN ÖNCE çalıştır
 */

// === ELEVATION VERİ TEMIZLEME FONKSİYONU ===
window.cleanElevationData = function(elevations, samples = null) {
    if (!Array.isArray(elevations) || elevations.length === 0) return elevations;
    
    const cleaned = elevations.slice();
    const SPIKE_THRESHOLD = 25; // 25m'den fazla sıçrama = hata
    
    console.log("[ELEV CLEAN] Başlangıç:", {
        total: cleaned.length,
        nullCount: cleaned.filter(e => e == null).length,
        min: Math.min(...cleaned.filter(e => e != null)),
        max: Math.max(...cleaned.filter(e => e != null))
    });
    
    // 1. Null/NaN değerleri komşuların ortalamasıyla doldur
    for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i] == null || !isFinite(cleaned[i])) {
            let sum = 0, count = 0;
            const range = 5; // 5 pixel yarıçapında ara
            
            for (let j = Math.max(0, i - range); j <= Math.min(cleaned.length - 1, i + range); j++) {
                if (j !== i && cleaned[j] != null && isFinite(cleaned[j])) {
                    sum += cleaned[j];
                    count++;
                }
            }
            
            if (count > 0) {
                cleaned[i] = sum / count;
            } else {
                cleaned[i] = 50; // Fallback: sea level
            }
        }
    }
    
    // 2. Aşırı sıçramaları düzelt
    let fixedCount = 0;
    for (let i = 1; i < cleaned.length - 1; i++) {
        const prev = cleaned[i - 1];
        const curr = cleaned[i];
        const next = cleaned[i + 1];
        
        const diffPrev = Math.abs(curr - prev);
        const diffNext = Math.abs(next - curr);
        
        // Eğer bir tarafı komşu kadar benzer, diğer tarafı çok farklıysa = hata
        if (diffPrev > SPIKE_THRESHOLD && diffNext < SPIKE_THRESHOLD / 2) {
            cleaned[i] = prev + (curr - prev) * 0.3;
            fixedCount++;
        } else if (diffNext > SPIKE_THRESHOLD && diffPrev < SPIKE_THRESHOLD / 2) {
            cleaned[i] = prev + (next - prev) * 0.5;
            fixedCount++;
        }
    }
    
    // 3. Aşırı değerleri filtrele (dünya standartları: -500m ~ 9000m)
    for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i] < -500 || cleaned[i] > 9000) {
            // Komşularından interpolate et
            let neighbors = [];
            for (let j = Math.max(0, i - 3); j <= Math.min(cleaned.length - 1, i + 3); j++) {
                if (j !== i && cleaned[j] >= -500 && cleaned[j] <= 9000) {
                    neighbors.push(cleaned[j]);
                }
            }
            if (neighbors.length > 0) {
                cleaned[i] = neighbors.reduce((a, b) => a + b, 0) / neighbors.length;
                fixedCount++;
            }
        }
    }
    
    console.log("[ELEV CLEAN] Sonuç:", {
        total: cleaned.length,
        fixedCount: fixedCount,
        min: Math.min(...cleaned),
        max: Math.max(...cleaned)
    });
    
    return cleaned;
};

// === PATCH: renderRouteScaleBar içinde veri temizleme ===
(function() {
    const origRenderRouteScaleBar = window.renderRouteScaleBar;
    
    if (!origRenderRouteScaleBar) return;
    
    window.renderRouteScaleBar = function(container, totalKm, markers) {
        // Orijinal fonksiyonu sarala
        const executeWithCleanup = async () => {
            // Orijinal çağrısını yap - ama elevation fetch kısmında cleanup ekle
            return origRenderRouteScaleBar.apply(this, arguments);
        };
        
        return executeWithCleanup();
    };
})();

// === PATCH: getElevationsForRoute sonrası temizleme ===
(function() {
    const origGetElev = window.getElevationsForRoute;
    
    if (!origGetElev) return;
    
    window.getElevationsForRoute = async function(samples, container, routeKey) {
        try {
            let elevations = await origGetElev.call(this, samples, container, routeKey);
            
            if (!elevations || elevations.length === 0) {
                return elevations;
            }
            
            // Veriyi temizle
            console.log(`[ELEVATION] ${samples.length} noktanın elevation verisi alındı`);
            elevations = window.cleanElevationData(elevations, samples);
            
            return elevations;
        } catch (error) {
            console.error('[ELEVATION] Hata:', error);
            throw error;
        }
    };
})();

// === PATCH: movingAverage penceresini dinamik yap ===
(function() {
    const origMovingAvg = window.movingAverage;
    
    if (!origMovingAvg) return;
    
    window.movingAverage = function(arr, win = 5) {
        if (!Array.isArray(arr) || arr.length === 0) return arr;
        
        // Varyasyon hesapla
        let variance = 0;
        const mean = arr.reduce((a, b) => a + (b || 0), 0) / arr.length;
        
        for (let i = 0; i < arr.length; i++) {
            variance += Math.pow((arr[i] || mean) - mean, 2);
        }
        variance = variance / arr.length;
        
        // Yüksek varyasyon varsa (su geçişi gibi) = daha geniş window
        let dynamicWin = win;
        if (variance > 50) { // Varyans yüksek
            dynamicWin = Math.max(7, Math.ceil(win * 1.5));
            console.log(`[SMOOTH] Yüksek varyasyon tespit, window: ${win} → ${dynamicWin}`);
        }
        
        // Orijinal smooth'u çalıştır
        return origMovingAvg.call(this, arr, dynamicWin);
    };
})();