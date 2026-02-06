const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Generate test data for bandwidth measurement
// 1MB of random-looking but compressible data
const TEST_DATA_SIZE = 1024 * 1024; // 1MB
let testData = null;

function getTestData() {
  if (!testData) {
    testData = crypto.randomBytes(TEST_DATA_SIZE);
  }
  return testData;
}

// Download test - client measures how fast they can download 1MB
router.get('/download', (req, res) => {
  const data = getTestData();
  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Length': data.length,
    'Cache-Control': 'no-cache, no-store',
    'X-Timestamp': Date.now().toString()
  });
  res.send(data);
});

// Upload test - client sends data, we measure received size
router.post('/upload', (req, res) => {
  let size = 0;
  const start = Date.now();

  req.on('data', (chunk) => {
    size += chunk.length;
  });

  req.on('end', () => {
    const duration = Date.now() - start;
    res.json({
      bytesReceived: size,
      durationMs: duration,
      mbps: duration > 0 ? ((size * 8) / (duration / 1000)) / 1000000 : 0
    });
  });
});

// Small ping endpoint for latency testing
router.get('/ping', (req, res) => {
  res.json({ ts: Date.now() });
});

module.exports = { router };
