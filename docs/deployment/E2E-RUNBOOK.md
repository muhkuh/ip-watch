# E2E Acceptance Runbook

Use this runbook to validate deployment quality in staging or production-like environments.

## 1. Prerequisites
- Environment deployed and reachable.
- Required services started (`<SERVICE_NAME>`).
- Test accounts/test data available.
- Access to logs and metrics dashboards.

## 2. Service Checks
1. Verify service process status.
2. Verify reverse proxy/gateway status.
3. Call health endpoint: `curl <API_BASE>/health`.
4. Call readiness endpoint (if present): `curl <API_BASE>/ready`.

Expected result:
- All critical services are running.
- Health/readiness return successful response.

## 3. Network Checks
1. Validate DNS/host resolution for `<APP_URL>`.
2. Validate inbound connectivity and expected ports.
3. Validate service-to-service connectivity (if multi-service).

Expected result:
- App and API are reachable from intended clients.
- No blocked critical route.

## 4. Functional Checks
1. Open `<APP_URL>` and verify main UI renders.
2. Execute one core user flow end-to-end.
3. Execute one create/update/delete style flow (if applicable).
4. Validate API response shape against documented contract.

Expected result:
- Core flows succeed without manual intervention.
- Contract shape and status codes match docs.

## 5. Resilience Checks
1. Restart `<SERVICE_NAME>` and verify automatic recovery.
2. Trigger a known invalid request and verify standardized error object.
3. Simulate transient dependency failure (where safe) and verify retry/degradation behavior.

Expected result:
- Service recovers cleanly.
- Error handling is controlled and observable.

## 6. Security and Configuration Checks
1. Verify no secrets appear in logs.
2. Verify auth behavior matches target policy (none/token/JWT).
3. Verify environment-specific config values are loaded as expected.

Expected result:
- Security baseline is respected.
- No environment misconfiguration detected.

## 7. Observability Checks
1. Confirm logs include correlation/request ID.
2. Confirm key metrics are present.
3. Confirm alerts fire for known failure signal (where supported).

Expected result:
- Operational visibility is sufficient for support.

## 8. Sign-Off Template
- Environment: `<ENV_NAME>`
- Artifact version: `<ARTIFACT_VERSION>`
- Date/time: `<YYYY-MM-DD HH:MM TZ>`
- Executed by: `<NAME>`
- Result: PASS | FAIL
- Open issues:
- Follow-up owner and due date:
