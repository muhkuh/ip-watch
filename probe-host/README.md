# IP Watch Probe Host

## Purpose
Backend API service for IP Watch that runs on Raspberry Pi and performs:
- ICMP ping checks
- Optional HTTP/HTTPS probe checks
- Stateless status checks for device payloads from the frontend

## Runtime requirements
- Node.js 20+
- Linux `ping` binary available in PATH

## Run locally (native)
```bash
cd probe-host
npm install
node src/server.js
```

By default, the service binds to `0.0.0.0:3001` and is typically reachable locally via `http://localhost:3001`.

## Environment variables
- `HOST` (default: `0.0.0.0`)
- `PORT` (default: `3001`)
- `PING_TIMEOUT_SEC` (default: `1`)
- `HTTP_TIMEOUT_MS` (default: `1500`)
- `ENABLE_HTTP_BY_DEFAULT` (default: `false`)
- `PROBE_API_TOKEN` (default: empty, auth disabled)

If `PROBE_API_TOKEN` is set, all API endpoints except `/api/health` require:
`Authorization: Bearer <token>`

## API endpoints
- `GET /api/health`
- `POST /api/status/check-now` (body: `{ "devices": [...] }`)
- `GET /api/status` (returns last check cache)

## Payload format (`POST /api/status/check-now`)
`devices` entries require:
- `name` (2-40 chars)
- `type` (`PS5` | `PC` | `TV`)
- `ip` (valid IPv4)
- `probeProtocol` (`http` | `https` | `null`)
- `probePort` (`1-65535` | `null`)

The backend does not persist devices. Device storage remains in the PWA (IndexedDB).
