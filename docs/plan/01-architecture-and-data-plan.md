# Architecture and Data Plan

## Objective
Define a hybrid architecture where the Raspberry Pi serves static files, runs probe checks, and the PWA persists local UI/device data.

## Proposed Components
- Frontend: Angular standalone app (signals-based state, mobile-first, PWA-ready).
- Styling system: Tailwind CSS + project design tokens.
- Client-side storage: IndexedDB (with localStorage fallback for preferences).
- Raspberry Pi probe service for ICMP ping + optional HTTP/HTTPS checks.
- Static file server on Raspberry Pi for frontend assets.

## Data Model (Initial, IndexedDB)
- `devices`
  - `id` (UUID)
  - `name` (string, required)
  - `type` (enum: `PS5`, `PC`, `TV`)
  - `ip` (string, IPv4 format)
  - `probe_port` (number, optional)
  - `probe_protocol` (`http`/`https`, optional)
  - `created_at` (ISO timestamp)
  - `updated_at` (ISO timestamp)
- `device_status_cache`
  - `device_id` (FK-like reference)
  - `is_reachable` (boolean)
  - `status_source` (`PING` | `HTTP` | `PING+HTTP` | `UNKNOWN`)
  - `ping_reachable` (boolean, nullable)
  - `http_reachable` (boolean, nullable)
  - `last_checked_at` (ISO timestamp)
  - `check_error` (string, nullable)

## Seed Data
- On first app launch, insert 2 predefined devices into IndexedDB.

## Runtime Notes
- CRUD can run client-local first and be synced with probe service.
- Probe results are provided by Raspberry Pi service via LAN API.
- Browser-only probe is optional fallback mode only.

## Probe API (Draft)
- `GET /api/devices`
- `POST /api/devices`
- `PATCH /api/devices/:id`
- `DELETE /api/devices/:id`
- `GET /api/status`
- `POST /api/status/check-now`

## Validation Rules
- Name length: 2-40 chars.
- IP must be valid IPv4.
- Device type must match supported enums.
- Duplicate IP + port combinations rejected.

## Steps
1. Choose frontend stack and storage library approach.
2. Implement probe service skeleton on Raspberry Pi.
3. Implement IndexedDB schema + first-run seed.
4. Implement CRUD flows with API sync.
5. Add status polling + source-aware mapping in UI cache.
6. Add tests for formatter, validation, and probe API contracts.

## Acceptance Criteria
- Data persists after app close/reopen.
- 2 default devices exist on first startup.
- CRUD operations are stable and validated.
- Reachability status updates via Pi probe service.
- Status source (`PING`/`HTTP`/`PING+HTTP`) is available for each device.

## Risks and Mitigations
- ICMP execution permissions on Raspberry Pi:
  - Run probe service with required capabilities and document setup.
- Mixed device protocols/closed ports:
  - Keep per-device HTTP probe optional and show clear source labels in UI.
