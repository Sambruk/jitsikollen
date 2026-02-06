// WebRTC echo-peer service
// Uses simple signaling via WebSocket to establish peer connections
// for diagnostic purposes. Falls back to signaling-only mode if
// werift is not available.

let RTCPeerConnection;
let weriftAvailable = false;

try {
  const werift = require('werift');
  RTCPeerConnection = werift.RTCPeerConnection;
  weriftAvailable = true;
  console.log('werift WebRTC library loaded successfully');
} catch (e) {
  console.log('werift not available, using signaling-only echo mode:', e.message);
}

const activePeers = new Map();

async function handleOffer(ws, msg) {
  if (!weriftAvailable) {
    // Signaling-only mode: respond with a synthetic answer
    // This still tests the WebSocket signaling path
    ws.send(JSON.stringify({
      type: 'answer',
      sdp: createSyntheticAnswer(msg.sdp),
      mode: 'signaling-only'
    }));
    return;
  }

  try {
    const pc = new RTCPeerConnection({
      iceServers: []
    });

    const sessionId = msg.sessionId || Date.now().toString();
    activePeers.set(sessionId, pc);

    pc.onicecandidate = (candidate) => {
      if (candidate) {
        ws.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: candidate
        }));
      }
    };

    // Echo back any data channel messages
    pc.ondatachannel = (channel) => {
      channel.onmessage = (evt) => {
        channel.send(evt.data);
      };
    };

    await pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    ws.send(JSON.stringify({
      type: 'answer',
      sdp: answer.sdp,
      mode: 'werift'
    }));

    // Cleanup after 60s
    setTimeout(() => {
      try {
        pc.close();
        activePeers.delete(sessionId);
      } catch (e) { /* ignore */ }
    }, 60000);

    ws.on('close', () => {
      try {
        pc.close();
        activePeers.delete(sessionId);
      } catch (e) { /* ignore */ }
    });

  } catch (e) {
    console.error('WebRTC peer error:', e);
    ws.send(JSON.stringify({
      type: 'webrtc-error',
      message: e.message
    }));
  }
}

function createSyntheticAnswer(offerSdp) {
  // Create a minimal SDP answer for signaling-only test
  return 'v=0\r\n' +
    'o=- ' + Date.now() + ' 2 IN IP4 0.0.0.0\r\n' +
    's=-\r\n' +
    't=0 0\r\n' +
    'a=group:BUNDLE 0\r\n' +
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n' +
    'c=IN IP4 0.0.0.0\r\n' +
    'a=mid:0\r\n' +
    'a=sctp-port:5000\r\n';
}

module.exports = { handleOffer, weriftAvailable };
