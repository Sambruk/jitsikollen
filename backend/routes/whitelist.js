const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const whitelistPath = path.join(__dirname, '..', 'data', 'whitelist.json');

function loadWhitelist() {
  return JSON.parse(fs.readFileSync(whitelistPath, 'utf-8'));
}

// Get servers for requested platform(s)
function getServers(data, platform) {
  if (platform === 'nextcloud') {
    return data.nextcloud ? data.nextcloud.servers : {};
  }
  if (platform === 'both') {
    // Merge both platforms' servers
    const merged = {};
    if (data.jitsi && data.jitsi.servers) {
      for (const [cat, entries] of Object.entries(data.jitsi.servers)) {
        merged[cat] = (merged[cat] || []).concat(entries);
      }
    }
    if (data.nextcloud && data.nextcloud.servers) {
      for (const [cat, entries] of Object.entries(data.nextcloud.servers)) {
        merged[cat] = (merged[cat] || []).concat(entries);
      }
    }
    return merged;
  }
  // Default: jitsi
  return data.jitsi ? data.jitsi.servers : {};
}

// Full whitelist as JSON
router.get('/', (req, res) => {
  const data = loadWhitelist();
  const platform = req.query.platform || 'jitsi';
  res.json({
    version: data.version,
    lastUpdated: data.lastUpdated,
    platform: platform,
    servers: getServers(data, platform)
  });
});

// Just IPs and FQDNs as plaintext
router.get('/ips', (req, res) => {
  const data = loadWhitelist();
  const platform = req.query.platform || 'jitsi';
  const servers = getServers(data, platform);
  const entries = new Set();

  Object.values(servers).forEach(category => {
    category.forEach(entry => {
      if (entry.fqdn) entries.add(entry.fqdn);
      if (entry.ip) entries.add(entry.ip);
    });
  });

  res.type('text/plain').send([...entries].join('\n'));
});

// CSV format
router.get('/csv', (req, res) => {
  const data = loadWhitelist();
  const platform = req.query.platform || 'jitsi';
  const servers = getServers(data, platform);
  const lines = ['Kategori,Tjänst,FQDN/IP,Port,Protokoll,Obligatorisk,Anteckning'];

  Object.entries(servers).forEach(([category, entries]) => {
    entries.forEach(entry => {
      const host = entry.fqdn || entry.ip || '';
      entry.ports.forEach(port => {
        lines.push(`${category},${entry.description || ''},${host},${port},${entry.protocol},${entry.required ? 'Ja' : 'Nej'},${entry.note || ''}`);
      });
    });
  });

  const filename = platform === 'both' ? 'videomotes-whitelist.csv' : (platform + '-whitelist.csv');
  res.type('text/csv')
    .set('Content-Disposition', `attachment; filename="${filename}"`)
    .send(lines.join('\n'));
});

// Generic firewall rules
router.get('/firewall/generic', (req, res) => {
  const data = loadWhitelist();
  const platform = req.query.platform || 'jitsi';
  const servers = getServers(data, platform);
  const platformLabel = platform === 'both' ? 'Jitsi + Nextcloud Talk' : (platform === 'nextcloud' ? 'Nextcloud Talk (samverka.sambruk.se)' : 'Jitsi (meet.sambruk.nu)');
  const rules = [`# Brandväggsregler för ${platformLabel}`, `# Genererat: ${new Date().toISOString()}`, ''];

  Object.entries(servers).forEach(([category, entries]) => {
    rules.push(`# --- ${category.toUpperCase()} ---`);
    entries.forEach(entry => {
      const host = entry.fqdn || entry.ip;
      const req_str = entry.required ? 'OBLIGATORISK' : 'VALFRI';
      entry.ports.forEach(port => {
        const protos = entry.protocol.split('/');
        protos.forEach(proto => {
          rules.push(`ALLOW OUT ${proto.trim()} to ${host} port ${port}  # ${req_str} - ${entry.description || ''}`);
        });
      });
    });
    rules.push('');
  });

  res.type('text/plain').send(rules.join('\n'));
});

// Palo Alto format
router.get('/firewall/paloalto', (req, res) => {
  const data = loadWhitelist();
  const platform = req.query.platform || 'jitsi';
  const servers = getServers(data, platform);
  const platformLabel = platform === 'both' ? 'Jitsi + Nextcloud Talk' : (platform === 'nextcloud' ? 'Nextcloud Talk' : 'Jitsi');
  const rules = [
    `# Palo Alto Firewall Rules - ${platformLabel}`,
    `# Genererat: ${new Date().toISOString()}`,
    '',
    '# Address Objects'
  ];

  const prefix = platform === 'nextcloud' ? 'nc' : (platform === 'both' ? 'sambruk' : 'jitsi');
  const addresses = new Set();
  Object.values(servers).forEach(category => {
    category.forEach(entry => {
      const host = entry.fqdn || entry.ip;
      if (!addresses.has(host)) {
        addresses.add(host);
        if (entry.fqdn) {
          rules.push(`set address ${entry.fqdn.replace(/\./g, '_')} fqdn ${entry.fqdn}`);
        } else {
          rules.push(`set address ${prefix}_ip_${entry.ip.replace(/\./g, '_')} ip-netmask ${entry.ip}/32`);
        }
      }
    });
  });

  rules.push('', '# Address Group');
  rules.push(`set address-group ${prefix}-servers static [ ` + [...addresses].map(a => a.replace(/\./g, '_')).join(' ') + ' ]');

  rules.push('', '# Service Objects');
  const services = new Set();
  Object.values(servers).forEach(category => {
    category.forEach(entry => {
      entry.ports.forEach(port => {
        const protos = entry.protocol.split('/');
        protos.forEach(proto => {
          const p = proto.trim().toLowerCase().replace('tls', 'tcp');
          const svcName = `${prefix}_${p}_${port}`;
          if (!services.has(svcName)) {
            services.add(svcName);
            rules.push(`set service ${svcName} protocol ${p} port ${port}`);
          }
        });
      });
    });
  });

  rules.push('', '# Security Policy');
  rules.push(`set rulebase security rules ${prefix}-allow from trust to untrust source any destination ${prefix}-servers application any service [ ` + [...services].join(' ') + ' ] action allow');

  res.type('text/plain').send(rules.join('\n'));
});

// FortiGate format
router.get('/firewall/fortinet', (req, res) => {
  const data = loadWhitelist();
  const platform = req.query.platform || 'jitsi';
  const servers = getServers(data, platform);
  const platformLabel = platform === 'both' ? 'Jitsi + Nextcloud Talk' : (platform === 'nextcloud' ? 'Nextcloud Talk' : 'Jitsi');
  const prefix = platform === 'nextcloud' ? 'nc' : (platform === 'both' ? 'sambruk' : 'jitsi');
  const rules = [
    `# FortiGate Firewall Rules - ${platformLabel}`,
    `# Genererat: ${new Date().toISOString()}`,
    ''
  ];

  rules.push('config firewall address');
  const addresses = new Set();
  Object.values(servers).forEach(category => {
    category.forEach(entry => {
      const host = entry.fqdn || entry.ip;
      if (!addresses.has(host)) {
        addresses.add(host);
        const name = prefix + '_' + host.replace(/\./g, '_');
        rules.push(`  edit "${name}"`);
        if (entry.fqdn) {
          rules.push(`    set type fqdn`);
          rules.push(`    set fqdn "${entry.fqdn}"`);
        } else {
          rules.push(`    set type ipmask`);
          rules.push(`    set subnet ${entry.ip}/32`);
        }
        rules.push('  next');
      }
    });
  });
  rules.push('end');

  rules.push('', 'config firewall addrgrp');
  rules.push(`  edit "${prefix}-servers"`);
  rules.push('    set member ' + [...addresses].map(a => `"${prefix}_` + a.replace(/\./g, '_') + '"').join(' '));
  rules.push('  next');
  rules.push('end');

  rules.push('', 'config firewall service custom');
  const services = new Set();
  Object.values(servers).forEach(category => {
    category.forEach(entry => {
      entry.ports.forEach(port => {
        const protos = entry.protocol.split('/');
        protos.forEach(proto => {
          const p = proto.trim().toUpperCase().replace('TLS', 'TCP');
          const svcName = `${prefix}_${p}_${port}`;
          if (!services.has(svcName)) {
            services.add(svcName);
            rules.push(`  edit "${svcName}"`);
            rules.push(`    set ${p.toLowerCase()}-portrange ${port}`);
            rules.push('  next');
          }
        });
      });
    });
  });
  rules.push('end');

  rules.push('', 'config firewall policy');
  rules.push('  edit 0');
  rules.push(`    set name "allow-${prefix}"`);
  rules.push('    set srcintf "internal"');
  rules.push('    set dstintf "wan1"');
  rules.push('    set srcaddr "all"');
  rules.push(`    set dstaddr "${prefix}-servers"`);
  rules.push('    set service ' + [...services].map(s => `"${s}"`).join(' '));
  rules.push('    set action accept');
  rules.push('    set schedule "always"');
  rules.push('  next');
  rules.push('end');

  res.type('text/plain').send(rules.join('\n'));
});

module.exports = router;
