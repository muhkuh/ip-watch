# IP Watch Frontend (Angular + Tailwind)

## Purpose
Initial PWA-ready frontend scaffold for IP Watch.

## Run locally
```bash
cd frontend
npm install
npm run start
```

## Build
```bash
cd frontend
npm run build
```

## Backend and Host Deployment
- Probe host service source: `/probe-host`
- Deployment guide (Docker + native Raspberry Pi): `/docs/deployment/README.md`
- Deploy scripts:
  - `/deploy/scripts/docker-test-up.sh`
  - `/deploy/scripts/docker-test-down.sh`
  - `/deploy/scripts/docker-smoke-test.sh`
  - `/deploy/scripts/pi-native-install.sh`
  - `/deploy/scripts/pi-native-update.sh`
  - `/deploy/scripts/verify-api.sh`
  - `/deploy/scripts/verify-native-services.sh`

## Current implementation
- Angular standalone bootstrap with router.
- Tailwind wired into global styles.
- Design tokens integrated from project branding spec.
- Dashboard starter view:
  - 2-second splash screen
  - IndexedDB-backed seeded device list (2 default entries) with in-memory fallback
  - status source chip (`PING`, `HTTP`, `PING+HTTP`, `UNKNOWN`)
  - probe API connection indicator (`Connected` / `Waiting` / `Unavailable`) with spinner
  - status legend badges (clickable filters)
  - help dialog (`?`) with status semantics, troubleshooting tips, and health link
  - manual refresh button for immediate probe sync
  - configurable probe endpoint:
    - host (default `192.168.16.30`)
    - protocol (`http`/`https`)
    - optional port
    - optional API token (Bearer)
    - auto port inference when host/protocol match current app URL
  - startup toast with initial host reachability
  - host test feedback toast after settings save
  - toast warning when local storage is blocked
  - language switch (`DE`/`EN`) with dynamic text updates
  - floating action button
  - add/edit-device bottom sheet with:
    - name input
    - type selector (`PS5`, `PC`, `TV`) with icons
    - free IP input with iOS-friendly punctuation handling
    - per-device HTTP probe settings (`off/http/https` + optional port)
    - validation and inline error feedback
  - delete action with confirmation
  - stateless probe flow:
    - device list is persistent in IndexedDB (browser), fallback to memory when blocked
    - refresh sends current local devices to `POST /api/status/check-now`
  - device type icons in list cards (`PS5`, `PC`, `TV`)
  - verified Docker probe flow for per-device `probeProtocol` + `probePort`
  - health page (`/health`) with back button, open/copy endpoint
  - scrollable device list region (fixed header/summary)
  - consistent button styling in header controls

  - PWA baseline:
    - `manifest.webmanifest`
    - Angular service worker (`ngsw-config.json`)
    - Console Badge icon assets (`public/icons/*.svg`)
    - PNG exports (`icon-180/192/512.png`, `favicon-16/32.png`)
