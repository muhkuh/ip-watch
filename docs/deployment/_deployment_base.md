# Deployment Framework

## 1. Purpose
Define a reusable deployment model for projects using web frontend + service backend stacks.

## 2. Environment Model
### Local (Developer)
- Primary mode: Docker Compose.
- Goal: fast feedback, reproducible integration, isolated dependencies.

### Staging
- Mirrors production topology as closely as practical.
- Used for release validation, integration checks, and non-functional testing.

### Production
- Native server and/or container runtime.
- Reverse proxy (for example Nginx/Caddy) in front of app services.
- Persistent monitoring and operational alerts enabled.

## 3. Deployment Variants
### A) Docker-first Local Runtime
- Build images.
- Start services with compose.
- Run smoke checks.
- Tear down and clean temporary resources.

### B) Native Server Runtime
- Install runtime dependencies.
- Deploy application artifacts.
- Configure service manager (`systemd` or equivalent).
- Configure reverse proxy and TLS (if internet-facing).

## 4. Artifact Flow
1. Build artifacts in CI or controlled build environment.
2. Version and store artifacts with immutable identifiers.
3. Promote same artifact from staging to production.
4. Record build metadata (commit SHA, build time, version).

## 5. Configuration and Secrets Strategy
- Store environment-specific config outside source code.
- Use `.env`/service env files only for non-secret defaults.
- Secrets must come from secret manager or protected host files.
- Rotate secrets on schedule and after incidents.

## 6. Operational Baseline
- Health endpoint: `<API_BASE>/health`.
- Readiness endpoint: `<API_BASE>/ready` (if applicable).
- Structured logs with request IDs.
- Restart policy for critical services.
- Backups for persistent data and config snapshots.

## 7. Rollback and Backup
### Rollback
- Keep last known good artifact deployable.
- Document one-command or one-procedure rollback.
- Validate rollback with post-rollback health checks.

### Backup
- Define data backup frequency and retention.
- Backup service configs (proxy/systemd/env templates).
- Periodically test restore procedure.

## 8. Minimum Release Checklist
1. Build artifacts created and versioned.
2. Config and secrets prepared for target environment.
3. Migration steps verified (if applicable).
4. Smoke checks pass in target environment.
5. Monitoring and alerts validated.
6. Rollback path confirmed.

## 9. Project Placeholders
Replace before adoption:
- `<APP_URL>`
- `<API_BASE>`
- `<SERVICE_NAME>`
- `<DEPLOY_HOST>`
- `<ARTIFACT_VERSION>`

## 10. FRITZ! integration operations

Enable the collector only after reviewing the target runtime, local HTTPS access to the router, the web origin and the owner validation procedure. The collector starts disabled. Use the existing service environment configuration to set `FRITZ_ENABLED=true`, `FRITZ_URL` to the router's verified TR-064 HTTPS origin, `FRITZ_USERNAME`, `FRITZ_PASSWORD`, and a non-empty `PROBE_API_TOKEN`. Configure the owner browser with that IP Watch token through the existing probe settings. Keep router credentials in a protected environment file and use a local FRITZ! account with the minimum rights supported for the required reads.

When introducing `PROBE_API_TOKEN` on a previously unauthenticated installation, coordinate the change with existing probe clients. The same setting also requires authentication for legacy probe requests. Keep a copy of the prior service configuration for rollback.

Set `FRITZ_CA_FILE` to a trusted router CA or certificate PEM if it is absent from Node's default trust store. The certificate name or IP must match `FRITZ_URL`. Use the exact router HTTPS port confirmed by the owner. The config example contains placeholders. No certificate validation bypass is required. Confirm the browser-to-Nginx access policy separately from the router connection before exposing the inventory.

`FRITZ_POLL_INTERVAL_MS` defaults to `60000` and permits `10000`–`3600000`. `FRITZ_REQUEST_TIMEOUT_MS` defaults to `5000` and permits `100`–`15000`. Each poll has a 45-second overall limit. Requests accept at most 1 MiB of XML. An indexed host listing reads up to 256 entries per poll and is marked partial if truncated. A failed poll backs off and preserves an existing observation as stale. If the required configuration is invalid, the collector issues no router requests.

To roll back the feature after a separately approved rollout, set `FRITZ_ENABLED=false` and restart the probe service using the existing deployment procedure. Restore the previous artifacts if needed, keeping the original web origin to preserve client-side data. The collector has no on-disk database. Verify the legacy health, reachability, and PWA flows after rollback.

## 11. Raspberry Pi release and inventory

For the existing Pi, use the [release and rollback runbook](pi-release-runbook.md). The staging bundle uses Node 24 LTS and separates a candidate versioned runtime from the system Node. Inventory defaults to disabled. Enable with `INVENTORY_ENABLED=true`, an absolute `INVENTORY_DB_PATH` in the dedicated writable service directory, and the configured IP Watch bearer token. Back up the SQLite inventory independently of the browser data. A JSON export also captures the entire manual mapping.

Diagnostics uses a second SQLite file, `diagnostics.sqlite`, in the same directory. It starts when inventory storage is enabled and stores selected targets, 24-hour ICMP samples and observed mesh-link changes. The monitor waits 30 seconds after each completed batch and does not overlap batches. Each target uses a current unambiguous FRITZ! address. Include the complete inventory directory in consistent backups and restore rehearsals. Test disk growth and CPU use on the actual Pi with the owner's chosen targets before increasing the target count.
