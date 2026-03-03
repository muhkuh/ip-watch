# IP Watch

IP Watch is a LAN-focused PWA to monitor device reachability by IP.
It combines an Angular frontend with a Node.js probe host that performs ICMP ping and optional HTTP/HTTPS checks.

## Key Features
- Installable mobile-first PWA (optimized for iPhone usage).
- Device management with local persistence (IndexedDB in browser).
- Reachability status via `PING`, `HTTP`, `PING+HTTP`, or `UNKNOWN`.
- Probe endpoint settings in UI (host, protocol, optional port, optional API token).
- Health diagnostics page and verification scripts for runtime checks.
- Local Docker test setup and native Raspberry Pi deployment flow.

## Architecture Overview
1. Frontend (`frontend/`): Angular 21 standalone app + service worker.
2. Probe host (`probe-host/`): Express API on Node.js 20+.
3. Runtime options:
- Docker Compose for local integration tests.
- Native Raspberry Pi setup using `systemd` + Nginx.

High-level flow:
1. User manages devices in the PWA.
2. Frontend sends current device list to `POST /api/status/check-now`.
3. Probe host checks devices and returns normalized status payload.
4. Frontend merges results into local state and updates UI indicators.

## Repository Structure
- `frontend/`: Angular app (UI, PWA shell, client-side persistence).
- `probe-host/`: API service for probe execution.
- `deploy/`: Docker, Nginx, systemd templates, and operational scripts.
- `docs/`: architecture, API standards, coding conventions, planning, deployment docs.
- `runtime-data/`: runtime data helpers/placeholders.

## Prerequisites
- Node.js `>=20` and npm.
- Docker + Docker Compose (for containerized local testing).
- Linux environment with `ping` available for probe-host runtime.

## Quick Start (Recommended: Docker)
Start full stack:

```bash
./deploy/scripts/docker-test-up.sh
```

If `8080` is busy:

```bash
WEB_PORT=8081 ./deploy/scripts/docker-test-up.sh
```

Smoke test (start, verify, stop):

```bash
./deploy/scripts/docker-smoke-test.sh
```

Open:
- App: `http://localhost:8080` (or custom `WEB_PORT`)
- API health: `http://localhost:8080/api/health`

Stop stack:

```bash
./deploy/scripts/docker-test-down.sh
```

## Native Development
Frontend:

```bash
cd frontend
npm install
npm run start
```

Probe host:

```bash
cd probe-host
npm install
npm run start
```

Default local probe host endpoint is `http://localhost:3001` (health: `/api/health`).

## Probe Host Configuration
Environment variables (`probe-host` and Docker service):
- `HOST` (default: `0.0.0.0`)
- `PORT` (default: `3001`)
- `PING_TIMEOUT_SEC` (default: `1`)
- `HTTP_TIMEOUT_MS` (default: `1500`)
- `ENABLE_HTTP_BY_DEFAULT` (default: `false`)
- `PROBE_API_TOKEN` (default: empty)

Auth behavior:
- If `PROBE_API_TOKEN` is set, all endpoints except `/api/health` require:
`Authorization: Bearer <token>`

## API Endpoints
- `GET /api/health`
- `GET /api/status`
- `POST /api/status/check-now`

Minimal verification:

```bash
./deploy/scripts/verify-api.sh http://localhost:8080
```

With token:

```bash
./deploy/scripts/verify-api.sh http://localhost:8080 "<token>"
```

## Raspberry Pi Deployment
Native installer (run on target Pi):

```bash
sudo ./deploy/scripts/pi-native-install.sh
```

Update existing native install:

```bash
sudo ./deploy/scripts/pi-native-update.sh /opt/ip-watch
```

Validate native services:

```bash
sudo ./deploy/scripts/verify-native-services.sh
```

Detailed operational docs:
- [`docs/deployment/_deployment_base.md`](docs/deployment/_deployment_base.md)
- [`docs/deployment/e2e-runbook.md`](docs/deployment/e2e-runbook.md)

## Tests and Quality Checks
Frontend unit tests:

```bash
cd frontend
npm test
```

Integration smoke test:

```bash
./deploy/scripts/docker-smoke-test.sh
```

## Documentation Index
Start with:
1. [`AGENTS.md`](AGENTS.md)
2. [`docs/_docs_base.md`](docs/_docs_base.md)
3. [`docs/architecture.md`](docs/architecture.md)
4. [`docs/api.md`](docs/api.md)
5. [`docs/coding-standards.md`](docs/coding-standards.md)
6. [`docs/plan/_plan_base.md`](docs/plan/_plan_base.md)
7. [`docs/deployment/_deployment_base.md`](docs/deployment/_deployment_base.md)

## Troubleshooting
- `Probe unavailable` in UI:
  - Check probe host URL/protocol/port in app settings.
  - Verify API health endpoint is reachable (`/api/health`).
  - Confirm token configuration on both client and server when auth is enabled.
- Docker stack not reachable:
  - Check port conflicts and set `WEB_PORT`.
  - Re-run smoke test for full diagnostics.
- Ping checks failing on Linux hosts:
  - Ensure `ping` binary is present and has required capabilities.

## License
See [`LICENSE`](LICENSE).
