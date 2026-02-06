// Shared utilities for Jitsi Diagnostik-Hub

const API_BASE = (function() {
  const loc = window.location;
  // If accessed via /jitsi-test/ path, API is at /jitsi-test/api
  if (loc.pathname.startsWith('/jitsi-test/')) {
    return loc.origin + '/jitsi-test/api';
  }
  // If accessed via dedicated port (9443), API is at /api
  return loc.origin + '/api';
})();

const WS_BASE = (function() {
  const loc = window.location;
  const wsProto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  if (loc.pathname.startsWith('/jitsi-test/')) {
    return wsProto + '//' + loc.host + '/jitsi-test/ws';
  }
  return wsProto + '//' + loc.host + '/ws';
})();

async function apiFetch(path, options) {
  const url = API_BASE + path;
  const resp = await fetch(url, options);
  if (!resp.ok) throw new Error('API error: ' + resp.status);
  return resp;
}

async function apiJSON(path, options) {
  const resp = await apiFetch(path, options);
  return resp.json();
}

function showToast(message, duration) {
  duration = duration || 3000;
  var toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(function() { toast.classList.remove('show'); }, duration);
}

function formatDate(dateStr) {
  var d = new Date(dateStr);
  return d.toLocaleDateString('sv-SE', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function downloadText(filename, content, mimeType) {
  mimeType = mimeType || 'text/plain';
  var blob = new Blob([content], { type: mimeType });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() {
      showToast('Kopierat till urklipp!');
    });
  } else {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Kopierat till urklipp!');
  }
}
