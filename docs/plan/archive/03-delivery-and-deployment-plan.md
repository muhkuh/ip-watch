# Delivery and Deployment Plan

## Objective
Host and serve the PWA reliably on Raspberry Pi in the local network, including the local probe API service.

## Target Runtime
- Raspberry Pi OS (Bookworm or equivalent).
- Local network access via static or reserved DHCP IP.
- Static HTTP server (Nginx/Caddy/lightweight file server).
- Probe API service process with ICMP capability and optional HTTP probing.

## Deployment Options
- Option A (selected): Nginx/Caddy + probe service as native `systemd` services.
- Option B: Lightweight static server + probe service as native `systemd` services.

## Operational Requirements
- Auto-start on boot.
- Serve static build directory.
- Run probe checks on configured interval.
- Support PWA files (`manifest`, service worker, icons) with correct caching.
- Expose local API for status and device sync.
- Basic logs and restart policy.

## Security Baseline (LAN)
- Bind to LAN interface only.
- No authentication in LAN for MVP.
- No secrets stored in repo.

## Implementation Steps
1. Build frontend production bundle.
2. Implement/configure probe service + LAN API endpoints.
3. Configure static server + LAN binding.
4. Create startup config (`systemd`) for both services.
5. Add cache header rules for service worker and assets.
6. Add verification checklist for network access, API, and PWA install.

## Test and Validation Checklist
- App reachable from another LAN device.
- Probe API reachable from app client.
- Device statuses are visible and update from ICMP/HTTP probe service.
- Restart keeps static hosting available.
- Restart keeps probe API available.
- PWA install works and launches standalone.
- No critical errors in startup logs.

## Rollout Sequence
1. Deploy staging instance on Raspberry Pi.
2. Validate from iPhone on same Wi-Fi.
3. Tune probe interval/timeouts in probe service config.
4. Promote to permanent startup service.

## Deliverables
- Deployment documentation.
- Startup and maintenance commands.
- Known limitations and troubleshooting section.
