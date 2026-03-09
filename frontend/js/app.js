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

// Fetch server info and populate dynamic domain references
(function() {
  if (typeof apiJSON === 'function') {
    apiJSON('/info').then(function(info) {
      var domain = info.jitsiDomain || '';
      var subtitle = document.getElementById('header-subtitle');
      if (subtitle && domain) {
        subtitle.textContent = 'Diagnostik och vitlistning för ' + domain;
      }
      var footer = document.getElementById('footer-text');
      if (footer && domain) {
        footer.textContent = 'Jitsi-kollen \u2014 Ett verktyg från Sambruk för ' + domain;
      }
      var heroDesc = document.getElementById('hero-desc');
      if (heroDesc && domain) {
        heroDesc.textContent = 'Testa er organisations nätverks- och webbläsarkompatibilitet med Jitsi-videomöten på ' + domain + '. Få en poäng, specifika rekommendationer och brandväggsregler.';
      }
    }).catch(function() {
      // Silently ignore - domain info is non-critical
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
