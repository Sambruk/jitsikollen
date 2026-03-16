// Scoring and recommendation engine for Videomötes-kollen
// Supports platform-aware scoring (Jitsi, Nextcloud Talk, or both)

var LAYER_WEIGHTS = { 1: 0.10, 2: 0.35, 3: 0.25, 4: 0.20, 5: 0.10 };

// Recommendations per test (Swedish)
var RECOMMENDATIONS = {
  'webrtc-support': {
    fail: 'Din webbläsare stöder inte WebRTC. Använd Chrome, Firefox eller Edge.'
  },
  'camera-mic': {
    fail: 'Kamera eller mikrofon kunde inte nås. Kontrollera att enheter är anslutna och att webbläsaren har tillstånd.',
    warn: 'Kamera eller mikrofon behöver tillstånd. Godkänn i webbläsarens behörighetsdialog.'
  },
  'device-enum': {
    fail: 'Inga ljud/videoenheter hittades. Kontrollera att kamera och mikrofon är anslutna.'
  },
  // Jitsi network
  'stun': {
    fail: 'STUN-trafik blockeras. Be IT-avdelningen öppna utgående UDP 3478 mot meet.sambruk.nu.'
  },
  'turn-udp-3478': {
    fail: 'TURN via UDP blockeras. Öppna utgående UDP 3478 mot meet.sambruk.nu.'
  },
  'turn-tls-5349': {
    fail: 'TURN-server ej nåbar. Be IT-avdelningen öppna utgående UDP 3478 mot meet.sambruk.nu.',
    warn: 'TURN TLS-port 5349 kan inte verifieras från webbläsaren. TURN-servern är nåbar via STUN.'
  },
  'turn-tcp-4443': {
    fail: 'TURN-server ej nåbar. Be IT-avdelningen öppna utgående trafik mot meet.sambruk.nu.',
    warn: 'TURN TCP-port 4443 kan inte verifieras från webbläsaren. TURN-servern är nåbar via STUN.'
  },
  'turn-443-sni': {
    fail: 'TURN-server ej nåbar. Be IT-avdelningen öppna utgående trafik mot meet.sambruk.nu.',
    warn: 'TURN via port 443 (SNI-routing) kan inte verifieras från webbläsaren. TURN-servern är nåbar via STUN.'
  },
  'turn-tls-443-ext': {
    fail: 'Extern STUN via port 443 blockeras. Be IT-avdelningen tillåta trafik till meet-jit-si-turnrelay.jitsi.net:443.'
  },
  'udp-10000': {
    fail: 'Mediaport UDP 10000 blockeras. Videokvaliteten påverkas. Öppna utgående UDP 10000 mot meet.sambruk.nu.',
    warn: 'UDP 10000 verkar begränsad. Videokvaliteten kan påverkas.'
  },
  // Nextcloud Talk network
  'nc-stun': {
    fail: 'STUN-trafik till Nextcloud blockeras. Be IT-avdelningen tillåta utgående trafik till stun.nextcloud.com:443.'
  },
  'nc-turn': {
    fail: 'TURN-server för Nextcloud Talk ej nåbar.',
    warn: 'Ingen TURN-server konfigurerad för Nextcloud Talk. Samtal kan misslyckas bakom restriktiv brandvägg.'
  },
  // Shared WebRTC
  'ice-candidates': {
    fail: 'Inga ICE-kandidater kunde samlas. Både STUN och TURN är blockerade.'
  },
  'peer-connection': {
    fail: 'WebRTC-anslutning misslyckades helt. Både UDP och TURN blockeras. Se vitlistningsguiden.',
    warn: 'WebRTC-anslutning fungerade delvis. Några reservvägar kan användas.'
  },
  'data-channel': {
    fail: 'DataChannel kunde inte öppnas. WebRTC-anslutningen är instabil.'
  },
  // Jitsi platform
  'jitsi-websocket': {
    fail: 'WebSocket-signalering blockeras. Er proxy terminerar troligen WebSocket-uppgraderingar. Vitlista meet.sambruk.nu.',
    warn: 'WebSocket blockeras från den här sidan (cross-origin). I Jitsi-klienten fungerar WebSocket normalt från samma domän.'
  },
  'jitsi-https': {
    fail: 'HTTPS-åtkomst till meet.sambruk.nu blockeras. Kontrollera att port 443 är öppen mot meet.sambruk.nu.'
  },
  // Nextcloud Talk platform
  'nc-https': {
    fail: 'HTTPS-åtkomst till samverka.sambruk.se blockeras. Kontrollera att port 443 är öppen mot samverka.sambruk.se.'
  },
  'nc-status': {
    fail: 'Nextcloud Talk-servern svarar inte. Kontrollera att samverka.sambruk.se är tillgänglig.',
    warn: 'Nextcloud Talk-serverns status kunde inte verifieras fullt ut.'
  },
  // Quality
  'bandwidth': {
    fail: 'Bandbredden är för låg för video (<0.5 Mbps). Kontrollera nätverksanslutningen.',
    warn: 'Bandbredden är låg (<1 Mbps). Videokvaliteten kan bli begränsad.'
  },
  'latency': {
    warn: 'Latensen är hög (>300ms). Samtalet kan upplevas som fördröjt.',
    fail: 'Latensen är mycket hög (>1000ms). Realtidskommunikation fungerar dåligt.'
  },
  'jitter': {
    warn: 'Hög variation i latens (jitter). Ljud och video kan bli hackigt.'
  }
};

// Platform-specific verdict messages
var PLATFORM_VERDICTS = {
  jitsi: {
    green: { verdict: 'Redo för Jitsi-möten', description: 'Er IT-miljö är kompatibel med Jitsi. Videomöten på meet.sambruk.nu bör fungera utan problem.' },
    yellow: { verdict: 'Begränsad anslutning', description: 'Jitsi fungerar med reservvägar, men vissa funktioner kan vara begränsade. Se rekommendationerna nedan.' },
    red: { verdict: 'Blockerad - kräver ändringar', description: 'Er IT-miljö blockerar kritiska anslutningar. Videomöten på meet.sambruk.nu fungerar inte. Dela vitlistningen med IT-avdelningen.' }
  },
  nextcloud: {
    green: { verdict: 'Redo för Nextcloud Talk', description: 'Er IT-miljö är kompatibel med Nextcloud Talk. Videomöten på samverka.sambruk.se bör fungera utan problem.' },
    yellow: { verdict: 'Begränsad anslutning', description: 'Nextcloud Talk fungerar med reservvägar, men vissa funktioner kan vara begränsade. Se rekommendationerna nedan.' },
    red: { verdict: 'Blockerad - kräver ändringar', description: 'Er IT-miljö blockerar kritiska anslutningar. Videomöten på samverka.sambruk.se fungerar inte. Dela vitlistningen med IT-avdelningen.' }
  }
};

function calculateScore(testResults, platform) {
  // Filter tests by platform
  var filtered;
  if (platform && platform !== 'both') {
    filtered = testResults.filter(function(t) {
      return t.platform === 'shared' || t.platform === platform;
    });
  } else {
    filtered = testResults;
  }

  var layerScores = {};
  var hasCriticalFail = false;

  // Group by layer
  for (var i = 0; i < filtered.length; i++) {
    var t = filtered[i];
    if (!layerScores[t.layer]) {
      layerScores[t.layer] = { tests: [], totalWeight: 0 };
    }
    var weight = t.category === 'critical' ? 2 : (t.category === 'important' ? 1.5 : 1);
    var score = t.status === 'pass' ? 1.0 : (t.status === 'warn' ? 0.5 : 0.0);

    if (t.status === 'fail' && t.category === 'critical') {
      hasCriticalFail = true;
    }

    layerScores[t.layer].tests.push({ id: t.id, score: score, weight: weight });
    layerScores[t.layer].totalWeight += weight;
  }

  // Calculate per-layer score
  var totalScore = 0;
  var layerDetails = {};
  for (var layer in layerScores) {
    var ls = layerScores[layer];
    var layerScore = 0;
    for (var j = 0; j < ls.tests.length; j++) {
      layerScore += ls.tests[j].score * ls.tests[j].weight;
    }
    layerScore = ls.totalWeight > 0 ? (layerScore / ls.totalWeight) * 100 : 0;
    layerDetails[layer] = layerScore;
    totalScore += layerScore * (LAYER_WEIGHTS[layer] || 0);
  }

  // Critical cap
  if (hasCriticalFail && totalScore > 39) {
    totalScore = 39;
  }

  totalScore = Math.round(totalScore);

  // Get platform-specific verdicts
  var verdictPlatform = platform || 'jitsi';
  if (verdictPlatform === 'both') verdictPlatform = 'jitsi'; // fallback
  var verdicts = PLATFORM_VERDICTS[verdictPlatform] || PLATFORM_VERDICTS.jitsi;

  var rating, color, verdict, description;
  if (totalScore >= 80) {
    rating = 'green';
    color = 'green';
    verdict = verdicts.green.verdict;
    description = verdicts.green.description;
  } else if (totalScore >= 40) {
    rating = 'yellow';
    color = 'yellow';
    verdict = verdicts.yellow.verdict;
    description = verdicts.yellow.description;
  } else {
    rating = 'red';
    color = 'red';
    verdict = verdicts.red.verdict;
    description = verdicts.red.description;
  }

  return {
    totalScore: totalScore,
    rating: rating,
    color: color,
    verdict: verdict,
    description: description,
    layerDetails: layerDetails,
    hasCriticalFail: hasCriticalFail
  };
}

function getRecommendations(testResults, platform) {
  var filtered;
  if (platform && platform !== 'both') {
    filtered = testResults.filter(function(t) {
      return t.platform === 'shared' || t.platform === platform;
    });
  } else {
    filtered = testResults;
  }

  var recs = [];
  for (var i = 0; i < filtered.length; i++) {
    var t = filtered[i];
    if (t.status === 'pass') continue;
    var rec = RECOMMENDATIONS[t.id];
    if (!rec) continue;
    var msg = rec[t.status];
    if (!msg) continue;
    recs.push({
      testId: t.id,
      testName: t.name,
      severity: t.category === 'critical' ? 'critical' : (t.status === 'fail' ? 'warning' : 'info'),
      message: msg
    });
  }
  // Sort: critical first
  recs.sort(function(a, b) {
    var order = { critical: 0, warning: 1, info: 2 };
    return (order[a.severity] || 9) - (order[b.severity] || 9);
  });
  return recs;
}

function renderScore(container, scoreData) {
  container.innerHTML =
    '<div class="score-circle ' + scoreData.color + '">' +
      '<div class="score-number">' + scoreData.totalScore + '</div>' +
      '<div class="score-label">av 100</div>' +
    '</div>' +
    '<div class="score-verdict" style="color:var(--' + (scoreData.color === 'green' ? 'success' : scoreData.color === 'yellow' ? 'warning' : 'danger') + ')">' +
      escapeHtml(scoreData.verdict) +
    '</div>' +
    '<div class="score-description">' + escapeHtml(scoreData.description) + '</div>';
}

function renderDualScore(container, jitsiScore, ncScore) {
  function scoreHtml(scoreData) {
    return '<div class="score-circle ' + scoreData.color + '">' +
      '<div class="score-number">' + scoreData.totalScore + '</div>' +
      '<div class="score-label">av 100</div>' +
    '</div>' +
    '<div class="score-verdict" style="color:var(--' + (scoreData.color === 'green' ? 'success' : scoreData.color === 'yellow' ? 'warning' : 'danger') + ')">' +
      escapeHtml(scoreData.verdict) +
    '</div>';
  }

  container.innerHTML =
    '<div class="dual-score">' +
      '<div class="platform-score-section">' +
        '<div class="platform-score-title">Jitsi Meet</div>' +
        scoreHtml(jitsiScore) +
      '</div>' +
      '<div class="platform-score-section">' +
        '<div class="platform-score-title">Nextcloud Talk</div>' +
        scoreHtml(ncScore) +
      '</div>' +
    '</div>';
}

function renderRecommendations(container, recs) {
  if (recs.length === 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = '';
  var listEl = container.querySelector('[id$="-list"]') || container;
  var html = '';
  for (var i = 0; i < recs.length; i++) {
    var r = recs[i];
    var icon = r.severity === 'critical' ? '&#9888;' : (r.severity === 'warning' ? '&#9888;' : '&#8505;');
    html += '<div class="recommendation ' + r.severity + '">' +
      '<span class="rec-icon">' + icon + '</span>' +
      '<div><strong>' + escapeHtml(r.testName) + ':</strong> ' + escapeHtml(r.message) + '</div>' +
    '</div>';
  }
  listEl.innerHTML = html;
}
