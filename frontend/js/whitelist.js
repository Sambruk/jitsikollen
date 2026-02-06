// Whitelist page logic

var whitelistData = null;

(function() {
  loadWhitelist();
})();

async function loadWhitelist() {
  try {
    whitelistData = await apiJSON('/whitelist');
    renderWhitelist();
  } catch (e) {
    var tables = ['wl-signaling', 'wl-media', 'wl-turn', 'wl-external_stun'];
    for (var i = 0; i < tables.length; i++) {
      var el = document.getElementById(tables[i]);
      if (el) el.innerHTML = '<tr><td colspan="5" style="color:var(--danger);">Kunde inte ladda vitlistan: ' + escapeHtml(e.message) + '</td></tr>';
    }
  }
}

function renderWhitelist() {
  var categories = ['signaling', 'media', 'turn', 'external_stun'];

  for (var i = 0; i < categories.length; i++) {
    var cat = categories[i];
    var tbody = document.getElementById('wl-' + cat);
    if (!tbody || !whitelistData.servers[cat]) continue;

    var html = '';
    var entries = whitelistData.servers[cat];
    for (var j = 0; j < entries.length; j++) {
      var entry = entries[j];
      var host = entry.fqdn || entry.ip || '-';
      for (var k = 0; k < entry.ports.length; k++) {
        html += '<tr>' +
          '<td><code>' + escapeHtml(host) + '</code></td>' +
          '<td><strong>' + entry.ports[k] + '</strong></td>' +
          '<td>' + escapeHtml(entry.protocol) + '</td>' +
          '<td>' + (entry.required ?
            '<span class="tag tag-required">Obligatorisk</span>' :
            '<span class="tag tag-optional">Valfri</span>') + '</td>' +
          '<td>' + escapeHtml(entry.description || entry.note || '') + '</td>' +
          '</tr>';
      }
    }
    tbody.innerHTML = html;
  }
}

async function downloadJSON() {
  try {
    var data = await apiJSON('/whitelist');
    downloadText('jitsi-whitelist.json', JSON.stringify(data, null, 2), 'application/json');
    showToast('JSON nedladdad');
  } catch (e) {
    showToast('Fel: ' + e.message);
  }
}

async function downloadCSV() {
  try {
    var resp = await apiFetch('/whitelist/csv');
    var text = await resp.text();
    downloadText('jitsi-whitelist.csv', text, 'text/csv');
    showToast('CSV nedladdad');
  } catch (e) {
    showToast('Fel: ' + e.message);
  }
}

async function copyIPs() {
  try {
    var resp = await apiFetch('/whitelist/ips');
    var text = await resp.text();
    copyToClipboard(text);
  } catch (e) {
    showToast('Fel: ' + e.message);
  }
}

async function loadFirewallRules(format) {
  var output = document.getElementById('firewall-output');
  if (!format) {
    output.style.display = 'none';
    return;
  }

  try {
    var resp = await apiFetch('/whitelist/firewall/' + format);
    var text = await resp.text();

    var titles = { generic: 'Generiska brandväggsregler', paloalto: 'Palo Alto-regler', fortinet: 'FortiGate-regler' };
    document.getElementById('firewall-title').textContent = titles[format] || format;
    document.getElementById('firewall-code').textContent = text;
    output.style.display = '';
  } catch (e) {
    showToast('Fel: ' + e.message);
  }
}

function copyFirewallRules() {
  var code = document.getElementById('firewall-code');
  if (code) {
    copyToClipboard(code.textContent);
  }
}

function exportWhitelistWord() {
  if (!whitelistData) {
    showToast('Vitlistan har inte laddats ännu');
    return;
  }

  var dateStr = new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' });
  var categories = ['signaling', 'media', 'turn', 'external_stun'];
  var catNames = { signaling: 'Signalering', media: 'Media (JVB)', turn: 'TURN/STUN', external_stun: 'Extern STUN' };

  var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">';
  html += '<head><meta charset="utf-8"><title>Vitlistning för Jitsi-videomöten</title>';
  html += '<style>body{font-family:Calibri,Arial,sans-serif;color:#1e293b;margin:2cm;}';
  html += 'table{border-collapse:collapse;width:100%;margin:1em 0;}';
  html += 'th,td{border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:10pt;}';
  html += 'th{background:#f1f5f9;font-weight:bold;}';
  html += 'h1{color:#1a73e8;font-size:18pt;}h2{color:#1e293b;font-size:14pt;margin-top:1.5em;}';
  html += 'h3{color:#1e293b;font-size:12pt;margin-top:1em;}';
  html += '.required{color:#166534;font-weight:bold;}.optional{color:#64748b;}';
  html += '.highlight{background:#dcfce7;}</style></head><body>';

  // Title & intro
  html += '<h1>Vitlistning för Jitsi-videomöten</h1>';
  html += '<p><strong>Tjänst:</strong> meet.sambruk.nu (Sambruk)</p>';
  html += '<p><strong>Datum:</strong> ' + escapeHtml(dateStr) + '</p>';
  html += '<p style="margin-top:1em;">Detta dokument innehåller de adresser och portar som behöver vara öppna i er brandvägg ';
  html += 'för att Jitsi-videomöten via <strong>meet.sambruk.nu</strong> ska fungera korrekt. ';
  html += 'Listan är uppdelad i obligatoriska poster (som måste öppnas) och valfria poster ';
  html += '(som ger bättre kvalitet och reservvägar).</p>';

  // Full table per category
  for (var i = 0; i < categories.length; i++) {
    var cat = categories[i];
    var entries = whitelistData.servers[cat];
    if (!entries || entries.length === 0) continue;

    html += '<h2>' + escapeHtml(catNames[cat]) + '</h2>';
    html += '<table><tr><th>FQDN/IP</th><th>Port</th><th>Protokoll</th><th>Obligatorisk/Valfri</th><th>Beskrivning</th></tr>';

    for (var j = 0; j < entries.length; j++) {
      var entry = entries[j];
      var host = entry.fqdn || entry.ip || '-';
      for (var k = 0; k < entry.ports.length; k++) {
        var rowClass = entry.required ? ' class="highlight"' : '';
        html += '<tr' + rowClass + '>';
        html += '<td><code>' + escapeHtml(host) + '</code></td>';
        html += '<td><strong>' + entry.ports[k] + '</strong></td>';
        html += '<td>' + escapeHtml(entry.protocol) + '</td>';
        html += '<td>' + (entry.required ? '<span class="required">Obligatorisk</span>' : '<span class="optional">Valfri</span>') + '</td>';
        html += '<td>' + escapeHtml(entry.description || entry.note || '') + '</td>';
        html += '</tr>';
      }
    }
    html += '</table>';
  }

  // Minimum requirements
  html += '<h2>Minimikrav</h2>';
  html += '<p>Om det inte är möjligt att öppna alla poster ovan, se till att åtminstone följande är öppna:</p>';
  html += '<table><tr><th>Destination</th><th>Port</th><th>Protokoll</th><th>Syfte</th></tr>';
  html += '<tr class="highlight"><td><code>meet.sambruk.nu</code></td><td><strong>443</strong></td><td>TCP (HTTPS/WSS)</td><td>Webbsida, signalering och TURN-fallback</td></tr>';
  html += '<tr class="highlight"><td><code>142.132.237.134</code></td><td><strong>10000</strong></td><td>UDP</td><td>Media (ljud/video) via Jitsi Videobridge</td></tr>';
  html += '<tr class="highlight"><td><code>meet.sambruk.nu</code></td><td><strong>3478</strong></td><td>UDP/TCP</td><td>STUN/TURN för NAT-traversering</td></tr>';
  html += '</table>';

  // Generic firewall rules
  html += '<h2>Generiska brandväggsregler</h2>';
  html += '<p>Nedan följer exempel på regler i generiskt format. Anpassa efter ert brandväggssystem.</p>';
  html += '<pre style="background:#f1f5f9;padding:12px;border:1px solid #ddd;font-size:9pt;font-family:Consolas,monospace;">';
  html += '# Obligatoriskt: HTTPS och signalering\n';
  html += 'ALLOW TCP dst meet.sambruk.nu port 443\n\n';
  html += '# Obligatoriskt: Media (JVB)\n';
  html += 'ALLOW UDP dst 142.132.237.134 port 10000\n\n';
  html += '# Rekommenderat: STUN/TURN\n';
  html += 'ALLOW UDP dst meet.sambruk.nu port 3478\n';
  html += 'ALLOW TCP dst meet.sambruk.nu port 3478\n';
  html += 'ALLOW TCP dst meet.sambruk.nu port 5349\n';
  html += '</pre>';

  html += '<hr style="margin-top:2em;"><p style="font-size:9pt;color:#64748b;">Genererad av Jitsi-kollen &mdash; Ett verktyg från Sambruk för meet.sambruk.nu<br>';
  html += 'Kör diagnostik och se mer info: <a href="https://app.sambruk.se/jitsi-test/">app.sambruk.se/jitsi-test/</a></p>';
  html += '</body></html>';

  downloadText('vitlistning-jitsi-meet-sambruk.doc', html, 'application/msword');
}
