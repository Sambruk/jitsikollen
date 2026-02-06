const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const whitelistPath = path.join(__dirname, '..', 'data', 'whitelist.json');

function loadWhitelist() {
  return JSON.parse(fs.readFileSync(whitelistPath, 'utf-8'));
}

// Full whitelist as JSON
router.get('/', (req, res) => {
  res.json(loadWhitelist());
});

// Just IPs and FQDNs as plaintext
router.get('/ips', (req, res) => {
  const data = loadWhitelist();
  const entries = new Set();

  Object.values(data.servers).forEach(category => {
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
  const lines = ['Kategori,Tjänst,FQDN/IP,Port,Protokoll,Obligatorisk,Anteckning'];

  Object.entries(data.servers).forEach(([category, entries]) => {
    entries.forEach(entry => {
      const host = entry.fqdn || entry.ip || '';
      entry.ports.forEach(port => {
        lines.push(`${category},${entry.description || ''},${host},${port},${entry.protocol},${entry.required ? 'Ja' : 'Nej'},${entry.note || ''}`);
      });
    });
  });

  res.type('text/csv')
    .set('Content-Disposition', 'attachment; filename="jitsi-whitelist.csv"')
    .send(lines.join('\n'));
});

// Generic firewall rules
router.get('/firewall/generic', (req, res) => {
  const data = loadWhitelist();
  const rules = ['# Brandväggsregler för Jitsi (meet.sambruk.nu)', `# Genererat: ${new Date().toISOString()}`, ''];

  Object.entries(data.servers).forEach(([category, entries]) => {
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
  const rules = [
    '# Palo Alto Firewall Rules - Jitsi (meet.sambruk.nu)',
    `# Genererat: ${new Date().toISOString()}`,
    '',
    '# Address Objects'
  ];

  const addresses = new Set();
  Object.values(data.servers).forEach(category => {
    category.forEach(entry => {
      const host = entry.fqdn || entry.ip;
      if (!addresses.has(host)) {
        addresses.add(host);
        if (entry.fqdn) {
          rules.push(`set address ${entry.fqdn.replace(/\./g, '_')} fqdn ${entry.fqdn}`);
        } else {
          rules.push(`set address jitsi_ip_${entry.ip.replace(/\./g, '_')} ip-netmask ${entry.ip}/32`);
        }
      }
    });
  });

  rules.push('', '# Address Group');
  rules.push('set address-group jitsi-servers static [ ' + [...addresses].map(a => a.replace(/\./g, '_')).join(' ') + ' ]');

  rules.push('', '# Service Objects');
  const services = new Set();
  Object.values(data.servers).forEach(category => {
    category.forEach(entry => {
      entry.ports.forEach(port => {
        const protos = entry.protocol.split('/');
        protos.forEach(proto => {
          const p = proto.trim().toLowerCase().replace('tls', 'tcp');
          const svcName = `jitsi_${p}_${port}`;
          if (!services.has(svcName)) {
            services.add(svcName);
            rules.push(`set service ${svcName} protocol ${p} port ${port}`);
          }
        });
      });
    });
  });

  rules.push('', '# Security Policy');
  rules.push('set rulebase security rules jitsi-allow from trust to untrust source any destination jitsi-servers application any service [ ' + [...services].join(' ') + ' ] action allow');

  res.type('text/plain').send(rules.join('\n'));
});

// FortiGate format
router.get('/firewall/fortinet', (req, res) => {
  const data = loadWhitelist();
  const rules = [
    '# FortiGate Firewall Rules - Jitsi (meet.sambruk.nu)',
    `# Genererat: ${new Date().toISOString()}`,
    ''
  ];

  rules.push('config firewall address');
  const addresses = new Set();
  Object.values(data.servers).forEach(category => {
    category.forEach(entry => {
      const host = entry.fqdn || entry.ip;
      if (!addresses.has(host)) {
        addresses.add(host);
        const name = 'jitsi_' + host.replace(/\./g, '_');
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
  rules.push('  edit "jitsi-servers"');
  rules.push('    set member ' + [...addresses].map(a => '"jitsi_' + a.replace(/\./g, '_') + '"').join(' '));
  rules.push('  next');
  rules.push('end');

  rules.push('', 'config firewall service custom');
  const services = new Set();
  Object.values(data.servers).forEach(category => {
    category.forEach(entry => {
      entry.ports.forEach(port => {
        const protos = entry.protocol.split('/');
        protos.forEach(proto => {
          const p = proto.trim().toUpperCase().replace('TLS', 'TCP');
          const svcName = `jitsi_${p}_${port}`;
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
  rules.push('    set name "allow-jitsi"');
  rules.push('    set srcintf "internal"');
  rules.push('    set dstintf "wan1"');
  rules.push('    set srcaddr "all"');
  rules.push('    set dstaddr "jitsi-servers"');
  rules.push('    set service ' + [...services].map(s => `"${s}"`).join(' '));
  rules.push('    set action accept');
  rules.push('    set schedule "always"');
  rules.push('  next');
  rules.push('end');

  res.type('text/plain').send(rules.join('\n'));
});

module.exports = router;
