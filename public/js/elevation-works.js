window.__scaleBarDrag = null;
window.__scaleBarDragTrack = null;
window.__scaleBarDragSelDiv = null;

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
        if (eSpan > 0) { vizMin = min - eSpan * 0.50; vizMax = max + eSpan * 1.0; }
        else { vizMin = min - 1; vizMax = max + 1; }
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
        for (let i = 1; i < s.length; i++) {
          const kmAbs1 = s[i - 1].distM / 1000;
          const kmAbs2 = s[i].distM / 1000;
          const midKm = (kmAbs1 + kmAbs2) / 2;
          const dist = Math.abs(foundKmAbs - midKm);
          if (dist < minDist) {
            minDist = dist;
            const dx = s[i].distM - s[i - 1].distM;
            const dy = ed.smooth[i] - ed.smooth[i - 1];
            foundSlope = dx > 0 ? (dy / dx) * 100 : 0;
            foundElev = Math.round(ed.smooth[i]);
          }
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

      // ARTIK KESİN GEÇERLİDİR
      const smooth = movingAverage(elevations, 3);
      const min = Math.min(...smooth);
      const max = Math.max(...smooth, min + 1);

      container._elevationData = { smooth, min, max };
      container._elevationDataFull = { smooth: smooth.slice(), min, max };
      container.dataset.elevLoadedKey = routeKey;

     container._redrawElevation = function(elevationData) {
        if (!elevationData) return;
        const { smooth, min, max } = elevationData;
        const s = container._elevSamples || [];
        const startKmDom = Number(container._elevStartKm || 0);
        const spanKm = Number(container._elevKmSpan || totalKm) || 1;

        let vizMin = min, vizMax = max;
        const eSpan = max - min;
        if (eSpan > 0) { vizMin = min - eSpan * 0.50; vizMax = max + eSpan * 1.0; }
        else { vizMin = min - 1; vizMax = max + 1; }

        const X = kmRel => (kmRel / spanKm) * width;
        const Y = e => (isNaN(e) || vizMin === vizMax) ? (SVG_H / 2) : ((SVG_H - 1) - ((e - vizMin) / (vizMax - vizMin)) * (SVG_H - 2));

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
