# Architecture Blueprint

## 1. Context
Use this document to describe the system in a project-neutral way.

Template fields:
- Product goal:
- Primary users/clients:
- Core business capabilities:
- Runtime environments (local, staging, production):

## 2. Constraints
Capture non-negotiable constraints and assumptions.

Examples:
- Language/runtime constraints (for example Node.js >= 20, PHP >= 8.2).
- Hosting constraints (for example Docker in local, native Linux in production).
- Regulatory or data residency constraints.
- Team constraints (size, response time, release cadence).

## 3. Runtime Topology
Typical baseline for this stack family:
- Angular frontend (PWA-capable) served as static assets.
- Node.js service for orchestration/probe/API tasks.
- Optional PHP/Slim backend for domain APIs.
- Optional Eloquent ORM for data access in PHP services.
- Docker Compose for local integration.
- Native services and reverse proxy (for example Nginx/Caddy) for server runtime.

Template:
- Entry points:
- Public interfaces:
- Internal services:
- Data stores:
- Reverse proxy / gateway:

## 4. Data Flow
Document end-to-end flow for each major user journey.

Template per flow:
1. Trigger:
2. Frontend action:
3. API/service interaction:
4. Persistence/update:
5. Response and UI state:
6. Failure behavior:

## 5. Integration Boundaries
Define clear ownership and contracts between components.

Required boundary list:
- Frontend <-> API boundary
- API <-> persistence boundary
- Service <-> external network/service boundary
- Build/deploy pipeline boundary

For each boundary, include:
- Contract owner
- Input/output schema source
- Timeout/retry/error behavior

## 6. Non-Functional Requirements
### Reliability
- Expected uptime target:
- Recovery objective (RTO):
- Data loss tolerance (RPO):

### Performance
- Latency targets (p50/p95):
- Throughput targets:
- Critical bottlenecks and limits:

### Observability
- Required logs and correlation IDs.
- Health/readiness endpoints.
- Alerting signals and thresholds.

### Security Baseline
- Authentication and authorization model.
- Secret management strategy.
- Data classification and masking rules.

## 7. Decision Log (ADR-Light)
Record architecture decisions in this schema:

- Decision:
- Date:
- Status: proposed | accepted | deprecated
- Context:
- Options considered:
- Rationale:
- Impact:
- Follow-up actions:

## 8. How To Adapt For A New Project
Use these placeholders to bootstrap quickly:
- `<PROJECT_NAME>`
- `<PRIMARY_USER_GROUP>`
- `<MAIN_DOMAIN_ENTITIES>`
- `<FRONTEND_APP_NAME>`
- `<API_BASE_PATH>`
- `<DEPLOY_TARGETS>`

Checklist:
1. Replace all placeholders.
2. Add one concrete runtime topology diagram or bullet map.
3. Fill at least two critical flows.
4. Define measurable NFR targets.
5. Add first three accepted ADR-light decisions.

## 9. FRITZ! observations

The Probe Host owns one optional TR-064 collector. The collector polls the configured router over HTTPS and exposes the latest in-memory observation through `/api/v1/network/`. Angular reads the API through the same Nginx origin as the app. Multiple open clients share the collector. Polls run sequentially, with a deadline and failure backoff, and stop when the service shuts down.

The adapter discovers DeviceInfo and Hosts capabilities from the descriptor and service descriptions. It reads an advertised host list or uses bounded indexed reads when bulk listing is unsupported. It accepts only the configured HTTPS origin with certificate validation. It normalizes display fields and drops router session data and mesh login metadata. The mesh flag reflects an advertised action. No mesh topology is collected in Phase 1.

Each usable snapshot records a UTC timestamp and whether the collection was partial. Whole-poll failures preserve that observation and mark it stale. Restarting the service returns the integration to the initial polling state. The original tracked device records and probe settings live in the browser's current origin. The collector uses no browser persistence and performs no migration or automatic association with tracked devices.

## 10. Manual patch panel inventory

The FRITZ! adapter reads the advertised mesh-list path over the existing bounded, authenticated TLS transport and exposes a sanitized topology snapshot. Mesh retrieval errors are independent of host-list collection. The dashboard can bind a tracked device to the selected FRITZ! MAC address and refresh a single unambiguous IPv4 address from a current complete snapshot. Existing devices without an association retain their configured IP. The legacy ICMP probe returns its measured round-trip time where present.

The diagnostics service stores up to 32 owner-selected FRITZ! MAC targets separately from browser-managed devices. It polls sequentially with a 30-second delay between completed batches and stores observations in `diagnostics.sqlite` beside the inventory database. It uses only one unambiguous current IPv4 address from a complete FRITZ! snapshot. Unknown addresses and execution errors become null observations, and an unanswered ping is recorded separately. Mesh link changes are recorded with observation times. An absent polling interval, service shutdown or router failure creates a gap. Samples and link events expire after 24 hours. The timeline aligns observed events and samples without claiming causation. Pi-to-device ICMP and router-provided topology cannot independently identify the source of a gaming or Internet issue.

The same monitor also supports three opt-in fixed path targets: the configured FRITZ! hostname and two public resolver addresses, 1.1.1.1 and 8.8.8.8. Their samples use separate tables and actual observation timestamps. They support comparison with router and mesh observations but do not identify routing or provider faults, and ICMP filtering can prevent replies. Existing diagnostics databases migrate in place without removing earlier observations.

The diagnostics overview shows the latest sample and 24-hour counts of unanswered probes and unavailable measurements for each enabled path target. Samples older than five minutes are marked as stale; this is a display threshold, not a claim that the network is down.

The opt-in inventory uses built-in `node:sqlite` on Node 24.15 or later and an explicitly configured absolute database path. Schema v1 initializes exactly twelve patch positions. It stores physical room/outlet labels and an optional planned or observed manual switch port assignment. The router observation path and browser-managed probe devices have no write access to these records. Live switch status remains unknown until switch collection is available.

Each update or complete JSON import runs in a single write transaction. A panel revision detects competing writers, including multiple processes opening the same file. Validation checks the final combined mapping so duplicates are refused and mappings can move in a complete import. A failed transaction leaves the prior revision and contents intact. The service keeps health and legacy probe behavior available if inventory is disabled or configuration fails.
