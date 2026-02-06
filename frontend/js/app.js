// Global app logic: date display, navigation

(function() {
  // Display current date
  var dateEl = document.getElementById('current-date');
  if (dateEl) {
    var now = new Date();
    dateEl.textContent = now.toLocaleDateString('sv-SE', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
})();

// Load stats on start page
(function() {
  var statsBar = document.getElementById('stats-bar');
  if (statsBar && typeof apiJSON === 'function') {
    apiJSON('/results/stats').then(function(data) {
      document.getElementById('stat-runs').textContent = data.totalRuns;
      document.getElementById('stat-avg').textContent = data.averageScore + '/100';
      statsBar.style.display = '';
    }).catch(function() {
      // Silently ignore - stats are non-critical
    });
  }
})();

function toggleLayer(n) {
  var items = document.getElementById('layer-' + n + '-items');
  if (items) {
    items.style.display = items.style.display === 'none' ? '' : 'none';
  }
}
