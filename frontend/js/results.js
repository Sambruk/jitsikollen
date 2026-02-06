// Results page logic

(function() {
  var params = new URLSearchParams(window.location.search);
  var resultId = params.get('id');

  if (resultId) {
    loadSingleResult(resultId);
  } else {
    loadResultsList();
  }
})();

async function loadSingleResult(id) {
  document.getElementById('results-list').style.display = 'none';
  document.getElementById('result-detail').style.display = '';

  try {
    var data = await apiJSON('/results/' + encodeURIComponent(id));
    var results = data.results_json;

    // Render score
    var scoreData = calculateScore(results);
    renderScore(document.getElementById('result-score'), scoreData);

    // Render recommendations
    var recs = getRecommendations(results);
    var recsCard = document.getElementById('result-recommendations');
    if (recs.length > 0) {
      recsCard.style.display = '';
      var html = '';
      for (var i = 0; i < recs.length; i++) {
        var r = recs[i];
        var icon = r.severity === 'critical' ? '&#9888;' : (r.severity === 'warning' ? '&#9888;' : '&#8505;');
        html += '<div class="recommendation ' + r.severity + '">' +
          '<span class="rec-icon">' + icon + '</span>' +
          '<div><strong>' + escapeHtml(r.testName) + ':</strong> ' + escapeHtml(r.message) + '</div>' +
        '</div>';
      }
      document.getElementById('result-rec-list').innerHTML = html;
    }

    // Render layers
    var layerNames = {
      1: 'Lager 1: Webbläsare & Enheter',
      2: 'Lager 2: Nätverksanslutning',
      3: 'Lager 3: WebRTC-anslutning',
      4: 'Lager 4: Jitsi-specifikt',
      5: 'Lager 5: Kvalitet'
    };

    var layersHtml = '';
    for (var layer = 1; layer <= 5; layer++) {
      var layerResults = results.filter(function(r) { return r.layer === layer; });
      if (layerResults.length === 0) continue;

      layersHtml += '<div style="margin-bottom:1rem;"><h3 style="margin-bottom:0.5rem;">' + (layerNames[layer] || 'Lager ' + layer) + '</h3>';
      for (var j = 0; j < layerResults.length; j++) {
        var t = layerResults[j];
        var statusClass = 'status-' + t.status;
        var statusLabel = t.status === 'pass' ? 'Godkänd' : (t.status === 'warn' ? 'Varning' : 'Underkänd');
        layersHtml += '<div class="test-item">' +
          '<span class="test-name"><span class="dot dot-' + t.status + '"></span> ' + escapeHtml(t.name) + '</span>' +
          '<span class="test-result ' + statusClass + '">' + statusLabel +
          (t.detail ? ' <small>(' + escapeHtml(t.detail) + ')</small>' : '') + '</span></div>';
      }
      layersHtml += '</div>';
    }
    document.getElementById('result-layers-list').innerHTML = layersHtml;

    // Render meta
    var metaHtml =
      '<div class="test-item"><span>Tidpunkt:</span><span>' + formatDate(data.timestamp) + '</span></div>' +
      '<div class="test-item"><span>Organisation:</span><span>' + escapeHtml(data.organization || '(ej angiven)') + '</span></div>' +
      '<div class="test-item"><span>Poäng:</span><span>' + data.total_score + '/100 (' + data.rating + ')</span></div>' +
      '<div class="test-item"><span>Test-ID:</span><span style="font-family:monospace;font-size:0.8rem;">' + escapeHtml(data.id) + '</span></div>';
    document.getElementById('result-meta').innerHTML = metaHtml;

  } catch (e) {
    document.getElementById('result-detail').innerHTML = '<div class="card"><p style="color:var(--danger);">Kunde inte ladda resultat: ' + escapeHtml(e.message) + '</p></div>';
  }
}

async function loadResultsList() {
  document.getElementById('results-list').style.display = '';
  document.getElementById('result-detail').style.display = 'none';

  try {
    var results = await apiJSON('/results');

    if (results.length === 0) {
      document.getElementById('results-table-container').innerHTML =
        '<p style="color:var(--text-muted);">Inga testresultat sparade än. <a href="test.html">Kör ett test</a> för att börja.</p>';
      return;
    }

    var html = '<table class="whitelist-table"><thead><tr>' +
      '<th>Tidpunkt</th><th>Organisation</th><th>Poäng</th><th>Bedömning</th><th></th>' +
      '</tr></thead><tbody>';

    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      var color = r.rating === 'green' ? 'var(--success)' : (r.rating === 'yellow' ? 'var(--warning)' : 'var(--danger)');
      var label = r.rating === 'green' ? 'Redo' : (r.rating === 'yellow' ? 'Begränsad' : 'Blockerad');
      html += '<tr>' +
        '<td>' + formatDate(r.timestamp) + '</td>' +
        '<td>' + escapeHtml(r.organization || '-') + '</td>' +
        '<td><strong>' + r.total_score + '</strong>/100</td>' +
        '<td style="color:' + color + ';font-weight:600;">' + label + '</td>' +
        '<td><a href="results.html?id=' + encodeURIComponent(r.id) + '" class="btn btn-sm btn-secondary">Visa</a></td>' +
        '</tr>';
    }

    html += '</tbody></table>';
    document.getElementById('results-table-container').innerHTML = html;

  } catch (e) {
    document.getElementById('results-table-container').innerHTML =
      '<p style="color:var(--danger);">Kunde inte ladda resultat: ' + escapeHtml(e.message) + '</p>';
  }
}
