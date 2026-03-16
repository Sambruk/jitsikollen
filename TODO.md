# Jitsi Diagnostik-Hub - TODO

## Utökning: Nextcloud Talk-stöd (v2.0)
- [x] Uppdatera branding till "Videomötes-kollen" (alla HTML-sidor)
- [x] Lägg till plattformsväljare i test.html (Jitsi / Nextcloud Talk / Båda)
- [x] Lägg till plattformsväljare-CSS
- [x] Uppdatera docker-compose med NC Talk-miljövariabler
- [x] Uppdatera backend /info endpoint med NC Talk-konfiguration
- [x] Uppdatera whitelist.json med NC Talk-vitlistning
- [x] Uppdatera backend whitelist-routes för plattformsfilter
- [x] Implementera NC Talk-tester i diagnostics.js
- [x] Uppdatera scoring.js för plattformsmedveten poängsättning
- [x] Uppdatera index.html med dubbel plattformsinformation
- [x] Uppdatera whitelist.html med NC Talk-sektion
- [x] Uppdatera whitelist.js för plattformsmedveten visning
- [x] Uppdatera Word-export för plattformsmedvetenhet
- [x] Starta om containers och verifiera

## Tidigare versioner (klart)
- [x] v1.0: Grundläggande Jitsi-diagnostik med 5 lager
- [x] v1.1: Scoring fixes (TURN, WebSocket)
- [x] v1.2: UI-fix (header, svenska tecken)
- [x] v1.3: Scoring fixes (DataChannel, UDP 10000, WebSocket)
- [x] v1.4: Real TURN Credentials (Prosody/BOSH/XEP-0215)
- [x] v1.5: UX Improvements (logo, Word export, print)
- [x] v1.6: Statistics on Start Page
- [x] v1.7: Clean up test artifacts, UDP 10000 real test
- [x] v1.8: UI: Ta bort procentsiffror

## Notes
- app.sambruk.se routing via port 443 affected by resty-auto-ssl TLS interception
- Tool accessible via vibecoder-sambruk2-u917.vm.elestio.app on both /jitsi-test/ (443) and :9443
- TURN relay tests can't verify TCP/TLS ports from browser without valid server credentials
- Cross-origin WebSocket to meet.sambruk.nu fails by design (different domain)
- Nextcloud Talk domain: samverka.sambruk.se
