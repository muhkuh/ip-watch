# API Contract and Conventions

## 1. API Style Guide

### Versioning
- Use explicit versioning in the path (recommended: `/api/v1`).
- Breaking changes require a new major version (`v2`).
- Non-breaking additions remain in the current major version.

### URL Conventions
- Use plural resources: `/devices`, `/users`, `/orders`.
- Use kebab-case for multi-word path segments.
- Keep URLs noun-based; use actions only when resource semantics do not fit (`/status/check-now`).

### HTTP Status Codes
- `200 OK`: successful read/update.
- `201 Created`: successful creation.
- `202 Accepted`: async processing accepted.
- `204 No Content`: successful operation without body.
- `400 Bad Request`: malformed request.
- `401 Unauthorized`: missing/invalid auth.
- `403 Forbidden`: authenticated but not allowed.
- `404 Not Found`: missing resource.
- `409 Conflict`: constraint or state conflict.
- `422 Unprocessable Entity`: validation errors.
- `429 Too Many Requests`: rate limits.
- `5xx`: server-side failure.

## 2. Standard Error Object
Use this shape consistently across services:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      { "field": "ip", "issue": "invalid_ipv4" }
    ],
    "request_id": "a1b2c3d4"
  }
}
```

Field semantics:
- `code`: stable machine-readable enum.
- `message`: human-readable summary.
- `details`: optional structured list for client handling.
- `request_id`: trace key for logs/support.

## 3. Pagination and Filtering Contract
Recommended query params:
- `page` (1-based)
- `page_size` (default and max must be documented)
- `sort` (for example `created_at:desc`)
- filter params by explicit field names.

Recommended response wrapper:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "page_size": 25,
    "total_items": 0,
    "total_pages": 0
  }
}
```

## 4. Authentication Patterns
Choose one per environment/use case and document in endpoint groups:
- None (trusted LAN/internal MVP only)
- Static token (for local/private service access)
- JWT/OAuth-style bearer tokens (multi-user or internet-facing)

Selection guidance:
- LAN-only prototype: static token or none.
- Team/internal tools: static token with rotation.
- Public or multi-tenant: JWT/OAuth + short-lived tokens.

## 5. Endpoint Contract Template

```http
METHOD /api/v1/<resource>
```

Purpose:
- <What this endpoint does>

Auth:
- <none | bearer token | jwt>

Request example:

```json
{
  "field": "value"
}
```

Success response (`200/201`):

```json
{
  "data": {
    "id": "<id>",
    "field": "value"
  }
}
```

Error responses:
- `400`: malformed payload
- `401/403`: auth/access issues
- `404`: resource missing
- `409/422`: conflict/validation

## 6. Idempotency and Retry Guidance
- `GET`, `PUT`, `DELETE` should be idempotent by design.
- `POST` that can be retried should support idempotency keys where relevant.
- Clients should implement exponential backoff for `429` and transient `5xx`.
- Do not retry non-idempotent operations without safeguards.

## 7. Compatibility Policy
### Breaking Changes
Examples:
- Remove/rename fields.
- Change type or semantics of existing fields.
- Tighten validation in incompatible ways.

Process:
1. Announce and document impact.
2. Provide migration window.
3. Release under next major API version.

### Non-Breaking Changes
Examples:
- Add optional fields.
- Add new endpoints.
- Add new enum values (if clients are expected to ignore unknown values).

## 8. Contract Testing Expectations
Minimum expectation:
- Positive case test per endpoint.
- Validation failure case.
- Auth failure case (when auth is enabled).
- Error object schema assertion.

Recommended:
- Consumer-driven contract tests for shared APIs.
- CI job that validates examples against schema definitions.

## 9. Network observations (Phase 1)

| Request | `data` fields |
| --- | --- |
| `GET /api/v1/network/integrations` | `source` (`fritz-tr064`), `state`, UTC `lastAttemptAt`, UTC `lastSuccessAt`, `capabilities`, and `errorCode` |
| `GET /api/v1/network/devices` | `source`, `state`, UTC `observedAt`, `router`, `hosts`, and `partial` |

Integration states are `disabled`, `configuration_error`, `pending`, `ready`, `partial`, and `unavailable`. The devices response uses these states and returns `stale` when the last poll failed and an older observation is available. The timestamp of that observation is retained. `lastSuccessAt` is the timestamp of the most recent usable observation, which can be partial. The integration error code is either `null` or one of `INVALID_CONFIGURATION`, `AUTH_FAILED`, `TIMEOUT`, `INVALID_RESPONSE`, `CONNECTION_FAILED`, `ROUTER_ERROR`, and `UNSUPPORTED`.

Timestamps and capabilities are `null` until known. Capability flags are `hostList`, `indexedHosts`, and `meshList`. `meshList` describes an advertised action. Router identity consists of `name`, `model`, and `softwareVersion`, each nullable. Each host has nullable `hostname`, an array of `addresses`, nullable `macAddress`, and nullable Boolean `reportedActive`. A complete empty host list is `[]`. With no observation, `hosts`, `router`, and `observedAt` are `null`. The active flag is reported by the router.

Both endpoints use the `{ "data": ... }` wrapper, `Cache-Control: no-store`, and no cross-origin access headers. If `PROBE_API_TOKEN` is configured, supply the configured bearer token. A live collector requires a token, valid router configuration and explicit enablement. The routes return structured errors with `request_id` on `401`, `404` or `405`. Router collection errors are represented by integration state in a successful API response. The legacy unversioned endpoints keep their own existing contracts.

## 10. Patch panel inventory (Phase 2)

The legacy status check also returns nullable `latencyMs` for a successful ICMP reply. A null value means no latency was measured. Existing request and response fields remain supported.

`GET /api/v1/network/mesh` returns a sanitized FRITZ! observation with `state`, `observedAt`, `errorCode` and nullable `topology`. The topology contains nodes and reported links with source identifiers, link type, connection state and nullable receive signal. Nodes or links that the router does not report remain unknown. Router-supplied URLs, session IDs and login tokens are excluded. The endpoint has the same token and no-store behavior as the other network endpoints.

The authenticated same-origin `/api/v1/diagnostics/targets` endpoint lists selected router MAC addresses. `PUT /targets/:mac` selects a MAC from the current complete router snapshot; `DELETE /targets/:mac` stops monitoring. `GET /targets/:mac/history` returns bounded samples and mesh link changes observed in the last 24 hours. Sample `responded` is `true`, `false` for an unanswered ICMP request, or `null` for unavailable measurement. `latencyMs` and `address` are nullable. Only state changes between snapshots with unique, nonzero interface MAC addresses are recorded. Previous UID-based events remain stored but are excluded from results because FRITZ! topology UIDs are not stable across snapshots. Selection is limited to 32 targets and requires the inventory-backed diagnostics store and bearer token. The API never accepts a probe IP from this selection endpoint.

The manual inventory uses the same-origin `/api/v1/patch-panels/main` resource and requires a valid IP Watch bearer token when active. Responses are `no-store`, and browser cross-origin access headers are absent. The `data` wrapper and structured error model apply.

| Method and suffix | Request | Success `data` |
| --- | --- | --- |
| `GET /ports` | None | `{ panelId, revision, ports }` |
| `PUT /ports/:position` | `{ revision, port }` | Updated complete panel |
| `GET /export` | None | `{ schemaVersion: 1, panelId, ports }` |
| `PUT /import` | `{ revision, document }` | Updated complete panel |

`panelId` is `main`. Every port has `position` (1–12), `label`, `room`, `outlet`, `notes`, nullable `switchPort` (1–16), and Boolean `verified`. The URL determines the position for a single-port write. Text is trimmed. `label`, `room`, and `outlet` are up to 80 characters and `notes` up to 500. Empty strings represent unknown or unassigned values. An outlet requires a room. Outlet verification requires both fields. `switchPort: null` means unpatched. Live link state is unavailable in this phase.

Writes must use the revision from the current panel and increment it on success. Import takes the export document with exactly one entry for each position. Revision mismatch returns `409 REVISION_CONFLICT`. Duplicate switch ports or room/outlet pairs return `409 DUPLICATE_SWITCH_PORT` or `409 DUPLICATE_OUTLET`. Outlet matching is case-insensitive. Validation errors return `422 INVALID_INVENTORY`. A malformed or oversized JSON body returns `400` or `413`. Disabled or unavailable inventory returns `503` with a specific inventory error code. An unauthorized request returns `401` before the JSON body is processed.
