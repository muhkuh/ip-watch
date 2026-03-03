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
