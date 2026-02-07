# Jitsikollen

Diagnostikverktyg för att testa nätverks- och WebRTC-kompatibilitet mot en Jitsi-instans. Riktar sig till IT-avdelningar och systemadministratörer som behöver verifiera brandväggsregler och nätverkskonfiguration innan Jitsi-möten tas i bruk.

## Funktioner

- 5 lager av diagnostiktester (WebRTC, nätverk, peer-anslutning, Jitsi-specifikt, kvalitet)
- Poängsättning 0–100 med rekommendationer på svenska
- Vitlista med brandväggsregler (export till Word, CSV, Palo Alto-format)
- Hämtar riktiga TURN-credentials via BOSH/XEP-0215 från Prosody
- Resultatlagring i SQLite

## Teknikstack

- **Frontend:** Vanilla HTML, CSS, JavaScript (inga ramverk)
- **Backend:** Node.js 18, Express, WebSocket, SQLite
- **Infrastruktur:** Docker (Nginx + Node.js)

## Projektstruktur

```
├── docker-compose.yml        # Container-konfiguration
├── .env.example              # Miljövariabler (kopiera till .env)
├── frontend/
│   ├── index.html            # Startsida
│   ├── test.html             # Diagnostik-exekvering
│   ├── results.html          # Resultatvisning
│   ├── whitelist.html        # Brandväggsregler
│   ├── css/style.css
│   └── js/
│       ├── app.js            # Navigation, datumvisning
│       ├── utils.js          # API-kommunikation, hjälpfunktioner
│       ├── diagnostics.js    # Diagnostikmotor (5 lager)
│       ├── scoring.js        # Poängsättning och rekommendationer
│       ├── results.js        # Resultatrendering
│       └── whitelist.js      # Vitlistning och Word-export
├── backend/
│   ├── server.js             # Express + WebSocket-server
│   ├── package.json
│   ├── routes/
│   │   ├── api.js            # Health, IP, TURN-credentials, serverinfo
│   │   ├── whitelist.js      # Vitliste-endpoints (JSON, CSV, brandvägg)
│   │   └── results.js        # Resultatlagring och hämtning
│   ├── services/
│   │   ├── webrtc-peer.js    # WebRTC-signalering
│   │   ├── bandwidth.js      # Bandbredds- och latenstester
│   │   └── turn-credentials.js  # BOSH/XEP-0215 credential-hämtning
│   ├── data/
│   │   └── whitelist.json    # Brandväggsregler (referensdata)
│   └── db/
│       ├── database.js       # SQLite-anslutning
│       └── schema.sql        # Databasschema
└── db/                       # Persistent databaslagring (volym)
```

## Anpassa för en annan servermiljö

### 1. Miljövariabler (.env)

Kopiera `.env.example` till `.env` och ändra:

```bash
cp .env.example .env
```

| Variabel | Beskrivning | Ändra till |
|----------|-------------|------------|
| `JITSI_DOMAIN` | Din Jitsi-instans FQDN | t.ex. `meet.example.com` |
| `TURN_HOST` | TURN-serverns adress (ofta samma som Jitsi) | t.ex. `meet.example.com` |
| `TURN_PORT` | STUN/TURN standardport | `3478` (standard) |
| `TURNS_PORT` | TURN-over-TLS port | `5349` (standard) |
| `JVB_PORT` | Jitsi Videobridge mediaport | `10000` (standard) |
| `STUN_UDP_TEST` | Aktivera UDP 10000-test (se nedan) | `true` / `false` |

### 2. docker-compose.yml

Ändra portbindningar efter din miljö:

```yaml
ports:
  - "172.17.0.1:13011:80"   # Frontend - ändra 13011 till ledig port
  - "172.17.0.1:13012:3000"  # Backend - ändra 13012 till ledig port
```

Ändra environment-variabler i backend-tjänsten:

```yaml
environment:
  - JITSI_DOMAIN=meet.example.com    # Din Jitsi-domän
  - TURN_HOST=meet.example.com       # Din TURN-server
  - TURN_PORT=3478
  - TURNS_PORT=5349
```

Ändra volymernas sökvägar till din installationskatalog:

```yaml
volumes:
  - /sökväg/till/projekt/frontend:/usr/share/nginx/html
  - /sökväg/till/projekt/backend:/app
  - /sökväg/till/projekt/db:/app/db-data
```

### 3. UDP 10000-test (STUN-proxy)

Jitsi Videobridge (JVB) använder UDP port 10000 för media, men JVB pratar inte STUN-protokoll. Därför kan en webbläsare inte direkt testa om port 10000 är nåbar.

Lösningen är en dedikerad STUN-only-server (coturn) som lyssnar på UDP 10000 på **en annan maskin** än Jitsi-servern (eftersom JVB redan upptar den porten). När klienten gör en STUN binding request till denna server på port 10000 och får ett svar, bevisar det att klientens brandvägg tillåter utgående UDP-trafik på port 10000.

Tjänsten `stun-udp-test` i `docker-compose.yml` kör denna STUN-lyssnare. Den exponeras på `0.0.0.0:10000/udp`.

**Avaktivera testet** om du inte har en tillgänglig UDP 10000-port på din infrastruktur:

```bash
# I .env
STUN_UDP_TEST=false
```

Starta om backend efter ändring: `docker compose restart backend`

### 4. Brandväggsregler (whitelist.json)

Redigera `backend/data/whitelist.json` och ersätt alla `meet.sambruk.nu` med din Jitsi-domän. Uppdatera IP-adressen under TURN SNI-routing till din servers IP.

### 5. TURN-credentials (turn-credentials.js)

Tjänsten hämtar TURN-credentials via BOSH/XMPP från Prosody. Om din Jitsi-instans har annan XMPP-konfiguration, ändra miljövariablerna:

```yaml
environment:
  - XMPP_DOMAIN=meet.jitsi           # Intern XMPP-domän (standard för Docker-Jitsi)
  - XMPP_GUEST_DOMAIN=guest.meet.jitsi  # Gästdomän för anonym auth
```

### 6. Nginx reverse proxy

Lägg till location-block i din nginx-konfiguration:

```nginx
# WebSocket
location /jitsi-test/ws {
    proxy_http_version 1.1;
    proxy_pass http://127.0.0.1:BACKEND_PORT/ws;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;
}

# Backend API
location /jitsi-test/api {
    proxy_http_version 1.1;
    proxy_pass http://127.0.0.1:BACKEND_PORT/api;
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Frontend
location /jitsi-test/ {
    proxy_pass http://127.0.0.1:FRONTEND_PORT/;
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Ersätt `BACKEND_PORT` och `FRONTEND_PORT` med portarna du valde i docker-compose.yml.

## Starta

```bash
docker compose up -d
```

Verifiera:

```bash
curl http://localhost:FRONTEND_PORT/          # Frontend
curl http://localhost:BACKEND_PORT/api/health  # Backend health check
```
