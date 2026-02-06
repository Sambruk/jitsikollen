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

function toggleLayer(n) {
  var items = document.getElementById('layer-' + n + '-items');
  if (items) {
    items.style.display = items.style.display === 'none' ? '' : 'none';
  }
}
