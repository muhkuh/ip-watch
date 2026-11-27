# Raspberry Pi release and rollback

The target is the existing 64-bit Debian Raspberry Pi installation with `ip-watch-probe.service`, Nginx and the `ipwatch` account. The first release smoke keeps the app's existing scheme, host and port. IndexedDB and localStorage belong to that browser origin. The release archive includes the built PWA and the probe source with its pinned npm lockfile. It contains no live service configuration or data.

## 1. Prepare and verify the archive

Use a reviewed worktree and Node 24 LTS (24.15 or later). Record the reviewed commit and archive SHA-256. A dirty worktree is recorded in `BUILD-INFO` and is suitable for staging. Review dependency audit output and the release notes before approving production.

```bash
(cd probe-host && npm ci && npm audit --omit=dev && npm test)
(cd frontend && npm ci && npm audit --omit=dev && npm audit --audit-level=high && npm test -- --watch=false --browsers=ChromeHeadless)
bash deploy/scripts/build-pi-release.sh /absolute/path/ip-watch-RELEASE.tar.gz
tar -tzf /absolute/path/ip-watch-RELEASE.tar.gz
```

Use a fresh staging directory on the Pi or equivalent ARM64 Debian host. Transfer the archive over the existing trusted admin channel and compare its SHA-256 with the recorded value before extraction. Install Node 24.22.3 for Linux ARM64 under a versioned path such as `/opt/ip-watch-runtime/node-v24.22.3`. Verify the downloaded tarball against the official signed Node release checksums before extracting it. Keep the existing system Node available for rollback. [Official Node ARM64 release and checksums](https://nodejs.org/en/blog/release/v24.22.3)

From the extracted release as the staging account, using an actual staging path:

```bash
release="$PWD"
runtime=/opt/ip-watch-runtime/node-v24.22.3
export PATH="$runtime/bin:$PATH"
(cd "$release/probe-host" && npm ci --omit=dev --no-fund)
node "$release/pi-release-smoke.cjs" "$release"
sudo env NODE_BIN="$runtime/bin/node" bash "$release/pi-release-preflight.sh" "$release"
```

The read-only preflight verifies the candidate ARM64 runtime, expected release files, the current service and Nginx health, and free space. Inspect `systemctl cat ip-watch-probe.service` locally for custom overrides and `nginx -T` locally for the actual web root and any proxy settings. Keep sensitive values and complete configuration dumps out of deployment notes.

## 2. Rehearse and back up

The release smoke runs the candidate on loopback with a generated token and temporary SQLite test data. It checks health, legacy status, FRITZ! disabled state, authorization, patch panel writes, backup and restore across service starts, and export/import. Rehearse the web and systemd rollback below on staging as well. For production, arrange access to the existing browser context and record a representative previously tracked device. If the production web origin must move to HTTPS or change host/port, first agree and test a separate browser-data preservation and transition procedure. The phase can be installed on the current origin with the integrations disabled.

Before the approved cutover, record the SHA-256, prior systemd unit and drop-in paths, active runtime and working directory, the web root, and app origin. Using a root-only backup directory, save copies of:

- The current web root and deployed probe code/dependencies or the prior release path, plus the active systemd unit and drop-ins.
- The protected service environment file and relevant Nginx site files/symlinks. Preserve ownership and permissions.
- The inventory database if present. Prefer an authenticated JSON inventory export and a consistent SQLite snapshot. A cold snapshot requires the probe service to be stopped and an orderly shutdown with no remaining writers. Copy the inventory directory as a unit. Rehearse recovery from the snapshot in staging before relying on it.

The old `pi-backup.sh` handles `devices.json`. Browser records and the SQLite inventory use separate backup procedures. Include neither private inventory nor credentials in the release archive.

## 3. Stage the candidate

Perform only after production approval. The examples assume the native web root is `/var/www/ip-watch` and the service uses the paths in the repository template. Adapt using the preflight evidence. Use an unused release identifier. Code and build artifacts should be root-owned and readable by the runtime accounts, while only the inventory directory needs write access for `ipwatch`.

```bash
release_id=REPLACE_WITH_REVIEWED_RELEASE_ID
[[ "$release_id" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]] || exit 1
backend="/opt/ip-watch-releases/$release_id"
next_web="/var/www/ip-watch-next-$release_id"
previous_web="/var/www/ip-watch-previous-$release_id"
for candidate in "$backend" "$next_web" "$previous_web"; do
  [[ ! -e "$candidate" && ! -L "$candidate" ]] || exit 1
done
sudo install -d -m 0755 "$backend/probe-host" "$next_web"
sudo cp -a "$release/probe-host/." "$backend/probe-host/"
sudo cp -a /var/www/ip-watch/. "$next_web/"
sudo cp -a "$release/web/." "$next_web/"
sudo chown -R root:root "$backend" "$next_web"
sudo chmod -R a+rX,go-w "$backend" "$next_web"
sudo nginx -t
```

The staged web root retains previous hashed bundles for the rollback window so an already-open app can still load its lazy modules. Retire old bundles in a separate maintenance step after clients have updated.

Prepare a new systemd drop-in for the probe only. Back up any prior file at the selected name first. Do not replace the existing unit wholesale. Substitute the exact verified release path and Node version. Keep the current environment file path and bind address. Check the effective unit locally before restarting. If an older drop-in also sets these directives, resolve the precedence before proceeding.

```ini
[Service]
WorkingDirectory=/opt/ip-watch-releases/RELEASE_ID/probe-host
ExecStart=
ExecStart=/opt/ip-watch-runtime/node-v24.22.3/bin/node src/server.js
```

## 4. Cut over and verify

During the approved window, keep FRITZ! and inventory disabled for the first smoke. Run `systemctl daemon-reload`, restart `ip-watch-probe.service`, and validate `/api/health` and `/api/status` through the existing Nginx origin. Then rename the current web root to the prepared previous path and the staged web root into the original path. These two same-filesystem renames have a brief gap. If the second fails, immediately rename the previous web root back. Nginx configuration is unchanged in this path. Check the app and `/network`, `ngsw.json`, a representative existing device, and the legacy check on an approved target. Run the [iPhone checklist](e2e-runbook.md#9-owner-validation-for-fritz-integration).

Enable integrations separately after the disabled smoke is accepted. For FRITZ!, follow the [owner validation](e2e-runbook.md#9-owner-validation-for-fritz-integration) and verify TLS, the exact permitted read calls, sample hosts and observation timestamps. For inventory, create a dedicated directory owned by `ipwatch` with mode `0750`. Set `INVENTORY_DB_PATH` to a new absolute SQLite file within it and set `INVENTORY_ENABLED=true`. Verify the effective systemd write paths include the directory and the service retains the current LAN binding policy. Set `PROBE_API_TOKEN` only under the approved access policy. Configure existing clients if introducing the token for the first time. Restart only the probe, then verify all 12 positions, an authorized test edit, duplicate validation, persistence, and JSON export. Complete live writes on the owner's approved test position and remove synthetic labels via the normal UI.

Treat authentication and TLS between the owner browser and the Nginx origin as a separate deployment decision from TLS to the router. Establish the owner-approved secure access path before activating the features with real inventory or router data. Confirm an unauthenticated request cannot read or write either feature. Preserve existing client data when transitioning origins.

## 5. Roll back

Roll back if basic health, existing browser data, or legacy device probes fail. Record the failed release and keep its files for diagnosis. Disable the failing integration in the protected config when its failure is isolated. For a full rollback:

1. Restore the prior service environment file and saved unit/drop-in configuration. If the release drop-in was newly introduced, move it out of the drop-in directory. Reload systemd, restart only the probe service, and verify its previous health and legacy API through Nginx.
2. Rename the candidate web root aside and put the saved prior web root at the original path. Verify the index, service worker manifest, installed PWA and previously tracked device at the same origin. Retain the candidate root until the investigation is complete.
3. Leave the inventory database backed up. An app rollback to Phase 1 has no schema downgrade step. A database restore is a separate recovery action using a verified snapshot after stopping the probe and preserving the current DB. Check database integrity and permissions before restart.
4. Verify unrelated services stay active. Record the release ID, checks, reason, and recovery outcome.
