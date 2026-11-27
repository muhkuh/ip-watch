#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || "$1" != /* ]]; then
  echo 'Usage: bash pi-release-preflight.sh /absolute/path/to/extracted-release' >&2
  exit 2
fi
RELEASE="$1"
NODE_BIN="${NODE_BIN:-/usr/bin/node}"
SERVICE="ip-watch-probe.service"

if [[ "$(uname -m)" != aarch64 ]]; then
  echo 'Expected a 64-bit ARM Raspberry Pi or equivalent staging host.' >&2
  exit 1
fi
"$NODE_BIN" -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major !== 24 || minor < 15 || process.arch !== "arm64") { console.error("Expected ARM64 Node 24.15+."); process.exit(1); }'
"$NODE_BIN" -e 'const { DatabaseSync } = require("node:sqlite"); const db = new DatabaseSync(":memory:"); if (db.prepare("SELECT 1 AS ok").get().ok !== 1) process.exit(1); db.close();'
test -f "$RELEASE/BUILD-INFO"
test -f "$RELEASE/probe-host/src/server.js"
test -f "$RELEASE/probe-host/package-lock.json"
test -f "$RELEASE/web/index.html"
test -f "$RELEASE/web/ngsw.json"
test -f "$RELEASE/web/ngsw-worker.js"
id ipwatch >/dev/null
systemctl is-active --quiet "$SERVICE"
systemctl is-active --quiet nginx
nginx -t
curl --fail --silent --show-error --max-time 5 http://127.0.0.1/api/health | "$NODE_BIN" -e '
  const status = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
  if (status.ok !== true || status.service !== "ip-watch-probe-host") process.exit(1);
'
df -h "$RELEASE" /opt /var/www /var/lib
printf 'Read-only preflight passed. Candidate runtime: %s\n' "$("$NODE_BIN" --version)"
