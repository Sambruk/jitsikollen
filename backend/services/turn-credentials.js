// Fetches real TURN credentials from Prosody via BOSH/XMPP (XEP-0215)
// This gives time-limited HMAC-SHA1 credentials that work for actual TURN relay.

const https = require('https');

let cachedCredentials = null;
let cacheExpiry = 0;

const JITSI_DOMAIN = process.env.JITSI_DOMAIN || 'meet.sambruk.nu';
const XMPP_DOMAIN = process.env.XMPP_DOMAIN || 'meet.jitsi';
const XMPP_GUEST_DOMAIN = process.env.XMPP_GUEST_DOMAIN || 'guest.meet.jitsi';
const BOSH_PATH = '/http-bind';

function boshPost(body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: JITSI_DOMAIN,
      port: 443,
      path: BOSH_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('BOSH timeout')); });
    req.write(body);
    req.end();
  });
}

async function fetchFromProsody() {
  const rid = Math.floor(Math.random() * 900000) + 100000;

  // Step 1: Start BOSH session (use guest domain for anonymous auth)
  const startResp = await boshPost(
    `<body xmlns='http://jabber.org/protocol/httpbind' rid='${rid}' to='${XMPP_GUEST_DOMAIN}' xml:lang='en' wait='60' hold='1' content='text/xml; charset=utf-8' ver='1.6' xmpp:version='1.0' xmlns:xmpp='urn:xmpp:xbosh'/>`
  );

  const sidMatch = startResp.match(/sid=['"]([^'"]+)['"]/);
  if (!sidMatch) throw new Error('No BOSH session ID');
  const sid = sidMatch[1];

  // Step 2: SASL ANONYMOUS auth
  const authResp = await boshPost(
    `<body xmlns='http://jabber.org/protocol/httpbind' rid='${rid + 1}' sid='${sid}'><auth xmlns='urn:ietf:params:xml:ns:xmpp-sasl' mechanism='ANONYMOUS'/></body>`
  );
  if (!authResp.includes('<success')) throw new Error('SASL ANONYMOUS failed');

  // Step 3: Restart session
  await boshPost(
    `<body xmlns='http://jabber.org/protocol/httpbind' rid='${rid + 2}' sid='${sid}' xmpp:restart='true' xmlns:xmpp='urn:xmpp:xbosh'/>`
  );

  // Step 4: Bind resource
  await boshPost(
    `<body xmlns='http://jabber.org/protocol/httpbind' rid='${rid + 3}' sid='${sid}'><iq type='set' id='b1'><bind xmlns='urn:ietf:params:xml:ns:xmpp-bind'><resource>diag-${Date.now()}</resource></bind></iq></body>`
  );

  // Step 5: Query XEP-0215 external services
  const servicesResp = await boshPost(
    `<body xmlns='http://jabber.org/protocol/httpbind' rid='${rid + 4}' sid='${sid}'><iq type='get' id='s1' to='${XMPP_DOMAIN}'><services xmlns='urn:xmpp:extdisco:2'/></iq></body>`
  );

  // Step 6: Close session (fire and forget)
  boshPost(
    `<body xmlns='http://jabber.org/protocol/httpbind' rid='${rid + 5}' sid='${sid}' type='terminate'><presence xmlns='jabber:client' type='unavailable'/></body>`
  ).catch(() => {});

  return parseServices(servicesResp);
}

function parseServices(xml) {
  const serviceRegex = /<service\s+([^/>]*?)(?:\/>|>[^<]*<\/service>)/g;
  let match;
  let username = null;
  let password = null;

  while ((match = serviceRegex.exec(xml)) !== null) {
    const attrs = match[1];
    const get = (name) => {
      const m = attrs.match(new RegExp(name + "=['\"]([^'\"]*)['\"]"));
      return m ? m[1] : null;
    };

    const type = get('type');
    if ((type === 'turn' || type === 'turns') && get('username') && get('password')) {
      username = get('username');
      password = get('password');
      break;
    }
  }

  if (!username || !password) {
    throw new Error('No TURN credentials in XEP-0215 response');
  }

  return { username, password };
}

async function getTurnCredentials() {
  if (cachedCredentials && Date.now() < cacheExpiry) {
    return cachedCredentials;
  }

  try {
    const creds = await fetchFromProsody();
    cachedCredentials = creds;
    cacheExpiry = Date.now() + 12 * 60 * 60 * 1000; // 12h cache
    console.log('TURN credentials fetched via BOSH/XEP-0215 (user:', creds.username + ')');
    return creds;
  } catch (e) {
    console.error('BOSH TURN credential fetch failed:', e.message);
    if (cachedCredentials) return cachedCredentials;
    return null;
  }
}

module.exports = { getTurnCredentials };
