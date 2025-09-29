// Placeholder rendering (only if you don't already have UI logic)
(function() {
  if (!document.getElementById('trip-days')) {
    const c = document.createElement('div');
    c.id = 'trip-days';
    c.style.marginTop = '20px';
    document.body.appendChild(c);
  }

  window.renderTripDays = function() {
    const root = document.getElementById('trip-days');
    if (!root) return;
    if (!window.tripPlan || !window.tripPlan.days.length) {
      root.innerHTML = '<p style="color:#666;">No trip days yet.</p>';
      return;
    }
    root.innerHTML = window.tripPlan.days.map((day, idx) => {
      return `
        <div class="trip-day-block" data-day="${idx}" style="margin-bottom:18px;padding:12px;border:1px solid #eee;border-radius:10px;">
          <h3 style="margin:0 0 8px;font-size:1rem;">${day.title}</h3>
          <div class="day-items">
            ${day.items.map(it => `
              <div class="day-item-row" style="font-size:0.85rem;padding:6px 8px;border:1px solid #f0f0f2;border-radius:6px;margin-bottom:4px;">
                <strong>${it.title}</strong><br>
                <span style="color:#555;">${it.lat.toFixed(5)}, ${it.lon.toFixed(5)}</span>
              </div>`).join('')}
          </div>
        </div>
      `;
    }).join('');
  };

  window.renderDayItems = function(dayIndex) {
    window.renderTripDays(); // simple re-render
  };
})();