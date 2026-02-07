const express = require('express');
const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'jitsi-diagnostics',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// IP reflection - tells client their public IP
router.get('/ip', (req, res) => {
  const ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  res.json({ ip });
});

// TURN credentials (fetched from Prosody via BOSH/XEP-0215)
router.get('/turn-credentials', async (req, res) => {
  const turnHost = process.env.TURN_HOST || 'meet.sambruk.nu';
  const turnPort = process.env.TURN_PORT || '3478';
  const turnsPort = process.env.TURNS_PORT || '5349';

  try {
    const turnService = require('../services/turn-credentials');
    const creds = await turnService.getTurnCredentials();

    if (creds) {
      return res.json({
        iceServers: [
          { urls: `stun:${turnHost}:${turnPort}` },
          { urls: `turn:${turnHost}:${turnPort}?transport=udp`, username: creds.username, credential: creds.password },
          { urls: `turn:${turnHost}:${turnPort}?transport=tcp`, username: creds.username, credential: creds.password },
          { urls: `turns:${turnHost}:${turnsPort}?transport=tcp`, username: creds.username, credential: creds.password },
          { urls: `turn:${turnHost}:4443?transport=tcp`, username: creds.username, credential: creds.password },
          { urls: `turns:turn.${turnHost}:443?transport=tcp`, username: creds.username, credential: creds.password },
          { urls: 'stun:meet-jit-si-turnrelay.jitsi.net:443' }
        ],
        jitsiDomain: process.env.JITSI_DOMAIN || 'meet.sambruk.nu',
        credentialSource: 'prosody'
      });
    }
  } catch (e) {
    console.error('TURN credential fetch error:', e.message);
  }

  // Fallback: STUN-only (no valid TURN credentials)
  res.json({
    iceServers: [
      { urls: `stun:${turnHost}:${turnPort}` },
      { urls: 'stun:meet-jit-si-turnrelay.jitsi.net:443' }
    ],
    jitsiDomain: process.env.JITSI_DOMAIN || 'meet.sambruk.nu',
    credentialSource: 'none'
  });
});

// Server info
router.get('/info', (req, res) => {
  res.json({
    jitsiDomain: process.env.JITSI_DOMAIN || 'meet.sambruk.nu',
    turnHost: process.env.TURN_HOST || 'meet.sambruk.nu',
    turnPort: parseInt(process.env.TURN_PORT) || 3478,
    turnsPort: parseInt(process.env.TURNS_PORT) || 5349,
    jvbPort: parseInt(process.env.JVB_PORT) || 10000
  });
});

module.exports = router;
