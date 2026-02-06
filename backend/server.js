const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');

const apiRoutes = require('./routes/api');
const whitelistRoutes = require('./routes/whitelist');
const resultsRoutes = require('./routes/results');
const bandwidthService = require('./services/bandwidth');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api', apiRoutes);
app.use('/api/whitelist', whitelistRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/bandwidth', bandwidthService.router);

// WebSocket server for diagnostics coordination
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const clientIp = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);

      switch (msg.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: msg.timestamp, serverTime: Date.now() }));
          break;

        case 'offer':
          // WebRTC signaling - echo back as answer concept
          // In production, this coordinates with werift peer
          handleWebRTCOffer(ws, msg);
          break;

        case 'ice-candidate':
          // Store/relay ICE candidates
          if (ws.peerWs) {
            ws.peerWs.send(JSON.stringify({ type: 'ice-candidate', candidate: msg.candidate }));
          }
          break;

        default:
          ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
    }
  });

  ws.on('close', () => {
    if (ws.peerWs) {
      ws.peerWs.close();
    }
  });

  // Send welcome
  ws.send(JSON.stringify({ type: 'welcome', clientIp, serverTime: Date.now() }));
});

// WebRTC offer handling via WebSocket signaling
function handleWebRTCOffer(ws, msg) {
  try {
    const webrtcPeer = require('./services/webrtc-peer');
    webrtcPeer.handleOffer(ws, msg);
  } catch (e) {
    ws.send(JSON.stringify({
      type: 'webrtc-error',
      message: 'WebRTC echo-peer unavailable: ' + e.message
    }));
  }
}

// Heartbeat for WebSocket connections
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => clearInterval(heartbeatInterval));

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Jitsi Diagnostik-Hub backend running on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://0.0.0.0:${PORT}/ws`);
});
