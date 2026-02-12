# Jitsi Diagnostik-Hub - TODO

## Setup
- [x] Create project structure
- [x] Create docker-compose.yml
- [x] Create .env

## Frontend
- [x] Create index.html (landningssida)
- [x] Create test.html (diagnostik-exekvering)
- [x] Create results.html (resultatvisning)
- [x] Create whitelist.html (vitlistnings-hub)
- [x] Create css/style.css
- [x] Create js/app.js (navigation, datum)
- [x] Create js/utils.js (delade hjälpfunktioner)
- [x] Create js/diagnostics.js (diagnostikmotor)
- [x] Create js/scoring.js (poängsättning)
- [x] Create js/results.js (resultatrendering)
- [x] Create js/whitelist.js (vitlistnings-UI)

## Backend
- [x] Create package.json
- [x] Create server.js (Express + WebSocket)
- [x] Create routes/api.js
- [x] Create routes/whitelist.js
- [x] Create routes/results.js
- [x] Create services/webrtc-peer.js
- [x] Create services/bandwidth.js
- [x] Create data/whitelist.json
- [x] Create db/schema.sql
- [x] Create db/database.js

## Nginx
- [x] Configure SNI stream routing (port 443)
- [x] Modify HTTP config (443->444, add 9443, add /jitsi-test/)

## Deployment
- [x] Start docker-compose stack
- [x] Restart nginx
- [x] Verify logs and connectivity
- [x] End-to-end test

## Scoring Fixes (v1.1)
- [x] Fix TURN tests: use STUN binding for UDP, warn for TCP/TLS ports
- [x] Downgrade turn-443-sni from critical to important
- [x] Downgrade turn-tls-5349, turn-tcp-4443 from important to nice
- [x] Fix jitsi-websocket: detect CORS, give warn not fail when HTTPS works
- [x] Fix jitsi-tcp-4443: port speaks JVB not HTTP, downgrade to nice
- [x] Reorder layer 4: HTTPS before WebSocket
- [x] Update scoring.js recommendations for warn statuses
- [x] Restart stack and verify

## UI-fix (v1.2)
- [x] Ändra header-färg till ljusgrå (#e2e8f0)
- [x] Fixa svenska tecken (å, ä, ö) i index.html
- [x] Fixa svenska tecken i test.html
- [x] Fixa svenska tecken i results.html
- [x] Fixa svenska tecken i whitelist.html
- [x] Fixa svenska tecken i diagnostics.js
- [x] Fixa svenska tecken i scoring.js
- [x] Fixa svenska tecken i results.js
- [x] Fixa svenska tecken i whitelist.js

## Scoring Fixes (v1.3)
- [x] Fix DataChannel: signaling-only check before setRemoteDescription (synthetic SDP bug)
- [x] Fix UDP 10000: use STUN result as proxy (JVB doesn't speak STUN on port 10000)
- [x] Fix WebSocket: give pass when cross-origin is the only issue (test artifact, not real)

## Real TURN Credentials (v1.4)
- [x] Create BOSH/XEP-0215 service (backend/services/turn-credentials.js)
- [x] Fetch TURN creds from Prosody via guest.meet.jitsi anonymous XMPP
- [x] Update /api/turn-credentials to use real Prosody credentials
- [x] Update frontend TURN tests to use iceTransportPolicy:'relay' with real creds
- [x] Ports 4443/443 give warn (not fail) on timeout (may not be configured)
- [x] Fallback to STUN-proxy if credentials unavailable

## UX Improvements (v1.5)
- [x] Add Sambruk logo to header on all pages
- [x] Remove Resultat nav link (3 items: Start, Diagnostik, Vitlistning)
- [x] Remove result saving (POST to /results)
- [x] Replace test.html action buttons with Word export, Print/PDF, run again
- [x] Add exportResultWord() to diagnostics.js
- [x] Add @media print styles to style.css
- [x] Add "Skicka till IT-avdelningen" card on whitelist.html
- [x] Add exportWhitelistWord() to whitelist.js

## Redeployment (2026-02-06)
- [x] Start docker containers (frontend port 13011, backend port 13012)
- [x] Add nginx location blocks for /jitsi-test/ (frontend + API + WebSocket) to app.sambruk.se server
- [x] Restart nginx
- [x] Verify frontend (200), backend health (200), external access (200)

## Statistics on Start Page (v1.6)
- [x] Add getStats prepared statement to database.js
- [x] Add GET /stats endpoint to routes/results.js (before /:id)
- [x] Add stats bar HTML to index.html (between hero and features)
- [x] Add stats CSS styling to style.css
- [x] Include utils.js in index.html for apiJSON
- [x] Add stats fetch logic to app.js
- [x] Restart backend container
- [x] Verify /api/results/stats returns JSON (totalRuns: 3, averageScore: 68.3)
- [x] Verify external access via SSL
- [x] Show stats in test result card (test.html #test-complete)
- [x] Fetch stats after diagnostics complete in diagnostics.js
- [x] Add stats-comparison CSS
- [x] Re-add POST /results saving after test completes (removed in v1.5)
- [x] Chain: save result → fetch stats → display (ensures count is current)

## Clean up test artifacts (v1.7)
- [x] Remove fake TCP 4443 test (definition, function, runLayer call, recommendation)
- [x] DataChannel: change signaling-only from warn to pass
- [x] WebSocket: remove "cross-origin-begränsning" detail text, show clean pass
- [x] Remove DataChannel warn recommendation from scoring.js

## Fix UDP 10000 test (v1.7)
- [x] Add stun-udp-test container (coturn STUN-only on UDP 10000) to docker-compose.yml
- [x] Replace fake UDP 10000 proxy-test with real STUN binding to port 10000
- [x] Verify STUN responds on UDP 10000
- [x] Add STUN_UDP_TEST env var to .env, docker-compose.yml, and /info endpoint
- [x] Conditionally run UDP 10000 test based on serverInfo.stunUdpTest
- [x] Update README.md with UDP 10000 test explanation and STUN_UDP_TEST toggle

## UI: Ta bort procentsiffror (v1.8)
- [x] Ta bort procenttal från lager-rubriker i test.html (Lager 1–5)

## Notes
- app.sambruk.se routing via port 443 affected by resty-auto-ssl TLS interception
- Tool accessible via vibecoder-sambruk2-u917.vm.elestio.app on both /jitsi-test/ (443) and :9443
- All existing services (landing page, OpenStream on 8443) verified working
- TURN relay tests can't verify TCP/TLS ports from browser without valid server credentials
- Cross-origin WebSocket to meet.sambruk.nu fails by design (different domain)
