# IP Watch E2E Runbook (Raspberry Pi + iPhone)

## Goal
Validate end-to-end operation of:
- native probe-host service on Raspberry Pi
- nginx web delivery
- iPhone PWA install and runtime behavior

## Prerequisites
- Raspberry Pi and iPhone are in the same Wi-Fi/LAN.
- Native install was executed:
  - `sudo ./deploy/scripts/pi-native-install.sh`
- Probe target devices (PS5/PC/TV) are available in LAN.

## Step 1: Verify services on Raspberry Pi
Run on Raspberry Pi:
```bash
sudo ./deploy/scripts/verify-native-services.sh
```

Expected:
- `ip-watch-probe.service` active/running.
- `nginx` active/running.
- API endpoints return JSON without errors.

## Step 2: Confirm LAN reachability
Find Pi IP:
```bash
hostname -I
```

From another LAN machine:
```bash
curl http://<PI_IP>/api/health
```

Expected:
- JSON response with `"ok": true`.

## Step 3: Open app on iPhone
On iPhone Safari:
- Open `http://<PI_IP>/`

Expected:
- Splash appears for ~2 seconds.
- Device list loads.
- Probe indicator visible.

## Step 4: Configure probe endpoint in app
In app settings:
- Host: `<PI_IP>`
- Protocol: `http`
- Port: `80` (or empty if nginx standard routing is used)
- API token: empty (unless enabled server-side)

Expected:
- Toast after save:
  - reachable: success
  - unreachable: error

## Step 5: Manual status refresh
Press `Refresh`.

Expected:
- Toast `Status refresh completed.` (or clear error).
- Device status/source updates (`PING`, `HTTP`, `PING+HTTP`, `UNKNOWN`).
- Refresh sends current local device list to probe API (`/api/status/check-now`).

## Step 6: Device flow (frontend-persistent)
In app:
1. Add new device with valid IP.
2. Edit same device.
3. Delete device.

Expected:
- All operations succeed.
- Changes persist after page reload on the same client (IndexedDB).

## Step 7: PWA install check (iPhone)
In Safari:
1. Share -> `Add to Home Screen`
2. Launch app from Home Screen

Expected:
- App starts standalone.
- Splash still visible.
- Data remains available.

## Step 8: Probe correctness sanity check
Pick one online and one offline IP.

Expected:
- Online target trends to reachable (`PING`/`PING+HTTP`).
- Offline target trends to `UNKNOWN`/offline.

## Step 9: Logs and troubleshooting
On Raspberry Pi:
```bash
sudo journalctl -u ip-watch-probe.service -n 100 --no-pager
sudo nginx -t
```

If status stays unavailable:
- Check app host/protocol/port.
- Check `curl http://127.0.0.1:3001/api/health` on Pi.
- Confirm probe service env in `/etc/ip-watch/probe-host.env`.

## Acceptance (Done)
- Services stable after reboot.
- iPhone PWA install works.
- Probe refresh works with expected status transitions.
- Device CRUD persists client-side and remains consistent.
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