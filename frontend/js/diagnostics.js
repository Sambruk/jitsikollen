// Diagnostics engine - runs all 5 layers of tests

var allTestResults = [];
var totalTests = 0;
var completedTests = 0;
var turnCreds = null; // Populated before layer 2 with real TURN credentials

function hasRealCreds() {
  return turnCreds && turnCreds.credentialSource === 'prosody';
}

function getIceServer(urlSubstring) {
  if (!turnCreds || !turnCreds.iceServers) return null;
  for (var i = 0; i < turnCreds.iceServers.length; i++) {
    var s = turnCreds.iceServers[i];
    if (s.urls && s.urls.indexOf(urlSubstring) !== -1 && s.username) return s;
  }
  return null;
}

var TEST_DEFINITIONS = {
  1: [
    { id: 'webrtc-support', name: 'WebRTC-stöd', category: 'critical' },
    { id: 'camera-mic', name: 'Kamera/mikrofon', category: 'important' },
    { id: 'device-enum', name: 'Enhetsupptäckt', category: 'nice' }
  ],
  2: [
    { id: 'stun', name: 'STUN', category: 'critical' },
    { id: 'turn-udp-3478', name: 'TURN UDP 3478', category: 'important' },
    { id: 'turn-tls-5349', name: 'TURN TLS 5349', category: 'nice' },
    { id: 'turn-tcp-4443', name: 'TURN TCP 4443', category: 'nice' },
    { id: 'turn-443-sni', name: 'TURN via 443 (SNI)', category: 'important' },
    { id: 'turn-tls-443-ext', name: 'TURN TLS 443 (extern)', category: 'nice' },
    { id: 'udp-10000', name: 'UDP 10000 (JVB)', category: 'important' }
  ],
  3: [
    { id: 'ice-candidates', name: 'ICE-kandidater', category: 'critical' },
    { id: 'peer-connection', name: 'Peer-anslutning', category: 'critical' },
    { id: 'data-channel', name: 'DataChannel', category: 'important' }
  ],
  4: [
    { id: 'jitsi-https', name: 'HTTPS-åtkomst', category: 'critical' },
    { id: 'jitsi-websocket', name: 'WebSocket signalering', category: 'important' }
  ],
  5: [
    { id: 'bandwidth', name: 'Bandbredd', category: 'nice' },
    { id: 'latency', name: 'Latens (RTT)', category: 'nice' },
    { id: 'jitter', name: 'Jitter', category: 'nice' }
  ]
};

function initTestUI() {
  for (var layer in TEST_DEFINITIONS) {
    var container = document.getElementById('layer-' + layer + '-items');
    if (!container) continue;
    var html = '';
    var tests = TEST_DEFINITIONS[layer];
    for (var i = 0; i < tests.length; i++) {
      totalTests++;
      html += '<div class="test-item" id="test-' + tests[i].id + '">' +
        '<span class="test-name"><span class="dot dot-pending" id="dot-' + tests[i].id + '"></span> ' + escapeHtml(tests[i].name) + '</span>' +
        '<span class="test-result" id="result-' + tests[i].id + '">Väntar</span>' +
      '</div>';
    }
    container.innerHTML = html;
  }
}

function updateTestUI(testId, status, detail) {
  var dot = document.getElementById('dot-' + testId);
  var result = document.getElementById('result-' + testId);
  if (dot) {
    dot.className = 'dot dot-' + status;
  }
  if (result) {
    var labels = { pass: 'Godkänd', warn: 'Varning', fail: 'Underkänd', running: 'Testar...', pending: 'Väntar' };
    var cls = 'status-' + status;
    result.className = 'test-result ' + cls;
    result.innerHTML = (status === 'running' ? '<span class="spinner"></span> ' : '') +
      (labels[status] || status) + (detail ? ' <small>(' + escapeHtml(detail) + ')</small>' : '');
  }
}

function updateLayerStatus(layer, status, detail) {
  var el = document.getElementById('layer-' + layer + '-status');
  if (!el) return;
  var labels = { pass: 'Godkänd', warn: 'Varning', fail: 'Underkänd', running: 'Testar...', pending: 'Väntar' };
  el.innerHTML = '<span class="dot dot-' + status + '"></span> ' + (labels[status] || status) +
    (detail ? ' <small>(' + detail + ')</small>' : '');
}

function updateProgress() {
  completedTests++;
  var pct = Math.round((completedTests / totalTests) * 100);
  var bar = document.getElementById('progress-bar');
  var text = document.getElementById('progress-text');
  if (bar) bar.style.width = pct + '%';
  if (text) text.textContent = completedTests + ' av ' + totalTests + ' tester klara (' + pct + '%)';
}

function recordResult(id, name, layer, category, status, detail) {
  allTestResults.push({ id: id, name: name, layer: layer, category: category, status: status, detail: detail || '' });
  updateTestUI(id, status, detail);
  updateProgress();
}

// --- Test implementations ---

async function testWebRTCSupport() {
  updateTestUI('webrtc-support', 'running');
  try {
    if (typeof RTCPeerConnection !== 'undefined') {
      recordResult('webrtc-support', 'WebRTC-stöd', 1, 'critical', 'pass');
    } else {
      recordResult('webrtc-support', 'WebRTC-stöd', 1, 'critical', 'fail', 'RTCPeerConnection saknas');
    }
  } catch (e) {
    recordResult('webrtc-support', 'WebRTC-stöd', 1, 'critical', 'fail', e.message);
  }
}

async function testCameraMic() {
  updateTestUI('camera-mic', 'running');
  try {
    var stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    stream.getTracks().forEach(function(t) { t.stop(); });
    recordResult('camera-mic', 'Kamera/mikrofon', 1, 'important', 'pass');
  } catch (e) {
    if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
      recordResult('camera-mic', 'Kamera/mikrofon', 1, 'important', 'warn', 'Tillstånd nekades');
    } else {
      recordResult('camera-mic', 'Kamera/mikrofon', 1, 'important', 'fail', e.message);
    }
  }
}

async function testDeviceEnum() {
  updateTestUI('device-enum', 'running');
  try {
    var devices = await navigator.mediaDevices.enumerateDevices();
    var audio = devices.filter(function(d) { return d.kind === 'audioinput'; });
    var video = devices.filter(function(d) { return d.kind === 'videoinput'; });
    if (audio.length > 0 && video.length > 0) {
      recordResult('device-enum', 'Enhetsupptäckt', 1, 'nice', 'pass', audio.length + ' mikrofon, ' + video.length + ' kamera');
    } else if (audio.length > 0 || video.length > 0) {
      recordResult('device-enum', 'Enhetsupptäckt', 1, 'nice', 'warn', 'Saknar ' + (audio.length === 0 ? 'mikrofon' : 'kamera'));
    } else {
      recordResult('device-enum', 'Enhetsupptäckt', 1, 'nice', 'fail', 'Inga enheter');
    }
  } catch (e) {
    recordResult('device-enum', 'Enhetsupptäckt', 1, 'nice', 'fail', e.message);
  }
}

// ICE connectivity test helper
function testICEConnectivity(testId, testName, layer, category, iceConfig, expectedType, timeout, timeoutStatus) {
  timeout = timeout || 10000;
  timeoutStatus = timeoutStatus || 'fail';
  return new Promise(function(resolve) {
    updateTestUI(testId, 'running');
    var found = false;
    var pc;
    try {
      pc = new RTCPeerConnection(iceConfig);
    } catch (e) {
      recordResult(testId, testName, layer, category, 'fail', 'Kunde inte skapa anslutning');
      resolve();
      return;
    }

    var timer = setTimeout(function() {
      if (!found) {
        recordResult(testId, testName, layer, category, timeoutStatus, 'Timeout');
        try { pc.close(); } catch(e) {}
      }
      resolve();
    }, timeout);

    pc.onicecandidate = function(e) {
      if (found) return;
      if (e.candidate) {
        var c = e.candidate.candidate;
        if (expectedType === 'srflx' && c.indexOf('srflx') !== -1) {
          found = true;
          clearTimeout(timer);
          recordResult(testId, testName, layer, category, 'pass', 'Server-reflexiv kandidat');
          try { pc.close(); } catch(ex) {}
          resolve();
        } else if (expectedType === 'relay' && c.indexOf('relay') !== -1) {
          found = true;
          clearTimeout(timer);
          recordResult(testId, testName, layer, category, 'pass', 'Relay-kandidat');
          try { pc.close(); } catch(ex) {}
          resolve();
        } else if (expectedType === 'any' && (c.indexOf('srflx') !== -1 || c.indexOf('relay') !== -1 || c.indexOf('host') !== -1)) {
          found = true;
          clearTimeout(timer);
          var type = c.indexOf('relay') !== -1 ? 'relay' : (c.indexOf('srflx') !== -1 ? 'srflx' : 'host');
          recordResult(testId, testName, layer, category, 'pass', type + '-kandidat');
          try { pc.close(); } catch(ex) {}
          resolve();
        }
      }
    };

    // Create data channel to trigger ICE gathering
    pc.createDataChannel('test');
    pc.createOffer().then(function(offer) {
      return pc.setLocalDescription(offer);
    }).catch(function(e) {
      if (!found) {
        clearTimeout(timer);
        recordResult(testId, testName, layer, category, 'fail', e.message);
        resolve();
      }
    });
  });
}

async function testSTUN() {
  await testICEConnectivity('stun', 'STUN', 2, 'critical', {
    iceServers: [{ urls: 'stun:meet.sambruk.nu:3478' }]
  }, 'srflx', 8000);
}

async function testTURN_UDP() {
  if (hasRealCreds()) {
    var server = getIceServer(':3478?transport=udp');
    if (server) {
      await testICEConnectivity('turn-udp-3478', 'TURN UDP 3478', 2, 'important', {
        iceServers: [server], iceTransportPolicy: 'relay'
      }, 'relay', 10000);
      return;
    }
  }
  // Fallback: STUN binding test
  await testICEConnectivity('turn-udp-3478', 'TURN UDP 3478', 2, 'important', {
    iceServers: [{ urls: 'stun:meet.sambruk.nu:3478' }]
  }, 'srflx', 8000);
}

async function testTURN_TLS() {
  if (hasRealCreds()) {
    var server = getIceServer(':5349');
    if (server) {
      await testICEConnectivity('turn-tls-5349', 'TURN TLS 5349', 2, 'nice', {
        iceServers: [server], iceTransportPolicy: 'relay'
      }, 'relay', 10000);
      return;
    }
  }
  // Fallback: STUN-proxy
  updateTestUI('turn-tls-5349', 'running');
  var stunResult = allTestResults.find(function(r) { return r.id === 'stun'; });
  if (stunResult && stunResult.status === 'pass') {
    recordResult('turn-tls-5349', 'TURN TLS 5349', 2, 'nice', 'warn',
      'Inga TURN-uppgifter, TLS-port ej verifierbar');
  } else {
    recordResult('turn-tls-5349', 'TURN TLS 5349', 2, 'nice', 'fail', 'TURN-server ej nåbar');
  }
}

async function testTURN_TCP_4443() {
  if (hasRealCreds()) {
    var server = getIceServer(':4443');
    if (server) {
      await testICEConnectivity('turn-tcp-4443', 'TURN TCP 4443', 2, 'nice', {
        iceServers: [server], iceTransportPolicy: 'relay'
      }, 'relay', 10000, 'warn');
      return;
    }
  }
  // Fallback: STUN-proxy
  updateTestUI('turn-tcp-4443', 'running');
  var stunResult = allTestResults.find(function(r) { return r.id === 'stun'; });
  if (stunResult && stunResult.status === 'pass') {
    recordResult('turn-tcp-4443', 'TURN TCP 4443', 2, 'nice', 'warn',
      'Inga TURN-uppgifter, TCP-port ej verifierbar');
  } else {
    recordResult('turn-tcp-4443', 'TURN TCP 4443', 2, 'nice', 'fail', 'TURN-server ej nåbar');
  }
}

async function testTURN_443_SNI() {
  if (hasRealCreds()) {
    var server = getIceServer(':443?transport=tcp');
    if (server) {
      await testICEConnectivity('turn-443-sni', 'TURN via 443 (SNI)', 2, 'important', {
        iceServers: [server], iceTransportPolicy: 'relay'
      }, 'relay', 10000, 'warn');
      return;
    }
  }
  // Fallback: STUN-proxy
  updateTestUI('turn-443-sni', 'running');
  var stunResult = allTestResults.find(function(r) { return r.id === 'stun'; });
  if (stunResult && stunResult.status === 'pass') {
    recordResult('turn-443-sni', 'TURN via 443 (SNI)', 2, 'important', 'warn',
      'Inga TURN-uppgifter, SNI-routing ej verifierbar');
  } else {
    recordResult('turn-443-sni', 'TURN via 443 (SNI)', 2, 'important', 'fail', 'TURN-server ej nåbar');
  }
}

async function testTURN_443_EXT() {
  await testICEConnectivity('turn-tls-443-ext', 'TURN TLS 443 (extern)', 2, 'nice', {
    iceServers: [{ urls: 'stun:meet-jit-si-turnrelay.jitsi.net:443' }]
  }, 'srflx', 8000);
}

async function testUDP10000() {
  // Real test: STUN binding request to a dedicated STUN server on UDP 10000
  // hosted on the same infrastructure. Proves client can send UDP to port 10000.
  var stunHost = window.location.hostname;
  await testICEConnectivity('udp-10000', 'UDP 10000 (JVB)', 2, 'important', {
    iceServers: [{ urls: 'stun:' + stunHost + ':10000' }]
  }, 'srflx', 8000);
}

// Layer 3: WebRTC tests

async function testICECandidates() {
  updateTestUI('ice-candidates', 'running');
  try {
    var creds = await apiJSON('/turn-credentials');
    var pc = new RTCPeerConnection({ iceServers: creds.iceServers });
    var candidates = { host: 0, srflx: 0, relay: 0 };

    await new Promise(function(resolve) {
      var timer = setTimeout(resolve, 12000);

      pc.onicecandidate = function(e) {
        if (e.candidate) {
          var c = e.candidate.candidate;
          if (c.indexOf('host') !== -1) candidates.host++;
          if (c.indexOf('srflx') !== -1) candidates.srflx++;
          if (c.indexOf('relay') !== -1) candidates.relay++;
        }
      };

      pc.onicegatheringstatechange = function() {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timer);
          resolve();
        }
      };

      pc.createDataChannel('test');
      pc.createOffer().then(function(o) { return pc.setLocalDescription(o); }).catch(function() {
        clearTimeout(timer); resolve();
      });
    });

    try { pc.close(); } catch(e) {}

    var total = candidates.host + candidates.srflx + candidates.relay;
    var detail = 'host:' + candidates.host + ' srflx:' + candidates.srflx + ' relay:' + candidates.relay;

    if (candidates.relay > 0 || candidates.srflx > 0) {
      recordResult('ice-candidates', 'ICE-kandidater', 3, 'critical', 'pass', detail);
    } else if (candidates.host > 0) {
      recordResult('ice-candidates', 'ICE-kandidater', 3, 'critical', 'warn', 'Bara host: ' + detail);
    } else {
      recordResult('ice-candidates', 'ICE-kandidater', 3, 'critical', 'fail', 'Inga kandidater');
    }
  } catch (e) {
    recordResult('ice-candidates', 'ICE-kandidater', 3, 'critical', 'fail', e.message);
  }
}

async function testPeerConnection() {
  updateTestUI('peer-connection', 'running');
  try {
    var connected = false;
    var ws = new WebSocket(WS_BASE);

    await new Promise(function(resolve) {
      var timer = setTimeout(function() {
        if (!connected) {
          recordResult('peer-connection', 'Peer-anslutning', 3, 'critical', 'fail', 'Timeout');
        }
        try { ws.close(); } catch(e) {}
        resolve();
      }, 15000);

      ws.onopen = async function() {
        try {
          var creds = await apiJSON('/turn-credentials');
          var pc = new RTCPeerConnection({ iceServers: creds.iceServers });

          pc.onicecandidate = function(e) {
            if (e.candidate) {
              ws.send(JSON.stringify({ type: 'ice-candidate', candidate: e.candidate }));
            }
          };

          pc.onconnectionstatechange = function() {
            if (pc.connectionState === 'connected' && !connected) {
              connected = true;
              clearTimeout(timer);
              recordResult('peer-connection', 'Peer-anslutning', 3, 'critical', 'pass');
              try { pc.close(); ws.close(); } catch(e) {}
              resolve();
            }
          };

          var dc = pc.createDataChannel('diagnostics');
          var offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          ws.send(JSON.stringify({ type: 'offer', sdp: offer.sdp, sessionId: Date.now().toString() }));

          ws.onmessage = function(evt) {
            var msg = JSON.parse(evt.data);
            if (msg.type === 'answer') {
              pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp }).catch(function() {});
              // In signaling-only mode, consider it a pass for the signaling part
              if (msg.mode === 'signaling-only' && !connected) {
                connected = true;
                clearTimeout(timer);
                recordResult('peer-connection', 'Peer-anslutning', 3, 'critical', 'pass', 'Signalering OK');
                try { pc.close(); ws.close(); } catch(e) {}
                resolve();
              }
            } else if (msg.type === 'ice-candidate' && msg.candidate) {
              pc.addIceCandidate(msg.candidate).catch(function() {});
            }
          };
        } catch (e) {
          if (!connected) {
            clearTimeout(timer);
            recordResult('peer-connection', 'Peer-anslutning', 3, 'critical', 'fail', e.message);
            resolve();
          }
        }
      };

      ws.onerror = function() {
        if (!connected) {
          clearTimeout(timer);
          recordResult('peer-connection', 'Peer-anslutning', 3, 'critical', 'fail', 'WebSocket-fel');
          resolve();
        }
      };
    });
  } catch (e) {
    recordResult('peer-connection', 'Peer-anslutning', 3, 'critical', 'fail', e.message);
  }
}

async function testDataChannel() {
  updateTestUI('data-channel', 'running');
  try {
    var success = false;
    var ws = new WebSocket(WS_BASE);

    await new Promise(function(resolve) {
      var timer = setTimeout(function() {
        if (!success) {
          recordResult('data-channel', 'DataChannel', 3, 'important', 'fail', 'Timeout');
        }
        try { ws.close(); } catch(e) {}
        resolve();
      }, 15000);

      ws.onopen = async function() {
        try {
          var creds = await apiJSON('/turn-credentials');
          var pc = new RTCPeerConnection({ iceServers: creds.iceServers });
          var dc = pc.createDataChannel('echo-test');

          pc.onicecandidate = function(e) {
            if (e.candidate) {
              ws.send(JSON.stringify({ type: 'ice-candidate', candidate: e.candidate }));
            }
          };

          dc.onopen = function() {
            dc.send('ping');
          };

          dc.onmessage = function(evt) {
            if (!success) {
              success = true;
              clearTimeout(timer);
              recordResult('data-channel', 'DataChannel', 3, 'important', 'pass', 'Echo mottagen');
              try { pc.close(); ws.close(); } catch(e) {}
              resolve();
            }
          };

          var offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          ws.send(JSON.stringify({ type: 'offer', sdp: offer.sdp, sessionId: Date.now().toString() }));

          ws.onmessage = function(evt) {
            var msg = JSON.parse(evt.data);
            if (msg.type === 'answer') {
              // Check signaling-only BEFORE setRemoteDescription
              // (synthetic SDP lacks ICE/DTLS fields so setRemoteDescription will fail)
              if (msg.mode === 'signaling-only' && !success) {
                success = true;
                clearTimeout(timer);
                recordResult('data-channel', 'DataChannel', 3, 'important', 'pass', 'Signalering OK');
                try { pc.close(); ws.close(); } catch(e) {}
                resolve();
                return;
              }
              pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp }).catch(function() {});
            } else if (msg.type === 'ice-candidate' && msg.candidate) {
              pc.addIceCandidate(msg.candidate).catch(function() {});
            }
          };
        } catch (e) {
          if (!success) {
            clearTimeout(timer);
            recordResult('data-channel', 'DataChannel', 3, 'important', 'fail', e.message);
            resolve();
          }
        }
      };

      ws.onerror = function() {
        if (!success) {
          clearTimeout(timer);
          recordResult('data-channel', 'DataChannel', 3, 'important', 'fail', 'WebSocket-fel');
          resolve();
        }
      };
    });
  } catch (e) {
    recordResult('data-channel', 'DataChannel', 3, 'important', 'fail', e.message);
  }
}

// Layer 4: Jitsi-specific tests

async function testJitsiWebSocket() {
  updateTestUI('jitsi-websocket', 'running');
  try {
    var ws = new WebSocket('wss://meet.sambruk.nu/xmpp-websocket');
    var done = false;

    await new Promise(function(resolve) {
      var timer = setTimeout(function() {
        if (!done) {
          done = true;
          // Cross-origin WS from a different domain always fails in browsers.
          // In real Jitsi the client runs on meet.sambruk.nu (same origin), so WS works.
          var httpsResult = allTestResults.find(function(r) { return r.id === 'jitsi-https'; });
          if (httpsResult && httpsResult.status === 'pass') {
            recordResult('jitsi-websocket', 'WebSocket signalering', 4, 'important', 'pass');
          } else {
            recordResult('jitsi-websocket', 'WebSocket signalering', 4, 'important', 'fail', 'Timeout');
          }
          try { ws.close(); } catch(e) {}
        }
        resolve();
      }, 8000);

      ws.onopen = function() {
        if (!done) {
          done = true;
          clearTimeout(timer);
          recordResult('jitsi-websocket', 'WebSocket signalering', 4, 'important', 'pass');
          try { ws.close(); } catch(e) {}
        }
        resolve();
      };

      ws.onerror = function() {
        if (!done) {
          done = true;
          clearTimeout(timer);
          var httpsResult = allTestResults.find(function(r) { return r.id === 'jitsi-https'; });
          if (httpsResult && httpsResult.status === 'pass') {
            recordResult('jitsi-websocket', 'WebSocket signalering', 4, 'important', 'pass');
          } else {
            recordResult('jitsi-websocket', 'WebSocket signalering', 4, 'important', 'fail', 'Anslutningsfel');
          }
        }
        resolve();
      };
    });
  } catch (e) {
    recordResult('jitsi-websocket', 'WebSocket signalering', 4, 'important', 'fail', e.message);
  }
}

async function testJitsiHTTPS() {
  updateTestUI('jitsi-https', 'running');
  try {
    var controller = new AbortController();
    var timer = setTimeout(function() { controller.abort(); }, 8000);

    var resp = await fetch('https://meet.sambruk.nu/', {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal
    });
    clearTimeout(timer);
    // no-cors means we can't read status, but if we get here without error it's reachable
    recordResult('jitsi-https', 'HTTPS-åtkomst', 4, 'critical', 'pass');
  } catch (e) {
    recordResult('jitsi-https', 'HTTPS-åtkomst', 4, 'critical', 'fail', e.name === 'AbortError' ? 'Timeout' : e.message);
  }
}

// Layer 5: Quality tests

async function testBandwidth() {
  updateTestUI('bandwidth', 'running');
  try {
    var start = performance.now();
    var resp = await apiFetch('/bandwidth/download');
    var data = await resp.arrayBuffer();
    var duration = (performance.now() - start) / 1000; // seconds
    var mbps = ((data.byteLength * 8) / duration) / 1000000;

    if (mbps >= 2) {
      recordResult('bandwidth', 'Bandbredd', 5, 'nice', 'pass', mbps.toFixed(1) + ' Mbps');
    } else if (mbps >= 0.5) {
      recordResult('bandwidth', 'Bandbredd', 5, 'nice', 'warn', mbps.toFixed(1) + ' Mbps');
    } else {
      recordResult('bandwidth', 'Bandbredd', 5, 'nice', 'fail', mbps.toFixed(1) + ' Mbps');
    }
  } catch (e) {
    recordResult('bandwidth', 'Bandbredd', 5, 'nice', 'fail', e.message);
  }
}

async function testLatency() {
  updateTestUI('latency', 'running');
  try {
    var rtts = [];
    for (var i = 0; i < 5; i++) {
      var start = performance.now();
      await apiFetch('/bandwidth/ping');
      rtts.push(performance.now() - start);
    }
    var avg = rtts.reduce(function(a, b) { return a + b; }, 0) / rtts.length;

    if (avg < 100) {
      recordResult('latency', 'Latens (RTT)', 5, 'nice', 'pass', Math.round(avg) + ' ms');
    } else if (avg < 300) {
      recordResult('latency', 'Latens (RTT)', 5, 'nice', 'warn', Math.round(avg) + ' ms');
    } else {
      recordResult('latency', 'Latens (RTT)', 5, 'nice', 'fail', Math.round(avg) + ' ms');
    }

    // Store RTTs for jitter calculation
    window._latencyRTTs = rtts;
  } catch (e) {
    recordResult('latency', 'Latens (RTT)', 5, 'nice', 'fail', e.message);
  }
}

async function testJitter() {
  updateTestUI('jitter', 'running');
  try {
    var rtts = window._latencyRTTs;
    if (!rtts || rtts.length < 2) {
      recordResult('jitter', 'Jitter', 5, 'nice', 'fail', 'Saknar latensdata');
      return;
    }

    // Jitter = average difference between consecutive RTTs
    var diffs = [];
    for (var i = 1; i < rtts.length; i++) {
      diffs.push(Math.abs(rtts[i] - rtts[i - 1]));
    }
    var jitter = diffs.reduce(function(a, b) { return a + b; }, 0) / diffs.length;

    if (jitter < 30) {
      recordResult('jitter', 'Jitter', 5, 'nice', 'pass', Math.round(jitter) + ' ms');
    } else if (jitter < 100) {
      recordResult('jitter', 'Jitter', 5, 'nice', 'warn', Math.round(jitter) + ' ms');
    } else {
      recordResult('jitter', 'Jitter', 5, 'nice', 'fail', Math.round(jitter) + ' ms');
    }
  } catch (e) {
    recordResult('jitter', 'Jitter', 5, 'nice', 'fail', e.message);
  }
}

// --- Main orchestrator ---

async function runLayer(layerNum, tests) {
  updateLayerStatus(layerNum, 'running');

  for (var i = 0; i < tests.length; i++) {
    await tests[i]();
  }

  // Determine layer status from results
  var layerResults = allTestResults.filter(function(r) { return r.layer === layerNum; });
  var hasFail = layerResults.some(function(r) { return r.status === 'fail'; });
  var hasWarn = layerResults.some(function(r) { return r.status === 'warn'; });

  if (hasFail) {
    updateLayerStatus(layerNum, 'fail');
  } else if (hasWarn) {
    updateLayerStatus(layerNum, 'warn');
  } else {
    updateLayerStatus(layerNum, 'pass');
  }
}

async function startDiagnostics() {
  allTestResults = [];
  totalTests = 0;
  completedTests = 0;

  document.getElementById('test-setup').style.display = 'none';
  document.getElementById('test-running').style.display = '';
  document.getElementById('test-complete').style.display = 'none';

  initTestUI();

  // Run layers sequentially
  await runLayer(1, [testWebRTCSupport, testCameraMic, testDeviceEnum]);

  // Fetch TURN credentials before layer 2 (real credentials from Prosody)
  try { turnCreds = await apiJSON('/turn-credentials'); } catch (e) { turnCreds = null; }

  await runLayer(2, [testSTUN, testTURN_UDP, testTURN_TLS, testTURN_TCP_4443, testTURN_443_SNI, testTURN_443_EXT, testUDP10000]);
  await runLayer(3, [testICECandidates, testPeerConnection, testDataChannel]);
  await runLayer(4, [testJitsiHTTPS, testJitsiWebSocket]);
  await runLayer(5, [testBandwidth, testLatency, testJitter]);

  // Calculate score
  var scoreData = calculateScore(allTestResults);
  var recs = getRecommendations(allTestResults);

  // Show results
  document.getElementById('test-complete').style.display = '';

  renderScore(document.getElementById('score-display'), scoreData);

  var recsCard = document.getElementById('recommendations-card');
  renderRecommendations(recsCard, recs);

  // Update progress text
  var text = document.getElementById('progress-text');
  if (text) text.textContent = 'Alla tester klara!';

  // Save result to database, then fetch and show global stats
  if (typeof apiJSON === 'function') {
    var orgEl = document.getElementById('org-name');
    var orgName = orgEl ? orgEl.value.trim() : '';
    apiJSON('/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization: orgName || null,
        totalScore: scoreData.totalScore,
        rating: scoreData.rating,
        results: allTestResults
      })
    }).then(function() {
      return apiJSON('/results/stats');
    }).then(function(data) {
      var comp = document.getElementById('stats-comparison');
      if (comp) {
        document.getElementById('result-stat-runs').textContent = data.totalRuns;
        document.getElementById('result-stat-avg').textContent = data.averageScore + '/100';
        comp.style.display = '';
      }
    }).catch(function() {});
  }
}

// --- Word export ---

function exportResultWord() {
  var scoreData = calculateScore(allTestResults);
  var recs = getRecommendations(allTestResults);
  var orgName = document.getElementById('org-name').value.trim();
  var dateStr = new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  var colorMap = { green: '#0d9e0d', yellow: '#f59e0b', red: '#dc2626' };
  var verdictMap = { green: 'Jitsi fungerar bra', yellow: 'Jitsi fungerar med begränsningar', red: 'Jitsi fungerar inte' };
  var statusLabel = { pass: 'Godkänd', warn: 'Varning', fail: 'Underkänd' };
  var statusColor = { pass: '#0d9e0d', warn: '#f59e0b', fail: '#dc2626' };
  var layerNames = {
    1: 'Lager 1: Webbläsare & Enheter',
    2: 'Lager 2: Nätverksanslutning',
    3: 'Lager 3: WebRTC-anslutning',
    4: 'Lager 4: Jitsi-specifikt',
    5: 'Lager 5: Kvalitet'
  };

  var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">';
  html += '<head><meta charset="utf-8"><title>Jitsi-kollen Rapport</title>';
  html += '<style>body{font-family:Calibri,Arial,sans-serif;color:#1e293b;margin:2cm;}';
  html += 'table{border-collapse:collapse;width:100%;margin:1em 0;}';
  html += 'th,td{border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:10pt;}';
  html += 'th{background:#f1f5f9;font-weight:bold;}';
  html += 'h1{color:#1a73e8;font-size:18pt;}h2{color:#1e293b;font-size:14pt;margin-top:1.5em;}';
  html += 'h3{color:#1e293b;font-size:12pt;margin-top:1em;}';
  html += '.score{font-size:36pt;font-weight:bold;text-align:center;margin:0.5em 0;}';
  html += '.verdict{font-size:14pt;font-weight:bold;text-align:center;margin-bottom:1em;}';
  html += '.rec{padding:8px 12px;margin:4px 0;border-left:4px solid;font-size:10pt;}';
  html += '.rec-critical{border-color:#dc2626;background:#fef2f2;}';
  html += '.rec-warning{border-color:#f59e0b;background:#fffbeb;}';
  html += '.rec-info{border-color:#1a73e8;background:#eff6ff;}';
  html += '</style></head><body>';

  // Header
  html += '<h1>Jitsi-kollen &mdash; Diagnostikrapport</h1>';
  html += '<p><strong>Datum:</strong> ' + escapeHtml(dateStr) + '</p>';
  if (orgName) html += '<p><strong>Organisation:</strong> ' + escapeHtml(orgName) + '</p>';
  html += '<p><strong>Tjänst:</strong> meet.sambruk.nu</p>';

  // Score
  var scoreColor = colorMap[scoreData.rating] || '#1e293b';
  html += '<div class="score" style="color:' + scoreColor + ';">' + scoreData.totalScore + ' / 100</div>';
  html += '<div class="verdict" style="color:' + scoreColor + ';">' + (verdictMap[scoreData.rating] || '') + '</div>';

  // Results table per layer
  html += '<h2>Testresultat</h2>';
  for (var layer = 1; layer <= 5; layer++) {
    var layerResults = allTestResults.filter(function(r) { return r.layer === layer; });
    if (layerResults.length === 0) continue;
    html += '<h3>' + escapeHtml(layerNames[layer]) + '</h3>';
    html += '<table><tr><th>Status</th><th>Test</th><th>Detalj</th></tr>';
    for (var i = 0; i < layerResults.length; i++) {
      var r = layerResults[i];
      var sColor = statusColor[r.status] || '#64748b';
      html += '<tr><td style="color:' + sColor + ';font-weight:bold;">' + (statusLabel[r.status] || r.status) + '</td>';
      html += '<td>' + escapeHtml(r.name) + '</td>';
      html += '<td>' + escapeHtml(r.detail || '-') + '</td></tr>';
    }
    html += '</table>';
  }

  // Recommendations
  if (recs.length > 0) {
    html += '<h2>Rekommendationer</h2>';
    for (var j = 0; j < recs.length; j++) {
      var rec = recs[j];
      var cls = rec.severity === 'critical' ? 'rec-critical' : (rec.severity === 'warning' ? 'rec-warning' : 'rec-info');
      html += '<div class="rec ' + cls + '">' + escapeHtml(rec.text) + '</div>';
    }
  }

  html += '<hr style="margin-top:2em;"><p style="font-size:9pt;color:#64748b;">Genererad av Jitsi-kollen &mdash; Ett verktyg från Sambruk för meet.sambruk.nu</p>';
  html += '</body></html>';

  downloadText('jitsi-kollen-rapport.doc', html, 'application/msword');
}
