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
  // MUTLAKA global state'i temizle:
  window._lastSegmentDay = undefined;
  window._lastSegmentStartKm = undefined;
  window._lastSegmentEndKm = undefined;

  // Segment overlay DOM'u da temizle (isteğe bağlı)
  const bar = document.getElementById(`expanded-route-scale-bar-day${day}`);
  if (bar) {
    bar.querySelectorAll('svg[data-role="elev-segment"]').forEach(el => el.remove());
bar.querySelectorAll('.elev-segment-toolbar').forEach(el => el.remove());
    const sel = bar.querySelector('.scale-bar-selection');
    if (sel) sel.style.display = 'none';
  }
}


function createScaleElements(track, widthPx, spanKm, startKmDom, markers = [], customElevData = null, retryCount = 0) {
  // GÜVENLİK: Eğer track yoksa veya gizliyse bekle
  if (!track || !track.offsetParent) {
    if (retryCount < 10) {
      setTimeout(() => {
        createScaleElements(track, widthPx, spanKm, startKmDom, markers, customElevData, retryCount + 1);
      }, 300);
    }
    return;
  }
  
  // GENİŞLİĞİ KESİN AL
  const actualWidth = Math.max(
    300, // ASGARİ 300 PİKSEL
    track.offsetWidth || 0,
    track.clientWidth || 0
  );
  
  // console.log("📏 SCALEBAR Genişlik:", actualWidth, "px");
  
  // Eğer hala 0 ise, container'dan al
  if (actualWidth < 300) {
    const container = track.closest('.route-scale-bar');
    if (container) {
      widthPx = container.offsetWidth || 400;
      // console.log("📏 Container genişliği kullanılıyor:", widthPx, "px");
    }
  } else {
    widthPx = actualWidth;
  }
    // console.group(`[ScaleBar Debug] Day: ${track?.parentElement?.id || 'unknown'} | Attempt: ${retryCount}`);


    // console.log("Param Width:", widthPx);
    // console.log("Actual OffsetWidth:", actualWidth);
    // console.log("Span KM:", spanKm);
    // console.log("Elevation Data:", track?.parentElement?._elevationData ? "Mevcut ✅" : "YOK ❌");
    // console.groupEnd();
    // --- DEBUG LOG END ---

    // 1. KONTROL: Element yoksa veya DOM'dan tamamen silinmişse işlemi durdur.
    if (!track || !track.isConnected) {
        return;
    }

    // 2. KONTROL: Element var ama görünür değilse (örn: display:none)
    if (track.offsetParent === null) {
        if (retryCount < 5) {
            setTimeout(() => {
                createScaleElements(track, widthPx, spanKm, startKmDom, markers, customElevData, retryCount + 1);
            }, 300);
        }
        return;
    }

    // --- GENİŞLİK DOĞRULAMA ---
    // Eğer genişlik bariz hatalıysa (200px varsayılan veya 0 ise) tekrar dene
    if ((actualWidth <= 200 || Math.abs(actualWidth - widthPx) > 5) && retryCount < 10) {
        console.warn(`[ScaleBar] Genişlik uyumsuz! Bekleniyor... (Actual: ${actualWidth}, Param: ${widthPx})`);
        setTimeout(() => {
            createScaleElements(track, track.offsetWidth, spanKm, startKmDom, markers, customElevData, retryCount + 1);
        }, 200);
        return;
    }
    
    // Değeri güncelle
    widthPx = actualWidth;

    // --- Mevcut Temizlik İşlemleri ---
    if (track) {
        track.querySelectorAll('.marker-badge').forEach(el => el.remove());
    }

    const container = track?.parentElement;
    
    // SpanKm hesaplama mantığı - KESİN DEĞER
if ((!spanKm || spanKm < 0.01) && !customElevData) {
    if (Array.isArray(markers) && markers.length > 1) {
        spanKm = getTotalKmFromMarkers(markers);
    }
    
    // HİÇBİRİ İŞE YARAMAZSA, SABİT DEĞER
    if (!spanKm || spanKm < 0.01) {
        spanKm = 10; // Minimum 10 km
        // console.log("⚠️ SpanKm 0, sabit 10km kullanılıyor");
    }
}
   
    if (!spanKm || spanKm < 0.01) {
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
        const left = (curKm / spanKm) * widthPx;

        const tick = document.createElement('div');
        tick.className = 'scale-bar-tick';
        tick.style.left = `${left}px`;
        track.appendChild(tick);

        const label = document.createElement('div');
        label.className = 'scale-bar-label';
        label.style.left = `${left}px`;
        label.textContent = curKm.toFixed(1);
        track.appendChild(label);
    }

    // --- Marker Badges ---
    if (Array.isArray(markers) && markers.length > 0) {
        const startKm = parseFloat(startKmDom || 0);
        markers.forEach(m => {
            if (typeof m.markerKm === 'number' && m.markerKm >= startKm && m.markerKm <= startKm + spanKm) {
                const relKm = m.markerKm - startKm;
                const leftPx = (relKm / spanKm) * widthPx;

                const badge = document.createElement('div');
                badge.className = 'marker-badge';
                badge.style.left = `${leftPx}px`;
                badge.textContent = m.markerLabel || '';
                track.appendChild(badge);
            }
        });
    }

    // --- ELEVATION DRAW LOGIC ---
    const elevData = customElevData || (container && container._elevationData);
    if (elevData && elevData.elevations && elevData.elevations.length > 1) {
        let existingSvg = track.querySelector('svg[data-role="elev-bg"]');
        if (!existingSvg) {
            existingSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            existingSvg.setAttribute('data-role', 'elev-bg');
            existingSvg.style.cssText = 'position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible;';
            track.insertBefore(existingSvg, track.firstChild);
        }

        existingSvg.querySelectorAll('*').forEach(el => el.remove());
        existingSvg.setAttribute('viewBox', `0 0 ${widthPx} 100`);
        existingSvg.setAttribute('preserveAspectRatio', 'none');

        const fullElevations = elevData.elevations;
        const fullDistances = elevData.distances || fullElevations.map((_, i) => (i / (fullElevations.length - 1)) * spanKm);
        const fullSlopes = elevData.slopes || fullElevations.map(() => 0);

        const startKm = parseFloat(startKmDom || 0);
        const endKm = startKm + spanKm;

        const relevantIndices = fullDistances.map((d, i) => ({ d, i })).filter(obj => obj.d >= startKm && obj.d <= endKm);
        if (relevantIndices.length === 0) {
            return;
        }

        const sliceElevations = relevantIndices.map(obj => fullElevations[obj.i]);
        const sliceDistances = relevantIndices.map(obj => fullDistances[obj.i]);
        const sliceSlopes = relevantIndices.map(obj => fullSlopes[obj.i]);

        const smoothedElevations = movingAverage(sliceElevations, 5);

        const elevMin = Math.min(...smoothedElevations);
        const elevMax = Math.max(...smoothedElevations);
        const elevRange = Math.max(elevMax - elevMin, 1);

        for (let i = 0; i < smoothedElevations.length - 1; i++) {
            const d1 = sliceDistances[i] - startKm;
            const e1 = smoothedElevations[i];
            const d2 = sliceDistances[i + 1] - startKm;
            const e2 = smoothedElevations[i + 1];

            const x1 = (d1 / spanKm) * widthPx;
            const y1 = 100 - ((e1 - elevMin) / elevRange) * 100;
            const x2 = (d2 / spanKm) * widthPx;
            const y2 = 100 - ((e2 - elevMin) / elevRange) * 100;

            const slope = sliceSlopes[i];
            const fillColor = getSlopeColor(slope);

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', `M ${x1} ${y1} L ${x2} ${y2} L ${x2} 100 L ${x1} 100 Z`);
            path.setAttribute('fill', fillColor);
            path.setAttribute('fill-opacity', '0.65');
            path.setAttribute('stroke', 'none');
            existingSvg.appendChild(path);
        }

        // --- ELEVATION LABELS ---
        const existingLabelsContainer = track.querySelector('.elevation-labels-container');
        if (existingLabelsContainer) {
            existingLabelsContainer.remove();
        }

        const labelsContainer = document.createElement('div');
        labelsContainer.className = 'elevation-labels-container';
        labelsContainer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; display: flex; justify-content: space-between; align-items: flex-start; padding: 4px 8px;';

        const minLabel = document.createElement('span');
        minLabel.className = 'elevation-label elevation-label-min';
        minLabel.textContent = `${Math.round(elevMin)}m`;
        minLabel.style.cssText = 'font-size: 9px; color: rgba(255,255,255,0.75); background: rgba(0,0,0,0.4); padding: 2px 6px; border-radius: 4px; white-space: nowrap; backdrop-filter: blur(4px);';

        const maxLabel = document.createElement('span');
        maxLabel.className = 'elevation-label elevation-label-max';
        maxLabel.textContent = `${Math.round(elevMax)}m`;
        maxLabel.style.cssText = 'font-size: 9px; color: rgba(255,255,255,0.75); background: rgba(0,0,0,0.4); padding: 2px 6px; border-radius: 4px; white-space: nowrap; backdrop-filter: blur(4px);';

        labelsContainer.appendChild(minLabel);
        labelsContainer.appendChild(maxLabel);
        track.appendChild(labelsContainer);
    }
}

function getTotalKmFromMarkers(markers) {
    if (!Array.isArray(markers) || markers.length === 0) return 0;
    const kms = markers.map(m => m.markerKm || 0).filter(k => k > 0);
    return kms.length > 0 ? Math.max(...kms) : 0;
}

async function drawElevationProfile(container, elevations, distances, slopes, retryCount = 0) {
    // console.group("🎨 drawElevationProfile çağrısı");
    // console.log({
    //     container: container?.id,
    //     elevCount: elevations?.length,
    //     distCount: distances?.length,
    //     slopes: slopes?.length,
    //     retry: retryCount
    // });
    // console.groupEnd();

    if (!container || !elevations || elevations.length === 0) {
        // console.warn("⚠️ Container veya elevation verisi eksik");
        return;
    }

    if (!distances || distances.length !== elevations.length) {
        // console.warn("⚠️ Distances eksik veya uyumsuz, synthetic oluşturuluyor");
        const maxKm = parseFloat(container.dataset.totalKm) || 10;
        distances = elevations.map((_, i) => (i / (elevations.length - 1)) * maxKm);
    }

    if (!slopes || slopes.length !== elevations.length) {
        // console.warn("⚠️ Slopes eksik, sıfırlarla doldurulacak");
        slopes = new Array(elevations.length).fill(0);
    }

    container._elevationData = { elevations, distances, slopes };

    const track = container.querySelector('.scale-bar-track');
    if (!track) {
        // console.error("❌ scale-bar-track bulunamadı!");
        return;
    }

    const widthPx = Math.max(300, track.offsetWidth || 0, track.clientWidth || 0);
    if (widthPx < 300 && retryCount < 5) {
        // console.warn(`⏳ Track genişliği yetersiz (${widthPx}px), retry ${retryCount + 1}/5`);
        setTimeout(() => drawElevationProfile(container, elevations, distances, slopes, retryCount + 1), 200);
        return;
    }

    const totalKm = parseFloat(container.dataset.totalKm) || Math.max(...distances);
    const startKm = parseFloat(container.dataset.startKm) || 0;

    // console.log("✅ createScaleElements çağrılıyor:", {
    //     widthPx,
    //     totalKm,
    //     startKm,
    //     elevData: !!container._elevationData
    // });

    createScaleElements(
        track,
        widthPx,
        totalKm,
        startKm,
        [],
        container._elevationData,
        0
    );
}

// --- PATCH GLOBAL FUNCTION ---
(function patchDrawElevationProfile() {
    const original = window.drawElevationProfile;
    if (original && original._patched) return;

    window.drawElevationProfile = async function(container, elevations, distances, slopes) {
        // console.log("🔧 PATCHED drawElevationProfile çağrıldı");
        return drawElevationProfile(container, elevations, distances, slopes, 0);
    };

    window.drawElevationProfile._patched = true;
    // console.log("✅ drawElevationProfile PATCHED");
})();

window.getElevationsForRoute = async function(samples, container, routeKey) {
    if (!samples || samples.length === 0) {
        // console.error("⚠️ getElevationsForRoute: samples boş!");
        return null;
    }

    const cacheKey = routeKey || `route_${samples.length}_${samples[0].lat}_${samples[samples.length - 1].lat}`;

    if (window._elevationCache && window._elevationCache[cacheKey]) {
        const cached = window._elevationCache[cacheKey];
        // console.log(`✅ Cache hit: ${cacheKey}`);
        return cached.elevations;
    }

    const BATCH_SIZE = 512;
    const allElevations = [];

    for (let i = 0; i < samples.length; i += BATCH_SIZE) {
        const batch = samples.slice(i, i + BATCH_SIZE);
        const locations = batch.map(s => `${s.lat},${s.lng}`).join('|');

        try {
            const response = await fetch(
                `https://api.open-elevation.com/api/v1/lookup?locations=${locations}`
            );

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();

            if (data.results && Array.isArray(data.results)) {
                allElevations.push(...data.results.map(r => r.elevation));
            } else {
                throw new Error("Invalid API response format");
            }
        } catch (error) {
            console.error(`❌ Elevation API hatası (batch ${Math.floor(i / BATCH_SIZE) + 1}):`, error);
            allElevations.push(...new Array(batch.length).fill(null));
        }

        if (i + BATCH_SIZE < samples.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    if (!window._elevationCache) {
        window._elevationCache = {};
    }

    window._elevationCache[cacheKey] = {
        elevations: allElevations,
        timestamp: Date.now()
    };

    // console.log(`✅ ${samples.length} nokta için elevation alındı ve cache'lendi`);
    return allElevations;
};

window.fetchAndRenderSegmentElevation = async function(container, day, startKm, endKm) {
    if (!container) {
        console.error("❌ fetchAndRenderSegmentElevation: container yok!");
        return;
    }

    // console.group(`🔍 SEGMENT ELEVATION: Day ${day}, ${startKm.toFixed(2)} - ${endKm.toFixed(2)} km`);

    // Global state'i güncelle (harita highlight için gerekli)
    window._lastSegmentDay = day;
    window._lastSegmentStartKm = startKm;
    window._lastSegmentEndKm = endKm;

    const routeData = window.routeElevStatsByDay && window.routeElevStatsByDay[day];
    if (!routeData || !routeData.elevations || routeData.elevations.length === 0) {
        // console.warn("⚠️ routeElevStatsByDay verisi bulunamadı, ana veriye dönülüyor...");
        
        // Ana container'dan veri al
        const mainElevData = container._elevationData;
        if (!mainElevData) {
            console.error("❌ Ana elevation verisi de yok!");
            // console.groupEnd();
            return;
        }

        // Fallback: ana veriden segment çıkar
        const fullDistances = mainElevData.distances || [];
        const fullElevations = mainElevData.elevations || [];
        const fullSlopes = mainElevData.slopes || [];

        const indices = fullDistances
            .map((d, i) => ({ d, i }))
            .filter(obj => obj.d >= startKm && obj.d <= endKm);

        if (indices.length === 0) {
            console.error("❌ Segment için veri bulunamadı!");
            // console.groupEnd();
            return;
        }

        const segmentElevations = indices.map(obj => fullElevations[obj.i]);
        const segmentDistances = indices.map(obj => fullDistances[obj.i]);
        const segmentSlopes = indices.map(obj => fullSlopes[obj.i] || 0);

        await renderSegmentElevationOverlay(
            container,
            day,
            startKm,
            endKm,
            segmentElevations,
            segmentDistances,
            segmentSlopes
        );

        // console.groupEnd();
        return;
    }

    // Normal akış: routeElevStatsByDay verisi var
    const fullDistances = routeData.distances || [];
    const fullElevations = routeData.elevations || [];
    const fullSlopes = routeData.slopes || [];

    const indices = fullDistances
        .map((d, i) => ({ d, i }))
        .filter(obj => obj.d >= startKm && obj.d <= endKm);

    if (indices.length === 0) {
        console.error("❌ Segment için veri bulunamadı!");
        // console.groupEnd();
        return;
    }

    const segmentElevations = indices.map(obj => fullElevations[obj.i]);
    const segmentDistances = indices.map(obj => fullDistances[obj.i]);
    const segmentSlopes = indices.map(obj => fullSlopes[obj.i] || 0);

    // console.log("✅ Segment verisi hazır:", {
    //     elevCount: segmentElevations.length,
    //     distCount: segmentDistances.length,
    //     slopeCount: segmentSlopes.length
    // });

    await renderSegmentElevationOverlay(
        container,
        day,
        startKm,
        endKm,
        segmentElevations,
        segmentDistances,
        segmentSlopes
    );

    // console.groupEnd();
};

async function renderSegmentElevationOverlay(container, day, startKm, endKm, elevations, distances, slopes) {
    if (!container) {
        console.error("❌ renderSegmentElevationOverlay: container yok!");
        return;
    }

    // console.group(`🎨 RENDER SEGMENT OVERLAY: Day ${day}, ${startKm.toFixed(2)} - ${endKm.toFixed(2)} km`);

    const track = container.querySelector('.scale-bar-track');
    if (!track) {
        console.error("❌ scale-bar-track bulunamadı!");
        // console.groupEnd();
        return;
    }

    // Mevcut segment overlay'leri temizle
    track.querySelectorAll('svg[data-role="elev-segment"]').forEach(el => el.remove());
    track.querySelectorAll('.elev-segment-toolbar').forEach(el => el.remove());
    track.querySelectorAll('.elevation-labels-container').forEach(el => el.remove());

    // Selection indicator'ı gizle
    const selection = track.querySelector('.scale-bar-selection');
    if (selection) {
        selection.style.display = 'none';
    }

    const widthPx = Math.max(300, track.offsetWidth || 0, track.clientWidth || 0);
    const spanKm = endKm - startKm;

    // console.log("📐 Overlay boyutları:", { widthPx, spanKm });

    // SVG oluştur
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('data-role', 'elev-segment');
    svg.setAttribute('viewBox', `0 0 ${widthPx} 100`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.cssText = 'position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10; overflow: visible;';

    // Elevation smoothing
    const smoothedElevations = movingAverage(elevations, 5);
    const elevMin = Math.min(...smoothedElevations);
    const elevMax = Math.max(...smoothedElevations);
    const elevRange = Math.max(elevMax - elevMin, 1);

    // Slope-based fill
    for (let i = 0; i < smoothedElevations.length - 1; i++) {
        const d1 = distances[i] - startKm;
        const e1 = smoothedElevations[i];
        const d2 = distances[i + 1] - startKm;
        const e2 = smoothedElevations[i + 1];

        const x1 = (d1 / spanKm) * widthPx;
        const y1 = 100 - ((e1 - elevMin) / elevRange) * 100;
        const x2 = (d2 / spanKm) * widthPx;
        const y2 = 100 - ((e2 - elevMin) / elevRange) * 100;

        const slope = slopes[i] || 0;
        const fillColor = getSlopeColor(slope);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${x1} ${y1} L ${x2} ${y2} L ${x2} 100 L ${x1} 100 Z`);
        path.setAttribute('fill', fillColor);
        path.setAttribute('fill-opacity', '0.85');
        path.setAttribute('stroke', 'none');
        svg.appendChild(path);
    }

    track.appendChild(svg);

    // Elevation labels
    const labelsContainer = document.createElement('div');
    labelsContainer.className = 'elevation-labels-container';
    labelsContainer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; display: flex; justify-content: space-between; align-items: flex-start; padding: 4px 8px; z-index: 11;';

    const minLabel = document.createElement('span');
    minLabel.className = 'elevation-label elevation-label-min';
    minLabel.textContent = `${Math.round(elevMin)}m`;
    minLabel.style.cssText = 'font-size: 9px; color: rgba(255,255,255,0.85); background: rgba(0,0,0,0.5); padding: 2px 6px; border-radius: 4px; white-space: nowrap; backdrop-filter: blur(4px);';

    const maxLabel = document.createElement('span');
    maxLabel.className = 'elevation-label elevation-label-max';
    maxLabel.textContent = `${Math.round(elevMax)}m`;
    maxLabel.style.cssText = 'font-size: 9px; color: rgba(255,255,255,0.85); background: rgba(0,0,0,0.5); padding: 2px 6px; border-radius: 4px; white-space: nowrap; backdrop-filter: blur(4px);';

    labelsContainer.appendChild(minLabel);
    labelsContainer.appendChild(maxLabel);
    track.appendChild(labelsContainer);

    // Toolbar ekle
    const toolbar = document.createElement('div');
    toolbar.className = 'elev-segment-toolbar';
    toolbar.style.cssText = 'position: absolute; top: 8px; right: 8px; z-index: 12; display: flex; gap: 6px; align-items: center;';

    const rangeText = document.createElement('span');
    rangeText.style.cssText = 'font-size: 10px; color: rgba(255,255,255,0.85); background: rgba(0,0,0,0.5); padding: 3px 8px; border-radius: 4px; white-space: nowrap; backdrop-filter: blur(4px);';
    rangeText.textContent = `${startKm.toFixed(1)} - ${endKm.toFixed(1)} km`;

    const backBtn = document.createElement('button');
    backBtn.textContent = '← Geri';
    backBtn.style.cssText = 'font-size: 11px; padding: 4px 10px; background: rgba(0,0,0,0.7); color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; cursor: pointer; backdrop-filter: blur(4px); transition: all 0.2s;';
    backBtn.onmouseover = () => backBtn.style.background = 'rgba(0,0,0,0.85)';
    backBtn.onmouseout = () => backBtn.style.background = 'rgba(0,0,0,0.7)';

    backBtn.onclick = () => {
        // console.log("🔙 Geri tuşuna basıldı");
        
        // Segment overlay'i temizle
        track.querySelectorAll('svg[data-role="elev-segment"]').forEach(el => el.remove());
        track.querySelectorAll('.elev-segment-toolbar').forEach(el => el.remove());
        track.querySelectorAll('.elevation-labels-container').forEach(el => el.remove());

        // Ana grafiği geri yükle
        const totalKm = parseFloat(container.dataset.totalKm) || 10;
        const mainElevData = container._elevationData;

        if (mainElevData) {
            createScaleElements(
                track,
                widthPx,
                totalKm,
                0,
                [],
                mainElevData,
                0
            );
        }

        // Haritadaki highlight'ı temizle
        clearRouteSegmentHighlight(day);

        // Global state'i sıfırla
        window._lastSegmentDay = undefined;
        window._lastSegmentStartKm = undefined;
        window._lastSegmentEndKm = undefined;
    };

    toolbar.appendChild(rangeText);
    toolbar.appendChild(backBtn);
    container.appendChild(toolbar);

    // console.log("✅ Segment overlay tamamlandı");
    // console.groupEnd();
}

// === HARITA ÜZERİNDE SEGMENT HIGHLIGHT FONKSİYONU ===
window.highlightSegmentOnMap = function(day, startKm, endKm) {
    if (!window.expandedMaps || !window.expandedMaps[day]) {
        // console.warn(`⚠️ Day ${day} için expanded map bulunamadı`);
        return;
    }

    const mapObj = window.expandedMaps[day];
    const map = mapObj.expandedMap;

    if (!map) {
        console.error(`❌ Day ${day} için Leaflet map instance yok!`);
        return;
    }

    // Mevcut highlight polyline'larını temizle
    if (!window._segmentHighlight) {
        window._segmentHighlight = {};
    }
    
    if (window._segmentHighlight[day]) {
        Object.values(window._segmentHighlight[day]).forEach(poly => {
            try { poly.remove(); } catch(_) {}
        });
    }

    window._segmentHighlight[day] = {};

    // Segment koordinatlarını al
    const routeData = window.routeElevStatsByDay && window.routeElevStatsByDay[day];
    if (!routeData || !routeData.samples) {
        console.error("❌ routeElevStatsByDay samples verisi yok!");
        return;
    }

    const samples = routeData.samples;
    const distances = routeData.distances || samples.map((_, i) => (i / (samples.length - 1)) * (endKm - startKm));

    const segmentCoords = samples
        .map((sample, i) => ({ ...sample, dist: distances[i] }))
        .filter(s => s.dist >= startKm && s.dist <= endKm)
        .map(s => [s.lat, s.lng]);

    if (segmentCoords.length < 2) {
        console.error("❌ Segment için yeterli koordinat yok!");
        return;
    }

    // Polyline oluştur
    const polyline = L.polyline(segmentCoords, {
        color: '#FFD700',
        weight: 6,
        opacity: 0.9,
        smoothFactor: 1
    }).addTo(map);

    window._segmentHighlight[day].segment = polyline;

    // Haritayı segment'e zoom yap
    const bounds = polyline.getBounds();
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });

    // console.log(`✅ Segment highlight eklendi: ${startKm.toFixed(2)} - ${endKm.toFixed(2)} km`);
};


window.renderRouteScaleBar = async function(container, totalKm, markers) {
    if (!container) {
        console.error("❌ renderRouteScaleBar: container yok!");
        return;
    }

    // console.group(`📊 RENDER ROUTE SCALE BAR: ${container.id || 'unknown'}`);
    // console.log({ totalKm, markerCount: markers?.length });

    container.dataset.totalKm = totalKm || 0;
    container.dataset.startKm = 0;

    container.innerHTML = '';

    // === LOADING STATE ===
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'elevation-loading';
    loadingDiv.style.cssText = `
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(4px);
        z-index: 20;
        border-radius: 8px;
    `;
    loadingDiv.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <div style="width: 24px; height: 24px; border: 3px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
            <span style="font-size: 12px; color: rgba(255,255,255,0.85);">Yükseklik verisi yükleniyor...</span>
        </div>
    `;
    container.appendChild(loadingDiv);

    const track = document.createElement('div');
    track.className = 'scale-bar-track';
    track.style.cssText = 'position: relative; width: 100%; height: 100%; overflow: visible;';
    container.appendChild(track);

    const selection = document.createElement('div');
    selection.className = 'scale-bar-selection';
    selection.style.cssText = 'position: absolute; top: 0; bottom: 0; background: rgba(255, 255, 255, 0.15); pointer-events: none; display: none; z-index: 5;';
    track.appendChild(selection);

    // Resize handler
    track.handleResize = function() {
        const newWidth = Math.max(300, track.offsetWidth || 0, track.clientWidth || 0);
        if (container._elevationData) {
            createScaleElements(track, newWidth, totalKm, 0, markers, container._elevationData, 0);
        }
    };

    const ro = new ResizeObserver(() => {
        if (track.handleResize) track.handleResize();
    });
    ro.observe(track);

    const day = container.id?.match(/day(\d+)/)?.[1];
    if (!day) {
        console.error("❌ Container ID'den day çıkarılamadı!");
        loadingDiv.remove();
        // console.groupEnd();
        return;
    }

    try {
        const elevData = await window.ensureElevationDataLoaded(parseInt(day, 10));

        if (!elevData || !elevData.elevations || elevData.elevations.length === 0) {
            throw new Error("Elevation verisi yüklenemedi");
        }

        // console.log("✅ Elevation verisi hazır:", {
        //     elevCount: elevData.elevations.length,
        //     distCount: elevData.distances?.length,
        //     slopeCount: elevData.slopes?.length
        // });

        await drawElevationProfile(
            container,
            elevData.elevations,
            elevData.distances,
            elevData.slopes
        );

        loadingDiv.remove();
        // console.log("✅ Scale bar render tamamlandı");

    } catch (error) {
        console.error("❌ Elevation render hatası:", error);
        
        loadingDiv.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding: 16px;">
                <span style="font-size: 20px;">⚠️</span>
                <span style="font-size: 12px; color: rgba(255,255,255,0.85);">Yükseklik verisi yüklenemedi</span>
                <button onclick="this.closest('.route-scale-bar').querySelector('.elevation-loading').remove(); window.renderRouteScaleBar(this.closest('.route-scale-bar'), ${totalKm}, ${JSON.stringify(markers)});" style="font-size: 11px; padding: 4px 12px; background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); border-radius: 4px; cursor: pointer; backdrop-filter: blur(4px); margin-top: 4px;">Tekrar Dene</button>
            </div>
        `;
    }

    // console.groupEnd();
};

// === MOUSE DRAG EVENT HANDLERS ===
window.addEventListener('mousedown', function(e) {
  const track = e.target.closest('.scale-bar-track');
  if (!track) return;

  const container = track.closest('.route-scale-bar');
  if (!container) return;

  const selection = track.querySelector('.scale-bar-selection');
  if (!selection) return;

  const rect = track.getBoundingClientRect();
  const startX = e.clientX - rect.left;

  window.__scaleBarDrag = { startX };
  window.__scaleBarDragTrack = track;
  window.__scaleBarDragSelDiv = selection;

  selection.style.display = 'block';
  selection.style.left = `${startX}px`;
  selection.style.width = '0px';

  e.preventDefault();
});

window.addEventListener('mousemove', function(e) {
  if (!window.__scaleBarDrag || !window.__scaleBarDragTrack || !window.__scaleBarDragSelDiv) return;

  const track = window.__scaleBarDragTrack;
  const selection = window.__scaleBarDragSelDiv;
  const rect = track.getBoundingClientRect();
  const currentX = e.clientX - rect.left;
  const startX = window.__scaleBarDrag.startX;

  const left = Math.min(startX, currentX);
  const width = Math.abs(currentX - startX);

  selection.style.left = `${left}px`;
  selection.style.width = `${width}px`;
});

window.addEventListener('mouseup', function(e) {
  if (!window.__scaleBarDrag || !window.__scaleBarDragTrack || !window.__scaleBarDragSelDiv) return;

  const track = window.__scaleBarDragTrack;
  const selection = window.__scaleBarDragSelDiv;
  const rect = track.getBoundingClientRect();
  const startX = window.__scaleBarDrag.startX;
  const endX = e.clientX - rect.left;

  const leftPx = Math.min(startX, endX);
  const rightPx = Math.max(startX, endX);
  const widthPx = rightPx - leftPx;

  if (widthPx < 10) {
    selection.style.display = 'none';
    window.__scaleBarDrag = null;
    window.__scaleBarDragTrack = null;
    window.__scaleBarDragSelDiv = null;
    return;
  }

  const container = track.closest('.route-scale-bar');
  if (!container) {
    window.__scaleBarDrag = null;
    return;
  }

  const dayMatch = container.id?.match(/day(\d+)/);
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
});

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


// === ELEVATION VERİ TEMIZLEME FONKSİYONU ===
window.cleanElevationData = function(elevations, samples = null) {
    if (!Array.isArray(elevations) || elevations.length === 0) return elevations;
    
    const cleaned = elevations.slice();
    const SPIKE_THRESHOLD = 25; // 25m'den fazla sıçrama = hata
    
    // console.log("[ELEV CLEAN] Başlangıç:", {
    //     total: cleaned.length,
    //     nullCount: cleaned.filter(e => e == null).length,
    //     min: Math.min(...cleaned.filter(e => e != null)),
    //     max: Math.max(...cleaned.filter(e => e != null))
    // });
    
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
    
    // console.log("[ELEV CLEAN] Sonuç:", {
    //     total: cleaned.length,
    //     fixedCount: fixedCount,
    //     min: Math.min(...cleaned),
    //     max: Math.max(...cleaned)
    // });
    
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
            // console.log(`[ELEVATION] ${samples.length} noktanın elevation verisi alındı`);
            elevations = window.cleanElevationData(elevations, samples);
            
            return elevations;
        } catch (error) {
            // console.error('[ELEVATION] Hata:', error);
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