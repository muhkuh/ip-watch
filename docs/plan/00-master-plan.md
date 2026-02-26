# IP-Watch Raspberry Pi PWA Master Plan

## Goal
Build an iPhone-focused installable PWA for local device tracking by IP. The Raspberry Pi serves the app in LAN and additionally runs network probes (ICMP ping + optional HTTP/HTTPS checks).

## Selected Stack
- Frontend: Angular (standalone + signals)
- Styling: Tailwind CSS
- Local persistence: IndexedDB
- PWA: Angular PWA support + service worker
- Probe host: Raspberry Pi local probe service (ICMP + HTTP/HTTPS)
- Deployment model: Native services (`systemd`), no Docker for MVP
- LAN access model: No authentication inside LAN for MVP
- Branding direction: `Console Badge` (PS5/PC/TV hints + status dot)

## Scope Summary
- 2-second splash screen with new IP-Watch logo.
- Local persistent browser storage with 2 predefined devices.
- Create additional devices with:
  - Name
  - Type (`PS5`, `PC`, `TV`) via icon/logo selector
  - IP input with automatic dot formatting
- Main list view with online/offline status:
  - Green = reachable
  - Red = unreachable
  - Status source label (for example `PING`, `HTTP`, `PING+HTTP`, `UNKNOWN`)
- Floating Action Button (FAB) to add new devices.
- Fresh, mobile-first UI optimized for iPhone 13-16.
- PWA support (install/save to home screen, offline shell, app icon).

## Delivery Strategy
1. Clarify open decisions.
2. Build hybrid architecture (frontend + Raspberry Pi probe service).
3. Implement feature slices (Storage -> Probe API -> UI).
4. Add PWA + iOS-specific polish.
5. Prepare Raspberry Pi deployment and operation.
6. Run functional checks and finalize docs.

## Milestones
1. **M1: Foundation Ready**
   - Project skeleton, static hosting setup, local browser storage, probe service skeleton.
2. **M2: Core Device Management**
   - Seeded devices, add-device flow, list rendering.
3. **M3: Monitoring + UX**
   - Reachability checks, red/green state, splash, FAB, refined UI.
4. **M4: PWA + Deployment**
   - Manifest/service worker, iPhone install checks, Raspberry Pi runbook.
5. **M5: Probe Reliability and Tuning**
   - Raspberry Pi probe service executes ICMP and optional HTTP checks.
   - PWA consumes probe results via local API.
   - Frontend displays status and source type per device.

## Work Breakdown
- See [01-architecture-and-data-plan.md](/mnt/d/_workspace/ip-watch/docs/plan/01-architecture-and-data-plan.md)
- See [02-ui-ux-and-pwa-plan.md](/mnt/d/_workspace/ip-watch/docs/plan/02-ui-ux-and-pwa-plan.md)
- See [03-delivery-and-deployment-plan.md](/mnt/d/_workspace/ip-watch/docs/plan/03-delivery-and-deployment-plan.md)
- See [04-branding-spec.md](/mnt/d/_workspace/ip-watch/docs/plan/04-branding-spec.md)
- See [05-design-tokens.css](/mnt/d/_workspace/ip-watch/docs/plan/05-design-tokens.css)

## Logo Direction Proposals
1. **Radar Dot**
   - Circular radar ring with a highlighted IP node.
   - Wordmark `ip-watch` in lowercase, clean geometric font.
2. **Shield + Pulse**
   - Minimal shield outline with a small network pulse inside.
   - Suggests monitoring and reliability without looking "security-heavy".
3. **Network Grid Eye**
   - Four small nodes connected as a square, center node as "watch eye".
   - Works well as app icon and splash mark.
4. **Console Badge**
   - Rounded badge with tiny PS5/PC/TV glyph hints and a status dot.
   - Friendly and product-focused style.

## Selected Logo Direction
- `Console Badge`
