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
